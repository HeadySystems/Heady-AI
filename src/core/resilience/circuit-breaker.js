/**
 * Heady Circuit Breaker — Per-Provider Fault Isolation
 *
 * States: CLOSED → OPEN → HALF_OPEN → CLOSED (or back to OPEN).
 * Uses phi-backoff for open-duration, Fibonacci failure thresholds,
 * and CSL-gated half-open probe scoring.
 *
 * @module core/resilience/circuit-breaker
 * @author Eric Haywood — HeadySystems Inc.
 * @license PROPRIETARY — 51+ Provisional Patents
 */

import { EventEmitter } from 'events';
import {
  PHI, PSI, FIB,
  phiBackoff,
  phiThreshold,
} from '../../packages/phi-math-foundation/src/index.js';
import { createLogger } from '../../packages/structured-logger/src/index.js';

const logger = createLogger('circuit-breaker');

/** Circuit breaker states */
export const CB_STATES = Object.freeze({
  CLOSED:    'closed',
  OPEN:      'open',
  HALF_OPEN: 'half_open',
});

/** Phi-derived configuration defaults */
const DEFAULTS = Object.freeze({
  failureThreshold:   FIB[5],              // 5 failures to trip
  successThreshold:   FIB[4],              // 3 successes in half-open to close
  halfOpenMaxProbes:  FIB[3],              // 2 concurrent probes in half-open
  openDurationMs:     FIB[8] * 1000,       // 21s initial open duration
  maxOpenDurationMs:  FIB[12] * 1000,      // 144s max open duration
  slidingWindowMs:    FIB[10] * 1000,      // 55s sliding window for failure tracking
  healthThreshold:    phiThreshold(2),      // ≈ 0.809 — minimum health to consider healthy
  volumeThreshold:    FIB[6],              // 8 requests minimum before evaluating
});

/**
 * CircuitBreaker — protects a single target (provider, service, endpoint).
 *
 * @fires CircuitBreaker#state:changed
 * @fires CircuitBreaker#request:success
 * @fires CircuitBreaker#request:failure
 * @fires CircuitBreaker#probe:result
 */
export class CircuitBreaker extends EventEmitter {
  constructor(targetId, options = {}) {
    super();

    this.targetId = targetId;
    this.config = { ...DEFAULTS, ...options };

    this.state = CB_STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenSuccesses = 0;
    this.halfOpenActiveProbes = 0;
    this.lastFailureAt = null;
    this.lastStateChangeAt = Date.now();
    this.openAttempt = 0;       // For phi-backoff escalation
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;

    /** Sliding window of request outcomes: { timestamp, success } */
    this.window = [];

    logger.info({
      targetId,
      config: this.config,
    }, 'Circuit breaker initialized');
  }

  /**
   * Execute a function through the circuit breaker.
   *
   * @param {Function} fn - Async function to execute
   * @param {object} [fallback] - Optional fallback when circuit is open
   * @returns {Promise<*>} Result of fn or fallback
   * @throws {Error} When circuit is open and no fallback provided
   */
  async execute(fn, fallback = null) {
    this._pruneWindow();
    this.totalRequests++;

    switch (this.state) {
      case CB_STATES.CLOSED:
        return this._executeClosed(fn);

      case CB_STATES.OPEN:
        return this._executeOpen(fn, fallback);

      case CB_STATES.HALF_OPEN:
        return this._executeHalfOpen(fn, fallback);

      default:
        return this._executeClosed(fn);
    }
  }

  /**
   * Get current health score for this circuit.
   * @returns {number} Health score 0–1
   */
  getHealthScore() {
    if (this.state === CB_STATES.OPEN) return 0;

    this._pruneWindow();
    const recentRequests = this.window.length;
    if (recentRequests < this.config.volumeThreshold) return 1; // Not enough data

    const recentSuccesses = this.window.filter(w => w.success).length;
    return recentRequests > 0 ? recentSuccesses / recentRequests : 1;
  }

  /**
   * Get circuit breaker status report.
   * @returns {object}
   */
  getStatus() {
    return {
      targetId: this.targetId,
      state: this.state,
      healthScore: this.getHealthScore(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      openAttempt: this.openAttempt,
      lastFailureAt: this.lastFailureAt,
      lastStateChangeAt: this.lastStateChangeAt,
      windowSize: this.window.length,
    };
  }

  /**
   * Force-reset the circuit breaker to closed state.
   */
  reset() {
    this._changeState(CB_STATES.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenSuccesses = 0;
    this.halfOpenActiveProbes = 0;
    this.openAttempt = 0;
    this.window = [];

    logger.info({ targetId: this.targetId }, 'Circuit breaker force-reset');
  }

  // --- Private Methods ---

  async _executeClosed(fn) {
    try {
      const result = await fn();
      this._recordSuccess();
      return result;
    } catch (error) {
      this._recordFailure(error);
      throw error;
    }
  }

  async _executeOpen(fn, fallback) {
    // Check if open duration has elapsed → transition to half-open
    const openDuration = phiBackoff(
      this.openAttempt,
      this.config.openDurationMs,
      this.config.maxOpenDurationMs
    );
    const elapsed = Date.now() - this.lastStateChangeAt;

    if (elapsed >= openDuration) {
      this._changeState(CB_STATES.HALF_OPEN);
      return this._executeHalfOpen(fn, fallback);
    }

    // Circuit is open — reject or use fallback
    if (fallback) {
      return typeof fallback === 'function' ? fallback() : fallback;
    }

    const error = new Error(`Circuit breaker OPEN for ${this.targetId}`);
    error.code = 'CIRCUIT_OPEN';
    error.targetId = this.targetId;
    error.retryAfterMs = openDuration - elapsed;
    throw error;
  }

  async _executeHalfOpen(fn, fallback) {
    // Limit concurrent probes in half-open
    if (this.halfOpenActiveProbes >= this.config.halfOpenMaxProbes) {
      if (fallback) {
        return typeof fallback === 'function' ? fallback() : fallback;
      }
      const error = new Error(`Circuit breaker HALF_OPEN probe limit for ${this.targetId}`);
      error.code = 'CIRCUIT_HALF_OPEN_FULL';
      throw error;
    }

    this.halfOpenActiveProbes++;
    try {
      const result = await fn();
      this.halfOpenActiveProbes--;
      this.halfOpenSuccesses++;

      this.emit('probe:result', {
        targetId: this.targetId,
        success: true,
        halfOpenSuccesses: this.halfOpenSuccesses,
        threshold: this.config.successThreshold,
      });

      // Enough successes → close circuit
      if (this.halfOpenSuccesses >= this.config.successThreshold) {
        this._changeState(CB_STATES.CLOSED);
        this.failureCount = 0;
        this.openAttempt = 0;
        this.halfOpenSuccesses = 0;
      }

      this._recordSuccess();
      return result;
    } catch (error) {
      this.halfOpenActiveProbes--;
      this.halfOpenSuccesses = 0;

      this.emit('probe:result', {
        targetId: this.targetId,
        success: false,
        error: error.message,
      });

      // Failed probe → back to open with escalated backoff
      this.openAttempt++;
      this._changeState(CB_STATES.OPEN);
      this._recordFailure(error);
      throw error;
    }
  }

  _recordSuccess() {
    this.successCount++;
    this.totalSuccesses++;
    this.window.push({ timestamp: Date.now(), success: true });

    if (this.state === CB_STATES.CLOSED) {
      // Reset failure count on success in closed state
      this.failureCount = Math.max(0, this.failureCount - 1);
    }

    this.emit('request:success', { targetId: this.targetId });
  }

  _recordFailure(error) {
    this.failureCount++;
    this.totalFailures++;
    this.lastFailureAt = Date.now();
    this.window.push({ timestamp: Date.now(), success: false });

    this.emit('request:failure', {
      targetId: this.targetId,
      error: error.message,
      failureCount: this.failureCount,
    });

    // Check if failure threshold breached → trip to OPEN
    if (this.state === CB_STATES.CLOSED && this.failureCount >= this.config.failureThreshold) {
      this._changeState(CB_STATES.OPEN);
    }
  }

  _changeState(newState) {
    const oldState = this.state;
    if (oldState === newState) return;

    this.state = newState;
    this.lastStateChangeAt = Date.now();

    if (newState === CB_STATES.HALF_OPEN) {
      this.halfOpenSuccesses = 0;
      this.halfOpenActiveProbes = 0;
    }

    this.emit('state:changed', {
      targetId: this.targetId,
      from: oldState,
      to: newState,
      openAttempt: this.openAttempt,
    });

    logger.info({
      targetId: this.targetId,
      from: oldState,
      to: newState,
      failureCount: this.failureCount,
      openAttempt: this.openAttempt,
    }, 'Circuit breaker state changed');
  }

  /** Prune sliding window entries older than the window duration */
  _pruneWindow() {
    const cutoff = Date.now() - this.config.slidingWindowMs;
    this.window = this.window.filter(w => w.timestamp > cutoff);
  }
}

/**
 * CircuitBreakerRegistry — manages circuit breakers for multiple targets.
 */
export class CircuitBreakerRegistry extends EventEmitter {
  constructor(defaults = {}) {
    super();
    /** @type {Map<string, CircuitBreaker>} */
    this.breakers = new Map();
    this.defaults = defaults;
  }

  /**
   * Get or create a circuit breaker for a target.
   * @param {string} targetId
   * @param {object} [options]
   * @returns {CircuitBreaker}
   */
  getBreaker(targetId, options = {}) {
    if (!this.breakers.has(targetId)) {
      const breaker = new CircuitBreaker(targetId, { ...this.defaults, ...options });

      // Bubble events
      breaker.on('state:changed', (data) => this.emit('state:changed', data));
      breaker.on('request:failure', (data) => this.emit('request:failure', data));

      this.breakers.set(targetId, breaker);
    }
    return this.breakers.get(targetId);
  }

  /**
   * Execute through a specific target's circuit breaker.
   * @param {string} targetId
   * @param {Function} fn
   * @param {*} [fallback]
   * @returns {Promise<*>}
   */
  async execute(targetId, fn, fallback) {
    return this.getBreaker(targetId).execute(fn, fallback);
  }

  /**
   * Get health report for all targets.
   * @returns {object[]}
   */
  getHealthReport() {
    const report = [];
    for (const [, breaker] of this.breakers) {
      report.push(breaker.getStatus());
    }
    return report;
  }

  /**
   * Get all targets currently in open state.
   * @returns {string[]}
   */
  getOpenCircuits() {
    const open = [];
    for (const [targetId, breaker] of this.breakers) {
      if (breaker.state === CB_STATES.OPEN) {
        open.push(targetId);
      }
    }
    return open;
  }

  /**
   * Reset all circuit breakers.
   */
  resetAll() {
    for (const [, breaker] of this.breakers) {
      breaker.reset();
    }
  }
}
