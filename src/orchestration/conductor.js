/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Conductor — src/orchestration/conductor.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Central dispatch and coordination engine. Routes tasks to the right AI node
 * using CSL cosine scoring against node capability embeddings. Manages pipeline
 * execution, Hot/Warm/Cold pool scheduling, and HCFullPipeline orchestration.
 *
 * © HeadySystems Inc. — Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

'use strict';

const {
  fib, PHI, PSI, CSL_THRESHOLDS,
  phiFusionWeights, phiPriorityScore, phiBackoff,
} = require('../../shared/phi-math');
const { cslAND, batchSimilarity, topK } = require('../../shared/csl-engine');
const { assignPool, POOL_CONFIG, ALL_NODES, nodeRing } = require('../../shared/sacred-geometry');

const TASK_STATES = Object.freeze({
  PENDING:    'PENDING',
  QUEUED:     'QUEUED',
  RUNNING:    'RUNNING',
  COMPLETED:  'COMPLETED',
  FAILED:     'FAILED',
  CANCELLED:  'CANCELLED',
  RETRYING:   'RETRYING',
});

class Conductor {
  /**
   * @param {object} opts
   * @param {object} opts.nodeRegistry - Map of node name → { capabilities: Float64Array, handler: Function }
   * @param {Function} [opts.embedFn] - async (text) → Float64Array
   * @param {Function} [opts.logger]
   * @param {number} [opts.maxConcurrent] - Global concurrency limit (default fib(9)=34)
   * @param {number} [opts.maxQueueSize] - Task queue max (default fib(14)=377)
   */
  constructor(opts) {
    this.nodeRegistry = opts.nodeRegistry || new Map();
    this.embedFn = opts.embedFn || null;
    this.logger = opts.logger || console;
    this.maxConcurrent = opts.maxConcurrent || fib(9);  // 34
    this.maxQueueSize = opts.maxQueueSize || fib(14);    // 377

    this._tasks = new Map();        // taskId → task
    this._queue = [];               // Pending tasks sorted by priority
    this._running = new Map();      // taskId → { promise, node, startTime }
    this._completedCount = 0;
    this._failedCount = 0;
  }

  /**
   * Submit a task for execution.
   * @param {object} task
   * @param {string} task.id - Unique task ID
   * @param {string} task.description - Natural language task description
   * @param {string} [task.type] - 'user-facing' | 'background' | 'batch' | 'governance'
   * @param {number} [task.urgency] - 0–1 urgency score
   * @param {string} [task.preferredNode] - Force specific node
   * @param {object} [task.payload] - Task-specific data
   * @param {number} [task.maxRetries] - Max retries (default fib(4)=3)
   * @returns {Promise<object>} Task result
   */
  async submit(task) {
    if (this._queue.length >= this.maxQueueSize) {
      throw new ConductorError('Queue full — task rejected');
    }

    const enriched = {
      ...task,
      state: TASK_STATES.PENDING,
      pool: assignPool(task),
      attempts: 0,
      maxRetries: task.maxRetries ?? fib(4),
      submittedAt: Date.now(),
      assignedNode: null,
      result: null,
      error: null,
    };

    this._tasks.set(task.id, enriched);

    // Route to best node
    const node = await this._routeTask(enriched);
    enriched.assignedNode = node;
    enriched.state = TASK_STATES.QUEUED;

    return this._dispatch(enriched);
  }

  /**
   * Route a task to the best AI node using CSL cosine scoring.
   * @param {object} task
   * @returns {Promise<string>} Selected node name
   */
  async _routeTask(task) {
    if (task.preferredNode && this.nodeRegistry.has(task.preferredNode)) {
      return task.preferredNode;
    }

    if (!this.embedFn) {
      // Fallback: round-robin from available nodes
      const available = Array.from(this.nodeRegistry.keys());
      return available[this._completedCount % available.length];
    }

    // Embed the task description
    const taskVector = await this.embedFn(task.description);

    // Score against all node capability vectors
    const candidates = Array.from(this.nodeRegistry.entries())
      .map(([name, node]) => ({
        id: name,
        vector: node.capabilities,
      }));

    const ranked = topK(taskVector, candidates, fib(4)); // top 3

    if (ranked.length === 0) {
      throw new ConductorError('No suitable node found for task');
    }

    // Select highest-scored node that isn't overloaded
    for (const candidate of ranked) {
      if (candidate.score >= CSL_THRESHOLDS.LOW) {
        return candidate.id;
      }
    }

    // If no strong match, use the best available
    return ranked[0].id;
  }

  async _dispatch(task) {
    // Wait for concurrency slot
    while (this._running.size >= this.maxConcurrent) {
      await new Promise(r => setTimeout(r, 100));
      if (task.state === TASK_STATES.CANCELLED) {
        throw new ConductorError('Task cancelled while waiting');
      }
    }

    task.state = TASK_STATES.RUNNING;
    task.attempts++;

    const nodeConfig = this.nodeRegistry.get(task.assignedNode);
    if (!nodeConfig || !nodeConfig.handler) {
      throw new ConductorError(`Node "${task.assignedNode}" has no handler`);
    }

    const startTime = Date.now();
    this._running.set(task.id, { startTime, node: task.assignedNode });

    try {
      const result = await nodeConfig.handler(task);
      task.state = TASK_STATES.COMPLETED;
      task.result = result;
      task.completedAt = Date.now();
      task.durationMs = task.completedAt - startTime;
      this._completedCount++;

      this.logger.info?.(`[Conductor] Task ${task.id} completed by ${task.assignedNode} in ${task.durationMs}ms`);
      return { taskId: task.id, node: task.assignedNode, result, durationMs: task.durationMs };

    } catch (err) {
      task.error = err.message;

      if (task.attempts < task.maxRetries) {
        task.state = TASK_STATES.RETRYING;
        const delay = phiBackoff(task.attempts, 1000, 30000);
        this.logger.warn?.(`[Conductor] Task ${task.id} failed (attempt ${task.attempts}), retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        return this._dispatch(task);
      }

      task.state = TASK_STATES.FAILED;
      task.completedAt = Date.now();
      this._failedCount++;
      this.logger.error?.(`[Conductor] Task ${task.id} failed permanently`, err);
      throw err;

    } finally {
      this._running.delete(task.id);
    }
  }

  /**
   * Cancel a pending or running task.
   * @param {string} taskId
   * @returns {boolean}
   */
  cancel(taskId) {
    const task = this._tasks.get(taskId);
    if (!task) return false;
    if (task.state === TASK_STATES.COMPLETED || task.state === TASK_STATES.FAILED) return false;
    task.state = TASK_STATES.CANCELLED;
    return true;
  }

  /**
   * Register an AI node.
   * @param {string} name
   * @param {object} config
   * @param {Float64Array|number[]} config.capabilities - Capability embedding
   * @param {Function} config.handler - async (task) → result
   */
  registerNode(name, config) {
    this.nodeRegistry.set(name, config);
  }

  /**
   * Get task status.
   */
  getTask(taskId) {
    return this._tasks.get(taskId) || null;
  }

  /**
   * Get conductor status.
   */
  status() {
    const poolCounts = {};
    for (const [, task] of this._tasks) {
      poolCounts[task.pool] = (poolCounts[task.pool] || 0) + 1;
    }

    return {
      registeredNodes: Array.from(this.nodeRegistry.keys()),
      totalTasks: this._tasks.size,
      runningTasks: this._running.size,
      queuedTasks: this._queue.length,
      completedTasks: this._completedCount,
      failedTasks: this._failedCount,
      maxConcurrent: this.maxConcurrent,
      poolDistribution: poolCounts,
    };
  }
}

class ConductorError extends Error {
  constructor(message) {
    super(`[Conductor] ${message}`);
    this.name = 'ConductorError';
  }
}

module.exports = { Conductor, ConductorError, TASK_STATES };
