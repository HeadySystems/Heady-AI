/**
 * CQRS Read Model — Vector Memory Read Optimization
 * Eric Haywood — Sacred Geometry v4.0
 *
 * Separates read and write paths for vector memory:
 * - Writes: go to pgvector via heady-embed (primary)
 * - Reads: go to optimized read replicas with materialized views
 *
 * Eliminates write contention during high-volume embedding operations.
 * Uses Fibonacci-sized LRU cache for hot-path reads.
 */
'use strict';

const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const FIB = [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];

class LRUCache {
  constructor(maxSize = FIB[16]) { // 987 entries
    this.maxSize = maxSize;
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    if (this.cache.has(key)) {
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value); // Move to end (most recent)
      this.hits++;
      return value;
    }
    this.misses++;
    return null;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }
    this.cache.set(key, { value, cachedAt: Date.now() });
  }

  invalidate(key) {
    this.cache.delete(key);
  }

  invalidateByDomain(domain) {
    for (const [key, entry] of this.cache) {
      if (entry.value && entry.value.domain === domain) {
        this.cache.delete(key);
      }
    }
  }

  stats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? Math.round((this.hits / total) * 10000) / 10000 : 0,
    };
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

class CQRSReadModel {
  constructor(config = {}) {
    this.writePool = config.writePool || null; // pgvector write connection
    this.readPool = config.readPool || null;   // read replica connection
    this.cache = new LRUCache(config.cacheSize || FIB[16]);
    this.staleTtlMs = config.staleTtlMs || FIB[8] * 1000; // 21s
  }

  /**
   * Write path: always goes to primary pgvector.
   * Invalidates cache for the affected domain.
   */
  async write(content, embedding, domain, metadata = {}, importance = PSI) {
    if (!this.writePool) {
      throw new Error('Write pool not configured — CQRS requires separate write connection');
    }

    const result = await this.writePool.query(
      `INSERT INTO vector_memory (content, embedding, domain, metadata, importance)
       VALUES ($1, $2::vector, $3, $4::jsonb, $5)
       RETURNING id, domain, importance`,
      [content, `[${embedding.join(',')}]`, domain, JSON.stringify(metadata), importance]
    );

    // Invalidate read cache for this domain
    this.cache.invalidateByDomain(domain);

    return result.rows[0];
  }

  /**
   * Read path: checks LRU cache first, then read replica.
   * Falls back to primary if replica is unavailable.
   */
  async search(queryEmbedding, domain, topK = FIB[8], minScore = PSI * PSI) {
    const cacheKey = `search:${domain}:${queryEmbedding.slice(0, 5).join(',')}:${topK}`;
    const cached = this.cache.get(cacheKey);

    if (cached && (Date.now() - cached.cachedAt) < this.staleTtlMs) {
      return { ...cached.value, fromCache: true };
    }

    const pool = this.readPool || this.writePool;
    if (!pool) {
      throw new Error('No database pool configured');
    }

    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    const result = await pool.query(
      `SELECT id, content, domain, metadata, importance,
              1 - (embedding <=> $1::vector) AS score
       FROM vector_memory
       WHERE domain = $2
         AND 1 - (embedding <=> $1::vector) > $3
       ORDER BY embedding <=> $1::vector
       LIMIT $4`,
      [embeddingStr, domain, minScore, topK]
    );

    const response = {
      results: result.rows,
      total: result.rows.length,
      search_time_ms: 0, // Would be set from pg timing
    };

    this.cache.set(cacheKey, response);
    return { ...response, fromCache: false };
  }

  /**
   * Materialized view refresh — call on a phi-scaled interval.
   */
  async refreshMaterializedViews() {
    if (!this.readPool && !this.writePool) return;
    const pool = this.readPool || this.writePool;

    const views = [
      'REFRESH MATERIALIZED VIEW CONCURRENTLY IF EXISTS mv_domain_stats',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY IF EXISTS mv_hot_vectors',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY IF EXISTS mv_entity_graph',
    ];

    for (const sql of views) {
      try {
        await pool.query(sql);
      } catch (err) {
        // View may not exist yet — this is expected on first run
        process.stdout.write(JSON.stringify({
          level: 'WARN',
          message: `Materialized view refresh skipped: ${err.message}`,
          timestamp: new Date().toISOString(),
        }) + '\n');
      }
    }
  }

  stats() {
    return {
      cache: this.cache.stats(),
      staleTtlMs: this.staleTtlMs,
      hasWritePool: !!this.writePool,
      hasReadPool: !!this.readPool,
    };
  }
}

// SQL for creating materialized views (run via migration-service)
const MATERIALIZED_VIEW_SQL = `
-- Domain statistics view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_domain_stats AS
SELECT domain,
       count(*) as vector_count,
       avg(importance) as avg_importance,
       max(updated_at) as last_updated
FROM vector_memory
GROUP BY domain;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_domain_stats ON mv_domain_stats(domain);

-- Hot vectors (high importance, recently accessed)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_hot_vectors AS
SELECT id, content, embedding, domain, importance, access_count
FROM vector_memory
WHERE importance > 0.618
  AND access_count > 5
ORDER BY importance DESC, access_count DESC
LIMIT 987;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_hot_vectors ON mv_hot_vectors(id);

-- Entity graph summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_entity_graph AS
SELECT e.id, e.name, e.entity_type,
       count(r.id) as relationship_count,
       array_agg(DISTINCT r.rel_type) as rel_types
FROM entities e
LEFT JOIN relationships r ON e.id = r.source_id OR e.id = r.target_id
GROUP BY e.id, e.name, e.entity_type;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_entity_graph ON mv_entity_graph(id);
`;

module.exports = {
  CQRSReadModel,
  LRUCache,
  MATERIALIZED_VIEW_SQL,
  PHI, PSI, FIB,
};
