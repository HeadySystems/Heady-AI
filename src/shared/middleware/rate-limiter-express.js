/**
 * Express-compatible rate limiter middleware.
 *
 * Wraps the core SlidingWindowRateLimiter for use in Express/Connect services.
 * Uses φ-scaled tier limits per Heady Unbreakable Laws.
 *
 * @module shared/middleware/rate-limiter-express
 * @author Eric Haywood — HeadySystems Inc.
 * @license PROPRIETARY — 51+ Provisional Patents
 */

'use strict';

// Fibonacci constants (inline to avoid cross-module issues in CommonJS services)
const FIB_9 = 34;
const FIB_11 = 89;
const FIB_13 = 233;

const TIER_LIMITS = {
  anonymous: FIB_9,      // 34 requests/min
  authenticated: FIB_11, // 89 requests/min
  enterprise: FIB_13,    // 233 requests/min
};

const WINDOW_MS = 60000; // 1 minute

/**
 * In-memory sliding window rate limiter for Express middleware.
 */
class ExpressRateLimiter {
  constructor(options = {}) {
    this._windowMs = options.windowMs || WINDOW_MS;
    this._tierLimits = { ...TIER_LIMITS, ...options.tierLimits };
    /** @type {Map<string, number[]>} */
    this._windows = new Map();
    this._cleanupTimer = setInterval(() => this._cleanup(), this._windowMs * 2);
  }

  /**
   * Check a request against the rate limit.
   * @param {string} key
   * @param {string} tier
   * @returns {{ allowed: boolean, remaining: number, limit: number, retryAfter: number|null }}
   */
  hit(key, tier = 'anonymous') {
    const now = Date.now();
    const limit = this._tierLimits[tier] || this._tierLimits.anonymous;
    const windowStart = now - this._windowMs;

    let timestamps = this._windows.get(key);
    if (!timestamps) {
      timestamps = [];
      this._windows.set(key, timestamps);
    }

    // Remove expired timestamps
    while (timestamps.length > 0 && timestamps[0] <= windowStart) {
      timestamps.shift();
    }

    if (timestamps.length >= limit) {
      const retryAfter = Math.ceil((timestamps[0] + this._windowMs - now) / 1000);
      return { allowed: false, remaining: 0, limit, retryAfter };
    }

    timestamps.push(now);
    return {
      allowed: true,
      remaining: limit - timestamps.length,
      limit,
      retryAfter: null,
    };
  }

  _cleanup() {
    const cutoff = Date.now() - this._windowMs;
    for (const [key, timestamps] of this._windows) {
      while (timestamps.length > 0 && timestamps[0] <= cutoff) {
        timestamps.shift();
      }
      if (timestamps.length === 0) this._windows.delete(key);
    }
  }

  stop() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }
}

/**
 * Create Express rate limiter middleware.
 *
 * @param {object} [options]
 * @param {Function} [options.keyExtractor] - (req) => string — defaults to IP
 * @param {Function} [options.tierExtractor] - (req) => string — defaults to 'anonymous'
 * @returns {Function} Express middleware
 */
function createRateLimiter(options = {}) {
  const limiter = new ExpressRateLimiter(options);
  const keyExtractor = options.keyExtractor || ((req) => req.ip || req.socket.remoteAddress || 'unknown');
  const tierExtractor = options.tierExtractor || ((req) => {
    if (req.session || req.user) return 'authenticated';
    return 'anonymous';
  });

  return function rateLimiterMiddleware(req, res, next) {
    // Skip health checks
    if (req.path === '/health' || req.path === '/healthz') {
      return next();
    }

    const key = keyExtractor(req);
    const tier = tierExtractor(req);
    const result = limiter.hit(key, tier);

    res.setHeader('X-RateLimit-Limit', result.limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter);
      res.status(429).json({
        error: 'Too Many Requests',
        code: 'RATE_LIMITED',
        retryAfter: result.retryAfter,
        limit: result.limit,
      });
      return;
    }

    next();
  };
}

module.exports = { createRateLimiter, ExpressRateLimiter };
