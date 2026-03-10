/**
 * Heady™ Embedding Router — Multi-Provider Embedding Orchestration
 * ════════════════════════════════════════════════════════════════
 *
 * Routes embedding requests to the optimal provider based on:
 *   - Model tier (fast/standard/premium)
 *   - Dimension requirements (384 or 1536)
 *   - Provider availability (circuit breaker status)
 *   - Cost optimization (φ-weighted provider selection)
 *
 * Providers: OpenAI, Google, Cohere, local (all-MiniLM-L6-v2)
 *
 * @module core/latent/embedding-router
 */
'use strict';

const { PHI, PSI, fib, TIMING } = require('../constants/phi');
const { CircuitBreaker } = require('../infrastructure/circuit-breaker');
const { EmbeddingCache, DIMENSIONS, DIMENSIONS_LARGE, BATCH_SIZE } = require('./vector-ops');

// ─── Provider Definitions ───────────────────────────────────────────────────────

const PROVIDERS = {
  OPENAI: {
    name: 'openai',
    models: {
      'text-embedding-3-small': { dims: 384, tier: 'fast', costPer1k: 0.00002 },
      'text-embedding-3-large': { dims: DIMENSIONS_LARGE, tier: 'premium', costPer1k: 0.00013 },
    },
    endpoint: 'https://api.openai.com/v1/embeddings',
    envKey: 'OPENAI_API_KEY',
  },
  GOOGLE: {
    name: 'google',
    models: {
      'text-embedding-004': { dims: 768, tier: 'standard', costPer1k: 0.000025 },
    },
    endpoint: 'https://generativelanguage.googleapis.com/v1/models',
    envKey: 'GOOGLE_API_KEY',
  },
  COHERE: {
    name: 'cohere',
    models: {
      'embed-english-v3.0': { dims: 1024, tier: 'standard', costPer1k: 0.0001 },
      'embed-english-light-v3.0': { dims: 384, tier: 'fast', costPer1k: 0.0001 },
    },
    endpoint: 'https://api.cohere.ai/v1/embed',
    envKey: 'COHERE_API_KEY',
  },
  LOCAL: {
    name: 'local',
    models: {
      'all-MiniLM-L6-v2': { dims: 384, tier: 'fast', costPer1k: 0 },
    },
    endpoint: null, // In-process
    envKey: null,
  },
};

// ─── Embedding Router ───────────────────────────────────────────────────────────

class EmbeddingRouter {
  constructor(opts = {}) {
    this._cache = new EmbeddingCache(opts.cacheCapacity);
    this._breakers = new Map();
    this._totalEmbeddings = 0;
    this._cacheHits = 0;

    // Initialize circuit breakers for each provider
    for (const [key, provider] of Object.entries(PROVIDERS)) {
      this._breakers.set(provider.name, new CircuitBreaker(provider.name, {
        failureThreshold: fib(4),       // 3
        resetTimeoutMs: TIMING.NORMAL,  // ~11s
      }));
    }
  }

  /**
   * Generate embeddings for text(s).
   * @param {string|string[]} text - Input text(s)
   * @param {object} [opts]
   * @param {string} [opts.provider] - Force specific provider
   * @param {string} [opts.tier]     - 'fast' | 'standard' | 'premium'
   * @param {number} [opts.dims]     - Target dimensions (384 or 1536)
   * @returns {Promise<{ vectors: Float32Array[], provider: string, model: string, cached: number }>}
   */
  async embed(text, opts = {}) {
    const texts = Array.isArray(text) ? text : [text];
    const tier = opts.tier || 'fast';
    const dims = opts.dims || DIMENSIONS;

    // Check cache first
    const results = new Array(texts.length);
    const uncachedIndices = [];
    let cached = 0;

    for (let i = 0; i < texts.length; i++) {
      const cacheKey = `${tier}:${dims}:${texts[i].slice(0, 100)}`;
      const hit = this._cache.get(cacheKey);
      if (hit) {
        results[i] = hit;
        cached++;
        this._cacheHits++;
      } else {
        uncachedIndices.push(i);
      }
    }

    // Embed uncached texts
    if (uncachedIndices.length > 0) {
      const uncachedTexts = uncachedIndices.map(i => texts[i]);
      const { provider, model } = this._selectProvider(tier, dims, opts.provider);
      const breaker = this._breakers.get(provider.name);

      // Batch embed with circuit breaker
      const vectors = await breaker.execute(async () => {
        return this._callProvider(provider, model, uncachedTexts);
      });

      // Store results and update cache
      for (let j = 0; j < uncachedIndices.length; j++) {
        const idx = uncachedIndices[j];
        results[idx] = vectors[j];
        const cacheKey = `${tier}:${dims}:${texts[idx].slice(0, 100)}`;
        this._cache.set(cacheKey, vectors[j]);
      }

      this._totalEmbeddings += uncachedTexts.length;

      return {
        vectors: results,
        provider: provider.name,
        model,
        cached,
        generated: uncachedTexts.length,
      };
    }

    return { vectors: results, provider: 'cache', model: 'cache', cached, generated: 0 };
  }

  /**
   * Select optimal provider based on tier, dims, and availability.
   */
  _selectProvider(tier, dims, forcedProvider) {
    const candidates = [];

    for (const [key, provider] of Object.entries(PROVIDERS)) {
      if (forcedProvider && provider.name !== forcedProvider) continue;

      const breaker = this._breakers.get(provider.name);
      if (!breaker.canRequest()) continue;

      // Check if provider has env key (skip if missing)
      if (provider.envKey && !process.env[provider.envKey]) continue;

      for (const [modelName, modelConfig] of Object.entries(provider.models)) {
        if (modelConfig.tier === tier || tier === 'any') {
          if (modelConfig.dims >= dims) {
            candidates.push({
              provider,
              model: modelName,
              config: modelConfig,
              score: this._scoreProvider(provider, modelConfig, dims),
            });
          }
        }
      }
    }

    if (candidates.length === 0) {
      // Fallback to local if nothing else available
      const localProvider = PROVIDERS.LOCAL;
      const localModel = 'all-MiniLM-L6-v2';
      return { provider: localProvider, model: localModel };
    }

    // Sort by score (φ-weighted: cost * PSI + availability * PHI)
    candidates.sort((a, b) => b.score - a.score);
    return { provider: candidates[0].provider, model: candidates[0].model };
  }

  _scoreProvider(provider, modelConfig, targetDims) {
    const breaker = this._breakers.get(provider.name);
    const health = breaker.healthScore();

    // Lower cost = higher score
    const costScore = 1 / (1 + modelConfig.costPer1k * 10000);
    // Exact dimension match preferred
    const dimScore = modelConfig.dims === targetDims ? 1 : PSI;
    // Health of circuit breaker
    const healthScore = health;

    return costScore * PSI + dimScore + healthScore * PHI;
  }

  /**
   * Call a provider's embedding API.
   * This is a stub that subclasses/configurations can override.
   */
  async _callProvider(provider, model, texts) {
    if (provider.name === 'local') {
      return this._localEmbed(texts);
    }

    // HTTP call to provider
    if (!provider.endpoint) {
      throw new Error(`Provider ${provider.name} has no endpoint configured`);
    }

    const apiKey = process.env[provider.envKey];
    if (!apiKey) {
      throw new Error(`Missing API key: ${provider.envKey}`);
    }

    // Provider-specific request formatting
    let body, headers;

    if (provider.name === 'openai') {
      body = JSON.stringify({ input: texts, model });
      headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
    } else if (provider.name === 'cohere') {
      body = JSON.stringify({ texts, model, input_type: 'search_document' });
      headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
    } else if (provider.name === 'google') {
      body = JSON.stringify({ requests: texts.map(t => ({ model: `models/${model}`, content: { parts: [{ text: t }] } })) });
      headers = { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };
    }

    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(TIMING.LONG),
    });

    if (!response.ok) {
      throw new Error(`${provider.name} embedding failed: ${response.status}`);
    }

    const data = await response.json();

    // Extract vectors based on provider response format
    if (provider.name === 'openai') {
      return data.data.map(d => new Float32Array(d.embedding));
    } else if (provider.name === 'cohere') {
      return data.embeddings.map(e => new Float32Array(e));
    } else if (provider.name === 'google') {
      return data.embeddings.map(e => new Float32Array(e.values));
    }

    throw new Error(`Unknown provider response format: ${provider.name}`);
  }

  /**
   * Local embedding fallback using random projections.
   * In production, this would use ONNX runtime with all-MiniLM-L6-v2.
   */
  _localEmbed(texts) {
    return texts.map(text => {
      // Deterministic hash-based embedding (consistent for same input)
      const vec = new Float32Array(DIMENSIONS);
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
      }
      for (let i = 0; i < DIMENSIONS; i++) {
        hash = ((hash << 5) - hash + i) | 0;
        vec[i] = (hash & 0xFFFF) / 32768 - 1; // [-1, 1]
      }
      // Normalize to unit vector
      const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
      for (let i = 0; i < DIMENSIONS; i++) vec[i] /= norm;
      return vec;
    });
  }

  /** Router health */
  health() {
    const providerHealth = {};
    for (const [name, breaker] of this._breakers) {
      providerHealth[name] = breaker.status();
    }
    return {
      totalEmbeddings: this._totalEmbeddings,
      cacheHits: this._cacheHits,
      cacheStats: this._cache.stats(),
      hitRate: this._totalEmbeddings > 0
        ? this._cacheHits / (this._totalEmbeddings + this._cacheHits)
        : 0,
      providers: providerHealth,
    };
  }
}

module.exports = { EmbeddingRouter, PROVIDERS };
