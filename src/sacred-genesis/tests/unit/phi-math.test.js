/**
 * Unit Tests — Phi-Math Foundation
 * @author Eric Haywood, HeadySystems Inc.
 */

'use strict';

const assert = require('assert');
const path = require('path');

const PHI = 1.6180339887498948;
const PSI = 1 / PHI;
const EPSILON = 1e-10;

/**
 * Helper: Fibonacci number
 * @param {number} n
 * @returns {number}
 */
function fib(n) {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

/**
 * Helper: phiThreshold
 * @param {number} level
 * @param {number} spread
 * @returns {number}
 */
function phiThreshold(level, spread = 0.5) {
  return 1 - Math.pow(PSI, level) * spread;
}

/**
 * Helper: phiBackoff
 * @param {number} attempt
 * @param {number} baseMs
 * @param {number} maxMs
 * @returns {number}
 */
function phiBackoff(attempt, baseMs = 1000, maxMs = 60000) {
  return Math.min(baseMs * Math.pow(PHI, attempt), maxMs);
}

module.exports = {
  'phi constant is correct': () => {
    assert.strictEqual(PHI, 1.6180339887498948);
  },

  'psi is reciprocal of phi': () => {
    assert(Math.abs(PSI - (PHI - 1)) < EPSILON);
    assert(Math.abs(PSI - (1 / PHI)) < EPSILON);
  },

  'phi squared equals phi plus one': () => {
    assert(Math.abs(PHI * PHI - (PHI + 1)) < EPSILON);
  },

  'fibonacci sequence is correct': () => {
    assert.strictEqual(fib(0), 0);
    assert.strictEqual(fib(1), 1);
    assert.strictEqual(fib(5), 5);
    assert.strictEqual(fib(6), 8);
    assert.strictEqual(fib(7), 13);
    assert.strictEqual(fib(8), 21);
    assert.strictEqual(fib(9), 34);
    assert.strictEqual(fib(10), 55);
    assert.strictEqual(fib(11), 89);
    assert.strictEqual(fib(12), 144);
    assert.strictEqual(fib(16), 987);
    assert.strictEqual(fib(20), 6765);
  },

  'fibonacci ratio converges to phi': () => {
    const ratio = fib(20) / fib(19);
    assert(Math.abs(ratio - PHI) < 0.0001);
  },

  'phiThreshold levels are correct': () => {
    const t0 = phiThreshold(0);
    const t1 = phiThreshold(1);
    const t2 = phiThreshold(2);
    const t3 = phiThreshold(3);
    const t4 = phiThreshold(4);

    assert(Math.abs(t0 - 0.5) < 0.01, `MINIMUM: ${t0}`);
    assert(Math.abs(t1 - 0.691) < 0.01, `LOW: ${t1}`);
    assert(Math.abs(t2 - 0.809) < 0.01, `MEDIUM: ${t2}`);
    assert(Math.abs(t3 - 0.882) < 0.01, `HIGH: ${t3}`);
    assert(Math.abs(t4 - 0.927) < 0.01, `CRITICAL: ${t4}`);
  },

  'phiThreshold levels are monotonically increasing': () => {
    for (let i = 0; i < 4; i++) {
      assert(phiThreshold(i) < phiThreshold(i + 1));
    }
  },

  'phiThreshold levels are bounded 0 to 1': () => {
    for (let i = 0; i < 10; i++) {
      const t = phiThreshold(i);
      assert(t >= 0 && t <= 1, `Level ${i}: ${t}`);
    }
  },

  'phiBackoff increases monotonically': () => {
    let prev = 0;
    for (let i = 0; i < 6; i++) {
      const delay = phiBackoff(i);
      assert(delay > prev, `Attempt ${i}: ${delay} <= ${prev}`);
      prev = delay;
    }
  },

  'phiBackoff respects maximum': () => {
    const maxMs = 60000;
    const delay = phiBackoff(100, 1000, maxMs);
    assert(delay <= maxMs);
  },

  'phiBackoff attempt 0 equals base': () => {
    assert.strictEqual(phiBackoff(0, 1000), 1000);
  },

  'phiBackoff attempt 3 equals phi cubed times base': () => {
    const expected = 1000 * PHI * PHI * PHI;
    assert(Math.abs(phiBackoff(3) - expected) < 1);
  },

  'resource allocation sums to approximately 1': () => {
    const weights = [0.34, 0.21, 0.13, 0.08, 0.05];
    const sum = weights.reduce((a, b) => a + b, 0);
    assert(Math.abs(sum - 0.81) < 0.01, `Sum: ${sum}`);
  },

  'pool ratios follow fibonacci pattern': () => {
    const pools = [34, 21, 13, 8, 5];
    for (let i = 0; i < pools.length - 2; i++) {
      assert.strictEqual(pools[i], pools[i + 1] + pools[i + 2]);
    }
  }
};
