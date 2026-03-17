/**
 * @file onboarding-guard.js
 * @description In-memory onboarding state tracking and Express middleware that
 *   blocks non-onboarded users from accessing app routes.
 *
 *   State flow: auth → identity → email → permissions → buddy → complete
 *
 *   Routes exempt from the guard:
 *     - /health, /ready
 *     - /auth/*
 *     - /api/onboarding/*
 */

import pino from 'pino';
import { ONBOARDING_STAGES } from '../schemas/onboarding-schemas.js';

const log = pino({ name: 'onboarding-guard' });

// ─── In-Memory Onboarding State ─────────────────────────────────────────────

/**
 * @typedef {object} OnboardingState
 * @property {string} uid
 * @property {string} stage         Current stage from ONBOARDING_STAGES.
 * @property {string} startedAt     ISO timestamp.
 * @property {string|null} completedAt  ISO timestamp when stage='complete', else null.
 */

/** @type {Map<string, OnboardingState>} uid → state */
const stateStore = new Map();

// ─── State Management ───────────────────────────────────────────────────────

/**
 * Initialize onboarding state for a newly authenticated user.
 * If state already exists for this UID it is left untouched (idempotent).
 * @param {string} uid
 * @returns {OnboardingState}
 */
export function initOnboardingState(uid) {
  if (stateStore.has(uid)) {
    return stateStore.get(uid);
  }

  const state = {
    uid,
    stage: 'auth',
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
  stateStore.set(uid, state);
  log.info({ uid, stage: 'auth' }, 'onboarding state initialized');
  return state;
}

/**
 * Get the current onboarding state for a user.
 * @param {string} uid
 * @returns {OnboardingState|null}
 */
export function getOnboardingState(uid) {
  return stateStore.get(uid) ?? null;
}

/**
 * Advance the onboarding stage for a user.
 * Validates that the new stage is a valid progression from the current stage.
 * @param {string} uid
 * @param {string} stage  Target stage from ONBOARDING_STAGES.
 * @returns {OnboardingState|null}  Updated state, or null if UID not found.
 */
export function setOnboardingStage(uid, stage) {
  const state = stateStore.get(uid);
  if (!state) return null;

  const currentIdx = ONBOARDING_STAGES.indexOf(state.stage);
  const targetIdx = ONBOARDING_STAGES.indexOf(stage);

  if (targetIdx < 0) {
    log.warn({ uid, stage }, 'attempted to set invalid onboarding stage');
    return state;
  }

  if (targetIdx < currentIdx) {
    log.warn({ uid, currentStage: state.stage, targetStage: stage }, 'attempted to regress onboarding stage');
    return state;
  }

  state.stage = stage;
  if (stage === 'complete') {
    state.completedAt = new Date().toISOString();
  }

  log.info({ uid, stage }, 'onboarding stage updated');
  return state;
}

/**
 * Check whether a user has completed onboarding.
 * @param {string} uid
 * @returns {boolean}
 */
export function isOnboardingComplete(uid) {
  const state = stateStore.get(uid);
  return state?.stage === 'complete';
}

/**
 * Delete onboarding state (for testing or account removal).
 * @param {string} uid
 * @returns {boolean}
 */
export function deleteOnboardingState(uid) {
  return stateStore.delete(uid);
}

// ─── Express Middleware ─────────────────────────────────────────────────────

/** Paths exempt from the onboarding guard. */
const EXEMPT_PREFIXES = ['/health', '/ready', '/auth', '/api/onboarding'];

/**
 * Express middleware factory.
 * Allows auth & onboarding routes through unconditionally.
 * Blocks all other routes if the user hasn't completed onboarding.
 * @returns {import('express').RequestHandler}
 */
export function onboardingGuard() {
  return (req, res, next) => {
    // Allow exempt paths
    const path = req.path;
    for (const prefix of EXEMPT_PREFIXES) {
      if (path === prefix || path.startsWith(prefix + '/')) {
        return next();
      }
    }

    // No session → let auth middleware handle it
    const uid = req.session?.uid;
    if (!uid) {
      return next();
    }

    // Check onboarding completion
    if (!isOnboardingComplete(uid)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'ONBOARDING_REQUIRED',
          message: 'Please complete onboarding before accessing the application',
          currentStage: getOnboardingState(uid)?.stage ?? 'auth',
        },
      });
    }

    return next();
  };
}
