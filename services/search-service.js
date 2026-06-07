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
// ║  FILE: services/search-service.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Heady Search Service — Port 3314
 * Hybrid BM25 + pgvector dense + SPLADE sparse with RRF fusion
 * Author: Eric Haywood | All constants φ-derived | ESM only
 */
import { createHash } from 'crypto';
import { PHI, PSI, PSI2, phiThreshold, phiBackoff, fibonacci } from '../shared/phi-math-v2.js';
import { cslGate, cslBlend, cosineSimilarity } from '../shared/csl-engine-v2.js';

// ── φ-Derived Constants ──────────────────────────────────────────
const RRF_K                  = fibonacci(11);                // 89 (RRF constant)
const BM25_K1                = PHI;                          // 1.618
const BM25_B                 = PSI;                          // 0.618
const MAX_RESULTS            = fibonacci(10);                // 55
const RERANK_TOP_K           = fibonacci(8);                 // 21
const CACHE_SIZE             = fibonacci(16);                // 987
const CACHE_TTL_MS           = fibonacci(13) * 1000;         // 233s
const FACET_MAX              = fibonacci(8);                 // 21
const FUSION_WEIGHTS         = { bm25: PSI, dense: PSI2, sparse: 1 - PSI - PSI2 }; // φ-weighted

// ── In-Memory Stores ─────────────────────────────────────────────
const documents = new Map();
const invertedIndex = new Map();
const queryCache = new Map();
const searchAnalytics = [];
const metrics = { queries: 0, cacheHits: 0, cacheMisses: 0 };

function sha256(input) { return createHash('sha256').update(String(input)).digest('hex'); }

// ── Document Indexing ────────────────────────────────────────────
function indexDocument(doc) {
  const id = doc.id || sha256(JSON.stringify(doc) + Date.now());
  const text = [doc.title, doc.body, doc.description].filter(Boolean).join(' ');
  const tokens = tokenize(text);
  const termFreqs = {};
  for (const token of tokens) {
    termFreqs[token] = (termFreqs[token] || 0) + 1;
  }

  const indexed = {
    id, ...doc,
    tokens,
    termFreqs,
    length: tokens.length,
    embedding: doc.embedding || null,
    sparseVector: doc.sparseVector || null,
    indexedAt: Date.now(),
    hash: sha256(text),
  };
  documents.set(id, indexed);

  for (const token of Object.keys(termFreqs)) {
    if (!invertedIndex.has(token)) invertedIndex.set(token, new Set());
    invertedIndex.get(token).add(id);
  }
  return { id, indexed: true, tokenCount: tokens.length };
}

function tokenize(text) {
  return String(text).toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

// ── BM25 Scoring ─────────────────────────────────────────────────
function bm25Score(query, docId) {
  const doc = documents.get(docId);
  if (!doc) return 0;
  const queryTokens = tokenize(query);
  const avgDl = [...documents.values()].reduce((s, d) => s + d.length, 0) / Math.max(documents.size, 1);
  let score = 0;

  for (const term of queryTokens) {
    const tf = doc.termFreqs[term] || 0;
    const df = invertedIndex.has(term) ? invertedIndex.get(term).size : 0;
    const idf = Math.log(1 + (documents.size - df + 0.5) / (df + 0.5));
    const tfNorm = (tf * (BM25_K1 + 1)) / (tf + BM25_K1 * (1 - BM25_B + BM25_B * doc.length / avgDl));
    score += idf * tfNorm;
  }
  return score;
}

// ── Dense Vector Search ──────────────────────────────────────────
function denseSearch(queryEmbedding, topK) {
  const results = [];
  for (const [id, doc] of documents) {
    if (!doc.embedding || !queryEmbedding) continue;
    const sim = cosineSimilarity(queryEmbedding, doc.embedding);
    results.push({ id, score: sim });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, topK || RERANK_TOP_K);
}

// ── SPLADE Sparse Search ─────────────────────────────────────────
function sparseSearch(querySparse, topK) {
  const results = [];
  for (const [id, doc] of documents) {
    if (!doc.sparseVector || !querySparse) continue;
    let dotProduct = 0;
    for (const [dim, weight] of Object.entries(querySparse)) {
      if (doc.sparseVector[dim]) {
        dotProduct += weight * doc.sparseVector[dim];
      }
    }
    if (dotProduct > 0) results.push({ id, score: dotProduct });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, topK || RERANK_TOP_K);
}

// ── Reciprocal Rank Fusion ───────────────────────────────────────
function reciprocalRankFusion(rankedLists, weights) {
  const scores = new Map();
  for (let i = 0; i < rankedLists.length; i++) {
    const list = rankedLists[i];
    const weight = weights[i] || 1.0;
    for (let rank = 0; rank < list.length; rank++) {
      const id = list[rank].id;
      const rrfScore = weight / (RRF_K + rank + 1);
      scores.set(id, (scores.get(id) || 0) + rrfScore);
    }
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

// ── Query Expansion ──────────────────────────────────────────────
const synonymMap = new Map([
  ['search', ['find', 'lookup', 'query']],
  ['create', ['make', 'build', 'generate']],
  ['delete', ['remove', 'destroy', 'drop']],
  ['update', ['modify', 'change', 'edit']],
  ['error', ['bug', 'issue', 'problem', 'fault']],
]);

function expandQuery(query) {
  const tokens = tokenize(query);
  const expanded = [...tokens];
  for (const token of tokens) {
    const syns = synonymMap.get(token);
    if (syns) expanded.push(...syns);
  }
  return [...new Set(expanded)].join(' ');
}

// ── Faceted Search ───────────────────────────────────────────────
function generateFacets(results, facetFields) {
  const facets = {};
  for (const field of (facetFields || ['category', 'type', 'status'])) {
    const counts = {};
    for (const r of results) {
      const doc = documents.get(r.id);
      if (!doc) continue;
      const val = doc[field] || doc.metadata?.[field] || 'unknown';
      counts[val] = (counts[val] || 0) + 1;
    }
    facets[field] = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, FACET_MAX)
      .map(([value, count]) => ({ value, count }));
  }
  return facets;
}

// ── Hybrid Search ────────────────────────────────────────────────
function hybridSearch(query, options) {
  const opts = options || {};
  const cacheKey = sha256(query + JSON.stringify(opts));

  // Cache check
  const cached = queryCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    metrics.cacheHits++;
    return { ...cached.result, fromCache: true };
  }
  metrics.cacheMisses++;

  const expanded = opts.expandQuery !== false ? expandQuery(query) : query;
  const topK = opts.topK || MAX_RESULTS;

  // BM25 full-text
  const bm25Results = [];
  const queryTokens = tokenize(expanded);
  const candidateIds = new Set();
  for (const token of queryTokens) {
    const docIds = invertedIndex.get(token);
    if (docIds) docIds.forEach(id => candidateIds.add(id));
  }
  for (const id of candidateIds) {
    bm25Results.push({ id, score: bm25Score(expanded, id) });
  }
  bm25Results.sort((a, b) => b.score - a.score);

  // Dense vector
  const denseResults = opts.embedding ? denseSearch(opts.embedding, RERANK_TOP_K) : [];

  // Sparse
  const sparseResults = opts.sparseVector ? sparseSearch(opts.sparseVector, RERANK_TOP_K) : [];

  // RRF Fusion with φ-weights
  const weights = [FUSION_WEIGHTS.bm25, FUSION_WEIGHTS.dense, FUSION_WEIGHTS.sparse];
  const lists = [bm25Results, denseResults, sparseResults].filter(l => l.length > 0);
  const activeWeights = weights.slice(0, lists.length);

  const fused = reciprocalRankFusion(lists, activeWeights);
  const finalResults = fused.slice(0, topK).map(r => ({
    ...r,
    document: documents.get(r.id) || null,
  }));

  // Facets
  const facets = opts.facetFields ? generateFacets(finalResults, opts.facetFields) : {};

  const result = {
    query,
    expandedQuery: expanded,
    results: finalResults,
    facets,
    total: finalResults.length,
    searchedAt: Date.now(),
  };

  // Cache store
  if (queryCache.size >= CACHE_SIZE) {
    const oldest = queryCache.keys().next().value;
    queryCache.delete(oldest);
  }
  queryCache.set(cacheKey, { result, timestamp: Date.now() });

  // Analytics
  metrics.queries++;
  searchAnalytics.push({
    query, resultCount: finalResults.length, timestamp: Date.now(),
    hash: sha256(query + Date.now()),
  });

  return result;
}

// ── HTTP Server ──────────────────────────────────────────────────
function createServer(port = 3314) {
  return import('http').then(({ default: http }) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const respond = (status, body) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      const readBody = () => new Promise((resolve) => {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch (parseErr) { resolve({ _parseError: parseErr.message }); } });
      });

      if (url.pathname === '/search' && req.method === 'POST') {
        const body = await readBody();
        respond(200, hybridSearch(body.query, body));
      } else if (url.pathname === '/search/index' && req.method === 'POST') {
        const body = await readBody();
        const result = Array.isArray(body) ? body.map(d => indexDocument(d)) : indexDocument(body);
        respond(201, result);
      } else if (url.pathname === '/search/analytics' && req.method === 'GET') {
        respond(200, { queries: searchAnalytics.slice(-fibonacci(10)), metrics: { ...metrics } });
      } else if (url.pathname === '/health') {
        respond(200, health());
      } else {
        respond(404, { error: 'not_found' });
      }
    });
    server.listen(port);
    return server;
  });
}

const startTime = Date.now();
function health() {
  return {
    service: 'search-service',
    status: 'healthy',
    port: 3314,
    uptime: Date.now() - startTime,
    documentCount: documents.size,
    indexTerms: invertedIndex.size,
    cacheSize: queryCache.size,
    metrics: { ...metrics },
    phiConstants: { RRF_K, BM25_K1, BM25_B, MAX_RESULTS, CACHE_SIZE },
  };
}

export default { createServer, health, hybridSearch, indexDocument, expandQuery };
export { createServer, health, hybridSearch, indexDocument, expandQuery };
