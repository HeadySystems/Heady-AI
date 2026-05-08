/**
 * @module knowledge-compressor
 * @description Compresses HCFullPipeline execution knowledge into compact
 * 384D vector-indexed facts for HeadyDistiller Stage 22 DISTILL.
 *
 * Compression pipeline per trace:
 *   1. Extract key facts from trace results (max FIB[6]=8 facts)
 *   2. Extract successful stage patterns (order, config, timing)
 *   3. Embed each fact as a 384D float vector via embeddingClient
 *   4. Dedup against existing knowledge (cosine >= CSL.DEDUP = 0.972)
 *   5. Store new facts in vector store with structured metadata
 *   6. Return compression metrics: factsExtracted, factsStored, duplicatesSkipped, tokenReduction
 *
 * Tiered compression:
 *   Tier 3 — Deterministic route  (judgeScore >= 0.95)
 *   Tier 2 — Good route           (judgeScore >= CSL.HIGH = 0.882)
 *   Tier 1 — Passing route        (judgeScore >= CSL.BOOST = 0.618)
 *
 * All constants derive from phi-math.
 */

import { createLogger }      from '../shared/structured-logger.js';
import { CompressionError }  from '../shared/errors.js';
import {
  FIB,
  CSL,
  phiFusionWeights,
  cosineSimilarity,
  normalize,
} from '../shared/phi-math.js';

// ---------------------------------------------------------------------------
// Constants (phi/Fibonacci derived)
// ---------------------------------------------------------------------------

/** Maximum facts extracted per trace: FIB[6] = 8 */
const MAX_FACTS_PER_TRACE = FIB[6]; // 8

/** Dedup cosine similarity threshold: CSL.DEDUP = 0.972 */
const DEDUP_THRESHOLD = CSL.DEDUP; // 0.972

/** Default topK for relevant retrieval: FIB[5] = 5 */
const DEFAULT_TOP_K = FIB[5]; // 5

/** Minimum similarity for retrieval: CSL.BOOST = 0.618 */
const DEFAULT_MIN_SIMILARITY = CSL.BOOST; // 0.618

// ---------------------------------------------------------------------------
// Compression tier boundaries
// ---------------------------------------------------------------------------

const TIER = Object.freeze({
  /** Tier 3 — Deterministic route: system trusts this recipe fully */
  DETERMINISTIC: 0.95,
  /** Tier 2 — Good route: strong signal, use with light validation */
  GOOD:  CSL.HIGH,     // 0.882
  /** Tier 1 — Passing route: valid but require confidence weighting */
  PASSING: CSL.BOOST,  // 0.618
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Determine the compression tier for a judgeScore.
 *
 * @param {number} judgeScore
 * @returns {'tier3'|'tier2'|'tier1'|'none'}
 */
function classifyTier(judgeScore) {
  if (judgeScore >= TIER.DETERMINISTIC) return 'tier3';
  if (judgeScore >= TIER.GOOD)          return 'tier2';
  if (judgeScore >= TIER.PASSING)       return 'tier1';
  return 'none';
}

/**
 * Safely parse JSONB field (handles string-encoded JSON from Postgres).
 * @param {any} raw
 * @returns {object|Array}
 */
function parseField(raw) {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw;
}

/**
 * Estimate token count for a value (rough approximation: 1 token ≈ 4 chars).
 *
 * @param {any} value
 * @returns {number} Estimated token count.
 */
function estimateTokens(value) {
  const serialised = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return Math.ceil(serialised.length / 4);
}

/**
 * Extract key facts from trace stage results.
 *
 * A "fact" is a concise natural-language statement about what a stage produced,
 * suitable for embedding and semantic retrieval.
 *
 * @param {object} stageResults  - Parsed stage_results JSONB.
 * @param {string} runId         - Source run identifier.
 * @param {string} tier          - Compression tier label.
 * @returns {{ text: string, factType: 'key_fact', stageKey: string, runId: string, tier: string }[]}
 */
function extractKeyFacts(stageResults, runId, tier) {
  const keys = Object.keys(stageResults);
  const facts = [];

  for (const key of keys) {
    if (facts.length >= MAX_FACTS_PER_TRACE) break;

    const val = stageResults[key];
    if (!val || typeof val !== 'object') continue;

    // Build a compact textual summary of the stage output
    const scoreHints = [];
    if (val.score       != null) scoreHints.push(`score=${Number(val.score).toFixed(3)}`);
    if (val.judgeScore  != null) scoreHints.push(`judgeScore=${Number(val.judgeScore).toFixed(3)}`);
    if (val.confidence  != null) scoreHints.push(`confidence=${Number(val.confidence).toFixed(3)}`);
    if (val.tokens      != null) scoreHints.push(`tokens=${val.tokens}`);
    if (val.latency     != null) scoreHints.push(`latencyMs=${val.latency}`);

    const scoreSuffix = scoreHints.length > 0 ? ` (${scoreHints.join(', ')})` : '';
    const statusHint  = val.status ? ` status=${val.status}` : '';

    const text =
      `Stage "${key}" in run ${runId}${statusHint} produced output${scoreSuffix}. Tier: ${tier}.`;

    facts.push({
      text,
      factType:  'key_fact',
      stageKey:  key,
      runId,
      tier,
    });
  }

  return facts;
}

/**
 * Extract successful stage patterns from a trace.
 *
 * A "stage pattern" captures the execution order, elapsed time, and
 * which stages were active — useful for recipe generation.
 *
 * @param {object[]} timeline - Parsed timeline array.
 * @param {string}   runId
 * @param {string}   tier
 * @param {number}   elapsed  - Total elapsed ms.
 * @returns {{ text: string, factType: 'stage_pattern', runId: string, tier: string }[]}
 */
function extractStagePatterns(timeline, runId, tier, elapsed) {
  if (!Array.isArray(timeline) || timeline.length === 0) return [];

  const stageNames = timeline
    .map(e => (typeof e === 'string' ? e : e?.stage ?? e?.name ?? ''))
    .filter(Boolean);

  if (stageNames.length === 0) return [];

  const pattern = stageNames.join(' → ');
  const text =
    `Run ${runId} executed ${stageNames.length} stage(s) in order: ${pattern}. ` +
    `Total elapsed: ${elapsed}ms. Tier: ${tier}.`;

  return [{
    text,
    factType:     'stage_pattern',
    stagePattern: pattern,
    stageCount:   stageNames.length,
    runId,
    tier,
    elapsed,
  }];
}

/**
 * Convert tip objects to embeddable fact records.
 *
 * @param {{ tip: string, conditions: object, sourceTraceId: string, confidence: number }[]} tips
 * @param {string} tier
 * @returns {{ text: string, factType: 'tip', sourceTraceId: string, tier: string, confidence: number }[]}
 */
function tipsToFacts(tips, tier) {
  return (tips ?? []).map(t => ({
    text:          t.tip,
    factType:      'tip',
    sourceTraceId: t.sourceTraceId,
    conditions:    t.conditions,
    tier,
    confidence:    t.confidence,
  }));
}

// ---------------------------------------------------------------------------
// KnowledgeCompressor
// ---------------------------------------------------------------------------

export class KnowledgeCompressor {
  /**
   * @param {object} opts
   * @param {object} opts.embeddingClient
   *   Must expose: async embed(text: string) => Float64Array(384) | number[]
   * @param {object} opts.vectorStore
   *   Must expose:
   *     async upsert(id: string, embedding: number[], metadata: object) => void
   *     async search(embedding: number[], topK: number, minSimilarity: number) => {id, score, metadata}[]
   */
  constructor({ embeddingClient, vectorStore }) {
    if (!embeddingClient || typeof embeddingClient.embed !== 'function') {
      throw new TypeError('KnowledgeCompressor: embeddingClient must expose embed(text)');
    }
    if (!vectorStore ||
        typeof vectorStore.upsert  !== 'function' ||
        typeof vectorStore.search  !== 'function') {
      throw new TypeError(
        'KnowledgeCompressor: vectorStore must expose upsert(id, embedding, metadata) and search(embedding, topK, minSimilarity)'
      );
    }

    this._embed       = (text) => embeddingClient.embed(text);
    this._vectorStore = vectorStore;
    this._log         = createLogger('knowledge-compressor');
  }

  // -------------------------------------------------------------------------
  // compress
  // -------------------------------------------------------------------------

  /**
   * Compress a filtered pipeline trace and its associated tips into 384D
   * vector knowledge units.
   *
   * Steps:
   *   1. Classify compression tier by judgeScore
   *   2. Extract key facts (max FIB[6]=8) from stageResults
   *   3. Extract stage patterns from timeline
   *   4. Convert tips to fact records
   *   5. Embed each fact via embeddingClient
   *   6. Dedup against vector store (cosine >= DEDUP_THRESHOLD = 0.972)
   *   7. Upsert novel facts into vector store
   *   8. Return compression metrics
   *
   * @param {object}   trace - Trace row from distiller_traces (Postgres format).
   * @param {object[]} [tips=[]] - Tips from TrajectoryFilter.extractTips().
   *
   * @returns {Promise<{
   *   factsExtracted: number,
   *   factsStored: number,
   *   duplicatesSkipped: number,
   *   tokenReduction: number,
   * }>}
   */
  async compress(trace, tips = []) {
    const runId      = trace?.run_id ?? trace?.runId ?? 'unknown';
    const judgeScore = Number(trace?.judge_score ?? trace?.judgeScore ?? 0);
    const elapsed    = Number(trace?.elapsed ?? 0);
    const tier       = classifyTier(judgeScore);

    if (tier === 'none') {
      this._log.info({ runId, judgeScore }, 'Trace below BOOST threshold — skipping compression');
      return { factsExtracted: 0, factsStored: 0, duplicatesSkipped: 0, tokenReduction: 0 };
    }

    this._log.info({ runId, judgeScore, tier }, 'Compressing trace');

    const stageResults = parseField(trace?.stage_results ?? trace?.stageResults);
    const timeline     = Array.isArray(trace?.timeline) ? trace.timeline
                       : parseField(trace?.timeline) ?? [];

    // Estimate original token footprint before compression
    const originalTokens = estimateTokens(stageResults) + estimateTokens(timeline);

    // ----- Build fact list -----
    const rawFacts = [
      ...extractKeyFacts(stageResults, runId, tier),
      ...extractStagePatterns(timeline, runId, tier, elapsed),
      ...tipsToFacts(tips.filter(t => t.sourceTraceId === runId || !t.sourceTraceId), tier),
    ];

    const factsExtracted = rawFacts.length;
    let factsStored       = 0;
    let duplicatesSkipped = 0;

    // ----- Embed → dedup → store -----
    const [wScore, wConf] = phiFusionWeights(2); // [0.618…, 0.381…]

    for (let i = 0; i < rawFacts.length; i++) {
      const fact = rawFacts[i];

      let embedding;
      try {
        const raw = await this._embed(fact.text);
        embedding = normalize(Array.from(raw));
      } catch (err) {
        throw new CompressionError(`Failed to embed fact[${i}] for run ${runId}`, {
          traceId:   runId,
          factType:  fact.factType,
          factIndex: i,
          cause:     err.message,
        });
      }

      // Dedup: search for near-identical facts in the vector store
      let isDuplicate = false;
      try {
        const neighbours = await this._vectorStore.search(embedding, 1, DEDUP_THRESHOLD);
        if (neighbours && neighbours.length > 0 && neighbours[0].score >= DEDUP_THRESHOLD) {
          isDuplicate = true;
          this._log.debug({
            runId,
            factType: fact.factType,
            existingId: neighbours[0].id,
            similarity: neighbours[0].score,
          }, 'Dedup: near-identical fact already stored');
        }
      } catch (err) {
        // Non-fatal: if we can't search, proceed with upsert (may overwrite)
        this._log.warn({ err, runId, factType: fact.factType }, 'Dedup search failed — proceeding with upsert');
      }

      if (isDuplicate) {
        duplicatesSkipped++;
        continue;
      }

      // Build a stable fact ID: SHA-256 would require node:crypto, use a deterministic string
      const factId = `${runId}::${fact.factType}::${i}::${tier}`;

      // Phi-fused confidence for metadata
      const factConf = Number(fact.confidence ?? judgeScore);
      const metaConf = wScore * judgeScore + wConf * factConf;

      const metadata = {
        traceId:      runId,
        factType:     fact.factType,
        confidence:   metaConf,
        tier,
        judgeScore,
        createdAt:    new Date().toISOString(),
        stageKey:     fact.stageKey,
        stagePattern: fact.stagePattern,
        sourceTraceId: fact.sourceTraceId,
        conditions:   fact.conditions,
      };

      try {
        await this._vectorStore.upsert(factId, embedding, metadata);
        factsStored++;
      } catch (err) {
        throw new CompressionError(`Failed to upsert fact[${i}] for run ${runId}`, {
          traceId:   runId,
          factType:  fact.factType,
          factIndex: i,
          cause:     err.message,
        });
      }
    }

    // ----- Token reduction metric -----
    // Compressed size ≈ each stored fact's text token count
    const compressedTokens = rawFacts
      .slice(0, factsStored + duplicatesSkipped)
      .reduce((acc, f) => acc + estimateTokens(f.text), 0);

    const tokenReduction = originalTokens > 0
      ? Math.max(0, Math.min(1, (originalTokens - compressedTokens) / originalTokens))
      : 0;

    this._log.info({
      runId,
      tier,
      factsExtracted,
      factsStored,
      duplicatesSkipped,
      tokenReduction: tokenReduction.toFixed(4),
    }, 'Compression complete');

    return { factsExtracted, factsStored, duplicatesSkipped, tokenReduction };
  }

  // -------------------------------------------------------------------------
  // retrieveRelevant
  // -------------------------------------------------------------------------

  /**
   * Retrieve the most relevant prior knowledge facts for a given query embedding.
   *
   * Uses the vector store's cosine-similarity search. Results are already
   * sorted by descending similarity by convention.
   *
   * @param {number[]|Float32Array|Float64Array} queryEmbedding - 384D query vector.
   * @param {number} [topK=FIB[5]]         - Maximum results (default 5).
   * @param {number} [minSimilarity=CSL.BOOST] - Minimum cosine similarity (default 0.618).
   *
   * @returns {Promise<{ id: string, score: number, metadata: object }[]>}
   */
  async retrieveRelevant(
    queryEmbedding,
    topK          = DEFAULT_TOP_K,
    minSimilarity = DEFAULT_MIN_SIMILARITY,
  ) {
    if (!queryEmbedding || queryEmbedding.length === 0) {
      throw new CompressionError('retrieveRelevant: queryEmbedding must be a non-empty vector');
    }

    const normalisedQuery = normalize(Array.from(queryEmbedding));
    const safeTopK = Math.max(1, Math.min(Math.floor(topK), FIB[12])); // cap at 144

    try {
      const results = await this._vectorStore.search(normalisedQuery, safeTopK, minSimilarity);
      return Array.isArray(results) ? results : [];
    } catch (err) {
      throw new CompressionError('retrieveRelevant: vector store search failed', {
        cause:         err.message,
        topK:          safeTopK,
        minSimilarity,
      });
    }
  }
}

export default KnowledgeCompressor;
