const Redis = require('ioredis');

// Connect to local redis instance orchestrator
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const RATE_LIMIT_WINDOW_SECS = 60; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 120; // 120 requests per minute
const PENALTY_BAN_SECS = 3600; // 1 hour ban for aggressive scraping

class HeadyRateLimiter {
    constructor() {
        this.redis = redis;
        console.log("[SECURITY] Heady Sliding-Window Rate Limiter Armed.");
    }

    async checkLimit(ip, endpoint) {
        // Exclude internal mesh network from limits
        if (ip.startsWith('10.') || ip === '127.0.0.1') return { allowed: true };

        const key = `rate_limit:${ip}`;
        const banKey = `banned:${ip}`;

        try {
            // 1. Check if IP is currently in penalty box
            const isBanned = await this.redis.get(banKey);
            if (isBanned) {
                return {
                    allowed: false,
                    reason: 'IP temporarily restricted due to aggressive scraping.',
                    retryAfter: await this.redis.ttl(banKey)
                };
            }

            // 2. Sliding Window Counter using Redis Sorted Sets
            const now = Date.now();
            const windowStart = now - (RATE_LIMIT_WINDOW_SECS * 1000);

            const pipeline = this.redis.pipeline();
            // Remove old requests outside the window
            pipeline.zremrangebyscore(key, 0, windowStart);
            // Add current request
            pipeline.zadd(key, now, `${now}-${Math.random()}`);
            // Count requests in current window
            pipeline.zcard(key);
            // Set expiry on the key to automatically clean up
            pipeline.expire(key, RATE_LIMIT_WINDOW_SECS);

            const results = await pipeline.exec();
            const requestCount = results[2][1];

            // 3. Evaluate limits
            if (requestCount > MAX_REQUESTS_PER_WINDOW) {
                // Punish IP by placing in penalty box
                await this.redis.setex(banKey, PENALTY_BAN_SECS, "1");
                console.warn(`[DEFENSE] IP ${ip} banned for ${PENALTY_BAN_SECS}s due to rate limit violation.`);
                return {
                    allowed: false,
                    reason: 'Rate limit exceeded. Temporary ban applied.',
                    retryAfter: PENALTY_BAN_SECS
                };
            }

            return {
                allowed: true,
                remaining: Math.max(0, MAX_REQUESTS_PER_WINDOW - requestCount)
            };

        } catch (err) {
            console.error("[SECURITY] Redis Rate Limiter Error (Failing Open to ensure availability):", err);
            return { allowed: true };
        }
    }
}

module.exports = new HeadyRateLimiter();
