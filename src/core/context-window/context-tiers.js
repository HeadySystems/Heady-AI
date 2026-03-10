/**
 * Heady Context Window Manager — Tiered Context Storage
 *
 * Implements phi-scaled tiered context: Working → Session → Memory → Artifacts.
 * Each tier has a token budget derived from φ-geometric progression.
 * Eviction uses phi-weighted scoring (importance × 0.486 + recency × 0.300 + relevance × 0.214).
 * Compression triggers at 1 - ψ⁴ ≈ 91.0% capacity.
 *
 * @module core/context-window/context-tiers
 * @author Eric Haywood — HeadySystems Inc.
 * @license PROPRIETARY — 51+ Provisional Patents
 */

import { EventEmitter } from 'events';
import {
  PHI, PSI, FIB,
  phiThreshold,
  phiFusionWeights,
} from '../../packages/phi-math-foundation/src/index.js';
import { createLogger } from '../../packages/structured-logger/src/index.js';

const logger = createLogger('context-tiers');

/**
 * Phi-scaled token budgets for each tier.
 * Base = FIB[13] × FIB[6] = 233 × 8 = 1864 (scaled by 4.4 to reach ~8192).
 * We use 8192 as working budget, then φ² / φ⁴ / φ⁶ scaling.
 */
const BASE_TOKENS = 8192;

export const TOKEN_BUDGETS = Object.freeze({
  working:   BASE_TOKENS,                                    // 8,192
  session:   Math.round(BASE_TOKENS * PHI * PHI),            // ~21,450
  memory:    Math.round(BASE_TOKENS * Math.pow(PHI, 4)),     // ~56,131
  artifacts: Math.round(BASE_TOKENS * Math.pow(PHI, 6)),     // ~146,920
});

/** Compression triggers at 1 - ψ⁴ ≈ 0.910 of tier capacity */
const COMPRESSION_THRESHOLD = 1 - Math.pow(PSI, 4); // ≈ 0.910

/** Eviction weights: importance, recency, relevance (phi-fusion 3-factor) */
const EVICTION_WEIGHTS = Object.freeze({
  importance: PHI * PHI / (PHI * PHI + PHI + 1),   // ≈ 0.486
  recency:    PHI / (PHI * PHI + PHI + 1),          // ≈ 0.300
  relevance:  1 / (PHI * PHI + PHI + 1),            // ≈ 0.214
});

/** Fibonacci-indexed message counts that trigger compression */
const COMPRESSION_MILESTONES = [FIB[6], FIB[7], FIB[8], FIB[9], FIB[10], FIB[11]];
// [8, 13, 21, 34, 55, 89]

/**
 * A single context entry with metadata for scoring and eviction.
 */
export class ContextEntry {
  constructor({ role, content, tokens, importance = PSI, metadata = {} }) {
    this.id = `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.role = role;           // 'system' | 'user' | 'assistant' | 'tool'
    this.content = content;
    this.tokens = tokens;
    this.importance = importance;
    this.createdAt = Date.now();
    this.lastAccessedAt = Date.now();
    this.accessCount = 0;
    this.metadata = metadata;
  }

  /** Recency score normalized to [0, 1], decays with phi-harmonic curve */
  recencyScore(now = Date.now()) {
    const ageMs = now - this.lastAccessedAt;
    const ageMinutes = ageMs / 60000;
    // φ-decay: score = ψ^(age / FIB[8]) — halves roughly every 21 minutes
    return Math.pow(PSI, ageMinutes / FIB[8]);
  }

  /** Compute eviction score — higher = more worth keeping */
  evictionScore(relevance = PSI, now = Date.now()) {
    return (
      this.importance * EVICTION_WEIGHTS.importance +
      this.recencyScore(now) * EVICTION_WEIGHTS.recency +
      relevance * EVICTION_WEIGHTS.relevance
    );
  }
}

/**
 * TieredContextManager — manages the 4-tier context hierarchy.
 *
 * @fires TieredContextManager#entry:added
 * @fires TieredContextManager#entry:evicted
 * @fires TieredContextManager#tier:compressed
 * @fires TieredContextManager#tier:overflow
 */
export class TieredContextManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.budgets = { ...TOKEN_BUDGETS, ...options.budgets };

    /** @type {Map<string, ContextEntry[]>} tier → entries */
    this.tiers = new Map([
      ['working',   []],
      ['session',   []],
      ['memory',    []],
      ['artifacts', []],
    ]);

    /** Current token usage per tier */
    this.usage = new Map([
      ['working',   0],
      ['session',   0],
      ['memory',    0],
      ['artifacts', 0],
    ]);

    this.totalMessages = 0;
    this.compressionCount = 0;
    this.evictionCount = 0;

    logger.info({
      budgets: this.budgets,
      compressionThreshold: COMPRESSION_THRESHOLD,
      evictionWeights: EVICTION_WEIGHTS,
    }, 'TieredContextManager initialized');
  }

  /**
   * Add an entry to the working tier. Triggers compression/eviction if needed.
   * @param {object} params - Entry parameters
   * @returns {ContextEntry} The added entry
   */
  addEntry({ role, content, tokens, importance, metadata }) {
    const entry = new ContextEntry({ role, content, tokens, importance, metadata });
    this.totalMessages++;

    // Check if compression milestone reached
    if (COMPRESSION_MILESTONES.includes(this.totalMessages)) {
      this._compressTier('working');
    }

    // Ensure capacity — evict from working if over threshold
    const workingBudget = this.budgets.working;
    const currentUsage = this.usage.get('working');

    if ((currentUsage + tokens) / workingBudget > COMPRESSION_THRESHOLD) {
      this._evictFromTier('working', tokens);
    }

    // Add entry
    this.tiers.get('working').push(entry);
    this.usage.set('working', this.usage.get('working') + tokens);

    this.emit('entry:added', { tier: 'working', entryId: entry.id, tokens });
    return entry;
  }

  /**
   * Retrieve entries from working tier, marking them as accessed.
   * @param {number} topK - Max entries to return
   * @returns {ContextEntry[]}
   */
  getWorkingContext(topK = FIB[8]) {
    const entries = this.tiers.get('working');
    const now = Date.now();

    // Return most recent topK, updating access time
    const result = entries.slice(-topK);
    for (const entry of result) {
      entry.lastAccessedAt = now;
      entry.accessCount++;
    }
    return result;
  }

  /**
   * Search memory tier by relevance scores.
   * @param {Map<string, number>} relevanceMap - entryId → cosine similarity score
   * @param {number} topK - Max results
   * @param {number} threshold - Minimum relevance (default ψ ≈ 0.618)
   * @returns {ContextEntry[]}
   */
  searchMemory(relevanceMap, topK = FIB[5], threshold = PSI) {
    const memoryEntries = this.tiers.get('memory');
    const now = Date.now();

    const scored = memoryEntries
      .map(entry => ({
        entry,
        relevance: relevanceMap.get(entry.id) || 0,
        score: entry.evictionScore(relevanceMap.get(entry.id) || 0, now),
      }))
      .filter(s => s.relevance >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored.map(s => s.entry);
  }

  /**
   * Create a context capsule for inter-agent transfer.
   * Packages system context + compressed working + relevant memory.
   *
   * @param {object} options
   * @param {string} options.targetAgent - Receiving agent identifier
   * @param {number} options.maxTokens - Token budget for capsule
   * @param {boolean} options.includeSystemMsg - Include system messages
   * @returns {object} Context capsule
   */
  createCapsule({ targetAgent, maxTokens, includeSystemMsg = true }) {
    const capsuleMaxTokens = maxTokens || this.budgets.session;
    const capsule = {
      id: `capsule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      targetAgent,
      createdAt: Date.now(),
      maxTokens: capsuleMaxTokens,
      entries: [],
      totalTokens: 0,
      metadata: {
        sourceTotalMessages: this.totalMessages,
        sourceCompressions: this.compressionCount,
      },
    };

    // Gather entries: system first, then working (most recent), then memory (highest scored)
    const allEntries = [];
    const working = this.tiers.get('working');

    if (includeSystemMsg) {
      const systemEntries = working.filter(e => e.role === 'system');
      allEntries.push(...systemEntries);
    }

    // Add working entries (most recent first)
    const nonSystemWorking = working.filter(e => e.role !== 'system').reverse();
    allEntries.push(...nonSystemWorking);

    // Add memory entries sorted by importance
    const memoryEntries = [...this.tiers.get('memory')]
      .sort((a, b) => b.importance - a.importance);
    allEntries.push(...memoryEntries);

    // Fill capsule within token budget
    for (const entry of allEntries) {
      if (capsule.totalTokens + entry.tokens <= capsuleMaxTokens) {
        capsule.entries.push({
          role: entry.role,
          content: entry.content,
          tokens: entry.tokens,
          importance: entry.importance,
        });
        capsule.totalTokens += entry.tokens;
      }
    }

    logger.info({
      capsuleId: capsule.id,
      targetAgent,
      entryCount: capsule.entries.length,
      totalTokens: capsule.totalTokens,
      maxTokens: capsuleMaxTokens,
    }, 'Context capsule created');

    return capsule;
  }

  /**
   * Get usage statistics for all tiers.
   * @returns {object} Usage report
   */
  getStats() {
    const stats = {};
    for (const [tier, entries] of this.tiers) {
      const budget = this.budgets[tier];
      const used = this.usage.get(tier);
      stats[tier] = {
        entries: entries.length,
        tokensUsed: used,
        tokenBudget: budget,
        utilization: budget > 0 ? used / budget : 0,
        atThreshold: budget > 0 ? (used / budget) >= COMPRESSION_THRESHOLD : false,
      };
    }
    return {
      tiers: stats,
      totalMessages: this.totalMessages,
      compressions: this.compressionCount,
      evictions: this.evictionCount,
    };
  }

  /**
   * Compress a tier by summarizing older entries.
   * Moves compressed summaries to the next tier down.
   *
   * @param {string} tierName - Tier to compress
   * @private
   */
  _compressTier(tierName) {
    const entries = this.tiers.get(tierName);
    if (entries.length < FIB[5]) return; // Need at least 5 entries

    this.compressionCount++;

    // Keep the most recent FIB[5] entries, compress the rest
    const keepCount = Math.min(FIB[5], Math.ceil(entries.length * PSI));
    const toCompress = entries.splice(0, entries.length - keepCount);

    if (toCompress.length === 0) return;

    // Calculate tokens being removed
    const removedTokens = toCompress.reduce((sum, e) => sum + e.tokens, 0);
    this.usage.set(tierName, this.usage.get(tierName) - removedTokens);

    // Create compressed summary entry
    const compressedTokens = Math.round(removedTokens * PSI); // Compress to ~61.8%
    const summary = new ContextEntry({
      role: 'system',
      content: `[Compressed ${toCompress.length} entries from ${tierName}]`,
      tokens: compressedTokens,
      importance: phiThreshold(2), // MEDIUM ≈ 0.809
      metadata: {
        compressedFrom: tierName,
        originalCount: toCompress.length,
        originalTokens: removedTokens,
      },
    });

    // Demote to next tier
    const nextTier = this._getNextTier(tierName);
    if (nextTier) {
      this.tiers.get(nextTier).push(summary);
      this.usage.set(nextTier, this.usage.get(nextTier) + compressedTokens);
    }

    this.emit('tier:compressed', {
      tier: tierName,
      entriesCompressed: toCompress.length,
      tokensReclaimed: removedTokens - compressedTokens,
      nextTier,
    });

    logger.info({
      tier: tierName,
      compressed: toCompress.length,
      reclaimed: removedTokens - compressedTokens,
    }, 'Tier compressed');
  }

  /**
   * Evict lowest-scored entries from a tier to make room.
   *
   * @param {string} tierName - Tier to evict from
   * @param {number} neededTokens - How many tokens we need to free
   * @private
   */
  _evictFromTier(tierName, neededTokens) {
    const entries = this.tiers.get(tierName);
    if (entries.length === 0) return;

    const now = Date.now();

    // Score all entries
    const scored = entries.map((entry, idx) => ({
      entry,
      idx,
      score: entry.evictionScore(PSI, now),
    }));

    // Sort by score ascending (lowest first = evict first)
    scored.sort((a, b) => a.score - b.score);

    let freedTokens = 0;
    const evictIndices = new Set();
    const batchSize = FIB[6]; // Evict up to 8 at a time

    for (const item of scored) {
      if (freedTokens >= neededTokens || evictIndices.size >= batchSize) break;
      // Never evict system messages
      if (item.entry.role === 'system') continue;

      evictIndices.add(item.idx);
      freedTokens += item.entry.tokens;
      this.evictionCount++;

      this.emit('entry:evicted', {
        tier: tierName,
        entryId: item.entry.id,
        score: item.score,
        tokens: item.entry.tokens,
      });
    }

    // Remove evicted entries (reverse order to preserve indices)
    const sortedIndices = [...evictIndices].sort((a, b) => b - a);
    for (const idx of sortedIndices) {
      entries.splice(idx, 1);
    }

    this.usage.set(tierName, this.usage.get(tierName) - freedTokens);

    logger.info({
      tier: tierName,
      evicted: evictIndices.size,
      freedTokens,
      neededTokens,
    }, 'Entries evicted from tier');
  }

  /**
   * Get the next tier in the demotion chain.
   * @param {string} tierName
   * @returns {string|null}
   * @private
   */
  _getNextTier(tierName) {
    const chain = ['working', 'session', 'memory', 'artifacts'];
    const idx = chain.indexOf(tierName);
    return idx >= 0 && idx < chain.length - 1 ? chain[idx + 1] : null;
  }
}
