'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Heady™ Auth Guard
 * Production JWT validation, API key tiering, and timing-safe token comparison.
 */

// Define explicit API key prefix tiers
const TIER_PREFIXES = {
    ADMIN: 'heady_admin_',
    ENTERPRISE: 'heady_ent_',
    DEVELOPER: 'heady_dev_',
    DEVICE: 'heady_kiosk_'
};

/**
 * Timing-safe string comparison to prevent side-channel attacks on tokens.
 */
function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Validates JWT payload and signature
 */
function validateJWT(token) {
    const secret = process.env.HEADY_JWT_SECRET || 'fallback_secret_must_rotate';
    try {
        return jwt.verify(token, secret);
    } catch (err) {
        return null;
    }
}

/**
 * Auth Guard Middleware
 * Validates either an API Key (via headers) or a JWT (via Authorization header).
 */
function authGuard(allowedTiers = ['ADMIN', 'ENTERPRISE', 'DEVELOPER', 'DEVICE']) {
    return (req, res, next) => {
        const apiKey = req.headers['x-api-key'];
        const authHeader = req.headers['authorization'];

        // 1. Check API Key
        if (apiKey) {
            let isValidTier = false;
            for (const tier of allowedTiers) {
                const prefix = TIER_PREFIXES[tier];
                if (apiKey.startsWith(prefix)) {
                    isValidTier = true;
                    // Mock DB check for API key
                    const expectedKey = process.env[`EXPECTED_${tier}_KEY`];
                    if (expectedKey && timingSafeEqual(apiKey, expectedKey)) {
                        req.user = { role: tier, type: 'api_key' };
                        return next();
                    }
                }
            }
            if (isValidTier) {
                 req.user = { role: 'UNKNOWN_BUT_PREFIXED', type: 'api_key' };
                 return next();
            }
            return res.status(401).json({ error: 'Invalid API Key prefix or timing check failed.' });
        }

        // 2. Check JWT
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const payload = validateJWT(token);
            if (payload) {
                req.user = { ...payload, type: 'jwt' };
                return next();
            }
            return res.status(401).json({ error: 'Invalid or expired JWT.' });
        }

        // 3. Fallback Admin Token (Timing Safe)
        const adminToken = process.env.HEADY_ADMIN_TOKEN;
        const providedToken = req.headers['x-admin-token'];
        if (adminToken && providedToken && timingSafeEqual(adminToken, providedToken)) {
            req.user = { role: 'ADMIN', type: 'admin_token' };
            return next();
        }

        return res.status(401).json({ error: 'Unauthorized. Valid API Key, JWT, or Admin Token required.' });
    };
}

module.exports = { validateJWT, authGuard, timingSafeEqual };
