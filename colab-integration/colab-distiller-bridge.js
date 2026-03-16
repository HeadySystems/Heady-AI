/**
 * Heady™ Colab Distiller Bridge — Wires TraceRecorder into Colab GPU Cluster
 *
 * Hooks into:
 *   - ColabRuntimeManager events (op:started, op:completed, op:failed, cluster:*)
 *   - ColabTaskRouter routing decisions (CSL scores, pool selections)
 *   - ColabGateway task lifecycle (task-complete WebSocket messages)
 *
 * Provides:
 *   - GPU-offloaded distillation (filter, optimize, synthesize) via Colab cold pool
 *   - Feedback loop: optimized prompts → cold runtime → validation
 *   - Trace collection from all GPU operations
 *
 * Author: Eric Haywood, eric@headysystems.com
 * © 2026 HeadySystems Inc. — 51 Provisional Patents
 */

'use strict';

const path = require('path');
const fs = require('fs');

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORTS — DISTILLER CORE
// ═══════════════════════════════════════════════════════════════════════════════

let TraceRecorder, TrajectoryFilter, PromptOptimizer, SkillSynthesizer;
try {
  TraceRecorder = require('../src/hc_trace_recorder');
  TrajectoryFilter = require('../src/hc_trajectory_filter');
  PromptOptimizer = require('../src/hc_prompt_optimizer');
  SkillSynthesizer = require('../src/hc_skill_synthesizer');
} catch (err) {
  // Graceful degradation if distiller modules not present
  console.error('[colab-distiller-bridge] Distiller modules not found:', err.message);
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLAB VECTOR OPS CLIENT (for GPU offload)
// ═══════════════════════════════════════════════════════════════════════════════

let colabVectorOps;
try {
  colabVectorOps = require('./colab-vector-ops');
} catch (err) {
  // Will use local fallbacks
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHI CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const PHI = 1.6180339887498948;
const PSI = 0.6180339887498949;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377];

function log(level, msg, meta = {}) {
  process.stdout.write(JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service: 'colab-distiller-bridge',
    msg,
    ...meta,
  }) + '\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLAB DISTILLER BRIDGE
// ═══════════════════════════════════════════════════════════════════════════════

class ColabDistillerBridge {
  /**
   * @param {object} opts
   * @param {object} opts.runtimeManager - ColabRuntimeManager instance
   * @param {object} opts.taskRouter - ColabTaskRouter instance (optional)
   * @param {string} opts.traceDir - Directory for trace JSONL files
   * @param {object} opts.config - Distiller config (colab section)
   */
  constructor(opts = {}) {
    this._runtimeManager = opts.runtimeManager || null;
    this._taskRouter = opts.taskRouter || null;
    this._traceDir = opts.traceDir || path.resolve(process.cwd(), 'logs/traces');
    this._config = opts.config || {};

    // Initialize distiller components
    this._recorder = null;
    this._filter = null;
    this._optimizer = null;
    this._synthesizer = null;
    this._initialized = false;

    // Metrics
    this._tracedOps = 0;
    this._tracedRoutes = 0;
    this._tracedTasks = 0;
    this._offloadedJobs = 0;
    this._feedbackLoops = 0;

    // Active distillation sessions
    this._activeSessions = new Map();
  }

  // ─── Initialization ─────────────────────────────────────────────────────

  initialize() {
    if (this._initialized) return;

    // Ensure trace directory exists
    if (!fs.existsSync(this._traceDir)) {
      fs.mkdirSync(this._traceDir, { recursive: true });
    }

    // Initialize distiller components
    if (TraceRecorder) {
      this._recorder = new TraceRecorder({ traceDir: this._traceDir });
      this._recorder.initialize();
    }

    if (TrajectoryFilter) {
      this._filter = new TrajectoryFilter({
        minConfidence: this._config.min_confidence || PSI,
        maxTips: this._config.max_tips || FIB[12], // 144
      });
    }

    if (PromptOptimizer) {
      this._optimizer = new PromptOptimizer({
        method: this._config.optimization_method || 'gepa',
      });
    }

    if (SkillSynthesizer) {
      this._synthesizer = new SkillSynthesizer({
        outputDir: this._config.output_dir || path.resolve(process.cwd(), 'skills/distilled'),
      });
    }

    this._initialized = true;
    log('info', 'Colab Distiller Bridge initialized', {
      traceDir: this._traceDir,
      hasRecorder: !!this._recorder,
      hasFilter: !!this._filter,
      hasOptimizer: !!this._optimizer,
      hasSynthesizer: !!this._synthesizer,
    });
  }

  // ─── Hook ColabRuntimeManager ──────────────────────────────────────────

  /**
   * Attach to ColabRuntimeManager event emitters.
   * Records all GPU operations as trace steps.
   * @param {EventEmitter} runtimeManager - ColabRuntimeManager instance
   */
  hookRuntimeManager(runtimeManager) {
    if (!this._recorder) {
      log('warn', 'No TraceRecorder available, skipping runtime hooks');
      return;
    }

    this._runtimeManager = runtimeManager;

    // Hook cluster-level events
    runtimeManager.on('cluster:provisioned', (status) => {
      this._recordEvent('cluster_provisioned', {
        total: status.total,
        provisioned: status.provisioned?.length,
        failed: status.failed?.length,
        successRate: status.successRate,
      });
    });

    runtimeManager.on('cluster:batch-completed', (summary) => {
      this._recordEvent('cluster_batch_completed', {
        op: summary.op,
        total: summary.total,
        succeeded: summary.succeeded,
        failed: summary.failed,
      });
    });

    // Hook individual operation events
    runtimeManager.on('op:started', (data) => {
      this._tracedOps++;
      const traceId = `colab-op-${data.runtimeId}-${data.opId}`;
      this._recorder.startTrace(traceId, {
        type: 'colab_gpu_op',
        runtimeId: data.runtimeId,
        opId: data.opId,
        op: data.op,
        startedAt: Date.now(),
      });
    });

    runtimeManager.on('op:completed', (data) => {
      const traceId = `colab-op-${data.runtimeId}-${data.opId}`;
      this._recorder.recordStep(traceId, {
        type: 'op_completed',
        runtimeId: data.runtimeId,
        opId: data.opId,
        op: data.op,
        status: 'success',
        completedAt: Date.now(),
      });
      this._recorder.endTrace(traceId, { status: 'completed' });
    });

    runtimeManager.on('op:failed', (data) => {
      const traceId = `colab-op-${data.runtimeId}-${data.opId}`;
      this._recorder.recordStep(traceId, {
        type: 'op_failed',
        runtimeId: data.runtimeId,
        opId: data.opId,
        op: data.op,
        error: data.error,
        status: 'failed',
        failedAt: Date.now(),
      });
      this._recorder.endTrace(traceId, { status: 'failed', error: data.error });
    });

    // Hook memory sync events
    runtimeManager.on('runtime:memory-synced', (data) => {
      this._recordEvent('memory_synced', {
        runtimeId: data.runtimeId,
        direction: data.direction,
        vectorsExported: data.vectorsExported,
        vectorsImported: data.vectorsImported,
      });
    });

    log('info', 'Hooked into ColabRuntimeManager', {
      events: ['cluster:provisioned', 'cluster:batch-completed', 'op:started', 'op:completed', 'op:failed', 'runtime:memory-synced'],
    });
  }

  // ─── Hook ColabTaskRouter ──────────────────────────────────────────────

  /**
   * Wrap the ColabTaskRouter.route() method to capture routing decisions.
   * @param {ColabTaskRouter} taskRouter
   */
  hookTaskRouter(taskRouter) {
    if (!this._recorder) {
      log('warn', 'No TraceRecorder available, skipping task router hooks');
      return;
    }

    this._taskRouter = taskRouter;
    const originalRoute = taskRouter.route.bind(taskRouter);

    taskRouter.route = (task) => {
      const result = originalRoute(task);
      this._tracedRoutes++;

      this._recordEvent('task_routed', {
        taskId: task.id,
        taskType: task.type,
        pool: result.pool || 'queued',
        score: result.score,
        queued: result.queued,
        components: result.components,
        queuePosition: result.queuePosition,
      });

      return result;
    };

    log('info', 'Hooked into ColabTaskRouter.route()');
  }

  // ─── Hook Gateway Task Lifecycle ───────────────────────────────────────

  /**
   * Create a middleware function for the gateway to capture task completions.
   * Inject this into the gateway's WebSocket message handler.
   * @returns {function} Middleware that records task-complete events
   */
  createGatewayMiddleware() {
    const self = this;

    return function distillerMiddleware(runtime, msg) {
      if (!self._recorder) return;

      if (msg.type === 'task-complete') {
        self._tracedTasks++;
        const traceId = `colab-task-${msg.taskId}`;

        self._recorder.startTrace(traceId, {
          type: 'colab_task',
          taskId: msg.taskId,
          runtimeId: runtime.id,
          pool: runtime.pool,
        });

        self._recorder.recordStep(traceId, {
          type: 'task_completed',
          taskId: msg.taskId,
          result: msg.result,
          success: msg.success !== false,
          runtime: runtime.id,
          pool: runtime.pool,
          gpuUtil: runtime.gpuUtil,
          memoryUtil: runtime.memoryUtil,
          temperature: runtime.temperature,
          durationMs: msg.result?.durationMs,
        });

        self._recorder.endTrace(traceId, {
          status: msg.success !== false ? 'completed' : 'failed',
        });
      }

      // Also capture heartbeat metrics for learning
      if (msg.type === 'heartbeat' && msg.metrics) {
        self._recordEvent('runtime_metrics', {
          pool: runtime.pool,
          gpuUtil: msg.metrics.gpuUtil,
          memoryUtil: msg.metrics.memoryUtil,
          temperature: msg.metrics.temperature,
          activeTasks: msg.metrics.activeTasks,
        });
      }
    };
  }

  // ─── GPU-Offloaded Distillation ───────────────────────────────────────

  /**
   * Offload trajectory filtering to Colab GPU (cold pool).
   * Uses GPU-accelerated cosine similarity for tip deduplication.
   * @param {object[]} traces - Raw trace data
   * @returns {Promise<object>} Filtered results
   */
  async offloadFilter(traces) {
    if (!this._filter) throw new Error('TrajectoryFilter not initialized');

    this._offloadedJobs++;
    const sessionId = `distill-filter-${Date.now().toString(36)}`;

    log('info', 'Offloading filter to Colab GPU', {
      sessionId,
      traceCount: traces.length,
      targetPool: this._config.filter_pool || 'cold',
    });

    // If Colab gateway is available, offload embedding computation
    if (colabVectorOps && traces.length > (this._config.auto_offload_threshold || 100)) {
      // Extract text content from traces for embedding
      const texts = traces.map(t => {
        const steps = t.steps || [];
        return steps.map(s => JSON.stringify(s)).join(' ');
      });

      try {
        const embedResult = await colabVectorOps.submitTask(
          'distill-embeddings',
          { texts, batchSize: FIB[8] }, // 21
          this._config.embed_pool || 'hot'
        );

        if (embedResult.ok && embedResult.result?.embeddings) {
          // Use GPU-generated embeddings for enhanced filtering
          traces.forEach((trace, i) => {
            trace._embedding = embedResult.result.embeddings[i];
          });
        }
      } catch (err) {
        log('warn', 'GPU embedding offload failed, using CPU filtering', {
          error: err.message,
        });
      }
    }

    // Run filtering (CPU or enhanced with GPU embeddings)
    const filtered = this._filter.filterAll(traces);

    this._activeSessions.set(sessionId, {
      type: 'filter',
      inputCount: traces.length,
      outputCount: filtered.length,
      completedAt: Date.now(),
    });

    log('info', 'Filter complete', {
      sessionId,
      input: traces.length,
      output: filtered.length,
      reductionRate: ((1 - filtered.length / Math.max(traces.length, 1)) * 100).toFixed(1) + '%',
    });

    return { sessionId, filtered, stats: this._filter.getStatus() };
  }

  /**
   * Offload prompt optimization to Colab GPU (cold pool).
   * Uses TextGrad-style optimization with GPU-accelerated eval.
   * @param {string} basePrompt - Starting prompt
   * @param {object[]} traces - Training traces
   * @param {object} opts - Optimization options
   * @returns {Promise<object>} Optimization result
   */
  async offloadOptimize(basePrompt, traces, opts = {}) {
    if (!this._optimizer) throw new Error('PromptOptimizer not initialized');

    this._offloadedJobs++;
    const sessionId = `distill-optimize-${Date.now().toString(36)}`;
    const method = opts.method || this._config.optimization_method || 'gepa';

    log('info', 'Offloading optimization to Colab GPU', {
      sessionId,
      method,
      traceCount: traces.length,
      promptLength: basePrompt.length,
    });

    // If GPU available, submit optimization as a task
    if (colabVectorOps) {
      try {
        const optResult = await colabVectorOps.submitTask(
          'distill-optimize',
          {
            prompt: basePrompt,
            traces: traces.slice(0, FIB[8]), // Cap at 21 traces for GPU
            method,
            iterations: opts.iterations || FIB[7], // 13
          },
          this._config.optimize_pool || 'cold'
        );

        if (optResult.ok && optResult.result?.optimizedPrompt) {
          this._activeSessions.set(sessionId, {
            type: 'optimize',
            method,
            score: optResult.result.score,
            completedAt: Date.now(),
          });

          // Feedback loop: validate optimized prompt
          if (this._config.feedback_loop !== false) {
            this._runFeedbackLoop(sessionId, optResult.result.optimizedPrompt, traces);
          }

          return { sessionId, ...optResult.result };
        }
      } catch (err) {
        log('warn', 'GPU optimization offload failed, falling back to CPU', {
          error: err.message,
        });
      }
    }

    // CPU fallback
    const result = await this._optimizer.optimize(basePrompt, traces, { method });

    this._activeSessions.set(sessionId, {
      type: 'optimize',
      method,
      score: result.score,
      completedAt: Date.now(),
    });

    return { sessionId, ...result };
  }

  /**
   * Offload skill synthesis to Colab GPU.
   * @param {object[]} filteredTraces
   * @returns {Promise<object>}
   */
  async offloadSynthesize(filteredTraces) {
    if (!this._synthesizer) throw new Error('SkillSynthesizer not initialized');

    this._offloadedJobs++;
    const sessionId = `distill-synthesize-${Date.now().toString(36)}`;

    log('info', 'Synthesizing skills from filtered traces', {
      sessionId,
      traceCount: filteredTraces.length,
    });

    const skills = await this._synthesizer.synthesize(filteredTraces);

    this._activeSessions.set(sessionId, {
      type: 'synthesize',
      skillCount: skills.length,
      completedAt: Date.now(),
    });

    return { sessionId, skills, count: skills.length };
  }

  // ─── Full Distillation Pipeline (GPU-Accelerated) ─────────────────────

  /**
   * Run the full distillation pipeline with Colab GPU acceleration.
   * trace collection → filtering → optimization → synthesis
   * @param {object} opts
   * @returns {Promise<object>} Full pipeline result
   */
  async runFullPipeline(opts = {}) {
    const startTime = Date.now();
    const pipelineId = `distill-pipeline-${Date.now().toString(36)}`;

    log('info', 'Starting full distillation pipeline', { pipelineId });

    // Step 1: Collect traces from trace directory
    const traceFiles = fs.readdirSync(this._traceDir)
      .filter(f => f.endsWith('.jsonl'));

    const traces = [];
    for (const file of traceFiles.slice(0, FIB[10])) { // Cap at 55 files
      try {
        const content = fs.readFileSync(path.join(this._traceDir, file), 'utf8');
        const lines = content.trim().split('\n').filter(Boolean);
        const traceSteps = lines.map(line => JSON.parse(line));
        if (traceSteps.length > 0) {
          traces.push({
            file,
            steps: traceSteps,
            metadata: traceSteps[0],
          });
        }
      } catch (err) {
        log('warn', 'Failed to parse trace file', { file, error: err.message });
      }
    }

    if (traces.length === 0) {
      return { pipelineId, status: 'no_traces', message: 'No traces found in trace directory' };
    }

    // Step 2: Filter (GPU-offloaded)
    const filterResult = await this.offloadFilter(traces);

    // Step 3: Optimize (GPU-offloaded)
    let optimizeResult = null;
    if (opts.basePrompt && filterResult.filtered.length > 0) {
      optimizeResult = await this.offloadOptimize(
        opts.basePrompt,
        filterResult.filtered,
        { method: opts.method }
      );
    }

    // Step 4: Synthesize
    let synthesizeResult = null;
    if (filterResult.filtered.length > 0) {
      synthesizeResult = await this.offloadSynthesize(filterResult.filtered);
    }

    const durationMs = Date.now() - startTime;

    const result = {
      pipelineId,
      status: 'completed',
      durationMs,
      traces: { total: traces.length, files: traceFiles.length },
      filter: {
        input: filterResult.filtered ? traces.length : 0,
        output: filterResult.filtered?.length || 0,
      },
      optimize: optimizeResult ? {
        method: optimizeResult.method || opts.method,
        score: optimizeResult.score,
      } : null,
      synthesize: synthesizeResult ? {
        skillCount: synthesizeResult.count,
      } : null,
    };

    log('info', 'Full distillation pipeline complete', result);
    return result;
  }

  // ─── Feedback Loop ────────────────────────────────────────────────────

  /**
   * Push optimized prompt back to cold runtime for validation.
   * @private
   */
  async _runFeedbackLoop(sessionId, optimizedPrompt, traces) {
    if (!colabVectorOps) return;

    this._feedbackLoops++;

    try {
      const validationResult = await colabVectorOps.submitTask(
        'experiment',
        {
          type: 'prompt-validation',
          prompt: optimizedPrompt,
          sampleTraces: traces.slice(0, FIB[5]), // 5 sample traces
          sessionId,
        },
        'cold'
      );

      log('info', 'Feedback loop validation complete', {
        sessionId,
        result: validationResult.ok ? 'validated' : 'failed',
      });
    } catch (err) {
      log('warn', 'Feedback loop failed', {
        sessionId,
        error: err.message,
      });
    }
  }

  // ─── Internal Helpers ─────────────────────────────────────────────────

  _recordEvent(eventType, data) {
    if (!this._recorder) return;

    const traceId = `colab-event-${Date.now().toString(36)}`;
    this._recorder.startTrace(traceId, {
      type: 'colab_event',
      eventType,
    });
    this._recorder.recordStep(traceId, {
      type: eventType,
      ...data,
      ts: Date.now(),
    });
    this._recorder.endTrace(traceId, { status: 'captured' });
  }

  // ─── Status & Metrics ─────────────────────────────────────────────────

  getStatus() {
    const sessions = {};
    for (const [id, session] of this._activeSessions) {
      sessions[id] = session;
    }

    return {
      initialized: this._initialized,
      traceDir: this._traceDir,
      components: {
        recorder: !!this._recorder,
        filter: !!this._filter,
        optimizer: !!this._optimizer,
        synthesizer: !!this._synthesizer,
      },
      metrics: {
        tracedOps: this._tracedOps,
        tracedRoutes: this._tracedRoutes,
        tracedTasks: this._tracedTasks,
        offloadedJobs: this._offloadedJobs,
        feedbackLoops: this._feedbackLoops,
      },
      hooks: {
        runtimeManager: !!this._runtimeManager,
        taskRouter: !!this._taskRouter,
      },
      activeSessions: sessions,
    };
  }

  /**
   * Express router for distiller API endpoints.
   * Mount on the gateway: app.use('/distill', bridge.createRouter())
   * @returns {object} Express router
   */
  createRouter() {
    const express = require('express');
    const router = express.Router();
    const self = this;

    // GET /distill/status
    router.get('/status', (req, res) => {
      res.json({ ok: true, ...self.getStatus() });
    });

    // POST /distill/traces — Upload raw traces for GPU filtering
    router.post('/traces', async (req, res) => {
      try {
        const { traces } = req.body;
        if (!traces || !Array.isArray(traces)) {
          return res.status(400).json({ error: 'HEADY-DISTILL-001', message: 'traces array required' });
        }
        const result = await self.offloadFilter(traces);
        res.json({ ok: true, ...result });
      } catch (err) {
        res.status(500).json({ error: 'HEADY-DISTILL-002', message: err.message });
      }
    });

    // POST /distill/optimize — Submit prompt optimization
    router.post('/optimize', async (req, res) => {
      try {
        const { prompt, traces, method } = req.body;
        if (!prompt) {
          return res.status(400).json({ error: 'HEADY-DISTILL-003', message: 'prompt required' });
        }
        const result = await self.offloadOptimize(prompt, traces || [], { method });
        res.json({ ok: true, ...result });
      } catch (err) {
        res.status(500).json({ error: 'HEADY-DISTILL-004', message: err.message });
      }
    });

    // POST /distill/pipeline — Run full distillation pipeline
    router.post('/pipeline', async (req, res) => {
      try {
        const result = await self.runFullPipeline(req.body);
        res.json({ ok: true, ...result });
      } catch (err) {
        res.status(500).json({ error: 'HEADY-DISTILL-005', message: err.message });
      }
    });

    return router;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = { ColabDistillerBridge };
