// ============================================================================
// HEADY UNIFIED AUTH ADAPTER v1.0
// src/auth/unified-auth.mjs
//
// Addresses Gap #4: Dual auth systems (Firebase + custom OAuth registry)
// running in parallel without clear unification strategy.
//
// This adapter provides a SINGLE entry point for all authentication:
//   1. Firebase Auth handles identity verification (JWT validation)
//   2. Provider Registry handles the 27 social OAuth flows
//   3. Postgres sessions table provides persistent session state
//   4. Redis provides fast session lookup cache (T0)
//   5. Cross-domain SSO via httpOnly cookies + relay iframe
//
// Auth flow:
//   User → Provider (Google/GitHub/etc.) → Firebase Auth → JWT
//   JWT → unified-auth.mjs → validate → create/update Postgres user
//   → create session (Postgres + Redis) → set httpOnly cookie
//   → return session token to client
//
// The key insight: Firebase Auth is the IDENTITY layer (who are you?)
// while our Postgres users table is the PROFILE layer (what can you do?).
// The unified adapter bridges these cleanly.
//
// © 2026 HeadySystems Inc.
// ============================================================================

import { createLogger } from '../lib/logger.mjs';
import crypto from 'node:crypto';

const logger = createLogger('unified-auth');

// φ-scaled session timing constants (from auth-gateway.js scan findings)
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];
const SESSION_MAX_AGE_HOURS = FIB[8];         // 21 hours
const SESSION_RENEW_AFTER_HOURS = FIB[7];     // 13 hours
const SESSION_ABSOLUTE_MAX_HOURS = FIB[10];   // 55 hours

/**
 * UnifiedAuth — Single entry point for all Heady authentication.
 *
 * Dependencies:
 *   - pg: Postgres pool (for users, sessions, oauth_connections tables)
 *   - redis: Redis client (for T0 session cache)
 *   - firebaseAdmin: Firebase Admin SDK (for JWT verification)
 */
export class UnifiedAuth {
  constructor({ pg, redis, firebaseAdmin }) {
    this.pg = pg;
    this.redis = redis;
    this.firebase = firebaseAdmin;
  }

  // ════════════════════════════════════════════════════════════════════
  // SESSION CREATION (called after successful OAuth callback)
  // ════════════════════════════════════════════════════════════════════

  /**
   * Create or update a user from Firebase token, then create a session.
   * This is the primary auth entry point after OAuth callback.
   *
   * @param {string} firebaseIdToken - The Firebase ID token from client
   * @param {object} options - { provider, providerProfile, deviceInfo, ipAddress, userAgent, originSite }
   * @returns {{ sessionToken, user, isNewUser }}
   */
  async authenticateWithFirebase(firebaseIdToken, options = {}) {
    const { provider = 'email', providerProfile = {}, deviceInfo, ipAddress, userAgent, originSite = 'headyme.com' } = options;

    // Step 1: Verify Firebase JWT (this is the identity verification)
    const decodedToken = await this.firebase.auth().verifyIdToken(firebaseIdToken);
    const { uid: firebaseUid, email, name, picture } = decodedToken;

    if (!email) {
      throw new AuthError('NO_EMAIL', 'Firebase token does not contain an email address', 400);
    }

    logger.activity('Authentication attempt', { userId: firebaseUid, action: 'auth_attempt', site: originSite });

    // Step 2: Find or create user in Postgres (profile layer)
    const { user, isNewUser } = await this._findOrCreateUser({
      firebaseUid,
      email,
      displayName: name || providerProfile.displayName,
      avatarUrl: picture || providerProfile.avatarUrl,
      authProvider: provider,
      providerData: providerProfile,
    });

    // Step 3: Update OAuth connection (tracks tokens per provider)
    if (provider !== 'email') {
      await this._upsertOAuthConnection({
        userId: user.id,
        provider,
        providerUid: providerProfile.id || firebaseUid,
        accessToken: providerProfile.accessToken,
        refreshToken: providerProfile.refreshToken,
        scopes: providerProfile.scopes || [],
        profileData: providerProfile,
      });
    }

    // Step 4: Create session (Postgres for persistence, Redis for speed)
    const session = await this._createSession({
      userId: user.id,
      deviceId: deviceInfo?.deviceId,
      ipAddress,
      userAgent,
      originSite,
    });

    // Step 5: If new user, create onboarding state
    if (isNewUser) {
      await this._createOnboardingState(user.id);
    }

    // Step 6: Update last login
    await this.pg.query(
      'UPDATE users SET last_login_at = NOW(), auth_provider = $1 WHERE id = $2',
      [provider, user.id]
    );

    logger.activity('Authentication successful', {
      userId: user.id,
      action: isNewUser ? 'user_created' : 'user_login',
      site: originSite,
    });

    return {
      sessionToken: session.sessionToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        subscriptionTier: user.subscription_tier,
        onboardingCompleted: user.onboarding_completed,
      },
      isNewUser,
      expiresAt: session.expiresAt,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // SESSION VALIDATION (called on every authenticated request)
  // ════════════════════════════════════════════════════════════════════

  /**
   * Validate a session token from the httpOnly cookie.
   * Checks Redis first (fast path), falls back to Postgres.
   * Handles auto-renewal when past the 13-hour mark.
   *
   * @param {string} sessionToken - The __Host-heady_session cookie value
   * @returns {{ user, session, renewed }} or throws AuthError
   */
  async validateSession(sessionToken) {
    if (!sessionToken) {
      throw new AuthError('NO_TOKEN', 'No session token provided', 401);
    }

    // Fast path: check Redis cache
    const cached = await this.redis.get(`session:${sessionToken}`);
    if (cached) {
      const session = JSON.parse(cached);

      // Check absolute expiry
      if (new Date(session.absoluteExpiry) < new Date()) {
        await this._destroySession(sessionToken);
        throw new AuthError('SESSION_EXPIRED', 'Session has reached absolute expiry', 401);
      }

      // Check if renewal needed (past 13-hour mark)
      let renewed = false;
      if (new Date(session.renewAfter) < new Date()) {
        renewed = await this._renewSession(sessionToken, session);
      }

      return { user: session.user, session, renewed };
    }

    // Slow path: check Postgres
    const result = await this.pg.query(`
      SELECT s.*, u.id as user_id, u.email, u.display_name, u.avatar_url,
             u.subscription_tier, u.onboarding_completed
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.session_token = $1
        AND s.expires_at > NOW()
        AND u.deleted_at IS NULL
    `, [sessionToken]);

    if (result.rows.length === 0) {
      throw new AuthError('INVALID_SESSION', 'Session not found or expired', 401);
    }

    const row = result.rows[0];

    // Check absolute expiry
    if (new Date(row.absolute_expiry) < new Date()) {
      await this._destroySession(sessionToken);
      throw new AuthError('SESSION_EXPIRED', 'Session has reached absolute expiry', 401);
    }

    // Populate Redis cache for future fast-path lookups
    const sessionData = {
      userId: row.user_id,
      expiresAt: row.expires_at,
      renewAfter: row.renew_after,
      absoluteExpiry: row.absolute_expiry,
      originSite: row.origin_site,
      user: {
        id: row.user_id,
        email: row.email,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        subscriptionTier: row.subscription_tier,
        onboardingCompleted: row.onboarding_completed,
      },
    };

    // Cache with TTL matching session expiry (21 hours in seconds)
    const ttlSeconds = SESSION_MAX_AGE_HOURS * 3600;
    await this.redis.setex(`session:${sessionToken}`, ttlSeconds, JSON.stringify(sessionData));

    return { user: sessionData.user, session: sessionData, renewed: false };
  }

  // ════════════════════════════════════════════════════════════════════
  // LOGOUT
  // ════════════════════════════════════════════════════════════════════

  async logout(sessionToken) {
    await this._destroySession(sessionToken);
    logger.activity('User logged out', { userId: null, action: 'logout', site: 'unknown' });
  }

  // ════════════════════════════════════════════════════════════════════
  // EXPRESS MIDDLEWARE — Drop-in replacement for existing auth middleware
  // ════════════════════════════════════════════════════════════════════

  /**
   * Express middleware that validates the session cookie on every request.
   * Sets req.user and req.session on success.
   * Returns 401 on failure.
   */
  middleware() {
    return async (req, res, next) => {
      const sessionToken = req.cookies?.['__Host-heady_session'];

      if (!sessionToken) {
        // Allow unauthenticated access to public routes
        req.user = null;
        req.session = null;
        return next();
      }

      try {
        const { user, session, renewed } = await this.validateSession(sessionToken);
        req.user = user;
        req.session = session;

        // If session was renewed, update the cookie
        if (renewed) {
          this._setSessionCookie(res, sessionToken, session);
        }

        next();
      } catch (err) {
        if (err instanceof AuthError && err.statusCode === 401) {
          // Clear the invalid cookie
          res.clearCookie('__Host-heady_session', {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            path: '/',
          });
          res.status(401).json({ error: err.code, message: err.message });
        } else {
          next(err);
        }
      }
    };
  }

  /**
   * Express middleware that REQUIRES authentication.
   * Returns 401 if no valid session.
   */
  requireAuth() {
    return async (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }
      next();
    };
  }

  /**
   * Express middleware that requires a specific subscription tier.
   */
  requireTier(minTier) {
    const tierOrder = { free: 0, pro: 1, enterprise: 2 };
    return async (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'UNAUTHORIZED' });
      }
      if ((tierOrder[req.user.subscriptionTier] || 0) < (tierOrder[minTier] || 0)) {
        return res.status(403).json({
          error: 'INSUFFICIENT_TIER',
          message: `This endpoint requires ${minTier} tier or above`,
          currentTier: req.user.subscriptionTier,
        });
      }
      next();
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ════════════════════════════════════════════════════════════════════

  async _findOrCreateUser({ firebaseUid, email, displayName, avatarUrl, authProvider, providerData }) {
    // Try to find by Firebase UID first, then by email
    let result = await this.pg.query(
      'SELECT * FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL',
      [firebaseUid]
    );

    if (result.rows.length > 0) {
      return { user: result.rows[0], isNewUser: false };
    }

    // Check if user exists by email (might have been created by a different provider)
    result = await this.pg.query(
      'SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email]
    );

    if (result.rows.length > 0) {
      // Link Firebase UID to existing user
      await this.pg.query(
        'UPDATE users SET firebase_uid = $1, auth_provider = $2 WHERE id = $3',
        [firebaseUid, authProvider, result.rows[0].id]
      );
      return { user: result.rows[0], isNewUser: false };
    }

    // Create new user
    result = await this.pg.query(`
      INSERT INTO users (firebase_uid, email, display_name, avatar_url, auth_provider, provider_data)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [firebaseUid, email, displayName, avatarUrl, authProvider, JSON.stringify(providerData)]);

    return { user: result.rows[0], isNewUser: true };
  }

  async _upsertOAuthConnection({ userId, provider, providerUid, accessToken, refreshToken, scopes, profileData }) {
    await this.pg.query(`
      INSERT INTO oauth_connections (user_id, provider, provider_uid, access_token, refresh_token, scopes, profile_data)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, provider) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = COALESCE(EXCLUDED.refresh_token, oauth_connections.refresh_token),
        scopes = EXCLUDED.scopes,
        profile_data = EXCLUDED.profile_data,
        updated_at = NOW()
    `, [userId, provider, providerUid, accessToken, refreshToken, scopes, JSON.stringify(profileData)]);
  }

  async _createSession({ userId, deviceId, ipAddress, userAgent, originSite }) {
    // Generate cryptographically secure session token
    const sessionToken = crypto.randomBytes(32).toString('base64url');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_HOURS * 3600 * 1000);
    const renewAfter = new Date(now.getTime() + SESSION_RENEW_AFTER_HOURS * 3600 * 1000);
    const absoluteExpiry = new Date(now.getTime() + SESSION_ABSOLUTE_MAX_HOURS * 3600 * 1000);

    await this.pg.query(`
      INSERT INTO sessions (user_id, device_id, session_token, expires_at, renew_after, absolute_expiry, origin_site, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [userId, deviceId, sessionToken, expiresAt, renewAfter, absoluteExpiry, originSite, ipAddress, userAgent]);

    // Cache in Redis for fast lookups
    const sessionData = { userId, expiresAt, renewAfter, absoluteExpiry: absoluteExpiry.toISOString(), originSite };
    await this.redis.setex(
      `session:${sessionToken}`,
      SESSION_MAX_AGE_HOURS * 3600,
      JSON.stringify(sessionData)
    );

    return { sessionToken, expiresAt, renewAfter, absoluteExpiry };
  }

  async _renewSession(sessionToken, currentSession) {
    const now = new Date();
    const newExpiry = new Date(now.getTime() + SESSION_MAX_AGE_HOURS * 3600 * 1000);
    const newRenewAfter = new Date(now.getTime() + SESSION_RENEW_AFTER_HOURS * 3600 * 1000);

    // Don't extend past absolute expiry
    const absoluteExpiry = new Date(currentSession.absoluteExpiry);
    const effectiveExpiry = newExpiry < absoluteExpiry ? newExpiry : absoluteExpiry;

    await this.pg.query(
      'UPDATE sessions SET expires_at = $1, renew_after = $2 WHERE session_token = $3',
      [effectiveExpiry, newRenewAfter, sessionToken]
    );

    // Update Redis cache
    currentSession.expiresAt = effectiveExpiry.toISOString();
    currentSession.renewAfter = newRenewAfter.toISOString();
    await this.redis.setex(
      `session:${sessionToken}`,
      SESSION_MAX_AGE_HOURS * 3600,
      JSON.stringify(currentSession)
    );

    return true;
  }

  async _destroySession(sessionToken) {
    await this.pg.query('DELETE FROM sessions WHERE session_token = $1', [sessionToken]);
    await this.redis.del(`session:${sessionToken}`);
  }

  async _createOnboardingState(userId) {
    await this.pg.query(`
      INSERT INTO onboarding_state (user_id, current_step, step_data)
      VALUES ($1, 0, '{}')
      ON CONFLICT (user_id) DO NOTHING
    `, [userId]);
  }

  _setSessionCookie(res, token, session) {
    res.cookie('__Host-heady_session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_MAX_AGE_HOURS * 3600 * 1000,
    });
  }
}

/**
 * Typed auth error with machine-readable code and HTTP status.
 * Follows §IV.D of the Maximum Potential user preferences.
 */
export class AuthError extends Error {
  constructor(code, message, statusCode = 500) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}
