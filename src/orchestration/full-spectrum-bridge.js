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
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Full-Spectrum Bridge — Wires 15-Layer Audit Tasks into HCFullPipeline + AutoSuccess
 *
 * This bridge module:
 * 1. Loads all full-spectrum tasks from the task registry
 * 2. Maps each task to its HCFullPipeline stage
 * 3. Maps each task to its AutoSuccess category
 * 4. Provides unified execution interface for both systems
 * 5. Emits telemetry for every task execution
 *
 * @module src/orchestration/full-spectrum-bridge
 * @version 1.0.0
 */
'use strict';

const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

const PHI = (1 + Math.sqrt(5)) / 2;
const PSI = 1 / PHI;
const FIB = [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597,2584,4181,6765];

// ─── 22 PIPELINE STAGES (canonical IDs) ──────────────────────────────────────
const PIPELINE_STAGES = [
  'channel-entry', 'recon', 'intake', 'classify', 'triage',
  'decompose', 'trial-and-error', 'orchestrate', 'monte-carlo', 'arena',
  'judge', 'approve', 'execute', 'verify', 'self-awareness',
  'self-critique', 'mistake-analysis', 'optimization-ops', 'continuous-search',
  'evolution', 'receipt', 'distiller'
];

// ─── 13 AUTO-SUCCESS CATEGORIES ──────────────────────────────────────────────
const AUTO_SUCCESS_CATEGORIES = [
  'learning', 'optimization', 'integration', 'monitoring', 'maintenance',
  'discovery', 'verification', 'creative', 'deep-intel', 'hive-integration',
  'security-governance', 'resilience', 'evolution'
];

// ─── 15 AUDIT LAYERS ──────────────────────────────────────────────────────────
const AUDIT_LAYERS = {
  1:  'boot-integrity',
  2:  'pipeline-health',
  3:  'data-layer',
  4:  'security-pass',
  5:  'service-mesh',
  6:  'performance',
  7:  'auto-success-validation',
  8:  'agent-marketplace',
  9:  'ip-competitive-moat',
  10: 'sacred-geometry-sdk',
  11: 'full-throttle-auto-success',
  12: 'colab-runtime-intelligence',
  13: 'coding-practice-engine',
  14: 'heady-train-service',
  15: 'revenue-architecture'
};

// ─── LAYER → PIPELINE STAGE MAPPING ──────────────────────────────────────────
const LAYER_TO_STAGE = {
  1:  'recon',
  2:  'orchestrate',
  3:  'intake',
  4:  'verify',
  5:  'recon',
  6:  'optimization-ops',
  7:  'execute',
  8:  'arena',
  9:  'continuous-search',
  10: 'channel-entry',
  11: 'orchestrate',
  12: 'self-awareness',
  13: 'trial-and-error',
  14: 'self-critique',
  15: 'receipt'
};

// ─── LAYER → AUTO-SUCCESS CATEGORY MAPPING ───────────────────────────────────
const LAYER_TO_CATEGORY = {
  1:  'verification',
  2:  'integration',
  3:  'maintenance',
  4:  'security-governance',
  5:  'monitoring',
  6:  'optimization',
  7:  'verification',
  8:  'hive-integration',
  9:  'deep-intel',
  10: 'creative',
  11: 'integration',
  12: 'learning',
  13: 'learning',
  14: 'learning',
  15: 'optimization'
};

class FullSpectrumBridge extends EventEmitter {
  constructor(opts = {}) {
    super();
    this._tasks = new Map();
    this._stageIndex = new Map();   // stageId → [taskIds]
    this._categoryIndex = new Map(); // category → [taskIds]
    this._layerIndex = new Map();    // layer → [taskIds]
    this._executionLog = [];
    this._metrics = {
      totalTasks: 0,
      tasksExecuted: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      avgDurationMs: 0,
      lastCycleAt: null
    };
    this._eventBus = opts.eventBus || null;

    // Initialize indexes
    PIPELINE_STAGES.forEach(s => this._stageIndex.set(s, []));
    AUTO_SUCCESS_CATEGORIES.forEach(c => this._categoryIndex.set(c, []));
    Object.keys(AUDIT_LAYERS).forEach(l => this._layerIndex.set(parseInt(l), []));
  }

  /**
   * Register a task from the full-spectrum task registry.
   */
  registerTask(task) {
    if (!task.id || !task.layer) throw new Error(`Task missing id or layer: ${JSON.stringify(task)}`);

    const stageId = task.pipelineStage || LAYER_TO_STAGE[task.layer] || 'execute';
    const category = task.autoSuccessCategory || LAYER_TO_CATEGORY[task.layer] || 'verification';

    const enriched = {
      ...task,
      pipelineStage: stageId,
      autoSuccessCategory: category,
      registeredAt: new Date().toISOString(),
      executionCount: 0,
      lastExecutedAt: null,
      lastResult: null,
      successRate: 1.0,
      avgDurationMs: 0
    };

    this._tasks.set(task.id, enriched);
    this._stageIndex.get(stageId)?.push(task.id);
    this._categoryIndex.get(category)?.push(task.id);
    this._layerIndex.get(task.layer)?.push(task.id);
    this._metrics.totalTasks++;

    return enriched;
  }

  /**
   * Bulk register from full-spectrum task registry module.
   */
  registerAll(tasks) {
    const results = [];
    for (const task of tasks) {
      try {
        results.push(this.registerTask(task));
      } catch (err) {
        this.emit('task:register:error', { taskId: task?.id, error: err.message });
      }
    }
    this.emit('bridge:loaded', {
      totalTasks: this._metrics.totalTasks,
      stages: this._stageIndex.size,
      categories: this._categoryIndex.size,
      layers: this._layerIndex.size
    });
    return results;
  }

  /**
   * Execute a specific task by ID.
   */
  async executeTask(taskId, context = {}) {
    const task = this._tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const start = Date.now();
    this.emit('task:start', { taskId, layer: task.layer, stage: task.pipelineStage });

    try {
      let result;
      if (typeof task.execute === 'function') {
        result = await Promise.race([
          task.execute({ ...context, taskId, layer: task.layer }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Task timeout')), FIB[10] * 1000))
        ]);
      } else {
        result = { success: true, result: { message: `Task ${taskId} has no executor` }, learnings: [] };
      }

      const duration = Date.now() - start;
      task.executionCount++;
      task.lastExecutedAt = new Date().toISOString();
      task.lastResult = result;
      task.avgDurationMs = (task.avgDurationMs * (task.executionCount - 1) + duration) / task.executionCount;

      if (result?.success) {
        task.successRate = (task.successRate * (task.executionCount - 1) + 1) / task.executionCount;
        this._metrics.tasksSucceeded++;
      } else {
        task.successRate = (task.successRate * (task.executionCount - 1)) / task.executionCount;
        this._metrics.tasksFailed++;
      }

      this._metrics.tasksExecuted++;
      this._metrics.avgDurationMs = (this._metrics.avgDurationMs * (this._metrics.tasksExecuted - 1) + duration) / this._metrics.tasksExecuted;

      const entry = {
        taskId,
        layer: task.layer,
        stage: task.pipelineStage,
        category: task.autoSuccessCategory,
        success: !!result?.success,
        durationMs: duration,
        timestamp: new Date().toISOString(),
        learnings: result?.learnings || []
      };
      this._executionLog.push(entry);

      // Emit to event bus if available
      this.emit('task:complete', entry);
      if (this._eventBus) {
        this._eventBus.emit('auto_success:reaction', entry);
        this._eventBus.emit(`stage:${task.pipelineStage}:task:complete`, entry);
      }

      return entry;
    } catch (err) {
      const duration = Date.now() - start;
      task.executionCount++;
      task.lastExecutedAt = new Date().toISOString();
      task.successRate = (task.successRate * (task.executionCount - 1)) / task.executionCount;
      this._metrics.tasksFailed++;
      this._metrics.tasksExecuted++;

      const entry = {
        taskId,
        layer: task.layer,
        stage: task.pipelineStage,
        category: task.autoSuccessCategory,
        success: false,
        error: err.message,
        durationMs: duration,
        timestamp: new Date().toISOString(),
        learnings: [`Error in ${taskId}: ${err.message}`]
      };
      this._executionLog.push(entry);
      this.emit('task:error', entry);
      return entry;
    }
  }

  /**
   * Execute all tasks for a specific pipeline stage.
   */
  async executeStage(stageId, context = {}) {
    const taskIds = this._stageIndex.get(stageId) || [];
    const results = await Promise.allSettled(
      taskIds.map(id => this.executeTask(id, context))
    );
    this.emit('stage:complete', { stageId, taskCount: taskIds.length, results: results.length });
    return results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message });
  }

  /**
   * Execute all tasks for a specific auto-success category.
   */
  async executeCategory(category, context = {}) {
    const taskIds = this._categoryIndex.get(category) || [];
    const results = await Promise.allSettled(
      taskIds.map(id => this.executeTask(id, context))
    );
    this.emit('category:complete', { category, taskCount: taskIds.length });
    return results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message });
  }

  /**
   * Execute all tasks for a specific audit layer.
   */
  async executeLayer(layerNum, context = {}) {
    const taskIds = this._layerIndex.get(layerNum) || [];
    const results = await Promise.allSettled(
      taskIds.map(id => this.executeTask(id, context))
    );
    this.emit('layer:complete', { layer: layerNum, name: AUDIT_LAYERS[layerNum], taskCount: taskIds.length });
    return results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message });
  }

  /**
   * Run full-spectrum cycle — execute ALL tasks across all 15 layers.
   */
  async runFullSpectrum(context = {}) {
    this.emit('fullspectrum:start', { totalTasks: this._metrics.totalTasks });
    const start = Date.now();

    const layerResults = {};
    for (let layer = 1; layer <= 15; layer++) {
      layerResults[layer] = await this.executeLayer(layer, context);
    }

    const duration = Date.now() - start;
    this._metrics.lastCycleAt = new Date().toISOString();

    const summary = {
      durationMs: duration,
      totalTasks: this._metrics.totalTasks,
      executed: this._metrics.tasksExecuted,
      succeeded: this._metrics.tasksSucceeded,
      failed: this._metrics.tasksFailed,
      successRate: this._metrics.tasksExecuted > 0
        ? (this._metrics.tasksSucceeded / this._metrics.tasksExecuted * 100).toFixed(1) + '%'
        : 'N/A',
      avgDurationMs: Math.round(this._metrics.avgDurationMs),
      layerResults
    };

    this.emit('fullspectrum:complete', summary);
    return summary;
  }

  /**
   * Get metrics for monitoring.
   */
  getMetrics() {
    return {
      ...this._metrics,
      tasksByStage: Object.fromEntries(
        [...this._stageIndex.entries()].map(([k, v]) => [k, v.length])
      ),
      tasksByCategory: Object.fromEntries(
        [...this._categoryIndex.entries()].map(([k, v]) => [k, v.length])
      ),
      tasksByLayer: Object.fromEntries(
        [...this._layerIndex.entries()].map(([k, v]) => [k, v.length])
      ),
      recentExecutions: this._executionLog.slice(-FIB[7]),
      phi: PHI,
      psi: PSI
    };
  }

  /**
   * Export all tasks as auto-success compatible format.
   */
  toAutoSuccessFormat() {
    return [...this._tasks.values()].map(t => ({
      id: t.id,
      category: t.autoSuccessCategory,
      name: t.name,
      description: t.description,
      weight: t.weight || PHI,
      execute: t.execute,
      schedule: t.schedule
    }));
  }

  /**
   * Export all tasks as pipeline-stage-compatible format.
   */
  toPipelineStageFormat() {
    const stageMap = {};
    for (const [stageId, taskIds] of this._stageIndex.entries()) {
      stageMap[stageId] = taskIds.map(id => {
        const t = this._tasks.get(id);
        return { id: t.id, name: t.name, layer: t.layer, weight: t.weight };
      });
    }
    return stageMap;
  }
}

module.exports = {
  FullSpectrumBridge,
  PIPELINE_STAGES,
  AUTO_SUCCESS_CATEGORIES,
  AUDIT_LAYERS,
  LAYER_TO_STAGE,
  LAYER_TO_CATEGORY,
  PHI,
  PSI,
  FIB
};
