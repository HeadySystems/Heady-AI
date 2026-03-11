/**
 * liquid-conductor.js — The liquid node orchestration layer.
 *
 * Routes tasks via capability matching (NOT priority ranking).
 * Hot/Warm/Cold resource pools (phi-scaled: 34%/21%/13%/8%/5%).
 * HCFullPipeline: 8-stage processing. Arena mode for competitive evaluation.
 * All constants phi-scaled and Fibonacci-derived.
 */

import { randomUUID } from 'crypto';
import {
  PHI, PSI, FIB, EMBEDDING_DIM,
  POOL_ALLOCATIONS, PIPELINE_STAGES, MAX_CONCURRENT_TASKS,
} from './constants.js';
import { cosineSimilarity, randomUnitVector, relevanceScore } from './vector-space-ops.js';
import { CircuitBreaker, retryWithBackoff } from './resilience-layer.js';
import { BeeFactory } from './bee-factory.js';
import { SwarmCoordinator } from './swarm-coordinator.js';

// ---------------------------------------------------------------------------
// Resource Pool Manager
// ---------------------------------------------------------------------------

class ResourcePoolManager {
  /**
   * @param {object} [opts={}]
   * @param {number} [opts.totalCapacity=34]
   */
  constructor(opts = {}) {
    this.totalCapacity = opts.totalCapacity || FIB[8]; // 34
    this.pools = {
      hot: { capacity: Math.round(this.totalCapacity * POOL_ALLOCATIONS.HOT), items: new Map() },
      warm: { capacity: Math.round(this.totalCapacity * POOL_ALLOCATIONS.WARM), items: new Map() },
      cold: { capacity: Math.round(this.totalCapacity * POOL_ALLOCATIONS.COLD), items: new Map() },
      reserve: { capacity: Math.round(this.totalCapacity * POOL_ALLOCATIONS.RESERVE), items: new Map() },
      governance: { capacity: Math.round(this.totalCapacity * POOL_ALLOCATIONS.GOVERNANCE), items: new Map() },
    };
  }

  /**
   * Assign an item to a pool tier.
   * @param {string} id
   * @param {object} item
   * @param {'hot'|'warm'|'cold'|'reserve'|'governance'} tier
   * @returns {boolean}
   */
  assign(id, item, tier = 'warm') {
    const pool = this.pools[tier];
    if (!pool || pool.items.size >= pool.capacity) return false;
    pool.items.set(id, { ...item, assignedAt: Date.now(), tier });
    return true;
  }

  /**
   * Promote an item to a hotter tier.
   * @param {string} id
   * @returns {boolean}
   */
  promote(id) {
    const tierOrder = ['cold', 'warm', 'hot'];
    for (let i = 0; i < tierOrder.length - 1; i++) {
      const pool = this.pools[tierOrder[i]];
      if (pool.items.has(id)) {
        const item = pool.items.get(id);
        pool.items.delete(id);
        return this.assign(id, item, tierOrder[i + 1]);
      }
    }
    return false;
  }

  /**
   * Demote an item to a cooler tier.
   * @param {string} id
   * @returns {boolean}
   */
  demote(id) {
    const tierOrder = ['hot', 'warm', 'cold'];
    for (let i = 0; i < tierOrder.length - 1; i++) {
      const pool = this.pools[tierOrder[i]];
      if (pool.items.has(id)) {
        const item = pool.items.get(id);
        pool.items.delete(id);
        return this.assign(id, item, tierOrder[i + 1]);
      }
    }
    return false;
  }

  remove(id) {
    for (const pool of Object.values(this.pools)) {
      if (pool.items.delete(id)) return true;
    }
    return false;
  }

  getStatus() {
    const status = {};
    for (const [name, pool] of Object.entries(this.pools)) {
      status[name] = { used: pool.items.size, capacity: pool.capacity };
    }
    return status;
  }
}

// ---------------------------------------------------------------------------
// Task Classifier
// ---------------------------------------------------------------------------

class TaskClassifier {
  /**
   * Classify a task into a type based on keywords and embedding.
   * @param {object} task
   * @returns {{ taskType: string, confidence: number, suggestedPool: string }}
   */
  classify(task) {
    const desc = (task.description || '').toLowerCase();

    const typeKeywords = {
      research: ['research', 'search', 'find', 'discover', 'explore'],
      analysis: ['analyze', 'analysis', 'evaluate', 'assess', 'compare'],
      coding: ['code', 'implement', 'build', 'develop', 'program'],
      creative: ['create', 'design', 'generate', 'compose', 'write'],
      review: ['review', 'check', 'validate', 'verify', 'audit'],
      planning: ['plan', 'strategy', 'schedule', 'organize', 'coordinate'],
    };

    let bestType = 'research';
    let bestScore = 0;

    for (const [type, keywords] of Object.entries(typeKeywords)) {
      const matches = keywords.filter(kw => desc.includes(kw)).length;
      const score = matches / keywords.length;
      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }

    const confidence = Math.max(bestScore, PSI * PSI);
    const suggestedPool = confidence > PSI ? 'hot' : confidence > PSI * PSI ? 'warm' : 'cold';

    return { taskType: bestType, confidence, suggestedPool };
  }
}

// ---------------------------------------------------------------------------
// HCFullPipeline — 8-stage processing
// ---------------------------------------------------------------------------

class HCFullPipeline {
  /**
   * @param {object} opts
   * @param {import('./swarm-coordinator.js').SwarmCoordinator} opts.swarm
   * @param {import('./telemetry-bus.js').TelemetryBus} [opts.telemetry]
   */
  constructor(opts) {
    this.swarm = opts.swarm;
    this.telemetry = opts.telemetry || null;
    this.stages = PIPELINE_STAGES;
    this._stageHandlers = new Map();

    // Register default stage handlers
    for (const stage of this.stages) {
      this._stageHandlers.set(stage, this._defaultHandler.bind(this));
    }
  }

  /**
   * Register a custom handler for a pipeline stage.
   * @param {string} stage
   * @param {(ctx: object) => Promise<object>} handler
   */
  registerStage(stage, handler) {
    if (!this.stages.includes(stage)) throw new Error(`Unknown stage: ${stage}`);
    this._stageHandlers.set(stage, handler);
  }

  /**
   * Execute the full 8-stage pipeline.
   * @param {object} input
   * @returns {Promise<{ result: object, stageResults: Map<string, object>, durationMs: number }>}
   */
  async execute(input) {
    const pipelineId = randomUUID();
    const startTime = Date.now();
    const stageResults = new Map();

    let ctx = {
      pipelineId,
      input,
      stageIndex: 0,
      results: {},
      metadata: { startTime },
    };

    const trace = this.telemetry
      ? this.telemetry.startTrace('pipeline.execute', { pipelineId })
      : null;

    for (let i = 0; i < this.stages.length; i++) {
      const stage = this.stages[i];
      ctx.stageIndex = i;
      ctx.currentStage = stage;

      try {
        const handler = this._stageHandlers.get(stage);
        const stageResult = await handler(ctx);
        stageResults.set(stage, stageResult);
        ctx.results[stage] = stageResult;
      } catch (err) {
        stageResults.set(stage, { error: err.message });
        if (this.telemetry) {
          this.telemetry.warn('pipeline.stageFailed', { pipelineId, stage, error: err.message });
        }
        // CSL gating and refinement failures are non-fatal
        if (stage !== 'csl_gating' && stage !== 'refinement') {
          if (trace) trace.end('error', { failedStage: stage });
          throw err;
        }
      }
    }

    const durationMs = Date.now() - startTime;
    if (trace) trace.end('ok', { durationMs, stages: this.stages.length });
    if (this.telemetry) this.telemetry.recordMetric('pipeline.durationMs', durationMs);

    return { result: ctx.results, stageResults, durationMs };
  }

  async _defaultHandler(ctx) {
    return { stage: ctx.currentStage, processed: true, ts: Date.now() };
  }
}

// ---------------------------------------------------------------------------
// Arena Mode — competitive bee evaluation
// ---------------------------------------------------------------------------

class ArenaMode {
  /**
   * @param {object} opts
   * @param {import('./swarm-coordinator.js').SwarmCoordinator} opts.swarm
   * @param {import('./telemetry-bus.js').TelemetryBus} [opts.telemetry]
   */
  constructor(opts) {
    this.swarm = opts.swarm;
    this.telemetry = opts.telemetry || null;
  }

  /**
   * Run arena: multiple bees compete on the same task, best result wins.
   * @param {object} task
   * @param {number} [contestants=3]
   * @param {(result: object) => number} [scoreFn]
   * @returns {Promise<{ winner: object, scores: object[], durationMs: number }>}
   */
  async compete(task, contestants = FIB[3], scoreFn) {
    const startTime = Date.now();
    const scoreFunc = scoreFn || ((r) => r.success ? 1 : 0);

    const promises = Array.from({ length: contestants }, () =>
      this.swarm.submitTask({ ...task, id: randomUUID() })
    );

    const results = await Promise.allSettled(promises);
    const scored = results
      .filter(r => r.status === 'fulfilled')
      .map(r => ({ ...r.value, arenaScore: scoreFunc(r.value) }))
      .sort((a, b) => b.arenaScore - a.arenaScore);

    const durationMs = Date.now() - startTime;

    if (this.telemetry) {
      this.telemetry.info('arena.completed', {
        contestants, validResults: scored.length, durationMs,
      });
    }

    return {
      winner: scored[0] || null,
      scores: scored,
      durationMs,
    };
  }
}

// ---------------------------------------------------------------------------
// LiquidConductor — Main orchestration class
// ---------------------------------------------------------------------------

export class LiquidConductor {
  /**
   * @param {object} [opts={}]
   * @param {import('./telemetry-bus.js').TelemetryBus} [opts.telemetry]
   * @param {number} [opts.maxConcurrent=MAX_CONCURRENT_TASKS]
   * @param {number} [opts.poolCapacity=34]
   */
  constructor(opts = {}) {
    this.telemetry = opts.telemetry || null;

    this.factory = new BeeFactory({ telemetry: this.telemetry });
    this.swarm = new SwarmCoordinator({
      factory: this.factory,
      telemetry: this.telemetry,
      maxConcurrent: opts.maxConcurrent || MAX_CONCURRENT_TASKS,
    });

    this.pools = new ResourcePoolManager({ totalCapacity: opts.poolCapacity || FIB[8] });
    this.classifier = new TaskClassifier();
    this.pipeline = new HCFullPipeline({ swarm: this.swarm, telemetry: this.telemetry });
    this.arena = new ArenaMode({ swarm: this.swarm, telemetry: this.telemetry });

    this._running = false;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async start(beeTypes = ['research', 'analysis', 'coding', 'creative', 'review']) {
    if (this._running) return;
    this._running = true;

    // Spawn initial bee swarm
    for (const type of beeTypes) {
      await this.factory.spawn(type);
    }

    this.swarm.start();

    if (this.telemetry) {
      this.telemetry.info('conductor.started', { beeTypes, beeCount: this.factory.getActiveBees().length });
    }
  }

  async stop() {
    if (!this._running) return;
    this._running = false;
    await this.swarm.stop();
    await this.factory.retireAll();
    if (this.telemetry) this.telemetry.info('conductor.stopped');
  }

  // -------------------------------------------------------------------------
  // Task routing
  // -------------------------------------------------------------------------

  /**
   * Route and execute a task through classification, pool assignment, and swarm.
   * @param {object} taskSpec
   * @returns {Promise<object>}
   */
  async route(taskSpec) {
    const classification = this.classifier.classify(taskSpec);
    this.pools.assign(taskSpec.id || randomUUID(), { taskSpec, classification }, classification.suggestedPool);

    return this.swarm.submitTask({
      ...taskSpec,
      requiredCapabilities: taskSpec.requiredCapabilities || [classification.taskType],
    });
  }

  /**
   * Execute through the full 8-stage pipeline.
   * @param {object} input
   * @returns {Promise<object>}
   */
  async executePipeline(input) {
    return this.pipeline.execute(input);
  }

  /**
   * Run arena mode evaluation.
   * @param {object} task
   * @param {number} [contestants=3]
   * @returns {Promise<object>}
   */
  async runArena(task, contestants) {
    return this.arena.compete(task, contestants);
  }

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  getStatus() {
    return {
      running: this._running,
      factory: this.factory.getStatus(),
      swarm: this.swarm.getStatus(),
      pools: this.pools.getStatus(),
      pipeline: { stages: this.pipeline.stages.length },
    };
  }
}
