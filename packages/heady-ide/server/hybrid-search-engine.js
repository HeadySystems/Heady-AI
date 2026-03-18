// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Hybrid Search Engine v1.0                              ║
// ║  pgvector HNSW + BM25 (pg_search) + RRF fusion + reranking    ║
// ║  3-tier adaptive routing: Redis → Postgres → Qdrant           ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import pino from 'pino';

const PHI = (1 + Math.sqrt(5)) / 2;
const PSI = 1 / PHI;
const FIB = [0,1,1,2,3,5,8,13,21,34,55,89,144];

const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  name: 'hybrid-search',
  base: { service: 'hybrid-search', node: 'headybrain' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Reciprocal Rank Fusion — merges ranked lists from different search modalities.
 * score(d) = Σ 1/(k + rank_i(d)) where k = RRF_K (default 60)
 *
 * @param {Array<Array<{id: string, score: number}>>} rankedLists
 * @param {number} k - RRF constant (default: 60)
 * @returns {Array<{id: string, score: number}>}
 */
export function reciprocalRankFusion(rankedLists, k = parseInt(process.env.RRF_K || '60', 10)) {
  const scores = new Map();

  for (const list of rankedLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const { id } = list[rank];
      const current = scores.get(id) || 0;
      scores.set(id, current + 1 / (k + rank + 1));
    }
  }

  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Vector search via pgvector HNSW with iterative scan support.
 * Requires: pgvector 0.8+ with `SET hnsw.iterative_scan = 'relaxed_order'`
 */
export async function vectorSearch(db, embedding, opts = {}) {
  const {
    table = 'memory_t1',
    column = 'embedding',
    tenantId,
    limit = FIB[8],        // 21
    threshold = PSI * PSI,  // 0.382 — RECALL tier minimum
    filters = {},
  } = opts;

  // Enable iterative scan for reliable filtered results
  await db.query(`SET LOCAL hnsw.iterative_scan = 'relaxed_order'`);

  let whereClause = '';
  const params = [`[${embedding.join(',')}]`, limit];
  let paramIdx = 3;

  if (tenantId) {
    whereClause += ` AND user_id = $${paramIdx}`;
    params.push(tenantId);
    paramIdx++;
  }
  if (filters.minScore) {
    whereClause += ` AND 1 - (${column} <=> $1::vector) >= $${paramIdx}`;
    params.push(filters.minScore);
    paramIdx++;
  }

  const query = `
    SELECT id, content, metadata,
           1 - (${column} <=> $1::vector) AS cosine_score
    FROM ${table}
    WHERE deleted_at IS NULL ${whereClause}
    ORDER BY ${column} <=> $1::vector
    LIMIT $2
  `;

  const result = await db.query(query, params);
  return result.rows
    .filter(r => r.cosine_score >= threshold)
    .map(r => ({
      id: r.id,
      content: r.content,
      metadata: r.metadata,
      score: r.cosine_score,
      source: 'vector',
    }));
}

/**
 * BM25 full-text search via ParadeDB pg_search extension.
 * Requires: pg_search extension enabled on Neon.
 * Falls back to Postgres tsvector if pg_search is unavailable.
 */
export async function bm25Search(db, queryText, opts = {}) {
  const {
    table = 'memory_t1',
    contentColumn = 'content',
    tenantId,
    limit = FIB[8],
    usePgSearch = process.env.PG_SEARCH_ENABLED === 'true',
  } = opts;

  let result;

  if (usePgSearch) {
    // ParadeDB pg_search BM25 — Elasticsearch-quality full-text
    const params = [queryText, limit];
    let whereClause = '';
    if (tenantId) {
      whereClause = `AND user_id = $3`;
      params.push(tenantId);
    }

    result = await db.query(`
      SELECT id, content, metadata,
             paradedb.score(id) AS bm25_score
      FROM ${table}
      WHERE ${contentColumn} @@@ $1 ${whereClause}
      ORDER BY paradedb.score(id) DESC
      LIMIT $2
    `, params);
  } else {
    // Fallback: Postgres native tsvector
    const params = [queryText, limit];
    let whereClause = '';
    if (tenantId) {
      whereClause = `AND user_id = $3`;
      params.push(tenantId);
    }

    result = await db.query(`
      SELECT id, content, metadata,
             ts_rank_cd(to_tsvector('english', ${contentColumn}), plainto_tsquery('english', $1)) AS bm25_score
      FROM ${table}
      WHERE to_tsvector('english', ${contentColumn}) @@ plainto_tsquery('english', $1)
            AND deleted_at IS NULL ${whereClause}
      ORDER BY bm25_score DESC
      LIMIT $2
    `, params);
  }

  return result.rows.map(r => ({
    id: r.id,
    content: r.content,
    metadata: r.metadata,
    score: r.bm25_score,
    source: 'bm25',
  }));
}

/**
 * Rerank results using Jina Reranker v3 API.
 * Processes query + documents simultaneously via cross-attention.
 */
export async function rerank(query, documents, opts = {}) {
  const {
    topN = FIB[5],  // 5
    model = 'jina-reranker-v2-base-multilingual',
  } = opts;

  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey || documents.length === 0) {
    return documents.slice(0, topN); // No reranking available — return as-is
  }

  try {
    const resp = await fetch('https://api.jina.ai/v1/rerank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        query,
        documents: documents.map(d => d.content || d.text || String(d)),
        top_n: topN,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) {
      log.warn({ status: resp.status }, 'Jina reranker returned non-OK — using RRF scores');
      return documents.slice(0, topN);
    }

    const data = await resp.json();
    return data.results.map(r => ({
      ...documents[r.index],
      rerankScore: r.relevance_score,
    }));
  } catch (err) {
    log.warn({ err: err.message }, 'Reranker failed — falling back to RRF ordering');
    return documents.slice(0, topN);
  }
}

/**
 * Full hybrid search pipeline:
 * 1. Parallel vector + BM25 search
 * 2. RRF fusion
 * 3. Jina reranking (optional)
 * 4. CSL-gated result classification
 */
export async function hybridSearch(db, query, embedding, opts = {}) {
  const {
    tenantId,
    limit = FIB[8],
    rerankTopN = FIB[5],
    enableReranking = process.env.JINA_API_KEY ? true : false,
    table = 'memory_t1',
  } = opts;

  const start = Date.now();

  // Step 1: Parallel search
  const [vectorResults, bm25Results] = await Promise.all([
    vectorSearch(db, embedding, { tenantId, limit, table }),
    bm25Search(db, query, { tenantId, limit, table }),
  ]);

  // Step 2: RRF fusion
  const fused = reciprocalRankFusion([
    vectorResults.map(r => ({ id: r.id, score: r.score })),
    bm25Results.map(r => ({ id: r.id, score: r.score })),
  ]);

  // Enrich fused results with full document data
  const docMap = new Map();
  [...vectorResults, ...bm25Results].forEach(r => {
    if (!docMap.has(r.id)) docMap.set(r.id, r);
  });

  let results = fused.map(f => ({
    ...docMap.get(f.id),
    fusionScore: f.score,
  })).filter(Boolean);

  // Step 3: Rerank (optional)
  if (enableReranking && results.length > 0) {
    results = await rerank(query, results, { topN: rerankTopN });
  }

  // Step 4: CSL-gate classification
  results = results.map(r => {
    const score = r.rerankScore || r.fusionScore || r.score || 0;
    let tier;
    if (score >= PSI + 0.1) tier = 'CORE';       // ≥ 0.718
    else if (score >= PSI) tier = 'INCLUDE';      // ≥ 0.618
    else if (score >= PSI * PSI) tier = 'RECALL'; // ≥ 0.382
    else tier = 'VOID';

    return { ...r, cslTier: tier, finalScore: score };
  }).filter(r => r.cslTier !== 'VOID');

  const durationMs = Date.now() - start;
  log.info({
    query: query.slice(0, 50),
    vectorHits: vectorResults.length,
    bm25Hits: bm25Results.length,
    fusedTotal: fused.length,
    finalResults: results.length,
    durationMs,
  }, 'Hybrid search completed');

  return {
    results,
    metadata: {
      vectorHits: vectorResults.length,
      bm25Hits: bm25Results.length,
      fusedTotal: fused.length,
      reranked: enableReranking,
      durationMs,
    },
  };
}

/**
 * SQL migration to enable BM25 index on memory_t1 (run once).
 */
export const BM25_MIGRATION_SQL = `
-- Enable pg_search extension (ParadeDB)
CREATE EXTENSION IF NOT EXISTS pg_search;

-- Create BM25 index on memory_t1.content
CALL paradedb.create_bm25(
  index_name => 'memory_t1_bm25',
  table_name => 'memory_t1',
  key_field => 'id',
  text_fields => paradedb.field('content')
);

-- Enable pgvector iterative scan globally
ALTER SYSTEM SET hnsw.iterative_scan = 'relaxed_order';
SELECT pg_reload_conf();
`;

export default { hybridSearch, vectorSearch, bm25Search, rerank, reciprocalRankFusion };
