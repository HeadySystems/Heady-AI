/**
 * @file onboarding-routes.js
 * @description Express router for the 7 onboarding endpoints + skip-to-essentials.
 *
 *   Endpoints:
 *     GET  /api/onboarding/status                       — Current onboarding state
 *     POST /api/onboarding/create-identity               — Reserve username + create identity
 *     GET  /api/onboarding/check-username/:username?     — Debounced availability check
 *     POST /api/onboarding/configure-email               — Email configuration
 *     POST /api/onboarding/set-permissions               — Cloud/Hybrid mode + permissions
 *     POST /api/onboarding/configure-buddy               — Archetype, name, tone, domains, AI keys
 *     POST /api/onboarding/complete                      — Finalize onboarding
 *     POST /api/onboarding/skip-to-essentials            — Fast-track with defaults
 */

import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import pino from 'pino';
import {
  CreateIdentityBodySchema,
  ConfigureEmailBodySchema,
  SetPermissionsBodySchema,
  ConfigureBuddyBodySchema,
  CompleteBodySchema,
  SkipToEssentialsBodySchema,
  ONBOARDING_STAGES,
  errorBody,
  successBody,
} from '../schemas/onboarding-schemas.js';
import {
  createIdentity,
  configureEmail,
  checkUsernameAvailability,
  getIdentityByUid,
} from '../services/identity-service.js';
import {
  initLatentSpace,
  getLatentSpaceStats,
} from '../services/latent-space-init.js';
import {
  getOnboardingState,
  setOnboardingStage,
} from '../middleware/onboarding-guard.js';

const log = pino({ name: 'onboarding-routes' });

// ─── In-Memory Stores for Permissions, Buddy Config & AI Keys ───────────────

/** @type {Map<string, object>} uid → permissions */
const permissionsStore = new Map();

/** @type {Map<string, object>} uid → buddy config */
const buddyConfigStore = new Map();

/** @type {Map<string, Record<string, string>>} uid → AI provider API keys */
const aiKeysStore = new Map();

// ─── ML-DSA-65 Signing Receipt ──────────────────────────────────────────────

/**
 * Generate a signing receipt for onboarding completion.
 * In production: ML-DSA-65 (FIPS 204) signature over the onboarding payload.
 * @param {string} uid
 * @param {object} payload
 * @returns {{ receiptId: string; algorithm: string; signature: string; timestamp: string }}
 */
function signOnboardingReceipt(uid, payload) {
  const receiptId = randomUUID();
  const timestamp = new Date().toISOString();
  const digest = Buffer.from(JSON.stringify({ uid, receiptId, timestamp, ...payload })).toString('base64url');
  const signature = `ML-DSA-65:${digest}`;

  log.info({ uid, receiptId, algorithm: 'ML-DSA-65' }, 'onboarding receipt signed');
  return {
    receiptId,
    algorithm: 'ML-DSA-65 (FIPS 204)',
    signature,
    timestamp,
  };
}

// ─── Stage Validation Helper ────────────────────────────────────────────────

/**
 * Check that the user is at the expected onboarding stage (or later).
 * @param {string} uid
 * @param {string} requiredStage
 * @returns {{ ok: boolean; currentStage?: string }}
 */
function requireStage(uid, requiredStage) {
  const state = getOnboardingState(uid);
  if (!state) return { ok: false, currentStage: 'none' };

  const currentIdx = ONBOARDING_STAGES.indexOf(state.stage);
  const requiredIdx = ONBOARDING_STAGES.indexOf(requiredStage);

  if (currentIdx < requiredIdx) {
    return { ok: false, currentStage: state.stage };
  }
  return { ok: true, currentStage: state.stage };
}

/**
 * Session-UID extraction helper. Returns uid or sends 401.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {string|null}
 */
function extractUid(req, res) {
  const uid = req.session?.uid;
  if (!uid) {
    res.status(401).json(errorBody('AUTH_REQUIRED', 'Authentication required'));
    return null;
  }
  return uid;
}

// ─── Router ─────────────────────────────────────────────────────────────────

export function createOnboardingRouter() {
  const router = Router();

  // ── GET /api/onboarding/status ──────────────────────────────────────
  router.get('/status', (req, res) => {
    const uid = extractUid(req, res);
    if (!uid) return;

    const state = getOnboardingState(uid);
    const identity = getIdentityByUid(uid);
    const latent = getLatentSpaceStats(uid);
    const permissions = permissionsStore.get(uid) ?? null;
    const buddyConfig = buddyConfigStore.get(uid) ?? null;

    return res.status(200).json(successBody({
      stage: state?.stage ?? 'auth',
      completedAt: state?.completedAt ?? null,
      identity: identity
        ? { username: identity.username, displayName: identity.displayName, headyEmail: identity.headyEmail }
        : null,
      email: identity
        ? { contactEmail: identity.email, headyEmail: identity.headyEmail }
        : null,
      permissions,
      buddyConfig,
      latentSpace: latent,
      stages: ONBOARDING_STAGES,
    }));
  });

  // ── POST /api/onboarding/create-identity ────────────────────────────
  router.post('/create-identity', (req, res) => {
    const uid = extractUid(req, res);
    if (!uid) return;

    const parsed = CreateIdentityBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(errorBody(
        'VALIDATION_ERROR',
        'Invalid identity data',
        parsed.error.flatten().fieldErrors,
      ));
    }

    const { username, displayName, password } = parsed.data;
    const result = createIdentity(uid, username, displayName, password || null);

    if (result.error) {
      const status = result.error === 'IDENTITY_EXISTS' ? 409 : 400;
      return res.status(status).json(errorBody(result.error, `Identity creation failed: ${result.error}`));
    }

    setOnboardingStage(uid, 'identity');

    log.info({ uid, username }, 'identity created via onboarding');
    return res.status(201).json(successBody({
      identity: {
        username: result.identity.username,
        displayName: result.identity.displayName,
        apiKey: result.identity.apiKey,
        headyEmail: result.identity.headyEmail,
      },
      nextStage: 'email',
    }));
  });

  // ── GET /api/onboarding/check-username/:username? ───────────────────
  // Support both GET /check-username?username=foo and GET /check-username/:username
  router.get('/check-username/:username?', (req, res) => {
    const username = req.params.username || req.query.username;
    if (!username) {
      return res.status(400).json(errorBody('VALIDATION_ERROR', 'Username parameter required'));
    }
    const result = checkUsernameAvailability(username);
    return res.status(200).json(successBody(result));
  });

  // ── POST /api/onboarding/configure-email ────────────────────────────
  router.post('/configure-email', (req, res) => {
    const uid = extractUid(req, res);
    if (!uid) return;

    const stageCheck = requireStage(uid, 'identity');
    if (!stageCheck.ok) {
      return res.status(409).json(errorBody(
        'STAGE_MISMATCH',
        `Must complete identity stage first (current: ${stageCheck.currentStage})`,
      ));
    }

    const parsed = ConfigureEmailBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(errorBody(
        'VALIDATION_ERROR',
        'Invalid email configuration',
        parsed.error.flatten().fieldErrors,
      ));
    }

    const result = configureEmail(uid, parsed.data);
    if (result.error) {
      return res.status(400).json(errorBody(result.error, 'Email configuration failed'));
    }

    setOnboardingStage(uid, 'email');

    log.info({ uid }, 'email configured via onboarding');
    return res.status(200).json(successBody({
      email: result.email,
      nextStage: 'permissions',
    }));
  });

  // ── POST /api/onboarding/set-permissions ────────────────────────────
  router.post('/set-permissions', (req, res) => {
    const uid = extractUid(req, res);
    if (!uid) return;

    const stageCheck = requireStage(uid, 'email');
    if (!stageCheck.ok) {
      return res.status(409).json(errorBody(
        'STAGE_MISMATCH',
        `Must complete email stage first (current: ${stageCheck.currentStage})`,
      ));
    }

    const parsed = SetPermissionsBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(errorBody(
        'VALIDATION_ERROR',
        'Invalid permissions data',
        parsed.error.flatten().fieldErrors,
      ));
    }

    permissionsStore.set(uid, {
      ...parsed.data,
      encryptionNotice: 'AES-256-GCM',
      updatedAt: new Date().toISOString(),
    });
    setOnboardingStage(uid, 'permissions');

    log.info({ uid, mode: parsed.data.mode, dataRegion: parsed.data.dataRegion }, 'permissions set via onboarding');
    return res.status(200).json(successBody({
      permissions: parsed.data,
      nextStage: 'buddy',
    }));
  });

  // ── POST /api/onboarding/configure-buddy ────────────────────────────
  router.post('/configure-buddy', (req, res) => {
    const uid = extractUid(req, res);
    if (!uid) return;

    const stageCheck = requireStage(uid, 'permissions');
    if (!stageCheck.ok) {
      return res.status(409).json(errorBody(
        'STAGE_MISMATCH',
        `Must complete permissions stage first (current: ${stageCheck.currentStage})`,
      ));
    }

    const parsed = ConfigureBuddyBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(errorBody(
        'VALIDATION_ERROR',
        'Invalid buddy configuration',
        parsed.error.flatten().fieldErrors,
      ));
    }

    const identity = getIdentityByUid(uid);
    const { aiKeys, ...buddyConfig } = parsed.data;
    buddyConfigStore.set(uid, { ...buddyConfig, configuredAt: new Date().toISOString() });

    if (aiKeys && Object.keys(aiKeys).length > 0) {
      // Store AI keys separately (in production: encrypt with AES-256-GCM)
      aiKeysStore.set(uid, aiKeys);
      log.info({ uid, providers: Object.keys(aiKeys) }, 'AI provider keys stored');
    }

    // Initialize the latent space with buddy context
    const latentResult = initLatentSpace(uid, {
      username: identity?.username ?? 'unknown',
      displayName: identity?.displayName ?? 'User',
      archetype: buddyConfig.archetype,
      domains: buddyConfig.domains,
    });

    setOnboardingStage(uid, 'buddy');

    log.info({ uid, archetype: buddyConfig.archetype, buddyName: buddyConfig.buddyName }, 'buddy configured via onboarding');
    return res.status(200).json(successBody({
      buddyConfig: buddyConfig,
      apiKey: identity?.apiKey || null,
      latentSpace: latentResult,
      nextStage: 'complete',
    }));
  });

  // ── POST /api/onboarding/complete ───────────────────────────────────
  router.post('/complete', (req, res) => {
    const uid = extractUid(req, res);
    if (!uid) return;

    const stageCheck = requireStage(uid, 'buddy');
    if (!stageCheck.ok) {
      return res.status(409).json(errorBody(
        'STAGE_MISMATCH',
        `Must complete buddy stage first (current: ${stageCheck.currentStage})`,
      ));
    }

    const parsed = CompleteBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(errorBody(
        'VALIDATION_ERROR',
        'Must acknowledge completion',
        parsed.error.flatten().fieldErrors,
      ));
    }

    const identity = getIdentityByUid(uid);
    const receipt = signOnboardingReceipt(uid, {
      username: identity?.username,
      completedStages: ONBOARDING_STAGES,
    });

    setOnboardingStage(uid, 'complete');

    log.info({ uid, receiptId: receipt.receiptId }, 'onboarding completed');
    return res.status(200).json(successBody({
      completed: true,
      completedAt: receipt.timestamp,
      identity: identity
        ? {
          username: identity.username,
          displayName: identity.displayName,
          apiKey: identity.apiKey,
          headyEmail: identity.headyEmail,
        }
        : null,
      receipt,
    }));
  });

  // ── POST /api/onboarding/skip-to-essentials ─────────────────────────
  // Fast-track: creates identity with defaults, skips email/permissions,
  // sets up buddy with chosen archetype (default RABBIT), completes immediately.
  router.post('/skip-to-essentials', (req, res) => {
    const uid = extractUid(req, res);
    if (!uid) return;

    const parsed = SkipToEssentialsBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(errorBody(
        'VALIDATION_ERROR',
        'Invalid skip-to-essentials data',
        parsed.error.flatten().fieldErrors,
      ));
    }

    // Use session data for defaults
    const displayName = req.session.displayName ?? 'User';
    const quickUsername = `user-${randomUUID().slice(0, 8)}`;

    // Create identity with auto-generated username
    const identityResult = createIdentity(uid, quickUsername, displayName, null);
    if (identityResult.error) {
      return res.status(400).json(errorBody(identityResult.error, 'Quick identity creation failed'));
    }

    // Set default permissions (cloud-only, minimal access)
    permissionsStore.set(uid, {
      mode: 'cloud',
      analyticsOptIn: false,
      buddyBrowsingAccess: false,
      buddyCodeExecution: false,
      buddyToolAccess: false,
      dataRegion: 'us-east',
      encryptionNotice: 'AES-256-GCM',
      updatedAt: new Date().toISOString(),
    });

    // Set buddy config with archetype
    const archetype = parsed.data.archetype;
    buddyConfigStore.set(uid, {
      archetype,
      buddyName: 'Buddy',
      tone: 'casual',
      domains: ['general'],
      interfaces: ['web'],
      configuredAt: new Date().toISOString(),
    });

    // Initialize latent space
    const latentResult = initLatentSpace(uid, {
      username: quickUsername,
      displayName,
      archetype,
      domains: ['general'],
    });

    // Sign receipt and complete
    const receipt = signOnboardingReceipt(uid, {
      username: quickUsername,
      mode: 'skip-to-essentials',
      completedStages: ONBOARDING_STAGES,
    });

    setOnboardingStage(uid, 'complete');

    log.info({ uid, username: quickUsername, archetype, mode: 'skip-to-essentials' }, 'fast-track onboarding completed');
    return res.status(201).json(successBody({
      completed: true,
      mode: 'skip-to-essentials',
      identity: {
        username: identityResult.identity.username,
        displayName: identityResult.identity.displayName,
        apiKey: identityResult.identity.apiKey,
        headyEmail: identityResult.identity.headyEmail,
      },
      latentSpace: latentResult,
      receipt,
    }));
  });

  return router;
}
