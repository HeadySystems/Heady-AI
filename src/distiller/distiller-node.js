'use strict';

/**
 * heady-distiller — Trace→Recipe Reverse-Engineering Service
 * 
 * Captures successful pipeline executions (JUDGE ≥ 0.854) and distills them
 * into 3 tiers of reusable execution recipes:
 *   Tier 1: Optimized prompts (DSPy GEPA)
 *   Tier 2: Pipeline configurations (trajectory→abstract tips)
 *   Tier 3: Full deterministic replay (recorded LLM I/O + DAG + tests)
 * 
 * @port 3398
 * @transport streamable-http
 * @version 1.0.0
 * @see HEADY_DISTILLER_SERVICE_SPEC.md
 */

const express = require('express');
const { createLogger } = require('../../packages/structured-logger');

const log = createLogger('heady-distiller', 'intelligence');

// φ-derived constants
const PSI = 0.6180339887;       // φ⁻¹
const PSI_SQ = 0.3819660113;   // φ⁻²
const JUDGE_THRESHOLD = 0.854; // ψ + ψ²/2 + ψ³/8 — quality gate for distillation
const META_TRIGGER = 34;       // fib(9) — compress recipes after this count
const FIB_12 = 144;            // max optimization calls

// Service modules
const { captureTrace } = require('./trace-capture');
const { filterSuccess } = require('./success-filter');
const { optimizePrompt } = require('./tier1-prompt-optimizer');
const { extractConfig } = require('./tier2-config-extractor');
const { recordReplay } = require('./tier3-replay-recorder');
const { recipeRegistry } = require('./recipe-registry');
const { routeRecipe } = require('./recipe-router');
const { metaDistill } = require('./meta-distiller');

const app = express();
app.use(express.json({ limit: '8mb' }));

// ─── Health ────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'heady-distiller',
    version: '1.0.0',
    recipes_distilled: recipeRegistry.count(),
    avg_optimization_gain: recipeRegistry.avgGain(),
    cache_hit_rate: recipeRegistry.hitRate(),
  });
});

// ─── POST /distill — Called by Stage 20 RECEIPT ────────────────────
app.post('/distill', async (req, res) => {
  const { trace_id, execution_log, judge_score, pipeline_variant } = req.body;

  // Quality gate: only distill high-quality completions
  if (judge_score < JUDGE_THRESHOLD) {
    return res.status(200).json({
      skipped: true,
      reason: `judge_score ${judge_score} < threshold ${JUDGE_THRESHOLD}`,
    });
  }

  // Don't distill fast-path runs (prevents circular distillation)
  if (pipeline_variant === 'fast') {
    return res.status(200).json({
      skipped: true,
      reason: 'fast-path runs are not distilled (circular prevention)',
    });
  }

  try {
    const trace = captureTrace(trace_id, execution_log);
    const filtered = filterSuccess(trace, judge_score);

    // 3 parallel tier distillations
    const [tier1, tier2, tier3] = await Promise.allSettled([
      optimizePrompt(filtered, { max_calls: FIB_12 }),
      extractConfig(filtered),
      recordReplay(filtered),
    ]);

    const recipes = [tier1, tier2, tier3]
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    await recipeRegistry.store(recipes);

    // Meta-distillation trigger at fib(9) recipes
    const classCount = await recipeRegistry.countByClass(filtered.task_class);
    if (classCount > META_TRIGGER) {
      metaDistill(filtered.task_class).catch(err =>
        log.error('meta-distillation failed', { task_class: filtered.task_class, error: err.message })
      );
    }

    log.activity('distillation complete', {
      trace_id,
      recipes_created: recipes.length,
      task_class: filtered.task_class,
      judge_score,
    });

    res.json({
      recipe_id: recipes[0]?.id,
      tier: recipes.length,
      sha256: recipes[0]?.sha256,
      optimization_estimate: recipes[0]?.optimization_gain,
    });
  } catch (err) {
    log.error('distillation failed', { trace_id, error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Distillation failed', details: err.message });
  }
});

// ─── POST /retrieve — Called by AutoContext Pass 2.5 ───────────────
app.post('/retrieve', async (req, res) => {
  const { intent_embedding, task_class, min_tier } = req.body;

  try {
    const result = await routeRecipe(intent_embedding, task_class, min_tier);
    res.json(result);
  } catch (err) {
    log.error('recipe retrieval failed', { task_class, error: err.message });
    res.json({ action: 'PROCEED_NORMAL' });
  }
});

// ─── POST /replay — Deterministic replay of Tier 3 recipe ─────────
app.post('/replay', async (req, res) => {
  const { recipe_id, input_override } = req.body;

  try {
    const recipe = await recipeRegistry.get(recipe_id);
    if (!recipe || recipe.tier !== 3) {
      return res.status(404).json({ error: 'Tier 3 recipe not found' });
    }

    res.setHeader('Content-Type', 'application/x-ndjson');
    for (const event of recipe.recorded_events) {
      const replayed = input_override
        ? { ...event, input: { ...event.input, ...input_override } }
        : event;
      res.write(JSON.stringify(replayed) + '\n');
    }
    res.end();
  } catch (err) {
    log.error('replay failed', { recipe_id, error: err.message });
    res.status(500).json({ error: 'Replay failed' });
  }
});

// ─── GET /recipes/:id ──────────────────────────────────────────────
app.get('/recipes/:id', async (req, res) => {
  const recipe = await recipeRegistry.get(req.params.id);
  if (!recipe) return res.status(404).json({ error: 'Not found' });
  res.json(recipe);
});

// ─── POST /meta-distill ───────────────────────────────────────────
app.post('/meta-distill', async (req, res) => {
  const { task_class } = req.body;
  try {
    const result = await metaDistill(task_class);
    res.json(result);
  } catch (err) {
    log.error('meta-distill failed', { task_class, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /recipes/:id ──────────────────────────────────────────
app.delete('/recipes/:id', async (req, res) => {
  try {
    await recipeRegistry.softDelete(req.params.id);
    res.json({ deleted: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Boot ──────────────────────────────────────────────────────────
const PORT = parseInt(process.env.DISTILLER_PORT, 10) || 3398;

app.listen(PORT, () => {
  log.system(`heady-distiller v1.0.0 listening on port ${PORT}`, {
    judge_threshold: JUDGE_THRESHOLD,
    meta_trigger: META_TRIGGER,
    max_optimization_calls: FIB_12,
  });
});

module.exports = app;
