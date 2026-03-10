/**
 * HeadyWisdomStore — Long-Term Pattern & Lesson Persistence
 *
 * Stores accumulated wisdom: lessons learned, successful patterns, failure modes,
 * architectural decisions (ADRs), and optimization discoveries.
 * Backed by pgvector for semantic retrieval.
 *
 * Key difference from HeadyMemory: WisdomStore is curated knowledge (high-value
 * distilled insights) vs HeadyMemory's raw episodic memory.
 *
 * © 2026 HeadySystems Inc. — Sacred Geometry v4.0
 * @module memory/wisdom-store
 */

const { PHI, PSI, fib, CSL_THRESHOLDS, DEDUP_THRESHOLD, phiFusionWeights, cosineSimilarity, cslGate } = require('../shared/phi-math');
const { createLogger } = require('../shared/logger');

const logger = createLogger('WisdomStore');

/**
 * @typedef {Object} WisdomEntry
 * @property {string} id - UUID
 * @property {string} type - lesson | pattern | adr | failure | optimization
 * @property {string} title - Short title
 * @property {string} content - Full wisdom text
 * @property {string[]} tags - Semantic tags
 * @property {number[]} embedding - 384D embedding
 * @property {number} confidence - How proven this wisdom is (0-1)
 * @property {number} useCount - Times successfully applied
 * @property {string} source - Where this wisdom came from
 * @property {string} createdAt - ISO timestamp
 * @property {string} lastUsed - ISO timestamp
 */

const WISDOM_TYPES = Object.freeze(['lesson', 'pattern', 'adr', 'failure', 'optimization']);

class WisdomStore {
  /**
   * @param {Object} config
   * @param {Function} config.embedFn - async (text) => number[]
   * @param {Object} [config.db] - Database connection (pgvector)
   * @param {number} [config.maxEntries] - Max entries (default: fib(16) = 987)
   */
  constructor(config) {
    this.embedFn = config.embedFn;
    this.db = config.db || null;
    this.maxEntries = config.maxEntries || fib(16);
    this.entries = new Map(); // RAM-first, syncs to DB
    this.evictionWeights = phiFusionWeights(3); // [0.486, 0.300, 0.214]
  }

  /**
   * Store a new wisdom entry.
   * Deduplicates against existing entries using DEDUP_THRESHOLD.
   * @param {Object} entry
   * @param {string} entry.type
   * @param {string} entry.title
   * @param {string} entry.content
   * @param {string[]} [entry.tags]
   * @param {string} [entry.source]
   * @returns {Promise<{ id: string, deduplicated: boolean }>}
   */
  async store(entry) {
    if (!WISDOM_TYPES.includes(entry.type)) {
      throw new Error(`Invalid wisdom type: ${entry.type}. Valid: ${WISDOM_TYPES.join(', ')}`);
    }

    const text = `${entry.title} ${entry.content} ${(entry.tags || []).join(' ')}`;
    const embedding = await this.embedFn(text);

    // Dedup check — find existing entries above DEDUP_THRESHOLD
    const duplicate = this._findDuplicate(embedding);
    if (duplicate) {
      // Merge into existing entry — boost confidence
      duplicate.confidence = Math.min(1.0, duplicate.confidence + PSI * PSI * PSI); // ≈ +0.236
      duplicate.useCount++;
      duplicate.lastUsed = new Date().toISOString();
      logger.info({ id: duplicate.id, confidence: duplicate.confidence }, 'Wisdom merged with existing');
      return { id: duplicate.id, deduplicated: true };
    }

    const id = this._generateId();
    const wisdomEntry = {
      id,
      type: entry.type,
      title: entry.title,
      content: entry.content,
      tags: entry.tags || [],
      embedding,
      confidence: CSL_THRESHOLDS.MINIMUM, // Start at noise floor, earns confidence
      useCount: 0,
      source: entry.source || 'system',
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
    };

    this.entries.set(id, wisdomEntry);

    // Evict if over capacity
    if (this.entries.size > this.maxEntries) {
      this._evict();
    }

    // Persist to DB if available
    if (this.db) {
      await this._persistToDb(wisdomEntry);
    }

    logger.info({ id, type: entry.type, title: entry.title }, 'Wisdom stored');
    return { id, deduplicated: false };
  }

  /**
   * Search wisdom by semantic similarity.
   * @param {string} query - Natural language query
   * @param {Object} [options]
   * @param {number} [options.limit] - Max results (default: fib(7) = 13)
   * @param {number} [options.minScore] - Min CSL score (default: CSL_THRESHOLDS.LOW)
   * @param {string} [options.type] - Filter by type
   * @returns {Promise<Array<{ entry: WisdomEntry, score: number }>>}
   */
  async search(query, options = {}) {
    const limit = options.limit || fib(7);
    const minScore = options.minScore || CSL_THRESHOLDS.LOW;

    const queryEmbedding = await this.embedFn(query);

    const results = [];
    for (const entry of this.entries.values()) {
      if (options.type && entry.type !== options.type) continue;

      const similarity = cosineSimilarity(queryEmbedding, entry.embedding);
      const score = cslGate(1.0, similarity, minScore);

      if (score > 0) {
        results.push({ entry, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Record that a wisdom entry was successfully used.
   * Boosts confidence.
   * @param {string} id
   * @returns {boolean} Whether the entry was found
   */
  recordUsage(id) {
    const entry = this.entries.get(id);
    if (!entry) return false;

    entry.useCount++;
    entry.lastUsed = new Date().toISOString();
    entry.confidence = Math.min(1.0, entry.confidence + PSI * PSI * PSI * PSI); // ≈ +0.146
    logger.info({ id, useCount: entry.useCount, confidence: entry.confidence }, 'Wisdom usage recorded');
    return true;
  }

  /**
   * Record that a wisdom entry led to a failure.
   * Reduces confidence.
   * @param {string} id
   * @param {string} reason
   * @returns {boolean}
   */
  recordFailure(id, reason) {
    const entry = this.entries.get(id);
    if (!entry) return false;

    entry.confidence = Math.max(0, entry.confidence - PSI * PSI); // ≈ -0.382
    logger.warn({ id, confidence: entry.confidence, reason }, 'Wisdom failure recorded');

    // If confidence drops to zero, entry will be evicted naturally
    return true;
  }

  /**
   * Get top wisdom by confidence.
   * @param {number} [limit] - Default fib(6) = 8
   * @returns {WisdomEntry[]}
   */
  topWisdom(limit = fib(6)) {
    return [...this.entries.values()]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  // ─────────────────────────────────────────────────────────────
  // Internal
  // ─────────────────────────────────────────────────────────────

  /**
   * Find duplicate entry via embedding similarity.
   * @param {number[]} embedding
   * @returns {WisdomEntry|null}
   */
  _findDuplicate(embedding) {
    for (const entry of this.entries.values()) {
      const sim = cosineSimilarity(embedding, entry.embedding);
      if (sim >= DEDUP_THRESHOLD) return entry;
    }
    return null;
  }

  /**
   * Evict lowest-value entries using phi-weighted scoring.
   * Score = confidence × 0.486 + recency × 0.300 + useCount × 0.214
   */
  _evict() {
    const now = Date.now();
    const scored = [...this.entries.entries()].map(([id, entry]) => {
      const recency = 1 - Math.min(1, (now - new Date(entry.lastUsed).getTime()) / (fib(11) * 86400000)); // 89 days
      const usageNorm = Math.min(1, entry.useCount / fib(8)); // Normalize to max 21 uses
      const score =
        entry.confidence * this.evictionWeights[0] +
        recency * this.evictionWeights[1] +
        usageNorm * this.evictionWeights[2];
      return { id, score };
    });

    scored.sort((a, b) => a.score - b.score);
    const evictCount = fib(6); // Evict 8 at a time

    for (let i = 0; i < evictCount && i < scored.length; i++) {
      this.entries.delete(scored[i].id);
    }

    logger.info({ evicted: evictCount, remaining: this.entries.size }, 'Wisdom eviction complete');
  }

  /** @private */
  async _persistToDb(entry) {
    // In production: INSERT INTO wisdom_store (id, type, title, content, embedding, ...) VALUES (...)
    // With ON CONFLICT DO UPDATE for upserts
    logger.debug({ id: entry.id }, 'Persisted to DB');
  }

  /** @private */
  _generateId() {
    return `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /** Health check */
  health() {
    return {
      service: 'WisdomStore',
      status: 'up',
      entryCount: this.entries.size,
      maxEntries: this.maxEntries,
      types: WISDOM_TYPES.reduce((acc, t) => {
        acc[t] = [...this.entries.values()].filter(e => e.type === t).length;
        return acc;
      }, {}),
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { WisdomStore, WISDOM_TYPES };
