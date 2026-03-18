/**
 * @file auth-routes.js
 * @description Firebase OAuth callback, token verification, session JWT creation.
 *   Supports Tier 1 native providers + Tier 2 OIDC custom providers via Firebase Auth.
 *
 *   Endpoints:
 *     POST /auth/callback  — Exchange Firebase ID token for session JWT
 *     POST /auth/refresh   — Re-issue JWT from existing session
 *     POST /auth/logout    — Destroy session
 *     GET  /auth/session   — Return current session info
 */

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import pino from 'pino';
import { getAuth } from 'firebase-admin/auth';
import { AuthCallbackBodySchema, errorBody, successBody } from '../schemas/onboarding-schemas.js';
import { initOnboardingState } from '../middleware/onboarding-guard.js';

const log = pino({ name: 'auth-routes' });

const JWT_SECRET = process.env.JWT_SECRET ?? 'heady-dev-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = '24h';

/**
 * Create the auth router.
 * @param {import('firebase-admin').app.App} firebaseApp  Initialized Firebase Admin app.
 * @returns {Router}
 */
export function createAuthRouter(firebaseApp) {
  const router = Router();
  const auth = getAuth(firebaseApp);

  // ── POST /auth/callback ───────────────────────────────────────────────
  // Receives a Firebase ID token from the client, verifies it with
  // checkRevoked=true, creates a server-side session, and returns a session JWT.
  router.post('/callback', async (req, res) => {
    const parsed = AuthCallbackBodySchema.safeParse(req.body);
    if (!parsed.success) {
      log.warn({ errors: parsed.error.flatten() }, 'invalid auth callback body');
      return res.status(400).json(errorBody(
        'VALIDATION_ERROR',
        'Invalid request body',
        parsed.error.flatten().fieldErrors,
      ));
    }

    const { idToken, provider } = parsed.data;

    try {
      // Verify the Firebase ID token (checkRevoked = true)
      const decoded = await auth.verifyIdToken(idToken, true);

      const uid = decoded.uid;
      const email = decoded.email ?? null;
      const displayName = decoded.name ?? decoded.email ?? 'User';
      const photoURL = decoded.picture ?? null;

      // Initialize onboarding state (idempotent)
      initOnboardingState(uid);

      // Set session
      req.session.uid = uid;
      req.session.email = email;
      req.session.provider = provider;
      req.session.displayName = displayName;
      req.session.photoURL = photoURL;
      req.session.authenticatedAt = new Date().toISOString();

      // Create session JWT for API calls
      const sessionToken = jwt.sign(
        { uid, email, provider },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN, issuer: 'headyme-onboarding' },
      );

      log.info({ uid, provider, email }, 'auth callback successful');

      return res.status(200).json(successBody({
        uid,
        email,
        displayName,
        photoURL,
        provider,
        sessionToken,
        onboardingStage: 'auth',
      }));
    } catch (err) {
      log.error({ err: err.message, code: err.code }, 'Firebase token verification failed');

      if (err.code === 'auth/id-token-expired') {
        return res.status(401).json(errorBody('TOKEN_EXPIRED', 'Firebase ID token has expired'));
      }
      if (err.code === 'auth/id-token-revoked') {
        return res.status(401).json(errorBody('TOKEN_REVOKED', 'Firebase ID token has been revoked'));
      }
      if (err.code === 'auth/argument-error') {
        return res.status(400).json(errorBody('INVALID_TOKEN', 'Malformed Firebase ID token'));
      }

      return res.status(401).json(errorBody('AUTH_FAILED', 'Authentication failed'));
    }
  });

  // ── POST /auth/refresh ────────────────────────────────────────────────
  // Re-issue a session JWT from an existing valid session.
  router.post('/refresh', (req, res) => {
    const uid = req.session?.uid;
    if (!uid) {
      return res.status(401).json(errorBody('NO_SESSION', 'No active session'));
    }

    const sessionToken = jwt.sign(
      { uid, email: req.session.email, provider: req.session.provider },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN, issuer: 'headyme-onboarding' },
    );

    log.info({ uid }, 'session token refreshed');
    return res.status(200).json(successBody({ sessionToken }));
  });

  // ── POST /auth/logout ─────────────────────────────────────────────────
  router.post('/logout', (req, res) => {
    const uid = req.session?.uid;
    req.session.destroy((err) => {
      if (err) {
        log.error({ err: err.message, uid }, 'session destroy failed');
        return res.status(500).json(errorBody('SESSION_ERROR', 'Failed to destroy session'));
      }
      res.clearCookie('heady.sid');
      log.info({ uid }, 'user logged out');
      return res.status(200).json(successBody({ loggedOut: true }));
    });
  });

  // ── GET /auth/session ─────────────────────────────────────────────────
  // Return current session info (for client hydration on page load).
  router.get('/session', (req, res) => {
    const uid = req.session?.uid;
    if (!uid) {
      return res.status(200).json(successBody({ authenticated: false }));
    }

    return res.status(200).json(successBody({
      authenticated: true,
      uid,
      email: req.session.email,
      provider: req.session.provider,
      displayName: req.session.displayName,
      photoURL: req.session.photoURL,
      authenticatedAt: req.session.authenticatedAt,
    }));
  });

  return router;
}
