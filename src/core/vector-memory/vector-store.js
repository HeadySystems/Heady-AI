/**
 * Heady Vector Memory Store — pgvector Persistence Layer
 *
 * Provides semantic search, memory CRUD, and 3D spatial vector storage
 * over PostgreSQL + pgvector. Uses phi-scaled HNSW indexing parameters,
 * Fibonacci batch sizes, and CSL-gated relevance filtering.
 *
 * @module core/vector-memory/vector-store
 * @author Eric Haywood — HeadySystems Inc.
 * @license PROPRIETARY — 51+ Provisional Patents
 */

import { EventEmitter } from 'events';
import {
  PHI, PSI, FIB,
  phiThreshold,
} from '../../packages/phi-math-foundation/src/index.js';
import { createLogger } from '../../packages/structured-logger/src/index.js';

const logger = createLogger('vector-store');

/** HNSW index parameters (Fibonacci-derived) */
const HNSW_CONFIG = Object.freeze({
  m:              FIB[8],   // 21 — connections per node
  efConstruction: FIB[12],  // 144 — build-time search width
  efSearch:       FIB[11],  // 89 — query-time search width
});

/** Default embedding dimension */
const EMBEDDING_DIM = 384;

/** Batch operation sizes */
const BATCH_UPSERT  = FIB[12]; // 144 vectors per batch
const BATCH_DELETE   = FIB[10]; // 55 vectors per batch

/** Search defaults */
const DEFAULT_TOP_K    = FIB[8];  // 21
const DEFAULT_THRESHOLD = PSI;    // ≈ 0.618

/** Memory entry types */
export const MEMORY_TYPES = Object.freeze({
  EPISODIC:  'episodic',   // Conversation turns, events
  SEMANTIC:  'semantic',   // Facts, knowledge, learned patterns
  PROCEDURAL: 'procedural', // Skills, workflows, how-to
  IDENTITY:  'identity',    // Self-knowledge, values, preferences
});

/**
 * MemoryRecord — a single vector memory entry.
 */
export class MemoryRecord {
  constructor({
    content,
    embedding,
    type = MEMORY_TYPES.EPISODIC,
    importance = PSI,
    metadata = {},
    namespace = 'default',
  }) {
    this.id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    this.content = content;
    this.embedding = embedding;
    this.type = type;
    this.importance = importance;
    this.namespace = namespace;
    this.metadata = metadata;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.accessCount = 0;
    this.lastAccessedAt = null;
  }
}

/**
 * VectorMemoryStore — pgvector-backed memory persistence.
 *
 * In-process mode (no database): uses in-memory arrays with cosine similarity.
 * Production mode: delegates to PostgreSQL + pgvector via connection pool.
 *
 * @fires VectorMemoryStore#memory:stored
 * @fires VectorMemoryStore#memory:retrieved
 * @fires VectorMemoryStore#memory:deleted
 * @fires VectorMemoryStore#memory:compacted
 */
export class VectorMemoryStore extends EventEmitter {
  constructor(options = {}) {
    super();

    this.dimension = options.dimension || EMBEDDING_DIM;
    this.hnswConfig = { ...HNSW_CONFIG, ...options.hnsw };

    /** @type {Map<string, MemoryRecord>} In-memory store (fallback when no DB) */
    this.records = new Map();

    /** @type {object|null} Database pool (pg Pool instance) */
    this.pool = options.pool || null;

    this.totalStored = 0;
    this.totalSearches = 0;
    this.totalDeleted = 0;

    logger.info({
      dimension: this.dimension,
      hnsw: this.hnswConfig,
      mode: this.pool ? 'pgvector' : 'in-memory',
    }, 'VectorMemoryStore initialized');
  }

  /**
   * Initialize pgvector tables and indexes.
   * Call once at startup when using database mode.
   */
  async initialize() {
    if (!this.pool) {
      logger.info('Running in-memory mode — no database initialization needed');
      return;
    }

    const client = await this.pool.connect();
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');

      await client.query(`
        CREATE TABLE IF NOT EXISTS heady_memories (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          embedding vector(${this.dimension}),
          type TEXT NOT NULL DEFAULT 'episodic',
          importance REAL NOT NULL DEFAULT ${PSI},
          namespace TEXT NOT NULL DEFAULT 'default',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          access_count INTEGER DEFAULT 0,
          last_accessed_at TIMESTAMPTZ
        )
      `);

      // HNSW index for fast cosine similarity search
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_heady_memories_embedding
        ON heady_memories
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = ${this.hnswConfig.m}, ef_construction = ${this.hnswConfig.efConstruction})
      `);

      // B-tree indexes for filtering
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_heady_memories_type ON heady_memories (type)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_heady_memories_namespace ON heady_memories (namespace)
      `);

      logger.info('pgvector tables and indexes initialized');
    } finally {
      client.release();
    }
  }

  /**
   * Store a memory record.
   *
   * @param {object} params
   * @returns {MemoryRecord}
   */
  async store({ content, embedding, type, importance, metadata, namespace }) {
    if (embedding && embedding.length !== this.dimension) {
      throw new Error(`Embedding dimension mismatch: expected ${this.dimension}, got ${embedding.length}`);
    }

    const record = new MemoryRecord({
      content, embedding, type, importance, metadata, namespace,
    });

    if (this.pool) {
      await this._dbStore(record);
    } else {
      this.records.set(record.id, record);
    }

    this.totalStored++;
    this.emit('memory:stored', { id: record.id, type: record.type, namespace: record.namespace });

    return record;
  }

  /**
   * Semantic search — find memories by embedding similarity.
   *
   * @param {number[]} queryEmbedding - Query vector
   * @param {object} [options]
   * @param {number} [options.topK] - Max results (default FIB[8] = 21)
   * @param {number} [options.threshold] - Min similarity (default ψ ≈ 0.618)
   * @param {string} [options.type] - Filter by memory type
   * @param {string} [options.namespace] - Filter by namespace
   * @returns {Array<{record: MemoryRecord, similarity: number}>}
   */
  async search(queryEmbedding, options = {}) {
    const topK = options.topK || DEFAULT_TOP_K;
    const threshold = options.threshold || DEFAULT_THRESHOLD;
    this.totalSearches++;

    if (this.pool) {
      return this._dbSearch(queryEmbedding, { ...options, topK, threshold });
    }

    return this._memorySearch(queryEmbedding, { ...options, topK, threshold });
  }

  /**
   * Retrieve a specific memory by ID.
   *
   * @param {string} id
   * @returns {MemoryRecord|null}
   */
  async get(id) {
    if (this.pool) {
      return this._dbGet(id);
    }

    const record = this.records.get(id);
    if (record) {
      record.accessCount++;
      record.lastAccessedAt = Date.now();
    }
    return record || null;
  }

  /**
   * Update a memory record.
   *
   * @param {string} id
   * @param {object} updates
   * @returns {MemoryRecord|null}
   */
  async update(id, updates) {
    if (this.pool) {
      return this._dbUpdate(id, updates);
    }

    const record = this.records.get(id);
    if (!record) return null;

    if (updates.content !== undefined) record.content = updates.content;
    if (updates.embedding !== undefined) record.embedding = updates.embedding;
    if (updates.importance !== undefined) record.importance = updates.importance;
    if (updates.metadata !== undefined) record.metadata = { ...record.metadata, ...updates.metadata };
    record.updatedAt = Date.now();

    return record;
  }

  /**
   * Delete a memory record.
   *
   * @param {string} id
   * @returns {boolean}
   */
  async delete(id) {
    if (this.pool) {
      return this._dbDelete(id);
    }

    const deleted = this.records.delete(id);
    if (deleted) {
      this.totalDeleted++;
      this.emit('memory:deleted', { id });
    }
    return deleted;
  }

  /**
   * Compact memories — merge similar episodic entries.
   * Uses CSL AND (cosine similarity) to find near-duplicates above DEDUP threshold.
   *
   * @param {string} namespace
   * @param {number} [dedupThreshold] - Similarity above which entries merge (≈ 0.972)
   * @returns {number} Number of records merged
   */
  async compact(namespace = 'default', dedupThreshold = phiThreshold(4) + 0.045) {
    // dedupThreshold ≈ 0.927 + 0.045 ≈ 0.972
    const entries = this.pool
      ? await this._dbListByNamespace(namespace)
      : [...this.records.values()].filter(r => r.namespace === namespace);

    let merged = 0;
    const toDelete = new Set();

    for (let i = 0; i < entries.length; i++) {
      if (toDelete.has(entries[i].id)) continue;

      for (let j = i + 1; j < entries.length; j++) {
        if (toDelete.has(entries[j].id)) continue;

        if (entries[i].embedding && entries[j].embedding) {
          const sim = this._cosineSimilarity(entries[i].embedding, entries[j].embedding);
          if (sim >= dedupThreshold) {
            // Merge: keep the one with higher importance
            const keep = entries[i].importance >= entries[j].importance ? entries[i] : entries[j];
            const discard = keep === entries[i] ? entries[j] : entries[i];

            keep.accessCount += discard.accessCount;
            keep.importance = Math.min(1, keep.importance + discard.importance * PSI * PSI);
            keep.updatedAt = Date.now();

            toDelete.add(discard.id);
            merged++;
          }
        }
      }
    }

    // Delete merged records
    for (const id of toDelete) {
      await this.delete(id);
    }

    if (merged > 0) {
      this.emit('memory:compacted', { namespace, merged });
      logger.info({ namespace, merged }, 'Memory compaction complete');
    }

    return merged;
  }

  /**
   * Get store statistics.
   * @returns {object}
   */
  getStats() {
    return {
      mode: this.pool ? 'pgvector' : 'in-memory',
      dimension: this.dimension,
      totalRecords: this.pool ? 'query_required' : this.records.size,
      totalStored: this.totalStored,
      totalSearches: this.totalSearches,
      totalDeleted: this.totalDeleted,
      hnsw: this.hnswConfig,
    };
  }

  // --- In-Memory Search ---

  _memorySearch(queryEmbedding, { topK, threshold, type, namespace }) {
    const results = [];

    for (const [, record] of this.records) {
      if (type && record.type !== type) continue;
      if (namespace && record.namespace !== namespace) continue;
      if (!record.embedding) continue;

      const similarity = this._cosineSimilarity(queryEmbedding, record.embedding);
      if (similarity >= threshold) {
        record.accessCount++;
        record.lastAccessedAt = Date.now();
        results.push({ record, similarity });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    const topResults = results.slice(0, topK);

    this.emit('memory:retrieved', {
      resultCount: topResults.length,
      topSimilarity: topResults[0]?.similarity || 0,
    });

    return topResults;
  }

  // --- Database Operations ---

  async _dbStore(record) {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO heady_memories (id, content, embedding, type, importance, namespace, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          record.id,
          record.content,
          record.embedding ? `[${record.embedding.join(',')}]` : null,
          record.type,
          record.importance,
          record.namespace,
          JSON.stringify(record.metadata),
        ]
      );
    } finally {
      client.release();
    }
  }

  async _dbSearch(queryEmbedding, { topK, threshold, type, namespace }) {
    const client = await this.pool.connect();
    try {
      let query = `
        SELECT id, content, type, importance, namespace, metadata,
               created_at, updated_at, access_count, last_accessed_at,
               1 - (embedding <=> $1::vector) AS similarity
        FROM heady_memories
        WHERE 1 = 1
      `;
      const params = [`[${queryEmbedding.join(',')}]`];
      let paramIdx = 2;

      if (type) {
        query += ` AND type = $${paramIdx++}`;
        params.push(type);
      }
      if (namespace) {
        query += ` AND namespace = $${paramIdx++}`;
        params.push(namespace);
      }

      query += ` ORDER BY embedding <=> $1::vector LIMIT $${paramIdx}`;
      params.push(topK);

      const result = await client.query(query, params);

      // Update access counts
      const ids = result.rows.map(r => r.id);
      if (ids.length > 0) {
        await client.query(
          `UPDATE heady_memories SET access_count = access_count + 1, last_accessed_at = NOW()
           WHERE id = ANY($1)`,
          [ids]
        );
      }

      return result.rows
        .filter(r => r.similarity >= threshold)
        .map(r => ({
          record: new MemoryRecord({
            content: r.content,
            type: r.type,
            importance: r.importance,
            namespace: r.namespace,
            metadata: r.metadata,
          }),
          similarity: r.similarity,
        }));
    } finally {
      client.release();
    }
  }

  async _dbGet(id) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM heady_memories WHERE id = $1', [id]
      );
      if (result.rows.length === 0) return null;

      await client.query(
        `UPDATE heady_memories SET access_count = access_count + 1, last_accessed_at = NOW()
         WHERE id = $1`, [id]
      );

      const r = result.rows[0];
      return new MemoryRecord({
        content: r.content,
        type: r.type,
        importance: r.importance,
        namespace: r.namespace,
        metadata: r.metadata,
      });
    } finally {
      client.release();
    }
  }

  async _dbUpdate(id, updates) {
    const setClauses = [];
    const params = [id];
    let paramIdx = 2;

    if (updates.content !== undefined) {
      setClauses.push(`content = $${paramIdx++}`);
      params.push(updates.content);
    }
    if (updates.importance !== undefined) {
      setClauses.push(`importance = $${paramIdx++}`);
      params.push(updates.importance);
    }
    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = metadata || $${paramIdx++}::jsonb`);
      params.push(JSON.stringify(updates.metadata));
    }
    if (updates.embedding !== undefined) {
      setClauses.push(`embedding = $${paramIdx++}::vector`);
      params.push(`[${updates.embedding.join(',')}]`);
    }

    setClauses.push('updated_at = NOW()');

    if (setClauses.length <= 1) return null; // Only updated_at, no real changes

    const client = await this.pool.connect();
    try {
      await client.query(
        `UPDATE heady_memories SET ${setClauses.join(', ')} WHERE id = $1`,
        params
      );
      return this._dbGet(id);
    } finally {
      client.release();
    }
  }

  async _dbDelete(id) {
    const client = await this.pool.connect();
    try {
      const result = await client.query('DELETE FROM heady_memories WHERE id = $1', [id]);
      const deleted = result.rowCount > 0;
      if (deleted) {
        this.totalDeleted++;
        this.emit('memory:deleted', { id });
      }
      return deleted;
    } finally {
      client.release();
    }
  }

  async _dbListByNamespace(namespace) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM heady_memories WHERE namespace = $1',
        [namespace]
      );
      return result.rows.map(r => new MemoryRecord({
        content: r.content,
        embedding: r.embedding,
        type: r.type,
        importance: r.importance,
        namespace: r.namespace,
        metadata: r.metadata,
      }));
    } finally {
      client.release();
    }
  }

  // --- Math Utilities ---

  _cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
  }
}
