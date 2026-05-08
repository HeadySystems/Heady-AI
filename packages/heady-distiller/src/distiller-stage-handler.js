/**
 * HeadyDistiller — Stage 22 (index 21) DISTILL
 * Pipeline stage handler registered in HCFullPipeline.
 *
 * Runs AFTER SelfHealCheck (stage index 20). Compresses the full execution
 * trace into reusable recipes, knowledge facts, and ancestral wisdom.
 *
 * CSL gates used (from phi-math constants):
 *   BOOST   = PSI   = 0.618  — judgeScore threshold for distillation
 *   INCLUDE = PSI2  = 0.382  — minimum recipe tier gate
 *
 * All constants phi-derived. Zero placeholders. Zero TODOs.
 */

import pino from 'pino';
import { TrajectoryFilter } from './trajectory-filter.js';
import { RecipeStore } from './recipe-store.js';
import { KnowledgeCompressor } from './knowledge-compressor.js';
import { WisdomCrystallizer } from './wisdom-crystallizer.js';

// ─── Phi-math constants ───────────────────────────────────────────────────────
const PHI  = 1.618033988749895;
const PSI  = 0.618033988749895;   // BOOST gate — judge score floor
const PSI2 = 0.381966011250105;   // INCLUDE gate — recipe tier floor

// CSL named gates (full set for reference/readability)
const CSL = {
  SUPPRESS : 0.236,
  INCLUDE  : PSI2,   // 0.382
  MINIMUM  : 0.500,
  BOOST    : PSI,    // 0.618
  INJECT   : 0.718,
  MEDIUM   : 0.809,
  HIGH     : 0.882,
  CRITICAL : 0.927,
  DEDUP    : 0.972,
};

// FIB sequence — index matches standard definition in phi-math.js
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// Stage identity — index 21 = FIB[8] (the 9th Fibonacci number: 0,1,1,2,3,5,8,13,21)
const STAGE_INDEX = FIB[8];  // 21 — stage index 21 (22nd stage, 0-based)
const STAGE_NAME  = 'DISTILL';

// ─── Logger ───────────────────────────────────────────────────────────────────
const logger = pino({
  name  : 'heady-distiller:stage-handler',
  level : process.env.LOG_LEVEL || 'info',
  base  : { stage: STAGE_INDEX, stageName: STAGE_NAME, phi: PHI },
  formatters: {
    level(label) { return { level: label }; },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// ─── Default dependency singletons ────────────────────────────────────────────
// Lazily constructed so they are not instantiated in test environments that
// inject their own deps via createDistillerStageHandler().
let _defaultDeps = null;

function getDefaultDeps() {
  if (!_defaultDeps) {
    _defaultDeps = {
      traceCollector     : null,          // built inline — no separate class needed
      trajectoryFilter   : new TrajectoryFilter(),
      recipeStore        : new RecipeStore(),
      knowledgeCompressor: new KnowledgeCompressor(),
      wisdomCrystallizer : new WisdomCrystallizer(),
    };
  }
  return _defaultDeps;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve judgeScore from ctx.results.
 * Checks JUDGE first, falls back to QualityGate, then 0.
 * @param {object} results
 * @returns {number}
 */
function resolveJudgeScore(results) {
  if (!results) return 0;

  const judge      = results.JUDGE;
  const qualityGate = results.QualityGate;

  if (judge !== undefined && judge !== null) {
    if (typeof judge === 'number') return judge;
    if (typeof judge === 'object') {
      return judge.score ?? judge.confidence ?? judge.judgeScore ?? 0;
    }
  }

  if (qualityGate !== undefined && qualityGate !== null) {
    if (typeof qualityGate === 'number') return qualityGate;
    if (typeof qualityGate === 'object') {
      return qualityGate.score ?? qualityGate.confidence ?? qualityGate.judgeScore ?? 0;
    }
  }

  return 0;
}

/**
 * Collect the full execution trace from the pipeline context.
 * @param {object} ctx — pipeline context
 * @returns {object} trace
 */
function collectTrace(ctx) {
  return {
    runId      : ctx.runId,
    variant    : ctx.variant,
    input      : ctx.input,
    results    : ctx.results ?? {},
    errors     : ctx.errors  ?? [],
    timeline   : ctx.timeline ?? [],
    confidence : ctx.confidence ?? 0,
    metadata   : ctx.metadata ?? {},
    collectedAt: new Date().toISOString(),
    stageCount : Object.keys(ctx.results ?? {}).length,
    // Phi-scaled token estimate — actual reduction measured post-compress
    estimatedTokens: Math.round(
      JSON.stringify(ctx.results ?? {}).length / PHI
    ),
  };
}

// ─── Core handler ─────────────────────────────────────────────────────────────

/**
 * distillerStageHandler — Stage 22 DISTILL
 *
 * Fault-tolerant: any distillation step failure logs the error and returns
 * { passed: true } — distillation must never fail the pipeline.
 *
 * @param {object} ctx — HCFullPipeline context
 * @returns {Promise<object>} stage result
 */
export async function distillerStageHandler(ctx) {
  const deps = getDefaultDeps();
  return _runDistillation(ctx, deps);
}

/**
 * createDistillerStageHandler — factory with dependency injection.
 *
 * @param {object} deps
 * @param {object|null} [deps.traceCollector]       — custom trace collector (optional)
 * @param {TrajectoryFilter} deps.trajectoryFilter  — trajectory filter
 * @param {RecipeStore}      deps.recipeStore        — recipe store
 * @param {KnowledgeCompressor} deps.knowledgeCompressor
 * @param {WisdomCrystallizer}  deps.wisdomCrystallizer
 * @returns {Function} async (ctx) => result
 */
export function createDistillerStageHandler(deps) {
  if (!deps || typeof deps !== 'object') {
    throw new TypeError('[DISTILL] createDistillerStageHandler: deps must be an object');
  }

  const resolved = {
    traceCollector     : deps.traceCollector      ?? null,
    trajectoryFilter   : deps.trajectoryFilter    ?? new TrajectoryFilter(),
    recipeStore        : deps.recipeStore          ?? new RecipeStore(),
    knowledgeCompressor: deps.knowledgeCompressor  ?? new KnowledgeCompressor(),
    wisdomCrystallizer : deps.wisdomCrystallizer   ?? new WisdomCrystallizer(),
  };

  return (ctx) => _runDistillation(ctx, resolved);
}

// ─── Internal execution ───────────────────────────────────────────────────────

/**
 * _runDistillation — shared execution body used by both export paths.
 *
 * @param {object} ctx
 * @param {object} deps
 * @returns {Promise<object>}
 */
async function _runDistillation(ctx, deps) {
  const startMs = Date.now();
  const log = logger.child({ runId: ctx.runId, variant: ctx.variant });

  log.info({ stage: STAGE_INDEX }, 'DISTILL stage started');

  try {
    // ── Step 1: Collect full execution trace ──────────────────────────────
    let trace;
    try {
      trace = (deps.traceCollector && typeof deps.traceCollector.collect === 'function')
        ? await deps.traceCollector.collect(ctx)
        : collectTrace(ctx);

      log.debug({ stageCount: trace.stageCount, estimatedTokens: trace.estimatedTokens },
        'Trace collected');
    } catch (err) {
      log.warn({ err: err.message }, 'Trace collection failed — using fallback');
      trace = collectTrace(ctx);
    }

    // ── Step 2: CSL BOOST gate — judge score threshold ────────────────────
    const judgeScore = resolveJudgeScore(ctx.results);

    if (judgeScore < CSL.BOOST) {
      const elapsed = Date.now() - startMs;
      log.info(
        { judgeScore, threshold: CSL.BOOST, elapsed },
        'DISTILL skipped — judgeScore below BOOST threshold'
      );
      return {
        stage           : STAGE_INDEX,
        name            : STAGE_NAME,
        skipped         : true,
        reason          : 'judge_score_below_threshold',
        judgeScore,
        threshold       : CSL.BOOST,
        elapsed,
        confidence      : ctx.confidence ?? 0,
        passed          : true,
      };
    }

    log.debug({ judgeScore, threshold: CSL.BOOST }, 'Judge score passed BOOST gate');

    // ── Step 3: Filter trace via TrajectoryFilter ─────────────────────────
    let filteredTrace;
    try {
      filteredTrace = await deps.trajectoryFilter.filter(trace);
      log.debug(
        { originalStages: trace.stageCount, filteredStages: filteredTrace?.stageCount ?? 'unknown' },
        'Trajectory filtering complete'
      );
    } catch (err) {
      log.warn({ err: err.message }, 'TrajectoryFilter failed — continuing with raw trace');
      filteredTrace = trace;
    }

    // ── Step 4: Classify recipe tier ─────────────────────────────────────
    let tier = 0;
    try {
      tier = await deps.recipeStore.classifyTier(filteredTrace, ctx);
      log.debug({ tier }, 'Recipe tier classified');
    } catch (err) {
      log.warn({ err: err.message }, 'RecipeStore.classifyTier failed — defaulting tier to 0');
      tier = 0;
    }

    // ── Step 5: Store recipe if tier >= INCLUDE (1+) ──────────────────────
    let recipesStored = 0;
    // Tier >= 1 check (INCLUDE gate maps to tier threshold ≥ 1)
    if (tier >= 1) {
      try {
        const storeResult = await deps.recipeStore.store(filteredTrace, {
          tier,
          runId    : ctx.runId,
          variant  : ctx.variant,
          judgeScore,
          confidence: ctx.confidence ?? 0,
          phiWeight : PSI2,            // INCLUDE gate weight
          storedAt : new Date().toISOString(),
        });
        recipesStored = storeResult?.count ?? 1;
        log.info({ tier, recipesStored }, 'Recipe stored');
      } catch (err) {
        log.warn({ err: err.message, tier }, 'RecipeStore.store failed — recipe not stored');
        recipesStored = 0;
      }
    } else {
      log.debug({ tier }, 'Tier below 1 — recipe storage skipped');
    }

    // ── Step 6: Compress knowledge facts ─────────────────────────────────
    let factsCompressed = 0;
    let tokenReduction  = 0;
    try {
      const compressResult = await deps.knowledgeCompressor.compress(filteredTrace, {
        runId     : ctx.runId,
        judgeScore,
        tier,
        phiWeight : PSI,    // BOOST gate weight for compression
      });
      factsCompressed = compressResult?.factsCompressed ?? 0;
      tokenReduction  = compressResult?.tokenReduction  ?? 0;
      log.info({ factsCompressed, tokenReduction }, 'Knowledge compressed');
    } catch (err) {
      log.warn({ err: err.message }, 'KnowledgeCompressor.compress failed — facts not compressed');
      factsCompressed = 0;
      tokenReduction  = 0;
    }

    // ── Step 7: Crystallize wisdom ────────────────────────────────────────
    let wisdomCrystallized = 0;
    try {
      const wisdomResult = await deps.wisdomCrystallizer.crystallize(filteredTrace, {
        runId     : ctx.runId,
        tier,
        judgeScore,
        confidence: ctx.confidence ?? 0,
        phiWeight : PHI,    // Golden ratio weight for wisdom
      });
      wisdomCrystallized = wisdomResult?.count ?? 0;
      log.info({ wisdomCrystallized }, 'Wisdom crystallized');
    } catch (err) {
      log.warn({ err: err.message }, 'WisdomCrystallizer.crystallize failed — wisdom not stored');
      wisdomCrystallized = 0;
    }

    // ── Step 8: Build and return distillation result ──────────────────────
    const elapsed = Date.now() - startMs;

    const result = {
      stage             : STAGE_INDEX,
      name              : STAGE_NAME,
      tier,
      recipesStored,
      factsCompressed,
      wisdomCrystallized,
      tokenReduction,
      elapsed,
      judgeScore,
      confidence        : ctx.confidence ?? 0,
      passed            : true,
      // Phi-derived metadata
      phiWeight         : PSI2,
      cslBoostGate      : CSL.BOOST,
      distilledAt       : new Date().toISOString(),
    };

    log.info(
      { tier, recipesStored, factsCompressed, wisdomCrystallized, tokenReduction, elapsed },
      'DISTILL stage complete'
    );

    return result;

  } catch (err) {
    // Outer fault-tolerance: distillation failure must NEVER fail the pipeline
    const elapsed = Date.now() - startMs;
    log.error(
      { err: err.message, stack: err.stack, elapsed },
      'DISTILL stage encountered unhandled error — returning passed:true (non-blocking)'
    );

    return {
      stage             : STAGE_INDEX,
      name              : STAGE_NAME,
      tier              : 0,
      recipesStored     : 0,
      factsCompressed   : 0,
      wisdomCrystallized: 0,
      tokenReduction    : 0,
      elapsed,
      confidence        : ctx.confidence ?? 0,
      passed            : true,
      skipped           : false,
      faultTolerantError: err.message,
    };
  }
}
