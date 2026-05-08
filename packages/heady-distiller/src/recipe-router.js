/**
 * HeadyDistiller — RecipeRouter
 * Stage 22 of HCFullPipeline: Knowledge Distillation
 *
 * Routes incoming requests against the recipe store to find fast-path matches.
 * Supports exact, semantic, and composite match strategies.
 * Tier 3 replays cached output directly; Tier 2 provides a suggested fast-path;
 * Tier 1 enriches pipeline context.
 *
 * All constants derive from phi-math. Zero placeholders. Production-grade.
 */

import pino from 'pino';
import {
  PHI, PSI, PSI2,
  FIB,
  CSL_SUPPRESS, CSL_INCLUDE, CSL_MINIMUM, CSL_BOOST, CSL_INJECT,
  CSL_MEDIUM, CSL_HIGH, CSL_CRITICAL, CSL_DEDUP,
} from '../shared/phi-math.js';
import { HeadyError, ValidationError, RoutingError } from '../shared/errors.js';
import { RecipeStore } from './recipe-store.js';

// ── Logger ───────────────────────────────────────────────────────────────────
const logger = pino({ name: 'heady-distiller:recipe-router', level: 'info' });

// ── Phi-derived constants ─────────────────────────────────────────────────────
const SEMANTIC_THRESHOLD   = CSL_MEDIUM;    // 0.809 — cosine similarity gate
const TOP_SEMANTIC_RESULTS = FIB[7];        // 13    — semantic candidates to re-rank

// Fibonacci latency buckets (ms) — for Fibonacci-bucketed histogram tracking
// fib[0..16]: 0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987
const LATENCY_BUCKETS = FIB.map((v) => v); // full FIB array as bucket ceilings (ms)

// ── Match type constants ─────────────────────────────────────────────────────
const MATCH_EXACT     = 'exact';
const MATCH_SEMANTIC  = 'semantic';
const MATCH_COMPOSITE = 'composite';
const MATCH_NONE      = 'none';

// ─────────────────────────────────────────────────────────────────────────────
// RecipeRouter
// ─────────────────────────────────────────────────────────────────────────────
export class RecipeRouter {
  /**
   * @param {{ recipeStore: RecipeStore, embeddingClient: Object }} opts
   *
   * embeddingClient must implement:
   *   async embed(text: string): Promise<number[]>  — returns 384D float vector
   *   async search(queryVec: number[], corpus: Array, topK: number): Promise<Array<{item, similarity}>>
   *     OR embeddings can be pre-stored on recipe objects as `embedding: number[]`
   */
  constructor({ recipeStore, embeddingClient } = {}) {
    if (!recipeStore)      throw new ValidationError('RecipeRouter requires recipeStore');
    if (!embeddingClient)  throw new ValidationError('RecipeRouter requires embeddingClient');

    this._store   = recipeStore;
    this._embedder = embeddingClient;

    // Route stats counters
    this._stats = {
      totalRoutes:       0,
      exactMatches:      0,
      semanticMatches:   0,
      compositeMatches:  0,
      misses:            0,
    };

    // Fibonacci-bucketed latency histogram
    // Each bucket i covers latencies in (LATENCY_BUCKETS[i-1], LATENCY_BUCKETS[i]] ms
    this._latencyHistogram = Object.fromEntries(
      LATENCY_BUCKETS.map((ceil, i) => [
        i,
        { ceiling: ceil, count: 0 },
      ])
    );

    logger.info(
      {
        semanticThreshold: SEMANTIC_THRESHOLD,
        latencyBuckets:    LATENCY_BUCKETS.length,
      },
      'RecipeRouter initialised'
    );
  }

  // ── Core routing ────────────────────────────────────────────────────────────

  /**
   * Route an incoming intent against the recipe store.
   *
   * Strategy (in order):
   *   1. Exact match  — hash intent + look up by traceHash
   *   2. Semantic     — embed intent, cosine similarity >= MEDIUM(0.809) against candidates
   *   3. Composite    — check composites table for taskClass match
   *   4. Miss         — no usable fast-path found
   *
   * @param {string}   intent        — natural-language intent string
   * @param {number[]} taskEmbedding — 384D embedding vector of the task
   * @param {string}   taskClass     — task classification token
   * @param {number}   [minTier=1]   — minimum acceptable tier
   * @returns {Promise<{
   *   matched: boolean,
   *   matchType: 'exact'|'semantic'|'composite'|'none',
   *   recipe: Object|null,
   *   similarity: number,
   *   tier: number
   * }>}
   */
  async route(intent, taskEmbedding, taskClass, minTier = 1) {
    if (!intent)    throw new ValidationError('route: intent is required');
    if (!taskClass) throw new ValidationError('route: taskClass is required');

    const t0 = Date.now();
    this._stats.totalRoutes++;

    try {
      // ── Step 1: Exact match ─────────────────────────────────────────────
      const exactResult = await this._exactMatch(intent, taskClass, minTier);
      if (exactResult.matched) {
        this._stats.exactMatches++;
        this._recordLatency(Date.now() - t0);
        logger.info(
          { matchType: MATCH_EXACT, tier: exactResult.tier, taskClass, latencyMs: Date.now() - t0 },
          'Route: exact match'
        );
        return exactResult;
      }

      // ── Step 2: Semantic match ──────────────────────────────────────────
      const semanticResult = await this._semanticMatch(taskEmbedding, taskClass, minTier);
      if (semanticResult.matched) {
        this._stats.semanticMatches++;
        this._recordLatency(Date.now() - t0);
        logger.info(
          {
            matchType: MATCH_SEMANTIC,
            similarity: semanticResult.similarity,
            tier: semanticResult.tier,
            taskClass,
            latencyMs: Date.now() - t0,
          },
          'Route: semantic match'
        );
        return semanticResult;
      }

      // ── Step 3: Composite match ─────────────────────────────────────────
      const compositeResult = await this._compositeMatch(taskClass);
      if (compositeResult.matched) {
        this._stats.compositeMatches++;
        this._recordLatency(Date.now() - t0);
        logger.info(
          { matchType: MATCH_COMPOSITE, taskClass, latencyMs: Date.now() - t0 },
          'Route: composite match'
        );
        return compositeResult;
      }

      // ── Step 4: Miss ───────────────────────────────────────────────────
      this._stats.misses++;
      this._recordLatency(Date.now() - t0);
      logger.debug({ taskClass, latencyMs: Date.now() - t0 }, 'Route: miss');
      return { matched: false, matchType: MATCH_NONE, recipe: null, similarity: 0, tier: 0 };

    } catch (err) {
      this._recordLatency(Date.now() - t0);
      logger.error({ err, taskClass }, 'route() encountered an error');
      throw new RoutingError(`route failed for taskClass=${taskClass}: ${err.message}`, { cause: err });
    }
  }

  // ── Replay ──────────────────────────────────────────────────────────────────

  /**
   * Replay a recipe against a given input.
   *
   * Tier 3 — return cached output directly (full skip).
   * Tier 2 — return recipe config as a suggested fast-path (pipeline runs but skips trial/arena).
   * Tier 1 — return recipe as context enrichment (pipeline runs normally but gains prior context).
   *
   * @param {Object} recipe — recipe object (must include tier)
   * @param {*}      input  — incoming request payload
   * @returns {Promise<{
   *   tier: number,
   *   mode: 'full-skip'|'fast-path'|'context-enrichment',
   *   output: *,
   *   fastPathConfig: Object|null,
   *   contextEnrichment: Object|null
   * }>}
   */
  async replay(recipe, input) {
    _validateReplayRecipe(recipe);

    const { tier } = recipe;

    if (tier === 3) {
      // Full skip — return cached output
      logger.info({ tier, traceHash: recipe.traceHash }, 'replay: full-skip (Tier 3)');
      return {
        tier,
        mode:              'full-skip',
        output:            recipe.output ?? recipe.outputHash ?? null,
        fastPathConfig:    null,
        contextEnrichment: null,
      };
    }

    if (tier === 2) {
      // Fast-path — pipeline runs but skips trial and arena stages
      const fastPathConfig = _buildFastPathConfig(recipe);
      logger.info({ tier, traceHash: recipe.traceHash }, 'replay: fast-path (Tier 2)');
      return {
        tier,
        mode:              'fast-path',
        output:            null,
        fastPathConfig,
        contextEnrichment: null,
      };
    }

    if (tier === 1) {
      // Context enrichment — pipeline runs normally but gains prior context
      const contextEnrichment = _buildContextEnrichment(recipe);
      logger.info({ tier, traceHash: recipe.traceHash }, 'replay: context-enrichment (Tier 1)');
      return {
        tier,
        mode:              'context-enrichment',
        output:            null,
        fastPathConfig:    null,
        contextEnrichment,
      };
    }

    throw new RoutingError(`replay: unsupported tier=${tier}`);
  }

  // ── Stats ────────────────────────────────────────────────────────────────────

  /**
   * Returns routing statistics.
   * @returns {{ totalRoutes, exactMatches, semanticMatches, compositeMatches, misses, latencyHistogram }}
   */
  getRouteStats() {
    return {
      ...this._stats,
      latencyHistogram: Object.values(this._latencyHistogram).map(({ ceiling, count }) => ({
        ceilingMs: ceiling,
        count,
      })),
    };
  }

  // ── Private match strategies ─────────────────────────────────────────────────

  /**
   * Exact match: hash the intent with a synthetic trace and look up by traceHash.
   * Since intent alone may not map 1-to-1 with stored traceHashes (which include
   * inputSignature + stageNames), we use matchRecipe() with minTier and look for
   * an entry whose inputSignature embeds the hashed intent.
   *
   * For true exact-hash lookup, we construct a probe trace from the intent string.
   */
  async _exactMatch(intent, taskClass, minTier) {
    const probeTrace = {
      inputSignature: { intentText: intent },
      stageSequence:  [],
      taskClass,
    };
    const probeHash = RecipeStore.hashTrace(probeTrace);

    // Direct hash lookup via store — query for matching traceHash
    const candidates = await this._store.matchRecipe(intent, taskClass, minTier);

    // Look for a record whose traceHash matches the probe (pure exact) or whose
    // inputSignature.intentText === intent (near-exact).
    const exact = candidates.find(
      (r) =>
        r.traceHash === probeHash ||
        r.inputSignature?.intentText === intent
    );

    if (!exact) {
      return { matched: false, matchType: MATCH_EXACT, recipe: null, similarity: 1.0, tier: 0 };
    }

    return {
      matched:   true,
      matchType: MATCH_EXACT,
      recipe:    exact,
      similarity: 1.0,
      tier:      exact.tier,
    };
  }

  /**
   * Semantic match: embed the intent, compute cosine similarity against candidate
   * recipe embeddings, return best match if >= MEDIUM(0.809).
   */
  async _semanticMatch(taskEmbedding, taskClass, minTier) {
    if (!taskEmbedding || taskEmbedding.length === 0) {
      return { matched: false, matchType: MATCH_SEMANTIC, recipe: null, similarity: 0, tier: 0 };
    }

    // Pull top candidates from DB for this taskClass
    const candidates = await this._store.getRecipes({
      taskClass,
      limit: TOP_SEMANTIC_RESULTS,
    });

    if (candidates.length === 0) {
      return { matched: false, matchType: MATCH_SEMANTIC, recipe: null, similarity: 0, tier: 0 };
    }

    // Compute cosine similarity for each candidate that has an embedding
    let best = null;
    let bestSim = -Infinity;

    for (const recipe of candidates) {
      if (recipe.tier < minTier) continue;
      if (!recipe.embedding) continue; // skip recipes without stored embeddings

      const sim = _cosineSimilarity(taskEmbedding, recipe.embedding);
      if (sim > bestSim) {
        bestSim = sim;
        best    = recipe;
      }
    }

    // Also ask the embeddingClient if it supports corpus search
    if (typeof this._embedder.search === 'function') {
      const corpusWithEmbeddings = candidates.filter(
        (r) => r.embedding && r.tier >= minTier
      );
      if (corpusWithEmbeddings.length > 0) {
        const results = await this._embedder.search(
          taskEmbedding,
          corpusWithEmbeddings,
          TOP_SEMANTIC_RESULTS
        );
        if (results.length > 0 && results[0].similarity > bestSim) {
          bestSim = results[0].similarity;
          best    = results[0].item;
        }
      }
    }

    if (!best || bestSim < SEMANTIC_THRESHOLD) {
      return {
        matched:   false,
        matchType: MATCH_SEMANTIC,
        recipe:    null,
        similarity: Math.max(0, bestSim),
        tier:      0,
      };
    }

    return {
      matched:   true,
      matchType: MATCH_SEMANTIC,
      recipe:    best,
      similarity: bestSim,
      tier:      best.tier,
    };
  }

  /**
   * Composite match: check the composites table for the taskClass.
   */
  async _compositeMatch(taskClass) {
    const composite = await this._store.getComposite(taskClass);
    if (!composite) {
      return { matched: false, matchType: MATCH_COMPOSITE, recipe: null, similarity: 0, tier: 0 };
    }

    return {
      matched:   true,
      matchType: MATCH_COMPOSITE,
      recipe:    { ...composite, tier: 1 }, // composites treated as Tier 1 floor
      similarity: composite.avgScore ?? 0,
      tier:      1,
    };
  }

  // ── Latency tracking ─────────────────────────────────────────────────────────

  /**
   * Record a latency observation into the Fibonacci-bucketed histogram.
   * Bucket i covers (FIB[i-1], FIB[i]] ms.
   * Overflows go into the last bucket.
   */
  _recordLatency(ms) {
    const idx = LATENCY_BUCKETS.findIndex((ceil) => ms <= ceil);
    const bucket = idx === -1 ? LATENCY_BUCKETS.length - 1 : idx;
    if (this._latencyHistogram[bucket]) {
      this._latencyHistogram[bucket].count++;
    }
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Cosine similarity between two equal-length float vectors.
 * Returns value in [-1, 1]. Safe against zero vectors (returns 0).
 */
function _cosineSimilarity(a, b) {
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
 * Build a fast-path config from a Tier 2 recipe.
 * Strips trial and arena stages; preserves core execution stages.
 */
function _buildFastPathConfig(recipe) {
  const skipStages = new Set(['trial', 'arena', 'battle', 'tournament', 'evaluation-pool']);
  const filteredSequence = (recipe.stageSequence ?? []).filter(
    (s) => !skipStages.has((s.name ?? s).toLowerCase())
  );

  return {
    stageSequence:   filteredSequence,
    consensusConfig: recipe.consensusConfig ?? {},
    prompt:          recipe.prompt ?? null,
    sourceRecipe: {
      traceHash:  recipe.traceHash,
      judgeScore: recipe.judgeScore,
      tier:       recipe.tier,
    },
    skippedStages: (recipe.stageSequence ?? [])
      .filter((s) => skipStages.has((s.name ?? s).toLowerCase()))
      .map((s) => s.name ?? s),
    // Phi-derived time-budget estimate: each stage weighted by PSI^rank
    estimatedMs: _estimateFastPathMs(filteredSequence),
  };
}

/**
 * Build a context enrichment object from a Tier 1 recipe.
 * Includes stage metadata and prior successful config hints.
 */
function _buildContextEnrichment(recipe) {
  return {
    priorSuccess: {
      traceHash:       recipe.traceHash,
      judgeScore:      recipe.judgeScore,
      executionCount:  recipe.executions ?? 1,
    },
    suggestedStages:   recipe.stageSequence ?? [],
    consensusConfig:   recipe.consensusConfig ?? {},
    prompt:            recipe.prompt ?? null,
    taskClass:         recipe.taskClass,
    // Signal to the pipeline how confidently it can use this context
    enrichmentConfidence: recipe.judgeScore * CSL_BOOST, // scale down by PSI
  };
}

/**
 * Estimate total latency for a fast-path execution.
 * Uses phi-geometric summation: sum of (duration * PSI^rank) for each stage.
 */
function _estimateFastPathMs(stages) {
  return stages.reduce((acc, stage, i) => {
    const base = stage.duration ?? FIB[5] * 10; // default 50ms per stage
    return acc + base * Math.pow(PSI, i);
  }, 0);
}

/** Validate recipe has minimum fields for replay */
function _validateReplayRecipe(recipe) {
  if (!recipe)                       throw new ValidationError('replay: recipe is required');
  if (typeof recipe.tier !== 'number')
    throw new ValidationError('replay: recipe.tier must be a number');
  if (recipe.tier < 1 || recipe.tier > 3)
    throw new ValidationError('replay: recipe.tier must be 1, 2, or 3');
}
