// packages/heady-memory/src/hybrid-search.js
// Hybrid BM25 + Vector search with Reciprocal Rank Fusion (RRF)
// Uses pgvector cosine + ParadeDB pg_search BM25 on Neon
import { TOP_K, CSL } from '../../heady-core/src/phi.js';

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

let pool;
async function getPool() {
  if (pool) return pool;
  try {
    const { Pool } = await import('@neondatabase/serverless');
    pool = new Pool({ connectionString: DATABASE_URL });
  } catch {
    const { default: pg } = await import('pg');
    pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

/**
 * Reciprocal Rank Fusion — fuses ranked lists from BM25 + vector search.
 * score = Σ 1/(k + rank) where k=60 (standard constant)
 *
 * @param {Array<{id: string, rank: number}>} vectorResults
 * @param {Array<{id: string, rank: number}>} bm25Results
 * @param {number} [k=60]
 * @returns {Array<{id: string, rrf_score: number}>}
 */
export function reciprocalRankFusion(vectorResults, bm25Results, k = 60) {
  const scores = new Map();

  vectorResults.forEach(({ id }, rank) => {
    scores.set(id, (scores.get(id) || 0) + 1 / (k + rank + 1));
  });

  bm25Results.forEach(({ id }, rank) => {
    scores.set(id, (scores.get(id) || 0) + 1 / (k + rank + 1));
  });

  return Array.from(scores.entries())
    .map(([id, rrf_score]) => ({ id, rrf_score }))
    .sort((a, b) => b.rrf_score - a.rrf_score);
}

/**
 * Hybrid search: combines pgvector cosine similarity + BM25 full-text search.
 * Falls back to vector-only if BM25 extension not available.
 *
 * @param {string} userId
 * @param {string} query — text query for BM25
 * @param {number[]} queryEmbedding — 384D vector for cosine search
 * @param {number} [topK=21]
 * @returns {Promise<Array<{id: string, content: string, csl_score: number, rrf_score: number}>>}
 */
export async function hybridSearch(userId, query, queryEmbedding, topK = TOP_K) {
  const db = await getPool();
  const embStr = `[${queryEmbedding.join(',')}]`;

  // Vector search
  const { rows: vectorRows } = await db.query(
    `SELECT id, content, csl_score, tier,
            1 - (embedding <=> $1::vector) AS similarity
     FROM memory_vectors
     WHERE user_id = $2 AND csl_score >= $3
     ORDER BY similarity DESC
     LIMIT $4`,
    [embStr, userId, CSL.RECALL, topK]
  );

  // BM25 search (ParadeDB pg_search) — graceful fallback
  let bm25Rows = [];
  try {
    const { rows } = await db.query(
      `SELECT id, content, csl_score, tier,
              paradedb.rank_bm25(id, $1) AS bm25_score
       FROM memory_vectors
       WHERE user_id = $2
         AND content @@@ $1
       ORDER BY bm25_score DESC
       LIMIT $3`,
      [query, userId, topK]
    );
    bm25Rows = rows;
  } catch {
    // pg_search not available — use basic text search fallback
    const { rows } = await db.query(
      `SELECT id, content, csl_score, tier
       FROM memory_vectors
       WHERE user_id = $1
         AND to_tsvector('english', content) @@ plainto_tsquery('english', $2)
       ORDER BY csl_score DESC
       LIMIT $3`,
      [userId, query, topK]
    );
    bm25Rows = rows;
  }

  // Fuse with RRF
  const fused = reciprocalRankFusion(
    vectorRows.map((r, i) => ({ id: r.id, rank: i })),
    bm25Rows.map((r, i) => ({ id: r.id, rank: i }))
  );

  // Merge content data
  const allDocs = new Map([...vectorRows, ...bm25Rows].map(r => [r.id, r]));
  return fused.slice(0, topK).map(f => ({
    ...allDocs.get(f.id),
    rrf_score: f.rrf_score
  }));
}

/**
 * Adaptive RAG router — routes queries by complexity to optimal retrieval tier.
 * Simple → Redis cache, Moderate → pgvector, Complex → hybrid + reranking
 *
 * @param {string} userId
 * @param {string} query
 * @param {number[]} queryEmbedding
 * @param {number} similarityScore — pre-computed cosine sim from reconnaissance
 * @returns {Promise<{tier: string, results: Array}>}
 */
export async function adaptiveRAG(userId, query, queryEmbedding, similarityScore = 0) {
  // Simple: high similarity to cache → Redis hit
  if (similarityScore >= CSL.CORE) {
    const { getWorkingMemory } = await import('./t0-redis.js');
    const cached = await getWorkingMemory(userId);
    if (cached.length) return { tier: 'cache', results: cached };
  }

  // Moderate: standard vector search
  if (similarityScore >= CSL.INCLUDE || query.length < 100) {
    const { semanticSearch } = await import('./t1-neon.js');
    const results = await semanticSearch(userId, queryEmbedding, CSL.RECALL);
    return { tier: 'vector', results };
  }

  // Complex: hybrid BM25 + vector + reranking
  const results = await hybridSearch(userId, query, queryEmbedding);
  try {
    const { rerank } = await import('../../heady-llm/src/reranker.js');
    const reranked = await rerank(query, results);
    return { tier: 'hybrid+rerank', results: reranked };
  } catch {
    return { tier: 'hybrid', results };
  }
}
