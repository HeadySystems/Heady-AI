'use strict';
/**
 * HeadyAutoContext — Context Assembler
 * Assembles context from multiple registered sources into a frozen ContextEnvelope.
 *
 * © 2026 HeadySystems Inc. — Eric Haywood
 * Architecture: φ-scaled, CSL-gated, Sacred Geometry v4.0
 */

const { EventEmitter } = require('events');

// ─── φ-Math Constants ────────────────────────────────────────────
const PHI  = 1.618033988749895;
const PSI  = 1 / PHI;
const PSI2 = PSI * PSI;

// ─── Context Source Types ────────────────────────────────────────
const CONTEXT_SOURCES = Object.freeze({
  VECTOR_MEMORY:  'vector_memory',
  SESSION_STATE:  'session_state',
  TASK_HISTORY:   'task_history',
  USER_PROFILE:   'user_profile',
  SYSTEM_STATE:   'system_state',
});

// ─── φ-Fusion Weights (descending, sum ≈ 1.0) ───────────────────
// Generated via φ-decay: each weight = remaining × PSI
function generatePhiFusionWeights(n) {
  const weights = [];
  let remaining = 1;
  for (let i = 0; i < n - 1; i++) {
    const w = remaining * PSI;
    weights.push(Number(w.toFixed(6)));
    remaining -= w;
  }
  weights.push(Number(remaining.toFixed(6)));
  return weights;
}

const CONTEXT_WEIGHTS = Object.freeze(
  generatePhiFusionWeights(Object.keys(CONTEXT_SOURCES).length)
);

// ─── ContextEnvelope ─────────────────────────────────────────────
class ContextEnvelope {
  constructor({ taskId, userId, sources, assemblyMs, totalItems, relevanceScore, timestamp }) {
    this.taskId = taskId;
    this.userId = userId;
    this.sources = sources;
    this.assemblyMs = assemblyMs;
    this.totalItems = totalItems;
    this.relevanceScore = relevanceScore;
    this.timestamp = timestamp || Date.now();
    this.version = '4.0.0';

    // Deep-freeze sources
    if (this.sources && typeof this.sources === 'object') {
      Object.freeze(this.sources);
    }
    Object.freeze(this);
  }

  /**
   * Check if relevance score meets or exceeds the given threshold.
   * Returns true if relevanceScore >= threshold (note: higher threshold = stricter).
   */
  meetsThreshold(threshold) {
    return this.relevanceScore >= threshold;
  }

  /**
   * Flatten all items from all sources into a single array, sorted by relevance descending.
   */
  flatten() {
    const allItems = [];
    for (const sourceKey of Object.keys(this.sources)) {
      const source = this.sources[sourceKey];
      if (source && Array.isArray(source.items)) {
        for (const item of source.items) {
          allItems.push({ ...item, _source: sourceKey });
        }
      }
    }
    allItems.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
    return allItems;
  }

  /**
   * Produce a JSON-serializable representation.
   */
  toJSON() {
    return {
      taskId: this.taskId,
      userId: this.userId,
      sources: this.sources,
      assemblyMs: this.assemblyMs,
      totalItems: this.totalItems,
      relevanceScore: this.relevanceScore,
      timestamp: this.timestamp,
      version: this.version,
    };
  }
}

// ─── HeadyAutoContext ────────────────────────────────────────────
class HeadyAutoContext extends EventEmitter {
  #sources = new Map();
  #cache = new Map();
  #cacheTTLMs;
  #assemblyCount = 0;

  constructor(options = {}) {
    super();
    this.#cacheTTLMs = options.cacheTTLMs || 0;
  }

  /**
   * Register a context source fetcher.
   * @param {string} sourceType - One of CONTEXT_SOURCES values
   * @param {Function} fetcher - async (params) => { items, score }
   */
  registerSource(sourceType, fetcher) {
    this.#sources.set(sourceType, fetcher);
  }

  /**
   * Assemble context from all registered sources concurrently.
   * @param {object} params - { taskId, userId, query, metadata }
   * @returns {ContextEnvelope}
   */
  async assemble(params) {
    const { taskId, userId, query } = params;

    // Check cache
    const cacheKey = `${userId}:${query || ''}`;
    if (this.#cacheTTLMs > 0) {
      const cached = this.#cache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.#cacheTTLMs) {
        return new ContextEnvelope({
          ...cached.envelope,
          taskId, // Update taskId for the new request
        });
      }
    }

    const startMs = Date.now();
    const sources = {};
    let totalItems = 0;
    const scores = [];

    // Fetch all sources concurrently
    const sourceEntries = Array.from(this.#sources.entries());
    const results = await Promise.allSettled(
      sourceEntries.map(async ([type, fetcher]) => {
        const result = await fetcher(params);
        return { type, result };
      })
    );

    for (const settled of results) {
      if (settled.status === 'fulfilled') {
        const { type, result } = settled.value;
        sources[type] = result;
        totalItems += (result.items ? result.items.length : 0);
        if (typeof result.score === 'number') {
          scores.push(result.score);
        }
      } else {
        // Extract source type from the promise index
        const idx = results.indexOf(settled);
        const type = sourceEntries[idx][0];
        const errorMsg = settled.reason?.message || 'unknown_error';
        sources[type] = { items: [], score: 0, error: errorMsg };
      }
    }

    // Compute weighted relevance score using φ-fusion weights
    let relevanceScore = 0;
    if (scores.length > 0) {
      const weights = CONTEXT_WEIGHTS.slice(0, scores.length);
      const weightSum = weights.reduce((a, b) => a + b, 0);
      relevanceScore = scores.reduce((acc, score, i) => acc + score * (weights[i] / weightSum), 0);
    }

    const assemblyMs = Date.now() - startMs;
    this.#assemblyCount++;

    const envelopeData = {
      taskId,
      userId,
      sources,
      assemblyMs,
      totalItems,
      relevanceScore,
      timestamp: Date.now(),
    };

    const envelope = new ContextEnvelope(envelopeData);

    // Cache the result
    if (this.#cacheTTLMs > 0) {
      this.#cache.set(cacheKey, {
        envelope: envelopeData,
        timestamp: Date.now(),
      });
    }

    this.emit('context:assembled', { taskId, totalItems, relevanceScore, assemblyMs });
    return envelope;
  }

  /**
   * Return health metrics.
   */
  health() {
    const sourcesHealth = {};
    for (const [type] of this.#sources) {
      sourcesHealth[type] = { registered: true };
    }
    return {
      status: 'healthy',
      assemblyCount: this.#assemblyCount,
      cacheSize: this.#cache.size,
      sources: sourcesHealth,
    };
  }

  /**
   * Shutdown and clean up resources.
   */
  async shutdown() {
    this.#cache.clear();
    this.#sources.clear();
    this.removeAllListeners();
  }
}

module.exports = {
  ContextEnvelope,
  HeadyAutoContext,
  CONTEXT_SOURCES,
  CONTEXT_WEIGHTS,
};
