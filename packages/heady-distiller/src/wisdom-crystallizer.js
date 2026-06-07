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
// ║  FILE: packages/heady-distiller/src/wisdom-crystallizer.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * HeadyDistiller — WisdomCrystallizer
 * Stage 22 of HCFullPipeline: Knowledge Distillation
 *
 * Crystallizes long-term wisdom from accumulated distillation results.
 * Bridges to AncestralWisdom — stores and queries wisdom entries compatible
 * with the AncestralWisdomStore schema (384D pgvector).
 *
 * Wisdom types:
 *   successStrategy    — stage sequences that achieve high scores
 *   failurePattern     — anti-patterns that correlate with low scores
 *   optimizationHint   — config tuning signals
 *   domainKnowledge    — aggregate facts by domain/category
 *
 * Phi-decay on relevance: fitness × PSI^(age/halfLife), halfLife = FIB[7]=13 generations.
 * Fibonacci generational compression at FIB generation boundaries.
 * Dedup threshold: DEDUP(0.972) — above CRITICAL, semantic identity.
 *
 * All constants derive from phi-math. Zero placeholders. Production-grade.
 */

import crypto from 'node:crypto';
import pino from 'pino';
import { neon } from '@neondatabase/serverless';
import { Redis } from '@upstash/redis';
import {
  PHI, PSI, PSI2,
  FIB,
  CSL_SUPPRESS, CSL_INCLUDE, CSL_MINIMUM, CSL_BOOST, CSL_INJECT,
  CSL_MEDIUM, CSL_HIGH, CSL_CRITICAL, CSL_DEDUP,
} from '../shared/phi-math.js';
import { HeadyError, ValidationError, StorageError } from '../shared/errors.js';

// ── Logger ───────────────────────────────────────────────────────────────────
const logger = pino({ name: 'heady-distiller:wisdom-crystallizer', level: 'info' });

// ── Phi-derived constants ─────────────────────────────────────────────────────
const WISDOM_HALF_LIFE        = FIB[7];   // 13     — decay half-life in generations
const WISDOM_TOPK_DEFAULT     = FIB[5];   // 5      — default topK for queryWisdom
const DEDUP_THRESHOLD         = CSL_DEDUP; // 0.972  — semantic identity gate
const FAILURE_SCORE_CEILING   = CSL_BOOST; // 0.618  — below this = failure pattern
const COMPRESSION_GENERATIONS = new Set(FIB.filter(Boolean)); // FIB boundary set: {1,2,3,5,8,13,21,34,55,89,144,233,377,610,987}

// Wisdom type constants
const WT_SUCCESS    = 'successStrategy';
const WT_FAILURE    = 'failurePattern';
const WT_OPTIM      = 'optimizationHint';
const WT_DOMAIN     = 'domainKnowledge';

// The canonical agent_id for all wisdom emitted by the distiller
const DISTILLER_AGENT_ID = 'distiller';

// ── Redis keys ────────────────────────────────────────────────────────────────
const genCounterKey  = () => `heady:wisdom:generation`;
const statsKey       = () => `heady:wisdom:stats`;

// ─────────────────────────────────────────────────────────────────────────────
// WisdomCrystallizer
// ─────────────────────────────────────────────────────────────────────────────
export class WisdomCrystallizer {
  /**
   * @param {{ pgUrl: string, redisUrl: string, redisToken?: string, embeddingClient: Object }} opts
   *
   * embeddingClient must implement:
   *   async embed(text: string): Promise<number[]>  — returns 384D float vector
   */
  constructor({ pgUrl, redisUrl, redisToken, embeddingClient } = {}) {
    if (!pgUrl)            throw new ValidationError('WisdomCrystallizer requires pgUrl');
    if (!redisUrl)         throw new ValidationError('WisdomCrystallizer requires redisUrl');
    if (!embeddingClient)  throw new ValidationError('WisdomCrystallizer requires embeddingClient');

    this._sql      = neon(pgUrl);
    this._redis    = new Redis({
      url:   redisUrl,
      token: redisToken ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
    });
    this._embedder = embeddingClient;

    logger.info(
      {
        halfLife:   WISDOM_HALF_LIFE,
        dedup:      DEDUP_THRESHOLD,
        fibSet:     [...COMPRESSION_GENERATIONS].slice(0, 10),
      },
      'WisdomCrystallizer initialised'
    );
  }

  // ── Schema bootstrap ────────────────────────────────────────────────────────

  /**
   * Ensure ancestral_wisdom table exists. Compatible with AncestralWisdomStore schema.
   * Call once at service startup.
   */
  async bootstrap() {
    // Ensure pgvector extension
    await this._sql`CREATE EXTENSION IF NOT EXISTS vector`;

    await this._sql`
      CREATE TABLE IF NOT EXISTS ancestral_wisdom (
        id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id          VARCHAR(128)  NOT NULL DEFAULT 'distiller',
        generation        INT           NOT NULL DEFAULT 1,
        wisdom_type       VARCHAR(64)   NOT NULL
                            CHECK (wisdom_type IN (
                              'successStrategy',
                              'failurePattern',
                              'optimizationHint',
                              'domainKnowledge'
                            )),
        embedding         vector(384),
        content           JSONB         NOT NULL DEFAULT '{}',
        fitness_score     FLOAT         NOT NULL DEFAULT 0,
        inheritance_count INT           NOT NULL DEFAULT 0,
        compressed_at     TIMESTAMPTZ,
        created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
      )
    `;

    await this._sql`
      CREATE INDEX IF NOT EXISTS idx_ancestral_wisdom_agent_gen
        ON ancestral_wisdom (agent_id, generation)
    `;
    await this._sql`
      CREATE INDEX IF NOT EXISTS idx_ancestral_wisdom_type
        ON ancestral_wisdom (wisdom_type)
    `;
    await this._sql`
      CREATE INDEX IF NOT EXISTS idx_ancestral_wisdom_fitness
        ON ancestral_wisdom (fitness_score DESC)
    `;

    // IVFFlat approximate-nearest-neighbour index for 384D embeddings
    // lists = FIB[8]=21 (sqrt(expected_rows) heuristic at Fibonacci scale)
    await this._sql`
      CREATE INDEX IF NOT EXISTS idx_ancestral_wisdom_embedding
        ON ancestral_wisdom
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 21)
    `.catch(() => {
      // IVFFlat requires rows to exist — ignore on empty table, will be created later
      logger.debug('IVFFlat index creation deferred (table may be empty)');
    });

    logger.info('WisdomCrystallizer schema bootstrapped');
  }

  // ── Core API ────────────────────────────────────────────────────────────────

  /**
   * Crystallize a distillation result into ancestral wisdom entries.
   *
   * Steps:
   *   1. Extract success/failure patterns from stage sequences
   *   2. Extract optimization hints from consensusConfig deltas
   *   3. Compute domain knowledge from task-class aggregates
   *   4. Embed each wisdom entry as 384D vector
   *   5. Dedup check: if cosine similarity >= DEDUP(0.972), merge by updating fitness
   *   6. Store in ancestral_wisdom table
   *   7. Fibonacci generational compression at FIB boundaries
   *
   * @param {Object} distillationResult
   * @returns {Promise<{ stored: number, merged: number, generation: number, entries: Object[] }>}
   */
  async crystallize(distillationResult) {
    _validateDistillationResult(distillationResult);

    const generation = await this._nextGeneration();

    // ── 1–3: Extract wisdom entries ─────────────────────────────────────────
    const rawEntries = _extractWisdomEntries(distillationResult, generation);
    if (rawEntries.length === 0) {
      logger.debug({ generation }, 'No wisdom entries extracted from distillation result');
      return { stored: 0, merged: 0, generation, entries: [] };
    }

    // ── 4: Embed each entry ─────────────────────────────────────────────────
    const embeddedEntries = await this._embedEntries(rawEntries);

    // ── 5: Dedup + store each entry ─────────────────────────────────────────
    let storedCount = 0;
    let mergedCount = 0;
    const storedEntries = [];

    for (const entry of embeddedEntries) {
      const { stored, merged } = await this._storeWithDedup(entry);
      if (stored && !merged) storedCount++;
      if (merged)            mergedCount++;
      if (stored || merged)  storedEntries.push(entry);
    }

    // ── 7: Fibonacci generational compression ──────────────────────────────
    if (COMPRESSION_GENERATIONS.has(generation)) {
      await this._fibonacciCompress(generation).catch((err) =>
        logger.warn({ err, generation }, 'Fibonacci compression failed (non-fatal)')
      );
    }

    // Invalidate stats cache
    await this._redis.del(statsKey()).catch(() => {});

    logger.info(
      {
        generation,
        extracted: rawEntries.length,
        stored: storedCount,
        merged: mergedCount,
        taskClass: distillationResult.taskClass,
      },
      'Wisdom crystallized'
    );

    return { stored: storedCount, merged: mergedCount, generation, entries: storedEntries };
  }

  /**
   * Query wisdom relevant to a task.
   *
   * Uses pgvector cosine similarity search, then applies phi-decay
   * on fitness_score to adjust relevance for entry age.
   *
   * relevance = fitness_score × PSI^(age/halfLife)
   *
   * @param {number[]} taskEmbedding — 384D vector
   * @param {number}   [topK=5]      — number of results
   * @returns {Promise<Object[]>} wisdom entries sorted by decayed relevance
   */
  async queryWisdom(taskEmbedding, topK = WISDOM_TOPK_DEFAULT) {
    if (!taskEmbedding || taskEmbedding.length === 0)
      throw new ValidationError('queryWisdom: taskEmbedding is required');

    const currentGen = await this._currentGeneration();
    const k = Math.max(1, Math.min(topK, FIB[10])); // cap at FIB[10]=55

    // pgvector ANN search — returns top k*PHI candidates for re-ranking
    const candidates = Math.ceil(k * PHI);
    const vectorStr  = `[${taskEmbedding.join(',')}]`;

    const rows = await this._sql`
      SELECT
        id, agent_id, generation, wisdom_type,
        content, fitness_score, inheritance_count,
        compressed_at, created_at,
        embedding <=> ${vectorStr}::vector AS distance
      FROM   ancestral_wisdom
      WHERE  agent_id = ${DISTILLER_AGENT_ID}
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT  ${candidates}
    `;

    // Apply phi-decay: relevance = fitness × PSI^(age/halfLife)
    const reranked = rows.map((row) => {
      const age       = Math.max(0, currentGen - (row.generation ?? 1));
      const decayed   = row.fitness_score * Math.pow(PSI, age / WISDOM_HALF_LIFE);
      const cosineSim = 1 - (row.distance ?? 1); // pgvector <=> is cosine distance
      return {
        id:               row.id,
        agentId:          row.agent_id,
        generation:       row.generation,
        wisdomType:       row.wisdom_type,
        content:          row.content,
        fitnessScore:     row.fitness_score,
        decayedRelevance: decayed,
        cosineSimilarity: cosineSim,
        inheritanceCount: row.inheritance_count,
        compressedAt:     row.compressed_at,
        createdAt:        row.created_at,
      };
    });

    reranked.sort((a, b) => b.decayedRelevance - a.decayedRelevance);
    return reranked.slice(0, k);
  }

  /**
   * Retrieve wisdom statistics.
   * @returns {Promise<{
   *   totalEntries: number,
   *   byType: Record<string, number>,
   *   avgFitness: number,
   *   generations: number,
   *   lastCompression: string|null
   * }>}
   */
  async getWisdomStats() {
    // Try Redis cache first (avoid hammering DB on every call)
    try {
      const cached = await this._redis.get(statsKey());
      if (cached) return typeof cached === 'string' ? JSON.parse(cached) : cached;
    } catch (_) { /* non-fatal */ }

    const [totals] = await this._sql`
      SELECT
        COUNT(*)::int                              AS total,
        AVG(fitness_score)                         AS avg_fitness,
        MAX(generation)                            AS max_generation,
        MAX(compressed_at)                         AS last_compression
      FROM ancestral_wisdom
      WHERE agent_id = ${DISTILLER_AGENT_ID}
    `;

    const typeRows = await this._sql`
      SELECT wisdom_type, COUNT(*)::int AS cnt
      FROM   ancestral_wisdom
      WHERE  agent_id = ${DISTILLER_AGENT_ID}
      GROUP  BY wisdom_type
    `;

    const byType = Object.fromEntries(typeRows.map((r) => [r.wisdom_type, r.cnt]));

    const stats = {
      totalEntries:    totals.total ?? 0,
      byType,
      avgFitness:      totals.avg_fitness ?? 0,
      generations:     totals.max_generation ?? 0,
      lastCompression: totals.last_compression ?? null,
    };

    // Cache for FIB[8]=21 seconds
    await this._redis.set(statsKey(), JSON.stringify(stats), { ex: FIB[8] }).catch(() => {});

    return stats;
  }

  // ── Private: Embedding ───────────────────────────────────────────────────────

  /**
   * Embed each raw wisdom entry's text summary into a 384D vector.
   */
  async _embedEntries(entries) {
    const results = [];
    for (const entry of entries) {
      const text = _entryToText(entry);
      try {
        const vec = await this._embedder.embed(text);
        results.push({ ...entry, embedding: vec });
      } catch (err) {
        logger.warn({ err, wisdomType: entry.wisdomType }, 'Embedding failed for wisdom entry — skipping');
      }
    }
    return results;
  }

  // ── Private: Dedup + Store ───────────────────────────────────────────────────

  /**
   * Check for near-duplicate entries (cosine >= DEDUP_THRESHOLD).
   * If found, merge by updating the existing entry's fitness_score upward.
   * Otherwise insert as new.
   */
  async _storeWithDedup(entry) {
    if (!entry.embedding || entry.embedding.length === 0) {
      return { stored: false, merged: false };
    }

    const vectorStr = `[${entry.embedding.join(',')}]`;

    // Find nearest neighbour
    const [nearest] = await this._sql`
      SELECT id, fitness_score, inheritance_count,
             embedding <=> ${vectorStr}::vector AS distance
      FROM   ancestral_wisdom
      WHERE  agent_id     = ${DISTILLER_AGENT_ID}
        AND  wisdom_type  = ${entry.wisdomType}
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT 1
    `;

    if (nearest) {
      const similarity = 1 - nearest.distance;
      if (similarity >= DEDUP_THRESHOLD) {
        // Merge: update fitness using phi-weighted blend
        // new_fitness = max(existing, candidate) * PHI / (PHI + 1) + min * 1/(PHI+1)
        const existF = nearest.fitness_score;
        const newF   = entry.fitnessScore ?? entry.fitness_score ?? 0;
        const merged = (Math.max(existF, newF) * PHI + Math.min(existF, newF)) / (PHI + 1);

        await this._sql`
          UPDATE ancestral_wisdom SET
            fitness_score     = ${merged},
            inheritance_count = ${nearest.inheritance_count + 1}
          WHERE id = ${nearest.id}
        `;
        logger.debug(
          { id: nearest.id, similarity, oldFitness: existF, newFitness: merged },
          'Wisdom dedup merge'
        );
        return { stored: true, merged: true };
      }
    }

    // Fresh insert
    const now = new Date();
    await this._sql`
      INSERT INTO ancestral_wisdom (
        id, agent_id, generation, wisdom_type,
        embedding, content, fitness_score,
        inheritance_count, compressed_at, created_at
      ) VALUES (
        ${crypto.randomUUID()},
        ${DISTILLER_AGENT_ID},
        ${entry.generation},
        ${entry.wisdomType},
        ${vectorStr}::vector,
        ${JSON.stringify(entry.content)},
        ${entry.fitnessScore ?? 0},
        0,
        NULL,
        ${now}
      )
    `;
    return { stored: true, merged: false };
  }

  // ── Private: Fibonacci Generational Compression ──────────────────────────────

  /**
   * At FIB boundary generations, compress older entries by computing centroids.
   *
   * For each wisdom_type, cluster entries from generation <= (generation - halfLife)
   * into centroid representatives.  Centroids are computed as phi-weighted averages
   * of embeddings, grouped by wisdomType.  Old entries are deleted; centroid
   * entries are inserted with compressed_at set.
   *
   * This prevents unbounded growth while preserving the distilled collective signal.
   *
   * @param {number} generation — the current generation at which compression triggers
   */
  async _fibonacciCompress(generation) {
    const olderThanGen = generation - WISDOM_HALF_LIFE;
    if (olderThanGen <= 0) return; // not enough history yet

    logger.info({ generation, olderThanGen }, 'Fibonacci generational compression starting');

    // For each wisdom type, gather old entries and compute centroid
    const wisdomTypes = [WT_SUCCESS, WT_FAILURE, WT_OPTIM, WT_DOMAIN];

    for (const wt of wisdomTypes) {
      const oldRows = await this._sql`
        SELECT id, embedding::text AS embedding_text, fitness_score, content
        FROM   ancestral_wisdom
        WHERE  agent_id      = ${DISTILLER_AGENT_ID}
          AND  wisdom_type   = ${wt}
          AND  generation    <= ${olderThanGen}
          AND  compressed_at IS NULL
        ORDER BY fitness_score DESC
        LIMIT  ${FIB[10]}
      `;

      if (oldRows.length < FIB[5]) continue; // need at least FIB[5]=5 to bother compressing

      // Parse embeddings
      const embeds = oldRows.map((r) => _parseVectorText(r.embedding_text)).filter(Boolean);
      if (embeds.length === 0) continue;

      // Phi-weighted centroid: weight[i] = PSI^i (best-scoring rows first)
      const centroid = _phiWeightedCentroid(embeds);

      // Merge content objects with phi-weighted fitness
      const weights    = _phiWeights(oldRows.length);
      const avgFitness = oldRows.reduce((acc, r, i) => acc + r.fitness_score * weights[i], 0);
      const mergedContent = oldRows.reduce((acc, row, i) => {
        const w = weights[i];
        const c = row.content ?? {};
        Object.entries(c).forEach(([k, v]) => {
          if (typeof v === 'number') {
            acc[k] = (acc[k] ?? 0) + v * w;
          } else if (!acc[k]) {
            acc[k] = v;
          }
        });
        return acc;
      }, {});

      // Delete old entries
      const oldIds = oldRows.map((r) => r.id);
      await this._sql`
        DELETE FROM ancestral_wisdom
        WHERE id = ANY(${oldIds})
      `;

      // Insert centroid entry
      const vectorStr = `[${centroid.join(',')}]`;
      const now       = new Date();
      await this._sql`
        INSERT INTO ancestral_wisdom (
          id, agent_id, generation, wisdom_type,
          embedding, content, fitness_score,
          inheritance_count, compressed_at, created_at
        ) VALUES (
          ${crypto.randomUUID()},
          ${DISTILLER_AGENT_ID},
          ${generation},
          ${wt},
          ${vectorStr}::vector,
          ${JSON.stringify({ ...mergedContent, _compressed: true, _sourceCount: oldRows.length })},
          ${avgFitness},
          ${oldRows.length},
          ${now},
          ${now}
        )
      `;

      logger.info(
        { wisdomType: wt, compressed: oldRows.length, generation, avgFitness },
        'Fibonacci compression: centroid inserted'
      );
    }
  }

  // ── Private: Generation counter ──────────────────────────────────────────────

  /** Atomically increment and return the generation counter from Redis. */
  async _nextGeneration() {
    try {
      const gen = await this._redis.incr(genCounterKey());
      return gen;
    } catch (err) {
      logger.warn({ err }, 'Redis generation counter failed — falling back to DB max');
      const [row] = await this._sql`
        SELECT COALESCE(MAX(generation), 0) + 1 AS next_gen
        FROM   ancestral_wisdom
        WHERE  agent_id = ${DISTILLER_AGENT_ID}
      `;
      return row.next_gen ?? 1;
    }
  }

  /** Get the current (latest) generation without incrementing. */
  async _currentGeneration() {
    try {
      const val = await this._redis.get(genCounterKey());
      if (val !== null) return parseInt(val, 10) || 1;
    } catch (_) { /* non-fatal */ }

    const [row] = await this._sql`
      SELECT COALESCE(MAX(generation), 1) AS current_gen
      FROM   ancestral_wisdom
      WHERE  agent_id = ${DISTILLER_AGENT_ID}
    `;
    return row.current_gen ?? 1;
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Extract wisdom entries from a distillation result.
 *
 * A distillation result is expected to contain:
 *   - taskClass: string
 *   - judgeScore: number
 *   - stageSequence: Array<{name, duration, config}>
 *   - consensusConfig: Object
 *   - domain?: string
 *   - domainFacts?: Object
 *   - output?: any
 *
 * Emits:
 *   successStrategy  — if judgeScore >= BOOST(0.618)
 *   failurePattern   — if judgeScore <  BOOST(0.618)
 *   optimizationHint — if consensusConfig has tunable delta signals
 *   domainKnowledge  — if domain + domainFacts present
 */
function _extractWisdomEntries(result, generation) {
  const entries = [];
  const {
    taskClass, judgeScore, stageSequence, consensusConfig,
    domain, domainFacts, prompt, output,
  } = result;

  const isSuccess = judgeScore >= FAILURE_SCORE_CEILING;

  // ── successStrategy or failurePattern ──────────────────────────────────────
  const strategyEntry = {
    wisdomType:   isSuccess ? WT_SUCCESS : WT_FAILURE,
    fitnessScore: isSuccess ? judgeScore : (1 - judgeScore), // invert for failures
    generation,
    content: {
      taskClass,
      judgeScore,
      stageSequence: (stageSequence ?? []).map((s) => ({
        name:     s.name ?? s,
        duration: s.duration ?? null,
      })),
      stageCount:      (stageSequence ?? []).length,
      prompt:          prompt ?? null,
      isSuccess,
      extractedAt:     new Date().toISOString(),
    },
  };
  entries.push(strategyEntry);

  // ── optimizationHint ────────────────────────────────────────────────────────
  if (consensusConfig && Object.keys(consensusConfig).length > 0) {
    const numericKeys = Object.entries(consensusConfig)
      .filter(([, v]) => typeof v === 'number')
      .map(([k, v]) => ({ param: k, value: v }));

    if (numericKeys.length > 0) {
      entries.push({
        wisdomType:   WT_OPTIM,
        fitnessScore: judgeScore * CSL_BOOST, // phi-scaled confidence in this hint
        generation,
        content: {
          taskClass,
          judgeScore,
          params:      numericKeys,
          configSnapshot: consensusConfig,
          extractedAt: new Date().toISOString(),
        },
      });
    }
  }

  // ── domainKnowledge ─────────────────────────────────────────────────────────
  if (domain && domainFacts && Object.keys(domainFacts).length > 0) {
    entries.push({
      wisdomType:   WT_DOMAIN,
      fitnessScore: judgeScore,
      generation,
      content: {
        domain,
        taskClass,
        facts:       domainFacts,
        judgeScore,
        extractedAt: new Date().toISOString(),
      },
    });
  }

  return entries;
}

/**
 * Convert a wisdom entry to a plain-text string suitable for embedding.
 * The embedding model sees this text as the semantic representation.
 */
function _entryToText(entry) {
  const { wisdomType, content } = entry;
  const c = content ?? {};

  switch (wisdomType) {
    case WT_SUCCESS:
    case WT_FAILURE: {
      const stages = (c.stageSequence ?? []).map((s) => s.name).join(' → ');
      const polarity = wisdomType === WT_SUCCESS ? 'success' : 'failure';
      return (
        `${polarity} strategy for ${c.taskClass ?? 'unknown'}: ` +
        `score=${(c.judgeScore ?? 0).toFixed(3)} stages=[${stages}] ` +
        (c.prompt ? `prompt="${c.prompt.slice(0, 120)}"` : '')
      );
    }
    case WT_OPTIM: {
      const params = (c.params ?? []).map((p) => `${p.param}=${p.value}`).join(' ');
      return (
        `optimization hint for ${c.taskClass ?? 'unknown'}: ` +
        `score=${(c.judgeScore ?? 0).toFixed(3)} params=[${params}]`
      );
    }
    case WT_DOMAIN: {
      const facts = Object.entries(c.facts ?? {})
        .slice(0, 10)
        .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
        .join(' ');
      return `domain knowledge [${c.domain ?? 'general'}] taskClass=${c.taskClass ?? 'unknown'} facts=${facts}`;
    }
    default:
      return JSON.stringify(content).slice(0, 512);
  }
}

/**
 * Parse pgvector text representation "[0.1,0.2,...]" into a number[].
 */
function _parseVectorText(text) {
  if (!text) return null;
  try {
    const cleaned = text.trim().replace(/^\[|\]$/g, '');
    return cleaned.split(',').map(Number);
  } catch (_) {
    return null;
  }
}

/**
 * Compute a phi-weighted centroid of an array of equal-length vectors.
 * weight[i] = PSI^i (sum-normalised), giving highest weight to index 0.
 */
function _phiWeightedCentroid(vecs) {
  if (vecs.length === 0) return [];
  const dim     = vecs[0].length;
  const weights = _phiWeights(vecs.length);
  const centroid = new Float64Array(dim);

  for (let i = 0; i < vecs.length; i++) {
    const w = weights[i];
    const v = vecs[i];
    for (let d = 0; d < dim; d++) {
      centroid[d] += (v[d] ?? 0) * w;
    }
  }

  // L2-normalise the centroid to unit vector
  let norm = 0;
  for (let d = 0; d < dim; d++) norm += centroid[d] * centroid[d];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let d = 0; d < dim; d++) centroid[d] /= norm;
  }

  return Array.from(centroid);
}

/**
 * Phi-weighted array of length n: weight[i] = PSI^i, sum-normalised.
 */
function _phiWeights(n) {
  const raw = Array.from({ length: n }, (_, i) => Math.pow(PSI, i));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / sum);
}

/** Validate required fields on a distillation result */
function _validateDistillationResult(result) {
  if (!result)                              throw new ValidationError('distillationResult is required');
  if (!result.taskClass)                    throw new ValidationError('distillationResult.taskClass is required');
  if (typeof result.judgeScore !== 'number')
    throw new ValidationError('distillationResult.judgeScore must be a number');
  if (!Array.isArray(result.stageSequence))
    throw new ValidationError('distillationResult.stageSequence must be an array');
}
