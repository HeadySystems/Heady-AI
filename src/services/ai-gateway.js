/*
 * © 2026 Heady™Systems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Cloudflare AI Gateway — v9.0 Blueprint §3
 *
 * Unified proxy for ALL LLM calls across OpenAI, Anthropic, Google,
 * Azure, HuggingFace, and Workers AI.
 *
 * Benefits:
 * - Response caching (up to 90% latency reduction for repeated queries)
 * - Automatic fallback across providers
 * - Per-user rate limiting
 * - Cost analytics across every provider from a single dashboard
 *
 * Set HEADY_CLOUDFLARE_AI_GATEWAY and CLOUDFLARE_ACCOUNT_ID in env.
 */

'use strict';

const { getLogger } = require('./structured-logger');
const logger = getLogger('ai-gateway');

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '8b1fa38f282c691423c6399247d53323';
const GATEWAY_NAME = process.env.HEADY_CLOUDFLARE_AI_GATEWAY || 'heady-gateway';
const AI_GATEWAY_BASE = `https://gateway.ai.cloudflare.com/v1/${ACCOUNT_ID}/${GATEWAY_NAME}`;

// v9.0 Blueprint §3 + §11: LLM fallback chain
// Gemini → GPT → Workers AI → Colab vLLM
const PROVIDER_CONFIGS = {
    google: {
        baseUrl: `${AI_GATEWAY_BASE}/google-ai-studio`,
        envKey: 'GOOGLE_AI_API_KEY',
    },
    openai: {
        baseUrl: `${AI_GATEWAY_BASE}/openai`,
        envKey: 'OPENAI_API_KEY',
    },
    azure: {
        baseUrl: `${AI_GATEWAY_BASE}/azure-openai`,
        envKey: 'AZURE_OPENAI_API_KEY',
    },
    anthropic: {
        baseUrl: `${AI_GATEWAY_BASE}/anthropic`,
        envKey: 'ANTHROPIC_API_KEY',
    },
    huggingface: {
        baseUrl: `${AI_GATEWAY_BASE}/huggingface`,
        envKey: 'HF_TOKEN',
    },
    'workers-ai': {
        baseUrl: `${AI_GATEWAY_BASE}/workers-ai`,
        envKey: 'CLOUDFLARE_API_TOKEN',
    },
};

// v9.0 Blueprint §11: Fallback chain order
const FALLBACK_CHAIN = ['google', 'azure', 'openai', 'workers-ai', 'huggingface'];

class AIGateway {
    constructor() {
        this._stats = { requests: 0, cacheHits: 0, fallbacks: 0, errors: 0 };
    }

    /**
     * Route a chat completion through AI Gateway with automatic fallback.
     *
     * @param {string} provider - Primary provider ('google', 'openai', 'azure', etc.)
     * @param {string} path - API path (e.g., '/v1/chat/completions')
     * @param {object} body - Request body
     * @param {object} [opts] - Options
     * @param {boolean} [opts.enableFallback=true] - Auto-fallback on failure
     * @param {boolean} [opts.cacheEnabled=true] - Enable response caching
     * @param {number} [opts.cacheTtl=3600] - Cache TTL in seconds
     */
    async request(provider, path, body, opts = {}) {
        const {
            enableFallback = true,
            cacheEnabled = true,
            cacheTtl = 3600,
        } = opts;

        const providers = enableFallback
            ? [provider, ...FALLBACK_CHAIN.filter(p => p !== provider)]
            : [provider];

        let lastError = null;

        for (const p of providers) {
            const config = PROVIDER_CONFIGS[p];
            if (!config) continue;

            const apiKey = process.env[config.envKey];
            if (!apiKey) {
                logger.debug(`Skipping ${p} — no API key configured`);
                continue;
            }

            try {
                this._stats.requests++;

                const headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                };

                // AI Gateway cache control
                if (cacheEnabled) {
                    headers['cf-aig-cache-ttl'] = String(cacheTtl);
                } else {
                    headers['cf-aig-skip-cache'] = 'true';
                }

                const res = await fetch(`${config.baseUrl}${path}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });

                // Check for cache hit
                if (res.headers.get('cf-aig-cache-status') === 'HIT') {
                    this._stats.cacheHits++;
                }

                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`${p} ${res.status}: ${text.substring(0, 200)}`);
                }

                const data = await res.json();

                if (p !== provider) {
                    this._stats.fallbacks++;
                    logger.info('AI Gateway fell back to alternate provider', {
                        primary: provider, actual: p,
                    });
                }

                return { data, provider: p, cached: res.headers.get('cf-aig-cache-status') === 'HIT' };
            } catch (err) {
                lastError = err;
                logger.warn(`AI Gateway ${p} failed, trying next`, { error: err.message });
            }
        }

        this._stats.errors++;
        throw lastError || new Error('All AI Gateway providers failed');
    }

    /**
     * Convenience: Chat completion with Gemini Flash-Lite (cheapest default).
     * v9.0 Blueprint §4: $0.10/$0.40 per M tokens.
     */
    async chatGeminiFlashLite(messages, opts = {}) {
        return this.request('google', '/v1beta/models/gemini-2.5-flash-lite:generateContent', {
            contents: messages.map(m => ({
                role: m.role === 'assistant' ? 'model' : m.role,
                parts: [{ text: m.content }],
            })),
            ...opts,
        });
    }

    /**
     * Convenience: Chat completion via OpenAI-compatible endpoint.
     */
    async chatOpenAI(model, messages, opts = {}) {
        return this.request('openai', '/v1/chat/completions', {
            model,
            messages,
            temperature: opts.temperature ?? 0.7,
            max_tokens: opts.max_tokens ?? 4096,
            ...opts,
        });
    }

    /**
     * Convenience: Embeddings via Workers AI (edge, cheapest).
     * v9.0 Blueprint §3: BGE-M3 at $0.012/M tokens.
     */
    async embedWorkersAI(text) {
        return this.request('workers-ai', '/@cf/baai/bge-m3', {
            text: Array.isArray(text) ? text : [text],
        }, { cacheEnabled: false });
    }

    getStats() {
        return {
            ...this._stats,
            cacheHitRate: this._stats.requests > 0
                ? (this._stats.cacheHits / this._stats.requests * 100).toFixed(1) + '%'
                : '0%',
            gatewayBase: AI_GATEWAY_BASE,
        };
    }
}

// ── Singleton ───────────────────────────────────────────────
let _instance = null;

function getAIGateway() {
    if (_instance) return _instance;
    _instance = new AIGateway();
    logger.info('AI Gateway initialized', { base: AI_GATEWAY_BASE });
    return _instance;
}

module.exports = {
    AIGateway,
    getAIGateway,
    PROVIDER_CONFIGS,
    FALLBACK_CHAIN,
    AI_GATEWAY_BASE,
};
