/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  HEADY™ BULKHEAD ISOLATION — Resource Partitioning               ║
 * ║  Prevents resource-hungry services from starving others          ║
 * ║  © 2024-2026 HeadySystems Inc. All Rights Reserved.              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

'use strict';

import { PHI, PSI, fib, PHI_TIMING } from '../../shared/phi-math.js';

/** Default max concurrent per bulkhead — fib(10) = 55 */
const DEFAULT_MAX_CONCURRENT = fib(10);

/** Default queue depth — fib(13) = 233 */
const DEFAULT_QUEUE_DEPTH = fib(13);

/** Default execution timeout — φ⁵ × 1000ms */
const DEFAULT_TIMEOUT_MS = PHI_TIMING.PHI_5;

/**
 * Bulkhead — isolates a service's resource usage to prevent cascading starvation.
 * Each bulkhead has a fixed concurrency limit and a bounded queue.
 */
export class Bulkhead {
  /**
   * @param {Object} options
   * @param {string} options.name - Bulkhead name
   * @param {number} [options.maxConcurrent] - Max concurrent executions
   * @param {number} [options.maxQueue] - Max queued waiting requests
   * @param {number} [options.timeoutMs] - Execution timeout
   * @param {Object} [options.telemetry] - Telemetry emitter
   */
  constructor({
    name,
    maxConcurrent = DEFAULT_MAX_CONCURRENT,
    maxQueue = DEFAULT_QUEUE_DEPTH,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    telemetry = null,
  }) {
    this.name = name;
    /** @private */ this._maxConcurrent = maxConcurrent;
    /** @private */ this._maxQueue = maxQueue;
    /** @private */ this._timeoutMs = timeoutMs;
    /** @private */ this._telemetry = telemetry;
    /** @private */ this._active = 0;
    /** @private */ this._queue = [];
    /** @private */ this._totalExecuted = 0;
    /** @private */ this._totalRejected = 0;
    /** @private */ this._totalTimedOut = 0;
  }

  /**
   * Execute a function within the bulkhead's isolation boundary.
   * @template T
   * @param {Function} fn - Async function to execute
   * @returns {Promise<T>}
   * @throws {BulkheadError} If bulkhead is full (concurrent + queue)
   */
  async execute(fn) {
    if (this._active >= this._maxConcurrent) {
      if (this._queue.length >= this._maxQueue) {
        this._totalRejected++;
        throw new BulkheadError(
          `Bulkhead ${this.name} full: ${this._active}/${this._maxConcurrent} active, ${this._queue.length}/${this._maxQueue} queued`,
          this.name
        );
      }

      // Queue the request
      return new Promise((resolve, reject) => {
        this._queue.push({ fn, resolve, reject, enqueuedAt: Date.now() });
      });
    }

    return this._run(fn);
  }

  /**
   * Run a function with timeout and concurrency tracking.
   * @private
   */
  async _run(fn) {
    this._active++;
    const startMs = Date.now();

    try {
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => {
            this._totalTimedOut++;
            reject(new BulkheadError(`Bulkhead ${this.name} timeout after ${this._timeoutMs}ms`, this.name));
          }, this._timeoutMs)
        ),
      ]);

      this._totalExecuted++;
      return result;
    } finally {
      this._active--;
      this._processQueue();
    }
  }

  /**
   * Process next item in queue if capacity available.
   * @private
   */
  _processQueue() {
    if (this._queue.length > 0 && this._active < this._maxConcurrent) {
      const { fn, resolve, reject } = this._queue.shift();
      this._run(fn).then(resolve).catch(reject);
    }
  }

  /**
   * Get bulkhead statistics.
   * @returns {Object}
   */
  getStats() {
    return {
      name: this.name,
      active: this._active,
      maxConcurrent: this._maxConcurrent,
      queued: this._queue.length,
      maxQueue: this._maxQueue,
      utilization: this._active / this._maxConcurrent,
      totalExecuted: this._totalExecuted,
      totalRejected: this._totalRejected,
      totalTimedOut: this._totalTimedOut,
    };
  }
}

/**
 * Custom error for bulkhead rejections.
 */
export class BulkheadError extends Error {
  constructor(message, bulkheadName) {
    super(message);
    this.name = 'BulkheadError';
    this.bulkheadName = bulkheadName;
  }
}

export { DEFAULT_MAX_CONCURRENT, DEFAULT_QUEUE_DEPTH };
export default Bulkhead;
