/**
 * Heady™ Circuit Breaker
 * φ-scaled circuit breaker for upstream service calls
 * States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing) → CLOSED
 */
'use strict';

const { FIB, PHI } = require('../config/phi-constants');

class CircuitBreaker {
  constructor(name = 'default') {
    this.name = name;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;

    // φ-scaled thresholds
    // failureThreshold = FIB[5] = 8 errors to open
    this.failureThreshold = FIB[5]; // 8
    // resetTimeout = PHI * 21 seconds ≈ 33.978s
    this.resetTimeout = Math.round(PHI * 21 * 1000); // ms
    // successThreshold for HALF_OPEN -> CLOSED
    this.successThreshold = 2;
  }

  /**
   * Get current state
   */
  getState() {
    return {
      state: this.state,
      name: this.name,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   * @param {Function} fn — async function to execute
   * @returns {Promise} result or throws error
   */
  async fire(fn) {
    if (this.state === 'OPEN') {
      // Check if reset timeout has passed
      if (Date.now() >= this.nextAttemptTime) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        const err = new Error(`Circuit breaker ${this.name} is OPEN`);
        err.code = 'CIRCUIT_OPEN';
        throw err;
      }
    }

    try {
      const result = await fn();

      // Success: update state
      if (this.state === 'HALF_OPEN') {
        this.successCount++;
        if (this.successCount >= this.successThreshold) {
          this._close();
        }
      } else if (this.state === 'CLOSED') {
        this.failureCount = Math.max(0, this.failureCount - 1);
      }

      return result;
    } catch (err) {
      this._recordFailure();
      throw err;
    }
  }

  /**
   * Record a failure and potentially open the circuit
   */
  _recordFailure() {
    this.lastFailureTime = Date.now();
    this.failureCount++;

    if (this.failureCount >= this.failureThreshold) {
      this._open();
    }
  }

  /**
   * Transition to OPEN state
   */
  _open() {
    if (this.state !== 'OPEN') {
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.resetTimeout;
    }
  }

  /**
   * Transition to CLOSED state
   */
  _close() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  /**
   * Manually reset the circuit breaker
   */
  reset() {
    this._close();
  }
}

module.exports = { CircuitBreaker };
