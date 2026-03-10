/**
 * Heady™ Rate Limiter
 * φ-scaled sliding window rate limiter (no Redis dependency)
 */
'use strict';

const { FIB, RATE_LIMITS, PHI } = require('../config/phi-constants');

/**
 * Create a rate limiter middleware for a given tier
 * Uses sliding window approach with in-memory storage
 * @param {string} tier — ANONYMOUS, AUTHENTICATED, PREMIUM, ENTERPRISE, INTERNAL
 * @returns {Function} Express middleware
 */
function createRateLimiter(tier = 'ANONYMOUS') {
  const limit = RATE_LIMITS[tier];
  if (!limit) {
    throw new Error(`Invalid rate limit tier: ${tier}`);
  }

  // Window duration: 60 seconds
  const windowMs = 60000;

  // In-memory store: ip -> { timestamps: [], blocked: bool }
  const store = new Map();

  /**
   * Get or create client entry
   */
  function getClientEntry(key) {
    if (!store.has(key)) {
      store.set(key, { timestamps: [], blocked: false });
    }
    return store.get(key);
  }

  /**
   * Cleanup: remove entries older than window
   */
  function cleanupOldTimestamps(entry, now) {
    entry.timestamps = entry.timestamps.filter(ts => now - ts < windowMs);
  }

  /**
   * Cleanup periodic: remove old client entries every minute
   */
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      cleanupOldTimestamps(entry, now);
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, 60000);

  // Return Express middleware
  return (req, res, next) => {
    const now = Date.now();
    // Use X-Forwarded-For if behind proxy, otherwise use remote IP
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() ||
                     req.socket.remoteAddress ||
                     'unknown';

    const entry = getClientEntry(clientIp);

    // Clean old timestamps
    cleanupOldTimestamps(entry, now);

    // Check if rate limit exceeded
    if (entry.timestamps.length >= limit) {
      res.status(429).json({
        error: 'Too Many Requests',
        tier,
        limit,
        windowMs,
        retryAfter: Math.ceil((entry.timestamps[0] + windowMs - now) / 1000),
      });
      return;
    }

    // Record this request
    entry.timestamps.push(now);

    // Add rate limit info to response headers
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', limit - entry.timestamps.length);
    res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));

    next();
  };
}

module.exports = { createRateLimiter };
