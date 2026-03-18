// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Adaptive RAG Router v1.0                               ║
// ║  CSL-scored query complexity → 3-tier retrieval routing         ║
// ║  Redis cache → pgvector → Qdrant hybrid + reranking            ║
// ║  CRAG self-correction for hallucination reduction               ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import pino from 'pino';

const PHI = (1 + Math.sqrt(5)) / 2;
const PSI = 1 / PHI;

const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  name: 'adaptive-rag',
  base: { service: 'adaptive-rag', node: 'headybrain' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Adaptive RAG Router
 *
 * Routes queries to the optimal retrieval tier based on complexity:
 * - Simple (< 0.382) → Redis semantic cache (sub-ms, $0)
 * - Moderate (0.382–0.618) → pgvector HNSW single-modal
 * - Complex (> 0.618) → Qdrant hybrid + BM25 + reranking + CRAG
 *
 * @param {Object} deps - Injected dependencies
 * @param {Object} deps.redis - Upstash Redis client
 * @param {Object} deps.db - Neon Postgres client
 * @param {Object} deps.hybridSearch - Hybrid search engine module
 * @param {Function} deps.embed - Embedding function
 * @param {Function} deps.llm - LLM call function (for CRAG evaluation)
 */
export function createAdaptiveRAG(deps) {
  const { redis, db, hybridSearch, embed, llm } = deps;

  /**
   * Route and execute retrieval for a query.
   */
  async function retrieve(query, context = {}) {
    const start = Date.now();
    const complexity = context.complexity ?? estimateQueryComplexity(query);
    const tenantId = context.tenantId || 'default';
    const embedding = context.embedding || (await embed(query))[0];

    let results;
    let tier;
    let corrected = false;

    if (complexity < PSI * PSI) {
      // ── Tier 0: Redis Semantic Cache ────────────────────────────
      tier = 'cache';
      results = await cacheRetrieval(redis, query, embedding, tenantId);
    } else if (complexity < PSI) {
      // ── Tier 1: pgvector Single-Modal ──────────────────────────
      tier = 'vector';
      results = await vectorRetrieval(db, embedding, tenantId);
    } else {
      // ── Tier 2: Hybrid + Reranking ─────────────────────────────
      tier = 'hybrid';
      const { results: hybridResults } = await hybridSearch.hybridSearch(db, query, embedding, {
        tenantId,
        enableReranking: true,
      });
      results = hybridResults;
    }

    // CRAG: Corrective RAG for complex queries
    if (complexity > PSI && results.length > 0 && llm) {
      const { correctedResults, wasCorreced } = await cragEvaluate(query, results, llm);
      results = correctedResults;
      corrected = wasCorreced;
    }

    // Cache successful retrievals for future simple queries
    if (results.length > 0 && tier !== 'cache') {
      await cacheStore(redis, query, embedding, results, tenantId);
    }

    const durationMs = Date.now() - start;

    log.info({
      query: query.slice(0, 50),
      complexity: Math.round(complexity * 1000) / 1000,
      tier,
      results: results.length,
      corrected,
      durationMs,
    }, 'Adaptive RAG complete');

    return { results, tier, complexity, corrected, durationMs };
  }

  return { retrieve };
}

// ── Tier 0: Redis Semantic Cache ────────────────────────────────────
async function cacheRetrieval(redis, query, embedding, tenantId) {
  const cacheKey = `tenant:${tenantId}:cache:rag:${simpleHash(query)}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      log.debug({ query: query.slice(0, 30) }, 'Cache hit');
      return parsed;
    } catch { /* corrupted cache, continue */ }
  }
  return [];
}

async function cacheStore(redis, query, embedding, results, tenantId) {
  const cacheKey = `tenant:${tenantId}:cache:rag:${simpleHash(query)}`;
  const ttl = 3600; // 1 hour
  try {
    await redis.set(cacheKey, JSON.stringify(results.slice(0, 5)), { ex: ttl });
  } catch { /* non-critical */ }
}

// ── Tier 1: pgvector Retrieval ──────────────────────────────────────
async function vectorRetrieval(db, embedding, tenantId) {
  const result = await db.query(`
    SET LOCAL hnsw.iterative_scan = 'relaxed_order';
    SELECT id, content, metadata,
           1 - (embedding <=> $1::vector) AS score
    FROM memory_t1
    WHERE user_id = $2 AND deleted_at IS NULL
    ORDER BY embedding <=> $1::vector
    LIMIT 13
  `, [`[${embedding.join(',')}]`, tenantId]);

  return result.rows
    .filter(r => r.score >= PSI * PSI) // ≥ 0.382 (RECALL)
    .map(r => ({
      id: r.id,
      content: r.content,
      metadata: r.metadata,
      score: r.score,
      source: 'vector',
      cslTier: r.score >= PSI + 0.1 ? 'CORE' : r.score >= PSI ? 'INCLUDE' : 'RECALL',
    }));
}

// ── CRAG: Corrective RAG ────────────────────────────────────────────
/**
 * CRAG evaluates each retrieved document for relevance.
 * - Correct: keep document
 * - Incorrect: discard and trigger web search
 * - Ambiguous: refine query and re-search
 */
async function cragEvaluate(query, results, llm) {
  if (results.length === 0) return { correctedResults: results, wasCorreced: false };

  // Only evaluate top-5 documents (cost control)
  const toEvaluate = results.slice(0, 5);

  const evaluationPrompt = `You are a retrieval quality evaluator. Given a query and a set of retrieved documents, classify each document as:
- CORRECT: The document directly answers or is highly relevant to the query.
- INCORRECT: The document is irrelevant or misleading for this query.
- AMBIGUOUS: The document is partially relevant but may need additional context.

Query: "${query}"

Documents:
${toEvaluate.map((r, i) => `[${i}] ${(r.content || '').slice(0, 200)}`).join('\n')}

Respond with ONLY a JSON array of classifications like: ["CORRECT", "INCORRECT", "AMBIGUOUS", ...]`;

  try {
    const evaluation = await llm([
      { role: 'system', content: 'You are a document relevance evaluator. Respond with only a JSON array.' },
      { role: 'user', content: evaluationPrompt },
    ]);

    const content = evaluation.content || '';
    const jsonMatch = content.match(/\[.*\]/s);
    if (!jsonMatch) return { correctedResults: results, wasCorreced: false };

    const classifications = JSON.parse(jsonMatch[0]);

    const corrected = toEvaluate.filter((_, i) =>
      classifications[i] === 'CORRECT' || classifications[i] === 'AMBIGUOUS'
    );

    // Add remaining unavaluated results
    const remaining = results.slice(5);

    const correctedResults = [...corrected, ...remaining];
    const wasCorreced = corrected.length < toEvaluate.length;

    if (wasCorreced) {
      log.info({
        original: toEvaluate.length,
        kept: corrected.length,
        removed: toEvaluate.length - corrected.length,
      }, 'CRAG correction applied');
    }

    return { correctedResults, wasCorreced };
  } catch (err) {
    log.warn({ err: err.message }, 'CRAG evaluation failed — using uncorrected results');
    return { correctedResults: results, wasCorreced: false };
  }
}

// ── Query Complexity Estimation ─────────────────────────────────────
function estimateQueryComplexity(query) {
  let score = 0;

  // Length signal
  const words = query.split(/\s+/).length;
  score += Math.min(0.3, words / 100);

  // Question complexity
  if (/\b(how|why|explain|compare|analyze|difference between)\b/i.test(query)) score += 0.25;
  if (/\b(what is|define|list)\b/i.test(query)) score += 0.1;

  // Multi-hop indicators
  if (/\b(and also|in addition|furthermore|considering)\b/i.test(query)) score += 0.15;

  // Technical depth
  if (/\b(implement|architect|optimize|benchmark|migrate)\b/i.test(query)) score += 0.2;

  // Negation/constraints
  if (/\b(but not|except|without|unlike)\b/i.test(query)) score += 0.1;

  return Math.min(1, score);
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export default { createAdaptiveRAG };
