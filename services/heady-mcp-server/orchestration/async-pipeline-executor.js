/**
 * @fileoverview Async Pipeline Executor — Parallel DAG Execution Engine
 * @description Takes a DAG of tasks, topologically sorts, executes with maximum
 * parallelism respecting data dependencies. Phi-scaled timeouts per task criticality.
 * Checkpoint/restore for long-running pipelines.
 * @module async-pipeline-executor
 */

'use strict';

const {
  PHI, PSI, PHI_SQUARED, FIB, CSL, CSL_ERROR_CODES,
  INTERVALS, phiBackoff, correlationId, structuredLog,
} = require('./phi-constants');

// ─── TASK STATUS ─────────────────────────────────────────────────────────────

/**
 * @enum {string} TaskStatus
 */
const TaskStatus = {
  PENDING: 'PENDING',
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
  CHECKPOINTED: 'CHECKPOINTED',
};

// ─── TASK CRITICALITY → TIMEOUT MAPPING ──────────────────────────────────────

/**
 * @constant {Object} CRITICALITY_TIMEOUTS - Phi-scaled timeouts by criticality level
 */
const CRITICALITY_TIMEOUTS = {
  low:      FIB[8] * 1000,          // 21s
  medium:   FIB[9] * 1000,          // 34s
  high:     FIB[10] * 1000,         // 55s
  critical: FIB[11] * 1000,         // 89s
  governance: FIB[12] * 1000,       // 144s
};

// ─── PIPELINE TASK ───────────────────────────────────────────────────────────

/**
 * @typedef {Object} PipelineTask
 * @property {string} id - Unique task ID
 * @property {string} name - Human-readable task name
 * @property {Function} execute - Async execution function(context) → result
 * @property {string[]} dependencies - Task IDs this task depends on
 * @property {string} criticality - low | medium | high | critical | governance
 * @property {number} [timeoutMs] - Override timeout in ms
 * @property {number} [retries] - Max retries (default: FIB[4] = 3)
 * @property {Object} [metadata] - Additional metadata
 */

// ─── CHECKPOINT STORE ────────────────────────────────────────────────────────

/**
 * @class CheckpointStore
 * @description In-memory checkpoint store for pipeline state persistence
 */
class CheckpointStore {
  constructor() {
    /** @private {Map<string, Object>} */
    this._checkpoints = new Map();
  }

  /**
   * Save a pipeline checkpoint
   * @param {string} pipelineId
   * @param {Object} state
   */
  save(pipelineId, state) {
    this._checkpoints.set(pipelineId, {
      savedAt: Date.now(),
      state: JSON.parse(JSON.stringify(state)),
    });
  }

  /**
   * Load a pipeline checkpoint
   * @param {string} pipelineId
   * @returns {Object|null}
   */
  load(pipelineId) {
    const cp = this._checkpoints.get(pipelineId);
    return cp ? cp.state : null;
  }

  /**
   * Delete a checkpoint
   * @param {string} pipelineId
   */
  delete(pipelineId) {
    this._checkpoints.delete(pipelineId);
  }

  /**
   * Check if checkpoint exists
   * @param {string} pipelineId
   * @returns {boolean}
   */
  has(pipelineId) {
    return this._checkpoints.has(pipelineId);
  }
}

// ─── EXECUTION CONTEXT ───────────────────────────────────────────────────────

/**
 * @class ExecutionContext
 * @description Shared context for pipeline tasks, holds results and metadata
 */
class ExecutionContext {
  /**
   * @param {string} pipelineId
   * @param {Object} [initialData={}]
   */
  constructor(pipelineId, initialData = {}) {
    this.pipelineId = pipelineId;
    this.correlationId = correlationId('pipe');
    this.results = new Map();
    this.data = { ...initialData };
    this.startedAt = Date.now();
    this.logs = [];
  }

  /**
   * Get result of a completed dependency
   * @param {string} taskId
   * @returns {*}
   */
  getResult(taskId) {
    return this.results.get(taskId);
  }

  /**
   * Set a task result
   * @param {string} taskId
   * @param {*} result
   */
  setResult(taskId, result) {
    this.results.set(taskId, result);
  }

  /**
   * Log a message to the context
   * @param {string} level
   * @param {string} message
   * @param {Object} [meta={}]
   */
  log(level, message, meta = {}) {
    this.logs.push(structuredLog(level, 'PipelineExecutor', message, {
      pipelineId: this.pipelineId,
      ...meta,
    }, this.correlationId));
  }

  /**
   * Serialize context for checkpointing
   * @returns {Object}
   */
  serialize() {
    return {
      pipelineId: this.pipelineId,
      correlationId: this.correlationId,
      results: Object.fromEntries(this.results),
      data: this.data,
      startedAt: this.startedAt,
    };
  }

  /**
   * Restore from serialized state
   * @param {Object} state
   */
  restore(state) {
    this.correlationId = state.correlationId;
    this.results = new Map(Object.entries(state.results || {}));
    this.data = state.data || {};
    this.startedAt = state.startedAt;
  }
}

// ─── ASYNC PIPELINE EXECUTOR ─────────────────────────────────────────────────

/**
 * @class AsyncPipelineExecutor
 * @description Parallel async pipeline execution engine with DAG scheduling,
 * phi-scaled timeouts, and checkpoint/restore support.
 */
class AsyncPipelineExecutor {
  /**
   * @param {Object} [config={}]
   * @param {number} [config.maxConcurrency] - Max parallel tasks (default: FIB[7] = 13)
   * @param {boolean} [config.checkpointEnabled] - Enable checkpointing
   * @param {number} [config.checkpointIntervalTasks] - Checkpoint every N tasks
   */
  constructor(config = {}) {
    /** @private */
    this._config = {
      maxConcurrency: config.maxConcurrency || FIB[7],
      checkpointEnabled: config.checkpointEnabled !== false,
      checkpointIntervalTasks: config.checkpointIntervalTasks || FIB[6],
    };

    /** @private */
    this._checkpoints = new CheckpointStore();

    /** @private */
    this._activePipelines = new Map();

    /** @private */
    this._stats = {
      pipelinesExecuted: 0,
      tasksExecuted: 0,
      tasksFailed: 0,
      tasksSkipped: 0,
      checkpointsSaved: 0,
      checkpointsRestored: 0,
    };
  }

  /**
   * Execute a pipeline of tasks
   * @param {PipelineTask[]} tasks - Array of pipeline tasks forming a DAG
   * @param {Object} [initialData={}] - Initial context data
   * @param {string} [pipelineId] - Pipeline ID (auto-generated if omitted)
   * @returns {Promise<Object>} Pipeline result
   */
  async execute(tasks, initialData = {}, pipelineId) {
    const id = pipelineId || correlationId('pipe');
    const ctx = new ExecutionContext(id, initialData);

    // Check for checkpoint to restore
    if (this._config.checkpointEnabled && this._checkpoints.has(id)) {
      const savedState = this._checkpoints.load(id);
      ctx.restore(savedState);
      this._stats.checkpointsRestored++;
      ctx.log('info', 'Restored from checkpoint');
    }

    // Build adjacency and in-degree maps
    const taskMap = new Map();
    const inDegree = new Map();
    const dependents = new Map();

    for (const task of tasks) {
      taskMap.set(task.id, { ...task, status: TaskStatus.PENDING, attempt: 0 });
      inDegree.set(task.id, 0);
      dependents.set(task.id, []);
    }

    for (const task of tasks) {
      for (const dep of (task.dependencies || [])) {
        if (!taskMap.has(dep)) {
          throw new Error(`${CSL_ERROR_CODES.E_PIPELINE_FAILED.code}: Unknown dependency '${dep}' in task '${task.id}'`);
        }
        inDegree.set(task.id, inDegree.get(task.id) + 1);
        dependents.get(dep).push(task.id);
      }
    }

    // Skip already-completed tasks (from checkpoint)
    for (const [taskId, task] of taskMap.entries()) {
      if (ctx.results.has(taskId)) {
        task.status = TaskStatus.COMPLETED;
        for (const depId of dependents.get(taskId)) {
          inDegree.set(depId, inDegree.get(depId) - 1);
        }
      }
    }

    // Detect cycles
    const tempInDeg = new Map(inDegree);
    const tempQueue = [];
    let sortedCount = 0;
    for (const [id, deg] of tempInDeg.entries()) {
      if (deg === 0 && taskMap.get(id).status !== TaskStatus.COMPLETED) tempQueue.push(id);
      if (taskMap.get(id).status === TaskStatus.COMPLETED) sortedCount++;
    }
    while (tempQueue.length > 0) {
      const n = tempQueue.shift();
      sortedCount++;
      for (const d of dependents.get(n)) {
        tempInDeg.set(d, tempInDeg.get(d) - 1);
        if (tempInDeg.get(d) === 0) tempQueue.push(d);
      }
    }
    if (sortedCount !== tasks.length) {
      throw new Error(`${CSL_ERROR_CODES.E_PIPELINE_FAILED.code}: Pipeline DAG contains cycles`);
    }

    // Register active pipeline
    this._activePipelines.set(id, { ctx, taskMap, cancelled: false });

    // Execute
    const pipelineResult = await this._executePipeline(id, taskMap, inDegree, dependents, ctx);

    // Cleanup
    this._activePipelines.delete(id);
    this._checkpoints.delete(id);
    this._stats.pipelinesExecuted++;

    return pipelineResult;
  }

  /**
   * Cancel a running pipeline
   * @param {string} pipelineId
   */
  cancel(pipelineId) {
    const pipeline = this._activePipelines.get(pipelineId);
    if (pipeline) pipeline.cancelled = true;
  }

  /**
   * Internal pipeline execution loop
   * @private
   */
  async _executePipeline(pipelineId, taskMap, inDegree, dependents, ctx) {
    const pipeline = this._activePipelines.get(pipelineId);
    let completedCount = 0;
    let failedCount = 0;
    let tasksSinceCheckpoint = 0;

    const totalTasks = taskMap.size;
    const alreadyDone = Array.from(taskMap.values()).filter(t => t.status === TaskStatus.COMPLETED).length;
    completedCount = alreadyDone;

    // Main execution loop
    while (completedCount + failedCount < totalTasks) {
      if (pipeline.cancelled) {
        ctx.log('warn', 'Pipeline cancelled');
        break;
      }

      // Find all ready tasks (in-degree 0, not yet running/completed)
      const readyTasks = [];
      for (const [taskId, task] of taskMap.entries()) {
        if (task.status === TaskStatus.PENDING && inDegree.get(taskId) === 0) {
          readyTasks.push(taskId);
        }
      }

      if (readyTasks.length === 0 && completedCount + failedCount < totalTasks) {
        // Deadlock — all remaining tasks have unmet dependencies from failed tasks
        const remaining = Array.from(taskMap.values())
          .filter(t => t.status === TaskStatus.PENDING)
          .map(t => t.id);
        for (const tid of remaining) {
          taskMap.get(tid).status = TaskStatus.SKIPPED;
          this._stats.tasksSkipped++;
          failedCount++;
        }
        break;
      }

      // Execute ready tasks up to max concurrency
      const batch = readyTasks.slice(0, this._config.maxConcurrency);
      for (const taskId of batch) {
        taskMap.get(taskId).status = TaskStatus.RUNNING;
      }

      const results = await Promise.allSettled(
        batch.map(taskId => this._executeTask(taskMap.get(taskId), ctx))
      );

      // Process results
      for (let i = 0; i < batch.length; i++) {
        const taskId = batch[i];
        const task = taskMap.get(taskId);
        const result = results[i];

        if (result.status === 'fulfilled') {
          task.status = TaskStatus.COMPLETED;
          ctx.setResult(taskId, result.value);
          completedCount++;
          this._stats.tasksExecuted++;

          // Decrement in-degree of dependents
          for (const depId of dependents.get(taskId)) {
            inDegree.set(depId, inDegree.get(depId) - 1);
          }
        } else {
          task.status = TaskStatus.FAILED;
          task.error = result.reason?.message || 'Unknown error';
          failedCount++;
          this._stats.tasksFailed++;
          ctx.log('error', `Task '${taskId}' failed: ${task.error}`);
        }

        tasksSinceCheckpoint++;
      }

      // Checkpoint if needed
      if (this._config.checkpointEnabled && tasksSinceCheckpoint >= this._config.checkpointIntervalTasks) {
        this._checkpoints.save(pipelineId, ctx.serialize());
        this._stats.checkpointsSaved++;
        tasksSinceCheckpoint = 0;
      }
    }

    // Build pipeline result
    const taskResults = {};
    for (const [taskId, task] of taskMap.entries()) {
      taskResults[taskId] = {
        status: task.status,
        result: ctx.results.has(taskId) ? ctx.results.get(taskId) : null,
        error: task.error || null,
      };
    }

    return {
      pipelineId,
      correlationId: ctx.correlationId,
      status: failedCount === 0 ? 'completed' : (completedCount > 0 ? 'partial' : 'failed'),
      totalTasks,
      completed: completedCount,
      failed: failedCount,
      skipped: Array.from(taskMap.values()).filter(t => t.status === TaskStatus.SKIPPED).length,
      duration: Date.now() - ctx.startedAt,
      tasks: taskResults,
      logs: ctx.logs,
    };
  }

  /**
   * Execute a single task with timeout and retries
   * @private
   */
  async _executeTask(task, ctx) {
    const maxRetries = task.retries != null ? task.retries : FIB[4];
    const timeoutMs = task.timeoutMs || CRITICALITY_TIMEOUTS[task.criticality] || CRITICALITY_TIMEOUTS.medium;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      task.attempt = attempt;

      if (attempt > 0) {
        const delay = phiBackoff(attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        ctx.log('info', `Retrying task '${task.id}' attempt ${attempt + 1}/${maxRetries + 1}`);
      }

      try {
        const result = await this._executeWithTimeout(task.execute, ctx, timeoutMs);
        return result;
      } catch (err) {
        if (attempt === maxRetries) throw err;
      }
    }
  }

  /**
   * Execute a function with timeout
   * @private
   */
  _executeWithTimeout(fn, ctx, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${CSL_ERROR_CODES.E_TIMEOUT.code}: Task timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      Promise.resolve(fn(ctx))
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(err => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /**
   * Get health status
   * @returns {Object}
   */
  health() {
    const activePipelines = this._activePipelines.size;
    const coherence = activePipelines <= FIB[4]
      ? CSL.HIGH
      : CSL.HIGH * PSI;

    return {
      status: 'healthy',
      coherence: parseFloat(coherence.toFixed(FIB[4])),
      activePipelines,
      maxConcurrency: this._config.maxConcurrency,
      stats: { ...this._stats },
      phi: PHI,
    };
  }
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

module.exports = {
  AsyncPipelineExecutor,
  ExecutionContext,
  CheckpointStore,
  TaskStatus,
  CRITICALITY_TIMEOUTS,
};
