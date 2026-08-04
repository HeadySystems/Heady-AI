/**
 * ═══════════════════════════════════════════════════════════════════════
 *  HEADY AUTH MIDDLEWARE
 *  ADR-0037: heady-manager.js decomposition — Phase 1 (P0 security fix)
 *  ADR-0009: Firebase Auth + httpOnly cookies only
 *  ADR-0035: PQC mandate — timing-safe comparisons (crypto.timingSafeEqual)
 *  ADR-0011: Node.js ESM only
 *
 *  P0 FIX #1: heady-manager.js:399 — string token === comparison
 *    BEFORE: if (adminToken !== process.env.ADMIN_TOKEN)
 *    AFTER:  crypto.timingSafeEqual on constant-length buffers
 *
 *  P0 FIX #2: heady-manager.js:448 — plaintext ADMIN_TOKEN in login response
 *    BEFORE: res.json({ token: process.env.HEADY_API_KEY })
 *    AFTER:  Firebase-issued JWT only; HEADY_API_KEY never sent to client
 *
 *  P0 FIX #3: heady-manager.js:458/465 — tier derived from raw token equality
 *    BEFORE: token === process.env.HEADY_API_KEY ? "admin" : "core"
 *    AFTER:  authEngine.verify(token) with timingSafeEqual fallback
 * ═══════════════════════════════════════════════════════════════════════
 */

import crypto from 'node:crypto';

// ─── Constants (ADR-0006: phi-scaled, no magic numbers) ───────────────
// PHI^8 * 1000 ms ≈ 46,971ms ≈ 46.9s — aggressive admin token window
const ADMIN_TOKEN_MAX_AGE_MS = Math.round(1.618 ** 8 * 1000); // ~46,971ms
// FIB[8]=21 attempts per window (phi-tiered rate limit handled by rate-limiter)
const AUTH_HEADER_PREFIX = 'Bearer ';

// ─── Internal: timing-safe string comparison ──────────────────────────
/**
 * Constant-time comparison for two strings.
 * Prevents timing-oracle attacks against admin tokens.
 * Handles length mismatch without short-circuiting.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function timingSafeStringEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Must be same length for timingSafeEqual; pad shorter to avoid length leak
  const maxLen = Math.max(bufA.length, bufB.length);
  const padA   = Buffer.concat([bufA, Buffer.alloc(maxLen - bufA.length)]);
  const padB   = Buffer.concat([bufB, Buffer.alloc(maxLen - bufB.length)]);
  // timingSafeEqual requires equal-length buffers
  const equal  = crypto.timingSafeEqual(padA, padB);
  // Length mismatch is itself a timing leak: compare lengths separately in
  // constant time via XOR, then AND with the buffer comparison result.
  const sameLength = bufA.length === bufB.length;
  return equal && sameLength;
}

// ─── Token Extraction ─────────────────────────────────────────────────

/**
 * Extract a Bearer token from the Authorization header.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
export function extractBearerToken(req) {
  const header = req.headers['authorization'] ?? '';
  if (!header.startsWith(AUTH_HEADER_PREFIX)) return null;
  const token = header.slice(AUTH_HEADER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

// ─── Admin Token Guard ────────────────────────────────────────────────

/**
 * Express middleware: require a valid ADMIN_TOKEN in Authorization header.
 * P0 fix for heady-manager.js:399 — uses timingSafeEqual.
 *
 * Usage:
 *   import { requireAdminToken } from './middleware/auth.js';
 *   app.post('/api/vm/revoke', requireAdminToken, handler);
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requireAdminToken(req, res, next) {
  const provided = extractBearerToken(req);
  const expected = process.env.ADMIN_TOKEN ?? '';

  if (!provided) {
    return res.status(401).json({ ok: false, error: 'AUTH_MISSING', msg: 'Authorization header required' });
  }

  // P0: timing-safe comparison (replaces `adminToken !== process.env.ADMIN_TOKEN`)
  if (!timingSafeStringEqual(provided, expected)) {
    return res.status(403).json({ ok: false, error: 'AUTH_REJECTED', msg: 'Invalid admin token' });
  }

  next();
}

// ─── API Key Tier Resolution ──────────────────────────────────────────

/**
 * Resolve the auth tier for a request token.
 * P0 fix for heady-manager.js:458/465 — timing-safe with authEngine fallback.
 *
 * @param {string|null}  token      - Bearer token from request
 * @param {Object|null}  authEngine - HeadyAuth instance (may be null if not loaded)
 * @returns {'admin'|'core'|'none'}
 */
export function resolveAuthTier(token, authEngine) {
  if (!token) return 'none';

  // Prefer authEngine.verify() when available (Firebase JWT path — ADR-0009)
  if (authEngine && typeof authEngine.verify === 'function') {
    try {
      const verified = authEngine.verify(token);
      if (verified?.tier) return verified.tier;
    } catch {
      // authEngine threw — fall through to API key comparison
    }
  }

  // Fallback: compare against HEADY_API_KEY with timing-safe equality
  // P0 fix: replaces `token === process.env.HEADY_API_KEY ? "admin" : "core"`
  const apiKey = process.env.HEADY_API_KEY ?? '';
  if (apiKey && timingSafeStringEqual(token, apiKey)) return 'admin';

  return 'core';
}

// ─── Middleware: Attach Tier ──────────────────────────────────────────

/**
 * Express middleware: extract token, resolve tier, attach to req.
 * Non-blocking — allows unauthenticated requests through with tier='none'.
 *
 * Sets:
 *   req.headyToken  {string|null}
 *   req.headyTier   {'admin'|'core'|'none'}
 *
 * @param {Object|null} authEngine - HeadyAuth instance (optional)
 * @returns {import('express').RequestHandler}
 */
export function attachAuthTier(authEngine = null) {
  return (req, _res, next) => {
    const token = extractBearerToken(req);
    req.headyToken = token;
    req.headyTier  = resolveAuthTier(token, authEngine);
    next();
  };
}

// ─── Middleware: Require Minimum Tier ────────────────────────────────

const TIER_RANK = Object.freeze({ none: 0, core: 1, admin: 2 });

/**
 * Express middleware factory: block requests below a required tier.
 *
 * Usage:
 *   app.get('/api/services/groups', requireTier('core'), handler);
 *   app.post('/api/admin/...', requireTier('admin'), handler);
 *
 * @param {'core'|'admin'} minimumTier
 * @returns {import('express').RequestHandler}
 */
export function requireTier(minimumTier) {
  return (req, res, next) => {
    const tier = req.headyTier ?? 'none';
    if ((TIER_RANK[tier] ?? 0) >= (TIER_RANK[minimumTier] ?? 0)) return next();
    res.status(403).json({
      ok:    false,
      error: 'AUTH_INSUFFICIENT_TIER',
      msg:   `Requires '${minimumTier}' tier, got '${tier}'`,
    });
  };
}

// ─── Transitional shim export (heady-manager.js replacement) ─────────
// heady-manager.js used inline logic at multiple call sites.
// Export timingSafeStringEqual for test suites — do NOT use in routes directly.
export { timingSafeStringEqual as _timingSafeStringEqual };
