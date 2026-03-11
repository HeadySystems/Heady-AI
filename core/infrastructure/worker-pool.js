/**
 * Heady™ Worker Pool — Concurrent Task Execution
 * ════════════════════════════════════════════════
 *
 * Consolidates:
 *   - src/services/pipeline-infra.js (WorkerPool)
 *   - src/hc_orchestrator.js (parallel task execution)
 *
 * φ-scaled concurrency limits. Fair round-robin scheduling.
 *
 * @module core/infrastructure/worker-pool
 */
'use strict';

const { fib, TIMING, PHI } = require('../constants/phi');

class WorkerPool {
  /**
   * @param {string} name
   * @param {object} [opts]
   * @param {number} [opts.maxConcurrent] - Max concurrent workers (default: fib(7)=13)
   * @param {number} [opts.queueMax]      - Max queue depth (default: fib(11)=89)
   * @param {number} [opts.taskTimeoutMs] - Per-task timeout (default: TIMING.LONG)
   */
  constructor(name, opts = {}) {
    this.name = name;
    this.maxConcurrent = opts.maxConcurrent ?? fib(7);     // 13
    this.queueMax      = opts.queueMax      ?? fib(11);    // 89
    this.taskTimeoutMs = opts.taskTimeoutMs ?? TIMING.LONG; // ~33,978ms

    this._active = new Map();    // taskId → { promise, startedAt, abort }
    this._queue = [];            // { taskId, fn, resolve, reject }
    this._taskCounter = 0;

    // Metrics
    this.totalProcessed = 0;
    this.totalSucceeded = 0;
    this.totalFailed = 0;
    this.totalTimedOut = 0;
  }

  /** Submit a task. Returns promise that resolves with result. */
  submit(fn, taskId) {
    taskId = taskId || `task_${++this._taskCounter}`;

    return new Promise((resolve, reject) => {
      if (this._active.size < this.maxConcurrent) {
        this._execute(taskId, fn, resolve, reject);
      } else if (this._queue.length < this.queueMax) {
        this._queue.push({ taskId, fn, resolve, reject });
      } else {
        reject(new Error(`WorkerPool ${this.name}: queue full (${this.queueMax})`));
      }
    });
  }

  /** Submit multiple tasks, run up to maxConcurrent in parallel */
  async submitAll(tasks) {
    return Promise.allSettled(
      tasks.map(({ fn, id }) => this.submit(fn, id))
    );
  }

  /** Current utilization (0-1) */
  utilization() {
    return this._active.size / this.maxConcurrent;
  }

  /** Status snapshot */
  status() {
    return {
      name: this.name,
      active: this._active.size,
      queued: this._queue.length,
      maxConcurrent: this.maxConcurrent,
      utilization: this.utilization(),
      totalProcessed: this.totalProcessed,
      totalSucceeded: this.totalSucceeded,
      totalFailed: this.totalFailed,
      totalTimedOut: this.totalTimedOut,
    };
  }

  /** Drain: wait for all active tasks, reject queued */
  async drain() {
    // Reject all queued
    for (const q of this._queue) {
      q.reject(new Error('WorkerPool draining'));
    }
    this._queue = [];

    // Wait for active
    await Promise.allSettled([...this._active.values()].map(a => a.promise));
  }

  async _execute(taskId, fn, resolve, reject) {
    const startedAt = Date.now();
    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
      controller.abort();
      this.totalTimedOut++;
    }, this.taskTimeoutMs);

    const promise = (async () => {
      try {
        const result = await fn(controller.signal);
        this.totalSucceeded++;
        resolve(result);
        return result;
      } catch (err) {
        this.totalFailed++;
        reject(err);
        throw err;
      } finally {
        clearTimeout(timeoutId);
        this.totalProcessed++;
        this._active.delete(taskId);
        this._processQueue();
      }
    })();

    this._active.set(taskId, { promise, startedAt, abort: () => controller.abort() });
  }

  _processQueue() {
    while (this._queue.length > 0 && this._active.size < this.maxConcurrent) {
      const { taskId, fn, resolve, reject } = this._queue.shift();
      this._execute(taskId, fn, resolve, reject);
    }
  }
}

module.exports = { WorkerPool };
