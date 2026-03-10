/**
 * @fileoverview bulkhead-isolation.js — Production-Grade Bulkhead Isolation Service
 *
 * Prevents any single Heady swarm from starving others by enforcing hard resource
 * isolation boundaries (the "bulkhead" pattern from naval architecture). Each
 * compartment has its own semaphore, FIFO+priority queue, and phi-scaled limits.
 *
 * Pool tiers → maxConcurrent:
 *   Hot pool services:  fib(9)  = 34
 *   Warm pool services: fib(8)  = 21
 *   Cold pool services: fib(7)  = 13
 *   Reserve pool:       fib(6)  = 8
 *   Governance:         fib(5)  = 5
 *
 * Adaptive sizing under pressure:
 *   NOMINAL   → full capacity
 *   ELEVATED  → capacity × (1 - ψ²) ≈ 62% of full  (reduce by ψ² ≈ 38%)
 *   HIGH      → capacity × (1 - ψ)  ≈ 38% of full  (reduce by ψ  ≈ 62%)
 *   CRITICAL  → fib(3) = 2 (emergency minimum)
 *
 * @module resilience/bulkhead-isolation
 * @author Heady Ecosystem
 * @version 1.0.0
 * @license MIT
 *
 * @example
 * const { BulkheadRegistry } = require('./bulkhead-isolation');
 * const registry = new BulkheadRegistry();
 * const result = await registry.execute('memory-engine', async () => fetchMemory(id));
 */

'use strict';

const EventEmitter = require('events');

const {
  PHI,
  PSI,
  PSI2,
  PSI3,
  fib,
  phiThreshold,
  phiBackoff,
  phiBackoffWithJitter,
  CSL_THRESHOLDS,
  ALERT_THRESHOLDS,
  POOL_RATIOS,
  getPressureLevel,
  phiFusionWeights,
  phiTimeouts,
  phiIntervals,
  PRESSURE_LEVELS,
} = require('../../shared/phi-math.js');

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: CONSTANTS — ALL DERIVED FROM φ, ψ, OR FIBONACCI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default maxConcurrent for standard (cold-pool) services: fib(7) = 13.
 * @constant {number}
 */
const DEFAULT_MAX_CONCURRENT = fib(7); // 13

/**
 * Default FIFO queue depth: fib(13) = 233.
 * @constant {number}
 */
const DEFAULT_QUEUE_DEPTH = fib(13); // 233

/**
 * Default queue wait timeout in ms: phiTimeouts().slow ≈ 8090ms.
 * @constant {number}
 */
const DEFAULT_QUEUE_TIMEOUT_MS = phiTimeouts().slow; // ≈ 8090

/**
 * Default execution timeout in ms: phiTimeouts().patient ≈ 13090ms.
 * @constant {number}
 */
const DEFAULT_EXECUTION_TIMEOUT_MS = phiTimeouts().patient; // ≈ 13090

/**
 * Graceful shutdown drain timeout in ms: phiTimeouts().marathon ≈ 21180ms.
 * @constant {number}
 */
const SHUTDOWN_DRAIN_TIMEOUT_MS = phiTimeouts().marathon; // ≈ 21180

/**
 * Emergency minimum concurrency at CRITICAL pressure: fib(3) = 2.
 * @constant {number}
 */
const EMERGENCY_MIN_CONCURRENT = fib(3); // 2

/**
 * Metrics history ring-buffer size: fib(8) = 21 samples.
 * @constant {number}
 */
const METRICS_HISTORY_SIZE = fib(8); // 21

/**
 * Pressure sampling interval in ms: phiIntervals().heartbeat ≈ 6910ms.
 * @constant {number}
 */
const PRESSURE_SAMPLE_INTERVAL_MS = phiIntervals().heartbeat; // ≈ 6910

/**
 * Pool tier → maxConcurrent Fibonacci mapping.
 * @constant {{ HOT: number, WARM: number, COLD: number, RESERVE: number, GOVERNANCE: number }}
 */
const TIER_MAX_CONCURRENT = Object.freeze({
  HOT:        fib(9),  // 34
  WARM:       fib(8),  // 21
  COLD:       fib(7),  // 13
  RESERVE:    fib(6),  // 8
  GOVERNANCE: fib(5),  // 5
});

/**
 * Priority weight for phi-scored queue entries.
 * High priority = phiFusionWeights(2)[0] ≈ 0.618.
 * Low priority  = phiFusionWeights(2)[1] ≈ 0.382.
 * @constant {{ HIGH: number, NORMAL: number }}
 */
const PRIORITY_WEIGHTS = Object.freeze((() => {
  const [high, normal] = phiFusionWeights(2);
  return { HIGH: high, NORMAL: normal };
})());

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: CUSTOM ERRORS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thrown when a bulkhead's queue is full and cannot admit a new task.
 * @extends Error
 */
class BulkheadFullError extends Error {
  /**
   * @param {string} bulkheadName - Name of the saturated bulkhead
   * @param {number} queueDepth   - Configured queue depth
   */
  constructor(bulkheadName, queueDepth) {
    super(`Bulkhead "${bulkheadName}" queue full (depth=${queueDepth})`);
    this.name = 'BulkheadFullError';
    this.bulkheadName = bulkheadName;
    this.queueDepth = queueDepth;
  }
}

/**
 * Thrown when a task times out waiting in the bulkhead queue.
 * @extends Error
 */
class BulkheadQueueTimeoutError extends Error {
  /**
   * @param {string} bulkheadName - Name of the bulkhead
   * @param {number} timeoutMs    - Queue wait timeout in milliseconds
   */
  constructor(bulkheadName, timeoutMs) {
    super(`Bulkhead "${bulkheadName}" queue timeout after ${timeoutMs}ms`);
    this.name = 'BulkheadQueueTimeoutError';
    this.bulkheadName = bulkheadName;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Thrown when a task's execution exceeds the execution timeout.
 * @extends Error
 */
class BulkheadExecutionTimeoutError extends Error {
  /**
   * @param {string} bulkheadName - Name of the bulkhead
   * @param {number} timeoutMs    - Execution timeout in milliseconds
   */
  constructor(bulkheadName, timeoutMs) {
    super(`Bulkhead "${bulkheadName}" execution timeout after ${timeoutMs}ms`);
    this.name = 'BulkheadExecutionTimeoutError';
    this.bulkheadName = bulkheadName;
    this.timeoutMs = timeoutMs;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: PHI-PRIORITY QUEUE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FIFO queue with phi-weighted priority scoring.
 * High-priority entries are inserted ahead of normal-priority entries;
 * entries of equal priority are strictly FIFO within their tier.
 */
class PhiPriorityQueue {
  /**
   * Creates an empty PhiPriorityQueue with the given depth limit.
   *
   * @param {number} maxDepth - Maximum number of queued entries before overflow
   */
  constructor(maxDepth) {
    /** @type {number} */
    this._maxDepth = maxDepth;

    /**
     * Internal storage: each entry is { resolve, reject, enqueuedAt, priority }.
     * Maintained in descending phi-score order (highest score = head).
     * @type {Array<{resolve: Function, reject: Function, enqueuedAt: number, priority: number}>}
     */
    this._entries = [];
  }

  /**
   * Number of entries currently waiting.
   * @returns {number}
   */
  get size() {
    return this._entries.length;
  }

  /**
   * Whether the queue has reached maximum depth.
   * @returns {boolean}
   */
  get isFull() {
    return this._entries.length >= this._maxDepth;
  }

  /**
   * Inserts a new entry, sorted by descending phi-priority score.
   * Entries with equal score are appended after all same-score peers (FIFO).
   *
   * @param {Function} resolve   - Promise resolve callback
   * @param {Function} reject    - Promise reject callback
   * @param {number}   priority  - Phi-weighted priority score in [0, 1]
   * @returns {void}
   */
  enqueue(resolve, reject, priority) {
    const entry = { resolve, reject, enqueuedAt: Date.now(), priority };
    // Binary-search insertion to maintain descending priority order
    let lo = 0, hi = this._entries.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this._entries[mid].priority > priority) lo = mid + 1;
      else hi = mid;
    }
    this._entries.splice(lo, 0, entry);
  }

  /**
   * Removes and returns the highest-priority head entry, or null if empty.
   *
   * @returns {{ resolve: Function, reject: Function, enqueuedAt: number, priority: number }|null}
   */
  dequeue() {
    if (this._entries.length === 0) return null;
    return this._entries.shift();
  }

  /**
   * Drains all queued entries by rejecting each with the provided error.
   *
   * @param {Error} reason - Error to reject each queued entry with
   * @returns {void}
   */
  drain(reason) {
    while (this._entries.length > 0) {
      const entry = this._entries.shift();
      entry.reject(reason);
    }
  }

  /**
   * Returns the wait time in ms of the oldest (highest-priority) entry,
   * or 0 if the queue is empty.
   *
   * @returns {number}
   */
  headWaitMs() {
    if (this._entries.length === 0) return 0;
    return Date.now() - this._entries[0].enqueuedAt;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: BULKHEAD (SINGLE COMPARTMENT)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} BulkheadConfig
 * @property {string}  name                  - Unique bulkhead name
 * @property {string}  [tier='COLD']         - Pool tier: HOT | WARM | COLD | RESERVE | GOVERNANCE
 * @property {number}  [maxConcurrent]       - Override max concurrent slots (default from tier)
 * @property {number}  [queueDepth]          - Queue depth override (default: DEFAULT_QUEUE_DEPTH)
 * @property {number}  [queueTimeoutMs]      - Queue wait timeout override
 * @property {number}  [executionTimeoutMs]  - Execution timeout override
 * @property {Object}  [telemetry]           - OpenTelemetry { tracer, meter } refs
 */

/**
 * @typedef {Object} BulkheadMetrics
 * @property {string}  name               - Bulkhead name
 * @property {string}  tier               - Pool tier
 * @property {number}  maxConcurrent      - Configured max concurrent (after adaptive sizing)
 * @property {number}  activeTasks        - Currently executing tasks
 * @property {number}  queuedTasks        - Tasks waiting in queue
 * @property {number}  rejectedTasks      - Total tasks rejected (queue overflow)
 * @property {number}  completedTasks     - Total tasks completed successfully
 * @property {number}  failedTasks        - Total tasks that threw errors
 * @property {number}  timedOutTasks      - Total tasks timed out in queue or execution
 * @property {number}  averageWaitMs      - Rolling average queue wait time (ms)
 * @property {number}  averageExecutionMs - Rolling average execution time (ms)
 * @property {number}  utilizationRate    - activeTasks / effectiveConcurrent [0, 1]
 * @property {string}  pressureLevel      - NOMINAL | ELEVATED | HIGH | CRITICAL
 */

/**
 * A single isolation compartment enforcing concurrency and queue limits.
 * Emits events through the owning BulkheadRegistry EventEmitter.
 */
class Bulkhead {
  /**
   * Creates a Bulkhead compartment.
   *
   * @param {BulkheadConfig} config  - Compartment configuration
   * @param {EventEmitter}   emitter - Shared event bus
   */
  constructor(config, emitter) {
    if (!config || typeof config.name !== 'string' || config.name.trim() === '') {
      throw new TypeError('Bulkhead: config.name must be a non-empty string');
    }
    if (!(emitter instanceof EventEmitter)) {
      throw new TypeError('Bulkhead: emitter must be an EventEmitter instance');
    }

    /** @type {string} */
    this.name = config.name.trim();

    /** @type {string} */
    this.tier = config.tier || 'COLD';

    /** @type {number} Nominal (unadjusted) max concurrent for this tier */
    this._nominalConcurrent = config.maxConcurrent ?? TIER_MAX_CONCURRENT[this.tier] ?? DEFAULT_MAX_CONCURRENT;

    /** @type {number} Currently effective max concurrent (adaptive sizing applied) */
    this._effectiveConcurrent = this._nominalConcurrent;

    /** @type {number} */
    this._queueDepth = config.queueDepth ?? DEFAULT_QUEUE_DEPTH;

    /** @type {number} */
    this._queueTimeoutMs = config.queueTimeoutMs ?? DEFAULT_QUEUE_TIMEOUT_MS;

    /** @type {number} */
    this._executionTimeoutMs = config.executionTimeoutMs ?? DEFAULT_EXECUTION_TIMEOUT_MS;

    /** @type {Object|null} */
    this._telemetry = config.telemetry ?? null;

    /** @type {EventEmitter} */
    this._emitter = emitter;

    /** @type {number} Active execution slots in use */
    this._active = 0;

    /** @type {PhiPriorityQueue} */
    this._queue = new PhiPriorityQueue(this._queueDepth);

    // ── Counters ──────────────────────────────────────────────────────────────
    /** @type {number} */ this._rejectedTasks = 0;
    /** @type {number} */ this._completedTasks = 0;
    /** @type {number} */ this._failedTasks = 0;
    /** @type {number} */ this._timedOutTasks = 0;

    /** @type {string} */
    this._pressureLevel = 'NOMINAL';

    /**
     * Rolling window for wait-time and execution-time averages.
     * Ring buffer of size METRICS_HISTORY_SIZE.
     * @type {{ waitMs: number[], execMs: number[] }}
     */
    this._history = { waitMs: [], execMs: [] };
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  /**
   * Currently active (executing) task count.
   * @returns {number}
   */
  get activeTasks() { return this._active; }

  /**
   * Currently queued (waiting) task count.
   * @returns {number}
   */
  get queuedTasks() { return this._queue.size; }

  /**
   * Utilization rate: activeTasks / effectiveConcurrent, clamped to [0, 1].
   * @returns {number}
   */
  get utilizationRate() {
    if (this._effectiveConcurrent === 0) return 1;
    return Math.min(1, this._active / this._effectiveConcurrent);
  }

  // ── Semaphore ─────────────────────────────────────────────────────────────

  /**
   * Non-blocking attempt to claim a concurrency slot.
   * Returns true if a slot was acquired immediately, false otherwise.
   *
   * @returns {boolean} True if the slot was acquired
   */
  tryAcquire() {
    if (this._active < this._effectiveConcurrent) {
      this._active++;
      return true;
    }
    return false;
  }

  /**
   * Attempts to acquire a concurrency slot, waiting up to timeoutMs if full.
   * Enqueues a waiter with phi-weighted priority scoring.
   * Throws BulkheadFullError if queue is at capacity.
   * Throws BulkheadQueueTimeoutError if the wait exceeds timeoutMs.
   *
   * @param {number} [timeoutMs]  - Max wait in ms (default: _queueTimeoutMs)
   * @param {number} [priority]   - Entry priority [0,1] (default: PRIORITY_WEIGHTS.NORMAL)
   * @returns {Promise<void>} Resolves when the slot is acquired
   * @throws {BulkheadFullError}           On queue overflow
   * @throws {BulkheadQueueTimeoutError}   On wait timeout
   */
  acquire(timeoutMs, priority) {
    const waitLimit = timeoutMs ?? this._queueTimeoutMs;
    const score     = priority  ?? PRIORITY_WEIGHTS.NORMAL;

    // Fast path: slot available immediately
    if (this._active < this._effectiveConcurrent) {
      this._active++;
      return Promise.resolve();
    }

    // Queue overflow
    if (this._queue.isFull) {
      this._rejectedTasks++;
      this._emitter.emit('taskRejected', { bulkhead: this.name, queueDepth: this._queueDepth });
      this._recordTelemetryRejection();
      return Promise.reject(new BulkheadFullError(this.name, this._queueDepth));
    }

    // Enqueue the waiter
    return new Promise((resolve, reject) => {
      let timeoutHandle = null;

      const wrappedResolve = () => {
        if (timeoutHandle !== null) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        resolve();
      };

      const wrappedReject = (err) => {
        if (timeoutHandle !== null) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        reject(err);
      };

      timeoutHandle = setTimeout(() => {
        timeoutHandle = null;
        // Remove from queue — rebuild without this entry
        this._queue._entries = this._queue._entries.filter(e => e.resolve !== wrappedResolve);
        this._timedOutTasks++;
        this._emitter.emit('taskRejected', { bulkhead: this.name, reason: 'queue-timeout', timeoutMs: waitLimit });
        wrappedReject(new BulkheadQueueTimeoutError(this.name, waitLimit));
      }, waitLimit);

      this._queue.enqueue(wrappedResolve, wrappedReject, score);
      this._emitter.emit('taskAdmitted', { bulkhead: this.name, queued: this._queue.size });
    });
  }

  /**
   * Releases a concurrency slot. Wakes the next queued waiter, if any.
   * Must be called exactly once per successful acquire().
   *
   * @returns {void}
   */
  release() {
    const next = this._queue.dequeue();
    if (next !== null) {
      // Record wait time in rolling history
      const waitMs = Date.now() - next.enqueuedAt;
      this._pushHistory(this._history.waitMs, waitMs);
      next.resolve();
      // _active count stays the same: we hand the slot to next
    } else {
      this._active = Math.max(0, this._active - 1);
    }
  }

  // ── Execution ─────────────────────────────────────────────────────────────

  /**
   * Executes an async task through the bulkhead: acquires a slot, runs the
   * task with execution timeout, then releases the slot.
   *
   * @param {Function} task              - Async function to execute: () => Promise<*>
   * @param {Object}   [opts]            - Execution options
   * @param {number}   [opts.priority]   - Queue priority [0,1]
   * @param {number}   [opts.queueTimeout]    - Override queue wait timeout ms
   * @param {number}   [opts.execTimeout]     - Override execution timeout ms
   * @returns {Promise<*>} Task result
   * @throws {BulkheadFullError}              On queue overflow
   * @throws {BulkheadQueueTimeoutError}      On queue wait timeout
   * @throws {BulkheadExecutionTimeoutError}  On execution timeout
   * @throws {Error}                          On task error
   */
  async execute(task, opts = {}) {
    if (typeof task !== 'function') {
      throw new TypeError(`Bulkhead[${this.name}].execute: task must be a function`);
    }

    const execLimit = opts.execTimeout ?? this._executionTimeoutMs;

    await this.acquire(opts.queueTimeout, opts.priority);

    const execStart = Date.now();
    let execTimer = null;

    try {
      const result = await Promise.race([
        task(),
        new Promise((_, reject) => {
          execTimer = setTimeout(() => {
            execTimer = null;
            this._timedOutTasks++;
            this._emitter.emit('taskRejected', { bulkhead: this.name, reason: 'execution-timeout', timeoutMs: execLimit });
            reject(new BulkheadExecutionTimeoutError(this.name, execLimit));
          }, execLimit);
        }),
      ]);

      const execMs = Date.now() - execStart;
      this._pushHistory(this._history.execMs, execMs);
      this._completedTasks++;
      this._emitter.emit('taskCompleted', { bulkhead: this.name, execMs, active: this._active });
      this._recordTelemetryExecution('success', execMs);
      return result;
    } catch (err) {
      const execMs = Date.now() - execStart;
      this._pushHistory(this._history.execMs, execMs);

      if (err instanceof BulkheadExecutionTimeoutError) {
        this._recordTelemetryExecution('timeout', execMs);
      } else {
        this._failedTasks++;
        this._recordTelemetryExecution('failure', execMs);
      }
      throw err;
    } finally {
      if (execTimer !== null) {
        clearTimeout(execTimer);
      }
      this.release();
    }
  }

  // ── Adaptive Sizing ───────────────────────────────────────────────────────

  /**
   * Applies adaptive concurrency sizing based on the given pressure level.
   * Emits a bulkheadResized event when the effective limit changes.
   *
   * Reductions:
   *   NOMINAL   → full nominal capacity
   *   ELEVATED  → nominal × (1 - ψ²)  ≈ 61.8% of nominal
   *   HIGH      → nominal × (1 - ψ)   ≈ 38.2% of nominal
   *   CRITICAL  → EMERGENCY_MIN_CONCURRENT = fib(3) = 2
   *
   * @param {'NOMINAL'|'ELEVATED'|'HIGH'|'CRITICAL'} level - New pressure level
   * @returns {void}
   */
  applyPressure(level) {
    const previous = this._effectiveConcurrent;
    let next;

    if (level === 'CRITICAL') {
      next = EMERGENCY_MIN_CONCURRENT;
    } else if (level === 'HIGH') {
      // Reduce by ψ ≈ 62%; retain 1 - ψ ≈ 38.2%
      next = Math.max(EMERGENCY_MIN_CONCURRENT, Math.floor(this._nominalConcurrent * (1 - PSI)));
    } else if (level === 'ELEVATED') {
      // Reduce by ψ² ≈ 38.2%; retain 1 - ψ² ≈ 61.8%
      next = Math.max(EMERGENCY_MIN_CONCURRENT, Math.floor(this._nominalConcurrent * (1 - PSI2)));
    } else {
      next = this._nominalConcurrent;
    }

    const previousLevel = this._pressureLevel;
    this._effectiveConcurrent = next;
    this._pressureLevel = level;

    if (next !== previous || level !== previousLevel) {
      this._emitter.emit('bulkheadResized', {
        bulkhead: this.name,
        from: previous,
        to: next,
        pressureLevel: level,
      });
      if (level !== previousLevel) {
        this._emitter.emit('pressureChanged', {
          bulkhead: this.name,
          from: previousLevel,
          to: level,
          effectiveConcurrent: next,
        });
      }
    }
  }

  // ── Metrics ───────────────────────────────────────────────────────────────

  /**
   * Returns a full metrics snapshot for this bulkhead.
   *
   * @returns {BulkheadMetrics}
   */
  getMetrics() {
    return {
      name:               this.name,
      tier:               this.tier,
      maxConcurrent:      this._effectiveConcurrent,
      nominalConcurrent:  this._nominalConcurrent,
      activeTasks:        this._active,
      queuedTasks:        this._queue.size,
      rejectedTasks:      this._rejectedTasks,
      completedTasks:     this._completedTasks,
      failedTasks:        this._failedTasks,
      timedOutTasks:      this._timedOutTasks,
      averageWaitMs:      this._rollingAvg(this._history.waitMs),
      averageExecutionMs: this._rollingAvg(this._history.execMs),
      utilizationRate:    parseFloat(this.utilizationRate.toFixed(6)),
      pressureLevel:      this._pressureLevel,
    };
  }

  // ── Shutdown ──────────────────────────────────────────────────────────────

  /**
   * Drains the queue by rejecting all waiting tasks with a shutdown error.
   * Called during graceful shutdown before the process exits.
   *
   * @returns {void}
   */
  drain() {
    const shutdownErr = new Error(`Bulkhead "${this.name}" is shutting down`);
    shutdownErr.name = 'BulkheadShutdownError';
    this._queue.drain(shutdownErr);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Pushes a sample into a ring-buffer history array of max METRICS_HISTORY_SIZE.
   *
   * @param {number[]} arr    - The history array to push into
   * @param {number}   sample - The value to record
   * @returns {void}
   * @private
   */
  _pushHistory(arr, sample) {
    arr.push(sample);
    if (arr.length > METRICS_HISTORY_SIZE) arr.shift();
  }

  /**
   * Computes the mean of a numeric array. Returns 0 for an empty array.
   *
   * @param {number[]} arr - Sample array
   * @returns {number}
   * @private
   */
  _rollingAvg(arr) {
    if (arr.length === 0) return 0;
    return parseFloat((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2));
  }

  /**
   * Records a task rejection event to the attached OpenTelemetry meter.
   * No-op if no telemetry is configured.
   *
   * @returns {void}
   * @private
   */
  _recordTelemetryRejection() {
    if (!this._telemetry) return;
    try {
      const meter = this._telemetry.meter;
      if (meter && typeof meter.createCounter === 'function') {
        meter
          .createCounter('bulkhead.rejections', { description: 'Bulkhead task rejections' })
          .add(1, { bulkhead: this.name, tier: this.tier });
      }
    } catch (_ignored) {
      // Telemetry failures must never propagate to callers
    }
  }

  /**
   * Records a task execution outcome to the attached OpenTelemetry meter.
   * No-op if no telemetry is configured.
   *
   * @param {'success'|'failure'|'timeout'} outcome - Execution result
   * @param {number} durationMs - Execution wall time in milliseconds
   * @returns {void}
   * @private
   */
  _recordTelemetryExecution(outcome, durationMs) {
    if (!this._telemetry) return;
    try {
      const meter = this._telemetry.meter;
      if (!meter) return;
      if (typeof meter.createCounter === 'function') {
        meter
          .createCounter('bulkhead.executions', { description: 'Bulkhead task executions' })
          .add(1, { bulkhead: this.name, tier: this.tier, outcome });
      }
      if (typeof meter.createHistogram === 'function') {
        meter
          .createHistogram('bulkhead.execution_duration_ms', { description: 'Bulkhead execution duration' })
          .record(durationMs, { bulkhead: this.name, tier: this.tier, outcome });
      }
    } catch (_ignored) {
      // Telemetry failures must never propagate to callers
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: BULKHEAD GROUP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} GroupConfig
 * @property {string}   name          - Group name
 * @property {string[]} members       - Bulkhead names that belong to this group
 * @property {number}   [ceilingRate] - Max aggregate utilization before throttling (default: PSI ≈ 0.618)
 */

/**
 * Links related bulkheads that share a resource ceiling.
 * When aggregate utilization exceeds ceilingRate, member bulkheads are
 * collectively signalled to shed load.
 */
class BulkheadGroup {
  /**
   * @param {GroupConfig} config - Group configuration
   */
  constructor(config) {
    if (!config || typeof config.name !== 'string' || config.name.trim() === '') {
      throw new TypeError('BulkheadGroup: config.name must be a non-empty string');
    }

    /** @type {string} */
    this.name = config.name.trim();

    /** @type {Set<string>} */
    this._members = new Set(config.members || []);

    /**
     * Aggregate utilization ceiling before group shedding activates.
     * Default: PSI ≈ 0.618 (phi-harmonic midpoint).
     * @type {number}
     */
    this._ceilingRate = config.ceilingRate ?? PSI;
  }

  /**
   * Adds a bulkhead name to this group.
   *
   * @param {string} name - Bulkhead name to add
   * @returns {void}
   */
  addMember(name) {
    this._members.add(name);
  }

  /**
   * Removes a bulkhead name from this group.
   *
   * @param {string} name - Bulkhead name to remove
   * @returns {boolean} True if the member existed and was removed
   */
  removeMember(name) {
    return this._members.delete(name);
  }

  /**
   * Returns the member names as an array.
   *
   * @returns {string[]}
   */
  getMembers() {
    return Array.from(this._members);
  }

  /**
   * Computes aggregate utilization across all member bulkheads.
   *
   * @param {Map<string, Bulkhead>} bulkheadMap - Registry bulkhead map
   * @returns {number} Mean utilization rate in [0, 1]
   */
  aggregateUtilization(bulkheadMap) {
    const members = Array.from(this._members)
      .map(n => bulkheadMap.get(n))
      .filter(Boolean);
    if (members.length === 0) return 0;
    const total = members.reduce((sum, b) => sum + b.utilizationRate, 0);
    return total / members.length;
  }

  /**
   * Whether the group is above its resource ceiling.
   *
   * @param {Map<string, Bulkhead>} bulkheadMap - Registry bulkhead map
   * @returns {boolean}
   */
  isOverCeiling(bulkheadMap) {
    return this.aggregateUtilization(bulkheadMap) > this._ceilingRate;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: BULKHEAD REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} RegistryOptions
 * @property {Object}  [telemetry]           - OpenTelemetry { tracer, meter } refs
 * @property {boolean} [autoPressure]        - Enable periodic pressure sampling (default: true)
 * @property {number}  [pressureIntervalMs]  - Override pressure check interval ms
 * @property {Object}  [defaults]            - Default BulkheadConfig overrides
 */

/**
 * Central manager for all isolation compartments in the Heady ecosystem.
 * Pre-registers bulkheads for all 17 Heady swarms at construction.
 * Supports bulkhead groups, adaptive pressure sizing, and graceful shutdown.
 *
 * @extends EventEmitter
 *
 * @example
 * const registry = new BulkheadRegistry({ telemetry: { tracer, meter } });
 * const result = await registry.execute('memory-engine', async () => fetchMemory(id));
 */
class BulkheadRegistry extends EventEmitter {
  /**
   * Creates a BulkheadRegistry and pre-registers all 17 Heady swarms.
   *
   * @param {RegistryOptions} [options={}] - Registry-wide options
   */
  constructor(options = {}) {
    super();

    /** @type {Map<string, Bulkhead>} */
    this._bulkheads = new Map();

    /** @type {Map<string, BulkheadGroup>} */
    this._groups = new Map();

    /** @type {Object|null} */
    this._telemetry = options.telemetry ?? null;

    /** @type {Object} */
    this._defaults = options.defaults ?? {};

    /** @type {boolean} */
    this._shuttingDown = false;

    /** @type {NodeJS.Timeout|null} */
    this._pressureTimer = null;

    const autoPressure = options.autoPressure !== false;
    if (autoPressure) {
      const interval = options.pressureIntervalMs ?? PRESSURE_SAMPLE_INTERVAL_MS;
      this._startPressureTimer(interval);
    }

    this._registerDefaultSwarms();
  }

  // ── Default Swarm Registration ────────────────────────────────────────────

  /**
   * Pre-registers bulkheads for all 17 Heady swarms.
   * Tiers are assigned per architectural role; groups link related services.
   *
   * @returns {void}
   * @private
   */
  _registerDefaultSwarms() {
    /** @type {BulkheadConfig[]} */
    const swarms = [
      // Hot pool — user-facing, latency-critical
      { name: 'memory-engine',      tier: 'HOT' },
      { name: 'csl-engine',         tier: 'HOT' },
      { name: 'vector-store',       tier: 'HOT' },
      { name: 'phi-router',         tier: 'HOT' },

      // Warm pool — background inference, near-real-time
      { name: 'openai-embeddings',  tier: 'WARM' },
      { name: 'openai-chat',        tier: 'WARM' },
      { name: 'anthropic-claude',   tier: 'WARM' },
      { name: 'sacred-geometry',    tier: 'WARM' },
      { name: 'saga-orchestrator',  tier: 'WARM' },

      // Cold pool — batch, pipeline, async tasks
      { name: 'event-store',        tier: 'COLD' },
      { name: 'cqrs-bus',           tier: 'COLD' },
      { name: 'object-storage',     tier: 'COLD' },
      { name: 'email-service',      tier: 'COLD' },

      // Reserve pool — burst capacity, auxiliary
      { name: 'redis-cache',        tier: 'RESERVE' },
      { name: 'postgres-primary',   tier: 'RESERVE' },

      // Governance — always-on control plane
      { name: 'auth-service',       tier: 'GOVERNANCE' },
      { name: 'health-monitor',     tier: 'GOVERNANCE' },
    ];

    for (const cfg of swarms) {
      this.register({ ...this._defaults, ...cfg });
    }

    // Register default groups
    this.registerGroup({
      name: 'ai-inference',
      members: ['openai-embeddings', 'openai-chat', 'anthropic-claude'],
    });
    this.registerGroup({
      name: 'data-layer',
      members: ['vector-store', 'redis-cache', 'postgres-primary', 'object-storage'],
    });
    this.registerGroup({
      name: 'cognitive-core',
      members: ['memory-engine', 'csl-engine', 'sacred-geometry', 'phi-router'],
    });
  }

  // ── Registration ──────────────────────────────────────────────────────────

  /**
   * Registers a new bulkhead or replaces an existing one by name.
   *
   * @param {BulkheadConfig} config - Bulkhead configuration
   * @returns {Bulkhead} The registered Bulkhead instance
   * @throws {TypeError} If config.name is invalid
   */
  register(config) {
    const bulkhead = new Bulkhead(
      { telemetry: this._telemetry, ...config },
      this,
    );
    this._bulkheads.set(bulkhead.name, bulkhead);
    return bulkhead;
  }

  /**
   * Registers a bulkhead group.
   *
   * @param {GroupConfig} config - Group configuration
   * @returns {BulkheadGroup} The registered group
   */
  registerGroup(config) {
    const group = new BulkheadGroup(config);
    this._groups.set(group.name, group);
    return group;
  }

  /**
   * Retrieves a registered bulkhead by name.
   *
   * @param {string} name - Bulkhead name
   * @returns {Bulkhead} The bulkhead instance
   * @throws {RangeError} If no bulkhead is registered under that name
   */
  get(name) {
    const bh = this._bulkheads.get(name);
    if (!bh) {
      throw new RangeError(
        `BulkheadRegistry: no bulkhead for "${name}". ` +
        `Registered: [${Array.from(this._bulkheads.keys()).join(', ')}]`,
      );
    }
    return bh;
  }

  /**
   * Returns true if a bulkhead with the given name is registered.
   *
   * @param {string} name - Bulkhead name
   * @returns {boolean}
   */
  has(name) {
    return this._bulkheads.has(name);
  }

  // ── Execution API ─────────────────────────────────────────────────────────

  /**
   * Executes a task through the named bulkhead.
   * Auto-registers a COLD-tier bulkhead if the name is unknown.
   *
   * @param {string}   name    - Bulkhead name
   * @param {Function} task    - Async function to execute: () => Promise<*>
   * @param {Object}   [opts]  - Options forwarded to Bulkhead#execute
   * @returns {Promise<*>} Task result
   * @throws {BulkheadFullError|BulkheadQueueTimeoutError|BulkheadExecutionTimeoutError|Error}
   */
  async execute(name, task, opts = {}) {
    if (this._shuttingDown) {
      throw new Error(`BulkheadRegistry is shutting down; rejecting task for "${name}"`);
    }
    if (!this._bulkheads.has(name)) {
      this.register({ ...this._defaults, name, tier: 'COLD' });
    }
    return this._bulkheads.get(name).execute(task, opts);
  }

  // ── Pressure Management ───────────────────────────────────────────────────

  /**
   * Samples utilization across all bulkheads and applies adaptive sizing
   * to each compartment based on the registry-wide pressure level.
   *
   * @returns {void}
   */
  samplePressure() {
    if (this._shuttingDown) return;

    const all = Array.from(this._bulkheads.values());
    if (all.length === 0) return;

    const totalUtil = all.reduce((sum, b) => sum + b.utilizationRate, 0);
    const avgUtil = totalUtil / all.length;
    const level = getPressureLevel(avgUtil);

    for (const bulkhead of all) {
      bulkhead.applyPressure(level);
    }
  }

  /**
   * Applies a specific pressure level to a single named bulkhead.
   *
   * @param {string} name    - Bulkhead name
   * @param {'NOMINAL'|'ELEVATED'|'HIGH'|'CRITICAL'} level - Pressure level to apply
   * @returns {void}
   * @throws {RangeError} If the bulkhead is not registered
   */
  applyPressure(name, level) {
    this.get(name).applyPressure(level);
  }

  // ── Metrics & Observability ───────────────────────────────────────────────

  /**
   * Returns metrics for a single named bulkhead.
   *
   * @param {string} name - Bulkhead name
   * @returns {BulkheadMetrics}
   * @throws {RangeError} If the bulkhead is not registered
   */
  getMetrics(name) {
    return this.get(name).getMetrics();
  }

  /**
   * Returns metrics for all registered bulkheads, sorted by name.
   *
   * @returns {BulkheadMetrics[]}
   */
  getAllMetrics() {
    return Array.from(this._bulkheads.values())
      .map(b => b.getMetrics())
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Returns a registry-level summary snapshot.
   *
   * @returns {{ total: number, activeTasks: number, queuedTasks: number, rejectedTasks: number, criticalCount: number }}
   */
  getSummary() {
    let activeTasks = 0, queuedTasks = 0, rejectedTasks = 0, criticalCount = 0;

    for (const b of this._bulkheads.values()) {
      activeTasks  += b.activeTasks;
      queuedTasks  += b.queuedTasks;
      const m = b.getMetrics();
      rejectedTasks += m.rejectedTasks;
      if (m.pressureLevel === 'CRITICAL') criticalCount++;
    }

    return { total: this._bulkheads.size, activeTasks, queuedTasks, rejectedTasks, criticalCount };
  }

  /**
   * Returns group utilization for a named group.
   *
   * @param {string} groupName - Group name
   * @returns {{ name: string, aggregateUtilization: number, overCeiling: boolean, members: string[] }}
   * @throws {RangeError} If the group is not registered
   */
  getGroupStatus(groupName) {
    const group = this._groups.get(groupName);
    if (!group) {
      throw new RangeError(`BulkheadRegistry: no group named "${groupName}"`);
    }
    return {
      name:                 group.name,
      aggregateUtilization: parseFloat(group.aggregateUtilization(this._bulkheads).toFixed(6)),
      overCeiling:          group.isOverCeiling(this._bulkheads),
      members:              group.getMembers(),
    };
  }

  // ── Graceful Shutdown ─────────────────────────────────────────────────────

  /**
   * Initiates graceful shutdown: stops the pressure timer, drains all queues,
   * and waits up to SHUTDOWN_DRAIN_TIMEOUT_MS for active tasks to complete.
   *
   * @returns {Promise<void>} Resolves when all queues are drained
   */
  async shutdown() {
    if (this._shuttingDown) return;
    this._shuttingDown = true;

    if (this._pressureTimer) {
      clearInterval(this._pressureTimer);
      this._pressureTimer = null;
    }

    // Apply CRITICAL pressure everywhere to shed new load
    for (const b of this._bulkheads.values()) {
      b.applyPressure('CRITICAL');
      b.drain();
    }

    // Wait for active tasks to finish, up to the marathon timeout
    const deadline = Date.now() + SHUTDOWN_DRAIN_TIMEOUT_MS;
    await new Promise((resolve) => {
      const poll = () => {
        const { activeTasks } = this.getSummary();
        if (activeTasks === 0 || Date.now() >= deadline) {
          resolve();
          return;
        }
        setTimeout(poll, phiBackoff(0, fib(5)));
      };
      poll();
    });

    this._bulkheads.clear();
    this._groups.clear();
    this.removeAllListeners();
  }

  // ── Internal Helpers ──────────────────────────────────────────────────────

  /**
   * Starts the periodic pressure sampling timer.
   *
   * @param {number} intervalMs - Sampling interval in milliseconds
   * @returns {void}
   * @private
   */
  _startPressureTimer(intervalMs) {
    if (this._pressureTimer) return;
    this._pressureTimer = setInterval(() => {
      this.samplePressure();
    }, intervalMs);
    if (this._pressureTimer.unref) this._pressureTimer.unref();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  Bulkhead,
  BulkheadRegistry,
  BulkheadGroup,
  PhiPriorityQueue,

  // Custom errors
  BulkheadFullError,
  BulkheadQueueTimeoutError,
  BulkheadExecutionTimeoutError,

  // Phi-derived constants (exposed for introspection / testing)
  DEFAULT_MAX_CONCURRENT,
  DEFAULT_QUEUE_DEPTH,
  DEFAULT_QUEUE_TIMEOUT_MS,
  DEFAULT_EXECUTION_TIMEOUT_MS,
  SHUTDOWN_DRAIN_TIMEOUT_MS,
  EMERGENCY_MIN_CONCURRENT,
  METRICS_HISTORY_SIZE,
  PRESSURE_SAMPLE_INTERVAL_MS,
  TIER_MAX_CONCURRENT,
  PRIORITY_WEIGHTS,
};
