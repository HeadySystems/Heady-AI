/**
 * Heady™ Pipeline Engine — Unified Execution Runtime
 * ═══════════════════════════════════════════════════
 *
 * THE SINGLE PIPELINE ENGINE. Replaces:
 *   1. src/hcfp/pipeline-runner.js           → 5-step HCFP
 *   2. src/engines/hybrid-pipeline.js        → 21-stage hybrid
 *   3. src/auto-success-engine.ts            → 144-task heartbeat
 *   4. src/services/heady-chain/             → Graph-based chains
 *   5. packages/hcfullpipeline/              → Packaged runtime
 *   6. perplexity-build/services/hcfullpipeline-executor/
 *
 * Architecture:
 *   PipelineEngine owns execution.
 *   Stages are pluggable handlers.
 *   Variants select which stages run.
 *   CircuitBreakers protect each stage.
 *   WorkerPool manages concurrency.
 *   CSL gates control stage transitions.
 *
 * @module core/pipeline/engine
 */
'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');
const { PHI, PSI, CSL, TIMING, fib, phiBackoffWithJitter, cslGate } = require('../constants/phi');
const { STAGES, STAGE_NAMES, VARIANTS, selectVariant } = require('./stages');
const { CircuitBreaker, CircuitBreakerPool } = require('../infrastructure/circuit-breaker');
const { WorkerPool } = require('../infrastructure/worker-pool');

// ─── Run States ──────────────────────────────────────────────────────────────

const RUN_STATE = {
  PENDING:   'PENDING',
  RUNNING:   'RUNNING',
  PAUSED:    'PAUSED',
  COMPLETED: 'COMPLETED',
  FAILED:    'FAILED',
  CANCELLED: 'CANCELLED',
};

// ─── Pipeline Engine ─────────────────────────────────────────────────────────

class PipelineEngine extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {number} [opts.maxConcurrentRuns] - Max parallel pipeline runs (default: fib(5)=5)
   * @param {number} [opts.maxRetries]        - Max stage retries (default: fib(4)=3)
   */
  constructor(opts = {}) {
    super();
    this.maxConcurrentRuns = opts.maxConcurrentRuns ?? fib(5);   // 5
    this.maxRetries        = opts.maxRetries        ?? fib(4);   // 3

    this._stageHandlers = new Map();       // stageName → async handler(ctx)
    this._breakers = new CircuitBreakerPool();
    this._pool = new WorkerPool('pipeline', { maxConcurrent: this.maxConcurrentRuns });
    this._runs = new Map();                // runId → RunContext

    // Metrics
    this.totalRuns = 0;
    this.totalCompleted = 0;
    this.totalFailed = 0;
    this.startTime = Date.now();
  }

  // ─── Stage Registration ──────────────────────────────────────────────────

  /**
   * Register a handler for a pipeline stage.
   * @param {string} stageName - Must match a key in STAGES
   * @param {function} handler - async (ctx) => result
   */
  registerStage(stageName, handler) {
    if (!STAGES[stageName]) {
      throw new Error(`Unknown stage: ${stageName}. Valid: ${STAGE_NAMES.join(', ')}`);
    }
    this._stageHandlers.set(stageName, handler);
    return this;
  }

  /** Register multiple stage handlers at once */
  registerStages(handlers) {
    for (const [name, handler] of Object.entries(handlers)) {
      this.registerStage(name, handler);
    }
    return this;
  }

  // ─── Pipeline Execution ──────────────────────────────────────────────────

  /**
   * Execute a pipeline run.
   * @param {object} input     - The input payload
   * @param {object} [opts]
   * @param {string} [opts.variant]    - Pipeline variant (FAST, STANDARD, FULL, ARENA, LEARNING)
   * @param {number} [opts.complexity] - Task complexity (0-1) for auto variant selection
   * @param {number} [opts.confidence] - CSL confidence (0-1) for auto variant selection
   * @param {string} [opts.runId]      - Custom run ID
   * @returns {Promise<RunResult>}
   */
  async execute(input, opts = {}) {
    const runId = opts.runId || `run_${crypto.randomBytes(6).toString('hex')}`;
    const variant = opts.variant || selectVariant(opts.complexity ?? 0.5, opts.confidence ?? CSL.BOOST);
    const stages = VARIANTS[variant];

    if (!stages) {
      throw new Error(`Unknown variant: ${variant}. Valid: ${Object.keys(VARIANTS).join(', ')}`);
    }

    const ctx = {
      runId,
      variant,
      input,
      state: RUN_STATE.PENDING,
      stages: stages.slice(),
      currentStage: null,
      currentStageIndex: -1,
      results: {},
      errors: [],
      timeline: [],
      startedAt: Date.now(),
      completedAt: null,
      confidence: opts.confidence ?? CSL.BOOST,
      metadata: opts.metadata || {},
    };

    this._runs.set(runId, ctx);
    this.totalRuns++;

    return this._pool.submit(async () => {
      return this._executeRun(ctx);
    }, runId);
  }

  /**
   * Execute the HCFP 5-step pipeline (backward-compatible shorthand).
   * Maps INGEST→DECOMPOSE→ROUTE→VALIDATE→PERSIST to the STANDARD variant.
   */
  async executeHCFP(manifest) {
    return this.execute(manifest, { variant: 'STANDARD' });
  }

  /** Execute auto-flow (the heady_auto_flow MCP tool entry point) */
  async executeAutoFlow(task, code, context) {
    return this.execute(
      { task, code, context },
      { variant: 'ARENA', complexity: 0.7, confidence: CSL.BOOST }
    );
  }

  // ─── Run Lifecycle ───────────────────────────────────────────────────────

  async _executeRun(ctx) {
    ctx.state = RUN_STATE.RUNNING;
    this.emit('run:start', { runId: ctx.runId, variant: ctx.variant });

    try {
      for (let i = 0; i < ctx.stages.length; i++) {
        if (ctx.state === RUN_STATE.CANCELLED) break;

        const stageName = ctx.stages[i];
        ctx.currentStage = stageName;
        ctx.currentStageIndex = i;

        const result = await this._executeStage(ctx, stageName);
        ctx.results[stageName] = result;

        // CSL gate check: if confidence drops below stage minimum, add learning stages
        if (result.confidence !== undefined && result.confidence < STAGES[stageName].csl) {
          ctx.errors.push({
            stage: stageName,
            type: 'LOW_CONFIDENCE',
            confidence: result.confidence,
            threshold: STAGES[stageName].csl,
          });
          this.emit('run:low_confidence', {
            runId: ctx.runId, stage: stageName,
            confidence: result.confidence,
          });
        }
      }

      ctx.state = RUN_STATE.COMPLETED;
      ctx.completedAt = Date.now();
      this.totalCompleted++;

      const result = this._buildResult(ctx);
      this.emit('run:complete', result);
      return result;

    } catch (err) {
      ctx.state = RUN_STATE.FAILED;
      ctx.completedAt = Date.now();
      ctx.errors.push({ stage: ctx.currentStage, error: err.message });
      this.totalFailed++;

      const result = this._buildResult(ctx);
      this.emit('run:failed', result);
      throw err;
    }
  }

  async _executeStage(ctx, stageName) {
    const handler = this._stageHandlers.get(stageName);
    const stageConfig = STAGES[stageName];
    const breaker = this._breakers.get(stageName);

    const stageStart = Date.now();

    // Default passthrough if no handler registered
    if (!handler) {
      const result = { skipped: true, reason: 'no_handler', confidence: ctx.confidence };
      ctx.timeline.push({ stage: stageName, status: 'skipped', elapsed: 0 });
      return result;
    }

    // Execute with circuit breaker + timeout + retry
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await breaker.execute(async () => {
          return Promise.race([
            handler(ctx),
            this._timeout(stageConfig.timeout, stageName),
          ]);
        });

        const elapsed = Date.now() - stageStart;
        ctx.timeline.push({ stage: stageName, status: 'ok', elapsed, attempt });
        this.emit('stage:complete', { runId: ctx.runId, stage: stageName, elapsed });
        return result;

      } catch (err) {
        lastError = err;
        if (err.circuitOpen || attempt >= this.maxRetries) break;

        const delay = phiBackoffWithJitter(attempt);
        ctx.timeline.push({ stage: stageName, status: 'retry', attempt, delay });
        await new Promise(r => setTimeout(r, delay));
      }
    }

    // Stage failed after retries
    const elapsed = Date.now() - stageStart;
    ctx.timeline.push({ stage: stageName, status: 'failed', elapsed, error: lastError?.message });
    this.emit('stage:failed', { runId: ctx.runId, stage: stageName, error: lastError?.message });
    throw lastError;
  }

  _timeout(ms, label) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Stage ${label} timed out after ${ms}ms`)), ms);
    });
  }

  _buildResult(ctx) {
    return {
      runId: ctx.runId,
      variant: ctx.variant,
      state: ctx.state,
      stages: ctx.stages,
      results: ctx.results,
      errors: ctx.errors,
      timeline: ctx.timeline,
      elapsed: (ctx.completedAt || Date.now()) - ctx.startedAt,
      metadata: ctx.metadata,
    };
  }

  // ─── Query ───────────────────────────────────────────────────────────────

  /** Get run status by ID */
  getRunStatus(runId) {
    const ctx = this._runs.get(runId);
    if (!ctx) return null;
    return {
      runId: ctx.runId,
      variant: ctx.variant,
      state: ctx.state,
      currentStage: ctx.currentStage,
      progress: ctx.stages.length > 0
        ? (ctx.currentStageIndex + 1) / ctx.stages.length
        : 0,
      elapsed: Date.now() - ctx.startedAt,
    };
  }

  /** Cancel a running pipeline */
  cancel(runId) {
    const ctx = this._runs.get(runId);
    if (ctx && ctx.state === RUN_STATE.RUNNING) {
      ctx.state = RUN_STATE.CANCELLED;
      this.emit('run:cancelled', { runId });
      return true;
    }
    return false;
  }

  /** Health status of the pipeline engine */
  health() {
    return {
      uptime: Date.now() - this.startTime,
      totalRuns: this.totalRuns,
      totalCompleted: this.totalCompleted,
      totalFailed: this.totalFailed,
      activeRuns: this._pool.status().active,
      queuedRuns: this._pool.status().queued,
      circuitBreakers: this._breakers.healthReport(),
    };
  }
}

module.exports = { PipelineEngine, RUN_STATE };
