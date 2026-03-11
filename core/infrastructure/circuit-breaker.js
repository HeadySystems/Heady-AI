/**
 * Heady™ Circuit Breaker — Unified Resilience Pattern
 * ════════════════════════════════════════════════════
 *
 * Consolidates:
 *   - src/services/pipeline-infra.js (CircuitBreaker)
 *   - services/heady-mcp-server/src/middleware/circuit-breaker.js
 *   - resilience/circuit-breaker.js
 *
 * States: CLOSED → OPEN → HALF_OPEN → CLOSED
 * All thresholds φ-derived.
 *
 * @module core/infrastructure/circuit-breaker
 */
'use strict';

const { PHI, PSI, fib, TIMING, CSL } = require('../constants/phi');

const STATES = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };

class CircuitBreaker {
  /**
   * @param {string} name - Service/circuit name
   * @param {object} [opts]
   * @param {number} [opts.failureThreshold] - Failures before opening (default: fib(5)=5)
   * @param {number} [opts.resetTimeoutMs]   - Time in OPEN before trying HALF_OPEN (default: TIMING.IDLE)
   * @param {number} [opts.halfOpenMax]      - Max requests in HALF_OPEN (default: fib(3)=2)
   * @param {number} [opts.successThreshold] - Successes in HALF_OPEN to close (default: fib(3)=2)
   */
  constructor(name, opts = {}) {
    this.name = name;
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.halfOpenAttempts = 0;

    this.failureThreshold  = opts.failureThreshold  ?? fib(5);      // 5
    this.resetTimeoutMs    = opts.resetTimeoutMs    ?? TIMING.IDLE;  // ~12,944ms
    this.halfOpenMax       = opts.halfOpenMax       ?? fib(3);       // 2
    this.successThreshold  = opts.successThreshold  ?? fib(3);       // 2

    // Metrics
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
    this.stateChanges = [];
  }

  /** Check if request is allowed */
  canRequest() {
    switch (this.state) {
      case STATES.CLOSED:
        return true;
      case STATES.OPEN:
        if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
          this._transition(STATES.HALF_OPEN);
          return true;
        }
        return false;
      case STATES.HALF_OPEN:
        return this.halfOpenAttempts < this.halfOpenMax;
      default:
        return false;
    }
  }

  /** Record a successful request */
  recordSuccess() {
    this.totalRequests++;
    this.totalSuccesses++;

    switch (this.state) {
      case STATES.HALF_OPEN:
        this.successCount++;
        if (this.successCount >= this.successThreshold) {
          this._transition(STATES.CLOSED);
        }
        break;
      case STATES.CLOSED:
        // Reset failure count on success
        this.failureCount = Math.max(0, this.failureCount - 1);
        break;
    }
  }

  /** Record a failed request */
  recordFailure() {
    this.totalRequests++;
    this.totalFailures++;
    this.lastFailureTime = Date.now();

    switch (this.state) {
      case STATES.CLOSED:
        this.failureCount++;
        if (this.failureCount >= this.failureThreshold) {
          this._transition(STATES.OPEN);
        }
        break;
      case STATES.HALF_OPEN:
        this._transition(STATES.OPEN);
        break;
    }
  }

  /** Execute a function through the circuit breaker */
  async execute(fn) {
    if (!this.canRequest()) {
      const err = new Error(`Circuit ${this.name} is ${this.state}`);
      err.circuitOpen = true;
      throw err;
    }

    if (this.state === STATES.HALF_OPEN) {
      this.halfOpenAttempts++;
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      throw err;
    }
  }

  /** Force reset to CLOSED */
  reset() {
    this._transition(STATES.CLOSED);
  }

  /** Get health score (0-1) */
  healthScore() {
    if (this.totalRequests === 0) return 1;
    return this.totalSuccesses / this.totalRequests;
  }

  /** Get current status */
  status() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      healthScore: this.healthScore(),
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      recentChanges: this.stateChanges.slice(-5),
    };
  }

  _transition(newState) {
    const oldState = this.state;
    this.state = newState;
    this.stateChanges.push({ from: oldState, to: newState, at: Date.now() });

    if (newState === STATES.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
      this.halfOpenAttempts = 0;
    } else if (newState === STATES.HALF_OPEN) {
      this.successCount = 0;
      this.halfOpenAttempts = 0;
    }
  }
}

/** Manage a pool of circuit breakers by name */
class CircuitBreakerPool {
  constructor(defaultOpts = {}) {
    this._breakers = new Map();
    this._defaultOpts = defaultOpts;
  }

  get(name) {
    if (!this._breakers.has(name)) {
      this._breakers.set(name, new CircuitBreaker(name, this._defaultOpts));
    }
    return this._breakers.get(name);
  }

  healthReport() {
    const report = {};
    for (const [name, cb] of this._breakers) {
      report[name] = cb.status();
    }
    return report;
  }

  resetAll() {
    for (const cb of this._breakers.values()) cb.reset();
  }
}

module.exports = { CircuitBreaker, CircuitBreakerPool, STATES };
