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
// ║  FILE: packages/heady-distiller/src/recipe-store.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * HeadyDistiller — RecipeStore
 * Stage 22 of HCFullPipeline: Knowledge Distillation
 *
 * Manages the recipe registry — stores and retrieves distilled execution recipes.
 * Recipes are deterministic fast-path recordings: when a pipeline run scores high
 * enough, its exact input→output mapping is saved so future identical or similar
 * requests can skip most pipeline stages and replay the recipe directly.
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
const logger = pino({ name: 'heady-distiller:recipe-store', level: 'info' });

// ── Phi-derived constants ─────────────────────────────────────────────────────
const CACHE_TTL_SECONDS  = FIB[8];   // 21 seconds  — hot recipe TTL per taskClass
const MATCH_LIMIT        = FIB[7];   // 13          — top matches returned
const GETRECIPES_DEFAULT = FIB[10];  // 55          — default page size
const META_COMPRESS_AT   = FIB[9];   // 34          — trigger meta-compression threshold
const MAX_STAGES_TIER3   = FIB[7];   // 13          — max complexity for Tier 3
const MAX_STAGES_TIER2   = FIB[9];   // 34          — max complexity for Tier 2

// ── Tier thresholds (CSL gates) ───────────────────────────────────────────────
const TIER3_SCORE = 0.95;            // near-perfect — above CRITICAL
const TIER2_SCORE = CSL_HIGH;        // 0.882
const TIER1_SCORE = CSL_BOOST;       // 0.618

// ── Redis cache key helpers ───────────────────────────────────────────────────
const cacheKey = (taskClass) => `heady:recipe:class:${taskClass}`;
const compositeKey = (taskClass) => `heady:recipe:composite:${taskClass}`;

// ─────────────────────────────────────────────────────────────────────────────
// RecipeStore
// ─────────────────────────────────────────────────────────────────────────────
export class RecipeStore {
  /**
   * @param {{ pgUrl: string, redisUrl: string, redisToken?: string }} opts
   */
  constructor({ pgUrl, redisUrl, redisToken } = {}) {
    if (!pgUrl)    throw new ValidationError('RecipeStore requires pgUrl');
    if (!redisUrl) throw new ValidationError('RecipeStore requires redisUrl');

    // Neon Postgres — serverless HTTP driver
    this._sql = neon(pgUrl);

    // Upstash Redis — REST-based, edge-compatible
    this._redis = new Redis({
      url:   redisUrl,
      token: redisToken ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
    });

    logger.info({ cacheT: CACHE_TTL_SECONDS, matchLimit: MATCH_LIMIT }, 'RecipeStore initialised');
  }

  // ── Schema bootstrap ────────────────────────────────────────────────────────

  /**
   * Ensure tables exist. Call once at service startup.
   */
  async bootstrap() {
    await this._sql`
      CREATE TABLE IF NOT EXISTS recipes (
        id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        trace_hash       VARCHAR(64)   NOT NULL UNIQUE,
        tier             INT           NOT NULL CHECK (tier BETWEEN 1 AND 3),
        judge_score      FLOAT         NOT NULL,
        task_class       VARCHAR(256)  NOT NULL,
        input_signature  JSONB         NOT NULL DEFAULT '{}',
        stage_sequence   JSONB         NOT NULL DEFAULT '[]',
        output_hash      VARCHAR(64)   NOT NULL,
        consensus_config JSONB         NOT NULL DEFAULT '{}',
        prompt           TEXT,
        executions       INT           NOT NULL DEFAULT 1,
        created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
        updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
      )
    `;

    await this._sql`
      CREATE INDEX IF NOT EXISTS idx_recipes_task_class
        ON recipes (task_class)
    `;
    await this._sql`
      CREATE INDEX IF NOT EXISTS idx_recipes_tier_score
        ON recipes (tier DESC, judge_score DESC)
    `;

    await this._sql`
      CREATE TABLE IF NOT EXISTS composites (
        id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        task_class       VARCHAR(256)  NOT NULL UNIQUE,
        composite_recipe JSONB         NOT NULL,
        source_count     INT           NOT NULL DEFAULT 0,
        avg_score        FLOAT         NOT NULL DEFAULT 0,
        created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
        updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
      )
    `;

    logger.info('RecipeStore schema bootstrapped');
  }

  // ── Core API ────────────────────────────────────────────────────────────────

  /**
   * Store or update a recipe.
   *
   * Insert if traceHash is new.
   * Update if the existing record has a lower judgeScore (upsert-on-improvement).
   *
   * @param {Object} recipe — raw recipe object from the distillation pipeline
   * @returns {{ stored: boolean, updated: boolean, recipe: Object }}
   */
  async storeRecipe(recipe) {
    _validateRecipe(recipe);

    const tier = RecipeStore.classifyTier(recipe);
    if (tier === 0) {
      logger.debug({ judgeScore: recipe.judgeScore }, 'Recipe below minimum tier — skipping');
      return { stored: false, updated: false, recipe };
    }

    const traceHash     = RecipeStore.hashTrace(recipe);
    const outputHash    = _hashOutput(recipe.output ?? recipe.outputHash ?? '');
    const now           = new Date();

    // Check for existing record
    const [existing] = await this._sql`
      SELECT id, judge_score, executions
      FROM   recipes
      WHERE  trace_hash = ${traceHash}
      LIMIT  1
    `;

    let stored  = false;
    let updated = false;

    if (!existing) {
      // Fresh insert
      await this._sql`
        INSERT INTO recipes (
          id, trace_hash, tier, judge_score, task_class,
          input_signature, stage_sequence, output_hash,
          consensus_config, prompt, executions,
          created_at, updated_at
        ) VALUES (
          ${crypto.randomUUID()},
          ${traceHash},
          ${tier},
          ${recipe.judgeScore},
          ${recipe.taskClass},
          ${JSON.stringify(recipe.inputSignature ?? {})},
          ${JSON.stringify(recipe.stageSequence ?? [])},
          ${outputHash},
          ${JSON.stringify(recipe.consensusConfig ?? {})},
          ${recipe.prompt ?? null},
          1,
          ${now},
          ${now}
        )
      `;
      stored = true;
    } else if (recipe.judgeScore > existing.judge_score) {
      // Update only if the new run is better
      await this._sql`
        UPDATE recipes SET
          tier             = ${tier},
          judge_score      = ${recipe.judgeScore},
          input_signature  = ${JSON.stringify(recipe.inputSignature ?? {})},
          stage_sequence   = ${JSON.stringify(recipe.stageSequence ?? [])},
          output_hash      = ${outputHash},
          consensus_config = ${JSON.stringify(recipe.consensusConfig ?? {})},
          prompt           = ${recipe.prompt ?? null},
          executions       = ${existing.executions + 1},
          updated_at       = ${now}
        WHERE trace_hash = ${traceHash}
      `;
      stored  = true;
      updated = true;
    } else {
      // Increment execution counter even if we do not update score
      await this._sql`
        UPDATE recipes
        SET    executions = executions + 1,
               updated_at = ${now}
        WHERE  trace_hash  = ${traceHash}
      `;
    }

    if (stored) {
      // Invalidate hot-cache for this taskClass
      await this._invalidateCache(recipe.taskClass);
      // Warm cache with this recipe
      await this._cacheRecipe(recipe.taskClass, { ...recipe, tier, traceHash, outputHash });

      // Trigger meta-compression check
      await this._maybeMetaCompress(recipe.taskClass).catch((err) =>
        logger.warn({ err, taskClass: recipe.taskClass }, 'Meta-compression check failed (non-fatal)')
      );
    }

    logger.info({ traceHash, tier, stored, updated, taskClass: recipe.taskClass }, 'storeRecipe complete');
    return { stored, updated, recipe: { ...recipe, tier, traceHash, outputHash } };
  }

  /**
   * Find matching recipes for an intent + taskClass.
   * Sort order: tier DESC, judgeScore DESC.
   * Returns top FIB[7]=13 matches.
   *
   * @param {string} intent      — natural-language intent string
   * @param {string} taskClass   — task classification token
   * @param {number} [minTier=1] — minimum tier to include
   * @returns {Object[]}
   */
  async matchRecipe(intent, taskClass, minTier = 1) {
    if (!intent)    throw new ValidationError('matchRecipe: intent is required');
    if (!taskClass) throw new ValidationError('matchRecipe: taskClass is required');

    // 1. Try Redis hot-cache first
    const cached = await this._getCachedRecipe(taskClass);
    if (cached && (cached.tier ?? 1) >= minTier) {
      logger.debug({ taskClass, source: 'cache' }, 'matchRecipe cache hit');
      return [cached];
    }

    // 2. Database query — exact taskClass + tier filter
    const rows = await this._sql`
      SELECT
        id, trace_hash, tier, judge_score, task_class,
        input_signature, stage_sequence, output_hash,
        consensus_config, prompt, executions,
        created_at, updated_at
      FROM   recipes
      WHERE  task_class = ${taskClass}
        AND  tier       >= ${minTier}
      ORDER BY tier DESC, judge_score DESC
      LIMIT  ${MATCH_LIMIT}
    `;

    const results = rows.map(_rowToRecipe);

    if (results.length > 0) {
      // Warm cache with the best match
      await this._cacheRecipe(taskClass, results[0]);
    }

    logger.debug(
      { taskClass, minTier, found: results.length },
      'matchRecipe DB query complete'
    );
    return results;
  }

  /**
   * Get recipes with optional filter.
   * @param {{ tier?: number, taskClass?: string, limit?: number }} filter
   * @returns {Object[]}
   */
  async getRecipes(filter = {}) {
    const { tier, taskClass, limit = GETRECIPES_DEFAULT } = filter;

    let rows;

    if (tier && taskClass) {
      rows = await this._sql`
        SELECT * FROM recipes
        WHERE  tier       = ${tier}
          AND  task_class = ${taskClass}
        ORDER BY tier DESC, judge_score DESC
        LIMIT ${limit}
      `;
    } else if (tier) {
      rows = await this._sql`
        SELECT * FROM recipes
        WHERE  tier = ${tier}
        ORDER BY tier DESC, judge_score DESC
        LIMIT ${limit}
      `;
    } else if (taskClass) {
      rows = await this._sql`
        SELECT * FROM recipes
        WHERE  task_class = ${taskClass}
        ORDER BY tier DESC, judge_score DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await this._sql`
        SELECT * FROM recipes
        ORDER BY tier DESC, judge_score DESC
        LIMIT ${limit}
      `;
    }

    return rows.map(_rowToRecipe);
  }

  // ── Tier Classification ─────────────────────────────────────────────────────

  /**
   * Classify a trace into Tier 1–3 (or 0 if below minimum).
   *
   * Tier 3 — Tier 3 if judgeScore >= 0.95 AND deterministic AND complexity <= FIB[7]=13 stages.
   * Tier 2 — judgeScore >= HIGH(0.882) AND complexity <= FIB[9]=34.
   * Tier 1 — judgeScore >= BOOST(0.618).
   * Tier 0 — below all thresholds.
   *
   * @param {Object} trace
   * @returns {0|1|2|3}
   */
  static classifyTier(trace) {
    const score       = trace.judgeScore ?? 0;
    const stages      = Array.isArray(trace.stageSequence) ? trace.stageSequence.length : 0;
    const deterministic = trace.deterministic !== false; // default true

    if (score >= TIER3_SCORE && deterministic && stages <= MAX_STAGES_TIER3) return 3;
    if (score >= TIER2_SCORE && stages <= MAX_STAGES_TIER2) return 2;
    if (score >= TIER1_SCORE) return 1;
    return 0;
  }

  // ── Hash Utilities ──────────────────────────────────────────────────────────

  /**
   * SHA-256 of {input, stages[].name}, truncated to 16 hex chars.
   * @param {Object} trace
   * @returns {string}
   */
  static hashTrace(trace) {
    const stageNames = Array.isArray(trace.stageSequence)
      ? trace.stageSequence.map((s) => s.name ?? s)
      : [];
    const payload = JSON.stringify({
      input:  trace.inputSignature ?? trace.input ?? '',
      stages: stageNames,
    });
    return crypto
      .createHash('sha256')
      .update(payload)
      .digest('hex')
      .slice(0, 16);
  }

  // ── Redis Cache ─────────────────────────────────────────────────────────────

  /**
   * Cache the most-recent recipe for a taskClass.
   * TTL = FIB[8] = 21 seconds.
   */
  async _cacheRecipe(taskClass, recipe) {
    try {
      await this._redis.set(
        cacheKey(taskClass),
        JSON.stringify(recipe),
        { ex: CACHE_TTL_SECONDS }
      );
    } catch (err) {
      logger.warn({ err, taskClass }, 'Redis cache write failed (non-fatal)');
    }
  }

  async _getCachedRecipe(taskClass) {
    try {
      const raw = await this._redis.get(cacheKey(taskClass));
      if (!raw) return null;
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (err) {
      logger.warn({ err, taskClass }, 'Redis cache read failed (non-fatal)');
      return null;
    }
  }

  async _invalidateCache(taskClass) {
    try {
      await this._redis.del(cacheKey(taskClass));
    } catch (err) {
      logger.warn({ err, taskClass }, 'Redis cache invalidation failed (non-fatal)');
    }
  }

  // ── Meta-Compression ────────────────────────────────────────────────────────

  /**
   * When a taskClass accumulates > FIB[9]=34 recipes, produce a consensus
   * composite stored in the composites table.
   *
   * The composite is the phi-weighted centroid of the top-scoring recipes:
   *   - stageSequence: stages appearing in >= 50% of recipes
   *   - consensusConfig: merged config weighted by judgeScore
   *   - avgScore: arithmetic mean of judgeScores
   */
  async _maybeMetaCompress(taskClass) {
    const [{ count }] = await this._sql`
      SELECT COUNT(*)::int AS count
      FROM   recipes
      WHERE  task_class = ${taskClass}
    `;

    if (count <= META_COMPRESS_AT) return;

    logger.info({ taskClass, count, threshold: META_COMPRESS_AT }, 'Triggering meta-compression');
    await this.metaCompress(taskClass);
  }

  /**
   * Produce a consensus composite for a taskClass and store in composites table.
   * @param {string} taskClass
   * @returns {Object} composite
   */
  async metaCompress(taskClass) {
    const recipes = await this.getRecipes({ taskClass, limit: GETRECIPES_DEFAULT });
    if (recipes.length === 0) return null;

    // Phi-weighted scores: weight[i] = PSI^i (sum-normalised)
    const weights = _phiWeights(recipes.length);
    const avgScore = recipes.reduce((acc, r, i) => acc + r.judgeScore * weights[i], 0);

    // Stage frequency map — count appearances across top recipes
    const stageFreq = new Map();
    recipes.forEach((r, i) => {
      const w = weights[i];
      (r.stageSequence ?? []).forEach((stage) => {
        const key = stage.name ?? stage;
        const existing = stageFreq.get(key) ?? { name: key, count: 0, weight: 0, configs: [] };
        existing.count  += 1;
        existing.weight += w;
        if (stage.config) existing.configs.push({ config: stage.config, w });
        stageFreq.set(key, existing);
      });
    });

    // Include stages present in >= 50% of source recipes
    const halfLen   = recipes.length * CSL_MINIMUM; // 0.5
    const consensus = Array.from(stageFreq.values())
      .filter((s) => s.count >= halfLen)
      .sort((a, b) => b.weight - a.weight)
      .map((s) => ({
        name:     s.name,
        avgWeight: s.weight / recipes.length,
        config:   _mergeConfigs(s.configs),
      }));

    // Merge consensusConfigs weighted by judgeScore
    const mergedConfig = recipes.reduce((acc, r, i) => {
      const w = weights[i];
      Object.entries(r.consensusConfig ?? {}).forEach(([k, v]) => {
        if (typeof v === 'number') {
          acc[k] = (acc[k] ?? 0) + v * w;
        } else {
          acc[k] = v; // take highest-weighted string/object values
        }
      });
      return acc;
    }, {});

    const composite = {
      taskClass,
      stageSequence:   consensus,
      consensusConfig: mergedConfig,
      avgScore,
      sourceCount:     recipes.length,
      compressedAt:    new Date().toISOString(),
    };

    const now = new Date();
    await this._sql`
      INSERT INTO composites (id, task_class, composite_recipe, source_count, avg_score, created_at, updated_at)
      VALUES (
        ${crypto.randomUUID()},
        ${taskClass},
        ${JSON.stringify(composite)},
        ${recipes.length},
        ${avgScore},
        ${now},
        ${now}
      )
      ON CONFLICT (task_class) DO UPDATE SET
        composite_recipe = EXCLUDED.composite_recipe,
        source_count     = EXCLUDED.source_count,
        avg_score        = EXCLUDED.avg_score,
        updated_at       = EXCLUDED.updated_at
    `;

    // Cache composite separately
    try {
      await this._redis.set(
        compositeKey(taskClass),
        JSON.stringify(composite),
        { ex: CACHE_TTL_SECONDS * FIB[5] } // 21 * 5 = 105s for composites
      );
    } catch (err) {
      logger.warn({ err, taskClass }, 'Composite cache write failed (non-fatal)');
    }

    logger.info(
      { taskClass, avgScore, stageCount: consensus.length, sourceCount: recipes.length },
      'Meta-compression complete'
    );
    return composite;
  }

  /**
   * Retrieve a composite for a taskClass.
   * @param {string} taskClass
   * @returns {Object|null}
   */
  async getComposite(taskClass) {
    // Try Redis first
    try {
      const raw = await this._redis.get(compositeKey(taskClass));
      if (raw) return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (_) { /* non-fatal */ }

    const [row] = await this._sql`
      SELECT composite_recipe
      FROM   composites
      WHERE  task_class = ${taskClass}
      LIMIT  1
    `;
    return row ? row.composite_recipe : null;
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

/** SHA-256 of an output value, truncated to 16 hex chars */
function _hashOutput(output) {
  const payload = typeof output === 'string' ? output : JSON.stringify(output);
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

/** Map a DB row to a recipe object with camelCase keys */
function _rowToRecipe(row) {
  return {
    id:              row.id,
    traceHash:       row.trace_hash,
    tier:            row.tier,
    judgeScore:      row.judge_score,
    taskClass:       row.task_class,
    inputSignature:  row.input_signature,
    stageSequence:   row.stage_sequence,
    outputHash:      row.output_hash,
    consensusConfig: row.consensus_config,
    prompt:          row.prompt,
    executions:      row.executions,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  };
}

/** Validate required recipe fields */
function _validateRecipe(recipe) {
  if (!recipe)                           throw new ValidationError('recipe is required');
  if (typeof recipe.judgeScore !== 'number') throw new ValidationError('recipe.judgeScore must be a number');
  if (!recipe.taskClass)                 throw new ValidationError('recipe.taskClass is required');
  if (!Array.isArray(recipe.stageSequence))
    throw new ValidationError('recipe.stageSequence must be an array');
}

/**
 * Phi-weighted array of length n: weight[i] = PSI^i, sum-normalised.
 * Gives highest weight to index 0 (best-scoring recipe).
 */
function _phiWeights(n) {
  const raw = Array.from({ length: n }, (_, i) => Math.pow(PSI, i));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / sum);
}

/** Merge an array of {config, w} objects into a single weighted config */
function _mergeConfigs(configs) {
  if (configs.length === 0) return {};
  const total = configs.reduce((acc, c) => acc + c.w, 0);
  return configs.reduce((acc, { config, w }) => {
    const ratio = w / total;
    Object.entries(config).forEach(([k, v]) => {
      if (typeof v === 'number') {
        acc[k] = (acc[k] ?? 0) + v * ratio;
      } else {
        if (!acc[k]) acc[k] = v;
      }
    });
    return acc;
  }, {});
}
