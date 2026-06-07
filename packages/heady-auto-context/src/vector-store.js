// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: packages/heady-auto-context/src/vector-store.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * ═══════════════════════════════════════════════════════════
 * HEADY™ VECTOR STORE (pgvector on Neon PostgreSQL)
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 * HNSW index with Fibonacci parameters, parameterized queries
 * ═══════════════════════════════════════════════════════════
 */

import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { createLogger } from '../shared/structured-logger.js';
import { VectorSearchError, IndexingError } from '../shared/errors.js';
import { DEDUP_THRESHOLD } from '../shared/phi-math.js';
import config from './config.js';

const { Pool } = pg;
const logger = createLogger('vector-store');

let pool = null;

/**
 * Initialize the connection pool and ensure schema exists.
 */
export async function initVectorStore() {
  pool = new Pool({
    connectionString: config.databaseUrl,
    min: config.pool.min,
    max: config.pool.max,
    idleTimeoutMillis: config.pool.idleTimeoutMs,
    connectionTimeoutMillis: config.pool.connectionTimeoutMs,
    ssl: { rejectUnauthorized: false },
  });

  pool.on('error', (err) => {
    logger.error({ error: err.message }, 'Pool idle client error');
  });

  await ensureSchema();
  logger.info({
    min: config.pool.min,
    max: config.pool.max,
    vectorDim: config.vectorDim,
    hnswM: config.hnswM,
    hnswEf: config.hnswEfConstruction,
  }, 'Vector store initialized');
}

/**
 * Create the context_vectors table + HNSW index if not present.
 */
async function ensureSchema() {
  const client = await pool.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');

    await client.query(`
      CREATE TABLE IF NOT EXISTS context_vectors (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content    TEXT NOT NULL,
        embedding  vector(${config.vectorDim}) NOT NULL,
        metadata   JSONB NOT NULL DEFAULT '{}',
        domain     TEXT NOT NULL DEFAULT 'general',
        source     TEXT NOT NULL DEFAULT 'unknown',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // HNSW index — m=fib(8)=21, ef_construction=fib(11)=89
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_context_vectors_hnsw
      ON context_vectors
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = ${config.hnswM}, ef_construction = ${config.hnswEfConstruction})
    `);

    // Domain index for filtered searches
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_context_vectors_domain
      ON context_vectors (domain)
    `);

    // GIN index on metadata for JSON queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_context_vectors_metadata
      ON context_vectors USING GIN (metadata)
    `);

    // Updated_at trigger
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TRIGGER trg_context_vectors_updated_at
          BEFORE UPDATE ON context_vectors
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    logger.info('Schema verified/created');
  } finally {
    client.release();
  }
}

/**
 * Search for similar vectors using HNSW cosine distance.
 * Returns results above the given CSL threshold.
 *
 * @param {number[]} queryEmbedding - 384-dim vector
 * @param {number} topK - Max results (default fib(8)=21)
 * @param {number} threshold - Min similarity (CSL gate)
 * @param {string|null} domain - Filter by domain (null = all)
 * @returns {Promise<Array>} Sorted by similarity descending
 */
export async function search(queryEmbedding, topK = config.searchTopK, threshold = 0.382, domain = null) {
  const vecStr = `[${queryEmbedding.join(',')}]`;

  try {
    // Set ef_search for this query session
    const client = await pool.connect();
    try {
      await client.query(`SET LOCAL hnsw.ef_search = ${config.hnswEfSearch}`);

      let query, params;

      if (domain) {
        query = `
          SELECT
            id, content, metadata, domain, source, created_at,
            1 - (embedding <=> $1::vector) AS similarity
          FROM context_vectors
          WHERE domain = $2
            AND 1 - (embedding <=> $1::vector) >= $3
          ORDER BY embedding <=> $1::vector
          LIMIT $4
        `;
        params = [vecStr, domain, threshold, topK];
      } else {
        query = `
          SELECT
            id, content, metadata, domain, source, created_at,
            1 - (embedding <=> $1::vector) AS similarity
          FROM context_vectors
          WHERE 1 - (embedding <=> $1::vector) >= $2
          ORDER BY embedding <=> $1::vector
          LIMIT $3
        `;
        params = [vecStr, threshold, topK];
      }

      const result = await client.query(query, params);
      return result.rows.map(row => ({
        id: row.id,
        content: row.content,
        metadata: row.metadata,
        domain: row.domain,
        source: row.source,
        createdAt: row.created_at,
        similarity: parseFloat(row.similarity),
      }));
    } finally {
      client.release();
    }
  } catch (err) {
    throw new VectorSearchError(`Vector search failed: ${err.message}`, {
      topK, threshold, domain,
    });
  }
}

/**
 * Index a single context entry.
 * Deduplication: if a vector with similarity ≥ DEDUP_THRESHOLD (0.972) exists,
 * update the existing record instead of inserting.
 *
 * @param {string} content
 * @param {number[]} embedding - 384-dim vector
 * @param {object} metadata
 * @param {string} domain
 * @param {string} source
 * @returns {Promise<{id: string, action: string}>}
 */
export async function index(content, embedding, metadata = {}, domain = 'general', source = 'unknown') {
  const vecStr = `[${embedding.join(',')}]`;

  try {
    // Check for near-duplicate
    const dupCheck = await pool.query(`
      SELECT id, 1 - (embedding <=> $1::vector) AS similarity
      FROM context_vectors
      WHERE 1 - (embedding <=> $1::vector) >= $2
      ORDER BY embedding <=> $1::vector
      LIMIT 1
    `, [vecStr, DEDUP_THRESHOLD]);

    if (dupCheck.rows.length > 0) {
      // Update existing record
      const existingId = dupCheck.rows[0].id;
      await pool.query(`
        UPDATE context_vectors
        SET content = $1, embedding = $2::vector, metadata = $3, domain = $4, source = $5
        WHERE id = $6
      `, [content, vecStr, JSON.stringify(metadata), domain, source, existingId]);

      logger.info({ id: existingId, similarity: dupCheck.rows[0].similarity }, 'Dedup: updated existing vector');
      return { id: existingId, action: 'updated' };
    }

    // Insert new
    const id = randomUUID();
    await pool.query(`
      INSERT INTO context_vectors (id, content, embedding, metadata, domain, source)
      VALUES ($1, $2, $3::vector, $4, $5, $6)
    `, [id, content, vecStr, JSON.stringify(metadata), domain, source]);

    logger.info({ id, domain, source }, 'Indexed new vector');
    return { id, action: 'inserted' };
  } catch (err) {
    throw new IndexingError(`Indexing failed: ${err.message}`, { domain, source });
  }
}

/**
 * Batch index — processes up to fib(7)=13 entries.
 *
 * @param {Array<{content: string, metadata?: object, domain?: string, source?: string}>} entries
 * @param {number[][]} embeddings - Pre-computed embeddings
 * @returns {Promise<Array<{id: string, action: string}>>}
 */
export async function indexBatch(entries, embeddings) {
  if (entries.length !== embeddings.length) {
    throw new IndexingError('Entries and embeddings length mismatch');
  }
  if (entries.length > config.batchSize) {
    throw new IndexingError(`Batch exceeds max size of ${config.batchSize}`);
  }

  const results = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const result = await index(
      e.content,
      embeddings[i],
      e.metadata || {},
      e.domain || 'general',
      e.source || 'unknown',
    );
    results.push(result);
  }
  return results;
}

/**
 * Get total vector count and per-domain breakdown.
 */
export async function getStats() {
  try {
    const total = await pool.query('SELECT COUNT(*) AS count FROM context_vectors');
    const domains = await pool.query(`
      SELECT domain, COUNT(*) AS count
      FROM context_vectors
      GROUP BY domain
      ORDER BY count DESC
    `);
    return {
      totalVectors: parseInt(total.rows[0].count, 10),
      domains: domains.rows.map(r => ({ domain: r.domain, count: parseInt(r.count, 10) })),
    };
  } catch (err) {
    logger.error({ error: err.message }, 'Stats query failed');
    return { totalVectors: -1, domains: [] };
  }
}

/**
 * Health check — ping the database.
 */
export async function healthCheck() {
  try {
    const start = performance.now();
    await pool.query('SELECT 1');
    const latencyMs = Math.round(performance.now() - start);
    return { ok: true, latencyMs };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Graceful shutdown — drain the pool.
 */
export async function closeVectorStore() {
  if (pool) {
    await pool.end();
    logger.info('Vector store pool closed');
  }
}
