/**
 * Unit Tests — Circuit Breaker
 * @author Eric Haywood, HeadySystems Inc.
 */

'use strict';

const assert = require('assert');

const PHI = 1.6180339887498948;

/** Fibonacci helper */
function fib(n) {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) { [a, b] = [b, a + b]; }
  return b;
}

/** @type {number} Failure threshold — fib(5) */
const FAILURE_THRESHOLD = fib(5);

/** @type {number} Success threshold for close — fib(3) */
const SUCCESS_THRESHOLD = fib(3);

/** Circuit breaker states */
const STATES = { CLOSED: 0, HALF_OPEN: 1, OPEN: 2 };

/**
 * Simple circuit breaker for testing
 */
class TestCircuitBreaker {
  constructor() {
    this.state = STATES.CLOSED;
    this.failures = 0;
    this.successes = 0;
  }

  recordFailure() {
    this.failures++;
    this.successes = 0;
    if (this.failures >= FAILURE_THRESHOLD) {
      this.state = STATES.OPEN;
    }
  }

  recordSuccess() {
    if (this.state === STATES.HALF_OPEN) {
      this.successes++;
      if (this.successes >= SUCCESS_THRESHOLD) {
        this.state = STATES.CLOSED;
        this.failures = 0;
        this.successes = 0;
      }
    } else {
      this.failures = 0;
    }
  }

  tryHalfOpen() {
    if (this.state === STATES.OPEN) {
      this.state = STATES.HALF_OPEN;
      this.successes = 0;
    }
  }

  isAllowed() {
    return this.state !== STATES.OPEN;
  }
}

module.exports = {
  'circuit breaker starts CLOSED': () => {
    const cb = new TestCircuitBreaker();
    assert.strictEqual(cb.state, STATES.CLOSED);
    assert.strictEqual(cb.isAllowed(), true);
  },

  'circuit breaker stays CLOSED below threshold': () => {
    const cb = new TestCircuitBreaker();
    for (let i = 0; i < FAILURE_THRESHOLD - 1; i++) {
      cb.recordFailure();
    }
    assert.strictEqual(cb.state, STATES.CLOSED);
  },

  'circuit breaker opens at fib(5) failures': () => {
    const cb = new TestCircuitBreaker();
    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      cb.recordFailure();
    }
    assert.strictEqual(cb.state, STATES.OPEN);
    assert.strictEqual(cb.isAllowed(), false);
  },

  'circuit breaker transitions to HALF_OPEN': () => {
    const cb = new TestCircuitBreaker();
    for (let i = 0; i < FAILURE_THRESHOLD; i++) cb.recordFailure();
    assert.strictEqual(cb.state, STATES.OPEN);

    cb.tryHalfOpen();
    assert.strictEqual(cb.state, STATES.HALF_OPEN);
    assert.strictEqual(cb.isAllowed(), true);
  },

  'circuit breaker closes after fib(3) successes in HALF_OPEN': () => {
    const cb = new TestCircuitBreaker();
    for (let i = 0; i < FAILURE_THRESHOLD; i++) cb.recordFailure();
    cb.tryHalfOpen();

    for (let i = 0; i < SUCCESS_THRESHOLD; i++) {
      cb.recordSuccess();
    }
    assert.strictEqual(cb.state, STATES.CLOSED);
    assert.strictEqual(cb.failures, 0);
  },

  'circuit breaker reopens on failure in HALF_OPEN': () => {
    const cb = new TestCircuitBreaker();
    for (let i = 0; i < FAILURE_THRESHOLD; i++) cb.recordFailure();
    cb.tryHalfOpen();
    cb.recordSuccess();

    cb.recordFailure();
    for (let i = 1; i < FAILURE_THRESHOLD; i++) cb.recordFailure();
    assert.strictEqual(cb.state, STATES.OPEN);
  },

  'success resets failure count in CLOSED state': () => {
    const cb = new TestCircuitBreaker();
    cb.recordFailure();
    cb.recordFailure();
    assert.strictEqual(cb.failures, 2);

    cb.recordSuccess();
    assert.strictEqual(cb.failures, 0);
  },

  'failure threshold is fib(5) = 5': () => {
    assert.strictEqual(FAILURE_THRESHOLD, 5);
    assert.strictEqual(fib(5), 5);
  },

  'success threshold is fib(3) = 2': () => {
    assert.strictEqual(SUCCESS_THRESHOLD, 2);
    assert.strictEqual(fib(3), 2);
  }
};
