/**
 * phi-math constants — comprehensive test coverage
 * Validates all exported constants, CSL gates, circuit breaker thresholds,
 * timeout values, utility functions, and derived configurations.
 *
 * Run: node --test packages/phi-math/test/phi-math-constants.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PHI,
  PSI,
  PSI2,
  FIB,
  CSL_GATES,
  PHI_TIMEOUT_CONNECT,
  PHI_TIMEOUT_REQUEST,
  PHI_CIRCUIT_BREAKER,
  PHI_BULKHEAD,
  PHI_RATE_LIMITS,
  PHI_CACHE_SIZES,
  PHI_RETRY,
  PHI_ROLLOUT,
  phiScale,
  fibNearest,
  cslGate,
  phiBackoff,
} = require('../index.js');

// ═══════════════════════════════════════════════════════════════════
// Core constants
// ═══════════════════════════════════════════════════════════════════

test('PHI equals the golden ratio to full precision', () => {
  assert.strictEqual(PHI, 1.618033988749895);
});

test('PSI equals the reciprocal of PHI', () => {
  assert.strictEqual(PSI, 1 / PHI);
  assert.ok(Math.abs(PSI - 0.6180339887498949) < 1e-15);
});

test('PSI2 equals PSI squared', () => {
  assert.strictEqual(PSI2, PSI * PSI);
  assert.ok(Math.abs(PSI2 - 0.3819660112501051) < 1e-15);
});

test('FIB contains the correct Fibonacci sequence (16 terms)', () => {
  const expected = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
  assert.deepStrictEqual(FIB, expected);
  assert.strictEqual(FIB.length, 16);
});

test('FIB satisfies F(n) = F(n-1) + F(n-2) for all consecutive terms', () => {
  for (let i = 2; i < FIB.length; i++) {
    assert.strictEqual(FIB[i], FIB[i - 1] + FIB[i - 2],
      `FIB[${i}] = ${FIB[i]} should equal FIB[${i - 1}] + FIB[${i - 2}] = ${FIB[i - 1] + FIB[i - 2]}`);
  }
});

// ═══════════════════════════════════════════════════════════════════
// CSL Gates
// ═══════════════════════════════════════════════════════════════════

test('CSL_GATES.include equals PSI2 (~0.382)', () => {
  assert.strictEqual(CSL_GATES.include, PSI2);
});

test('CSL_GATES.boost equals PSI (~0.618)', () => {
  assert.strictEqual(CSL_GATES.boost, PSI);
});

test('CSL_GATES.inject equals PSI + 0.1 (~0.718)', () => {
  assert.strictEqual(CSL_GATES.inject, PSI + 0.1);
});

test('CSL gates are ordered: include < boost < inject', () => {
  assert.ok(CSL_GATES.include < CSL_GATES.boost);
  assert.ok(CSL_GATES.boost < CSL_GATES.inject);
});

// ═══════════════════════════════════════════════════════════════════
// Timeout values
// ═══════════════════════════════════════════════════════════════════

test('PHI_TIMEOUT_CONNECT equals round(PHI * 1000) = 1618', () => {
  assert.strictEqual(PHI_TIMEOUT_CONNECT, Math.round(PHI * 1000));
  assert.strictEqual(PHI_TIMEOUT_CONNECT, 1618);
});

test('PHI_TIMEOUT_REQUEST equals round(PHI^3 * 1000) = 4236', () => {
  assert.strictEqual(PHI_TIMEOUT_REQUEST, Math.round(PHI * PHI * PHI * 1000));
  assert.strictEqual(PHI_TIMEOUT_REQUEST, 4236);
});

// ═══════════════════════════════════════════════════════════════════
// Circuit Breaker
// ═══════════════════════════════════════════════════════════════════

test('PHI_CIRCUIT_BREAKER threshold is FIB[10] = 89', () => {
  assert.strictEqual(PHI_CIRCUIT_BREAKER.threshold, 89);
  assert.strictEqual(PHI_CIRCUIT_BREAKER.threshold, FIB[10]);
});

test('PHI_CIRCUIT_BREAKER resetTimeout is FIB[9] * 1000 = 55000', () => {
  assert.strictEqual(PHI_CIRCUIT_BREAKER.resetTimeout, 55000);
  assert.strictEqual(PHI_CIRCUIT_BREAKER.resetTimeout, FIB[9] * 1000);
});

test('PHI_CIRCUIT_BREAKER halfOpenMax is FIB[8] = 34', () => {
  assert.strictEqual(PHI_CIRCUIT_BREAKER.halfOpenMax, 34);
  assert.strictEqual(PHI_CIRCUIT_BREAKER.halfOpenMax, FIB[8]);
});

// ═══════════════════════════════════════════════════════════════════
// Bulkhead
// ═══════════════════════════════════════════════════════════════════

test('PHI_BULKHEAD concurrent is FIB[8] = 34', () => {
  assert.strictEqual(PHI_BULKHEAD.concurrent, 34);
});

test('PHI_BULKHEAD queued is FIB[9] = 55', () => {
  assert.strictEqual(PHI_BULKHEAD.queued, 55);
});

// ═══════════════════════════════════════════════════════════════════
// Rate Limits
// ═══════════════════════════════════════════════════════════════════

test('PHI_RATE_LIMITS tiers use correct Fibonacci values', () => {
  assert.strictEqual(PHI_RATE_LIMITS.anonymous, 34);       // FIB[8]
  assert.strictEqual(PHI_RATE_LIMITS.authenticated, 89);   // FIB[10]
  assert.strictEqual(PHI_RATE_LIMITS.enterprise, 233);     // FIB[12]
});

test('Rate limits are strictly increasing', () => {
  assert.ok(PHI_RATE_LIMITS.anonymous < PHI_RATE_LIMITS.authenticated);
  assert.ok(PHI_RATE_LIMITS.authenticated < PHI_RATE_LIMITS.enterprise);
});

// ═══════════════════════════════════════════════════════════════════
// Cache Sizes
// ═══════════════════════════════════════════════════════════════════

test('PHI_CACHE_SIZES use correct Fibonacci values', () => {
  assert.strictEqual(PHI_CACHE_SIZES.small, 21);    // FIB[7]
  assert.strictEqual(PHI_CACHE_SIZES.medium, 55);   // FIB[9]
  assert.strictEqual(PHI_CACHE_SIZES.large, 144);   // FIB[11]
});

// ═══════════════════════════════════════════════════════════════════
// Retry config
// ═══════════════════════════════════════════════════════════════════

test('PHI_RETRY config values', () => {
  assert.strictEqual(PHI_RETRY.maxRetries, 4);
  assert.strictEqual(PHI_RETRY.baseDelay, 800);     // FIB[5] * 100 = 8 * 100
  assert.strictEqual(PHI_RETRY.multiplier, PHI);
});

// ═══════════════════════════════════════════════════════════════════
// Rollout stages
// ═══════════════════════════════════════════════════════════════════

test('PHI_ROLLOUT stages are correct', () => {
  assert.deepStrictEqual(PHI_ROLLOUT, [0.0618, 0.382, 0.618, 1.0]);
  assert.strictEqual(PHI_ROLLOUT[PHI_ROLLOUT.length - 1], 1.0);
});

test('PHI_ROLLOUT stages are monotonically increasing', () => {
  for (let i = 1; i < PHI_ROLLOUT.length; i++) {
    assert.ok(PHI_ROLLOUT[i] > PHI_ROLLOUT[i - 1]);
  }
});

// ═══════════════════════════════════════════════════════════════════
// Utility functions
// ═══════════════════════════════════════════════════════════════════

test('phiScale scales correctly', () => {
  assert.ok(Math.abs(phiScale(100, 0) - 100) < 0.001);
  assert.ok(Math.abs(phiScale(100, 1) - 161.8) < 0.1);
  assert.ok(Math.abs(phiScale(100, 2) - 261.8) < 0.1);
});

test('fibNearest returns closest Fibonacci number', () => {
  assert.strictEqual(fibNearest(7), 8);
  assert.strictEqual(fibNearest(50), 55);
  assert.strictEqual(fibNearest(100), 89);
  assert.strictEqual(fibNearest(1), 1);
  assert.strictEqual(fibNearest(987), 987);
});

test('cslGate returns correct boolean for gate checks', () => {
  // boost gate (PSI ~= 0.618)
  assert.strictEqual(cslGate(0.7, 'boost'), true);
  assert.strictEqual(cslGate(0.5, 'boost'), false);

  // include gate (PSI2 ~= 0.382)
  assert.strictEqual(cslGate(0.4, 'include'), true);
  assert.strictEqual(cslGate(0.3, 'include'), false);

  // inject gate (PSI + 0.1 ~= 0.718)
  assert.strictEqual(cslGate(0.8, 'inject'), true);
  assert.strictEqual(cslGate(0.7, 'inject'), false);

  // default gate is 'boost'
  assert.strictEqual(cslGate(0.7), true);
  assert.strictEqual(cslGate(0.5), false);
});

test('phiBackoff produces increasing delays capped at 30s', () => {
  const d0 = phiBackoff(0);
  const d1 = phiBackoff(1);
  const d2 = phiBackoff(2);

  assert.strictEqual(d0, 800);
  assert.ok(d1 > d0);
  assert.ok(d2 > d1);

  // Cap at 30000
  const dHigh = phiBackoff(100);
  assert.ok(dHigh <= 30000);
});

// ═══════════════════════════════════════════════════════════════════
// Module exports completeness
// ═══════════════════════════════════════════════════════════════════

test('all expected exports are present', () => {
  const mod = require('../index.js');
  const expectedExports = [
    'PHI', 'PSI', 'PSI2', 'FIB', 'CSL_GATES',
    'PHI_TIMEOUT_CONNECT', 'PHI_TIMEOUT_REQUEST',
    'PHI_CIRCUIT_BREAKER', 'PHI_BULKHEAD',
    'PHI_RATE_LIMITS', 'PHI_CACHE_SIZES',
    'PHI_RETRY', 'PHI_ROLLOUT',
    'phiScale', 'fibNearest', 'cslGate', 'phiBackoff',
  ];
  for (const name of expectedExports) {
    assert.ok(name in mod, `Missing export: ${name}`);
  }
});
