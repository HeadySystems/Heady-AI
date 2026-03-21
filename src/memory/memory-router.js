/**
 * MemoryRouter — 3-Tier Memory Routing for Heady Latent OS
 * 
 * Routes data to the correct memory tier based on access pattern:
 *   HOT  → Redis (sessions, rate limits, realtime cache) 
 *   WARM → pgvector (embeddings, vector search, conversation history)
 *   COLD → Archival (audit logs, model training data, analytics)
 * 
 * Automatic tier migration:
 *   HOT → WARM after TTL expiry (φ-scaled: ~29s default)
 *   WARM → COLD after age threshold (φ-scaled: ~7 days)
 * 
 * @module memory/memory-router
 * @author Eric Haywood
 * @license Proprietary — HeadySystems Inc.
 */
'use strict';

const { PHI, PSI, FIB, phiMs, CSL_THRESHOLDS } = require('../shared/phi-math');
const { createLogger } = require('../utils/logger');
const logger = createLogger('memory-router');

const TIER = {
  HOT:  'hot',
  WARM: 'warm',
  COLD: 'cold',
};

const ACCESS_PATTERNS = {
  REALTIME:    TIER.HOT,   // sessions, counters, cache
  SEMANTIC:    TIER.WARM,  // embeddings, vector search
  ARCHIVAL:    TIER.COLD,  // audit, training, long-term
  SEARCH:      TIER.WARM,  // full-text + vector hybrid
  STREAMING:   TIER.HOT,   // event stream, pubsub
  ANALYTICS:   TIER.COLD,  // time-series, aggregation
};

const TIER_TTLS = {
  [TIER.HOT]:  Math.round(PHI * 18000),         // ~29,124ms
  [TIER.WARM]: Math.round(PHI * 7 * 86400000),  // ~7.6 days  
  [TIER.COLD]: Infinity,                         // never expires
};

class MemoryRouter {
  constructor(config = {}) {
    this.name = 'memory-router';
    this.status = 'dormant';
    
    /** @type {object|null} Hot store client (Redis/Upstash) */
    this._hot = config.hotStore || null;
    /** @type {object|null} Warm store client (pgvector/Neon) */
    this._warm = config.warmStore || null;
    /** @type {object|null} Cold store client (archival/S3/GCS) */
    this._cold = config.coldStore || null;

    this._metrics = {
      gets: { hot: 0, warm: 0, cold: 0 },
      sets: { hot: 0, warm: 0, cold: 0 },
      migrations: { hotToWarm: 0, warmToCold: 0 },
      cacheHits: 0,
      cacheMisses: 0,
    };
    
    this._migrationInterval = null;
  }

  async start() {
    this.status = 'active';
    // Start tier migration at φ-scaled interval
    const migrationMs = phiMs ? phiMs(FIB[10] * 1000) : Math.round(PHI * 89000);
    this._migrationInterval = setInterval(() => this._runMigration(), migrationMs);
    if (this._migrationInterval.unref) this._migrationInterval.unref();
    logger.info({ migrationIntervalMs: migrationMs }, 'Memory router started');
    return this;
  }

  async stop() {
    this.status = 'dormant';
    if (this._migrationInterval) clearInterval(this._migrationInterval);
    logger.info({}, 'Memory router stopped');
  }

  health() {
    return {
      name: this.name,
      status: this.status,
      tiers: {
        hot:  this._hot  ? 'connected' : 'unavailable',
        warm: this._warm ? 'connected' : 'unavailable',
        cold: this._cold ? 'connected' : 'unavailable',
      },
      metrics: this._metrics,
    };
  }

  /**
   * Route a SET operation to the correct tier
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   * @param {object} [opts] - Options: { tier, pattern, ttl, metadata }
   */
  async set(key, value, opts = {}) {
    const tier = opts.tier || this._routeByPattern(opts.pattern) || TIER.HOT;
    const ttl = opts.ttl || TIER_TTLS[tier];
    
    try {
      switch (tier) {
        case TIER.HOT:
          await this._setHot(key, value, ttl);
          this._metrics.sets.hot++;
          break;
        case TIER.WARM:
          await this._setWarm(key, value, opts.metadata);
          this._metrics.sets.warm++;
          break;
        case TIER.COLD:
          await this._setCold(key, value, opts.metadata);
          this._metrics.sets.cold++;
          break;
      }
      logger.debug({ key, tier }, 'Memory set');
    } catch (err) {
      logger.error({ key, tier, error: err.message }, 'Memory set failed');
      // Fallback: try next tier
      if (tier === TIER.HOT && this._warm) {
        await this._setWarm(key, value, opts.metadata);
        this._metrics.sets.warm++;
      }
    }
  }

  /**
   * Route a GET operation — cascading from hot → warm → cold
   * @param {string} key - Storage key
   * @param {object} [opts] - Options: { tier, pattern }
   */
  async get(key, opts = {}) {
    const preferredTier = opts.tier || this._routeByPattern(opts.pattern);
    
    // Try hot first
    if (!preferredTier || preferredTier === TIER.HOT) {
      const hotResult = await this._getHot(key);
      if (hotResult !== null && hotResult !== undefined) {
        this._metrics.gets.hot++;
        this._metrics.cacheHits++;
        return { value: hotResult, tier: TIER.HOT };
      }
    }

    // Try warm
    if (!preferredTier || preferredTier === TIER.WARM || preferredTier === TIER.HOT) {
      const warmResult = await this._getWarm(key);
      if (warmResult !== null && warmResult !== undefined) {
        this._metrics.gets.warm++;
        this._metrics.cacheHits++;
        // Promote to hot for next access
        if (this._hot) await this._setHot(key, warmResult, TIER_TTLS[TIER.HOT]);
        return { value: warmResult, tier: TIER.WARM };
      }
    }

    // Try cold
    const coldResult = await this._getCold(key);
    if (coldResult !== null && coldResult !== undefined) {
      this._metrics.gets.cold++;
      return { value: coldResult, tier: TIER.COLD };
    }

    this._metrics.cacheMisses++;
    return { value: null, tier: null };
  }

  /**
   * Semantic vector search (warm tier only)
   * @param {number[]} embedding - Query embedding vector
   * @param {object} [opts] - Options: { topK, threshold, namespace }
   * @returns {Array<{key: string, score: number, value: any}>}
   */
  async vectorSearch(embedding, opts = {}) {
    const topK = opts.topK || FIB[7]; // 13
    const threshold = opts.threshold || CSL_THRESHOLDS.MEDIUM; // 0.618

    if (!this._warm || typeof this._warm.vectorSearch !== 'function') {
      logger.warn({}, 'Vector search unavailable — warm store not connected');
      return [];
    }

    try {
      const results = await this._warm.vectorSearch(embedding, topK, opts.namespace);
      return results.filter(r => r.score >= threshold);
    } catch (err) {
      logger.error({ error: err.message }, 'Vector search failed');
      return [];
    }
  }

  // ─── Private: Tier Operations ─────────────────────────────────────

  _routeByPattern(pattern) {
    if (!pattern) return null;
    return ACCESS_PATTERNS[pattern.toUpperCase()] || null;
  }

  async _setHot(key, value, ttl) {
    if (!this._hot) return;
    if (typeof this._hot.set === 'function') {
      const ttlSec = Math.round(ttl / 1000);
      await this._hot.set(key, JSON.stringify(value), 'EX', ttlSec);
    }
  }

  async _getHot(key) {
    if (!this._hot) return null;
    if (typeof this._hot.get === 'function') {
      const raw = await this._hot.get(key);
      try { return raw ? JSON.parse(raw) : null; } catch { return raw; }
    }
    return null;
  }

  async _setWarm(key, value, metadata) {
    if (!this._warm) return;
    if (typeof this._warm.upsert === 'function') {
      await this._warm.upsert(key, value, metadata);
    }
  }

  async _getWarm(key) {
    if (!this._warm) return null;
    if (typeof this._warm.get === 'function') {
      return await this._warm.get(key);
    }
    return null;
  }

  async _setCold(key, value, metadata) {
    if (!this._cold) return;
    if (typeof this._cold.archive === 'function') {
      await this._cold.archive(key, value, metadata);
    }
  }

  async _getCold(key) {
    if (!this._cold) return null;
    if (typeof this._cold.retrieve === 'function') {
      return await this._cold.retrieve(key);
    }
    return null;
  }

  async _runMigration() {
    // Automatic tier migration runs at φ-scaled intervals
    // Hot → Warm: items past their TTL but still valuable
    // Warm → Cold: items older than warmThreshold
    logger.debug({}, 'Migration cycle tick started');
    try {
      if (this._hot && typeof this._hot.exportStale === 'function') {
        const staleItems = await this._hot.exportStale();
        for (const item of staleItems) {
            await this._setWarm(item.key, item.value, item.metadata);
            this._metrics.migrations.hotToWarm++;
        }
      }
      if (this._warm && typeof this._warm.exportOld === 'function') {
        const oldItems = await this._warm.exportOld(TIER_TTLS[TIER.WARM]);
        for (const item of oldItems) {
            await this._setCold(item.key, item.value, item.metadata);
            if (typeof this._warm.delete === 'function') {
              await this._warm.delete(item.key);
            }
            this._metrics.migrations.warmToCold++;
        }
      }
    } catch (err) {
      logger.error({ error: err.message }, 'Migration cycle failed');
    }
  }

  metrics() {
    return { ...this._metrics };
  }
}

// Singleton
const memoryRouter = new MemoryRouter();

module.exports = { MemoryRouter, memoryRouter, TIER, ACCESS_PATTERNS };