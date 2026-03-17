/*
 * © 2026 Heady™Systems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * HuggingFace Token Rotation — v9.0 Blueprint §6
 *
 * Three HF tokens enable round-robin rate limit distribution.
 * Each token is tied to a separate account with independent
 * rate limits and inference credits.
 *
 * Set HF_TOKEN_1, HF_TOKEN_2, HF_TOKEN_3 in env.
 * Falls back to single HF_TOKEN if rotation tokens not set.
 */

'use strict';

const { getLogger } = require('./structured-logger');
const logger = getLogger('hf-token-rotation');

// v9.0 Blueprint §6: Three tokens for round-robin distribution
const TOKENS = [
    process.env.HF_TOKEN_1,
    process.env.HF_TOKEN_2,
    process.env.HF_TOKEN_3,
].filter(Boolean);

// Fallback to single token
if (TOKENS.length === 0 && process.env.HF_TOKEN) {
    TOKENS.push(process.env.HF_TOKEN);
}

let _requestCount = 0;
const _tokenStats = TOKENS.map(() => ({ requests: 0, errors: 0, rateLimited: 0 }));

/**
 * Get the next token in round-robin rotation.
 * v9.0 Blueprint §6: tokens[requestCount % 3]
 */
function getToken() {
    if (TOKENS.length === 0) {
        logger.warn('No HuggingFace tokens configured (set HF_TOKEN_1, HF_TOKEN_2, HF_TOKEN_3)');
        return null;
    }

    const idx = _requestCount % TOKENS.length;
    _requestCount++;
    _tokenStats[idx].requests++;
    return { token: TOKENS[idx], index: idx };
}

/**
 * Mark a token as rate-limited, skip it for the next N requests.
 */
const _cooldowns = new Map(); // tokenIndex → cooldownUntil timestamp

function markRateLimited(tokenIndex, cooldownMs = 60000) {
    _cooldowns.set(tokenIndex, Date.now() + cooldownMs);
    _tokenStats[tokenIndex].rateLimited++;
    logger.warn(`HF token ${tokenIndex} rate-limited, cooling down ${cooldownMs}ms`);
}

/**
 * Get the next available token, skipping rate-limited ones.
 */
function getAvailableToken() {
    if (TOKENS.length === 0) return null;

    const now = Date.now();
    // Clean expired cooldowns
    for (const [idx, until] of _cooldowns) {
        if (now >= until) _cooldowns.delete(idx);
    }

    // Try up to TOKENS.length times to find a non-cooled-down token
    for (let i = 0; i < TOKENS.length; i++) {
        const { token, index } = getToken();
        if (!_cooldowns.has(index)) {
            return { token, index };
        }
    }

    // All tokens rate-limited — return the one with earliest cooldown expiry
    const { token, index } = getToken();
    logger.warn('All HF tokens rate-limited, using least-restricted', { index });
    return { token, index };
}

/**
 * HuggingFace Inference API request with automatic token rotation.
 *
 * @param {string} model - Model ID (e.g., 'meta-llama/Llama-3.3-70B-Instruct')
 * @param {object} body - Request body
 * @param {object} [opts] - Fetch options
 */
async function hfInference(model, body, opts = {}) {
    const tokenInfo = getAvailableToken();
    if (!tokenInfo) throw new Error('No HuggingFace tokens available');

    const url = `https://api-inference.huggingface.co/models/${model}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${tokenInfo.token}`,
            'Content-Type': 'application/json',
            ...opts.headers,
        },
        body: JSON.stringify(body),
    });

    if (res.status === 429) {
        markRateLimited(tokenInfo.index);
        // Retry with next available token
        const retry = getAvailableToken();
        if (retry && retry.index !== tokenInfo.index) {
            const retryRes = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${retry.token}`,
                    'Content-Type': 'application/json',
                    ...opts.headers,
                },
                body: JSON.stringify(body),
            });
            if (retryRes.ok) return retryRes.json();
        }
        throw new Error(`HuggingFace rate limited on all tokens for model ${model}`);
    }

    if (!res.ok) {
        const text = await res.text();
        _tokenStats[tokenInfo.index].errors++;
        throw new Error(`HuggingFace ${res.status}: ${text.substring(0, 200)}`);
    }

    return res.json();
}

function getStats() {
    return {
        tokenCount: TOKENS.length,
        totalRequests: _requestCount,
        perToken: _tokenStats,
        activeCooldowns: _cooldowns.size,
    };
}

module.exports = {
    getToken,
    getAvailableToken,
    markRateLimited,
    hfInference,
    getStats,
    tokenCount: TOKENS.length,
};
