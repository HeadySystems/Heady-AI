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
// ║  FILE: src/engines/heady-distiller.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Heady™ Distiller v1.0.0 — Four-Tier Execution Recipe Engine
 * HeadySystems Inc. — §12 Implementation
 * 
 * Captures successful execution traces and distills them
 * into tiered reproducible recipes. Successes become
 * optimized navigation maps stored in the recipe registry.
 * 
 * Tier 1: Optimized Prompt (DSPy MIPROv2)
 * Tier 2: Pipeline Config (trajectory-to-tips)
 * Tier 3: Full Execution Recipe (DAG + assertions)
 * Tier 4: Model Knowledge Distillation (DPO fine-tuning)
 * 
 * @port 3407
 */

'use strict';

const express = require('express');
const crypto = require('crypto');
const pino = require('pino');

const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const PSI_SQ = PSI * PSI;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

const logger = pino({ name: 'heady-distiller', level: process.env.LOG_LEVEL || 'info' });

// Minimum JUDGE composite to trigger distillation
const DISTILL_THRESHOLD = 0.85;
// Fast-path recipe match threshold
const FAST_PATH_THRESHOLD = PSI; // 0.618
// Meta-distill after N recipes for same task class
const META_DISTILL_TRIGGER = FIB[8]; // 34

// ─── Recipe Registry ──────────────────────────────────────────
class RecipeRegistry {
  constructor(config) {
    this.redis = config.redis;
    this.neon = config.neon;
    this.prefix = 'distiller:';
    this.recipes = new Map();
    this.stats = {
      recipes_distilled: 0,
      fast_paths_served: 0,
      avg_optimization_gain: 0,
      total_traces_captured: 0,
    };
  }

  async store(recipe) {
    const key = `${this.prefix}recipe:${recipe.id}`;
    this.recipes.set(recipe.id, recipe);

    // Redis for hot lookup
    if (this.redis) {
      await this.redis.set(key, JSON.stringify(recipe), 'EX', FIB[14] * 3600); // 610h TTL
    }

    // Neon for durable storage + vector search
    if (this.neon) {
      await this.neon.query(`
        INSERT INTO distiller_recipes (
          id, tier, task_class, intent_embedding, config,
          judge_composite, created_at, usage_count
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 0)
        ON CONFLICT (id) DO UPDATE SET
          config = $5, judge_composite = $6, updated_at = NOW()
      `, [
        recipe.id, recipe.tier, recipe.taskClass,
        JSON.stringify(recipe.intentEmbedding),
        JSON.stringify(recipe),
        recipe.judgeComposite,
      ]);
    }

    // Index by task class for fast lookups
    const classKey = `${this.prefix}class:${recipe.taskClass}`;
    if (this.redis) {
      await this.redis.sadd(classKey, recipe.id);
    }

    this.stats.recipes_distilled++;
    logger.info({
      id: recipe.id,
      tier: recipe.tier,
      taskClass: recipe.taskClass,
      composite: recipe.judgeComposite,
    }, 'Recipe stored');
  }

  async findByIntent(intentEmbedding, threshold = FAST_PATH_THRESHOLD) {
    if (!this.neon) return null;

    // Vector similarity search in pgvector
    const result = await this.neon.query(`
      SELECT id, tier, task_class, config, judge_composite,
             1 - (intent_embedding::vector <=> $1::vector) as similarity
      FROM distiller_recipes
      WHERE 1 - (intent_embedding::vector <=> $1::vector) >= $2
      ORDER BY similarity DESC
      LIMIT 5
    `, [JSON.stringify(intentEmbedding), threshold]);

    if (result.rows.length > 0) {
      this.stats.fast_paths_served++;
      return result.rows.map(r => ({
        ...JSON.parse(r.config),
        similarity: parseFloat(r.similarity),
      }));
    }

    return null;
  }

  async getByTaskClass(taskClass) {
    const classKey = `${this.prefix}class:${taskClass}`;
    if (!this.redis) return [];

    const ids = await this.redis.smembers(classKey);
    const recipes = [];
    for (const id of ids) {
      const raw = await this.redis.get(`${this.prefix}recipe:${id}`);
      if (raw) recipes.push(JSON.parse(raw));
    }
    return recipes.sort((a, b) => b.judgeComposite - a.judgeComposite);
  }

  async incrementUsage(recipeId) {
    if (this.neon) {
      await this.neon.query(
        'UPDATE distiller_recipes SET usage_count = usage_count + 1 WHERE id = $1',
        [recipeId]
      );
    }
  }
}

// ─── Trace Capture (Event Sourcing) ───────────────────────────
class TraceCapture {
  constructor(config) {
    this.redis = config.redis;
    this.prefix = 'distiller:trace:';
    this.maxTraces = FIB[14]; // 610
  }

  async captureStageTransition(traceId, stage, data) {
    const event = {
      type: 'stage_transition',
      traceId,
      stage: stage.name,
      stageIndex: stage.index,
      input: this._summarize(data.input),
      output: this._summarize(data.output),
      model: data.model || null,
      latency_ms: data.latency_ms,
      csl_gate: data.csl_gate || null,
      bees_dispatched: data.bees || [],
      timestamp: Date.now(),
    };

    if (this.redis) {
      await this.redis.xadd(
        `${this.prefix}${traceId}`,
        'MAXLEN', '~', '100',
        '*',
        'event', JSON.stringify(event)
      );
    }

    return event;
  }

  async captureLLMCall(traceId, data) {
    const event = {
      type: 'llm_call',
      traceId,
      provider: data.provider,
      model: data.model,
      prompt_hash: crypto.createHash('sha256').update(data.prompt || '').digest('hex').slice(0, 16),
      prompt_tokens: data.prompt_tokens,
      completion_tokens: data.completion_tokens,
      latency_ms: data.latency_ms,
      cost_usd: data.cost_usd || 0,
      temperature: data.temperature || 0,
      timestamp: Date.now(),
    };

    if (this.redis) {
      await this.redis.xadd(
        `${this.prefix}${traceId}`,
        'MAXLEN', '~', '100',
        '*',
        'event', JSON.stringify(event)
      );
    }

    return event;
  }

  async getFullTrace(traceId) {
    if (!this.redis) return [];

    const entries = await this.redis.xrange(`${this.prefix}${traceId}`, '-', '+');
    return entries.map(([id, fields]) => {
      try { return JSON.parse(fields[1]); } catch { return null; }
    }).filter(Boolean);
  }

  _summarize(data) {
    if (!data) return null;
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return str.length > 500 ? str.slice(0, 500) + '...' : str;
  }
}

// ─── Distillation Engine ──────────────────────────────────────
class DistillationEngine {
  constructor(config) {
    this.registry = new RecipeRegistry(config);
    this.trace = new TraceCapture(config);
    this.config = config;
  }

  /**
   * Main distillation entry point. Called after Stage 20 (RECEIPT)
   * when JUDGE composite >= 0.85.
   */
  async distill(executionResult) {
    const { traceId, judgeComposite, taskClass, intentEmbedding } = executionResult;

    if (judgeComposite < DISTILL_THRESHOLD) {
      logger.info({ traceId, composite: judgeComposite }, 'Below distill threshold, skipping');
      return null;
    }

    const fullTrace = await this.trace.getFullTrace(traceId);
    if (!fullTrace.length) {
      logger.warn({ traceId }, 'No trace events found');
      return null;
    }

    // Determine highest viable tier
    const tier = this._determineTier(fullTrace, executionResult);

    let recipe;
    switch (tier) {
      case 1:
        recipe = await this._distillTier1(fullTrace, executionResult);
        break;
      case 2:
        recipe = await this._distillTier2(fullTrace, executionResult);
        break;
      case 3:
        recipe = await this._distillTier3(fullTrace, executionResult);
        break;
      case 4:
        recipe = await this._distillTier4(fullTrace, executionResult);
        break;
    }

    if (recipe) {
      recipe.intentEmbedding = intentEmbedding;
      recipe.taskClass = taskClass;
      recipe.judgeComposite = judgeComposite;
      await this.registry.store(recipe);

      // Check meta-distill trigger
      const classRecipes = await this.registry.getByTaskClass(taskClass);
      if (classRecipes.length >= META_DISTILL_TRIGGER) {
        await this._metaDistill(taskClass, classRecipes);
      }
    }

    return recipe;
  }

  /**
   * Tier 1: Extract and optimize the prompt template.
   * Uses DSPy MIPROv2 concepts for multi-instruction optimization.
   */
  async _distillTier1(trace, result) {
    const llmCalls = trace.filter(e => e.type === 'llm_call');
    if (!llmCalls.length) return null;

    // Extract the prompt patterns that led to success
    const promptPatterns = llmCalls.map(call => ({
      model: call.model,
      prompt_hash: call.prompt_hash,
      tokens: call.prompt_tokens + call.completion_tokens,
      latency: call.latency_ms,
      cost: call.cost_usd,
    }));

    // Find the most efficient model+prompt combination
    const best = promptPatterns.reduce((a, b) => {
      const aScore = (1 / a.latency) * (1 / a.cost || 1);
      const bScore = (1 / b.latency) * (1 / b.cost || 1);
      return aScore > bScore ? a : b;
    });

    return {
      id: `recipe-t1-${crypto.randomUUID().slice(0, 8)}`,
      tier: 1,
      type: 'optimized_prompt',
      optimalModel: best.model,
      promptPatterns,
      estimatedCostReduction: this._estimateCostReduction(promptPatterns),
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Tier 2: Extract pipeline configuration.
   * Which stages activated, which models selected, CSL thresholds.
   */
  async _distillTier2(trace, result) {
    const stageTransitions = trace.filter(e => e.type === 'stage_transition');
    const llmCalls = trace.filter(e => e.type === 'llm_call');

    const pipelineConfig = {
      stages_activated: stageTransitions.map(s => s.stage),
      stage_sequence: stageTransitions.map(s => ({
        name: s.stage,
        index: s.stageIndex,
        latency_ms: s.latency_ms,
        model: s.model,
        csl_gate: s.csl_gate,
      })),
      models_used: [...new Set(llmCalls.map(c => c.model))],
      total_latency_ms: stageTransitions.reduce((s, t) => s + t.latency_ms, 0),
      total_cost_usd: llmCalls.reduce((s, c) => s + (c.cost_usd || 0), 0),
      bees_dispatched: [...new Set(stageTransitions.flatMap(s => s.bees_dispatched))],
    };

    // Generate optimization tips
    const tips = [];
    const slowStages = stageTransitions
      .filter(s => s.latency_ms > Math.round(PHI * PHI * 1000))
      .map(s => s.stage);
    if (slowStages.length) {
      tips.push(`Slow stages exceeding φ² budget: ${slowStages.join(', ')}`);
    }

    return {
      id: `recipe-t2-${crypto.randomUUID().slice(0, 8)}`,
      tier: 2,
      type: 'pipeline_config',
      config: pipelineConfig,
      tips,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Tier 3: Full execution recipe with DAG topology and test assertions.
   */
  async _distillTier3(trace, result) {
    const tier2 = await this._distillTier2(trace, result);
    if (!tier2) return null;

    // Build DAG from stage transitions
    const stages = trace.filter(e => e.type === 'stage_transition');
    const dag = this._buildDAG(stages);

    // Generate test assertions from inputs/outputs
    const assertions = stages
      .filter(s => s.output)
      .map(s => ({
        stage: s.stage,
        assertion_type: 'output_exists',
        description: `Stage ${s.stage} must produce non-null output`,
      }));

    return {
      id: `recipe-t3-${crypto.randomUUID().slice(0, 8)}`,
      tier: 3,
      type: 'full_recipe',
      pipeline: tier2.config,
      dag,
      assertions,
      expectedLatency: tier2.config.total_latency_ms,
      expectedCost: tier2.config.total_cost_usd,
      reproducibility: 'deterministic', // temp=0, seed=42
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Tier 4: Model knowledge distillation metadata.
   * Actual fine-tuning happens on Colab Alpha via QStash dispatch.
   */
  async _distillTier4(trace, result) {
    const llmCalls = trace.filter(e => e.type === 'llm_call');
    if (llmCalls.length < FIB[4]) return null; // Need at least 5 LLM calls

    return {
      id: `recipe-t4-${crypto.randomUUID().slice(0, 8)}`,
      tier: 4,
      type: 'model_distillation',
      trainingData: {
        traceId: result.traceId,
        llm_calls: llmCalls.length,
        total_tokens: llmCalls.reduce((s, c) => s + c.prompt_tokens + c.completion_tokens, 0),
        models_to_distill_from: [...new Set(llmCalls.map(c => c.model))],
      },
      distillation: {
        method: 'DPO', // Direct Preference Optimization
        base_model: 'meta-llama/Llama-3.3-70B',
        adapter: 'LoRA',
        target_runtime: 'colab_alpha',
        dispatch_via: 'qstash',
      },
      status: 'pending_dispatch',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Meta-distill: compress N recipes into optimal composite.
   * Triggered when 34+ recipes exist for same task class.
   */
  async _metaDistill(taskClass, recipes) {
    logger.info({ taskClass, count: recipes.length }, 'Meta-distillation triggered');

    // Find the top-performing recipes by JUDGE composite
    const topRecipes = recipes
      .sort((a, b) => b.judgeComposite - a.judgeComposite)
      .slice(0, FIB[5]); // Top 8

    // Extract common patterns across top recipes
    const commonModels = this._findCommonElements(
      topRecipes.filter(r => r.config?.models_used).map(r => r.config.models_used)
    );
    const commonStages = this._findCommonElements(
      topRecipes.filter(r => r.config?.stages_activated).map(r => r.config.stages_activated)
    );

    const composite = {
      id: `recipe-meta-${crypto.randomUUID().slice(0, 8)}`,
      tier: 3,
      type: 'meta_composite',
      taskClass,
      sourcedFrom: topRecipes.length,
      optimalModels: commonModels,
      optimalStages: commonStages,
      avgComposite: topRecipes.reduce((s, r) => s + r.judgeComposite, 0) / topRecipes.length,
      createdAt: new Date().toISOString(),
    };

    await this.registry.store(composite);
    logger.info({ taskClass, composite: composite.avgComposite }, 'Meta-recipe created');
    return composite;
  }

  _determineTier(trace, result) {
    const llmCalls = trace.filter(e => e.type === 'llm_call').length;
    const stages = trace.filter(e => e.type === 'stage_transition').length;

    if (llmCalls >= FIB[6] && result.judgeComposite >= 0.9) return 4;
    if (stages >= FIB[5]) return 3;
    if (stages >= FIB[3]) return 2;
    return 1;
  }

  _buildDAG(stages) {
    const nodes = stages.map(s => ({ id: s.stage, index: s.stageIndex }));
    const edges = [];
    for (let i = 1; i < stages.length; i++) {
      edges.push({ from: stages[i - 1].stage, to: stages[i].stage });
    }
    return { nodes, edges };
  }

  _estimateCostReduction(patterns) {
    if (patterns.length < 2) return 0;
    const costs = patterns.map(p => p.cost).filter(c => c > 0);
    if (costs.length < 2) return 0;
    const max = Math.max(...costs);
    const min = Math.min(...costs);
    return max > 0 ? (max - min) / max : 0;
  }

  _findCommonElements(arrays) {
    if (!arrays.length) return [];
    return arrays[0].filter(item => arrays.every(arr => arr.includes(item)));
  }
}

// ─── Express Server ───────────────────────────────────────────
function createServer(engine) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Health
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'heady-distiller',
      version: '1.0.0',
      ...engine.registry.stats,
      uptime: process.uptime(),
    });
  });

  // A2A Agent Card
  app.get('/.well-known/agent.json', (req, res) => {
    res.json({
      name: 'heady-distiller',
      version: '1.0.0',
      description: 'Four-Tier Execution Recipe Engine — distills successes into reusable navigation maps',
      capabilities: ['distill', 'recipe_search', 'trace_capture', 'meta_distill'],
      endpoint: 'https://distiller.headysystems.com',
    });
  });

  // Distill an execution result
  app.post('/distill', async (req, res) => {
    try {
      const recipe = await engine.distill(req.body);
      if (recipe) {
        res.status(201).json(recipe);
      } else {
        res.json({ message: 'Below threshold or insufficient trace data' });
      }
    } catch (err) {
      logger.error({ err }, 'Distillation failed');
      res.status(500).json({ error: err.message });
    }
  });

  // Search recipes by intent embedding
  app.post('/recipes/search', async (req, res) => {
    try {
      const { intentEmbedding, threshold } = req.body;
      const recipes = await engine.registry.findByIntent(intentEmbedding, threshold);
      res.json({ recipes: recipes || [], count: recipes?.length || 0 });
    } catch (err) {
      logger.error({ err }, 'Recipe search failed');
      res.status(500).json({ error: err.message });
    }
  });

  // Get recipes by task class
  app.get('/recipes/class/:taskClass', async (req, res) => {
    try {
      const recipes = await engine.registry.getByTaskClass(req.params.taskClass);
      res.json({ recipes, count: recipes.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Capture trace event
  app.post('/trace/:traceId/event', async (req, res) => {
    try {
      const { type, data } = req.body;
      let event;
      if (type === 'stage_transition') {
        event = await engine.trace.captureStageTransition(req.params.traceId, data.stage, data);
      } else if (type === 'llm_call') {
        event = await engine.trace.captureLLMCall(req.params.traceId, data);
      }
      engine.registry.stats.total_traces_captured++;
      res.json(event || { status: 'captured' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get full trace
  app.get('/trace/:traceId', async (req, res) => {
    try {
      const events = await engine.trace.getFullTrace(req.params.traceId);
      res.json({ traceId: req.params.traceId, events, count: events.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}

// ─── Bootstrap ────────────────────────────────────────────────
if (require.main === module) {
  const config = { redis: null, neon: null };
  const engine = new DistillationEngine(config);
  const app = createServer(engine);
  const port = parseInt(process.env.PORT || '3407');

  app.listen(port, () => {
    logger.info({ port }, 'Heady Distiller started');
  });

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down Heady Distiller');
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { DistillationEngine, RecipeRegistry, TraceCapture, createServer };
