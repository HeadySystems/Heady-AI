/**
 * base-bee.js — BaseHeadyBee class.
 *
 * Standard lifecycle interface for all bee types:
 *   spawn() -> execute(task) -> report() -> retire()
 *
 * Circuit breaker integration, LIFO cleanup stack, health reporting.
 * All constants phi-scaled and Fibonacci-derived.
 */

import { randomUUID } from 'crypto';
import { PHI, PSI, FIB, EMBEDDING_DIM } from './constants.js';
import { CircuitBreaker } from './resilience-layer.js';
import { randomUnitVector } from './vector-space-ops.js';

const STATES = Object.freeze({
  IDLE: 'IDLE',
  SPAWNING: 'SPAWNING',
  READY: 'READY',
  EXECUTING: 'EXECUTING',
  RETIRING: 'RETIRING',
  RETIRED: 'RETIRED',
  ERROR: 'ERROR',
});

/**
 * BaseHeadyBee — Abstract base class for all Heady bees.
 * Provides lifecycle management, circuit breaker protection,
 * capability vectors, health, and LIFO cleanup.
 */
export class BaseHeadyBee {
  /**
   * @param {object} [opts={}]
   * @param {string} [opts.id]
   * @param {string} [opts.type='generic']
   * @param {string[]} [opts.capabilities=[]]
   * @param {Float64Array} [opts.capabilityVector]
   * @param {import('./telemetry-bus.js').TelemetryBus} [opts.telemetry]
   */
  constructor(opts = {}) {
    this.id = opts.id || randomUUID();
    this.type = opts.type || 'generic';
    this.capabilities = opts.capabilities || [];
    this.capabilityVector = opts.capabilityVector || randomUnitVector(EMBEDDING_DIM);
    this.telemetry = opts.telemetry || null;

    this.state = STATES.IDLE;
    this.spawnedAt = 0;
    this.retiredAt = 0;
    this.taskCount = 0;
    this.failCount = 0;
    this.totalDurationMs = 0;

    this._breaker = new CircuitBreaker({ name: `bee-${this.id.slice(0, 8)}` });
    this._cleanupStack = []; // LIFO
    this._lastHealthCheck = 0;
    this._healthy = true;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async spawn() {
    if (this.state !== STATES.IDLE) {
      throw new Error(`Cannot spawn bee in state ${this.state}`);
    }
    this.state = STATES.SPAWNING;
    try {
      await this._onSpawn();
      this.spawnedAt = Date.now();
      this.state = STATES.READY;
      if (this.telemetry) {
        this.telemetry.info('bee.spawned', { beeId: this.id, type: this.type });
      }
    } catch (err) {
      this.state = STATES.ERROR;
      throw err;
    }
  }

  /**
   * Execute a task through the circuit breaker.
   * @param {object} task
   * @returns {Promise<{ success: boolean, result: *, durationMs: number }>}
   */
  async execute(task) {
    if (this.state !== STATES.READY) {
      return { success: false, result: { error: `Bee not ready (state: ${this.state})` }, durationMs: 0 };
    }

    this.state = STATES.EXECUTING;
    const start = Date.now();

    try {
      const result = await this._breaker.execute(() => this._onExecute(task));
      const durationMs = Date.now() - start;
      this.taskCount++;
      this.totalDurationMs += durationMs;
      this.state = STATES.READY;

      if (this.telemetry) {
        this.telemetry.recordMetric('bee.taskDurationMs', durationMs);
      }

      return { success: true, result, durationMs };
    } catch (err) {
      const durationMs = Date.now() - start;
      this.failCount++;
      this.state = STATES.READY; // recover to ready unless breaker open
      if (this._breaker.state === 'OPEN') this.state = STATES.ERROR;

      if (this.telemetry) {
        this.telemetry.warn('bee.taskFailed', { beeId: this.id, error: err.message });
      }

      return { success: false, result: { error: err.message }, durationMs };
    }
  }

  /**
   * Generate a health report.
   * @returns {object}
   */
  report() {
    this._lastHealthCheck = Date.now();
    const avgMs = this.taskCount > 0 ? Math.round(this.totalDurationMs / this.taskCount) : 0;
    const failRate = this.taskCount > 0 ? this.failCount / (this.taskCount + this.failCount) : 0;
    this._healthy = failRate < PSI && this._breaker.state !== 'OPEN';

    return {
      id: this.id,
      type: this.type,
      state: this.state,
      healthy: this._healthy,
      taskCount: this.taskCount,
      failCount: this.failCount,
      failRate: Math.round(failRate * 1000) / 1000,
      avgDurationMs: avgMs,
      breaker: this._breaker.getStatus(),
      uptime: this.spawnedAt > 0 ? Date.now() - this.spawnedAt : 0,
    };
  }

  /**
   * Retire this bee — runs LIFO cleanup stack.
   */
  async retire() {
    if (this.state === STATES.RETIRED || this.state === STATES.RETIRING) return;
    this.state = STATES.RETIRING;

    // Run cleanup in LIFO order
    while (this._cleanupStack.length > 0) {
      const cleanup = this._cleanupStack.pop();
      try {
        await cleanup();
      } catch (err) {
        if (this.telemetry) {
          this.telemetry.warn('bee.cleanupError', { beeId: this.id, error: err.message });
        }
      }
    }

    await this._onRetire();
    this.retiredAt = Date.now();
    this.state = STATES.RETIRED;

    if (this.telemetry) {
      this.telemetry.info('bee.retired', { beeId: this.id, type: this.type, taskCount: this.taskCount });
    }
  }

  // -------------------------------------------------------------------------
  // LIFO cleanup stack
  // -------------------------------------------------------------------------

  /**
   * Register a cleanup function (runs LIFO on retire).
   * @param {() => Promise<void>|void} fn
   */
  onCleanup(fn) {
    this._cleanupStack.push(fn);
  }

  // -------------------------------------------------------------------------
  // Overridable hooks
  // -------------------------------------------------------------------------

  async _onSpawn() {}
  async _onExecute(task) {
    if (typeof task.executor === 'function') return await task.executor(task);
    return { processed: true, taskId: task.id };
  }
  async _onRetire() {}
}

export { STATES };
