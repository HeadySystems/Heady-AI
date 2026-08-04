/**
 * ═══════════════════════════════════════════════════════════════════════
 *  HEADY CORS POLICY MIDDLEWARE
 *  ADR-0037: heady-manager.js decomposition — Phase 1 (P0 security fix)
 *  ADR-0033: Nine-domain brand architecture (allowlist source)
 *  ADR-0038: Domain registry canonical file (ALLOWED_ORIGINS_SET)
 *  ADR-0011: Node.js ESM only
 *
 *  P0 FIX: Replaces heady-manager.js:197 CORS wildcard '*'
 *  BEFORE: origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*'
 *  AFTER:  strict allowlist from DOMAIN_REGISTRY — 403 on unknown origin
 * ═══════════════════════════════════════════════════════════════════════
 */

import { ALLOWED_ORIGINS_SET, isAllowedOrigin } from '../config/domain-registry.js';

// ─── Constants ────────────────────────────────────────────────────────
// ADR-0006: phi-scaled — FIB[13]=233 seconds preflight cache
const CORS_MAX_AGE_SEC = 233;

const ALLOWED_METHODS  = 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS';
const ALLOWED_HEADERS  = 'Content-Type,Authorization,X-Request-ID,X-Heady-Tenant,Accept';
const EXPOSED_HEADERS  = 'X-Request-ID,X-Heady-Pipeline-Stage,X-Heady-Coherence';

// ─── CORS Middleware ──────────────────────────────────────────────────

/**
 * Production CORS middleware for Heady.
 * Allows only the 9 registered domains (DOMAIN_REGISTRY).
 * Returns 403 for any unrecognised origin — no fallthrough.
 *
 * Mount before all routes:
 *   import { corsPolicy } from './middleware/cors.js';
 *   app.use(corsPolicy);
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function corsPolicy(req, res, next) {
  const origin = req.headers['origin'] ?? '';

  if (origin && isAllowedOrigin(origin)) {
    // Reflected origin — vary header required for correct CDN caching
    res.setHeader('Access-Control-Allow-Origin',      origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary',                             'Origin');
  } else if (origin) {
    // Unknown origin — reject immediately with structured error
    // Do NOT fall through to route handlers with a disallowed origin
    return res.status(403).json({
      ok:    false,
      error: 'CORS_ORIGIN_REJECTED',
      msg:   `Origin '${origin}' is not in the Heady domain registry (ADR-0033)`,
    });
  }
  // No origin header = same-origin or server-to-server — allow through

  // Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
    res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    res.setHeader('Access-Control-Expose-Headers', EXPOSED_HEADERS);
    res.setHeader('Access-Control-Max-Age',        String(CORS_MAX_AGE_SEC));
    return res.status(204).end();
  }

  // Expose response headers for non-preflight
  res.setHeader('Access-Control-Expose-Headers', EXPOSED_HEADERS);

  next();
}

// ─── Development Override ─────────────────────────────────────────────
/**
 * Permissive CORS for local development only.
 * NEVER use in production — process.env.NODE_ENV guard enforces this.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function corsDevPolicy(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    // Failsafe: if somehow called in production, delegate to strict policy
    return corsPolicy(req, res, next);
  }

  const origin = req.headers['origin'] ?? 'http://localhost:3000';
  res.setHeader('Access-Control-Allow-Origin',      origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary',                             'Origin');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
    res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    res.setHeader('Access-Control-Max-Age',       String(CORS_MAX_AGE_SEC));
    return res.status(204).end();
  }

  next();
}

/**
 * Factory: select the right CORS policy based on environment.
 * Import and mount this in heady-manager.js (transitional shim) and
 * in manager-core.js (final target):
 *
 *   import { selectCorsPolicy } from './middleware/cors.js';
 *   app.use(selectCorsPolicy());
 */
export function selectCorsPolicy() {
  return process.env.NODE_ENV === 'production' ? corsPolicy : corsDevPolicy;
}

// ─── Diagnostics ──────────────────────────────────────────────────────

/** Return current allowlist snapshot for health endpoints */
export function getAllowedOrigins() {
  return [...ALLOWED_ORIGINS_SET];
}
