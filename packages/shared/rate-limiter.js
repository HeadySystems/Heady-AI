'use strict';
/**
 * Heady™ Rate Limiter — φ-scaled sliding window rate limiting.
 * © 2026 HeadySystems Inc.
 */
const PHI = 1.6180339887;

class RateLimiter {
  constructor(opts = {}) {
    this.windowMs = opts.windowMs || Math.round(PHI * 60000);  // φ minutes ≈ 97s
    this.maxRequests = opts.maxRequests || 100;
    this._windows = new Map();
    this._cleanupInterval = setInterval(() => this._cleanup(), this.windowMs * 2);
  }

  check(key) {
    const now = Date.now();
    const bucket = this._windows.get(key) || { count: 0, start: now };
    if (now - bucket.start > this.windowMs) {
      bucket.count = 0;
      bucket.start = now;
    }
    bucket.count++;
    this._windows.set(key, bucket);
    return {
      allowed: bucket.count <= this.maxRequests,
      remaining: Math.max(0, this.maxRequests - bucket.count),
      resetAt: new Date(bucket.start + this.windowMs).toISOString(),
    };
  }

  middleware(keyFn) {
    return (req, res, next) => {
      const key = keyFn ? keyFn(req) : req.ip;
      const result = this.check(key);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.resetAt);
      if (!result.allowed) return res.status(429).json({ error: 'Rate limit exceeded', ...result });
      next();
    };
  }

  _cleanup() {
    const cutoff = Date.now() - this.windowMs * 2;
    for (const [key, bucket] of this._windows) {
      if (bucket.start < cutoff) this._windows.delete(key);
    }
  }

  shutdown() { clearInterval(this._cleanupInterval); }
}

module.exports = { RateLimiter };
