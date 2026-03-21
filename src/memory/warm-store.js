/**
 * Warm Store - pgvector integration for embeddings and semantic search
 * Part of the Latent OS 3-Tier Architecture
 */
'use strict';
const { createLogger } = require('../utils/logger');
const logger = createLogger('warm-store');
const { topK } = require('../shared/csl-engine');

class WarmStore {
  constructor(config = {}) {
    this.pool = config.pool || null; // pg pool
    // In-memory fallback if no DB connected
    this._fallbackStore = new Map();
  }

  async connect() {
    if (!this.pool) {
      logger.warn('WarmStore: No database pool provided, running in degraded memory mode');
    }
  }

  async upsert(key, value, metadata = {}) {
    if (!this.pool) {
      this._fallbackStore.set(key, { value, metadata, createdAt: Date.now() });
      return;
    }
    
    // Assume table `memory_warm` (id, content, metadata, embedding)
    const query = `
      INSERT INTO memory_warm (id, content, metadata) 
      VALUES ($1, $2, $3) 
      ON CONFLICT (id) DO UPDATE SET content = $2, metadata = $3
    `;
    try {
      await this.pool.query(query, [key, JSON.stringify(value), JSON.stringify(metadata)]);
    } catch (err) {
      logger.error({ key, error: err.message }, 'Failed to upsert into warm store');
    }
  }

  async get(key) {
    if (!this.pool) {
      return this._fallbackStore.get(key)?.value || null;
    }
    try {
      const res = await this.pool.query('SELECT content FROM memory_warm WHERE id = $1', [key]);
      if (res.rows.length === 0) return null;
      return typeof res.rows[0].content === 'string' ? JSON.parse(res.rows[0].content) : res.rows[0].content;
    } catch (err) {
      logger.error({ key, error: err.message }, 'Failed to get from warm store');
      return null;
    }
  }

  async vectorSearch(embedding, k = 10, namespace = 'default') {
    if (!this.pool) {
      // Degraded mock return
      return [];
    }
    // Using pgvector cosine distance `<=>`
    const strVector = `[${embedding.join(',')}]`;
    const query = `
      SELECT id, content, metadata, 1 - (embedding <=> $1) AS score
      FROM memory_warm
      ORDER BY embedding <=> $1
      LIMIT $2
    `;
    try {
      const res = await this.pool.query(query, [strVector, k]);
      return res.rows.map(row => ({
        key: row.id,
        score: row.score,
        value: typeof row.content === 'string' ? JSON.parse(row.content) : row.content
      }));
    } catch (err) {
      logger.error({ error: err.message }, 'Vector search failed in warm store');
      return [];
    }
  }

  async exportOld(thresholdMs) {
    const old = [];
    if (!this.pool) {
      const now = Date.now();
      for (const [key, entry] of this._fallbackStore.entries()) {
        if (now - entry.createdAt > thresholdMs) {
          old.push({ key, value: entry.value, metadata: entry.metadata });
        }
      }
      return old;
    }
    // For DB, let's assume no created_at column is easily queryable yet in this mock
    return [];
  }

  async delete(key) {
    if (!this.pool) {
      this._fallbackStore.delete(key);
      return;
    }
    try {
      await this.pool.query('DELETE FROM memory_warm WHERE id = $1', [key]);
    } catch (err) {
      logger.error({ key, error: err.message }, 'Failed to delete from warm store');
    }
  }
}

module.exports = { WarmStore };
