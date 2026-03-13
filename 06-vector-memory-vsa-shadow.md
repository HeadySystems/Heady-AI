# Heady™ Vector Memory + VSA Hyperdimensional Computing + Shadow Memory

## Foundation
All changes are based on the HeadyMe repos and Heady project data. The actual source code for every referenced file is provided below.

## Objective
Unify and optimize the vector memory stack with CSL-gated operations, VSA (Vector Symbolic Architecture) hyperdimensional computing for associative recall, and shadow memory persistence for cross-session continuity.

## Specific Deliverables — Build ALL Files

### 1. Vector Memory Core
- Consolidate vector-memory implementations into single optimized version
- CSL-gated similarity search — only return results above φ⁻¹ confidence
- Phi-scaled embedding dimensions based on content complexity
- Memory receipt system for audit trail

### 2. VSA Hyperdimensional Computing
- Expand vsa-csl-bridge with full VSA operations: Binding (⊗), Bundling (+), Permutation (π), Similarity (cos)
- CSL-gated retrieval threshold at φ⁻¹
- Replace branch-heavy memory lookup with vector operations

### 3. Shadow Memory Persistence
- Cross-session memory with CSL confidence decay (φ⁻¹ per session unless reinforced)
- Shadow memory consolidation using VSA bundling
- DuckDB backend for persistent storage

### 4. Memory Bees
- CSL-gated memory operations, phi-scaled consolidation cycles
- Project memories into 3D vector space

### 5. Test Suite — memory search, VSA ops, shadow decay, CSL thresholds, consolidation, DuckDB queries

## Constraints
- All constants from φ = 1.6180339887, SHA-256 hashing, Node.js only, VSA: 10000-dim hypervectors

---

## SOURCE FILES — COMPLETE HEADY CODEBASE CONTEXT


### `src/memory/vector-memory.js`

```javascript
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Vector Memory — src/memory/vector-memory.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * RAM-first 384-dimensional vector memory with LRU eviction, semantic search,
 * phi-weighted eviction scoring, and pgvector persistence fallback.
 *
 * This is the "brain" — all reasoning, routing, and orchestration decisions
 * read from vector memory first. PostgreSQL/pgvector is the backup.
 *
 * © HeadySystems Inc. — Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

'use strict';

const {
  fib, CSL_THRESHOLDS, EVICTION_WEIGHTS,
  phiFusionWeights, PSI, PHI,
} = require('../../shared/phi-math');
const { cslAND, normalize, topK } = require('../../shared/csl-engine');

const DEFAULT_DIM = 384;
const DEFAULT_CAPACITY = fib(20); // 6765 entries

class VectorMemory {
  /**
   * @param {object} [opts]
   * @param {number} [opts.dimensions] - Vector dimensionality (default 384)
   * @param {number} [opts.capacity] - Max entries in RAM (default fib(20)=6765)
   * @param {Function} [opts.embedFn] - async (text) → Float64Array — embedding function
   * @param {object} [opts.persistence] - pgvector adapter { store, search, delete }
   * @param {Function} [opts.logger]
   */
  constructor(opts = {}) {
    this.dimensions = opts.dimensions || DEFAULT_DIM;
    this.capacity = opts.capacity || DEFAULT_CAPACITY;
    this.embedFn = opts.embedFn || null;
    this.persistence = opts.persistence || null;
    this.logger = opts.logger || console;

    // RAM store: id → { vector, metadata, importance, accessCount, createdAt, lastAccessedAt }
    this._store = new Map();
    this._accessOrder = []; // LRU tracking
  }

  /**
   * Store a memory entry.
   * @param {string} id - Unique identifier
   * @param {Float64Array|number[]} vector - 384D embedding
   * @param {object} [metadata] - Arbitrary metadata
   * @param {number} [importance=0.5] - 0–1 importance score
   * @returns {object} Stored entry
   */
  store(id, vector, metadata = {}, importance = 0.5) {
    if (vector.length !== this.dimensions) {
      throw new Error(`Vector dimension mismatch: expected ${this.dimensions}, got ${vector.length}`);
    }

    const entry = {
      id,
      vector: vector instanceof Float64Array ? vector : new Float64Array(vector),
      metadata,
      importance: Math.max(0, Math.min(1, importance)),
      accessCount: 0,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    };

    this._store.set(id, entry);
    this._touchLRU(id);

    // Evict if over capacity
    while (this._store.size > this.capacity) {
      this._evict();
    }

    // Async persistence (fire and forget)
    if (this.persistence) {
      this.persistence.store(id, vector, metadata, importance).catch(err =>
        this.logger.warn?.('[VectorMemory] Persistence write failed', err)
      );
    }

    return entry;
  }

  /**
   * Store from text (requires embedFn).
   * @param {string} id
   * @param {string} text - Text to embed
   * @param {object} [metadata]
   * @param {number} [importance]
   * @returns {Promise<object>}
   */
  async storeText(id, text, metadata = {}, importance = 0.5) {
    if (!this.embedFn) throw new Error('No embedding function configured');
    const vector = await this.embedFn(text);
    return this.store(id, vector, { ...metadata, text }, importance);
  }

  /**
   * Retrieve entry by ID.
   * @param {string} id
   * @returns {object|null}
   */
  get(id) {
    const entry = this._store.get(id);
    if (!entry) return null;
    entry.accessCount++;
    entry.lastAccessedAt = Date.now();
    this._touchLRU(id);
    return entry;
  }

  /**
   * Semantic search: find top-K entries by cosine similarity.
   * @param {Float64Array|number[]} queryVector
   * @param {number} [k=10]
   * @param {object} [filter] - Optional metadata filter { key: value }
   * @returns {Array<{id: string, score: number, metadata: object}>}
   */
  search(queryVector, k = 10, filter = null) {
    let candidates = Array.from(this._store.values());

    // Apply metadata filter
    if (filter) {
      candidates = candidates.filter(entry => {
        for (const [key, value] of Object.entries(filter)) {
          if (entry.metadata[key] !== value) return false;
        }
        return true;
      });
    }

    // Score and rank
    const items = candidates.map(entry => ({
      id: entry.id,
      vector: entry.vector,
    }));

    const results = topK(queryVector, items, k);

    return results.map(r => {
      const entry = this._store.get(r.id);
      entry.accessCount++;
      entry.lastAccessedAt = Date.now();
      return {
        id: r.id,
        score: r.score,
        metadata: entry.metadata,
        importance: entry.importance,
      };
    });
  }

  /**
   * Semantic text search (requires embedFn).
   * @param {string} queryText
   * @param {number} [k=10]
   * @param {object} [filter]
   * @returns {Promise<Array>}
   */
  async searchText(queryText, k = 10, filter = null) {
    if (!this.embedFn) throw new Error('No embedding function configured');
    const queryVector = await this.embedFn(queryText);
    return this.search(queryVector, k, filter);
  }

  /**
   * Delete an entry.
   * @param {string} id
   * @returns {boolean}
   */
  delete(id) {
    const existed = this._store.delete(id);
    this._accessOrder = this._accessOrder.filter(x => x !== id);
    if (existed && this.persistence) {
      this.persistence.delete(id).catch(() => {});
    }
    return existed;
  }

  /**
   * Check if two entries are semantically duplicates.
   * @param {string} idA
   * @param {string} idB
   * @returns {number|null} Cosine similarity, or null if not found
   */
  similarity(idA, idB) {
    const a = this._store.get(idA);
    const b = this._store.get(idB);
    if (!a || !b) return null;
    return cslAND(a.vector, b.vector);
  }

  /**
   * Find semantic duplicates above a threshold.
   * @param {Float64Array|number[]} vector
   * @param {number} [threshold=CSL_THRESHOLDS.DEDUP]
   * @returns {Array<{id: string, score: number}>}
   */
  findDuplicates(vector, threshold = CSL_THRESHOLDS.DEDUP) {
    const results = [];
    for (const [id, entry] of this._store) {
      const score = cslAND(vector, entry.vector);
      if (score >= threshold) results.push({ id, score });
    }
    return results.sort((a, b) => b.score - a.score);
  }

  // ─── Eviction ──────────────────────────────────────────────────────────────

  /**
   * Evict the lowest-scored entry using phi-weighted scoring.
   * Score = importance × w_i + recency × w_r + accessFreq × w_a
   */
  _evict() {
    if (this._store.size === 0) return;

    const now = Date.now();
    let lowestId = null;
    let lowestScore = Infinity;

    const maxAccess = Math.max(1, ...Array.from(this._store.values()).map(e => e.accessCount));
    const maxAge = Math.max(1, ...Array.from(this._store.values()).map(e => now - e.createdAt));

    for (const [id, entry] of this._store) {
      const recency = 1 - ((now - entry.lastAccessedAt) / maxAge);
      const frequency = entry.accessCount / maxAccess;
      const importance = entry.importance;

      const score =
        importance * EVICTION_WEIGHTS.importance +
        Math.max(0, recency) * EVICTION_WEIGHTS.recency +
        frequency * EVICTION_WEIGHTS.relevance;

      if (score < lowestScore) {
        lowestScore = score;
        lowestId = id;
      }
    }

    if (lowestId) {
      this._store.delete(lowestId);
      this._accessOrder = this._accessOrder.filter(x => x !== lowestId);
    }
  }

  _touchLRU(id) {
    const idx = this._accessOrder.indexOf(id);
    if (idx !== -1) this._accessOrder.splice(idx, 1);
    this._accessOrder.push(id);
  }

  // ─── Status ────────────────────────────────────────────────────────────────

  /**
   * Get memory status.
   */
  status() {
    return {
      entries: this._store.size,
      capacity: this.capacity,
      utilization: this._store.size / this.capacity,
      dimensions: this.dimensions,
      hasPersistence: !!this.persistence,
      hasEmbedFn: !!this.embedFn,
    };
  }

  /**
   * Get all entry IDs.
   * @returns {string[]}
   */
  ids() {
    return Array.from(this._store.keys());
  }

  /**
   * Clear all in-memory entries.
   */
  clear() {
    this._store.clear();
    this._accessOrder = [];
  }
}

module.exports = { VectorMemory, DEFAULT_DIM, DEFAULT_CAPACITY };
```
---

### `src/memory/vector-memory-optimizer.js`

```javascript
/**
 * @fileoverview Vector Memory Optimizer for Heady Latent OS
 * @module vector-memory-optimizer
 *
 * Automated optimization advisor and monitor for pgvector-backed memory stores.
 * Provides:
 *   - Index type selection advisor (HNSW vs IVFFlat vs brute-force)
 *   - Quantization advisor (halfvec vs binary vs full float)
 *   - Slow query detection and alerting (pg_stat_statements integration)
 *   - Index health checker (fragmentation, bloat, dead tuples)
 *   - Auto-vacuum schedule recommendations
 *   - Memory pressure detection and response
 *   - pgvector 0.8.0 iterative scan tuning
 *
 * Decision thresholds (from research/section1_vector_db.md §1.3):
 *   - <30K vectors:    brute-force acceptable
 *   - 30K–50K:         HNSW starts showing advantage
 *   - 50K–1M:          HNSW strongly preferred (30× QPS, 27× lower p99)
 *   - 1M–50M:          HNSW + halfvec quantization
 *   - >50M:            Consider pgvectorscale or dedicated vector DB
 *
 * @example
 * import { VectorMemoryOptimizer } from './vector-memory-optimizer.js';
 *
 * const optimizer = new VectorMemoryOptimizer(pgPool, { logger: console });
 * await optimizer.start();
 *
 * // On-demand index check
 * const advice = await optimizer.getIndexRecommendation('vector_memories');
 * console.log(advice.recommendation, advice.action);
 */

import { EventEmitter } from 'events';
import {
  PHI, PSI,
  CSL_THRESHOLDS,
  phiAdaptiveInterval,
  fib,
} from '../../shared/phi-math.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Vector count thresholds for index type selection */
const THRESHOLDS = {
  bruteForce:     30_000,    // <30K: brute-force acceptable
  hnswPreferred:  50_000,    // 30K–50K: HNSW starts winning
  hnswRequired:   1_000_000, // 50K–1M: HNSW strongly preferred
  quantization:   1_000_000, // >1M: add halfvec quantization
  binary:         10_000_000,// >10M: consider binary quantization
  pgvectorscale:  50_000_000,// >50M: consider pgvectorscale
};

/**
 * HNSW parameter presets by scale.
 * All m, ef_construction, and ef_search values are Fibonacci numbers,
 * which naturally satisfy HNSW's requirement that ef_construction > m
 * and that ef_search < ef_construction.
 *
 * small:  fib(7)=13, fib(9)=34, fib(8)=21   — replaces {16, 64, 40}
 * medium: fib(8)=21, fib(11)=89, fib(10)=55  — replaces {16, 128, 80}
 * large:  fib(8)=21, fib(12)=144, fib(11)=89 — replaces {32, 200, 100}
 * xlarge: unchanged (no phi mapping specified)
 */
const HNSW_PARAMS = {
  /** small: m=fib(7)=13, ef_construction=fib(9)=34, ef_search=fib(8)=21  — <100K */
  small:  { m: fib(7),  ef_construction: fib(9),  ef_search: fib(8)  },
  /** medium: m=fib(8)=21, ef_construction=fib(11)=89, ef_search=fib(10)=55 — 100K–1M */
  medium: { m: fib(8),  ef_construction: fib(11), ef_search: fib(10) },
  /** large: m=fib(8)=21, ef_construction=fib(12)=144, ef_search=fib(11)=89 — 1M–10M */
  large:  { m: fib(8),  ef_construction: fib(12), ef_search: fib(11) },
  xlarge: { m: 32, ef_construction: 256, ef_search: 150 },  // >10M
};

/**
 * Slow query threshold in milliseconds.
 * Math.round(1000 * PSI) ≈ 618ms — phi-derived boundary replacing 500ms.
 * PSI = 1/φ ≈ 0.618; 618ms is the golden-ratio fraction of one second.
 */
const SLOW_QUERY_THRESHOLD_MS = Math.round(1000 * PSI);  // ≈ 618ms

/**
 * Index bloat threshold (fragmentation ratio).
 * Math.pow(PSI, 2) ≈ 0.382 — phi-derived, replaces arbitrary 0.3.
 * PSI^2 = 1 - PSI is the minor segment of the golden ratio split.
 */
const BLOAT_THRESHOLD = Math.pow(PSI, 2);  // ≈ 0.382

/**
 * Dead tuple ratio threshold for autovacuum trigger.
 * Math.pow(PSI, 4) ≈ 0.146 — phi-derived, replaces arbitrary 0.1.
 * PSI^4 is the 4th-level phi-harmonic threshold.
 */
const DEAD_TUPLE_RATIO = Math.pow(PSI, 4);  // ≈ 0.146

/**
 * Memory pressure threshold: fraction of shared_buffers considered high.
 * CSL_THRESHOLDS.HIGH ≈ 0.882 — phi-harmonic level-3 threshold, replaces 0.85.
 * Derived as phiThreshold(3) = 1 - PSI^3 * 0.5.
 */
const MEMORY_PRESSURE_THRESHOLD = CSL_THRESHOLDS.HIGH;  // ≈ 0.882

/**
 * Default monitoring interval in milliseconds.
 * fib(16) * 1000 / fib(10) = 987000 / 55 ≈ 17945ms ≈ 18 seconds.
 * Alternatively expressed as a phi-harmonic starting interval that
 * the phiAdaptiveInterval() function will grow/shrink based on system health.
 * Using 60000ms / PHI^2 ≈ 22918ms as a round Fibonacci-compatible base.
 * Simplified to: fib(16) * 1000 / fib(10) = 17945ms ≈ 18s.
 */
const DEFAULT_MONITOR_INTERVAL_MS = Math.round(fib(16) * 1000 / fib(10));  // ≈ 17945ms

// ─── Main Class ───────────────────────────────────────────────────────────────

/**
 * VectorMemoryOptimizer — Automated advisor and monitor for pgvector stores.
 */
export class VectorMemoryOptimizer extends EventEmitter {
  /**
   * @param {import('pg').Pool} pool — PostgreSQL connection pool
   * @param {object} [options]
   * @param {number} [options.monitorIntervalMs] — Stats poll interval (default: fib(16)*1000/fib(10) ≈ 17945ms)
   * @param {string} [options.schemaName='public']     — Schema to monitor
   * @param {string[]} [options.vectorTables]          — Tables to watch
   * @param {object}  [options.logger=console]
   */
  constructor(pool, options = {}) {
    super();
    this.pool             = pool;
    this.schema           = options.schemaName      ?? 'public';
    this.vectorTables     = options.vectorTables    ?? ['vector_memories'];
    this.monitorIntervalMs = options.monitorIntervalMs ?? DEFAULT_MONITOR_INTERVAL_MS;
    this.logger           = options.logger          ?? console;

    this._timer          = null;
    this._running        = false;
    this._history        = [];          // Circular buffer of metric snapshots
    /**
     * fib(17) = 1597 — Fibonacci-scaled history depth, replaces 1440.
     * With the new ~18s default interval, 1597 snapshots ≈ 8 hours of history.
     */
    this._maxHistory     = fib(17);     // 1597 — replaces 1440
    this._slowQueries    = [];
    this._recommendations = [];

    // Stats
    this._stats = {
      snapshots:       0,
      slowQueriesFound: 0,
      recommendations: 0,
      vacuumsTriggered: 0,
    };
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  /**
   * Start periodic monitoring.
   * @returns {Promise<void>}
   */
  async start() {
    if (this._running) return;
    this._running = true;
    this.logger.info('[VectorOptimizer] Starting monitoring...');

    // Run immediately, then on interval
    await this._runMonitoringCycle().catch(err =>
      this.logger.error('[VectorOptimizer] Initial monitoring cycle failed:', err.message)
    );

    this._timer = setInterval(async () => {
      if (!this._running) return;
      await this._runMonitoringCycle().catch(err =>
        this.logger.error('[VectorOptimizer] Monitoring cycle failed:', err.message)
      );
    }, this.monitorIntervalMs);

    this.emit('started');
  }

  /**
   * Stop periodic monitoring.
   */
  stop() {
    this._running = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this.logger.info('[VectorOptimizer] Monitoring stopped');
    this.emit('stopped');
  }

  // ─── Monitoring Cycle ────────────────────────────────────────────────────────

  /**
   * @private Run one complete monitoring cycle.
   */
  async _runMonitoringCycle() {
    const snapshot = {
      timestamp: new Date().toISOString(),
      tables:    {},
      indexes:   {},
      memory:    {},
      slowQueries: [],
    };

    try {
      // Parallel collection of stats
      const [tableStats, indexStats, memStats, slowQueries] = await Promise.allSettled([
        this._collectTableStats(),
        this._collectIndexStats(),
        this._collectMemoryStats(),
        this._collectSlowQueries(),
      ]);

      if (tableStats.status === 'fulfilled')  snapshot.tables     = tableStats.value;
      if (indexStats.status === 'fulfilled')  snapshot.indexes    = indexStats.value;
      if (memStats.status === 'fulfilled')    snapshot.memory     = memStats.value;
      if (slowQueries.status === 'fulfilled') snapshot.slowQueries = slowQueries.value;

      // Update circular history buffer
      this._history.push(snapshot);
      if (this._history.length > this._maxHistory) this._history.shift();

      // Check thresholds and generate alerts
      await this._checkThresholds(snapshot);

      this._stats.snapshots++;
      this.emit('snapshot', snapshot);

    } catch (err) {
      this.logger.error('[VectorOptimizer] Snapshot collection error:', err.message);
    }
  }

  // ─── Stats Collection ────────────────────────────────────────────────────────

  /**
   * @private Collect per-table statistics including row counts and dead tuple ratios.
   */
  async _collectTableStats() {
    const placeholders = this.vectorTables.map((_, i) => `$${i + 2}`).join(',');
    const result = await this.pool.query(`
      SELECT
        schemaname,
        relname                                         AS table_name,
        n_live_tup                                      AS live_tuples,
        n_dead_tup                                      AS dead_tuples,
        CASE WHEN n_live_tup > 0
             THEN ROUND(n_dead_tup::numeric / n_live_tup, 4)
             ELSE 0
        END                                             AS dead_tuple_ratio,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        pg_size_pretty(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname)))
                                                        AS total_size,
        pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname))
                                                        AS total_size_bytes
      FROM pg_stat_user_tables
      WHERE schemaname = $1
        AND relname = ANY(ARRAY[${placeholders}])
      ORDER BY total_size_bytes DESC
    `, [this.schema, ...this.vectorTables]);

    return result.rows;
  }

  /**
   * @private Collect index statistics: size, usage, fragmentation.
   */
  async _collectIndexStats() {
    const result = await this.pool.query(`
      SELECT
        ix.schemaname,
        ix.tablename,
        ix.indexname,
        ix.indexdef,
        ix.idx_scan                                       AS scans,
        ix.idx_tup_read                                   AS tuples_read,
        ix.idx_tup_fetch                                  AS tuples_fetched,
        pg_size_pretty(pg_relation_size(quote_ident(ix.schemaname) || '.' || quote_ident(ix.indexname)))
                                                          AS index_size,
        pg_relation_size(quote_ident(ix.schemaname) || '.' || quote_ident(ix.indexname))
                                                          AS index_size_bytes,
        CASE
          WHEN ix.idx_scan = 0 THEN 'unused'
          WHEN ix.idx_scan < 100 THEN 'low_usage'
          ELSE 'active'
        END                                               AS usage_status,
        -- Estimate fragmentation from bloat (approximation via heap pages vs index pages)
        ROUND(
          GREATEST(0,
            1.0 - (ix.idx_tup_read::float + 1) /
                  (GREATEST(ix.idx_tup_fetch, ix.idx_tup_read, 1)::float)
          ), 4
        )                                                 AS fragmentation_estimate
      FROM pg_stat_user_indexes ix
      WHERE ix.schemaname = $1
        AND ix.tablename = ANY($2)
      ORDER BY index_size_bytes DESC
    `, [this.schema, this.vectorTables]);

    return result.rows;
  }

  /**
   * @private Collect PostgreSQL memory and buffer stats.
   */
  async _collectMemoryStats() {
    try {
      // pg_buffercache extension needed for detailed buffer stats
      // Fall back to pg_stat_bgwriter if not available
      const bgResult = await this.pool.query(`
        SELECT
          checkpoints_timed,
          checkpoints_req,
          buffers_checkpoint,
          buffers_clean,
          buffers_backend,
          buffers_alloc,
          maxwritten_clean
        FROM pg_stat_bgwriter
      `);

      const settingsResult = await this.pool.query(`
        SELECT name, setting, unit
        FROM pg_settings
        WHERE name IN (
          'shared_buffers', 'work_mem', 'effective_cache_size',
          'maintenance_work_mem', 'max_parallel_maintenance_workers'
        )
      `);

      return {
        bgwriter:  bgResult.rows[0] ?? {},
        settings:  Object.fromEntries(
          settingsResult.rows.map(r => [r.name, { setting: r.setting, unit: r.unit }])
        ),
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  /**
   * @private Collect slow queries from pg_stat_statements if available.
   * Focuses on vector similarity queries (containing <=> or <~> operators).
   */
  async _collectSlowQueries() {
    try {
      const result = await this.pool.query(`
        SELECT
          query,
          calls,
          mean_exec_time,
          max_exec_time,
          total_exec_time,
          rows,
          ROUND((mean_exec_time)::numeric, 2)  AS mean_ms,
          ROUND((max_exec_time)::numeric, 2)   AS max_ms
        FROM pg_stat_statements
        WHERE
          (query ILIKE '%<=>%' OR query ILIKE '%<~>%' OR query ILIKE '%<%%>%'
           OR query ILIKE '%vector%' OR query ILIKE '%halfvec%')
          AND mean_exec_time > $1
          AND query NOT ILIKE '%pg_stat_statements%'
        ORDER BY mean_exec_time DESC
        LIMIT 20
      `, [SLOW_QUERY_THRESHOLD_MS]);

      if (result.rows.length > 0) {
        this._stats.slowQueriesFound += result.rows.length;
        this._slowQueries = result.rows;
        this.emit('slow:queries', result.rows);
      }

      return result.rows;
    } catch (err) {
      // pg_stat_statements not installed — graceful degradation
      if (err.message.includes('does not exist')) {
        return [];
      }
      throw err;
    }
  }

  // ─── Threshold Checking ──────────────────────────────────────────────────────

  /**
   * @private Check snapshot metrics against thresholds and emit alerts.
   */
  async _checkThresholds(snapshot) {
    const newRecs = [];

    // Check dead tuple ratios
    for (const table of (snapshot.tables ?? [])) {
      if (parseFloat(table.dead_tuple_ratio) > DEAD_TUPLE_RATIO) {
        const rec = {
          type:     'autovacuum',
          table:    table.table_name,
          severity: 'warning',
          message:  `Table ${table.table_name} has ${(table.dead_tuple_ratio * 100).toFixed(1)}% dead tuples (>${DEAD_TUPLE_RATIO * 100}% threshold). Run VACUUM ANALYZE.`,
          action:   `VACUUM ANALYZE ${this.schema}.${table.table_name};`,
          timestamp: new Date().toISOString(),
        };
        newRecs.push(rec);
        this.emit('alert:dead_tuples', rec);
      }
    }

    // Check for unused indexes
    for (const idx of (snapshot.indexes ?? [])) {
      if (idx.usage_status === 'unused' && idx.index_size_bytes > 1024 * 1024 * 10) {
        const rec = {
          type:     'unused_index',
          index:    idx.indexname,
          table:    idx.tablename,
          severity: 'info',
          message:  `Index ${idx.indexname} (${idx.index_size}) has 0 scans. Consider dropping if not needed for constraint enforcement.`,
          action:   `DROP INDEX CONCURRENTLY ${idx.schemaname}.${idx.indexname};`,
          timestamp: new Date().toISOString(),
        };
        newRecs.push(rec);
        this.emit('alert:unused_index', rec);
      }
    }

    // Check slow queries
    for (const query of (snapshot.slowQueries ?? [])) {
      if (query.mean_ms > SLOW_QUERY_THRESHOLD_MS * 5) {  // 5× threshold = critical
        this.emit('alert:critical_slow_query', {
          type:     'critical_slow_query',
          severity: 'critical',
          query:    query.query.slice(0, 300),
          meanMs:   query.mean_ms,
          maxMs:    query.max_ms,
          calls:    query.calls,
        });
      }
    }

    this._recommendations.push(...newRecs);
    if (newRecs.length > 0) {
      this._stats.recommendations += newRecs.length;
    }

    // Keep recommendation history bounded
    if (this._recommendations.length > 500) {
      this._recommendations = this._recommendations.slice(-500);
    }
  }

  // ─── Public Advisors ─────────────────────────────────────────────────────────

  /**
   * Get index type recommendation for a vector table.
   * Based on pgvector research: HNSW vs IVFFlat vs brute-force decision matrix.
   *
   * @param {string} tableName — Table to analyze
   * @param {string} [columnName='embedding'] — Vector column name
   * @returns {Promise<IndexRecommendation>}
   */
  async getIndexRecommendation(tableName, columnName = 'embedding') {
    const countResult = await this.pool.query(
      `SELECT COUNT(*) AS count FROM ${this.schema}.${tableName}`,
      []
    );
    const vectorCount = parseInt(countResult.rows[0].count, 10);

    // Detect current index type
    const indexResult = await this.pool.query(`
      SELECT
        indexname,
        indexdef,
        pg_relation_size(quote_ident($1) || '.' || quote_ident(indexname))
          AS index_size_bytes
      FROM pg_indexes
      WHERE schemaname = $1 AND tablename = $2
        AND (indexdef ILIKE '%hnsw%' OR indexdef ILIKE '%ivfflat%' OR indexdef ILIKE '%halfvec%')
    `, [this.schema, tableName]);

    const currentIndexes = indexResult.rows;
    const hasHNSW   = currentIndexes.some(i => i.indexdef.includes('hnsw'));
    const hasHalfvec = currentIndexes.some(i => i.indexdef.includes('halfvec'));
    const hasBinary  = currentIndexes.some(i => i.indexdef.includes('binary_quantize'));

    let recommendation, reason, hnswParams, priority;

    if (vectorCount < THRESHOLDS.bruteForce) {
      recommendation = 'brute_force';
      reason  = `${vectorCount.toLocaleString()} vectors is below ${THRESHOLDS.bruteForce.toLocaleString()} — sequential scan is acceptable (<50ms expected).`;
      priority = 'low';
    } else if (vectorCount < THRESHOLDS.hnswPreferred) {
      recommendation = 'hnsw_small';
      reason  = `${vectorCount.toLocaleString()} vectors — HNSW starts showing advantage over brute-force here.`;
      hnswParams = HNSW_PARAMS.small;
      priority = 'medium';
    } else if (vectorCount < THRESHOLDS.hnswRequired) {
      recommendation = 'hnsw_medium';
      reason  = `${vectorCount.toLocaleString()} vectors — HNSW delivers 15–30× better QPS than IVFFlat at equal recall.`;
      hnswParams = HNSW_PARAMS.medium;
      priority = 'high';
    } else if (vectorCount < THRESHOLDS.quantization) {
      recommendation = 'hnsw_large';
      reason  = `${vectorCount.toLocaleString()} vectors — HNSW required; add halfvec quantization for 50% memory savings.`;
      hnswParams = HNSW_PARAMS.large;
      priority = 'high';
    } else if (vectorCount < THRESHOLDS.binary) {
      recommendation = 'hnsw_with_halfvec';
      reason  = `${vectorCount.toLocaleString()} vectors — Use HNSW on halfvec (scalar quantized) for 50% memory savings, near-zero recall loss.`;
      hnswParams = HNSW_PARAMS.xlarge;
      priority = 'critical';
    } else if (vectorCount < THRESHOLDS.pgvectorscale) {
      recommendation = 'hnsw_with_binary';
      reason  = `${vectorCount.toLocaleString()} vectors — Use binary quantization for fast pre-filter; re-rank on original floats. Consider pgvectorscale.`;
      hnswParams = HNSW_PARAMS.xlarge;
      priority = 'critical';
    } else {
      recommendation = 'pgvectorscale_or_dedicated';
      reason  = `${vectorCount.toLocaleString()} vectors exceeds pgvector sweet spot. pgvectorscale (StreamingDiskANN) achieves 471 QPS at 99% recall at 50M vectors.`;
      priority = 'critical';
    }

    const actions = this._buildIndexActions(tableName, columnName, recommendation, hnswParams);

    return {
      tableName,
      columnName,
      vectorCount,
      recommendation,
      reason,
      priority,
      actions,
      currentState: {
        hasHNSW,
        hasHalfvec,
        hasBinary,
        indexCount: currentIndexes.length,
        indexes:    currentIndexes,
      },
      hnswParams,
    };
  }

  /**
   * @private Build SQL action statements for the recommendation.
   */
  _buildIndexActions(tableName, columnName, recommendation, hnswParams) {
    const actions = [];
    const fqTable = `${this.schema}.${tableName}`;

    switch (recommendation) {
      case 'hnsw_small':
        actions.push(`SET max_parallel_maintenance_workers = 4;`);
        actions.push(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${tableName}_hnsw_cosine
  ON ${fqTable} USING hnsw (${columnName} vector_cosine_ops)
  WITH (m = ${hnswParams.m}, ef_construction = ${hnswParams.ef_construction});`);
        break;

      case 'hnsw_medium':
      case 'hnsw_large':
        actions.push(`SET max_parallel_maintenance_workers = 8;`);
        actions.push(`SET maintenance_work_mem = '2GB';`);
        actions.push(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${tableName}_hnsw_cosine
  ON ${fqTable} USING hnsw (${columnName} vector_cosine_ops)
  WITH (m = ${hnswParams.m}, ef_construction = ${hnswParams.ef_construction});`);
        actions.push(`SET hnsw.ef_search = ${hnswParams.ef_search};`);
        actions.push(`SET hnsw.iterative_scan = 'relaxed_order';`);
        break;

      case 'hnsw_with_halfvec':
        actions.push(`SET max_parallel_maintenance_workers = 8;`);
        actions.push(`SET maintenance_work_mem = '4GB';`);
        actions.push(`-- Add halfvec column (50% storage reduction)`);
        actions.push(`ALTER TABLE ${fqTable} ADD COLUMN IF NOT EXISTS embedding_half halfvec(384);`);
        actions.push(`UPDATE ${fqTable} SET embedding_half = ${columnName}::halfvec(384);`);
        actions.push(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${tableName}_hnsw_halfvec
  ON ${fqTable} USING hnsw (embedding_half halfvec_cosine_ops)
  WITH (m = ${hnswParams.m}, ef_construction = ${hnswParams.ef_construction});`);
        break;

      case 'hnsw_with_binary':
        actions.push(`-- Binary quantization HNSW (96.9% storage reduction) + re-rank`);
        actions.push(`ALTER TABLE ${fqTable} ADD COLUMN IF NOT EXISTS embedding_binary bit(384);`);
        actions.push(`UPDATE ${fqTable} SET embedding_binary = binary_quantize(${columnName})::bit(384);`);
        actions.push(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${tableName}_hnsw_binary
  ON ${fqTable} USING hnsw (embedding_binary bit_hamming_ops)
  WITH (m = ${hnswParams.m}, ef_construction = ${hnswParams.ef_construction});`);
        actions.push(`-- Example re-ranking query:
-- WITH candidates AS (
--   SELECT id FROM ${fqTable}
--   ORDER BY embedding_binary <~> binary_quantize($1)::bit(384) LIMIT 40
-- )
-- SELECT * FROM ${fqTable} WHERE id IN (SELECT id FROM candidates)
-- ORDER BY ${columnName} <=> $1 LIMIT 10;`);
        break;

      default:
        actions.push(`-- Evaluate pgvectorscale StreamingDiskANN for >50M vectors`);
        actions.push(`-- CREATE EXTENSION IF NOT EXISTS vectorscale;`);
    }

    return actions;
  }

  /**
   * Get quantization recommendation based on collection size and memory constraints.
   *
   * @param {string} tableName
   * @param {object} [options]
   * @param {number} [options.availableRamGB] — Available RAM for index
   * @param {number} [options.dimensions=384] — Vector dimensions
   * @returns {Promise<QuantizationRecommendation>}
   */
  async getQuantizationAdvice(tableName, options = {}) {
    const dims = options.dimensions ?? 384;

    const countResult = await this.pool.query(
      `SELECT COUNT(*) AS count, pg_total_relation_size($1) AS table_bytes
       FROM ${this.schema}.${tableName}`,
      [`${this.schema}.${tableName}`]
    );

    const vectorCount = parseInt(countResult.rows[0].count, 10);
    const tableSizeGB = countResult.rows[0].table_bytes / (1024 ** 3);

    // Memory estimates (from research §1.4):
    // HNSW float32 at m=32: ~192 bytes/vec + raw float
    // HNSW halfvec at m=32: ~96 bytes/vec + compressed
    // Binary quantize: 1 bit/dim
    const float32IndexGB = (vectorCount * (dims * 4 + 192)) / (1024 ** 3);
    const halfvecIndexGB = (vectorCount * (dims * 2 + 96))  / (1024 ** 3);
    const binaryIndexGB  = (vectorCount * (dims / 8 + 32))  / (1024 ** 3);

    const availableRAM = options.availableRamGB ?? 16;
    let recommendation, rationale;

    if (float32IndexGB <= availableRAM * 0.6) {
      recommendation = 'float32';
      rationale      = `Full float32 HNSW fits in ${float32IndexGB.toFixed(2)} GiB RAM. Maximum recall accuracy.`;
    } else if (halfvecIndexGB <= availableRAM * 0.6) {
      recommendation = 'halfvec';
      rationale      = `halfvec (scalar quantization) reduces index to ${halfvecIndexGB.toFixed(2)} GiB (${Math.round((1 - halfvecIndexGB / float32IndexGB) * 100)}% savings) with near-zero recall impact.`;
    } else if (binaryIndexGB <= availableRAM * 0.6) {
      recommendation = 'binary_with_rerank';
      rationale      = `Binary quantization reduces index to ${binaryIndexGB.toFixed(2)} GiB. Must use re-ranking (4× oversample) to recover recall.`;
    } else {
      recommendation = 'pgvectorscale';
      rationale      = `Collection (${vectorCount.toLocaleString()} × ${dims}d) requires ${float32IndexGB.toFixed(1)} GiB for float32 HNSW — exceeds available RAM. Use pgvectorscale StreamingDiskANN (disk-resident) or shard the collection.`;
    }

    return {
      tableName,
      vectorCount,
      dimensions:    dims,
      tableSizeGB:   parseFloat(tableSizeGB.toFixed(2)),
      estimates: {
        float32IndexGB: parseFloat(float32IndexGB.toFixed(2)),
        halfvecIndexGB: parseFloat(halfvecIndexGB.toFixed(2)),
        binaryIndexGB:  parseFloat(binaryIndexGB.toFixed(2)),
      },
      recommendation,
      rationale,
      memorySavings: {
        halfvec: `${Math.round((1 - halfvecIndexGB / float32IndexGB) * 100)}%`,
        binary:  `${Math.round((1 - binaryIndexGB  / float32IndexGB) * 100)}%`,
      },
    };
  }

  /**
   * Check index health — fragmentation, age, stale statistics.
   *
   * @param {string} tableName
   * @returns {Promise<IndexHealthReport>}
   */
  async checkIndexHealth(tableName) {
    const issues  = [];
    const healthy = [];

    // Check index bloat via pgstattuple if available
    let bloatInfo;
    try {
      const bloatResult = await this.pool.query(`
        SELECT
          i.relname         AS index_name,
          s.avg_leaf_density,
          s.dead_leaf_pages,
          s.empty_leaf_pages,
          s.internal_pages,
          s.leaf_pages,
          CASE
            WHEN s.leaf_pages > 0
            THEN ROUND((s.dead_leaf_pages::numeric / s.leaf_pages) * 100, 2)
            ELSE 0
          END               AS dead_leaf_pct
        FROM pg_indexes idx
        JOIN pg_class i    ON i.relname = idx.indexname
        JOIN pg_namespace n ON n.nspname = idx.schemaname AND n.oid = i.relnamespace,
        LATERAL pgstattuple(i.oid) s
        WHERE idx.schemaname = $1 AND idx.tablename = $2
      `, [this.schema, tableName]);
      bloatInfo = bloatResult.rows;
    } catch {
      bloatInfo = [];  // pgstattuple not available
    }

    // Check index scan activity
    const scanResult = await this.pool.query(`
      SELECT
        indexrelname                              AS index_name,
        idx_scan                                  AS scans,
        idx_tup_read                              AS tuples_read,
        idx_blks_read                             AS blocks_read_from_disk,
        idx_blks_hit                              AS blocks_from_cache,
        ROUND(
          CASE WHEN (idx_blks_read + idx_blks_hit) > 0
               THEN idx_blks_hit::numeric / (idx_blks_read + idx_blks_hit) * 100
               ELSE 100
          END, 2
        )                                         AS cache_hit_pct
      FROM pg_stat_user_indexes
      WHERE schemaname = $1 AND relname = $2
    `, [this.schema, tableName]);

    for (const idx of scanResult.rows) {
      if (idx.cache_hit_pct < 80) {
        issues.push({
          index:    idx.index_name,
          severity: 'warning',
          type:     'low_cache_hit',
          message:  `Index ${idx.index_name} has ${idx.cache_hit_pct}% cache hit rate (<80%). Consider increasing shared_buffers or effective_cache_size.`,
        });
      } else {
        healthy.push({ index: idx.index_name, type: 'cache_hit', value: idx.cache_hit_pct });
      }

      if (idx.scans === 0) {
        issues.push({
          index:    idx.index_name,
          severity: 'info',
          type:     'unused',
          message:  `Index ${idx.index_name} has 0 scans. Safe to drop if not used for constraint enforcement.`,
        });
      }
    }

    for (const bloat of bloatInfo) {
      if (bloat.dead_leaf_pct > BLOAT_THRESHOLD * 100) {
        issues.push({
          index:    bloat.index_name,
          severity: 'warning',
          type:     'bloat',
          message:  `Index ${bloat.index_name} has ${bloat.dead_leaf_pct}% dead leaf pages. REINDEX CONCURRENTLY recommended.`,
          action:   `REINDEX INDEX CONCURRENTLY ${this.schema}.${bloat.index_name};`,
        });
      }
    }

    // Check table's last vacuum/analyze
    const vacuumResult = await this.pool.query(`
      SELECT
        last_vacuum,
        last_autovacuum,
        last_analyze,
        n_dead_tup,
        n_live_tup
      FROM pg_stat_user_tables
      WHERE schemaname = $1 AND relname = $2
    `, [this.schema, tableName]);

    if (vacuumResult.rows.length > 0) {
      const row = vacuumResult.rows[0];
      const lastVacuum = row.last_autovacuum ?? row.last_vacuum;
      if (lastVacuum) {
        const hoursSinceVacuum = (Date.now() - new Date(lastVacuum).getTime()) / 3_600_000;
        if (hoursSinceVacuum > 24) {
          issues.push({
            type:     'stale_vacuum',
            severity: 'info',
            message:  `Table ${tableName} last vacuumed ${hoursSinceVacuum.toFixed(0)} hours ago. Schedule VACUUM ANALYZE.`,
            action:   `VACUUM ANALYZE ${this.schema}.${tableName};`,
          });
        }
      }
    }

    return {
      tableName,
      timestamp:  new Date().toISOString(),
      healthy,
      issues,
      status: issues.some(i => i.severity === 'critical') ? 'critical'
            : issues.some(i => i.severity === 'warning')  ? 'warning'
            : 'healthy',
    };
  }

  /**
   * Detect memory pressure and suggest configuration changes.
   *
   * @returns {Promise<MemoryPressureReport>}
   */
  async detectMemoryPressure() {
    const result = await this.pool.query(`
      SELECT
        setting AS shared_buffers_pages,
        setting::bigint * 8192 / 1024 / 1024 / 1024 AS shared_buffers_gb
      FROM pg_settings WHERE name = 'shared_buffers'
    `);

    const bgWriter = await this.pool.query(`
      SELECT
        buffers_alloc,
        buffers_clean,
        buffers_checkpoint,
        maxwritten_clean
      FROM pg_stat_bgwriter
    `);

    const bw = bgWriter.rows[0];
    const sharedBuffersGB = parseFloat(result.rows[0]?.shared_buffers_gb ?? 0);

    const suggestions = [];

    // High maxwritten_clean indicates memory pressure (bgwriter can't keep up)
    if (bw?.maxwritten_clean > 0) {
      suggestions.push({
        setting: 'bgwriter_lru_maxpages',
        current: null,
        suggested: '200',
        reason: `maxwritten_clean=${bw.maxwritten_clean} indicates bgwriter is throttled by lru_maxpages. Increasing allows more buffers to be cleaned per cycle.`,
      });
    }

    // Low shared_buffers for vector workloads
    if (sharedBuffersGB < 4) {
      suggestions.push({
        setting: 'shared_buffers',
        current: `${sharedBuffersGB.toFixed(1)}GB`,
        suggested: '8GB',
        reason: 'Vector workloads benefit from large shared_buffers to keep HNSW graph pages in memory. Recommend 25% of total RAM.',
      });
    }

    const pressure = bw?.maxwritten_clean > 10
      ? 'high'
      : bw?.maxwritten_clean > 0 ? 'moderate' : 'low';

    return {
      pressure,
      sharedBuffersGB,
      bgWriterStats: bw,
      suggestions,
    };
  }

  /**
   * Get all pending recommendations.
   * @returns {Recommendation[]}
   */
  getRecommendations() {
    return [...this._recommendations];
  }

  /**
   * Get recent slow queries.
   * @returns {SlowQuery[]}
   */
  getSlowQueries() {
    return [...this._slowQueries];
  }

  /**
   * Get monitoring stats.
   * @returns {object}
   */
  getStats() {
    return {
      ...this._stats,
      historyDepth:   this._history.length,
      running:        this._running,
      pendingAlerts:  this._recommendations.filter(r => r.severity !== 'info').length,
    };
  }

  /**
   * Get the last N monitoring snapshots.
   * @param {number} [n=10]
   * @returns {object[]}
   */
  getHistory(n = 10) {
    return this._history.slice(-n);
  }

  /**
   * Auto-schedule VACUUM ANALYZE for tables with high dead tuple ratios.
   * Requires SUPERUSER or appropriate VACUUM privilege.
   *
   * @param {object} [options]
   * @param {number} [options.deadTupleThreshold=0.1]
   * @param {boolean} [options.dryRun=false]
   * @returns {Promise<{vacuumed: string[], skipped: string[]}>}
   */
  async autoVacuumScheduler(options = {}) {
    const threshold = options.deadTupleThreshold ?? DEAD_TUPLE_RATIO;
    const dryRun    = options.dryRun ?? false;

    const tableStats = await this._collectTableStats();
    const vacuumed   = [];
    const skipped    = [];

    for (const table of tableStats) {
      if (parseFloat(table.dead_tuple_ratio) > threshold) {
        if (!dryRun) {
          try {
            await this.pool.query(`VACUUM ANALYZE ${this.schema}.${table.table_name}`);
            vacuumed.push(table.table_name);
            this._stats.vacuumsTriggered++;
            this.logger.info(`[VectorOptimizer] VACUUM ANALYZE completed for ${table.table_name}`);
          } catch (err) {
            this.logger.error(`[VectorOptimizer] VACUUM failed for ${table.table_name}:`, err.message);
          }
        } else {
          vacuumed.push(table.table_name);
          this.logger.info(`[VectorOptimizer] DRY RUN: Would VACUUM ANALYZE ${table.table_name} (dead_tuple_ratio=${table.dead_tuple_ratio})`);
        }
      } else {
        skipped.push(table.table_name);
      }
    }

    return { vacuumed, skipped };
  }

  /**
   * Generate a full optimization report for all monitored tables.
   * @returns {Promise<OptimizationReport>}
   */
  async generateReport() {
    const report = {
      timestamp:       new Date().toISOString(),
      tables:          {},
      memoryPressure:  null,
      recommendations: [],
      slowQueries:     this._slowQueries.slice(0, 10),
    };

    // Parallel analysis
    const [memPressure, ...tableAnalyses] = await Promise.allSettled([
      this.detectMemoryPressure(),
      ...this.vectorTables.map(t => Promise.all([
        this.getIndexRecommendation(t),
        this.getQuantizationAdvice(t),
        this.checkIndexHealth(t),
      ])),
    ]);

    if (memPressure.status === 'fulfilled') {
      report.memoryPressure = memPressure.value;
    }

    for (let i = 0; i < this.vectorTables.length; i++) {
      const analysis = tableAnalyses[i];
      if (analysis.status === 'fulfilled') {
        const [indexRec, quantRec, healthRep] = analysis.value;
        report.tables[this.vectorTables[i]] = {
          indexRecommendation:       indexRec,
          quantizationRecommendation: quantRec,
          healthReport:              healthRep,
        };
        report.recommendations.push(...(healthRep.issues ?? []));
      }
    }

    return report;
  }
}

// ─── Type Definitions ─────────────────────────────────────────────────────────

/**
 * @typedef {object} IndexRecommendation
 * @property {string}   tableName
 * @property {string}   columnName
 * @property {number}   vectorCount
 * @property {string}   recommendation — 'brute_force'|'hnsw_small'|'hnsw_medium'|'hnsw_large'|'hnsw_with_halfvec'|'hnsw_with_binary'|'pgvectorscale_or_dedicated'
 * @property {string}   reason
 * @property {string}   priority — 'low'|'medium'|'high'|'critical'
 * @property {string[]} actions — SQL statements to implement
 * @property {object}   currentState
 * @property {object}   [hnswParams]
 */

/**
 * @typedef {object} QuantizationRecommendation
 * @property {string}   tableName
 * @property {number}   vectorCount
 * @property {number}   dimensions
 * @property {number}   tableSizeGB
 * @property {object}   estimates
 * @property {string}   recommendation — 'float32'|'halfvec'|'binary_with_rerank'|'pgvectorscale'
 * @property {string}   rationale
 * @property {object}   memorySavings
 */

/**
 * @typedef {object} IndexHealthReport
 * @property {string}   tableName
 * @property {string}   timestamp
 * @property {object[]} healthy
 * @property {object[]} issues
 * @property {string}   status — 'healthy'|'warning'|'critical'
 */

/**
 * @typedef {object} MemoryPressureReport
 * @property {string}   pressure — 'low'|'moderate'|'high'
 * @property {number}   sharedBuffersGB
 * @property {object}   bgWriterStats
 * @property {object[]} suggestions
 */
```
---

### `src/memory/shadow-memory-persistence.js`

```javascript
/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Shadow Memory Persistence — Exhale/Inhale Protocol
 * Patent Reference: HS-052
 * "Ephemeral Distributed State Persistence Using Vector-Embedded Memory
 *  Projections Across Autonomous Compute Nodes"
 *
 * Implements ALL 6 patent claims:
 *   Claim 1 — State as embeddings, projections, sync hashes, preservation,
 *              reconstitution via cosine similarity
 *   Claim 2 — Projection to external stores (git, KV, cloud)
 *   Claim 3 — ProjectionManager enforcing vector DB as canonical source
 *   Claim 4 — Fibonacci sharding across storage tiers
 *   Claim 5 — Cosine similarity K-nearest for reconstitution
 *   Claim 6 — Full system (ExhaleModule + InhaleModule + ProjectionManager +
 *              FibonacciShardManager)
 *
 * PHI = 1.6180339887 (golden ratio used in Fibonacci tier capacities)
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI = 1.6180339887;

/**
 * Fibonacci storage-tier capacities in GB derived from PHI sequence.
 * Tiers: hot (1 GB), warm (1 GB), cool (2 GB), cold (3 GB), archive (5 GB)
 * RTP: HS-052 Claim 4
 */
const FIBONACCI_TIER_CAPACITIES_GB = [1, 1, 2, 3, 5];

const STORAGE_TIERS = Object.freeze({
  HOT:     'hot',
  WARM:    'warm',
  COOL:    'cool',
  COLD:    'cold',
  ARCHIVE: 'archive',
});

const SYNC_STATUS = Object.freeze({
  SYNCED:  'synced',
  STALE:   'stale',
  UNKNOWN: 'unknown',
  ERROR:   'error',
});

const PROJECTION_TYPES = Object.freeze({
  GIT:   'git',
  KV:    'kv',
  CLOUD: 'cloud',
  LOCAL: 'local',
});

const DEFAULT_EMBEDDING_DIM   = 128;
const DEFAULT_DELTA_THRESHOLD = 0.05; // minimum cosine distance to trigger exhale
const DEFAULT_K_NEAREST       = 5;    // K for K-nearest inhale query

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Compute SHA-256 hash of a value (serialized to JSON if object).
 * @param {*} value
 * @returns {string} hex digest
 */
function _sha256(value) {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Deterministic pseudo-embedding for any text or object.
 * In production this would call a real embedding model;
 * this implementation provides a reproducible 128-D unit vector derived
 * from djb2 hashing — sufficient for all cosine-similarity operations.
 *
 * @param {string|object} input
 * @param {number} [dim=DEFAULT_EMBEDDING_DIM]
 * @returns {Float32Array}
 */
function _generateEmbedding(input, dim = DEFAULT_EMBEDDING_DIM) {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  const vec  = new Float32Array(dim);
  let hash   = 5381;

  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  for (let i = 0; i < dim; i++) {
    hash    = ((hash << 5) + hash + i) >>> 0;
    vec[i]  = ((hash % 2000) - 1000) / 1000;
  }

  // L2 normalise to unit vector
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < dim; i++) vec[i] /= norm;

  return vec;
}

/**
 * Cosine similarity between two Float32Arrays.
 * Returns value in [-1, 1]; 1 = identical direction.
 * RTP: HS-052 Claim 5
 *
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @returns {number}
 */
function _cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Compute delta (L2 distance) between two embedding vectors.
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @returns {number}
 */
function _embeddingDelta(a, b) {
  let sum = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

// ─── VectorDatabase ───────────────────────────────────────────────────────────

/**
 * In-process vector database acting as the canonical state store.
 * Represents the persistent vector DB (e.g., pgvector) described in HS-052.
 * RTP: HS-052 Claim 1 — "storing system state as embedding vectors in a
 *                        persistent vector database"
 */
class VectorDatabase {
  constructor() {
    /** @type {Map<string, { id: string, embedding: Float32Array, payload: object, tier: string, accessCount: number, createdAt: number, lastAccessed: number }>} */
    this._store = new Map();
    this._totalAccessCount = 0;
  }

  /**
   * Upsert a state embedding into the canonical vector store.
   * @param {string} id       - Unique identifier for this state entry
   * @param {Float32Array} embedding
   * @param {object} payload  - Serializable state payload
   * @param {string} [tier=STORAGE_TIERS.HOT]
   * @returns {string} The entry id
   */
  upsert(id, embedding, payload, tier = STORAGE_TIERS.HOT) {
    this._store.set(id, {
      id,
      embedding,
      payload,
      tier,
      accessCount: 0,
      createdAt:   Date.now(),
      lastAccessed: Date.now(),
    });
    return id;
  }

  /**
   * Retrieve a single entry by id.
   * @param {string} id
   * @returns {object|null}
   */
  get(id) {
    const entry = this._store.get(id);
    if (!entry) return null;
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this._totalAccessCount++;
    return entry;
  }

  /**
   * K-Nearest Neighbour query using cosine similarity.
   * RTP: HS-052 Claim 5 — "cosine similarity to identify the K most
   *                         task-relevant embeddings"
   *
   * @param {Float32Array} queryEmbedding
   * @param {number} [k=DEFAULT_K_NEAREST]
   * @param {object} [filter] - Optional tier filter: { tier: STORAGE_TIERS.HOT }
   * @returns {Array<{ entry: object, similarity: number }>}
   */
  knn(queryEmbedding, k = DEFAULT_K_NEAREST, filter = {}) {
    const results = [];

    for (const [, entry] of this._store) {
      if (filter.tier && entry.tier !== filter.tier) continue;

      const similarity = _cosineSimilarity(queryEmbedding, entry.embedding);
      results.push({ entry, similarity });
    }

    results.sort((a, b) => b.similarity - a.similarity);
    const topK = results.slice(0, k);

    // Update access counts for returned entries
    for (const { entry } of topK) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
    }
    this._totalAccessCount += topK.length;

    return topK;
  }

  /**
   * Delete an entry from the vector store.
   * @param {string} id
   * @returns {boolean}
   */
  delete(id) {
    return this._store.delete(id);
  }

  /**
   * Return all entries (for shard manager).
   * @returns {Array<object>}
   */
  entries() {
    return Array.from(this._store.values());
  }

  /**
   * Total number of stored vectors.
   * @returns {number}
   */
  size() {
    return this._store.size;
  }

  /**
   * Return database statistics.
   * @returns {object}
   */
  stats() {
    const byTier = {};
    for (const entry of this._store.values()) {
      byTier[entry.tier] = (byTier[entry.tier] || 0) + 1;
    }
    return {
      totalEntries:      this._store.size,
      totalAccessCount:  this._totalAccessCount,
      byTier,
    };
  }
}

// ─── ExhaleModule ─────────────────────────────────────────────────────────────

/**
 * Exhale Module — projects state deltas from the canonical vector database
 * to registered external targets (git, KV, cloud, local).
 *
 * RTP: HS-052 Claim 1(b) — "projecting subsets of said vector state to one
 *                            or more compute nodes as derived projections"
 * RTP: HS-052 Claim 2     — "serializing state deltas and projecting them to
 *                            external state stores"
 */
class ExhaleModule {
  /**
   * @param {VectorDatabase} vectorDB       - Canonical vector store
   * @param {ProjectionManager} projMgr     - Projection manager reference
   * @param {object} [opts]
   * @param {number} [opts.deltaThreshold]  - Min delta magnitude to trigger exhale
   * @param {number} [opts.embeddingDim]    - Embedding dimensionality
   */
  constructor(vectorDB, projMgr, opts = {}) {
    this._vectorDB       = vectorDB;
    this._projMgr        = projMgr;
    this._deltaThreshold = opts.deltaThreshold !== undefined
      ? opts.deltaThreshold
      : DEFAULT_DELTA_THRESHOLD;
    this._embeddingDim   = opts.embeddingDim || DEFAULT_EMBEDDING_DIM;
    this._exhaleLog      = [];
    this._lastEmbeddings = new Map(); // id → last-exhaled embedding
  }

  /**
   * Exhale a state object — embed it, detect delta, and project to all
   * registered external targets if the delta exceeds the threshold.
   *
   * RTP: HS-052 Claim 1(b,c)
   *
   * @param {string} stateId      - Logical identifier for this state entry
   * @param {object} stateObject  - The state to persist
   * @param {object} [opts]
   * @param {boolean} [opts.force=false] - Bypass delta check and always exhale
   * @param {string}  [opts.tier]        - Storage tier override
   * @returns {{ id: string, hash: string, delta: number, projected: boolean, targets: Array }}
   */
  exhale(stateId, stateObject, opts = {}) {
    const { force = false, tier = STORAGE_TIERS.HOT } = opts;

    // 1. Generate embedding for this state
    const embedding = _generateEmbedding(stateObject, this._embeddingDim);

    // 2. Compute state hash for sync tracking
    //    RTP: HS-052 Claim 1(c) — "tracking synchronization status via state hashes"
    const stateHash = _sha256(stateObject);

    // 3. Compute delta vs last exhaled embedding (if any)
    const lastEmb = this._lastEmbeddings.get(stateId);
    const delta   = lastEmb ? _embeddingDelta(embedding, lastEmb) : Infinity;

    if (!force && delta < this._deltaThreshold) {
      return {
        id:        stateId,
        hash:      stateHash,
        delta,
        projected: false,
        reason:    'delta_below_threshold',
        targets:   [],
      };
    }

    // 4. Upsert into canonical vector DB
    this._vectorDB.upsert(stateId, embedding, stateObject, tier);
    this._lastEmbeddings.set(stateId, embedding);

    // 5. Project delta to all registered targets
    //    RTP: HS-052 Claim 2
    const projectionResults = this._projMgr.projectToAll(stateId, stateObject, stateHash);

    const logEntry = {
      stateId,
      stateHash,
      delta:     delta === Infinity ? null : +delta.toFixed(6),
      tier,
      projectedAt: Date.now(),
      targetsCount: projectionResults.length,
    };
    this._exhaleLog.push(logEntry);

    return {
      id:        stateId,
      hash:      stateHash,
      delta:     delta === Infinity ? null : +delta.toFixed(6),
      projected: true,
      tier,
      targets:   projectionResults,
    };
  }

  /**
   * Exhale multiple state entries in one pass.
   * @param {Array<{ stateId: string, stateObject: object, opts?: object }>} entries
   * @returns {Array<object>}
   */
  exhaleMany(entries) {
    return entries.map(({ stateId, stateObject, opts }) =>
      this.exhale(stateId, stateObject, opts)
    );
  }

  /**
   * Signal node destruction — ensure all dirty state is exhaled to vector DB
   * before the node goes down.
   *
   * RTP: HS-052 Claim 1(d) — "upon destruction of a compute node, preserving
   *                           state exclusively in said vector database"
   *
   * @param {string} nodeId         - Identifier of the node being destroyed
   * @param {Array<{ stateId: string, stateObject: object }>} pendingState
   * @returns {{ nodeId: string, preserved: number, drainedAt: number }}
   */
  drainOnDestruction(nodeId, pendingState = []) {
    let preserved = 0;
    for (const { stateId, stateObject } of pendingState) {
      this.exhale(stateId, stateObject, { force: true });
      preserved++;
    }
    return {
      nodeId,
      preserved,
      drainedAt: Date.now(),
    };
  }

  /**
   * Return the exhale log (last N entries).
   * @param {number} [limit=50]
   * @returns {Array<object>}
   */
  getLog(limit = 50) {
    return this._exhaleLog.slice(-limit);
  }
}

// ─── InhaleModule ─────────────────────────────────────────────────────────────

/**
 * Inhale Module — reconstitutes working state for a new compute node by
 * querying the canonical vector database using cosine similarity K-NN.
 *
 * RTP: HS-052 Claim 1(e) — "upon creation of a new compute node, reconstituting
 *                           working state by querying said vector database"
 * RTP: HS-052 Claim 5    — "uses cosine similarity to identify the K most
 *                           task-relevant embeddings"
 */
class InhaleModule {
  /**
   * @param {VectorDatabase} vectorDB
   * @param {object} [opts]
   * @param {number} [opts.kNearest]     - Default K for KNN queries
   * @param {number} [opts.embeddingDim]
   */
  constructor(vectorDB, opts = {}) {
    this._vectorDB     = vectorDB;
    this._kNearest     = opts.kNearest || DEFAULT_K_NEAREST;
    this._embeddingDim = opts.embeddingDim || DEFAULT_EMBEDDING_DIM;
    this._inhaleLog    = [];
  }

  /**
   * Reconstitute context for a new compute node from task description.
   * Uses cosine similarity KNN — does NOT require full state download.
   *
   * RTP: HS-052 Claim 5 — "enabling the new compute instance to become
   *                        operational without downloading full application state"
   *
   * @param {string} nodeId         - ID of the new compute node
   * @param {string} taskDescription - Natural language description of node's task
   * @param {object} [opts]
   * @param {number} [opts.k]          - K override
   * @param {string} [opts.tierFilter] - Only query specific storage tier
   * @returns {{ nodeId: string, context: Array<{ stateId: string, similarity: number, payload: object }>, reconstitutedAt: number }}
   */
  inhale(nodeId, taskDescription, opts = {}) {
    const k          = opts.k || this._kNearest;
    const tierFilter = opts.tierFilter ? { tier: opts.tierFilter } : {};

    // 1. Embed the task description
    const queryEmbedding = _generateEmbedding(taskDescription, this._embeddingDim);

    // 2. Query vector DB for K most relevant state entries
    //    RTP: HS-052 Claim 5
    const results = this._vectorDB.knn(queryEmbedding, k, tierFilter);

    // 3. Build reconstituted context
    const context = results.map(({ entry, similarity }) => ({
      stateId:    entry.id,
      similarity: +similarity.toFixed(6),
      payload:    entry.payload,
      tier:       entry.tier,
    }));

    const logEntry = {
      nodeId,
      taskDescription: taskDescription.slice(0, 120),
      k,
      entriesFound:  context.length,
      topSimilarity: context.length > 0 ? context[0].similarity : 0,
      reconstitutedAt: Date.now(),
    };
    this._inhaleLog.push(logEntry);

    return {
      nodeId,
      context,
      reconstitutedAt: Date.now(),
    };
  }

  /**
   * Inhale by providing a direct embedding instead of a text query.
   * Used when a node already has a partial embedding from a prior lifecycle.
   *
   * @param {string} nodeId
   * @param {Float32Array} embedding
   * @param {number} [k]
   * @returns {object}
   */
  inhaleByEmbedding(nodeId, embedding, k) {
    const kk      = k || this._kNearest;
    const results = this._vectorDB.knn(embedding, kk);
    const context = results.map(({ entry, similarity }) => ({
      stateId:    entry.id,
      similarity: +similarity.toFixed(6),
      payload:    entry.payload,
      tier:       entry.tier,
    }));

    return { nodeId, context, reconstitutedAt: Date.now() };
  }

  /**
   * Return the inhale log.
   * @param {number} [limit=50]
   * @returns {Array<object>}
   */
  getLog(limit = 50) {
    return this._inhaleLog.slice(-limit);
  }
}

// ─── ProjectionManager ────────────────────────────────────────────────────────

/**
 * Projection Manager — tracks registered external projection targets, their
 * sync status, and enforces the invariant that the persistent vector database
 * is always the canonical source of truth.
 *
 * RTP: HS-052 Claim 3 — "projection manager that enforces the invariant that
 *                        the persistent vector database is always the canonical
 *                        source of truth and all external state stores are
 *                        derived projections"
 */
class ProjectionManager {
  /**
   * @param {VectorDatabase} vectorDB - Canonical source of truth (read-only reference)
   */
  constructor(vectorDB) {
    this._vectorDB = vectorDB;
    /**
     * @type {Map<string, {
     *   id: string, type: string, config: object,
     *   lastSync: number|null, lastHash: string|null,
     *   status: string, errorCount: number,
     *   projectionFn: Function
     * }>}
     */
    this._targets  = new Map();
    this._auditLog = [];
  }

  /**
   * Register a new projection target.
   * RTP: HS-052 Claim 2 — "external state stores including at least one of:
   *                        a version control system, a key-value store, or
   *                        a cloud storage bucket"
   *
   * @param {string} targetId     - Unique identifier
   * @param {string} type         - PROJECTION_TYPES value
   * @param {object} config       - Target-specific config (url, path, bucket, etc.)
   * @param {Function} [projectionFn] - Custom projection function(stateId, stateObject, hash) → Promise<void>
   * @returns {object} The registered target descriptor
   */
  registerTarget(targetId, type, config = {}, projectionFn = null) {
    if (!Object.values(PROJECTION_TYPES).includes(type)) {
      throw new Error(`Unknown projection type: ${type}. Valid: ${Object.values(PROJECTION_TYPES).join(', ')}`);
    }

    // Default projection functions by type
    const defaultFns = {
      [PROJECTION_TYPES.LOCAL]: (stateId, stateObject, hash) => {
        // RTP: HS-052 Claim 2 — local file projection
        const dir  = config.path || '/tmp/heady-projections';
        const file = path.join(dir, `${stateId.replace(/[^a-z0-9-]/gi, '_')}.json`);
        try {
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(file, JSON.stringify({ stateId, stateObject, hash, ts: Date.now() }, null, 2));
          return { success: true, file };
        } catch (err) {
          return { success: false, error: err.message };
        }
      },
      [PROJECTION_TYPES.KV]: (stateId, stateObject, hash) => {
        // RTP: HS-052 Claim 2 — key-value store projection (stub; replace with real KV client)
        return { success: true, key: stateId, type: 'kv', note: 'KV write simulated' };
      },
      [PROJECTION_TYPES.GIT]: (stateId, stateObject, hash) => {
        // RTP: HS-052 Claim 2 — git repository projection (stub; replace with git client)
        return { success: true, stateId, hash, type: 'git', note: 'Git commit simulated' };
      },
      [PROJECTION_TYPES.CLOUD]: (stateId, stateObject, hash) => {
        // RTP: HS-052 Claim 2 — cloud storage projection (stub; replace with cloud SDK)
        return { success: true, stateId, hash, type: 'cloud', note: 'Cloud upload simulated' };
      },
    };

    const target = {
      id:           targetId,
      type,
      config,
      lastSync:     null,
      lastHash:     null,
      status:       SYNC_STATUS.UNKNOWN,
      errorCount:   0,
      projectionFn: projectionFn || defaultFns[type] || defaultFns[PROJECTION_TYPES.LOCAL],
    };

    this._targets.set(targetId, target);
    return { id: targetId, type, status: SYNC_STATUS.UNKNOWN };
  }

  /**
   * Project a state delta to all registered targets.
   * External stores are derived projections ONLY — the vector DB remains canonical.
   * RTP: HS-052 Claim 3
   *
   * @param {string} stateId
   * @param {object} stateObject
   * @param {string} stateHash
   * @returns {Array<{ targetId: string, type: string, success: boolean, error?: string }>}
   */
  projectToAll(stateId, stateObject, stateHash) {
    const results = [];

    for (const [targetId, target] of this._targets) {
      try {
        const result = target.projectionFn(stateId, stateObject, stateHash);
        const success = result && (result.success !== false);

        target.lastSync = Date.now();
        target.lastHash = stateHash;
        target.status   = success ? SYNC_STATUS.SYNCED : SYNC_STATUS.STALE;
        if (!success) target.errorCount++;

        results.push({ targetId, type: target.type, success, ...result });
      } catch (err) {
        target.status = SYNC_STATUS.ERROR;
        target.errorCount++;
        results.push({ targetId, type: target.type, success: false, error: err.message });
      }
    }

    this._auditLog.push({ stateId, stateHash, targets: results.length, ts: Date.now() });
    return results;
  }

  /**
   * Project to a specific named target only.
   * @param {string} targetId
   * @param {string} stateId
   * @param {object} stateObject
   * @param {string} stateHash
   * @returns {object}
   */
  projectToTarget(targetId, stateId, stateObject, stateHash) {
    const target = this._targets.get(targetId);
    if (!target) throw new Error(`No projection target registered: ${targetId}`);

    try {
      const result  = target.projectionFn(stateId, stateObject, stateHash);
      const success = result && (result.success !== false);
      target.lastSync = Date.now();
      target.lastHash = stateHash;
      target.status   = success ? SYNC_STATUS.SYNCED : SYNC_STATUS.STALE;
      return { targetId, success, ...result };
    } catch (err) {
      target.status = SYNC_STATUS.ERROR;
      target.errorCount++;
      return { targetId, success: false, error: err.message };
    }
  }

  /**
   * Mark a target as stale (used after detecting out-of-band changes).
   * RTP: HS-052 Claim 1(c)
   * @param {string} targetId
   */
  markStale(targetId) {
    const target = this._targets.get(targetId);
    if (target) target.status = SYNC_STATUS.STALE;
  }

  /**
   * Enumerate all registered targets and their sync status.
   * @returns {Array<object>}
   */
  listTargets() {
    return Array.from(this._targets.values()).map(t => ({
      id:         t.id,
      type:       t.type,
      status:     t.status,
      lastSync:   t.lastSync,
      lastHash:   t.lastHash,
      errorCount: t.errorCount,
      config:     t.config,
    }));
  }

  /**
   * Assert canonical invariant: vector DB is always the source of truth.
   * Returns an assertion report for audit purposes.
   * RTP: HS-052 Claim 3
   *
   * @returns {{ canonical: string, invariantHeld: boolean, staleTargets: number, report: string }}
   */
  assertCanonicalInvariant() {
    const staleTargets = Array.from(this._targets.values())
      .filter(t => t.status === SYNC_STATUS.STALE || t.status === SYNC_STATUS.ERROR).length;

    const invariantHeld = staleTargets === 0;
    return {
      canonical:      'vector_database',
      invariantHeld,
      staleTargets,
      totalTargets:   this._targets.size,
      report: invariantHeld
        ? 'All projection targets are in sync. Vector DB remains canonical source of truth.'
        : `${staleTargets} projection target(s) are stale. Vector DB is still canonical — external stores are derived projections only.`,
    };
  }

  /**
   * Deregister a projection target.
   * @param {string} targetId
   * @returns {boolean}
   */
  deregisterTarget(targetId) {
    return this._targets.delete(targetId);
  }

  /**
   * Return the audit log.
   * @param {number} [limit=100]
   * @returns {Array<object>}
   */
  getAuditLog(limit = 100) {
    return this._auditLog.slice(-limit);
  }
}

// ─── FibonacciShardManager ────────────────────────────────────────────────────

/**
 * Fibonacci Shard Manager — distributes vector memory across storage tiers
 * following a Fibonacci-derived capacity distribution. Automatically promotes
 * or demotes embeddings between tiers based on access frequency and importance.
 *
 * Tier capacities (GB): hot=1, warm=1, cool=2, cold=3, archive=5
 * Derived from the Fibonacci sequence; PHI = 1.6180339887 governs ratios.
 *
 * RTP: HS-052 Claim 4 — "distributing vector memory across storage tiers
 *                        following a Fibonacci-derived capacity distribution,
 *                        wherein access frequency determines automatic promotion
 *                        or demotion between tiers"
 */
class FibonacciShardManager {
  /**
   * @param {VectorDatabase} vectorDB
   * @param {object} [opts]
   * @param {number} [opts.promotionThreshold]  - Access count to trigger promotion (default: 10)
   * @param {number} [opts.demotionThreshold]   - Idle seconds to trigger demotion (default: 3600)
   * @param {number[]} [opts.tierCapacitiesGB]  - Override tier capacities
   */
  constructor(vectorDB, opts = {}) {
    this._vectorDB           = vectorDB;
    this._promotionThreshold = opts.promotionThreshold !== undefined ? opts.promotionThreshold : 10;
    this._demotionThreshold  = opts.demotionThreshold  !== undefined ? opts.demotionThreshold  : 3600;
    this._tierCapacitiesGB   = opts.tierCapacitiesGB   || FIBONACCI_TIER_CAPACITIES_GB;

    // Tier ordering: 0=hot (fastest) ... 4=archive (slowest)
    this._tierOrder = [
      STORAGE_TIERS.HOT,
      STORAGE_TIERS.WARM,
      STORAGE_TIERS.COOL,
      STORAGE_TIERS.COLD,
      STORAGE_TIERS.ARCHIVE,
    ];

    this._promotionLog = [];
    this._demotionLog  = [];
  }

  /**
   * Return PHI ratio between consecutive Fibonacci tier capacities.
   * Used to validate that the tier distribution follows golden-ratio scaling.
   * @returns {{ phi: number, ratios: number[] }}
   */
  phiRatioReport() {
    const ratios = [];
    for (let i = 1; i < this._tierCapacitiesGB.length; i++) {
      ratios.push(+(this._tierCapacitiesGB[i] / this._tierCapacitiesGB[i - 1]).toFixed(6));
    }
    return { phi: PHI, capacitiesGB: this._tierCapacitiesGB, ratios };
  }

  /**
   * Compute the ideal storage tier for an entry based on its access count
   * and recency. High-access entries live in hot tier; low-access entries
   * are demoted toward archive.
   *
   * @param {object} entry - Vector DB entry
   * @returns {string} STORAGE_TIERS value
   */
  computeIdealTier(entry) {
    const idleSec = (Date.now() - entry.lastAccessed) / 1000;
    const acc     = entry.accessCount;

    if (acc >= this._promotionThreshold) return STORAGE_TIERS.HOT;
    if (acc >= this._promotionThreshold * 0.5) return STORAGE_TIERS.WARM;
    if (idleSec < this._demotionThreshold)      return STORAGE_TIERS.COOL;
    if (idleSec < this._demotionThreshold * 3)  return STORAGE_TIERS.COLD;
    return STORAGE_TIERS.ARCHIVE;
  }

  /**
   * Run a full tier-rebalancing pass across all entries in the vector DB.
   * Promotes frequently accessed entries to hot tier, demotes idle entries.
   *
   * RTP: HS-052 Claim 4 — "access frequency determines automatic promotion or
   *                        demotion between tiers"
   *
   * @returns {{ promoted: number, demoted: number, unchanged: number, report: Array }}
   */
  rebalance() {
    let promoted  = 0;
    let demoted   = 0;
    let unchanged = 0;
    const report  = [];

    for (const entry of this._vectorDB.entries()) {
      const idealTier = this.computeIdealTier(entry);

      if (idealTier === entry.tier) {
        unchanged++;
        continue;
      }

      const currentIdx = this._tierOrder.indexOf(entry.tier);
      const idealIdx   = this._tierOrder.indexOf(idealTier);
      const direction  = idealIdx < currentIdx ? 'promote' : 'demote';

      const logEntry = {
        id:       entry.id,
        from:     entry.tier,
        to:       idealTier,
        direction,
        accessCount: entry.accessCount,
        ts:       Date.now(),
      };

      if (direction === 'promote') {
        this._promotionLog.push(logEntry);
        promoted++;
      } else {
        this._demotionLog.push(logEntry);
        demoted++;
      }

      entry.tier = idealTier;
      report.push(logEntry);
    }

    return { promoted, demoted, unchanged, report };
  }

  /**
   * Assign an explicit tier to a specific vector entry.
   * @param {string} entryId
   * @param {string} tier
   */
  assignTier(entryId, tier) {
    const entry = this._vectorDB.get(entryId);
    if (!entry) throw new Error(`Vector DB entry not found: ${entryId}`);
    if (!this._tierOrder.includes(tier)) throw new Error(`Invalid tier: ${tier}`);
    entry.tier = tier;
  }

  /**
   * Return a summary of the current shard distribution across tiers.
   * @returns {object}
   */
  shardSummary() {
    const counts = {};
    for (const t of this._tierOrder) counts[t] = 0;
    for (const entry of this._vectorDB.entries()) {
      counts[entry.tier] = (counts[entry.tier] || 0) + 1;
    }
    return {
      tierCounts:    counts,
      capacitiesGB:  this._tierCapacitiesGB,
      phi:           PHI,
      totalEntries:  this._vectorDB.size(),
      promotionLog:  this._promotionLog.slice(-20),
      demotionLog:   this._demotionLog.slice(-20),
    };
  }
}

// ─── ShadowMemorySystem ───────────────────────────────────────────────────────

/**
 * Full Shadow Memory Persistence System — composes all modules into the
 * complete HS-052 implementation.
 *
 * RTP: HS-052 Claim 6 — Full system comprising:
 *   (a) persistent vector database
 *   (b) exhale module
 *   (c) inhale module
 *   (d) projection manager
 *   (e) Fibonacci sharding module
 */
class ShadowMemorySystem {
  /**
   * @param {object} [opts]
   * @param {number} [opts.embeddingDim]
   * @param {number} [opts.deltaThreshold]
   * @param {number} [opts.kNearest]
   * @param {number} [opts.promotionThreshold]
   * @param {number} [opts.demotionThreshold]
   */
  constructor(opts = {}) {
    // (a) Canonical vector database
    this.vectorDB = new VectorDatabase();

    // (d) Projection manager (needs vectorDB reference)
    this.projectionManager = new ProjectionManager(this.vectorDB);

    // (b) Exhale module
    this.exhaleModule = new ExhaleModule(this.vectorDB, this.projectionManager, {
      deltaThreshold: opts.deltaThreshold,
      embeddingDim:   opts.embeddingDim,
    });

    // (c) Inhale module
    this.inhaleModule = new InhaleModule(this.vectorDB, {
      kNearest:     opts.kNearest,
      embeddingDim: opts.embeddingDim,
    });

    // (e) Fibonacci sharding module
    this.shardManager = new FibonacciShardManager(this.vectorDB, {
      promotionThreshold: opts.promotionThreshold,
      demotionThreshold:  opts.demotionThreshold,
    });

    this._createdAt = Date.now();
    this._nodeId    = `shadow-node-${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Convenience: exhale (persist) a state entry.
   * @param {string} stateId
   * @param {object} stateObject
   * @param {object} [opts]
   * @returns {object}
   */
  exhale(stateId, stateObject, opts) {
    return this.exhaleModule.exhale(stateId, stateObject, opts);
  }

  /**
   * Convenience: inhale (reconstitute) context for a task.
   * @param {string} taskDescription
   * @param {object} [opts]
   * @returns {object}
   */
  inhale(taskDescription, opts) {
    return this.inhaleModule.inhale(this._nodeId, taskDescription, opts);
  }

  /**
   * Full system status report.
   * @returns {object}
   */
  status() {
    return {
      nodeId:     this._nodeId,
      createdAt:  this._createdAt,
      uptime:     Date.now() - this._createdAt,
      vectorDB:   this.vectorDB.stats(),
      projections: this.projectionManager.assertCanonicalInvariant(),
      shards:     this.shardManager.shardSummary(),
      phi:        PHI,
    };
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Core classes
  VectorDatabase,
  ExhaleModule,
  InhaleModule,
  ProjectionManager,
  FibonacciShardManager,
  ShadowMemorySystem,

  // Helpers (exported for testing / integration)
  _generateEmbedding,
  _cosineSimilarity,
  _embeddingDelta,
  _sha256,

  // Constants
  PHI,
  STORAGE_TIERS,
  SYNC_STATUS,
  PROJECTION_TYPES,
  FIBONACCI_TIER_CAPACITIES_GB,
  DEFAULT_EMBEDDING_DIM,
  DEFAULT_K_NEAREST,
};
```
---

### `src/memory/memory-receipts.js`

```javascript
/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ Memory Receipts — SPEC-3 ═══
 *
 * Every knowledge vault operation emits a receipt:
 * stored vs dropped, reason codes, references to artifacts.
 */

const crypto = require("crypto");

const TERMINAL_STATES = new Set([
    "completed",
    "failed_closed",
    "escalated",
    "timed_out_recovered",
]);

const TASK_ID_MAX_LEN = 128;
const HASH_MAX_LEN = 256;
const ALLOWED_VERDICTS = new Set(["success", "failed", "error", "retry", "unknown"]);

function normalizeHash(value) {
    if (value === undefined || value === null) return null;
    return String(value).trim().slice(0, HASH_MAX_LEN) || null;
}

function normalizeTaskId(taskId) {
    const normalized = String(taskId || "").trim();
    if (!normalized) throw new Error("taskId required");
    return normalized.slice(0, TASK_ID_MAX_LEN);
}

function normalizeVerdict(verdict) {
    const normalized = String(verdict || "unknown").trim().toLowerCase();
    return ALLOWED_VERDICTS.has(normalized) ? normalized : "unknown";
}

class MemoryReceipts {
    constructor(opts = {}) {
        this.receipts = [];
        this.maxReceipts = opts.maxReceipts || 5000;
        this.stats = { ingested: 0, embedded: 0, stored: 0, dropped: 0 };
        this.attempts = [];
        this.maxAttempts = opts.maxAttempts || 10000;
        this.taskStates = new Map();
        this.repeatFingerprintCounts = new Map();
        this.repeatThreshold = opts.repeatThreshold || 3;
        this.repeatWindowMs = opts.repeatWindowMs || 15 * 60 * 1000;
        this.maxRepeatFingerprints = opts.maxRepeatFingerprints || 5000;
    }

    // ─── Emit a receipt ──────────────────────────────────────────
    emit(receipt) {
        const r = {
            id: crypto.randomUUID(),
            operation: receipt.operation || "UNKNOWN",  // INGEST | EMBED | STORE | DROP
            source: receipt.source || "unknown",
            sourceId: receipt.sourceId || null,
            documentId: receipt.documentId || null,
            stored: receipt.stored !== false,
            reason: receipt.reason || null,
            contentHash: receipt.contentHash || null,
            details: receipt.details || {},
            ts: new Date().toISOString(),
        };

        this.receipts.push(r);
        if (this.receipts.length > this.maxReceipts) this.receipts.shift();

        // Update stats
        if (r.operation === "INGEST") this.stats.ingested++;
        if (r.operation === "EMBED") this.stats.embedded++;
        if (r.stored) this.stats.stored++;
        if (!r.stored) this.stats.dropped++;

        return r;
    }

    // ─── Convenience methods ─────────────────────────────────────
    ingest(source, sourceId, opts = {}) {
        return this.emit({ operation: "INGEST", source, sourceId, stored: true, ...opts });
    }

    embed(documentId, provider, model, opts = {}) {
        return this.emit({
            operation: "EMBED",
            documentId,
            stored: true,
            details: { provider, model, ...opts.details },
            ...opts,
        });
    }

    store(source, sourceId, documentId, opts = {}) {
        return this.emit({ operation: "STORE", source, sourceId, documentId, stored: true, ...opts });
    }

    drop(source, sourceId, reason, opts = {}) {
        return this.emit({ operation: "DROP", source, sourceId, stored: false, reason, ...opts });
    }

    // ─── Query ───────────────────────────────────────────────────
    getReceipts(filter = {}, limit = 50) {
        let results = this.receipts;
        if (filter.operation) results = results.filter(r => r.operation === filter.operation);
        if (filter.source) results = results.filter(r => r.source === filter.source);
        if (filter.stored !== undefined) results = results.filter(r => r.stored === filter.stored);
        return results.slice(-limit);
    }

    getStats() {
        return {
            ...this.stats,
            total: this.receipts.length,
            storedRate: this.stats.stored / Math.max(1, this.stats.stored + this.stats.dropped),
            attempts: this.attempts.length,
            activeTasks: Array.from(this.taskStates.values()).filter(t => !t.closed).length,
            repeatFingerprints: this.repeatFingerprintCounts.size,
        };
    }

    // ─── Trial ledger ────────────────────────────────────────────
    recordAttempt(attempt = {}) {
        const normalized = {
            id: crypto.randomUUID(),
            taskId: normalizeTaskId(attempt.taskId || "unknown-task"),
            inputHash: normalizeHash(attempt.inputHash),
            constraintsHash: normalizeHash(attempt.constraintsHash),
            outputHash: normalizeHash(attempt.outputHash),
            verdict: normalizeVerdict(attempt.verdict),
            errorClass: normalizeHash(attempt.errorClass),
            metadata: attempt.metadata || {},
            ts: new Date().toISOString(),
        };

        this.attempts.push(normalized);
        if (this.attempts.length > this.maxAttempts) this.attempts.shift();

        const existingState = this.taskStates.get(normalized.taskId) || {
            taskId: normalized.taskId,
            attempts: 0,
            firstAttemptAt: normalized.ts,
            lastAttemptAt: normalized.ts,
            closed: false,
            terminalState: null,
            terminalReason: null,
            terminalEvidence: null,
        };

        existingState.attempts += 1;
        existingState.lastAttemptAt = normalized.ts;
        this.taskStates.set(normalized.taskId, existingState);

        const repeat = this._trackRepeatFailure(normalized);

        return {
            attempt: normalized,
            repeat,
            taskState: { ...existingState },
        };
    }

    closeTask(taskId, terminalState, reason, evidence = {}) {
        const normalizedTaskId = normalizeTaskId(taskId);
        if (!TERMINAL_STATES.has(terminalState)) {
            throw new Error(`invalid terminal state: ${terminalState}`);
        }

        const state = this.taskStates.get(normalizedTaskId) || {
            taskId: normalizedTaskId,
            attempts: 0,
            firstAttemptAt: new Date().toISOString(),
            lastAttemptAt: null,
            closed: false,
        };

        if (state.closed) {
            return {
                taskId: normalizedTaskId,
                closed: true,
                terminalState: state.terminalState,
                reason: state.terminalReason,
                evidence: state.terminalEvidence,
                closedAt: state.closedAt,
                idempotent: true,
            };
        }

        state.closed = true;
        state.closedAt = new Date().toISOString();
        state.terminalState = terminalState;
        state.terminalReason = reason || "unspecified";
        state.terminalEvidence = evidence;

        this.taskStates.set(normalizedTaskId, state);

        return {
            taskId: normalizedTaskId,
            closed: true,
            terminalState,
            reason: state.terminalReason,
            evidence: state.terminalEvidence,
            closedAt: state.closedAt,
        };
    }

    getTaskState(taskId) {
        if (!taskId) return null;
        const normalizedTaskId = String(taskId).trim().slice(0, TASK_ID_MAX_LEN);
        if (!normalizedTaskId) return null;
        const state = this.taskStates.get(normalizedTaskId);
        return state ? { ...state } : null;
    }

    listOpenTasks(limit = 100) {
        const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, Number(limit))) : 100;
        return Array.from(this.taskStates.values())
            .filter(state => !state.closed)
            .slice(0, safeLimit)
            .map(state => ({ ...state }));
    }

    getAttempts(limit = 100) {
        const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(1000, Number(limit))) : 100;
        return this.attempts.slice(-safeLimit).map(a => ({ ...a }));
    }

    getOperationalStatus() {
        const stats = this.getStats();
        return {
            status: "healthy",
            terminalStates: Array.from(TERMINAL_STATES),
            allowedVerdicts: Array.from(ALLOWED_VERDICTS),
            capacity: {
                maxReceipts: this.maxReceipts,
                maxAttempts: this.maxAttempts,
                maxRepeatFingerprints: this.maxRepeatFingerprints,
            },
            stats,
            ts: new Date().toISOString(),
        };
    }

    _trackRepeatFailure(attempt) {
        if (attempt.verdict !== "failed" && attempt.verdict !== "error") {
            return { detected: false, count: 0, fingerprint: null };
        }

        const fingerprint = [
            attempt.taskId,
            attempt.inputHash || "no-input",
            attempt.constraintsHash || "no-constraints",
            attempt.errorClass || "no-error-class",
        ].join("::");

        const now = Date.now();
        const bucket = this.repeatFingerprintCounts.get(fingerprint) || [];
        const filtered = bucket.filter(ts => now - ts < this.repeatWindowMs);
        filtered.push(now);
        this.repeatFingerprintCounts.set(fingerprint, filtered);

        if (this.repeatFingerprintCounts.size > this.maxRepeatFingerprints) {
            const oldestKey = this.repeatFingerprintCounts.keys().next().value;
            if (oldestKey) this.repeatFingerprintCounts.delete(oldestKey);
        }

        return {
            detected: filtered.length >= this.repeatThreshold,
            count: filtered.length,
            threshold: this.repeatThreshold,
            fingerprint,
        };
    }
}

module.exports = MemoryReceipts;
module.exports.TERMINAL_STATES = TERMINAL_STATES;
```
---

### `src/bees/memory-bee.js`

```javascript
/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Memory Bee — Covers vector-memory.js (667 lines), vector-federation.js,
 * vector-pipeline.js, hybrid-search.js, embedding-provider.js, memory-receipts.js
 */
const domain = 'memory';
const description = 'Vector memory, federation, pipeline, hybrid search, embeddings, receipts';
const priority = 0.85;

function getWork(ctx = {}) {
    const mods = [
        { name: 'vector-memory', path: '../vector-memory' },
        { name: 'vector-federation', path: '../vector-federation' },
        { name: 'vector-pipeline', path: '../vector-pipeline' },
        { name: 'hybrid-search', path: '../hybrid-search' },
        { name: 'embedding-provider', path: '../embedding-provider' },
        { name: 'memory-receipts', path: '../memory-receipts' },
    ];
    return mods.map(m => async () => {
        try { require(m.path); return { bee: domain, action: m.name, loaded: true }; }
        catch { return { bee: domain, action: m.name, loaded: false }; }
    });
}

module.exports = { domain, description, priority, getWork };
```
---

### `src/bees/memory-consolidation.js`

```javascript
'use strict';

/**
 * @file memory-consolidation.js
 * @description Memory Compaction and Consolidation Engine.
 *
 * CHANGE LOG (new file — addresses gaps found in duckdb-memory.js, vector-memory.js, continuous-learning.js):
 *
 *  PROBLEMS FIXED:
 *  1. VectorMemoryV2 (RAM) and HeadyEmbeddedDuckDB (disk) have no synchronisation layer —
 *     entries written to one are not mirrored to the other.
 *  2. duckdb-memory.js loads VSS extension but never creates an HNSW index.  This engine
 *     creates the index on first consolidation run if absent.
 *  3. continuous-learning.js quality gate uses response length only; this engine adds
 *     content-based deduplication (cosine ≥ 0.98) so near-duplicate memories are merged
 *     rather than accumulated.
 *  4. buddy-watchdog.js clears `decisionLog = []` on restart without persisting first.
 *     This engine provides `archiveDecisionLog(log)` that the watchdog can call before
 *     clearing the array.
 *  5. No staleness eviction policy: memories accumulate indefinitely.  This engine enforces
 *     a configurable TTL per namespace and a global row-count budget for DuckDB.
 *
 *  ARCHITECTURE:
 *    MemoryConsolidationEngine
 *      ├─ ConsolidationScheduler    – cron-style scheduler (interval or cron string)
 *      ├─ DedupEngine               – cosine-based near-duplicate detector with union-find merge
 *      ├─ StalenessEviction         – TTL + LRU + row-budget eviction across both stores
 *      ├─ WriteThrough              – keeps VectorMemoryV2 ↔ DuckDB in sync after mutations
 *      ├─ HNSWIndexManager          – ensures the DuckDB HNSW index exists and is rebuilt if stale
 *      └─ ArchivalStore             – moves evicted/merged memories to cold archive table
 *
 *  USAGE:
 *    const { MemoryConsolidationEngine } = require('./memory-consolidation');
 *    const engine = new MemoryConsolidationEngine({ vectorMemory, duckdbMemory });
 *    await engine.init();
 *    engine.startScheduler();                // runs every 30 min by default
 *    await engine.runOnce();                 // on-demand full consolidation pass
 *    await engine.archiveDecisionLog(log);   // call from buddy-watchdog before restart
 */

const EventEmitter = require('events');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Cosine similarity threshold above which two memories are considered duplicates */
const DEDUP_COSINE_THRESHOLD = 0.98;

/** Default consolidation run interval (30 minutes) */
const DEFAULT_INTERVAL_MS = 30 * 60 * 1_000;

/** Default staleness TTL per namespace (ms) */
const DEFAULT_TTL_MS = {
  episodic:   7  * 24 * 60 * 60 * 1_000,  // 7 days
  semantic:   90 * 24 * 60 * 60 * 1_000,  // 90 days
  procedural: 30 * 24 * 60 * 60 * 1_000,  // 30 days
  shortterm:  24 * 60 * 60 * 1_000,        // 24 hours
  decisionLog: 14 * 24 * 60 * 60 * 1_000, // 14 days
};

/** Max rows in DuckDB memories table before forced eviction */
const DEFAULT_MAX_ROWS = 250_000;

/** DuckDB table names used by HeadyEmbeddedDuckDB */
const TABLES = {
  memories:  'memories',
  archive:   'memories_archive',
  decisions: 'decision_log',
  meta:      'consolidation_meta',
};

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

/**
 * Cosine similarity between two Float32Array / number[] vectors.
 * Returns 0 if either vector has zero magnitude.
 * @param {number[]|Float32Array} a
 * @param {number[]|Float32Array} b
 * @returns {number}  [-1, 1]
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Union-Find (for grouping duplicate clusters)
// ---------------------------------------------------------------------------

class UnionFind {
  constructor(n) {
    this._parent = Array.from({ length: n }, (_, i) => i);
    this._rank   = new Array(n).fill(0);
  }

  find(x) {
    if (this._parent[x] !== x) this._parent[x] = this.find(this._parent[x]);
    return this._parent[x];
  }

  union(x, y) {
    const rx = this.find(x), ry = this.find(y);
    if (rx === ry) return;
    if (this._rank[rx] < this._rank[ry]) this._parent[rx] = ry;
    else if (this._rank[rx] > this._rank[ry]) this._parent[ry] = rx;
    else { this._parent[ry] = rx; this._rank[rx]++; }
  }

  /** Return a Map from representative-index → [member-indices] */
  clusters(n) {
    const map = new Map();
    for (let i = 0; i < n; i++) {
      const r = this.find(i);
      if (!map.has(r)) map.set(r, []);
      map.get(r).push(i);
    }
    return map;
  }
}

// ---------------------------------------------------------------------------
// DedupEngine
// ---------------------------------------------------------------------------

/**
 * Near-duplicate detector using pairwise cosine similarity over embedding vectors.
 * For large sets (>2000 entries), uses a block-partitioning heuristic to stay within
 * acceptable O(n) time per block rather than O(n²) globally.
 */
class DedupEngine {
  /**
   * @param {object} [opts]
   * @param {number} [opts.threshold=0.98]   cosine similarity dedup threshold
   * @param {number} [opts.blockSize=500]    pairwise comparison block size
   */
  constructor(opts = {}) {
    this._threshold = opts.threshold ?? DEDUP_COSINE_THRESHOLD;
    this._blockSize = opts.blockSize ?? 500;
  }

  /**
   * Find duplicate clusters among a set of memory entries.
   * @param {Array<{ id: string, embedding: number[], content: string, createdAt: number }>} entries
   * @returns {{ keep: string[], discard: string[], mergeMap: Map<string, string> }}
   *   keep    — IDs to retain (representative of each cluster)
   *   discard — IDs to archive/delete
   *   mergeMap — discardId → keepId mapping
   */
  findDuplicates(entries) {
    if (entries.length < 2) return { keep: entries.map(e => e.id), discard: [], mergeMap: new Map() };

    const n = entries.length;
    const uf = new UnionFind(n);

    // Process in blocks to avoid O(n²) on huge sets
    for (let blockStart = 0; blockStart < n; blockStart += this._blockSize) {
      const blockEnd = Math.min(blockStart + this._blockSize, n);
      for (let i = blockStart; i < blockEnd; i++) {
        for (let j = i + 1; j < blockEnd; j++) {
          const sim = cosineSimilarity(entries[i].embedding, entries[j].embedding);
          if (sim >= this._threshold) uf.union(i, j);
        }
      }
    }

    const clusters = uf.clusters(n);
    const keep    = [];
    const discard = [];
    const mergeMap = new Map();

    for (const [, members] of clusters) {
      if (members.length === 1) {
        keep.push(entries[members[0]].id);
        continue;
      }
      // Representative = most recently created entry in the cluster
      members.sort((a, b) => (entries[b].createdAt || 0) - (entries[a].createdAt || 0));
      const rep = entries[members[0]];
      keep.push(rep.id);
      for (let k = 1; k < members.length; k++) {
        const dup = entries[members[k]];
        discard.push(dup.id);
        mergeMap.set(dup.id, rep.id);
      }
    }

    return { keep, discard, mergeMap };
  }
}

// ---------------------------------------------------------------------------
// HNSWIndexManager
// ---------------------------------------------------------------------------

/**
 * Manages the DuckDB VSS HNSW index on the memories table.
 * CHANGE: duckdb-memory.js loads the VSS extension but never issues
 * `CREATE INDEX ... USING HNSW` — this class fixes that gap.
 */
class HNSWIndexManager {
  /**
   * @param {object} db  DuckDB connection with `.run(sql, params, cb)` interface
   * @param {number} [dims=384]  embedding dimensions
   */
  constructor(db, dims = 384) {
    this._db   = db;
    this._dims = dims;
  }

  /**
   * Ensure the VSS extension is loaded and the HNSW index exists.
   * Safe to call multiple times (idempotent).
   * @returns {Promise<void>}
   */
  async ensureIndex() {
    await this._run(`LOAD vss`);
    await this._run(`INSTALL vss`);

    // Check if index already exists via DuckDB pragma
    const rows = await this._query(
      `SELECT index_name FROM duckdb_indexes WHERE table_name = '${TABLES.memories}' AND index_name = 'hnsw_emb_idx'`
    );

    if (rows.length === 0) {
      // Create HNSW index on the embedding column
      // NOTE: DuckDB VSS requires the column to be of type FLOAT[dims]
      await this._run(
        `CREATE INDEX hnsw_emb_idx ON ${TABLES.memories} USING HNSW (embedding)
         WITH (metric = 'cosine', ef_construction = 128, M = 16)`
      );
    }
  }

  /**
   * Drop and rebuild the HNSW index.  Should be called after large bulk deletes
   * which can fragment the index.
   * @returns {Promise<void>}
   */
  async rebuildIndex() {
    await this._run(`DROP INDEX IF EXISTS hnsw_emb_idx`);
    await this.ensureIndex();
  }

  /** @private */
  _run(sql) {
    return new Promise((resolve, reject) => {
      this._db.run(sql, (err) => err ? reject(err) : resolve());
    });
  }

  /** @private */
  _query(sql) {
    return new Promise((resolve, reject) => {
      this._db.all(sql, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }
}

// ---------------------------------------------------------------------------
// StalenessEviction
// ---------------------------------------------------------------------------

/**
 * Evicts stale entries from both VectorMemoryV2 (RAM) and DuckDB (disk)
 * based on TTL, LRU position, and a global row-count budget.
 */
class StalenessEviction {
  /**
   * @param {object} opts
   * @param {object} opts.ttlByNamespace  namespace → TTL in ms
   * @param {number} opts.maxRows          max total rows in DuckDB before forced LRU eviction
   */
  constructor(opts = {}) {
    this._ttl     = { ...DEFAULT_TTL_MS, ...opts.ttlByNamespace };
    this._maxRows = opts.maxRows ?? DEFAULT_MAX_ROWS;
  }

  /**
   * Evict stale entries from an in-memory namespace map.
   * @param {Map<string, { namespace: string, createdAt: number, lastAccessed: number }>} entries
   * @returns {{ evicted: string[], kept: string[] }}
   */
  evictFromMemory(entries) {
    const now = Date.now();
    const evicted = [];
    const kept    = [];

    for (const [id, entry] of entries) {
      const ttl = this._ttl[entry.namespace] ?? this._ttl.episodic;
      const age = now - (entry.createdAt || 0);
      if (age > ttl) evicted.push(id);
      else kept.push(id);
    }
    return { evicted, kept };
  }

  /**
   * Build SQL clauses to evict stale rows from DuckDB.
   * Returns an array of SQL strings ready to execute.
   * @returns {string[]}
   */
  buildEvictionSql() {
    const now = Date.now();
    const sqls = [];

    // TTL-based eviction per namespace
    for (const [ns, ttlMs] of Object.entries(this._ttl)) {
      const cutoff = now - ttlMs;
      sqls.push(
        `INSERT INTO ${TABLES.archive} SELECT *, 'ttl_eviction' AS archive_reason, ${now} AS archived_at ` +
        `FROM ${TABLES.memories} WHERE namespace = '${ns}' AND created_at < ${cutoff}`
      );
      sqls.push(
        `DELETE FROM ${TABLES.memories} WHERE namespace = '${ns}' AND created_at < ${cutoff}`
      );
    }

    return sqls;
  }

  /**
   * Build SQL for LRU eviction when row count exceeds budget.
   * @param {number} currentCount
   * @returns {string[]}
   */
  buildLruSql(currentCount) {
    if (currentCount <= this._maxRows) return [];
    const excess = currentCount - this._maxRows;
    const now = Date.now();
    return [
      `INSERT INTO ${TABLES.archive} SELECT *, 'lru_eviction' AS archive_reason, ${now} AS archived_at ` +
      `FROM ${TABLES.memories} ORDER BY last_accessed ASC LIMIT ${excess}`,

      `DELETE FROM ${TABLES.memories} WHERE id IN (` +
      `SELECT id FROM ${TABLES.memories} ORDER BY last_accessed ASC LIMIT ${excess})`,
    ];
  }
}

// ---------------------------------------------------------------------------
// WriteThrough
// ---------------------------------------------------------------------------

/**
 * Keeps VectorMemoryV2 (RAM) and DuckDB (disk) in sync.
 * Write-through: every write to one store is mirrored to the other.
 *
 * CHANGE: Previously there was no synchronisation — duckdb-memory.js and
 * vector-memory.js were entirely independent stores.
 */
class WriteThrough {
  /**
   * @param {object} vectorMemory   VectorMemoryV2 instance
   * @param {object} duckdbMemory   HeadyEmbeddedDuckDB instance
   */
  constructor(vectorMemory, duckdbMemory) {
    this._vm  = vectorMemory;
    this._ddb = duckdbMemory;
  }

  /**
   * Write a memory to both stores.
   * @param {object} entry
   * @param {string} entry.namespace
   * @param {string} entry.content
   * @param {number[]} entry.embedding
   * @param {object} [entry.metadata]
   * @returns {Promise<string>}  the new memory ID
   */
  async write(entry) {
    // Write to VectorMemoryV2 first (faster, in-memory)
    let vmId;
    if (this._vm && typeof this._vm.ingestMemory === 'function') {
      vmId = await this._vm.ingestMemory(entry.namespace, entry.content, entry.embedding, entry.metadata);
    }

    // Write to DuckDB
    if (this._ddb && typeof this._ddb.store === 'function') {
      await this._ddb.store({ ...entry, id: vmId });
    }

    return vmId;
  }

  /**
   * Delete a memory from both stores.
   * @param {string} id
   * @param {string} namespace
   * @returns {Promise<void>}
   */
  async delete(id, namespace) {
    if (this._vm && typeof this._vm.delete === 'function') {
      await this._vm.delete(namespace, id);
    }
    if (this._ddb && typeof this._ddb.delete === 'function') {
      await this._ddb.delete(id);
    }
  }

  /**
   * Sync a batch of DuckDB rows into VectorMemoryV2 (cold start / recovery).
   * @param {Array<object>} rows
   * @returns {Promise<number>}  count synced
   */
  async syncDdbToVector(rows) {
    if (!this._vm || typeof this._vm.ingestMemory !== 'function') return 0;
    let count = 0;
    for (const row of rows) {
      try {
        await this._vm.ingestMemory(row.namespace, row.content, row.embedding, row.metadata || {});
        count++;
      } catch { /* skip individual failures */ }
    }
    return count;
  }
}

// ---------------------------------------------------------------------------
// ArchivalStore
// ---------------------------------------------------------------------------

/**
 * Handles moving memories from the hot store to the cold archive table.
 * Also manages the DuckDB archive schema initialisation.
 */
class ArchivalStore {
  /**
   * @param {object} db  DuckDB connection
   */
  constructor(db) {
    this._db = db;
  }

  /**
   * Ensure archive and meta tables exist.
   * @returns {Promise<void>}
   */
  async ensureSchema() {
    // Archive table mirrors memories + reason + timestamp
    await this._run(`
      CREATE TABLE IF NOT EXISTS ${TABLES.archive} (
        id           VARCHAR PRIMARY KEY,
        namespace    VARCHAR,
        content      TEXT,
        embedding    FLOAT[384],
        metadata     JSON,
        created_at   BIGINT,
        last_accessed BIGINT,
        archive_reason VARCHAR,
        archived_at  BIGINT
      )
    `);

    // Decision log table for buddy-watchdog archival
    await this._run(`
      CREATE TABLE IF NOT EXISTS ${TABLES.decisions} (
        id          VARCHAR PRIMARY KEY,
        agent_id    VARCHAR,
        decision    JSON,
        outcome     VARCHAR,
        created_at  BIGINT,
        archived_at BIGINT
      )
    `);

    // Consolidation run metadata
    await this._run(`
      CREATE TABLE IF NOT EXISTS ${TABLES.meta} (
        run_id      VARCHAR PRIMARY KEY,
        started_at  BIGINT,
        finished_at BIGINT,
        deduped     INTEGER DEFAULT 0,
        evicted     INTEGER DEFAULT 0,
        synced      INTEGER DEFAULT 0,
        errors      INTEGER DEFAULT 0,
        status      VARCHAR DEFAULT 'running'
      )
    `);
  }

  /**
   * Archive decision log entries from buddy-watchdog/buddy-core.
   * CHANGE: buddy-watchdog._triggerRestart() clears decisionLog = [] without
   * persisting — this method is called before that clear.
   *
   * @param {Array<object>} decisions
   * @returns {Promise<number>}  rows inserted
   */
  async archiveDecisions(decisions) {
    if (!decisions || decisions.length === 0) return 0;
    const now = Date.now();
    let count = 0;

    for (const d of decisions) {
      try {
        const id = d.id || `dec_${now}_${Math.random().toString(36).slice(2, 7)}`;
        await this._run(`
          INSERT OR IGNORE INTO ${TABLES.decisions}
            (id, agent_id, decision, outcome, created_at, archived_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
          [id, d.agentId || 'BUDDY', JSON.stringify(d), d.outcome || 'unknown', d.ts || now, now]
        );
        count++;
      } catch { /* skip individual failures */ }
    }
    return count;
  }

  /** @private */
  _run(sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this._db.prepare ? this._db.prepare(sql) : null;
        if (stmt) {
          stmt.run(params, (err) => err ? reject(err) : resolve());
        } else {
          this._db.run(sql, params, (err) => err ? reject(err) : resolve());
        }
      } catch (err) { reject(err); }
    });
  }

  /** @private */
  _query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this._db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }
}

// ---------------------------------------------------------------------------
// ConsolidationScheduler
// ---------------------------------------------------------------------------

/**
 * Simple interval-based scheduler.  Can be replaced with a cron library if
 * more precise scheduling (e.g., "2 AM daily") is needed.
 */
class ConsolidationScheduler {
  /**
   * @param {Function} task  async () => void — the consolidation function to call
   * @param {number}   [intervalMs=DEFAULT_INTERVAL_MS]
   */
  constructor(task, intervalMs = DEFAULT_INTERVAL_MS) {
    this._task       = task;
    this._intervalMs = intervalMs;
    this._timer      = null;
    this._running    = false;
  }

  /** Start the scheduler. */
  start() {
    if (this._timer) return;
    this._timer = setInterval(() => {
      if (!this._running) {
        this._running = true;
        this._task().finally(() => { this._running = false; });
      }
    }, this._intervalMs);
    if (this._timer.unref) this._timer.unref();
  }

  /** Stop the scheduler. */
  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  /** Returns true if a run is currently in progress. */
  get isRunning() { return this._running; }
}

// ---------------------------------------------------------------------------
// MemoryConsolidationEngine  (main class)
// ---------------------------------------------------------------------------

/**
 * Orchestrates the full memory consolidation pipeline.
 *
 * @extends EventEmitter
 */
class MemoryConsolidationEngine extends EventEmitter {
  /**
   * @param {object} opts
   * @param {object}  opts.vectorMemory          VectorMemoryV2 instance (may be null for DuckDB-only mode)
   * @param {object}  opts.duckdbMemory          HeadyEmbeddedDuckDB instance (may be null for RAM-only mode)
   * @param {object}  [opts.ttlByNamespace]      namespace → TTL override in ms
   * @param {number}  [opts.maxRows=250000]       DuckDB row budget
   * @param {number}  [opts.intervalMs]           scheduler interval in ms
   * @param {number}  [opts.dedupThreshold=0.98]  cosine threshold for dedup
   * @param {boolean} [opts.autoInit=false]        call init() in constructor (not recommended — use await init())
   * @param {number}  [opts.embeddingDims=384]    vector dimensions
   */
  constructor(opts = {}) {
    super();

    this._vm      = opts.vectorMemory  || null;
    this._ddb     = opts.duckdbMemory  || null;
    this._dims    = opts.embeddingDims || 384;

    this._dedup    = new DedupEngine({ threshold: opts.dedupThreshold ?? DEDUP_COSINE_THRESHOLD });
    this._eviction = new StalenessEviction({
      ttlByNamespace: opts.ttlByNamespace || {},
      maxRows:        opts.maxRows        || DEFAULT_MAX_ROWS,
    });

    // DuckDB components (only active when duckdbMemory is provided)
    this._hnsw     = this._ddb ? new HNSWIndexManager(this._ddb._db || this._ddb, this._dims) : null;
    this._archive  = this._ddb ? new ArchivalStore(this._ddb._db || this._ddb)                : null;
    this._wt       = (this._vm || this._ddb) ? new WriteThrough(this._vm, this._ddb)          : null;

    this._scheduler = new ConsolidationScheduler(
      () => this.runOnce(),
      opts.intervalMs || DEFAULT_INTERVAL_MS
    );

    this._initialised = false;

    /** @type {Array<object>}  last N run reports */
    this._runHistory = [];
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Initialise the engine: ensure DuckDB schema and HNSW index exist,
   * then optionally sync DuckDB → VectorMemory.
   * @param {object} [opts]
   * @param {boolean} [opts.syncOnInit=false]  load DuckDB rows into VectorMemory on startup
   * @returns {Promise<void>}
   */
  async init(opts = {}) {
    if (this._initialised) return;

    if (this._archive) await this._archive.ensureSchema();
    if (this._hnsw)    await this._hnsw.ensureIndex().catch(err => {
      // VSS may not be available in all environments — log but don't crash
      this.emit('warn', { phase: 'init', message: `HNSW index creation skipped: ${err.message}` });
    });

    if (opts.syncOnInit && this._ddb && this._wt) {
      await this._coldStartSync();
    }

    this._initialised = true;
    this.emit('init:complete');
  }

  /**
   * Start the background consolidation scheduler.
   * @returns {this}
   */
  startScheduler() {
    if (!this._initialised) throw new Error('Call init() before startScheduler()');
    this._scheduler.start();
    this.emit('scheduler:started');
    return this;
  }

  /**
   * Stop the background scheduler.
   * @returns {this}
   */
  stopScheduler() {
    this._scheduler.stop();
    this.emit('scheduler:stopped');
    return this;
  }

  // -------------------------------------------------------------------------
  // Core consolidation pipeline
  // -------------------------------------------------------------------------

  /**
   * Run a full consolidation pass:
   *   1. Deduplication (both stores)
   *   2. Staleness eviction (both stores)
   *   3. HNSW index rebuild if significant rows were removed
   *   4. Emit a run report
   *
   * @returns {Promise<ConsolidationReport>}
   */
  async runOnce() {
    const runId  = `run_${Date.now()}`;
    const report = {
      runId,
      startedAt:   Date.now(),
      finishedAt:  null,
      deduped:     0,
      evicted:     0,
      archived:    0,
      synced:      0,
      indexRebuilt: false,
      errors:      [],
    };

    this.emit('run:start', { runId });

    try {
      // --- Phase 1: Deduplication ---
      const dedupResult = await this._runDedup();
      report.deduped  += dedupResult.count;
      report.archived += dedupResult.archived;

    } catch (err) {
      report.errors.push({ phase: 'dedup', message: err.message });
      this.emit('error', { phase: 'dedup', err });
    }

    try {
      // --- Phase 2: Staleness Eviction ---
      const evictResult = await this._runEviction();
      report.evicted  += evictResult.count;
      report.archived += evictResult.archived;

    } catch (err) {
      report.errors.push({ phase: 'eviction', message: err.message });
      this.emit('error', { phase: 'eviction', err });
    }

    try {
      // --- Phase 3: HNSW index rebuild if significant removals ---
      if (this._hnsw && (report.deduped + report.evicted) > 1_000) {
        await this._hnsw.rebuildIndex();
        report.indexRebuilt = true;
      }
    } catch (err) {
      report.errors.push({ phase: 'hnsw_rebuild', message: err.message });
      this.emit('warn', { phase: 'hnsw_rebuild', message: err.message });
    }

    report.finishedAt = Date.now();
    report.durationMs = report.finishedAt - report.startedAt;

    // Persist run metadata to DuckDB
    if (this._archive) {
      await this._persistRunMeta(report).catch(() => {});
    }

    this._runHistory.push(report);
    if (this._runHistory.length > 50) this._runHistory.shift();

    this.emit('run:complete', report);
    return report;
  }

  // -------------------------------------------------------------------------
  // Decision log archival (called by buddy-watchdog before restart)
  // -------------------------------------------------------------------------

  /**
   * Archive a decision log array to DuckDB before it is cleared by buddy-watchdog.
   * CHANGE: Provides the missing persistence hook for buddy-watchdog._triggerRestart().
   *
   * @param {Array<object>} decisionLog  buddy-core's this.decisionLog array
   * @returns {Promise<number>}  number of decisions archived
   */
  async archiveDecisionLog(decisionLog) {
    if (!this._archive || !Array.isArray(decisionLog) || decisionLog.length === 0) return 0;
    const count = await this._archive.archiveDecisions(decisionLog);
    this.emit('decisions:archived', { count });
    return count;
  }

  // -------------------------------------------------------------------------
  // Write-through API (delegate to WriteThrough)
  // -------------------------------------------------------------------------

  /**
   * Write a memory through to both stores.
   * @param {object} entry
   * @returns {Promise<string>}
   */
  async writeMemory(entry) {
    if (!this._wt) throw new Error('No stores configured');
    return this._wt.write(entry);
  }

  /**
   * Delete a memory from both stores.
   * @param {string} id
   * @param {string} namespace
   * @returns {Promise<void>}
   */
  async deleteMemory(id, namespace) {
    if (!this._wt) throw new Error('No stores configured');
    return this._wt.delete(id, namespace);
  }

  // -------------------------------------------------------------------------
  // Introspection
  // -------------------------------------------------------------------------

  /**
   * Return the last N consolidation run reports.
   * @param {number} [n=10]
   * @returns {ConsolidationReport[]}
   */
  getRunHistory(n = 10) {
    return this._runHistory.slice(-n);
  }

  /**
   * Return current scheduler state and initialisation status.
   * @returns {object}
   */
  status() {
    return {
      initialised:        this._initialised,
      schedulerRunning:   this._scheduler.isRunning,
      hasVectorMemory:    !!this._vm,
      hasDuckdb:          !!this._ddb,
      runCount:           this._runHistory.length,
      lastRun:            this._runHistory[this._runHistory.length - 1] || null,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** @private */
  async _runDedup() {
    let count = 0, archived = 0;

    // Dedup in VectorMemoryV2 (if available)
    if (this._vm && typeof this._vm.getAllEntries === 'function') {
      const namespaces = await this._vm.getNamespaces().catch(() => []);
      for (const ns of namespaces) {
        const entries = await this._vm.getAllEntries(ns).catch(() => []);
        if (entries.length < 2) continue;

        const { discard, mergeMap } = this._dedup.findDuplicates(entries);
        for (const id of discard) {
          await this._vm.delete(ns, id).catch(() => {});
          count++;
        }

        // Merge metadata of discarded entries into their representatives
        for (const [discardId, keepId] of mergeMap) {
          const discardEntry = entries.find(e => e.id === discardId);
          if (discardEntry) {
            await this._vm.mergeMetadata?.(ns, keepId, discardEntry.metadata).catch(() => {});
          }
        }
      }
    }

    // Dedup in DuckDB
    if (this._ddb) {
      const dbRows = await this._queryDdb(
        `SELECT id, namespace, content, embedding, created_at FROM ${TABLES.memories} ORDER BY created_at DESC`
      );

      // Map rows: parse embedding from DuckDB array if needed
      const entries = dbRows.map(r => ({
        id:        r.id,
        namespace: r.namespace,
        content:   r.content,
        embedding: Array.isArray(r.embedding) ? r.embedding : JSON.parse(r.embedding || '[]'),
        createdAt: r.created_at,
      }));

      if (entries.length >= 2) {
        const { discard } = this._dedup.findDuplicates(entries);
        if (discard.length > 0) {
          const now = Date.now();
          // Archive discards
          const ids = discard.map(id => `'${id}'`).join(',');
          await this._runDdb(
            `INSERT INTO ${TABLES.archive} SELECT *, 'dedup' AS archive_reason, ${now} AS archived_at ` +
            `FROM ${TABLES.memories} WHERE id IN (${ids})`
          ).catch(() => {});
          await this._runDdb(`DELETE FROM ${TABLES.memories} WHERE id IN (${ids})`).catch(() => {});
          count    += discard.length;
          archived += discard.length;
        }
      }
    }

    return { count, archived };
  }

  /** @private */
  async _runEviction() {
    let count = 0, archived = 0;

    // Evict from VectorMemoryV2
    if (this._vm && typeof this._vm.getAllEntriesWithMeta === 'function') {
      const allEntries = await this._vm.getAllEntriesWithMeta().catch(() => new Map());
      const { evicted } = this._eviction.evictFromMemory(allEntries);
      for (const id of evicted) {
        const entry = allEntries.get(id);
        await this._vm.delete(entry?.namespace || 'episodic', id).catch(() => {});
        count++;
      }
    }

    // Evict from DuckDB: TTL-based
    if (this._ddb) {
      const evictSqls = this._eviction.buildEvictionSql();
      let evictedFromDdb = 0;
      for (const sql of evictSqls) {
        const changed = await this._runDdb(sql).catch(() => 0);
        if (typeof changed === 'number') evictedFromDdb += changed;
      }
      count    += evictedFromDdb;
      archived += evictedFromDdb;

      // LRU eviction if over row budget
      const [[{ total }]] = await this._queryDdb(
        `SELECT COUNT(*) AS total FROM ${TABLES.memories}`
      ).then(rows => [rows]).catch(() => [[{ total: 0 }]]);

      if (total > this._eviction._maxRows) {
        const lruSqls = this._eviction.buildLruSql(total);
        for (const sql of lruSqls) await this._runDdb(sql).catch(() => {});
        const overflow = total - this._eviction._maxRows;
        count    += overflow;
        archived += overflow;
      }
    }

    return { count, archived };
  }

  /** @private */
  async _coldStartSync() {
    if (!this._ddb || !this._wt) return 0;
    const rows = await this._queryDdb(
      `SELECT id, namespace, content, embedding, metadata, created_at FROM ${TABLES.memories} LIMIT 10000`
    ).catch(() => []);
    const synced = await this._wt.syncDdbToVector(rows);
    this.emit('coldstart:synced', { count: synced });
    return synced;
  }

  /** @private */
  async _persistRunMeta(report) {
    if (!this._ddb) return;
    await this._runDdb(
      `INSERT OR REPLACE INTO ${TABLES.meta} (run_id, started_at, finished_at, deduped, evicted, synced, errors, status) ` +
      `VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        report.runId,
        report.startedAt,
        report.finishedAt,
        report.deduped,
        report.evicted,
        report.synced,
        report.errors.length,
        report.errors.length === 0 ? 'ok' : 'partial',
      ]
    ).catch(() => {});
  }

  /** @private */
  _runDdb(sql, params = []) {
    if (!this._ddb) return Promise.resolve(0);
    const db = this._ddb._db || this._ddb;
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this?.changes ?? 0);
      });
    });
  }

  /** @private */
  _queryDdb(sql, params = []) {
    if (!this._ddb) return Promise.resolve([]);
    const db = this._ddb._db || this._ddb;
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  MemoryConsolidationEngine,
  DedupEngine,
  StalenessEviction,
  WriteThrough,
  HNSWIndexManager,
  ArchivalStore,
  ConsolidationScheduler,
  // Constants exported for integration tests / custom configuration
  DEDUP_COSINE_THRESHOLD,
  DEFAULT_INTERVAL_MS,
  DEFAULT_TTL_MS,
  DEFAULT_MAX_ROWS,
  TABLES,
};

/**
 * @typedef {object} ConsolidationReport
 * @property {string}   runId
 * @property {number}   startedAt
 * @property {number}   finishedAt
 * @property {number}   durationMs
 * @property {number}   deduped       entries removed by cosine dedup
 * @property {number}   evicted       entries removed by TTL/LRU
 * @property {number}   archived      entries moved to archive table
 * @property {number}   synced        DuckDB rows synced to VectorMemory
 * @property {boolean}  indexRebuilt  whether HNSW index was rebuilt
 * @property {Array<{phase:string, message:string}>} errors
 */
```
---

### `src/bees/vector-memory-projection-bee.js`

```javascript
/* © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */
'use strict';

const logger = require('../utils/logger').child('vector-memory-projection-bee');
const CSL    = require('../core/semantic-logic');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PHI = 1.6180339887;

/** Cosine similarity threshold for clustering vectors (PHI-scaled). */
const CLUSTER_SIMILARITY_THRESHOLD = 1 - (1 / PHI); // ≈ 0.382

/** Drift threshold — z-score above which a namespace is considered drifted. */
const DRIFT_THRESHOLD = PHI;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve VectorMemory from global context or require it lazily so the bee
 * remains decoupled from a hard import path.
 */
function getVectorMemory() {
  if (global.vectorMemory) return global.vectorMemory;
  try {
    // Attempt project-relative resolution
    return require('../core/vector-memory');
  } catch {
    logger.warn('VectorMemory not available — returning null stub');
    return null;
  }
}

/**
 * Compute cosine similarity between two 384-D float arrays.
 * Returns value in [-1, 1].
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Compute centroid of a set of 384-D vectors.
 */
function computeCentroid(vectors) {
  if (!vectors.length) return null;
  const dim  = vectors[0].length;
  const sums = new Float64Array(dim);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) sums[i] += v[i];
  }
  return Array.from(sums).map(s => s / vectors.length);
}

// ---------------------------------------------------------------------------
// Worker factories
// ---------------------------------------------------------------------------

/**
 * Worker: snapshot-vectors
 * Snapshots overall VectorMemory stats — namespace counts, total vectors,
 * embedding dimension, memory footprint.
 */
function makeSnapshotVectorsWorker(vm) {
  return async function snapshotVectors() {
    const tag = 'snapshot-vectors';
    logger.debug(`[${tag}] starting`);

    let stats;
    try {
      stats = await vm.stats();
    } catch (err) {
      logger.error(`[${tag}] vm.stats() failed`, { err: err.message });
      stats = { error: err.message };
    }

    const result = {
      worker:      tag,
      capturedAt:  Date.now(),
      namespaceCount: stats.namespaceCount ?? 0,
      totalVectors:   stats.totalVectors   ?? 0,
      embeddingDim:   stats.embeddingDim   ?? 384,
      heapBytes:      stats.heapBytes      ?? 0,
      namespaces:     stats.namespaces     ?? {},
      raw:            stats,
    };

    // Compute health score via CSL weighted_superposition
    const healthScore = CSL.weighted_superposition([
      { value: stats.totalVectors > 0 ? 1 : 0, weight: 0.4 },
      { value: stats.error ? 0 : 1,             weight: 0.6 },
    ]);

    result.healthScore = healthScore;

    logger.info(`[${tag}] completed`, {
      namespaceCount: result.namespaceCount,
      totalVectors:   result.totalVectors,
      healthScore,
    });

    if (global.eventBus) {
      global.eventBus.emit('projection:vector-memory', { worker: tag, data: result });
    }

    return result;
  };
}

/**
 * Worker: detect-drift
 * Runs centroid drift detection across all namespaces.
 * Compares current centroid with stored baseline; flags if z-score > PHI.
 */
function makeDetectDriftWorker(vm) {
  // In-process baseline storage (keyed by namespace)
  const baselines = new Map();

  return async function detectDrift() {
    const tag = 'detect-drift';
    logger.debug(`[${tag}] starting`);

    let stats;
    try {
      stats = await vm.stats();
    } catch (err) {
      logger.error(`[${tag}] vm.stats() failed`, { err: err.message });
      return { worker: tag, error: err.message, driftReport: {} };
    }

    const namespaces = Object.keys(stats.namespaces || {});
    const driftReport = {};

    for (const ns of namespaces) {
      try {
        // Retrieve a representative sample of vectors for this namespace
        const results = await vm.search({ namespace: ns, topK: 50, includeVectors: true });
        const vectors = (results || []).map(r => r.vector).filter(Boolean);

        if (!vectors.length) {
          driftReport[ns] = { status: 'empty', drift: 0 };
          continue;
        }

        const centroid = computeCentroid(vectors);
        const baseline = baselines.get(ns);

        if (!baseline) {
          baselines.set(ns, centroid);
          driftReport[ns] = { status: 'baseline-set', drift: 0 };
          continue;
        }

        const similarity = cosineSimilarity(centroid, baseline);
        const driftScore = 1 - similarity; // 0 = identical, 1 = orthogonal

        // Use CSL soft_gate to decide whether drift is significant
        const isDrifted = CSL.soft_gate(driftScore, DRIFT_THRESHOLD / PHI) > 0.5;

        if (isDrifted) {
          logger.warn(`[${tag}] drift detected`, { namespace: ns, driftScore });
          // Update baseline to new centroid after flagging
          baselines.set(ns, centroid);
        }

        driftReport[ns] = {
          status:    isDrifted ? 'drifted' : 'stable',
          drift:     driftScore,
          similarity,
          vectorCount: vectors.length,
        };
      } catch (err) {
        logger.error(`[${tag}] namespace drift check failed`, { ns, err: err.message });
        driftReport[ns] = { status: 'error', error: err.message };
      }
    }

    const result = {
      worker:       tag,
      capturedAt:   Date.now(),
      driftReport,
      driftedCount: Object.values(driftReport).filter(r => r.status === 'drifted').length,
    };

    logger.info(`[${tag}] completed`, {
      namespacesChecked: namespaces.length,
      driftedCount:      result.driftedCount,
    });

    if (global.eventBus) {
      global.eventBus.emit('projection:vector-memory', { worker: tag, data: result });
    }

    return result;
  };
}

/**
 * Worker: cluster-analysis
 * Groups vectors by cosine similarity into semantic clusters using
 * a greedy centroid-based approach.
 */
function makeClusterAnalysisWorker(vm) {
  return async function clusterAnalysis() {
    const tag = 'cluster-analysis';
    logger.debug(`[${tag}] starting`);

    let stats;
    try {
      stats = await vm.stats();
    } catch (err) {
      logger.error(`[${tag}] vm.stats() failed`, { err: err.message });
      return { worker: tag, error: err.message, clusters: {} };
    }

    const namespaces = Object.keys(stats.namespaces || {});
    const clusterMap = {};

    for (const ns of namespaces) {
      try {
        const results = await vm.search({ namespace: ns, topK: 100, includeVectors: true });
        const items   = (results || []).filter(r => r.vector);

        if (!items.length) { clusterMap[ns] = []; continue; }

        // Greedy clustering: each item joins the first cluster whose centroid
        // is within CLUSTER_SIMILARITY_THRESHOLD, else starts a new cluster.
        const clusters = []; // [{ centroid, members: [id] }]

        for (const item of items) {
          let assigned = false;
          for (const cluster of clusters) {
            const sim = cosineSimilarity(item.vector, cluster.centroid);
            if (sim >= CLUSTER_SIMILARITY_THRESHOLD) {
              cluster.members.push(item.id);
              // Update centroid incrementally
              cluster.centroid = computeCentroid([cluster.centroid, item.vector]);
              assigned = true;
              break;
            }
          }
          if (!assigned) {
            clusters.push({ centroid: item.vector.slice(), members: [item.id] });
          }
        }

        // Strip raw centroid vectors from output to keep payload lean
        clusterMap[ns] = clusters.map((c, i) => ({
          clusterId:   `${ns}:${i}`,
          memberCount: c.members.length,
          members:     c.members,
        }));
      } catch (err) {
        logger.error(`[${tag}] cluster analysis failed`, { ns, err: err.message });
        clusterMap[ns] = [{ error: err.message }];
      }
    }

    const totalClusters = Object.values(clusterMap).reduce((s, arr) => s + arr.length, 0);

    const result = {
      worker:        tag,
      capturedAt:    Date.now(),
      clusters:      clusterMap,
      totalClusters,
      threshold:     CLUSTER_SIMILARITY_THRESHOLD,
    };

    logger.info(`[${tag}] completed`, {
      namespacesProcessed: namespaces.length,
      totalClusters,
    });

    if (global.eventBus) {
      global.eventBus.emit('projection:vector-memory', { worker: tag, data: result });
    }

    return result;
  };
}

// ---------------------------------------------------------------------------
// Bee export
// ---------------------------------------------------------------------------
const domain      = 'vector-memory-projection';
const description = 'Projects the current state of the 384D vector memory space: snapshots, drift detection, and semantic cluster analysis.';
const priority    = 0.95;

function getWork() {
  const vm = getVectorMemory();

  if (!vm) {
    logger.error('VectorMemory unavailable — returning no-op workers');
    const noop = (name) => async () => ({ worker: name, error: 'VectorMemory unavailable', capturedAt: Date.now() });
    return [noop('snapshot-vectors'), noop('detect-drift'), noop('cluster-analysis')];
  }

  return [
    makeSnapshotVectorsWorker(vm),
    makeDetectDriftWorker(vm),
    makeClusterAnalysisWorker(vm),
  ];
}

module.exports = { domain, description, priority, getWork };
```
---

### `src/bees/vector-memory-v2.js`

```javascript
/*
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══════════════════════════════════════════════════════════════════
 * VectorMemory V2 — Production-Grade RAM-First Vector Store
 * ═══════════════════════════════════════════════════════════════════
 *
 * CHANGES FROM V1 (vector-memory.js):
 *   [FIXED]  Added `queryMemory(text, limit, filter)` — the missing method
 *            called in buddy-core.js Phase 3 (was a runtime bug)
 *   [NEW]    HNSW-lite approximate nearest neighbor index (NSW graph)
 *            — O(log n) search vs O(n) in V1
 *   [NEW]    Hybrid search: cosine similarity + BM25 keyword fallback,
 *            weighted by `alpha` parameter (1.0 = pure vector, 0.0 = pure BM25)
 *   [NEW]    Metadata predicate filtering on search()
 *   [NEW]    Automatic compaction: dedup + eviction of stale entries
 *   [NEW]    Float32 storage option (halves memory vs Float64 in V1)
 *   [NEW]    `ingestMemory({content, metadata})` — high-level API for text
 *            (used by continuous-learning.js and DeterministicErrorInterceptor)
 *   [NEW]    Namespace-level TTL expiry
 *   [NEW]    Stats include per-namespace breakdown
 *   [IMPROVED] `persist()` / `load()` support incremental (append-only) mode
 */

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

// ─── Vector Math (inline to avoid circular deps) ────────────────────────────

/** @param {Float32Array|Float64Array} v @returns {number} */
function _magnitude(v) {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s);
}

/** @param {Float32Array|Float64Array} a @param {Float32Array|Float64Array} b @returns {number} */
function _cosine(a, b) {
  const ma = _magnitude(a), mb = _magnitude(b);
  if (ma === 0 || mb === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot / (ma * mb);
}

/** Pre-normalize a vector to unit length. */
function _normalize(v) {
  const mag = _magnitude(v);
  const out = new Float32Array(v.length);
  if (mag === 0) return out;
  for (let i = 0; i < v.length; i++) out[i] = v[i] / mag;
  return out;
}

// ─── BM25 Keyword Scorer ────────────────────────────────────────────────────

const BM25_K1 = 1.5;
const BM25_B  = 0.75;

/**
 * Lightweight BM25 scorer for the text stored in entry metadata/content.
 * Used for hybrid search fallback.
 */
class BM25Index {
  constructor() {
    /** @type {Map<string, {tf: Map<string, number>, length: number}>} */
    this._docs = new Map(); // key → { tf, length }
    this._df = new Map();   // term → doc frequency
    this._totalDocs = 0;
    this._avgDocLen = 0;
    this._totalDocLen = 0;
  }

  /**
   * Index a document.
   * @param {string} key - Document identifier (same as vector key)
   * @param {string} text - Document text
   */
  index(key, text) {
    const terms = this._tokenize(text);
    const tf = new Map();
    for (const t of terms) tf.set(t, (tf.get(t) || 0) + 1);

    // If re-indexing, subtract old doc stats
    if (this._docs.has(key)) {
      const old = this._docs.get(key);
      for (const [t, c] of old.tf) {
        const df = this._df.get(t) || 0;
        if (df <= 1) this._df.delete(t);
        else this._df.set(t, df - 1);
      }
      this._totalDocLen -= old.length;
      this._totalDocs--;
    }

    this._docs.set(key, { tf, length: terms.length });
    for (const t of tf.keys()) this._df.set(t, (this._df.get(t) || 0) + 1);
    this._totalDocs++;
    this._totalDocLen += terms.length;
    this._avgDocLen = this._totalDocs > 0 ? this._totalDocLen / this._totalDocs : 0;
  }

  /**
   * Remove a document from the index.
   * @param {string} key
   */
  remove(key) {
    const doc = this._docs.get(key);
    if (!doc) return;
    for (const [t, c] of doc.tf) {
      const df = this._df.get(t) || 0;
      if (df <= 1) this._df.delete(t);
      else this._df.set(t, df - 1);
    }
    this._totalDocLen -= doc.length;
    this._totalDocs--;
    this._avgDocLen = this._totalDocs > 0 ? this._totalDocLen / this._totalDocs : 0;
    this._docs.delete(key);
  }

  /**
   * Compute BM25 score for a query against a document.
   * @param {string} query
   * @param {string} key - Document key to score
   * @returns {number}
   */
  score(query, key) {
    const doc = this._docs.get(key);
    if (!doc) return 0;

    const qTerms = this._tokenize(query);
    let score = 0;
    for (const t of qTerms) {
      const tf_d = doc.tf.get(t) || 0;
      if (tf_d === 0) continue;
      const df = this._df.get(t) || 0;
      if (df === 0) continue;
      const N = this._totalDocs;
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
      const tfNorm = (tf_d * (BM25_K1 + 1)) /
        (tf_d + BM25_K1 * (1 - BM25_B + BM25_B * (doc.length / (this._avgDocLen || 1))));
      score += idf * tfNorm;
    }
    return score;
  }

  /**
   * Get all scored keys for a query, sorted descending.
   * @param {string} query
   * @returns {Array<{key: string, score: number}>}
   */
  search(query, limit = 20) {
    const results = [];
    for (const key of this._docs.keys()) {
      const s = this.score(query, key);
      if (s > 0) results.push({ key, score: s });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /** @private */
  _tokenize(text) {
    return (text || '').toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }
}

// ─── NSW Approximate Nearest-Neighbor Index ─────────────────────────────────

/**
 * Navigable Small World graph for approximate nearest neighbor search.
 * Provides O(log n) average-case search vs O(n) linear scan.
 *
 * This is a simplified NSW (not full HNSW) — suitable for in-process use
 * where DuckDB's full HNSW index is not available.
 *
 * Parameters:
 *   M          = max connections per node (default 16)
 *   ef_search  = beam width during search (default 32)
 */
class NSWIndex {
  /**
   * @param {object} opts
   * @param {number} [opts.M=16]         - Max edges per node
   * @param {number} [opts.efSearch=32]  - Beam width for search
   */
  constructor(opts = {}) {
    this.M = opts.M ?? 16;
    this.efSearch = opts.efSearch ?? 32;
    /** @type {Map<string, {vector: Float32Array, neighbors: Set<string>}>} */
    this._nodes = new Map();
  }

  /**
   * Insert a node into the index.
   * @param {string} key
   * @param {Float32Array} vector - Pre-normalized unit vector
   */
  insert(key, vector) {
    if (this._nodes.size === 0) {
      this._nodes.set(key, { vector, neighbors: new Set() });
      return;
    }

    // Find M nearest neighbors via greedy search
    const candidates = this._greedySearch(vector, this.M);

    // Add node with edges to its neighbors
    const node = { vector, neighbors: new Set(candidates.map(c => c.key)) };
    this._nodes.set(key, node);

    // Bidirectional edge: neighbors also point back to this node
    for (const { key: nbrKey } of candidates) {
      const nbr = this._nodes.get(nbrKey);
      if (nbr) {
        nbr.neighbors.add(key);
        // Prune if over M connections (keep M closest)
        if (nbr.neighbors.size > this.M) {
          this._pruneNeighbors(nbrKey);
        }
      }
    }
  }

  /**
   * Remove a node from the index.
   * @param {string} key
   */
  remove(key) {
    const node = this._nodes.get(key);
    if (!node) return;
    // Remove back-edges
    for (const nbrKey of node.neighbors) {
      const nbr = this._nodes.get(nbrKey);
      if (nbr) nbr.neighbors.delete(key);
    }
    this._nodes.delete(key);
  }

  /**
   * Find approximate nearest neighbors.
   * @param {Float32Array} query - Pre-normalized query vector
   * @param {number} [k=10]
   * @returns {Array<{key: string, score: number}>}
   */
  search(query, k = 10) {
    if (this._nodes.size === 0) return [];
    return this._greedySearch(query, Math.max(k, this.efSearch)).slice(0, k);
  }

  /** @private */
  _greedySearch(query, ef) {
    // Pick a random entry point
    const entryKey = this._nodes.keys().next().value;
    const entry = this._nodes.get(entryKey);

    const visited = new Set([entryKey]);
    const candidates = [{ key: entryKey, score: _cosine(query, entry.vector) }];
    const result = [...candidates];

    while (candidates.length > 0) {
      // Pick best unvisited candidate
      candidates.sort((a, b) => b.score - a.score);
      const current = candidates.shift();

      const node = this._nodes.get(current.key);
      if (!node) continue;

      for (const nbrKey of node.neighbors) {
        if (visited.has(nbrKey)) continue;
        visited.add(nbrKey);
        const nbr = this._nodes.get(nbrKey);
        if (!nbr) continue;
        const score = _cosine(query, nbr.vector);
        result.push({ key: nbrKey, score });
        if (candidates.length < ef) candidates.push({ key: nbrKey, score });
      }

      if (visited.size > ef * 3) break; // Safety cap
    }

    result.sort((a, b) => b.score - a.score);
    return result.slice(0, ef);
  }

  /** @private */
  _pruneNeighbors(key) {
    const node = this._nodes.get(key);
    if (!node) return;
    const scored = [];
    for (const nbrKey of node.neighbors) {
      const nbr = this._nodes.get(nbrKey);
      if (nbr) scored.push({ key: nbrKey, score: _cosine(node.vector, nbr.vector) });
    }
    scored.sort((a, b) => b.score - a.score);
    node.neighbors = new Set(scored.slice(0, this.M).map(s => s.key));
  }

  get size() { return this._nodes.size; }
  get nodeCount() { return this._nodes.size; }
}

// ─── Namespace Container ─────────────────────────────────────────────────────

/**
 * Per-namespace storage with its own NSW index and BM25 scorer.
 */
class Namespace {
  /**
   * @param {string} name
   * @param {object} opts
   * @param {number} [opts.ttlMs=0]       - Entry TTL (0 = no expiry)
   * @param {number} [opts.maxEntries=0]  - Max entries before LRU eviction (0 = no limit)
   * @param {object} [opts.nsw]           - NSW index options
   */
  constructor(name, opts = {}) {
    this.name = name;
    this.ttlMs = opts.ttlMs ?? 0;
    this.maxEntries = opts.maxEntries ?? 0;

    /** @type {Map<string, {vector: Float32Array, metadata: object, text: string, updatedAt: number, accessedAt: number}>} */
    this.entries = new Map();

    this.nsw = new NSWIndex(opts.nsw || {});
    this.bm25 = new BM25Index();

    this.stats = { stores: 0, deletes: 0, hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Store a vector entry.
   * @param {string} key
   * @param {Float32Array} vector - Pre-normalized
   * @param {object} metadata
   * @param {string} [text] - Raw text for BM25 indexing
   */
  set(key, vector, metadata, text = '') {
    const isUpdate = this.entries.has(key);

    // LRU eviction before insertion
    if (!isUpdate && this.maxEntries > 0 && this.entries.size >= this.maxEntries) {
      this._evictLRU();
    }

    this.entries.set(key, {
      vector,
      metadata: { ...metadata },
      text,
      updatedAt: Date.now(),
      accessedAt: Date.now(),
    });

    // Update indexes
    if (!isUpdate) {
      this.nsw.insert(key, vector);
    }
    this.bm25.index(key, text || JSON.stringify(metadata));
    this.stats.stores++;
  }

  /**
   * Retrieve an entry by key.
   * @param {string} key
   * @returns {object|null}
   */
  get(key) {
    const entry = this.entries.get(key);
    if (!entry) { this.stats.misses++; return null; }

    // TTL check
    if (this.ttlMs > 0 && Date.now() - entry.updatedAt > this.ttlMs) {
      this._delete(key);
      this.stats.misses++;
      return null;
    }

    entry.accessedAt = Date.now();
    this.stats.hits++;
    return entry;
  }

  /**
   * Delete an entry.
   * @param {string} key
   * @returns {boolean}
   */
  _delete(key) {
    if (!this.entries.has(key)) return false;
    this.entries.delete(key);
    this.nsw.remove(key);
    this.bm25.remove(key);
    this.stats.deletes++;
    return true;
  }

  /** @private LRU eviction — removes the least recently accessed entry. */
  _evictLRU() {
    let oldest = null, oldestTime = Infinity;
    for (const [key, entry] of this.entries) {
      if (entry.accessedAt < oldestTime) {
        oldest = key;
        oldestTime = entry.accessedAt;
      }
    }
    if (oldest) {
      this._delete(oldest);
      this.stats.evictions++;
    }
  }

  /** Evict all entries older than `maxAgeMs`. */
  evictStale(maxAgeMs) {
    const cutoff = Date.now() - maxAgeMs;
    let count = 0;
    for (const [key, entry] of this.entries) {
      if (entry.updatedAt < cutoff) {
        this._delete(key);
        count++;
      }
    }
    return count;
  }

  /** Deduplicate near-identical entries. Returns count removed. */
  dedup(threshold = 0.98) {
    const keys = [...this.entries.keys()];
    const toDelete = new Set();
    for (let i = 0; i < keys.length; i++) {
      if (toDelete.has(keys[i])) continue;
      const a = this.entries.get(keys[i]);
      for (let j = i + 1; j < keys.length; j++) {
        if (toDelete.has(keys[j])) continue;
        const b = this.entries.get(keys[j]);
        if (_cosine(a.vector, b.vector) >= threshold) {
          // Keep the newer one
          const older = a.updatedAt <= b.updatedAt ? keys[i] : keys[j];
          toDelete.add(older);
        }
      }
    }
    for (const key of toDelete) this._delete(key);
    return toDelete.size;
  }

  get size() { return this.entries.size; }
}

// ─── VectorMemory V2 ─────────────────────────────────────────────────────────

/**
 * Production-grade RAM-first vector memory with:
 *   - NSW approximate nearest neighbor index
 *   - Hybrid search (vector + BM25 keyword)
 *   - Metadata predicate filtering
 *   - Namespace-level TTL and LRU eviction
 *   - Automatic compaction
 *   - `ingestMemory()` high-level API (compatible with buddy-core, continuous-learning)
 *   - `queryMemory()` high-level API (fixes the runtime bug in buddy-core Phase 3)
 */
class VectorMemoryV2 {
  /**
   * @param {object} [opts]
   * @param {string}   [opts.defaultNamespace='default']
   * @param {Function} [opts.embedFn]        - async (text: string) => Float32Array|number[]
   *                                           If provided, ingestMemory/queryMemory work fully
   * @param {number}   [opts.driftThreshold=0.75]
   * @param {object}   [opts.nsw]            - NSW index options { M, efSearch }
   * @param {object}   [opts.namespaceDefaults] - Default opts for new namespaces { ttlMs, maxEntries }
   * @param {boolean}  [opts.useFloat32=true] - Store as Float32 (saves memory vs Float64)
   * @param {number}   [opts.compactionIntervalMs=0] - Auto-compact interval (0 = disabled)
   */
  constructor(opts = {}) {
    this._defaultNs = opts.defaultNamespace || 'default';
    this._embedFn = opts.embedFn || null;
    this._driftThreshold = opts.driftThreshold ?? 0.75;
    this._nswOpts = opts.nsw || {};
    this._nsDefaults = opts.namespaceDefaults || {};
    this._useFloat32 = opts.useFloat32 ?? true;

    /** @type {Map<string, Namespace>} */
    this._namespaces = new Map();
    this._ensureNamespace(this._defaultNs);

    this._totalIngested = 0;
    this._compactionRuns = 0;

    // Auto-compaction
    if (opts.compactionIntervalMs > 0) {
      this._compactionTimer = setInterval(
        () => this.compact(),
        opts.compactionIntervalMs
      ).unref(); // Don't prevent process exit
    }
  }

  // ─── Namespace Management ──────────────────────────────────────────────────

  /**
   * Ensure a namespace exists, creating it if needed.
   * @param {string} ns
   * @param {object} [opts]
   */
  _ensureNamespace(ns, opts = {}) {
    if (!this._namespaces.has(ns)) {
      this._namespaces.set(ns, new Namespace(ns, { ...this._nsDefaults, ...opts }));
    }
  }

  /**
   * Configure a namespace with TTL and/or max entries.
   * @param {string} ns
   * @param {object} opts - { ttlMs, maxEntries }
   */
  configureNamespace(ns, opts = {}) {
    this._ensureNamespace(ns, opts);
    const namespace = this._namespaces.get(ns);
    if (opts.ttlMs !== undefined) namespace.ttlMs = opts.ttlMs;
    if (opts.maxEntries !== undefined) namespace.maxEntries = opts.maxEntries;
  }

  /** @private */
  _ns(namespace) {
    const ns = namespace || this._defaultNs;
    this._ensureNamespace(ns);
    return this._namespaces.get(ns);
  }

  /** @private */
  _toVector(v) {
    if (v instanceof Float32Array) return v;
    if (v instanceof Float64Array || Array.isArray(v)) {
      return this._useFloat32 ? Float32Array.from(v) : Float64Array.from(v);
    }
    throw new TypeError('[VectorMemoryV2] vector must be Array, Float32Array, or Float64Array');
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Store a vector with metadata.
   * Vector is pre-normalized on store for faster dot-product search.
   *
   * @param {string} key
   * @param {number[]|Float32Array|Float64Array} vector
   * @param {object} [metadata={}]
   * @param {string} [namespace]
   * @param {string} [text] - Plain text for BM25 (auto-extracted from metadata.content if not provided)
   */
  store(key, vector, metadata = {}, namespace, text) {
    const ns = this._ns(namespace);
    const vec = _normalize(this._toVector(vector));
    const docText = text || metadata.content || metadata.text || JSON.stringify(metadata);
    ns.set(key, vec, metadata, docText);
  }

  /**
   * Retrieve an entry by key.
   * @param {string} key
   * @param {string} [namespace]
   * @returns {{vector: Float32Array, metadata: object, updatedAt: number}|null}
   */
  get(key, namespace) {
    return this._ns(namespace).get(key);
  }

  /**
   * Update an existing entry (merge metadata).
   * @param {string} key
   * @param {number[]|Float32Array} vector
   * @param {object} [metadata={}]
   * @param {string} [namespace]
   */
  update(key, vector, metadata = {}, namespace) {
    const existing = this.get(key, namespace);
    const mergedMeta = existing ? { ...existing.metadata, ...metadata } : metadata;
    this.store(key, vector, mergedMeta, namespace);
  }

  /**
   * Delete an entry.
   * @param {string} key
   * @param {string} [namespace]
   * @returns {boolean}
   */
  delete(key, namespace) {
    return this._ns(namespace)._delete(key);
  }

  /**
   * Clear all entries in a namespace.
   * @param {string} [namespace]
   */
  clear(namespace) {
    const ns = namespace || this._defaultNs;
    this._namespaces.delete(ns);
    this._ensureNamespace(ns);
  }

  // ─── High-Level Ingestion API ─────────────────────────────────────────────

  /**
   * Ingest a text memory using the configured embedFn.
   *
   * This is the high-level API used by:
   *   - continuous-learning.js (runLearningCycle)
   *   - buddy-core.js (DeterministicErrorInterceptor Phase 5)
   *
   * @param {object} opts
   * @param {string} opts.content   - Text content to embed and store
   * @param {object} [opts.metadata={}]
   * @param {string} [opts.key]     - Custom key (auto-generated if not provided)
   * @param {string} [opts.namespace]
   * @returns {Promise<{key: string, ok: boolean}>}
   */
  async ingestMemory({ content, metadata = {}, key, namespace } = {}) {
    if (!content) throw new Error('[VectorMemoryV2] ingestMemory: content is required');

    const memKey = key || `mem-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    let vector;
    if (this._embedFn) {
      try {
        vector = await this._embedFn(content);
      } catch (err) {
        // Fall back to a deterministic hash-based pseudo-vector
        vector = this._hashVector(content);
      }
    } else {
      // No embed function — use hash-based pseudo-vector
      vector = this._hashVector(content);
    }

    this.store(memKey, vector, { ...metadata, content, ingestedAt: new Date().toISOString() }, namespace, content);
    this._totalIngested++;
    return { key: memKey, ok: true };
  }

  /**
   * Query memory using a text string.
   * Uses hybrid search if an embedFn is configured.
   *
   * THIS METHOD WAS MISSING FROM V1 — causing a runtime bug in buddy-core.js
   * Phase 3 (DeterministicErrorInterceptor semantic analysis).
   *
   * @param {string} query      - Natural language query
   * @param {number} [limit=5]
   * @param {object} [filter]   - Metadata filter { key: value, ... }
   * @param {string} [namespace]
   * @returns {Promise<Array<{key: string, score: number, metadata: object, content: string}>>}
   */
  async queryMemory(query, limit = 5, filter = null, namespace) {
    if (!query) return [];

    let queryVector = null;
    if (this._embedFn) {
      try {
        queryVector = await this._embedFn(query);
      } catch {
        queryVector = this._hashVector(query);
      }
    } else {
      queryVector = this._hashVector(query);
    }

    // Hybrid search: alpha = 0.7 vector + 0.3 BM25
    const results = this.searchHybrid(queryVector, query, limit * 3, 0.7, filter, namespace);

    // Apply metadata filter if provided
    const filtered = filter
      ? results.filter(r => this._matchesFilter(r.metadata, filter))
      : results;

    return filtered.slice(0, limit).map(r => ({
      key: r.key,
      score: r.score,
      metadata: r.metadata,
      content: r.metadata?.content || '',
    }));
  }

  // ─── Search ────────────────────────────────────────────────────────────────

  /**
   * Cosine similarity search using the NSW approximate index.
   *
   * CHANGE FROM V1: Uses NSW O(log n) index instead of O(n) linear scan.
   *
   * @param {number[]|Float32Array} queryVector
   * @param {number} [limit=5]
   * @param {number} [minScore=0.5]
   * @param {object|null} [filter] - Metadata predicate filter
   * @param {string} [namespace]
   * @returns {Array<{key: string, score: number, metadata: object}>}
   */
  search(queryVector, limit = 5, minScore = 0.5, filter = null, namespace) {
    const ns = this._ns(namespace);
    const query = _normalize(this._toVector(queryVector));

    // NSW ANN search (candidate set is larger to allow post-filtering)
    const candidateK = filter ? limit * 5 : limit * 2;
    const candidates = ns.nsw.search(query, Math.max(candidateK, 20));

    const results = [];
    for (const { key, score } of candidates) {
      if (score < minScore) continue;
      const entry = ns.get(key);
      if (!entry) continue;
      if (filter && !this._matchesFilter(entry.metadata, filter)) continue;
      results.push({ key, score, metadata: entry.metadata });
    }

    return results.slice(0, limit);
  }

  /**
   * Hybrid search combining cosine similarity (NSW) and BM25 keyword ranking.
   *
   * CHANGE FROM V1: This is entirely new.
   *
   * @param {number[]|Float32Array} queryVector
   * @param {string} queryText
   * @param {number} [limit=5]
   * @param {number} [alpha=0.7]  - Weight for vector score (1-alpha = BM25 weight)
   * @param {object|null} [filter]
   * @param {string} [namespace]
   * @returns {Array<{key: string, score: number, vectorScore: number, bm25Score: number, metadata: object}>}
   */
  searchHybrid(queryVector, queryText, limit = 5, alpha = 0.7, filter = null, namespace) {
    const ns = this._ns(namespace);
    const query = _normalize(this._toVector(queryVector));

    // Get vector candidates (larger pool for merging)
    const vectorResults = ns.nsw.search(query, Math.max(limit * 4, 50));
    const vectorScores = new Map(vectorResults.map(r => [r.key, r.score]));

    // Get BM25 candidates
    const bm25Results = ns.bm25.search(queryText, Math.max(limit * 4, 50));
    const rawBm25Scores = new Map(bm25Results.map(r => [r.key, r.score]));

    // Normalize BM25 scores to [0, 1]
    const maxBm25 = Math.max(...rawBm25Scores.values(), 1);
    const bm25Scores = new Map([...rawBm25Scores].map(([k, v]) => [k, v / maxBm25]));

    // Union of candidates
    const allKeys = new Set([...vectorScores.keys(), ...bm25Scores.keys()]);

    const results = [];
    for (const key of allKeys) {
      const vScore = vectorScores.get(key) ?? 0;
      const bScore = bm25Scores.get(key) ?? 0;
      const combined = alpha * vScore + (1 - alpha) * bScore;

      if (combined < 0.1) continue;

      const entry = ns.get(key);
      if (!entry) continue;
      if (filter && !this._matchesFilter(entry.metadata, filter)) continue;

      results.push({ key, score: combined, vectorScore: vScore, bm25Score: bScore, metadata: entry.metadata });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Exact key lookup. Returns null if key not found or expired.
   * @param {string} key
   * @param {string} [namespace]
   */
  getEntry(key, namespace) {
    return this._ns(namespace).get(key);
  }

  // ─── Drift Detection ──────────────────────────────────────────────────────

  /**
   * Detect semantic drift between two vectors.
   * @param {number[]|Float32Array} a
   * @param {number[]|Float32Array} b
   * @returns {{ similarity: number, isDrifting: boolean }}
   */
  detectDrift(a, b) {
    const similarity = _cosine(this._toVector(a), this._toVector(b));
    return { similarity, isDrifting: similarity < this._driftThreshold };
  }

  // ─── Compaction ───────────────────────────────────────────────────────────

  /**
   * Run compaction across all namespaces:
   *   1. Evict TTL-expired entries
   *   2. Deduplicate near-identical entries
   *
   * CHANGE FROM V1: This is entirely new.
   *
   * @param {object} [opts]
   * @param {number} [opts.dedupThreshold=0.98]  - Cosine threshold for dedup
   * @param {number} [opts.maxStaleAgeMs=0]       - Evict entries older than this (0 = skip)
   * @returns {{ evicted: number, deduped: number, durationMs: number }}
   */
  compact(opts = {}) {
    const { dedupThreshold = 0.98, maxStaleAgeMs = 0 } = opts;
    const start = Date.now();
    let evicted = 0, deduped = 0;

    for (const ns of this._namespaces.values()) {
      // TTL-based eviction
      if (ns.ttlMs > 0) {
        evicted += ns.evictStale(ns.ttlMs);
      }
      // Explicit max age eviction
      if (maxStaleAgeMs > 0) {
        evicted += ns.evictStale(maxStaleAgeMs);
      }
      // Deduplication (O(n²) — run on namespaces with ≤ 10k entries)
      if (ns.size <= 10_000) {
        deduped += ns.dedup(dedupThreshold);
      }
    }

    this._compactionRuns++;
    return { evicted, deduped, durationMs: Date.now() - start };
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  /**
   * Persist all namespaces to a JSON-lines file.
   *
   * CHANGE FROM V1: Vectors stored as Float32 (half the size).
   * Also supports incremental/append mode.
   *
   * @param {string} filePath
   * @param {object} [opts]
   * @param {boolean} [opts.append=false] - Append to existing file (incremental)
   * @returns {Promise<number>} entries written
   */
  async persist(filePath, opts = {}) {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });

    const flag = opts.append ? 'a' : 'w';
    const stream = fs.createWriteStream(filePath, { encoding: 'utf8', flags: flag });
    let count = 0;

    for (const [nsName, ns] of this._namespaces) {
      for (const [key, entry] of ns.entries) {
        const line = JSON.stringify({
          ns: nsName,
          key,
          vector: Array.from(entry.vector),
          metadata: entry.metadata,
          text: entry.text || '',
          updatedAt: entry.updatedAt,
        });
        stream.write(line + '\n');
        count++;
      }
    }

    await new Promise((resolve, reject) => {
      stream.end();
      stream.once('finish', resolve);
      stream.once('error', reject);
    });

    return count;
  }

  /**
   * Load vectors from a JSON-lines file.
   * @param {string} filePath
   * @returns {Promise<number>} entries loaded
   */
  async load(filePath) {
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    let count = 0;

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const { ns, key, vector, metadata, text, updatedAt } = JSON.parse(line);
        this._ensureNamespace(ns);
        const namespace = this._namespaces.get(ns);
        const vec = _normalize(Float32Array.from(vector));
        namespace.entries.set(key, {
          vector: vec,
          metadata: metadata || {},
          text: text || '',
          updatedAt: updatedAt || Date.now(),
          accessedAt: Date.now(),
        });
        namespace.nsw.insert(key, vec);
        namespace.bm25.index(key, text || JSON.stringify(metadata));
        count++;
      } catch {
        /* skip malformed lines */
      }
    }

    return count;
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  /**
   * Memory store statistics.
   * CHANGE FROM V1: Includes per-namespace breakdown.
   */
  stats() {
    let totalVectors = 0;
    const namespaces = [];
    for (const [nsName, ns] of this._namespaces) {
      const count = ns.size;
      totalVectors += count;
      namespaces.push({
        name: nsName,
        vectors: count,
        indexNodes: ns.nsw.size,
        bm25Docs: ns.bm25._docs.size,
        ttlMs: ns.ttlMs,
        maxEntries: ns.maxEntries,
        stats: ns.stats,
      });
    }
    // Float32 = 4 bytes/dim, Float64 = 8 bytes/dim
    const bytesPerVec = this._useFloat32 ? 4 : 8;
    const EMBEDDING_DIM = totalVectors > 0
      ? (this._namespaces.values().next().value?.entries.values().next().value?.vector.length ?? 384)
      : 384;

    return {
      totalVectors,
      namespaces,
      memoryEstimateBytes: totalVectors * (EMBEDDING_DIM * bytesPerVec + 300),
      totalIngested: this._totalIngested,
      compactionRuns: this._compactionRuns,
      useFloat32: this._useFloat32,
      hasEmbedFn: !!this._embedFn,
    };
  }

  // ─── Private Utilities ────────────────────────────────────────────────────

  /**
   * @private
   * Generate a deterministic pseudo-vector from text using SHA-256.
   * Used as fallback when no embedFn is configured.
   * The vector is deterministic but NOT semantically meaningful.
   * @param {string} text
   * @returns {Float32Array}
   */
  _hashVector(text, dim = 384) {
    const vec = new Float32Array(dim);
    const hash = crypto.createHash('sha256').update(text).digest();
    // Fill the vector using repeating bytes from the hash
    for (let i = 0; i < dim; i++) {
      // Map byte to [-1, 1]
      vec[i] = (hash[i % hash.length] / 127.5) - 1;
    }
    return _normalize(vec);
  }

  /**
   * @private
   * Check if a metadata object matches a filter.
   * @param {object} metadata
   * @param {object} filter - { key: value } — exact match
   * @returns {boolean}
   */
  _matchesFilter(metadata, filter) {
    if (!filter || typeof filter !== 'object') return true;
    for (const [k, v] of Object.entries(filter)) {
      if (metadata[k] !== v) return false;
    }
    return true;
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

/** Default drift threshold (exported for backward compatibility with V1). */
const DRIFT_THRESHOLD = 0.75;

module.exports = {
  VectorMemoryV2,
  VectorMemory: VectorMemoryV2, // alias for drop-in replacement of V1
  Namespace,
  NSWIndex,
  BM25Index,
  DRIFT_THRESHOLD,
};
```
---

### `src/services/vector-memory.js`

```javascript
/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

/**
 * RAM-first 3D Vector Memory — the brain of the Heady™ AI Platform.
 * Stores 384-dimensional embeddings in-memory Maps with optional
 * JSON-lines persistence and namespace isolation.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { cosineSimilarity, EMBEDDING_DIM } = require('./vector-space-ops');
const logger = require('./utils/logger');

const DRIFT_THRESHOLD = 0.75;
const FLOAT64_BYTES = 8;

class VectorMemory {
  /**
   * @param {object} [opts]
   * @param {string} [opts.defaultNamespace='default']
   */
  constructor(opts = {}) {
    this._defaultNs = opts.defaultNamespace || 'default';
    /** @type {Map<string, Map<string, { vector: Float64Array, metadata: object, updatedAt: number }>>} */
    this._store = new Map();
    this._ensureNamespace(this._defaultNs);
    logger.info({ component: 'VectorMemory' }, 'VectorMemory initialised');
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  _ensureNamespace(ns) {
    if (!this._store.has(ns)) this._store.set(ns, new Map());
  }

  _resolveKey(key, namespace) {
    const ns = namespace || this._defaultNs;
    this._ensureNamespace(ns);
    return { ns, map: this._store.get(ns) };
  }

  _toFloat64(v) {
    if (v instanceof Float64Array) return v;
    if (v instanceof Float32Array || Array.isArray(v)) return Float64Array.from(v);
    throw new TypeError('vector must be an Array or Float32/64Array');
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Store a vector with associated metadata.
   * @param {string} key
   * @param {number[]|Float64Array} vector
   * @param {object} [metadata={}]
   * @param {string} [namespace]
   */
  store(key, vector, metadata = {}, namespace) {
    const { map } = this._resolveKey(key, namespace);
    const vec = this._toFloat64(vector);
    if (vec.length !== EMBEDDING_DIM) {
      logger.warn({ key, dim: vec.length }, 'VectorMemory: non-standard embedding dimension');
    }
    map.set(key, { vector: vec, metadata: { ...metadata }, updatedAt: Date.now() });
    logger.debug({ key, ns: namespace || this._defaultNs }, 'VectorMemory: stored');
  }

  /**
   * Retrieve a stored entry by key.
   * @param {string} key
   * @param {string} [namespace]
   * @returns {{ vector: Float64Array, metadata: object, updatedAt: number }|null}
   */
  get(key, namespace) {
    const { map } = this._resolveKey(key, namespace);
    return map.get(key) || null;
  }

  /**
   * Update an existing entry. Creates it if not present.
   * @param {string} key
   * @param {number[]|Float64Array} vector
   * @param {object} [metadata={}]
   * @param {string} [namespace]
   */
  update(key, vector, metadata = {}, namespace) {
    const existing = this.get(key, namespace);
    const mergedMeta = existing ? { ...existing.metadata, ...metadata } : metadata;
    this.store(key, vector, mergedMeta, namespace);
  }

  /**
   * Delete an entry.
   * @param {string} key
   * @param {string} [namespace]
   * @returns {boolean} true if deleted
   */
  delete(key, namespace) {
    const { map } = this._resolveKey(key, namespace);
    const deleted = map.delete(key);
    if (deleted) logger.debug({ key, ns: namespace || this._defaultNs }, 'VectorMemory: deleted');
    return deleted;
  }

  /**
   * Clear all entries in a namespace (or the default namespace).
   * @param {string} [namespace]
   */
  clear(namespace) {
    const ns = namespace || this._defaultNs;
    if (this._store.has(ns)) {
      this._store.get(ns).clear();
      logger.info({ ns }, 'VectorMemory: namespace cleared');
    }
  }

  // ─── Search ────────────────────────────────────────────────────────────────

  /**
   * Cosine similarity search across a namespace.
   * @param {number[]|Float64Array} queryVector
   * @param {number} [limit=5]
   * @param {number} [minScore=0.6]
   * @param {string} [namespace]
   * @returns {Array<{ key: string, score: number, metadata: object }>}
   */
  search(queryVector, limit = 5, minScore = 0.6, namespace) {
    const { map } = this._resolveKey(null, namespace);
    const query = this._toFloat64(queryVector);
    const results = [];

    for (const [key, entry] of map.entries()) {
      const score = cosineSimilarity(query, entry.vector);
      if (score >= minScore) results.push({ key, score, metadata: entry.metadata });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  // ─── Drift detection ───────────────────────────────────────────────────────

  /**
   * Detect semantic drift between two vectors.
   * @param {number[]|Float64Array} vectorA
   * @param {number[]|Float64Array} vectorB
   * @returns {{ similarity: number, isDrifting: boolean }}
   */
  detectDrift(vectorA, vectorB) {
    const similarity = cosineSimilarity(
      this._toFloat64(vectorA),
      this._toFloat64(vectorB),
    );
    return { similarity, isDrifting: similarity < DRIFT_THRESHOLD };
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  /**
   * Return high-level statistics about the memory store.
   * @returns {{ totalVectors: number, namespaces: string[], memoryEstimateBytes: number }}
   */
  stats() {
    let totalVectors = 0;
    const namespaces = [];
    for (const [ns, map] of this._store.entries()) {
      totalVectors += map.size;
      namespaces.push(ns);
    }
    // Estimate: each entry ≈ EMBEDDING_DIM * 8 bytes (Float64) + ~200 bytes overhead
    const memoryEstimateBytes = totalVectors * (EMBEDDING_DIM * FLOAT64_BYTES + 200);
    return { totalVectors, namespaces, memoryEstimateBytes };
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  /**
   * Persist all namespaces to a JSON-lines file.
   * @param {string} filePath
   * @returns {Promise<void>}
   */
  async persist(filePath) {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    const stream = fs.createWriteStream(filePath, { encoding: 'utf8' });

    for (const [ns, map] of this._store.entries()) {
      for (const [key, entry] of map.entries()) {
        const line = JSON.stringify({
          ns,
          key,
          vector: Array.from(entry.vector),
          metadata: entry.metadata,
          updatedAt: entry.updatedAt,
        });
        stream.write(line + '\n');
      }
    }

    await new Promise((resolve, reject) => {
      stream.end();
      stream.once('finish', resolve);
      stream.once('error', reject);
    });

    logger.info({ filePath }, 'VectorMemory: persisted');
  }

  /**
   * Load vectors from a JSON-lines file (merges into current store).
   * @param {string} filePath
   * @returns {Promise<number>} count of loaded entries
   */
  async load(filePath) {
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    let count = 0;

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const { ns, key, vector, metadata, updatedAt } = JSON.parse(line);
        this._ensureNamespace(ns);
        this._store.get(ns).set(key, {
          vector: Float64Array.from(vector),
          metadata: metadata || {},
          updatedAt: updatedAt || Date.now(),
        });
        count++;
      } catch (err) {
        logger.warn({ err: err.message }, 'VectorMemory: skipping malformed line');
      }
    }

    logger.info({ filePath, count }, 'VectorMemory: loaded');
    return count;
  }
}

module.exports = { VectorMemory, DRIFT_THRESHOLD };
```
---

### `src/vsa/vsa-csl-bridge.js`

```javascript
/**
 * @fileoverview VSA-CSL Integration Bridge for Heady
 * @description Bridges Vector Symbolic Architectures with Continuous Semantic Logic
 * @version 1.0.0
 */

const { Hypervector } = require('./hypervector');
const { VSACodebook } = require('./codebook');
const { logger } = require('../utils/logger');

/**
 * Continuous Semantic Logic gates using VSA representations
 * Replaces traditional if/else with continuous vector operations
 */
class VSASemanticGates {
  /**
   * Create VSA semantic gates system
   * @param {VSACodebook} codebook - Codebook with semantic concepts
   */
  constructor(codebook) {
    this.codebook = codebook;
    this.gateCache = new Map(); // Cache computed gates for performance
  }

  /**
   * RESONANCE GATE: Measures semantic alignment between concepts
   * Returns continuous value [0, 1] representing how well concepts resonate
   * @param {string|Hypervector} concept_a
   * @param {string|Hypervector} concept_b
   * @returns {number} Resonance strength [0, 1]
   */
  resonance_gate(concept_a, concept_b) {
    const hv_a = typeof concept_a === 'string' ? this.codebook.get(concept_a) : concept_a;
    const hv_b = typeof concept_b === 'string' ? this.codebook.get(concept_b) : concept_b;

    if (!hv_a || !hv_b) {
      throw new Error('Concepts not found in codebook');
    }

    // Resonance = normalized similarity
    return hv_a.similarity(hv_b);
  }

  /**
   * SUPERPOSITION GATE: Combines multiple concepts into unified representation
   * Returns bundled hypervector representing semantic union
   * @param {Array<string|Hypervector>} concepts
   * @returns {Hypervector}
   */
  superposition_gate(...concepts) {
    if (concepts.length === 0) {
      throw new Error('Superposition requires at least 1 concept');
    }

    const vectors = concepts.map(c => 
      typeof c === 'string' ? this.codebook.get(c) : c
    );

    if (vectors.some(v => !v)) {
      throw new Error('Some concepts not found in codebook');
    }

    return vectors[0].bundle(vectors.slice(1));
  }

  /**
   * ORTHOGONAL GATE: Measures semantic independence/distinctness
   * Returns how orthogonal (different) two concepts are [0, 1]
   * High value = concepts are semantically independent
   * @param {string|Hypervector} concept_a
   * @param {string|Hypervector} concept_b
   * @returns {number} Orthogonality [0, 1]
   */
  orthogonal_gate(concept_a, concept_b) {
    const resonance = this.resonance_gate(concept_a, concept_b);

    // Orthogonality is inverse of resonance
    return 1 - resonance;
  }

  /**
   * SOFT GATE: Fuzzy threshold with smooth transition
   * Implements continuous logic gate with adjustable steepness
   * @param {number} value - Input value [0, 1]
   * @param {number} [threshold=0.618] - Activation threshold (default: φ - 1)
   * @param {number} [steepness=10] - Transition steepness
   * @returns {number} Output [0, 1]
   */
  soft_gate(value, threshold = 0.618, steepness = 10) {
    // Sigmoid-based soft threshold
    return 1 / (1 + Math.exp(-steepness * (value - threshold)));
  }

  /**
   * COMPOSITION GATE: Creates compositional semantic structure
   * Binds concepts in specified order to preserve structure
   * @param {Array<string|Hypervector>} concepts - Ordered concepts
   * @returns {Hypervector}
   */
  composition_gate(...concepts) {
    if (concepts.length === 0) {
      throw new Error('Composition requires at least 1 concept');
    }

    const vectors = concepts.map(c => 
      typeof c === 'string' ? this.codebook.get(c) : c
    );

    if (vectors.some(v => !v)) {
      throw new Error('Some concepts not found in codebook');
    }

    // Sequential binding maintains order
    let result = vectors[0];
    for (let i = 1; i < vectors.length; i++) {
      result = result.bind(vectors[i]);
    }

    return result;
  }

  /**
   * QUERY GATE: Semantic pattern matching against codebook
   * Returns best matching concepts above threshold
   * @param {Hypervector} query - Query vector
   * @param {number} [threshold=0.5] - Match threshold
   * @param {number} [topK=3] - Number of results
   * @returns {Array<{name: string, similarity: number}>}
   */
  query_gate(query, threshold = 0.5, topK = 3) {
    return this.codebook.query(query, threshold, topK);
  }

  /**
   * PHI DECISION GATE: Makes decision using phi-scale continuous logic
   * Replaces traditional if/else with continuous semantic decision
   * @param {Hypervector} state - Current state vector
   * @param {Array<{condition: string, action: Function}>} rules
   * @returns {*} Result of triggered action
   */
  phi_decision_gate(state, rules) {
    const PHI = (1 + Math.sqrt(5)) / 2;
    let bestMatch = null;
    let bestScore = 0;

    for (const rule of rules) {
      const conditionVector = this.codebook.get(rule.condition);
      if (!conditionVector) continue;

      const score = state.similarity(conditionVector);
      const phiScore = score * PHI; // Amplify using golden ratio

      if (phiScore > bestScore) {
        bestScore = phiScore;
        bestMatch = rule;
      }
    }

    if (bestMatch && bestScore > 0.618) { // φ - 1 threshold
      return bestMatch.action(bestScore);
    }

    return null;
  }

  /**
   * CONTINUOUS AND gate: Fuzzy conjunction using T-norm
   * @param {number} a - Value [0, 1]
   * @param {number} b - Value [0, 1]
   * @returns {number} Conjunction result [0, 1]
   */
  continuous_and(a, b) {
    // Product T-norm (smooth and differentiable)
    return a * b;
  }

  /**
   * CONTINUOUS OR gate: Fuzzy disjunction using T-conorm
   * @param {number} a - Value [0, 1]
   * @param {number} b - Value [0, 1]
   * @returns {number} Disjunction result [0, 1]
   */
  continuous_or(a, b) {
    // Probabilistic sum T-conorm
    return a + b - a * b;
  }

  /**
   * CONTINUOUS NOT gate: Fuzzy negation
   * @param {number} a - Value [0, 1]
   * @returns {number} Negation result [0, 1]
   */
  continuous_not(a) {
    return 1 - a;
  }

  /**
   * CONTINUOUS IMPLIES gate: Fuzzy implication
   * @param {number} a - Antecedent [0, 1]
   * @param {number} b - Consequent [0, 1]
   * @returns {number} Implication result [0, 1]
   */
  continuous_implies(a, b) {
    // Gödel implication: if a ≤ b then 1 else b
    return a <= b ? 1 : b;
  }

  /**
   * Clear gate cache (for memory management)
   */
  clearCache() {
    this.gateCache.clear();
    logger.debug('Cleared VSA gate cache');
  }
}

/**
 * CSL Script Interpreter for VSA-based semantic logic
 */
class CSLInterpreter {
  /**
   * Create CSL interpreter
   * @param {VSASemanticGates} gates - VSA semantic gates system
   */
  constructor(gates) {
    this.gates = gates;
    this.variables = new Map(); // Runtime variables
    this.stack = []; // Execution stack
  }

  /**
   * Execute CSL script
   * @param {string} script - CSL script content
   * @returns {*} Script result
   */
  execute(script) {
    const lines = script.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

    for (const line of lines) {
      this.executeLine(line);
    }

    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
  }

  /**
   * Execute single CSL line
   * @param {string} line
   */
  executeLine(line) {
    // Variable assignment: @var_name = expression
    if (line.startsWith('@')) {
      const [varName, ...exprParts] = line.substring(1).split('=');
      const expression = exprParts.join('=').trim();
      const value = this.evaluateExpression(expression);
      this.variables.set(varName.trim(), value);
      return;
    }

    // Gate invocation: resonance_gate(A, B)
    if (line.includes('(')) {
      const result = this.evaluateExpression(line);
      this.stack.push(result);
      return;
    }

    // Concept push: CONCEPT_NAME
    if (line.match(/^[A-Z_]+$/)) {
      const concept = this.gates.codebook.get(line);
      if (concept) {
        this.stack.push(concept);
      }
    }
  }

  /**
   * Evaluate expression
   * @param {string} expr
   * @returns {*}
   */
  evaluateExpression(expr) {
    expr = expr.trim();

    // Variable reference
    if (expr.startsWith('$')) {
      return this.variables.get(expr.substring(1));
    }

    // Numeric literal
    if (!isNaN(expr)) {
      return parseFloat(expr);
    }

    // Gate invocation
    const gateMatch = expr.match(/^([a-z_]+)\((.*)\)$/);
    if (gateMatch) {
      const [, gateName, argsStr] = gateMatch;
      const args = argsStr.split(',').map(a => this.evaluateExpression(a.trim()));

      if (typeof this.gates[gateName] === 'function') {
        return this.gates[gateName](...args);
      }
    }

    // Concept reference
    return this.gates.codebook.get(expr);
  }

  /**
   * Get variable value
   * @param {string} name
   * @returns {*}
   */
  getVariable(name) {
    return this.variables.get(name);
  }

  /**
   * Clear interpreter state
   */
  reset() {
    this.variables.clear();
    this.stack = [];
  }
}

module.exports = {
  VSASemanticGates,
  CSLInterpreter
};
```
---

### `src/routes/memory.js`

```javascript
/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * HeadyMemory — 3D Persistent Vector Memory System
 * The core differentiator for HeadyBuddy. Every memory is either
 * GAINED (stored in vector space) or REJECTED (with full audit trail).
 *
 * Protocol:
 * 1. Input arrives (observation, conversation, fact, pattern)
 * 2. Significance scoring (0-1) based on novelty, relevance, utility
 * 3. Vector embedding generated (text → 384-dim embedding)
 * 4. Similarity check against existing memories (dedup)
 * 5. Decision: GAIN (store) or REJECT (with reason)
 * 6. Full audit report emitted for EVERY decision
 * 7. Persistent storage: JSONL + vector-ready format for Qdrant/Vectorize
 *
 * Memory Types:
 * - episodic: events, conversations, interactions
 * - semantic: facts, knowledge, concepts
 * - procedural: how-to, patterns, workflows
 * - contextual: user preferences, environment state
 */
const express = require('../core/heady-server');
const router = express.Router();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const logger = require("../utils/logger");
const CSL = require("../core/semantic-logic");

// Qdrant configuration
const QDRANT_URL = process.env.QDRANT_URL || "http://127.0.0.1:6333";
const QDRANT_COLLECTION = "heady-memory";

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const MEMORY_FILE = path.join(DATA_DIR, "memory-store.jsonl");
const AUDIT_FILE = path.join(DATA_DIR, "memory-audit.jsonl");
const VECTOR_FILE = path.join(DATA_DIR, "memory-vectors.jsonl");

// In-memory stores (also persisted to disk)
const memories = new Map();        // id → memory object
const vectors = new Map();         // id → vector embedding
const auditLog = [];               // every gain/reject decision
const stats = {
    totalProcessed: 0,
    gained: 0,
    rejected: 0,
    duplicatesBlocked: 0,
    lastDecision: null,
    startTime: Date.now(),
};

// Configuration
const CONFIG = {
    gainThreshold: 0.45,           // significance >= this → GAIN
    similarityThreshold: 0.92,     // cosine sim >= this → duplicate
    maxMemories: 10000,            // max stored memories
    vectorDimensions: 384,         // embedding dimensions
    auditEveryDecision: true,      // report on EVERY decision
    retentionPolicy: "significance-decay", // memories decay over time
    decayRatePerDay: 0.002,        // significance decays 0.2% per day
};

// ── Health ──
router.get("/health", (req, res) => {
    res.json({
        status: "ACTIVE",
        service: "heady-memory",
        mode: "3d-persistent-vector-storage",
        protocol: "gain-or-reject-with-audit",
        memories: memories.size,
        vectors: vectors.size,
        ...stats,
        config: CONFIG,
        uptime: Math.floor((Date.now() - stats.startTime) / 1000),
        ts: new Date().toISOString(),
    });
});

// ── Process a new potential memory ──
router.post("/process", (req, res) => {
    const { content, type, source, context, tags, forceGain } = req.body;
    if (!content) return res.status(400).json({ ok: false, error: "content required" });

    stats.totalProcessed++;

    const memory = {
        id: `mem-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
        content: content.substring(0, 2000),
        type: type || "semantic",
        source: source || "unknown",
        context: (context || "").substring(0, 500),
        tags: tags || [],
        createdAt: new Date().toISOString(),
    };

    // Step 1: Calculate significance
    const significance = calculateSignificance(memory);
    memory.significance = significance;

    // Step 2: Generate pseudo-vector embedding
    const vector = generateEmbedding(memory.content);
    memory.vectorHash = crypto.createHash("md5").update(vector.join(",")).digest("hex").slice(0, 12);

    // Step 3: Similarity check (dedup)
    const similar = findSimilar(vector, CONFIG.similarityThreshold);

    // Step 4: Decision
    let decision;
    if (similar) {
        decision = {
            action: "REJECTED",
            reason: "duplicate",
            detail: `Similar memory exists: ${similar.id} (similarity: ${similar.similarity.toFixed(3)})`,
            similarTo: similar.id,
        };
        stats.rejected++;
        stats.duplicatesBlocked++;
    } else if (significance < CONFIG.gainThreshold && !forceGain) {
        decision = {
            action: "REJECTED",
            reason: "low-significance",
            detail: `Significance ${significance.toFixed(3)} below threshold ${CONFIG.gainThreshold}`,
            threshold: CONFIG.gainThreshold,
        };
        stats.rejected++;
    } else {
        decision = {
            action: "GAINED",
            reason: forceGain ? "force-gain" : "meets-threshold",
            detail: `Significance ${significance.toFixed(3)} ≥ ${CONFIG.gainThreshold}`,
        };
        stats.gained++;

        // Store memory (in-memory + disk + Qdrant)
        memories.set(memory.id, memory);
        vectors.set(memory.id, vector);
        persistMemory(memory, vector);
        upsertToQdrant(memory, vector).catch(e => { /* non-critical */ });

        // Enforce max memories
        if (memories.size > CONFIG.maxMemories) {
            evictLowestSignificance();
        }
    }

    stats.lastDecision = decision.action;

    // Step 5: Audit report (ALWAYS)
    const auditEntry = {
        id: memory.id,
        ts: memory.createdAt,
        decision: decision.action,
        reason: decision.reason,
        detail: decision.detail,
        significance: significance.toFixed(4),
        type: memory.type,
        source: memory.source,
        contentPreview: memory.content.substring(0, 80),
        tags: memory.tags,
        memoryCount: memories.size,
        vectorCount: vectors.size,
        totalProcessed: stats.totalProcessed,
        gainRate: stats.totalProcessed > 0 ? ((stats.gained / stats.totalProcessed) * 100).toFixed(1) + "%" : "N/A",
    };
    auditLog.push(auditEntry);
    if (auditLog.length > 2000) auditLog.splice(0, auditLog.length - 2000);
    persistAudit(auditEntry);

    res.json({
        ok: true,
        service: "heady-memory",
        decision,
        memory: { id: memory.id, significance, type: memory.type },
        audit: auditEntry,
        stats: { gained: stats.gained, rejected: stats.rejected, total: stats.totalProcessed, gainRate: auditEntry.gainRate },
    });
});

// ── Recall memories by query ──
router.post("/recall", (req, res) => {
    const { query, type, limit, minSignificance } = req.body;
    if (!query) return res.status(400).json({ ok: false, error: "query required" });

    const queryVector = generateEmbedding(query);
    const results = [];

    for (const [id, vec] of vectors) {
        const sim = cosineSimilarity(queryVector, vec);
        const mem = memories.get(id);
        if (!mem) continue;
        if (type && mem.type !== type) continue;
        if (minSignificance && mem.significance < minSignificance) continue;
        results.push({ ...mem, similarity: sim });
    }

    results.sort((a, b) => b.similarity - a.similarity);
    const topK = results.slice(0, limit || 10);

    res.json({
        ok: true, service: "heady-memory", action: "recall",
        query, results: topK, totalSearched: vectors.size,
    });
});

// ── Memory stats and audit ──
router.get("/stats", (req, res) => {
    const byType = {};
    for (const [, mem] of memories) {
        byType[mem.type] = (byType[mem.type] || 0) + 1;
    }
    res.json({
        ok: true, service: "heady-memory",
        stats: {
            ...stats,
            byType,
            memoryCount: memories.size,
            vectorCount: vectors.size,
            gainRate: stats.totalProcessed > 0 ? ((stats.gained / stats.totalProcessed) * 100).toFixed(1) + "%" : "N/A",
            rejectionRate: stats.totalProcessed > 0 ? ((stats.rejected / stats.totalProcessed) * 100).toFixed(1) + "%" : "N/A",
        },
        config: CONFIG,
        ts: new Date().toISOString(),
    });
});

// ── Full audit log ──
router.get("/audit", (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const filter = req.query.filter; // "gained" or "rejected"
    let entries = auditLog;
    if (filter) entries = entries.filter(e => e.decision === filter.toUpperCase());
    res.json({
        ok: true, service: "heady-memory", action: "audit",
        entries: entries.slice(-limit),
        total: entries.length,
        gainedCount: auditLog.filter(e => e.decision === "GAINED").length,
        rejectedCount: auditLog.filter(e => e.decision === "REJECTED").length,
    });
});

// ── Memory report (gain vs reject summary) ──
router.get("/report", (req, res) => {
    const recent = auditLog.slice(-20);
    const gained = recent.filter(e => e.decision === "GAINED");
    const rejected = recent.filter(e => e.decision === "REJECTED");

    res.json({
        ok: true, service: "heady-memory",
        report: {
            period: "last-20-decisions",
            gained: { count: gained.length, entries: gained.map(e => ({ id: e.id, significance: e.significance, source: e.source, preview: e.contentPreview })) },
            rejected: { count: rejected.length, entries: rejected.map(e => ({ id: e.id, reason: e.reason, significance: e.significance, preview: e.contentPreview })) },
            retentionRate: recent.length > 0 ? ((gained.length / recent.length) * 100).toFixed(1) + "%" : "N/A",
            totalLifetime: { gained: stats.gained, rejected: stats.rejected, total: stats.totalProcessed },
        },
        ts: new Date().toISOString(),
    });
});

// ── Vector export for Qdrant/Vectorize ──
router.get("/vectors", (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const exports = [];
    let count = 0;
    for (const [id, vec] of vectors) {
        if (count >= limit) break;
        const mem = memories.get(id);
        if (!mem) continue;
        exports.push({
            id,
            vector: vec,
            payload: {
                content: mem.content,
                type: mem.type,
                source: mem.source,
                significance: mem.significance,
                tags: mem.tags,
                createdAt: mem.createdAt,
            },
        });
        count++;
    }
    res.json({
        ok: true, service: "heady-memory", format: "qdrant-vectorize-ready",
        dimensions: CONFIG.vectorDimensions, vectors: exports, total: vectors.size,
    });
});

// ── Bulk import ──
router.post("/import", (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ ok: false, error: "items array required" });

    let gained = 0, rejected = 0;
    for (const item of items.slice(0, 100)) {
        // Process each via the same pipeline
        const significance = calculateSignificance({ content: item.content || "", type: item.type || "semantic", source: item.source || "import", tags: item.tags || [] });
        if (significance >= CONFIG.gainThreshold) {
            const id = `mem-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
            const mem = { id, content: (item.content || "").substring(0, 2000), type: item.type || "semantic", source: item.source || "import", significance, createdAt: new Date().toISOString(), tags: item.tags || [] };
            const vec = generateEmbedding(mem.content);
            memories.set(id, mem);
            vectors.set(id, vec);
            gained++;
        } else { rejected++; }
    }
    stats.totalProcessed += items.length;
    stats.gained += gained;
    stats.rejected += rejected;
    res.json({ ok: true, imported: gained, rejected, total: items.length });
});

// ── Chat ingestion — extract knowledge from past conversations ──
router.post("/ingest-chat", (req, res) => {
    const { messages, chatId, source } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ ok: false, error: "messages array required" });

    const results = { gained: 0, rejected: 0, extracted: [] };

    for (const msg of messages) {
        const text = typeof msg === "string" ? msg : (msg.content || msg.text || "");
        const role = msg.role || "unknown";
        if (!text || text.length < 20) continue; // skip trivial messages

        // Extract knowledge units from each message
        const units = extractKnowledgeUnits(text, role);

        for (const unit of units) {
            const memory = {
                id: `mem-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
                content: unit.content.substring(0, 2000),
                type: unit.type,
                source: source || `chat-${chatId || "unknown"}`,
                context: `Extracted from ${role} message in chat ${chatId || "?"}`,
                tags: unit.tags,
                createdAt: new Date().toISOString(),
            };

            const significance = calculateSignificance(memory);
            memory.significance = significance;
            const vector = generateEmbedding(memory.content);
            memory.vectorHash = crypto.createHash("md5").update(vector.join(",")).digest("hex").slice(0, 12);

            const similar = findSimilar(vector, CONFIG.similarityThreshold);

            if (similar) {
                stats.rejected++; stats.duplicatesBlocked++; results.rejected++;
                persistAudit({ id: memory.id, ts: memory.createdAt, decision: "REJECTED", reason: "duplicate", detail: `Similar: ${similar.id}`, significance: significance.toFixed(4), type: memory.type, source: memory.source, contentPreview: memory.content.substring(0, 80), tags: memory.tags, memoryCount: memories.size, vectorCount: vectors.size, totalProcessed: ++stats.totalProcessed, gainRate: ((stats.gained / stats.totalProcessed) * 100).toFixed(1) + "%" });
            } else if (significance < CONFIG.gainThreshold) {
                stats.rejected++; results.rejected++;
                persistAudit({ id: memory.id, ts: memory.createdAt, decision: "REJECTED", reason: "low-significance", detail: `sig=${significance.toFixed(3)} < ${CONFIG.gainThreshold}`, significance: significance.toFixed(4), type: memory.type, source: memory.source, contentPreview: memory.content.substring(0, 80), tags: memory.tags, memoryCount: memories.size, vectorCount: vectors.size, totalProcessed: ++stats.totalProcessed, gainRate: ((stats.gained / stats.totalProcessed) * 100).toFixed(1) + "%" });
            } else {
                stats.gained++; results.gained++;
                memories.set(memory.id, memory);
                vectors.set(memory.id, vector);
                persistMemory(memory, vector);
                upsertToQdrant(memory, vector).catch(() => { });
                results.extracted.push({ id: memory.id, significance: significance.toFixed(3), type: unit.type, preview: memory.content.substring(0, 60) });
                persistAudit({ id: memory.id, ts: memory.createdAt, decision: "GAINED", reason: "chat-extraction", detail: `sig=${significance.toFixed(3)}`, significance: significance.toFixed(4), type: memory.type, source: memory.source, contentPreview: memory.content.substring(0, 80), tags: memory.tags, memoryCount: memories.size, vectorCount: vectors.size, totalProcessed: ++stats.totalProcessed, gainRate: ((stats.gained / stats.totalProcessed) * 100).toFixed(1) + "%" });
            }
        }
    }

    res.json({
        ok: true, service: "heady-memory", action: "ingest-chat",
        chatId: chatId || "unknown",
        messagesProcessed: messages.length,
        ...results,
        retentionRate: (results.gained + results.rejected) > 0 ? ((results.gained / (results.gained + results.rejected)) * 100).toFixed(1) + "%" : "N/A",
    });
});

// ── Qdrant status ──
router.get("/qdrant-status", async (req, res) => {
    try {
        const data = await qdrantRequest("GET", `/collections/${QDRANT_COLLECTION}`);
        res.json({
            ok: true, service: "heady-memory", qdrant: {
                collection: QDRANT_COLLECTION,
                pointsCount: data.result?.points_count || 0,
                vectorsCount: data.result?.vectors_count || 0,
                status: data.result?.status || "unknown",
                dimensions: CONFIG.vectorDimensions,
            },
        });
    } catch (err) {
        res.json({ ok: false, error: err.message });
    }
});

// ── Helpers ──

function calculateSignificance(memory) {
    let sig = 0.3; // base

    // Content length — longer = potentially more significant
    const len = (memory.content || "").length;
    if (len > 200) sig += 0.1;
    if (len > 500) sig += 0.1;

    // Type bonuses
    const typeBonus = { procedural: 0.15, episodic: 0.1, semantic: 0.05, contextual: 0.08 };
    sig += typeBonus[memory.type] || 0;

    // Source bonuses
    if (memory.source && memory.source !== "unknown") sig += 0.05;
    if (["heady-brain", "heady-soul", "user", "conversation"].includes(memory.source)) sig += 0.1;

    // Tags — more tags = more categorized = more useful
    if (memory.tags && memory.tags.length > 0) sig += Math.min(0.1, memory.tags.length * 0.02);

    // Novelty — unique words ratio
    const words = (memory.content || "").toLowerCase().split(/\s+/);
    const uniqueRatio = new Set(words).size / Math.max(words.length, 1);
    if (uniqueRatio > 0.7) sig += 0.05; // High vocabulary diversity

    return Math.min(1.0, sig);
}

function generateEmbedding(text) {
    // Deterministic pseudo-embedding from text content
    // In production, replace with Workers AI text-embeddings model
    const vec = new Float32Array(CONFIG.vectorDimensions);
    const hash = crypto.createHash("sha512").update(text).digest();
    for (let i = 0; i < CONFIG.vectorDimensions; i++) {
        const byte1 = hash[i % hash.length];
        const byte2 = hash[(i + 1) % hash.length];
        vec[i] = ((byte1 * 256 + byte2) / 65535) * 2 - 1;
    }
    // Normalize to unit vector
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    if (norm > 0) for (let i = 0; i < vec.length; i++) vec[i] /= norm;
    return Array.from(vec);
}

// CSL Resonance Layer — unified geometric similarity
function cosineSimilarity(a, b) {
    return CSL.cosine_similarity(a, b);
}

function findSimilar(queryVec, threshold) {
    let best = null, bestSim = 0;
    for (const [id, vec] of vectors) {
        // CSL Resonance Gate for deduplication
        const resonance = CSL.resonance_gate(queryVec, vec, threshold);
        if (resonance.score > bestSim && resonance.open) {
            bestSim = resonance.score;
            best = { id, similarity: resonance.score };
        }
    }
    return best;
}

function evictLowestSignificance() {
    let lowest = null, lowestSig = Infinity;
    for (const [id, mem] of memories) {
        if (mem.significance < lowestSig) {
            lowestSig = mem.significance;
            lowest = id;
        }
    }
    if (lowest) {
        memories.delete(lowest);
        vectors.delete(lowest);
    }
}

function persistMemory(memory, vector) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        // Store memory AND its vector embedding together so they survive restarts
        fs.appendFileSync(MEMORY_FILE, JSON.stringify({ ...memory, _vector: vector }) + "\n");
    } catch { /* non-critical */ }
}

function persistAudit(entry) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.appendFileSync(AUDIT_FILE, JSON.stringify(entry) + "\n");
    } catch { /* non-critical */ }
}

// ── Qdrant HTTP client ──
function qdrantRequest(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, QDRANT_URL);
        const options = {
            hostname: url.hostname, port: url.port || 6333,
            path: url.pathname, method,
            headers: { "Content-Type": "application/json" },
            timeout: 5000,
        };
        const req = http.request(options, (resp) => {
            let data = "";
            resp.on("data", c => { data += c; });
            resp.on("end", () => {
                try { resolve(JSON.parse(data)); } catch { reject(new Error("Invalid JSON from Qdrant")); }
            });
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("Qdrant timeout")); });
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function upsertToQdrant(memory, vector) {
    try {
        await qdrantRequest("PUT", `/collections/${QDRANT_COLLECTION}/points`, {
            points: [{
                id: crypto.createHash("md5").update(memory.id).digest("hex").substring(0, 8),
                vector: vector,
                payload: {
                    memoryId: memory.id,
                    content: memory.content,
                    type: memory.type,
                    source: memory.source,
                    significance: memory.significance,
                    tags: memory.tags,
                    createdAt: memory.createdAt,
                },
            }],
        });
    } catch (err) {
        // Qdrant write is best-effort, don't fail the memory process
        logger.logError('HCFP', `Qdrant upsert failed for ${memory.id}`, err);
    }
}

// ── Chat knowledge extraction ──
function extractKnowledgeUnits(text, role) {
    const units = [];
    const sentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > 30);

    // Strategy 1: Full message if it's substantial
    if (text.length > 100 && text.length <= 2000) {
        units.push({
            content: text.trim(),
            type: role === "user" ? "episodic" : "semantic",
            tags: detectTags(text),
        });
    } else if (text.length > 2000) {
        // Strategy 2: Split into semantic chunks for long messages
        for (let i = 0; i < sentences.length; i += 3) {
            const chunk = sentences.slice(i, i + 3).join(". ").trim();
            if (chunk.length > 50) {
                units.push({
                    content: chunk,
                    type: detectType(chunk, role),
                    tags: detectTags(chunk),
                });
            }
        }
    }

    return units;
}

function detectType(text, role) {
    const lower = text.toLowerCase();
    if (/how to|step \d|install|configure|setup|create/.test(lower)) return "procedural";
    if (/remember|preference|always|never|default/.test(lower)) return "contextual";
    if (/happened|yesterday|today|just now|we did/.test(lower)) return "episodic";
    return "semantic";
}

function detectTags(text) {
    const tags = [];
    const lower = text.toLowerCase();
    const tagMap = {
        architecture: /architect|design|pattern|system/,
        memory: /memory|vector|embed|store|recall/,
        infrastructure: /container|docker|podman|deploy|server/,
        cloudflare: /cloudflare|worker|pages|kv|r2|d1/,
        security: /auth|token|encrypt|ssl|cert/,
        performance: /speed|latency|cache|optimize|fast/,
        ai: /model|inference|llm|embedding|neural/,
        heady: /heady|buddy|brain|soul|conductor/,
    };
    for (const [tag, pattern] of Object.entries(tagMap)) {
        if (pattern.test(lower)) tags.push(tag);
    }
    return tags.slice(0, 5);
}

// Load persisted memories on startup
(function loadPersistedMemories() {
    try {
        if (fs.existsSync(MEMORY_FILE)) {
            const lines = fs.readFileSync(MEMORY_FILE, "utf8").split("\n").filter(Boolean);
            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    const vec = data._vector || null;
                    delete data._vector;
                    memories.set(data.id, data);
                    // Use persisted vector if available, otherwise regenerate
                    vectors.set(data.id, vec || generateEmbedding(data.content));
                    stats.gained++;
                    stats.totalProcessed++;
                } catch { /* skip malformed lines */ }
            }
            logger.logSystem(`  ∞ HeadyMemory: loaded ${memories.size} memories from disk`);
        }
    } catch { /* no persisted data yet */ }
})();

module.exports = router;
```
---

### `src/routes/shadow-memory-routes.js`

```javascript
/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Routes: Shadow Memory Persistence (HS-052)
 *
 * Express/Node.js compatible route handlers for the Exhale/Inhale protocol.
 * Mount with: app.use('/api/shadow-memory', require('./routes/shadow-memory-routes'));
 *
 * Endpoints:
 *   POST /exhale             — Persist state to vector DB
 *   POST /exhale/many        — Batch exhale multiple states
 *   POST /exhale/drain       — Pre-destruction drain
 *   POST /inhale             — Reconstitute state for a new node
 *   GET  /status             — System status
 *   GET  /projections        — List projection targets and sync status
 *   POST /projections        — Register a projection target
 *   DELETE /projections/:id  — Deregister a projection target
 *   POST /shards/rebalance   — Trigger Fibonacci shard rebalancing
 *   GET  /shards/summary     — Shard distribution summary
 */

'use strict';

const {
  ShadowMemorySystem,
  PROJECTION_TYPES,
  STORAGE_TIERS,
} = require('../memory/shadow-memory-persistence');

// Module-level singleton
let _system = null;

/**
 * Get or create the singleton ShadowMemorySystem.
 * @param {object} [opts]
 * @returns {ShadowMemorySystem}
 */
function getSystem(opts = {}) {
  if (!_system) _system = new ShadowMemorySystem(opts);
  return _system;
}

/**
 * Replace the singleton (for testing or reconfiguration).
 * @param {ShadowMemorySystem} instance
 */
function setSystem(instance) {
  _system = instance;
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

/**
 * POST /exhale
 * Body: { stateId: string, stateObject: object, opts?: { force?, tier? } }
 */
function exhale(req, res) {
  try {
    const { stateId, stateObject, opts = {} } = req.body || {};
    if (!stateId)     return res.status(400).json({ error: 'stateId is required' });
    if (!stateObject) return res.status(400).json({ error: 'stateObject is required' });

    const sys    = getSystem();
    const result = sys.exhale(stateId, stateObject, opts);
    return res.json({ ok: true, result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /exhale/many
 * Body: { entries: Array<{ stateId, stateObject, opts? }> }
 */
function exhaleMany(req, res) {
  try {
    const { entries = [] } = req.body || {};
    if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries must be an array' });

    const sys     = getSystem();
    const results = sys.exhaleModule.exhaleMany(entries);
    return res.json({ ok: true, count: results.length, results });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /exhale/drain
 * Body: { nodeId: string, pendingState: Array<{ stateId, stateObject }> }
 */
function drainOnDestruction(req, res) {
  try {
    const { nodeId, pendingState = [] } = req.body || {};
    if (!nodeId) return res.status(400).json({ error: 'nodeId is required' });

    const sys    = getSystem();
    const result = sys.exhaleModule.drainOnDestruction(nodeId, pendingState);
    return res.json({ ok: true, result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /inhale
 * Body: { nodeId: string, taskDescription: string, opts?: { k?, tierFilter? } }
 */
function inhale(req, res) {
  try {
    const { nodeId, taskDescription, opts = {} } = req.body || {};
    if (!nodeId)          return res.status(400).json({ error: 'nodeId is required' });
    if (!taskDescription) return res.status(400).json({ error: 'taskDescription is required' });

    const sys    = getSystem();
    const result = sys.inhaleModule.inhale(nodeId, taskDescription, opts);
    return res.json({ ok: true, result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * GET /status
 */
function status(req, res) {
  try {
    const sys = getSystem();
    return res.json({ ok: true, status: sys.status() });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * GET /projections
 */
function listProjections(req, res) {
  try {
    const sys     = getSystem();
    const targets = sys.projectionManager.listTargets();
    const inv     = sys.projectionManager.assertCanonicalInvariant();
    return res.json({ ok: true, targets, invariant: inv });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /projections
 * Body: { targetId: string, type: string, config?: object }
 */
function registerProjection(req, res) {
  try {
    const { targetId, type, config = {} } = req.body || {};
    if (!targetId) return res.status(400).json({ error: 'targetId is required' });
    if (!type)     return res.status(400).json({ error: 'type is required' });

    const sys    = getSystem();
    const result = sys.projectionManager.registerTarget(targetId, type, config);
    return res.status(201).json({ ok: true, result });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
}

/**
 * DELETE /projections/:id
 */
function deregisterProjection(req, res) {
  try {
    const { id } = req.params;
    const sys     = getSystem();
    const removed = sys.projectionManager.deregisterTarget(id);
    return res.json({ ok: true, removed });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /shards/rebalance
 */
function rebalanceShards(req, res) {
  try {
    const sys    = getSystem();
    const result = sys.shardManager.rebalance();
    return res.json({ ok: true, result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * GET /shards/summary
 */
function shardSummary(req, res) {
  try {
    const sys = getSystem();
    return res.json({ ok: true, summary: sys.shardManager.shardSummary() });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ─── Router Assembly ──────────────────────────────────────────────────────────

/**
 * Mount all Shadow Memory routes onto an Express router.
 * Usage: app.use('/api/shadow-memory', shadowMemoryRouter());
 *
 * @returns {object} Minimal Express-compatible router
 */
function shadowMemoryRouter() {
  // Minimal router for environments without Express loaded yet
  const routes = [
    { method: 'POST',   path: '/exhale',            handler: exhale },
    { method: 'POST',   path: '/exhale/many',        handler: exhaleMany },
    { method: 'POST',   path: '/exhale/drain',       handler: drainOnDestruction },
    { method: 'POST',   path: '/inhale',             handler: inhale },
    { method: 'GET',    path: '/status',             handler: status },
    { method: 'GET',    path: '/projections',        handler: listProjections },
    { method: 'POST',   path: '/projections',        handler: registerProjection },
    { method: 'DELETE', path: '/projections/:id',    handler: deregisterProjection },
    { method: 'POST',   path: '/shards/rebalance',   handler: rebalanceShards },
    { method: 'GET',    path: '/shards/summary',     handler: shardSummary },
  ];

  // Try to use Express router; fall back to a plain route-list export
  try {
    const express = require('express');
    const router  = express.Router();
    router.post  ('/exhale',            exhale);
    router.post  ('/exhale/many',       exhaleMany);
    router.post  ('/exhale/drain',      drainOnDestruction);
    router.post  ('/inhale',            inhale);
    router.get   ('/status',            status);
    router.get   ('/projections',       listProjections);
    router.post  ('/projections',       registerProjection);
    router.delete('/projections/:id',   deregisterProjection);
    router.post  ('/shards/rebalance',  rebalanceShards);
    router.get   ('/shards/summary',    shardSummary);
    return router;
  } catch {
    // Express not available — return route descriptor list
    return routes;
  }
}

module.exports = {
  shadowMemoryRouter,
  getSystem,
  setSystem,
  // Individual handlers exported for direct use / testing
  exhale,
  exhaleMany,
  drainOnDestruction,
  inhale,
  status,
  listProjections,
  registerProjection,
  deregisterProjection,
  rebalanceShards,
  shardSummary,
};
```
---

### `src/intelligence/duckdb-memory.js`

```javascript
/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * HeadyEmbeddedDuckDB — Production V2 Vector Memory
 * Real native DuckDB bindings with HNSW indexing and cosine similarity.
 */
const duckdb = require('../core/heady-duck');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DB_PATH = process.env.HEADY_MEMORY_DB || path.join(require('os').homedir(), '.headyme', 'heady-brain-v2.duckdb');
const logger = require("../utils/logger");

class HeadyEmbeddedDuckDB {
  constructor() {
    this.db = null;
    this.conn = null;
    this.initialized = false;
    this.dbPath = DB_PATH;
  }

  async init() {
    if (this.initialized) return;

    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    return new Promise((resolve, reject) => {
      this.db = new duckdb.Database(this.dbPath, (err) => {
        if (err) return reject(err);

        this.conn = this.db.connect();

        // Install and load VSS extension for vector similarity search
        this.conn.run("INSTALL vss; LOAD vss;", (err) => {
          if (err) {
            logger.warn(`⚠️ [DuckDB] VSS extension not available, falling back to manual cosine similarity: ${err.message}`);
          } else {
            logger.logSystem("💿 [DuckDB] VSS Extension loaded successfully.");
          }

          // Create the actual conversation vectors table
          this.conn.run(`
                        CREATE TABLE IF NOT EXISTS conversation_vectors (
                            id VARCHAR PRIMARY KEY,
                            ts BIGINT NOT NULL,
                            role VARCHAR NOT NULL DEFAULT 'user',
                            content TEXT NOT NULL,
                            embedding DOUBLE[],
                            token_count INTEGER DEFAULT 0,
                            session_id VARCHAR,
                            metadata JSON
                        );
                    `, (err) => {
            if (err) return reject(err);

            // Create index on timestamp for fast temporal queries
            this.conn.run(`
                            CREATE INDEX IF NOT EXISTS idx_vectors_ts ON conversation_vectors(ts);
                        `, () => {
              this.initialized = true;
              logger.logSystem(`🧠 [HeadyBrain V2] Production DuckDB Vector Store LIVE at ${this.dbPath}`);

              // Log table stats
              this.conn.all("SELECT COUNT(*) as cnt FROM conversation_vectors", (err, rows) => {
                if (!err && rows && rows.length > 0) {
                  logger.logSystem(`   → Existing vectors: ${rows[0].cnt}`);
                }
                resolve(true);
              });
            });
          });
        });
      });
    });
  }

  /**
   * Insert a new conversation turn into the production vector database.
   * @param {string} content The user message or AI response
   * @param {Array<number>} embedding The float array (any dimension)
   * @param {Object} metadata Additional context (role, timestamp, tokens, sessionId)
   */
  async insertVector(content, embedding, metadata = {}) {
    await this.init();

    if (!embedding || embedding.length === 0) {
      logger.warn("⚠️ [DuckDB] Insertion skipped: Empty embedding vector provided.");
      return null;
    }

    const id = crypto.randomUUID();
    const ts = metadata.timestamp || Date.now();
    const role = metadata.role || 'user';
    const tokenCount = metadata.tokens || 0;
    const sessionId = metadata.sessionId || 'default';
    const meta = JSON.stringify(metadata);

    return new Promise((resolve, reject) => {
      const embeddingStr = `[${embedding.join(',')}]`;
      this.conn.run(
        `INSERT INTO conversation_vectors (id, ts, role, content, embedding, token_count, session_id, metadata) 
                 VALUES (?, ?, ?, ?, ?::DOUBLE[], ?, ?, ?)`,
        [id, ts, role, content, embeddingStr, tokenCount, sessionId, meta],
        (err) => {
          if (err) {
            logger.error(`❌ [DuckDB] Insert failed: ${err.message}`);
            return reject(err);
          }
          resolve(id);
        }
      );
    });
  }

  /**
   * Query the production vector database for the top K most semantically similar memories.
   * Uses manual cosine similarity calculation for maximum compatibility.
   * @param {Array<number>} queryEmbedding The float array to search for
   * @param {number} topK Number of results to return
   * @returns {Array<Object>} The most relevant historical conversation turns
   */
  async similaritySearch(queryEmbedding, topK = 5) {
    await this.init();

    return new Promise((resolve, reject) => {
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      // Real cosine similarity via DuckDB list functions
      this.conn.all(`
                SELECT 
                    id, ts, role, content, token_count, session_id, metadata,
                    list_cosine_similarity(embedding, ?::DOUBLE[]) as similarity_score
                FROM conversation_vectors
                WHERE embedding IS NOT NULL
                ORDER BY similarity_score DESC
                LIMIT ?
            `, [embeddingStr, topK], (err, rows) => {
        if (err) {
          // Fallback: if list_cosine_similarity isn't available, use recent context
          logger.warn(`⚠️ [DuckDB] Cosine similarity failed, falling back to recency: ${err.message}`);
          this.conn.all(
            `SELECT id, ts, role, content, token_count, session_id, metadata 
                         FROM conversation_vectors 
                         ORDER BY ts DESC 
                         LIMIT ?`,
            [topK],
            (err2, rows2) => {
              if (err2) return reject(err2);
              resolve(rows2 || []);
            }
          );
          return;
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get total vector count in the database.
   */
  async getStats() {
    await this.init();
    return new Promise((resolve, reject) => {
      this.conn.all(`
                SELECT 
                    COUNT(*) as total_vectors,
                    COUNT(DISTINCT session_id) as total_sessions,
                    MIN(ts) as earliest,
                    MAX(ts) as latest
                FROM conversation_vectors
            `, (err, rows) => {
        if (err) return reject(err);
        resolve(rows[0] || { total_vectors: 0, total_sessions: 0 });
      });
    });
  }

  /**
   * For the conductor: Get the 3D spatial zone for a specific query text.
   * Uses keyword heuristics for sub-millisecond routing decisions.
   */
  async getZoneForQuery(queryText) {
    const q = (queryText || '').toLowerCase();
    if (q.includes("security") || q.includes("pqc") || q.includes("auth") || q.includes("encrypt")) {
      return { zoneId: "z-security", coordinate: [0.8, -0.2, 0.5] };
    }
    if (q.includes("react") || q.includes("ui") || q.includes("css") || q.includes("frontend")) {
      return { zoneId: "z-frontend", coordinate: [-0.6, 0.9, 0.1] };
    }
    if (q.includes("deploy") || q.includes("docker") || q.includes("cloud") || q.includes("infra")) {
      return { zoneId: "z-ops", coordinate: [0.3, 0.3, -0.8] };
    }
    if (q.includes("billing") || q.includes("stripe") || q.includes("payment")) {
      return { zoneId: "z-commerce", coordinate: [-0.1, -0.7, 0.6] };
    }
    return { zoneId: "z-general", coordinate: [0, 0, 0] };
  }

  /**
   * Graceful shutdown.
   */
  async close() {
    if (this.db) {
      return new Promise((resolve) => {
        this.db.close(() => {
          logger.logSystem("💿 [DuckDB] Database closed cleanly.");
          resolve();
        });
      });
    }
  }
}

// Export singleton instance
module.exports = new HeadyEmbeddedDuckDB();
```
---

### `src/core/csl-engine/csl-engine.js`

```javascript
/**
 * @fileoverview CSL Engine — Continuous Semantic Logic
 *
 * Heady Latent OS — Section 5: CSL & Geometric AI
 *
 * Core innovation: vector geometry as logical gates operating in 384-dimensional
 * (or 1536-dimensional) embedding space. All logic is geometric: alignment,
 * superposition, orthogonal projection, and cosine activation.
 *
 * Mathematical Foundation:
 *   - Domain: unit vectors in ℝᴰ, D ∈ {384, 1536}
 *   - Truth value: τ(a, b) = cos(θ) = (a·b) / (‖a‖·‖b‖) ∈ [-1, +1]
 *   - +1 = fully aligned (TRUE), 0 = orthogonal (UNKNOWN), -1 = antipodal (FALSE)
 *
 * References:
 *   - Birkhoff & von Neumann (1936): "The Logic of Quantum Mechanics"
 *   - Widdows (2003): "Orthogonal Negation in Vector Spaces" — ACL 2003
 *   - Grand et al. (2022): "Semantic projection" — Nature Human Behaviour
 *   - Fagin, Riegel, Gray (2024): "Foundations of reasoning with uncertainty" — PNAS
 *
 * @module csl-engine
 * @version 1.0.0
 * @patent Heady Connection — 60+ provisional patents on CSL techniques
 */

import { PHI, PSI, PHI_TEMPERATURE, CSL_THRESHOLDS, phiThreshold, EPSILON as PHI_EPSILON, adaptiveTemperature } from '../../shared/phi-math.js';

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default vector dimension for standard embedding models (e.g., all-MiniLM-L6-v2) */
const DEFAULT_DIM = 384;

/** Extended dimension for high-fidelity models (e.g., text-embedding-3-large) */
const LARGE_DIM = 1536;

/** Numerical epsilon: prevents division-by-zero and detects near-zero vectors.
 * Sourced from shared/phi-math.js PHI_EPSILON (same 1e-10 value, unified constant). */
const EPSILON = PHI_EPSILON; // from shared/phi-math.js

/** Threshold below which a vector is considered near-zero (degenerate) */
const ZERO_NORM_THRESHOLD = 1e-8;

/** Default gate threshold τ for GATE operation.
 * CSL_THRESHOLDS.MINIMUM ≈ 0.500 — noise floor for geometric truth activation. */
const DEFAULT_GATE_THRESHOLD = CSL_THRESHOLDS.MINIMUM; // ≈ 0.500 (CSL noise floor)

/** Default temperature τ for soft gating / softmax operations.
 * PHI_TEMPERATURE = PSI^3 ≈ 0.236 — phi-harmonic softness. */
const DEFAULT_TEMPERATURE = PHI_TEMPERATURE; // PSI^3 ≈ 0.236

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Compute the L2 norm (Euclidean length) of a vector.
 *
 * Formula: ‖a‖ = √(Σᵢ aᵢ²)
 *
 * @param {Float32Array|Float64Array|number[]} a - Input vector
 * @returns {number} L2 norm ≥ 0
 */
function norm(a) {
  let sum = 0.0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * a[i];
  }
  return Math.sqrt(sum);
}

/**
 * Normalize a vector to unit length (project onto unit hypersphere Sᴰ⁻¹).
 *
 * Formula: â = a / ‖a‖
 *
 * Returns the zero vector if ‖a‖ < ZERO_NORM_THRESHOLD (degenerate case).
 *
 * @param {Float32Array|Float64Array|number[]} a - Input vector
 * @returns {Float64Array} Unit vector, or zero vector if degenerate
 */
function normalize(a) {
  const n = norm(a);
  const result = new Float64Array(a.length);
  if (n < ZERO_NORM_THRESHOLD) {
    return result; // zero vector — caller should handle
  }
  const invN = 1.0 / n;
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] * invN;
  }
  return result;
}

/**
 * Compute the dot product of two equal-length vectors.
 *
 * Formula: a·b = Σᵢ aᵢ·bᵢ
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {Float32Array|Float64Array|number[]} b
 * @returns {number} Scalar dot product
 * @throws {Error} If vectors have different lengths
 */
function dot(a, b) {
  if (a.length !== b.length) {
    throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let sum = 0.0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Clamp a value to the interval [min, max].
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Add two vectors element-wise and return a new Float64Array.
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {Float32Array|Float64Array|number[]} b
 * @returns {Float64Array}
 */
function vectorAdd(a, b) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] + b[i];
  }
  return result;
}

/**
 * Subtract vector b from a element-wise.
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {Float32Array|Float64Array|number[]} b
 * @returns {Float64Array}
 */
function vectorSub(a, b) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] - b[i];
  }
  return result;
}

/**
 * Scale a vector by a scalar.
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {number} scalar
 * @returns {Float64Array}
 */
function vectorScale(a, scalar) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] * scalar;
  }
  return result;
}

// ─── CSLEngine Class ──────────────────────────────────────────────────────────

/**
 * CSLEngine — Continuous Semantic Logic Engine
 *
 * Implements all CSL logical gates as pure geometric operations on high-dimensional
 * vectors. All operations work on raw (unnormalized) input vectors and handle
 * normalization internally unless otherwise noted.
 *
 * All gate methods:
 *   1. Accept Float32Array, Float64Array, or number[] inputs
 *   2. Return Float64Array for gate outputs (or number for scalar outputs)
 *   3. Include full numerical stability handling
 *   4. Support batch operation via the batch* prefix methods
 *
 * @class
 * @example
 * const engine = new CSLEngine({ dim: 384 });
 * const score = engine.AND(vectorA, vectorB);     // cosine similarity ∈ [-1,1]
 * const union = engine.OR(vectorA, vectorB);       // normalized superposition
 * const negated = engine.NOT(vectorA, vectorB);    // semantic negation
 */
class CSLEngine {
  /** Golden ratio constant — accessible on class for downstream phi-arithmetic */
  static PHI = PHI;
  /** Golden ratio conjugate (1/Φ = Φ-1) — accessible on class */
  static PSI = PSI;

  /**
   * @param {Object} [options]
   * @param {number} [options.dim=384] - Vector dimension
   * @param {number} [options.epsilon=1e-10] - Numerical stability epsilon
   * @param {number} [options.gateThreshold=0.0] - Default threshold τ for GATE
   * @param {number} [options.temperature=1.0] - Default temperature for soft gates
   * @param {boolean} [options.normalizeInputs=true] - Auto-normalize inputs
   */
  constructor(options = {}) {
    this.dim = options.dim || DEFAULT_DIM;
    this.epsilon = options.epsilon || EPSILON;
    this.gateThreshold = options.gateThreshold !== undefined
      ? options.gateThreshold
      : DEFAULT_GATE_THRESHOLD;
    this.temperature = options.temperature || DEFAULT_TEMPERATURE;
    this.normalizeInputs = options.normalizeInputs !== false;

    // Runtime statistics for monitoring
    this._stats = {
      operationCount: 0,
      degenerateVectors: 0,
      gateActivations: 0,
    };
  }

  // ─── Core Gate Operations ──────────────────────────────────────────────────

  /**
   * CSL AND — Measures semantic alignment between two concept vectors.
   *
   * Mathematical formula:
   *   AND(a, b) = cos(θ_{a,b}) = (a·b) / (‖a‖·‖b‖)
   *
   * Interpretation:
   *   - Result ∈ [-1, +1]
   *   - +1: concepts are fully aligned ("both true in the same direction")
   *   - 0:  concepts are orthogonal ("independent / no relationship")
   *   - -1: concepts are antipodal ("contradictory / one negates the other")
   *
   * Logical analogy: "a AND b is true" ↔ cos(a, b) close to +1.
   * This is the soft AND: high only when both concepts are co-aligned.
   *
   * Properties:
   *   - Commutative: AND(a,b) = AND(b,a)
   *   - Bounded: result ∈ [-1, +1]
   *   - Scale invariant: AND(λa, b) = AND(a, b) for λ > 0
   *
   * Reference: Birkhoff & von Neumann (1936), quantum logic inner product.
   *
   * @param {Float32Array|Float64Array|number[]} a - First concept vector
   * @param {Float32Array|Float64Array|number[]} b - Second concept vector
   * @returns {number} Cosine similarity ∈ [-1, +1]
   */
  AND(a, b) {
    this._stats.operationCount++;
    const normA = norm(a);
    const normB = norm(b);

    if (normA < this.epsilon || normB < this.epsilon) {
      this._stats.degenerateVectors++;
      return 0.0; // degenerate: zero vectors are orthogonal to everything
    }

    const dotProduct = dot(a, b);
    return clamp(dotProduct / (normA * normB), -1.0, 1.0);
  }

  /**
   * CSL OR — Computes semantic superposition (soft union) of two concepts.
   *
   * Mathematical formula:
   *   OR(a, b) = normalize(a + b)
   *
   * The sum a + b creates a vector similar to both a and b — capturing the
   * "union" of semantic content. Normalization returns the result to the unit
   * sphere for subsequent operations.
   *
   * Interpretation:
   *   - The result vector points "between" a and b on the hypersphere
   *   - Its cosine similarity to both a and b is positive
   *   - For orthogonal a, b: result is at 45° to both (equal similarity)
   *   - For identical a = b: result is identical to a (idempotent in direction)
   *
   * Logical analogy: "a OR b" is the direction that captures either concept.
   *
   * Properties:
   *   - Commutative: OR(a,b) = OR(b,a)
   *   - Returns unit vector on Sᴰ⁻¹
   *   - Degenerate when a ≈ -b (antiparallel): returns zero vector
   *
   * Reference: HDC bundling operation; Boolean IR vector addition.
   *
   * @param {Float32Array|Float64Array|number[]} a - First concept vector
   * @param {Float32Array|Float64Array|number[]} b - Second concept vector
   * @returns {Float64Array} Normalized superposition vector (unit length)
   */
  OR(a, b) {
    this._stats.operationCount++;
    const sum = vectorAdd(a, b);
    const n = norm(sum);

    if (n < this.epsilon) {
      this._stats.degenerateVectors++;
      // a ≈ -b: concepts cancel. Return zero vector to signal cancellation.
      return new Float64Array(a.length);
    }

    return vectorScale(sum, 1.0 / n);
  }

  /**
   * CSL NOT — Semantic negation via orthogonal projection.
   *
   * Mathematical formula:
   *   NOT(a, b) = a - proj_b(a) = a - (a·b / ‖b‖²) · b
   *
   * For unit vectors ‖b‖ = 1:
   *   NOT(a, b) = a - (a·b) · b
   *
   * The result is the component of a that is orthogonal to b — removing
   * the semantic content of b from a.
   *
   * Interpretation:
   *   - "NOT(a, b)" means "a, but not the part that overlaps with b"
   *   - Example: NOT(cat_vector, persian_vector) → cat vector minus Persian traits
   *   - The result has zero cosine similarity with b (by construction)
   *   - Residual magnitude: ‖NOT(a,b)‖ = ‖a‖·sin(θ_{a,b})
   *
   * Idempotency:
   *   NOT(NOT(a,b), b) ≈ NOT(a,b) because the result is already in b⊥.
   *   More precisely: the projection of NOT(a,b) onto b is ≈ 0, so subtracting
   *   proj_b again leaves it unchanged. (Full proof in csl-mathematical-proofs.md)
   *
   * Similarity after negation (for normalized a, b):
   *   a · NOT(a, b) = 1 - (a·b)²
   *
   * Reference: Widdows (2003), ACL 2003, "Orthogonal Negation in Vector Spaces"
   *
   * @param {Float32Array|Float64Array|number[]} a - Query/source vector
   * @param {Float32Array|Float64Array|number[]} b - Concept to negate/remove
   * @param {boolean} [returnNormalized=true] - Whether to normalize the result
   * @returns {Float64Array} Vector with b's semantic content removed
   */
  NOT(a, b, returnNormalized = true) {
    this._stats.operationCount++;
    const normBSq = dot(b, b); // ‖b‖²

    if (normBSq < this.epsilon) {
      // b is near-zero: nothing to project out, return a (optionally normalized)
      return returnNormalized ? normalize(a) : new Float64Array(a);
    }

    // Projection coefficient: (a·b) / ‖b‖²
    const projCoeff = dot(a, b) / normBSq;

    // Remove projection: a - projCoeff·b
    const result = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] - projCoeff * b[i];
    }

    if (returnNormalized) {
      return normalize(result);
    }
    return result;
  }

  /**
   * CSL IMPLY — Geometric material implication via projection.
   *
   * Mathematical formula:
   *   IMPLY(a, b) = proj_b(a) = (a·b / ‖b‖²) · b
   *
   * For unit vectors:
   *   IMPLY(a, b) = (a·b) · b    [scalar times unit vector]
   *
   * The projection of a onto b captures "how much of a is contained in b" —
   * the geometric analog of material implication: degree to which a implies b.
   *
   * Interpretation:
   *   - Large projection → a strongly implies b (concepts highly co-directional)
   *   - Zero projection → a and b are independent (no implication)
   *   - Negative projection → a implies NOT b (antiparallel)
   *
   * Scalar implication strength: IMPLY_scalar(a,b) = a·b / ‖b‖ = cos(θ)·‖a‖
   *
   * Reference: Grand et al. (2022) semantic projection; Birkhoff-von Neumann.
   *
   * @param {Float32Array|Float64Array|number[]} a - Antecedent vector (hypothesis)
   * @param {Float32Array|Float64Array|number[]} b - Consequent vector (conclusion)
   * @returns {Float64Array} Projection of a onto span(b)
   */
  IMPLY(a, b) {
    this._stats.operationCount++;
    const normBSq = dot(b, b); // ‖b‖²

    if (normBSq < this.epsilon) {
      return new Float64Array(a.length); // zero consequent: no implication
    }

    const projCoeff = dot(a, b) / normBSq;
    return vectorScale(b, projCoeff);
  }

  /**
   * Scalar implication strength — returns the signed magnitude of implication.
   *
   * Formula: IMPLY_strength(a, b) = (a·b) / (‖a‖·‖b‖) = cos(θ_{a,b})
   *
   * Equivalent to AND(a, b) — the cosine similarity *is* the implication strength.
   *
   * @param {Float32Array|Float64Array|number[]} a - Antecedent
   * @param {Float32Array|Float64Array|number[]} b - Consequent
   * @returns {number} Implication strength ∈ [-1, +1]
   */
  IMPLY_scalar(a, b) {
    return this.AND(a, b);
  }

  /**
   * CSL XOR — Exclusive semantic content (symmetric difference).
   *
   * Mathematical formula:
   *   XOR(a, b) = normalize(a + b) - proj_mutual(a, b)
   *
   * More precisely, for unit vectors:
   *   XOR(a, b) = normalize( (a - proj_b(a)) + (b - proj_a(b)) )
   *             = normalize( a_⊥b + b_⊥a )
   *
   * Where a_⊥b is the component of a orthogonal to b (exclusive to a),
   * and b_⊥a is the component of b orthogonal to a (exclusive to b).
   *
   * Interpretation:
   *   - XOR captures what is unique to each concept (symmetric difference)
   *   - When a ≈ b: both exclusive components → 0, XOR → zero vector
   *   - When a ⊥ b: exclusive components = full vectors, XOR ≈ normalize(a + b)
   *   - "a XOR b" = concepts that appear in one but not both
   *
   * Properties:
   *   - Commutative: XOR(a,b) = XOR(b,a)
   *   - Anti-idempotent: XOR(a,a) → zero vector
   *
   * @param {Float32Array|Float64Array|number[]} a - First concept vector
   * @param {Float32Array|Float64Array|number[]} b - Second concept vector
   * @returns {Float64Array} Normalized exclusive semantic content
   */
  XOR(a, b) {
    this._stats.operationCount++;

    // a_⊥b: component of a orthogonal to b (NOT(a, b) unnormalized)
    const normBSq = dot(b, b);
    const normASq = dot(a, a);

    if (normASq < this.epsilon || normBSq < this.epsilon) {
      this._stats.degenerateVectors++;
      return new Float64Array(a.length);
    }

    const projAonB = dot(a, b) / normBSq;
    const projBonA = dot(a, b) / normASq; // Note: dot(b,a) = dot(a,b)

    // a_⊥b = a - proj_b(a)
    // b_⊥a = b - proj_a(b)
    const exclusive = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) {
      const a_excl = a[i] - projAonB * b[i];
      const b_excl = b[i] - projBonA * a[i];
      exclusive[i] = a_excl + b_excl;
    }

    const n = norm(exclusive);
    if (n < this.epsilon) {
      return new Float64Array(a.length); // a ≈ b: no exclusive content
    }

    return vectorScale(exclusive, 1.0 / n);
  }

  /**
   * CSL CONSENSUS — Weighted mean of agent/concept vectors (agreement).
   *
   * Mathematical formula:
   *   CONSENSUS({aᵢ}, {wᵢ}) = normalize( Σᵢ wᵢ · aᵢ )
   *
   * Uniform weights (default):
   *   CONSENSUS({aᵢ}) = normalize( (1/n) Σᵢ aᵢ )
   *
   * Interpretation:
   *   - Result is the centroid direction on the unit hypersphere
   *   - ‖Σ wᵢaᵢ‖ before normalization measures consensus strength:
   *     → ≈ 1: strong agreement (vectors nearly aligned)
   *     → ≈ 0: strong disagreement (vectors cancel out)
   *   - Consensus Quality metric: R = ‖(1/n)Σaᵢ‖ ∈ [0,1]
   *
   * Properties:
   *   - Commutative: order of vectors doesn't matter
   *   - Weights must be non-negative (negative weights invert contribution)
   *   - Returns zero vector when agents completely disagree
   *
   * Reference: HDC bundling operation; Roundtable Policy (arXiv 2509.16839)
   *
   * @param {Array<Float32Array|Float64Array|number[]>} vectors - Agent opinion vectors
   * @param {number[]} [weights] - Optional weights (uniform if omitted)
   * @returns {{ consensus: Float64Array, strength: number }}
   *   consensus: normalized consensus vector
   *   strength: R ∈ [0,1] measuring agreement level
   */
  CONSENSUS(vectors, weights = null) {
    this._stats.operationCount++;

    if (!vectors || vectors.length === 0) {
      throw new Error('CONSENSUS requires at least one vector');
    }

    const dim = vectors[0].length;
    const n = vectors.length;

    // Validate weights
    let w = weights;
    if (!w) {
      w = new Array(n).fill(1.0 / n);
    } else {
      if (w.length !== n) {
        throw new Error(`Weights length ${w.length} != vectors length ${n}`);
      }
      // Normalize weights to sum to 1
      const wSum = w.reduce((s, x) => s + x, 0);
      if (wSum < this.epsilon) {
        throw new Error('Weights must have positive sum');
      }
      w = w.map(x => x / wSum);
    }

    // Weighted sum
    const sum = new Float64Array(dim);
    for (let j = 0; j < n; j++) {
      const vec = vectors[j];
      const wj = w[j];
      for (let i = 0; i < dim; i++) {
        sum[i] += wj * vec[i];
      }
    }

    // Measure consensus strength before normalizing
    const strength = norm(sum);

    if (strength < this.epsilon) {
      this._stats.degenerateVectors++;
      return {
        consensus: new Float64Array(dim),
        strength: 0.0,
      };
    }

    const consensus = vectorScale(sum, 1.0 / strength);
    return { consensus, strength: clamp(strength, 0, 1) };
  }

  /**
   * CSL GATE — Threshold activation function using cosine similarity.
   *
   * Mathematical formula:
   *   GATE(input, gate_vector, τ) = θ( cos(input, gate_vector) - τ )
   *
   * Where θ is the Heaviside step function (hard gate) or sigmoid (soft gate):
   *   Hard:  GATE = 1  if cos(input, gate_vector) ≥ τ, else 0
   *   Soft:  GATE = σ( (cos(input, gate_vector) - τ) / temperature )
   *
   * The gate_vector defines a semantic "topic direction" in embedding space.
   * Inputs aligned with this direction (above threshold τ) pass the gate.
   *
   * Properties:
   *   - Bounded output: hard ∈ {0,1}, soft ∈ (0,1)
   *   - Scale invariant: GATE(λ·input, gate_vector, τ) = GATE(input, gate_vector, τ)
   *   - Differentiable (soft gate only)
   *   - Valid activation function: monotone, bounded, Lipschitz-continuous (soft)
   *
   * Proof that soft GATE is a valid activation function:
   *   (See csl-mathematical-proofs.md §4: CSL GATE Activation Properties)
   *
   * @param {Float32Array|Float64Array|number[]} input - Input vector to gate
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction vector
   * @param {number} [threshold=0.0] - Threshold τ ∈ [-1, +1]
   * @param {'hard'|'soft'} [mode='hard'] - Hard (step) or soft (sigmoid) gate
   * @param {number} [temperature=1.0] - Temperature for soft gate sharpness
   * @returns {{ activation: number, cosScore: number }}
   *   activation: gate output ∈ {0,1} (hard) or (0,1) (soft)
   *   cosScore: raw cosine similarity before thresholding
   */
  GATE(input, gateVector, threshold = null, mode = 'hard', temperature = null) {
    this._stats.operationCount++;

    const tau = threshold !== null ? threshold : this.gateThreshold;
    const temp = temperature !== null ? temperature : this.temperature;

    const cosScore = this.AND(input, gateVector);
    const shifted = cosScore - tau;

    let activation;
    if (mode === 'hard') {
      activation = shifted >= 0 ? 1 : 0;
    } else {
      // Soft (sigmoid) gate: σ(x) = 1 / (1 + e^{-x/temp})
      activation = 1.0 / (1.0 + Math.exp(-shifted / temp));
    }

    if (activation > 0) this._stats.gateActivations++;

    return { activation, cosScore };
  }

  /**
   * CSL NAND — NOT AND: semantic incompatibility gate.
   *
   * Formula: NAND(a, b) = 1 - max(0, AND(a, b))
   *          Maps high alignment → low output; low alignment → high output.
   *
   * @param {Float32Array|Float64Array|number[]} a
   * @param {Float32Array|Float64Array|number[]} b
   * @returns {number} NAND score ∈ [0, 1]
   */
  NAND(a, b) {
    const andScore = this.AND(a, b);
    return 1.0 - Math.max(0, andScore);
  }

  /**
   * CSL NOR — NOT OR: semantic exclusion gate.
   *
   * Returns normalized vector pointing away from the OR superposition.
   * Semantically: the concept that is distinct from both a and b.
   *
   * Formula: NOR(a,b) = normalize( -(a + b) )
   *                   = negate( OR(a, b) )
   *
   * @param {Float32Array|Float64Array|number[]} a
   * @param {Float32Array|Float64Array|number[]} b
   * @returns {Float64Array} Antipodal to OR(a,b)
   */
  NOR(a, b) {
    this._stats.operationCount++;
    const orVec = this.OR(a, b);
    return vectorScale(orVec, -1.0);
  }

  // ─── Projection Utilities ──────────────────────────────────────────────────

  /**
   * Project vector a onto the subspace spanned by a set of basis vectors.
   *
   * Uses Gram-Schmidt orthogonalization for numerical stability.
   *
   * Formula: proj_B(a) = Σᵢ (a·eᵢ) eᵢ
   * where {eᵢ} is an orthonormal basis for span(B), computed via Gram-Schmidt.
   *
   * @param {Float32Array|Float64Array|number[]} a - Vector to project
   * @param {Array<Float32Array|Float64Array|number[]>} basisVectors - Spanning set
   * @returns {Float64Array} Projection of a onto span(basisVectors)
   */
  projectOntoSubspace(a, basisVectors) {
    if (!basisVectors || basisVectors.length === 0) {
      return new Float64Array(a.length);
    }

    const dim = a.length;
    // Gram-Schmidt orthogonalization of basisVectors
    const orthoBasis = [];

    for (let j = 0; j < basisVectors.length; j++) {
      let vec = new Float64Array(basisVectors[j]);

      // Remove components along existing orthobasis
      for (const e of orthoBasis) {
        const coeff = dot(vec, e);
        for (let i = 0; i < dim; i++) {
          vec[i] -= coeff * e[i];
        }
      }

      const n = norm(vec);
      if (n > this.epsilon) {
        const unitVec = vectorScale(vec, 1.0 / n);
        orthoBasis.push(unitVec);
      }
    }

    // Project a onto orthobasis
    const projection = new Float64Array(dim);
    for (const e of orthoBasis) {
      const coeff = dot(a, e);
      for (let i = 0; i < dim; i++) {
        projection[i] += coeff * e[i];
      }
    }

    return projection;
  }

  /**
   * NOT against a subspace (multiple semantic concepts removed simultaneously).
   *
   * Formula: NOT(a, B) = a - proj_B(a)
   *
   * Removes all semantic content in span{b₁,...,bₙ} from a.
   *
   * @param {Float32Array|Float64Array|number[]} a - Source vector
   * @param {Array<Float32Array|Float64Array|number[]>} bVectors - Concepts to remove
   * @param {boolean} [returnNormalized=true]
   * @returns {Float64Array}
   */
  NOT_subspace(a, bVectors, returnNormalized = true) {
    this._stats.operationCount++;
    const projection = this.projectOntoSubspace(a, bVectors);
    const result = vectorSub(a, projection);
    return returnNormalized ? normalize(result) : result;
  }

  // ─── Batch Operations ──────────────────────────────────────────────────────

  /**
   * Batch AND — Compute cosine similarity of one vector against many.
   *
   * GPU-friendly: equivalent to a matrix-vector multiplication.
   * M[j] = a · B[j] / (‖a‖ · ‖B[j]‖) for each row B[j] in the matrix.
   *
   * @param {Float32Array|Float64Array|number[]} a - Query vector (1 × dim)
   * @param {Array<Float32Array|Float64Array|number[]>} bVectors - Corpus vectors (n × dim)
   * @returns {Float64Array} Similarity scores (n,) ∈ [-1,+1]
   */
  batchAND(a, bVectors) {
    const normA = norm(a);
    if (normA < this.epsilon) {
      return new Float64Array(bVectors.length);
    }

    const result = new Float64Array(bVectors.length);
    for (let j = 0; j < bVectors.length; j++) {
      const normB = norm(bVectors[j]);
      if (normB < this.epsilon) {
        result[j] = 0.0;
        continue;
      }
      result[j] = clamp(dot(a, bVectors[j]) / (normA * normB), -1.0, 1.0);
    }
    return result;
  }

  /**
   * Batch NOT — Remove concept b from an array of source vectors.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} aVectors - Source vectors
   * @param {Float32Array|Float64Array|number[]} b - Concept to negate
   * @param {boolean} [returnNormalized=true]
   * @returns {Array<Float64Array>} Array of negated vectors
   */
  batchNOT(aVectors, b, returnNormalized = true) {
    return aVectors.map(a => this.NOT(a, b, returnNormalized));
  }

  /**
   * Batch GATE — Apply semantic gate to an array of input vectors.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} inputs - Input vectors
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction
   * @param {number} [threshold=0.0] - Threshold τ
   * @param {'hard'|'soft'} [mode='hard']
   * @returns {Array<{ activation: number, cosScore: number }>}
   */
  batchGATE(inputs, gateVector, threshold = null, mode = 'hard') {
    return inputs.map(inp => this.GATE(inp, gateVector, threshold, mode));
  }

  /**
   * Batch IMPLY — Compute projection of each input onto the consequent.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} aVectors
   * @param {Float32Array|Float64Array|number[]} b - Consequent
   * @returns {Array<Float64Array>} Projections
   */
  batchIMPLY(aVectors, b) {
    return aVectors.map(a => this.IMPLY(a, b));
  }

  // ─── Advanced Logical Compositions ────────────────────────────────────────

  /**
   * CSL CONDITIONAL — Soft conditional probability: P(b|a) via geometric Bayes.
   *
   * Formula: P(b|a) ≈ AND(a,b) / AND(a,a) = cos(a,b) / 1 = cos(a,b)
   *          [for normalized vectors, this reduces to AND]
   *
   * For asymmetric conditional, use the projection magnitude:
   *   P(b|a) ≈ ‖proj_b(a)‖ / ‖a‖ = |cos(a,b)|
   *
   * @param {Float32Array|Float64Array|number[]} a - Antecedent
   * @param {Float32Array|Float64Array|number[]} b - Consequent
   * @returns {number} Conditional alignment ∈ [0, 1]
   */
  CONDITIONAL(a, b) {
    return Math.abs(this.AND(a, b));
  }

  /**
   * CSL ANALOGY — Completes an analogy: "a is to b as c is to ?"
   *
   * Formula: d = normalize( b - a + c )
   *   [vector arithmetic analogy, as in word2vec: king - man + woman ≈ queen]
   *
   * @param {Float32Array|Float64Array|number[]} a - Source concept
   * @param {Float32Array|Float64Array|number[]} b - Target concept
   * @param {Float32Array|Float64Array|number[]} c - Query concept
   * @returns {Float64Array} Analogy completion vector
   */
  ANALOGY(a, b, c) {
    this._stats.operationCount++;
    // d = normalize(b - a + c)
    const diff = vectorSub(b, a);
    const result = vectorAdd(diff, c);
    return normalize(result);
  }

  /**
   * Compute pairwise AND (cosine similarity matrix) for a set of vectors.
   *
   * Returns a symmetric matrix M where M[i][j] = cos(vectors[i], vectors[j]).
   * GPU-friendly: equivalent to normalized matrix multiplication V @ Vᵀ.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} vectors
   * @returns {Float64Array[]} n×n cosine similarity matrix (row-major)
   */
  pairwiseAND(vectors) {
    const n = vectors.length;
    const norms = vectors.map(v => norm(v));

    // Pre-allocate n×n matrix as array of Float64Arrays
    const matrix = Array.from({ length: n }, () => new Float64Array(n));

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1.0; // self-similarity
      for (let j = i + 1; j < n; j++) {
        const d = dot(vectors[i], vectors[j]);
        const normIJ = norms[i] * norms[j];
        const sim = normIJ < this.epsilon ? 0.0 : clamp(d / normIJ, -1.0, 1.0);
        matrix[i][j] = sim;
        matrix[j][i] = sim; // symmetric
      }
    }

    return matrix;
  }

  // ─── Statistics and Introspection ─────────────────────────────────────────

  /**
   * Retrieve runtime operation statistics.
   *
   * @returns {{ operationCount: number, degenerateVectors: number, gateActivations: number }}
   */
  getStats() {
    return { ...this._stats };
  }

  /**
   * Reset runtime statistics.
   */
  resetStats() {
    this._stats = { operationCount: 0, degenerateVectors: 0, gateActivations: 0 };
  }

  // ─── Phi-Harmonic Gate Extensions ───────────────────────────────────────────────

  /**
   * Phi-harmonic GATE — uses phiThreshold(level) from phi-math.js as threshold.
   *
   * phiThreshold(level) = 1 - PSI^level * 0.5:
   *   level=1 ≈ 0.691 (CSL LOW)
   *   level=2 ≈ 0.809 (CSL MEDIUM)
   *   level=3 ≈ 0.882 (CSL HIGH)
   *
   * Provides a geometrically scaled activation threshold aligned with
   * the sacred geometry resource allocation tiers.
   *
   * @param {Float32Array|Float64Array|number[]} input - Input vector
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction vector
   * @param {number} [level=2] - Phi threshold level (1–4)
   * @param {'hard'|'soft'} [mode='hard'] - Gate mode
   * @returns {{ activation: number, cosScore: number, threshold: number }}
   */
  phiGATE(input, gateVector, level = 2, mode = 'hard') {
    const threshold = phiThreshold(level); // e.g. level=2 ≈ 0.809 (MEDIUM)
    const result = this.GATE(input, gateVector, threshold, mode);
    return { ...result, threshold };
  }

  /**
   * Adaptive GATE — uses adaptiveTemperature(entropy, maxEntropy) for dynamic softness.
   *
   * Temperature = PSI^(1 + 2*(1 - H/Hmax)) from phi-math.js.
   * At max entropy (uniform distribution): temperature ≈ PSI (softest).
   * At zero entropy (deterministic):       temperature ≈ PSI^3 (sharpest = PHI_TEMPERATURE).
   *
   * @param {Float32Array|Float64Array|number[]} input - Input vector
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction vector
   * @param {number} entropy - Current routing entropy H (nats)
   * @param {number} maxEntropy - Maximum possible entropy Hmax = log(numExperts)
   * @returns {{ activation: number, cosScore: number, temperature: number }}
   */
  adaptiveGATE(input, gateVector, entropy, maxEntropy) {
    const temperature = adaptiveTemperature(entropy, maxEntropy);
    const result = this.GATE(input, gateVector, null, 'soft', temperature);
    return { ...result, temperature };
  }

  /**
   * Validate that a vector has the expected dimension and no NaN/Inf values.
   *
   * @param {Float32Array|Float64Array|number[]} vector
   * @param {number} [expectedDim] - Expected dimension (defaults to this.dim)
   * @returns {{ valid: boolean, issues: string[] }}
   */
  validateVector(vector, expectedDim = null) {
    const issues = [];
    const dim = expectedDim || this.dim;

    if (!vector || vector.length === 0) {
      issues.push('Vector is empty or null');
    } else {
      if (vector.length !== dim) {
        issues.push(`Dimension mismatch: got ${vector.length}, expected ${dim}`);
      }

      let hasNaN = false;
      let hasInf = false;
      for (let i = 0; i < vector.length; i++) {
        if (Number.isNaN(vector[i])) hasNaN = true;
        if (!Number.isFinite(vector[i])) hasInf = true;
      }
      if (hasNaN) issues.push('Vector contains NaN values');
      if (hasInf) issues.push('Vector contains Inf values');

      const n = norm(vector);
      if (n < ZERO_NORM_THRESHOLD) {
        issues.push('Vector is near-zero (degenerate)');
      }
    }

    return { valid: issues.length === 0, issues };
  }
}

// ─── Module Exports ────────────────────────────────────────────────────────────

module.exports = {
  CSLEngine,
  // Export utility functions for external use
  norm,
  normalize,
  dot,
  clamp,
  vectorAdd,
  vectorSub,
  vectorScale,
  // Export constants
  DEFAULT_DIM,
  LARGE_DIM,
  EPSILON,
  ZERO_NORM_THRESHOLD,
};
```
---

### `src/shared/sacred-geometry.js`

```javascript
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Sacred Geometry — shared/sacred-geometry.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Orchestration topology, node placement rings, coherence scoring,
 * Fibonacci resource allocation, and UI aesthetic constants.
 *
 * Every node, agent, and UI element follows geometric principles derived from φ.
 *
 * © HeadySystems Inc. — Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

'use strict';

const { PHI, PSI, CSL_THRESHOLDS, fib, phiFusionWeights, poolAllocation } = require('./phi-math');
const { cslAND, normalize, add } = require('./csl-engine');

// ─── Node Topology ───────────────────────────────────────────────────────────

/**
 * Geometric ring topology for the 20 AI nodes.
 * Central → Inner → Middle → Outer → Governance
 */
const NODE_RINGS = Object.freeze({
  CENTRAL: {
    radius: 0,
    nodes: ['HeadySoul'],
    role: 'Awareness and values layer — origin point',
  },
  INNER: {
    radius: 1,
    nodes: ['HeadyBrains', 'HeadyConductor', 'HeadyVinci'],
    role: 'Processing core — orchestration, reasoning, planning',
  },
  MIDDLE: {
    radius: PHI,
    nodes: ['JULES', 'BUILDER', 'ATLAS', 'NOVA', 'HeadyLens', 'StoryDriver'],
    role: 'Execution layer — coding, building, monitoring, documentation',
  },
  OUTER: {
    radius: PHI * PHI,
    nodes: ['HeadyScientist', 'HeadyMC', 'PatternRecognition', 'SelfCritique',
            'SASHA', 'Imagination', 'HCSupervisor', 'HCBrain'],
    role: 'Specialized capabilities — research, simulation, creativity, supervision',
  },
  GOVERNANCE: {
    radius: PHI * PHI * PHI,
    nodes: ['HeadyQA', 'HeadyCheck', 'HeadyRisk'],
    role: 'Quality, assurance, risk — governance shell',
  },
});

/**
 * All 20 node names in canonical order (center-out).
 */
const ALL_NODES = Object.freeze(
  Object.values(NODE_RINGS).flatMap(ring => ring.nodes)
);

/**
 * Lookup which ring a node belongs to.
 * @param {string} nodeName
 * @returns {string|null} Ring name or null
 */
function nodeRing(nodeName) {
  for (const [ringName, ring] of Object.entries(NODE_RINGS)) {
    if (ring.nodes.includes(nodeName)) return ringName;
  }
  return null;
}

/**
 * Geometric distance between two nodes based on ring positions.
 * Nodes in the same ring have distance = ring angular separation.
 * Nodes in different rings have distance = ring radius difference.
 * @param {string} nodeA
 * @param {string} nodeB
 * @returns {number}
 */
function nodeDistance(nodeA, nodeB) {
  const ringA = nodeRing(nodeA);
  const ringB = nodeRing(nodeB);
  if (!ringA || !ringB) return Infinity;

  const rA = NODE_RINGS[ringA];
  const rB = NODE_RINGS[ringB];

  if (ringA === ringB) {
    // Same ring: angular distance based on position index
    const idxA = rA.nodes.indexOf(nodeA);
    const idxB = rA.nodes.indexOf(nodeB);
    const angularDist = Math.abs(idxA - idxB) / rA.nodes.length;
    return rA.radius * angularDist * 2 * Math.PI / rA.nodes.length;
  }

  // Different rings: radius difference + minimal angular correction
  return Math.abs(rA.radius - rB.radius);
}

// ─── Coherence Scoring ───────────────────────────────────────────────────────

const COHERENCE_THRESHOLDS = Object.freeze({
  HEALTHY:   CSL_THRESHOLDS.HIGH,     // ≈ 0.882 — normal operating range
  WARNING:   CSL_THRESHOLDS.MEDIUM,   // ≈ 0.809 — slight drift
  DEGRADED:  CSL_THRESHOLDS.LOW,      // ≈ 0.691 — significant drift
  CRITICAL:  CSL_THRESHOLDS.MINIMUM,  // ≈ 0.500 — system integrity at risk
});

/**
 * Compute coherence between two node state embeddings.
 * @param {Float64Array|number[]} stateA
 * @param {Float64Array|number[]} stateB
 * @returns {{ score: number, status: string }}
 */
function coherenceScore(stateA, stateB) {
  const score = cslAND(stateA, stateB);
  let status;
  if (score >= COHERENCE_THRESHOLDS.HEALTHY)   status = 'HEALTHY';
  else if (score >= COHERENCE_THRESHOLDS.WARNING)   status = 'WARNING';
  else if (score >= COHERENCE_THRESHOLDS.DEGRADED)  status = 'DEGRADED';
  else status = 'CRITICAL';
  return { score, status };
}

/**
 * Compute system-wide coherence by averaging all pairwise node scores.
 * @param {Map<string, Float64Array|number[]>} nodeStates - Map of node name → state vector
 * @returns {{ overall: number, status: string, drifted: string[] }}
 */
function systemCoherence(nodeStates) {
  const nodes = Array.from(nodeStates.keys());
  const drifted = [];
  let totalScore = 0;
  let pairCount = 0;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const { score, status } = coherenceScore(
        nodeStates.get(nodes[i]),
        nodeStates.get(nodes[j])
      );
      totalScore += score;
      pairCount++;
      if (status === 'CRITICAL' || status === 'DEGRADED') {
        drifted.push(`${nodes[i]}<->${nodes[j]} (${score.toFixed(3)} ${status})`);
      }
    }
  }

  const overall = pairCount > 0 ? totalScore / pairCount : 0;
  let status;
  if (overall >= COHERENCE_THRESHOLDS.HEALTHY)  status = 'HEALTHY';
  else if (overall >= COHERENCE_THRESHOLDS.WARNING)  status = 'WARNING';
  else if (overall >= COHERENCE_THRESHOLDS.DEGRADED) status = 'DEGRADED';
  else status = 'CRITICAL';

  return { overall, status, drifted };
}

// ─── Pool Scheduling ─────────────────────────────────────────────────────────

/**
 * Hot/Warm/Cold pool definitions with Fibonacci resource ratios.
 */
const POOL_CONFIG = Object.freeze({
  HOT: {
    name: 'hot',
    purpose: 'User-facing, latency-critical tasks',
    resourcePct: fib(9),   // 34%
    maxConcurrency: fib(8), // 21
    timeoutMs: 5000,
    priority: 0,
  },
  WARM: {
    name: 'warm',
    purpose: 'Background processing, non-urgent tasks',
    resourcePct: fib(8),   // 21%
    maxConcurrency: fib(7), // 13
    timeoutMs: 30000,
    priority: 1,
  },
  COLD: {
    name: 'cold',
    purpose: 'Ingestion, analytics, batch processing',
    resourcePct: fib(7),   // 13%
    maxConcurrency: fib(6), // 8
    timeoutMs: 120000,
    priority: 2,
  },
  RESERVE: {
    name: 'reserve',
    purpose: 'Burst capacity for overload conditions',
    resourcePct: fib(6),   // 8%
    maxConcurrency: fib(5), // 5
    timeoutMs: 60000,
    priority: 3,
  },
  GOVERNANCE: {
    name: 'governance',
    purpose: 'Health checks, auditing, compliance',
    resourcePct: fib(5),   // 5%
    maxConcurrency: fib(4), // 3
    timeoutMs: 10000,
    priority: 4,
  },
});

/**
 * Assign a task to the appropriate pool based on priority and type.
 * @param {object} task
 * @param {string} task.type - 'user-facing' | 'background' | 'batch' | 'burst' | 'governance'
 * @param {number} [task.urgency=0.5] - 0–1 urgency score
 * @returns {string} Pool name
 */
function assignPool(task) {
  const urgency = task.urgency || 0.5;
  switch (task.type) {
    case 'user-facing': return 'HOT';
    case 'governance':  return 'GOVERNANCE';
    case 'burst':       return 'RESERVE';
    case 'batch':       return 'COLD';
    case 'background':
      return urgency >= CSL_THRESHOLDS.MEDIUM ? 'WARM' : 'COLD';
    default:
      return urgency >= CSL_THRESHOLDS.HIGH ? 'HOT' : 'WARM';
  }
}

// ─── UI Aesthetic Constants ──────────────────────────────────────────────────

const UI = Object.freeze({
  // Typography scale: φ-based
  TYPE_SCALE: {
    xs:    Math.round(16 / PHI / PHI),  // ≈ 6
    sm:    Math.round(16 / PHI),        // ≈ 10
    base:  16,
    lg:    Math.round(16 * PHI),        // ≈ 26
    xl:    Math.round(16 * PHI * PHI),  // ≈ 42
    '2xl': Math.round(16 * PHI * PHI * PHI), // ≈ 68
  },

  // Fibonacci spacing (px)
  SPACING: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89],

  // Layout ratios
  LAYOUT: {
    primaryWidth:   `${(PSI * 100).toFixed(2)}%`,      // ≈ 61.80%
    secondaryWidth: `${((1 - PSI) * 100).toFixed(2)}%`, // ≈ 38.20%
    goldenSection:  PSI,
  },

  // Color harmony: golden angle ≈ 137.508° for complementary hues
  GOLDEN_ANGLE: 360 / (PHI * PHI), // ≈ 137.508°

  // Brand colors
  COLORS: {
    primary:    '#6C63FF', // Heady Purple
    secondary:  '#FF6584', // Accent Pink
    success:    '#00C9A7', // Sacred Green
    warning:    '#FFB800', // Gold
    danger:     '#FF4757', // Alert Red
    background: '#0F0E17', // Deep Space
    surface:    '#1A1928', // Card Surface
    text:       '#FFFFFE', // Pure White
    muted:      '#94A1B2', // Muted
  },

  // Animation timing (phi-based easing)
  TIMING: {
    instant:  fib(4) * 10,  // 30ms
    fast:     fib(5) * 10,  // 50ms
    normal:   fib(7) * 10,  // 130ms
    slow:     fib(8) * 10,  // 210ms
    glacial:  fib(9) * 10,  // 340ms
  },
});

// ─── Bee Worker Limits ───────────────────────────────────────────────────────

const BEE_LIMITS = Object.freeze({
  maxConcurrentBees:  fib(8),  // 21
  maxQueueDepth:      fib(13), // 233
  beeTimeoutMs:       fib(9) * 1000, // 34 seconds
  maxRetries:         fib(5),  // 5
  healthCheckIntervalMs: fib(7) * 1000, // 13 seconds
  registryCapacity:   fib(10), // 55 registered bee types
});

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Topology
  NODE_RINGS, ALL_NODES, nodeRing, nodeDistance,

  // Coherence
  COHERENCE_THRESHOLDS, coherenceScore, systemCoherence,

  // Pool scheduling
  POOL_CONFIG, assignPool, poolAllocation,

  // UI aesthetics
  UI,

  // Bee limits
  BEE_LIMITS,
};
```
---

### `src/analytics/continuous-action-analyzer.js`

```javascript
/**
 * Continuous Action Analyzer
 *
 * Tracks every task execution, user action, and environmental parameter
 * to learn deterministic patterns and enforce them.
 *
 * Features:
 *   - Rolling window of action vectors for drift/pattern detection
 *   - Phi-scaled thresholds trigger auto-reconfig when determinism degrades
 *   - Learns optimal LLM params from execution history
 *   - Emits action:learned / action:drift / action:reconfig events
 *
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');

const PHI = 1.6180339887;
const PSI = 1 / PHI;
const PSI_SQ = PSI * PSI;

const WINDOW_SIZE = 50;          // rolling window for pattern detection
const DRIFT_THRESHOLD = PSI_SQ;  // 0.382 — alert when uniqueness exceeds this
const LEARN_THRESHOLD = 10;      // min actions before learning kicks in

class ContinuousActionAnalyzer extends EventEmitter {

    constructor(opts = {}) {
        super();
        this._windowSize = opts.windowSize || WINDOW_SIZE;
        this._actions = [];            // rolling window of action records
        this._allActions = [];         // full history (capped at 10k)
        this._patterns = new Map();    // domain → learned pattern
        this._driftWindow = [];        // rolling output hash window
        this._stats = {
            totalActions: 0,
            learnedPatterns: 0,
            driftAlerts: 0,
            reconfigs: 0,
            avgConfidence: 0,
            avgLatency: 0,
        };
    }

    /**
     * Record a task execution action.
     * @param {Object} action - { taskId, domain, inputHash, outputHash, provider, model, latencyMs, confidence, simScore, battleWon, mcDeterminism }
     */
    record(action) {
        const entry = {
            ...action,
            ts: Date.now(),
            actionHash: crypto.createHash('sha256')
                .update(JSON.stringify(action))
                .digest('hex').slice(0, 16),
        };

        this._actions.push(entry);
        if (this._actions.length > this._windowSize) this._actions.shift();

        this._allActions.push(entry);
        if (this._allActions.length > 10000) this._allActions.shift();

        this._stats.totalActions++;
        this._updateRunningStats(entry);

        // Check drift
        this._driftWindow.push(entry.outputHash);
        if (this._driftWindow.length > this._windowSize) this._driftWindow.shift();
        const driftResult = this._checkDrift();
        if (driftResult.drifting) {
            this._stats.driftAlerts++;
            this.emit('action:drift', { entry, ...driftResult });
        }

        // Learn patterns after threshold
        if (this._actions.length >= LEARN_THRESHOLD) {
            this._learnPatterns();
        }

        this.emit('action:recorded', entry);
        return entry;
    }

    /**
     * Record a user action (click, navigation, input, etc.)
     * @param {Object} userAction - { type, target, value, sessionId }
     */
    recordUserAction(userAction) {
        return this.record({
            taskId: `user-${userAction.type}`,
            domain: 'user-interaction',
            inputHash: crypto.createHash('sha256').update(JSON.stringify(userAction)).digest('hex').slice(0, 16),
            outputHash: 'user-action',
            provider: 'user',
            model: 'human',
            latencyMs: 0,
            confidence: 1.0,
            simScore: 1.0,
            battleWon: true,
            mcDeterminism: 1.0,
            ...userAction,
        });
    }

    /**
     * Record an environmental parameter change.
     * @param {Object} envParam - { key, value, previousValue, source }
     */
    recordEnvironmental(envParam) {
        return this.record({
            taskId: `env-${envParam.key}`,
            domain: 'environmental',
            inputHash: crypto.createHash('sha256').update(`${envParam.key}=${envParam.value}`).digest('hex').slice(0, 16),
            outputHash: crypto.createHash('sha256').update(String(envParam.value)).digest('hex').slice(0, 16),
            provider: envParam.source || 'system',
            model: 'env',
            latencyMs: 0,
            confidence: 1.0,
            simScore: 1.0,
            battleWon: true,
            mcDeterminism: 1.0,
            ...envParam,
        });
    }

    // ─── Drift Detection ──────────────────────────────────────────────────

    _checkDrift() {
        if (this._driftWindow.length < 5) {
            return { drifting: false, driftScore: 0, prediction: 'insufficient_data' };
        }

        const unique = new Set(this._driftWindow).size;
        const driftScore = (unique - 1) / (this._driftWindow.length - 1);

        const drifting = driftScore > DRIFT_THRESHOLD;
        const prediction = driftScore === 0 ? 'perfectly_deterministic' :
            driftScore <= PSI_SQ ? 'stable' :
                driftScore <= PSI ? 'moderate_drift' : 'severe_drift';

        if (drifting) {
            const reconfig = this._generateReconfig(driftScore);
            this._stats.reconfigs++;
            this.emit('action:reconfig', reconfig);
        }

        return { drifting, driftScore: +driftScore.toFixed(4), prediction, windowSize: this._driftWindow.length };
    }

    // ─── Pattern Learning ─────────────────────────────────────────────────

    _learnPatterns() {
        // Group recent actions by domain
        const byDomain = {};
        for (const a of this._actions) {
            if (!byDomain[a.domain]) byDomain[a.domain] = [];
            byDomain[a.domain].push(a);
        }

        for (const [domain, actions] of Object.entries(byDomain)) {
            if (actions.length < 3) continue;

            const avgConf = actions.reduce((s, a) => s + (a.confidence || 0), 0) / actions.length;
            const avgLat = actions.reduce((s, a) => s + (a.latencyMs || 0), 0) / actions.length;
            const avgSim = actions.reduce((s, a) => s + (a.simScore || 0), 0) / actions.length;
            const avgMC = actions.reduce((s, a) => s + (a.mcDeterminism || 0), 0) / actions.length;
            const winRate = actions.filter(a => a.battleWon).length / actions.length;

            // Find most common provider/model
            const providerCounts = {};
            for (const a of actions) {
                const key = `${a.provider}/${a.model}`;
                providerCounts[key] = (providerCounts[key] || 0) + 1;
            }
            const bestProvider = Object.entries(providerCounts).sort((a, b) => b[1] - a[1])[0];

            const pattern = {
                domain,
                count: actions.length,
                avgConfidence: +avgConf.toFixed(4),
                avgLatencyMs: +avgLat.toFixed(0),
                avgSimScore: +avgSim.toFixed(4),
                avgMCDeterminism: +avgMC.toFixed(4),
                winRate: +winRate.toFixed(4),
                bestProviderModel: bestProvider ? bestProvider[0] : 'unknown',
                recommendedConfig: {
                    temperature: avgMC >= PSI ? 0 : 0.1,
                    seed: 42,
                    top_p: 1,
                    preferredModel: bestProvider ? bestProvider[0] : null,
                },
                learnedAt: Date.now(),
            };

            const isNew = !this._patterns.has(domain);
            this._patterns.set(domain, pattern);
            if (isNew) {
                this._stats.learnedPatterns++;
                this.emit('action:learned', pattern);
            }
        }
    }

    // ─── Reconfiguration ──────────────────────────────────────────────────

    _generateReconfig(driftScore) {
        const steps = [];

        if (driftScore > PSI) {
            steps.push('CRITICAL: Lock all LLM params — temperature=0, seed=42, top_p=1');
            steps.push('Switch to single-model mode (disable racing) to reduce variance');
            steps.push('Enable full replay cache to serve deterministic responses');
        } else if (driftScore > PSI_SQ) {
            steps.push('WARNING: Increase MC sampling iterations to detect boundary');
            steps.push('Tighten CSL confidence threshold to φ⁻¹ (0.618)');
            steps.push('Enable output comparison logging for drift root-cause analysis');
        }

        return {
            action: driftScore > PSI ? 'lock_deterministic' : 'stabilize',
            driftScore: +driftScore.toFixed(4),
            steps,
            newConfig: {
                temperature: 0,
                seed: 42,
                top_p: 1,
                mcIterations: Math.ceil(5 * (1 + driftScore)),
                cslThreshold: driftScore > PSI ? PSI : PSI_SQ,
            },
            ts: Date.now(),
        };
    }

    // ─── Public API ─────────────────────────────────────────────────────

    /** Get current stats */
    getStats() {
        return { ...this._stats };
    }

    /** Get learned patterns for all domains */
    getPatterns() {
        return Object.fromEntries(this._patterns);
    }

    /** Get pattern for a specific domain */
    getPattern(domain) {
        return this._patterns.get(domain) || null;
    }

    /** Get recent actions */
    getRecentActions(n = 10) {
        return this._actions.slice(-n);
    }

    /** Get comprehensive determinism report */
    getDeterminismReport() {
        const patterns = this.getPatterns();
        const domains = Object.keys(patterns);
        const avgDeterminism = domains.length > 0
            ? domains.reduce((s, d) => s + patterns[d].avgMCDeterminism, 0) / domains.length
            : 0;

        return {
            totalActions: this._stats.totalActions,
            learnedDomains: domains.length,
            avgDeterminism: +avgDeterminism.toFixed(4),
            driftAlerts: this._stats.driftAlerts,
            reconfigs: this._stats.reconfigs,
            patterns,
            recommendation: avgDeterminism >= PSI ? 'System is deterministic — maintain current config' :
                avgDeterminism >= PSI_SQ ? 'Marginal determinism — consider tightening params' :
                    'Low determinism — lock all params and enable replay cache',
        };
    }

    /** Force reconfigure based on current state */
    forceReconfig() {
        const drift = this._checkDrift();
        if (!drift.drifting) {
            return { action: 'none', reason: 'No drift detected — system is stable' };
        }
        return this._generateReconfig(drift.driftScore);
    }

    // ─── Internal ─────────────────────────────────────────────────────────

    _updateRunningStats(entry) {
        const n = this._stats.totalActions;
        this._stats.avgConfidence = ((this._stats.avgConfidence * (n - 1)) + (entry.confidence || 0)) / n;
        this._stats.avgLatency = ((this._stats.avgLatency * (n - 1)) + (entry.latencyMs || 0)) / n;
    }
}

module.exports = { ContinuousActionAnalyzer, WINDOW_SIZE, DRIFT_THRESHOLD, LEARN_THRESHOLD, PHI, PSI, PSI_SQ };
```
---
