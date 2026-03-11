/**
 * Test suite for Heady φ-Scaled Constants
 * Validates all golden ratio derived constants and functions
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  PHI,
  PSI,
  PSI2,
  FIB,
  CSL,
  TIMEOUTS,
  RATE_LIMITS,
  phiRetryDelays,
  cslGate,
} = require('../config/phi-constants');

describe('phi-constants', () => {
  // ── PHI, PSI, PSI2 ──────────────────────────────────────────────────
  describe('PHI constant', () => {
    it('should equal approximately 1.618033988749895', () => {
      assert.strictEqual(PHI, 1.618033988749895, 'PHI should be the golden ratio');
    });

    it('should be greater than 1.6 and less than 1.7', () => {
      assert.ok(PHI > 1.6, 'PHI should be greater than 1.6');
      assert.ok(PHI < 1.7, 'PHI should be less than 1.7');
    });
  });

  describe('PSI constant', () => {
    it('should equal approximately 0.618033988749895', () => {
      assert.strictEqual(PSI, 0.618033988749895, 'PSI should be 1/PHI');
    });

    it('should be 1/PHI', () => {
      const calculated = 1 / PHI;
      assert.ok(
        Math.abs(PSI - calculated) < 1e-15,
        'PSI should approximately equal 1/PHI'
      );
    });

    it('should be between 0.6 and 0.7', () => {
      assert.ok(PSI > 0.6, 'PSI should be greater than 0.6');
      assert.ok(PSI < 0.7, 'PSI should be less than 0.7');
    });
  });

  describe('PSI2 constant', () => {
    it('should equal approximately 0.381966011250105', () => {
      assert.strictEqual(PSI2, 0.381966011250105, 'PSI2 should be 1 - PSI');
    });

    it('should equal 1 - PSI', () => {
      const calculated = 1 - PSI;
      assert.strictEqual(PSI2, calculated, 'PSI2 should equal 1 - PSI');
    });

    it('should equal PSI^2', () => {
      const calculated = PSI * PSI;
      assert.ok(
        Math.abs(PSI2 - calculated) < 1e-15,
        'PSI2 should approximately equal PSI * PSI'
      );
    });
  });

  describe('φ identity checks', () => {
    it('PSI * PHI should equal 1', () => {
      const result = PSI * PHI;
      assert.ok(
        Math.abs(result - 1) < 1e-15,
        'PSI * PHI should approximately equal 1'
      );
    });

    it('PSI + PSI2 should equal 1', () => {
      const result = PSI + PSI2;
      assert.ok(
        Math.abs(result - 1) < 1e-15,
        'PSI + PSI2 should approximately equal 1'
      );
    });

    it('PHI^2 - PHI - 1 should equal 0', () => {
      const result = PHI * PHI - PHI - 1;
      assert.ok(
        Math.abs(result) < 1e-15,
        'PHI^2 - PHI - 1 should approximately equal 0 (golden ratio property)'
      );
    });
  });

  // ── FIB (Fibonacci) ──────────────────────────────────────────────────
  describe('FIB sequence', () => {
    it('should be an array of numbers', () => {
      assert.ok(Array.isArray(FIB), 'FIB should be an array');
      assert.ok(FIB.every((n) => typeof n === 'number'), 'all FIB elements should be numbers');
    });

    it('should follow Fibonacci sequence (each = sum of previous two)', () => {
      for (let i = 2; i < FIB.length; i++) {
        assert.strictEqual(
          FIB[i],
          FIB[i - 1] + FIB[i - 2],
          `FIB[${i}] should equal FIB[${i - 1}] + FIB[${i - 2}]`
        );
      }
    });

    it('should start with [1, 1]', () => {
      assert.strictEqual(FIB[0], 1, 'first element should be 1');
      assert.strictEqual(FIB[1], 1, 'second element should be 1');
    });

    it('should have at least 16 elements', () => {
      assert.ok(FIB.length >= 16, 'FIB should have at least 16 elements');
    });

    it('should have expected values', () => {
      const expected = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
      for (let i = 0; i < expected.length && i < FIB.length; i++) {
        assert.strictEqual(FIB[i], expected[i], `FIB[${i}] should be ${expected[i]}`);
      }
    });
  });

  // ── CSL (Confidence Signal Logic) ────────────────────────────────────
  describe('CSL object', () => {
    it('should have all required properties', () => {
      assert.ok(typeof CSL.INCLUDE === 'number', 'CSL.INCLUDE should be a number');
      assert.ok(typeof CSL.BOOST === 'number', 'CSL.BOOST should be a number');
      assert.ok(typeof CSL.INJECT === 'number', 'CSL.INJECT should be a number');
      assert.ok(typeof CSL.SUPPRESS === 'number', 'CSL.SUPPRESS should be a number');
      assert.ok(typeof CSL.MEDIUM === 'number', 'CSL.MEDIUM should be a number');
    });

    it('should have CSL.INCLUDE < CSL.BOOST < CSL.INJECT', () => {
      assert.ok(CSL.INCLUDE < CSL.BOOST, 'INCLUDE should be less than BOOST');
      assert.ok(CSL.BOOST < CSL.INJECT, 'BOOST should be less than INJECT');
    });

    it('CSL.INCLUDE should equal PSI2', () => {
      assert.strictEqual(CSL.INCLUDE, PSI2, 'INCLUDE should equal PSI2');
    });

    it('CSL.BOOST should equal PSI', () => {
      assert.strictEqual(CSL.BOOST, PSI, 'BOOST should equal PSI');
    });

    it('should have reasonable threshold values', () => {
      assert.ok(CSL.SUPPRESS > 0, 'SUPPRESS should be positive');
      assert.ok(CSL.SUPPRESS < 0.3, 'SUPPRESS should be less than 0.3');
      assert.ok(CSL.INCLUDE > 0.3, 'INCLUDE should be greater than 0.3');
      assert.ok(CSL.INCLUDE < 0.5, 'INCLUDE should be less than 0.5');
      assert.ok(CSL.BOOST > 0.6, 'BOOST should be greater than 0.6');
      assert.ok(CSL.BOOST < 0.7, 'BOOST should be less than 0.7');
      assert.ok(CSL.INJECT > 0.7, 'INJECT should be greater than 0.7');
      assert.ok(CSL.INJECT < 0.8, 'INJECT should be less than 0.8');
    });
  });

  // ── TIMEOUTS ─────────────────────────────────────────────────────────
  describe('TIMEOUTS object', () => {
    it('should have all required properties', () => {
      assert.ok(typeof TIMEOUTS.CONNECT === 'number', 'TIMEOUTS.CONNECT should be a number');
      assert.ok(typeof TIMEOUTS.REQUEST === 'number', 'TIMEOUTS.REQUEST should be a number');
      assert.ok(typeof TIMEOUTS.IDLE === 'number', 'TIMEOUTS.IDLE should be a number');
      assert.ok(typeof TIMEOUTS.LONG === 'number', 'TIMEOUTS.LONG should be a number');
      assert.ok(typeof TIMEOUTS.MAX === 'number', 'TIMEOUTS.MAX should be a number');
    });

    it('should have values that increase monotonically', () => {
      assert.ok(
        TIMEOUTS.CONNECT < TIMEOUTS.REQUEST,
        'CONNECT should be less than REQUEST'
      );
      assert.ok(
        TIMEOUTS.REQUEST < TIMEOUTS.IDLE,
        'REQUEST should be less than IDLE'
      );
      assert.ok(
        TIMEOUTS.IDLE < TIMEOUTS.LONG,
        'IDLE should be less than LONG'
      );
      assert.ok(
        TIMEOUTS.LONG < TIMEOUTS.MAX,
        'LONG should be less than MAX'
      );
    });

    it('should use φ-scaled values', () => {
      // All timeouts should be φ-derived
      assert.ok(TIMEOUTS.CONNECT > 1, 'CONNECT should be > 1');
      assert.ok(TIMEOUTS.REQUEST > 3, 'REQUEST should be > 3');
      assert.ok(TIMEOUTS.IDLE > 12, 'IDLE should be > 12');
      assert.ok(TIMEOUTS.LONG > 30, 'LONG should be > 30');
      assert.ok(TIMEOUTS.MAX > 80, 'MAX should be > 80');
    });
  });

  // ── RATE_LIMITS ──────────────────────────────────────────────────────
  describe('RATE_LIMITS object', () => {
    it('should have all required properties', () => {
      assert.ok(typeof RATE_LIMITS.ANONYMOUS === 'number', 'RATE_LIMITS.ANONYMOUS required');
      assert.ok(typeof RATE_LIMITS.AUTHENTICATED === 'number', 'RATE_LIMITS.AUTHENTICATED required');
      assert.ok(typeof RATE_LIMITS.PREMIUM === 'number', 'RATE_LIMITS.PREMIUM required');
      assert.ok(typeof RATE_LIMITS.ENTERPRISE === 'number', 'RATE_LIMITS.ENTERPRISE required');
      assert.ok(typeof RATE_LIMITS.INTERNAL === 'number', 'RATE_LIMITS.INTERNAL required');
    });

    it('should have values that increase monotonically', () => {
      assert.ok(
        RATE_LIMITS.ANONYMOUS < RATE_LIMITS.AUTHENTICATED,
        'ANONYMOUS < AUTHENTICATED'
      );
      assert.ok(
        RATE_LIMITS.AUTHENTICATED < RATE_LIMITS.PREMIUM,
        'AUTHENTICATED < PREMIUM'
      );
      assert.ok(
        RATE_LIMITS.PREMIUM < RATE_LIMITS.ENTERPRISE,
        'PREMIUM < ENTERPRISE'
      );
      assert.ok(
        RATE_LIMITS.ENTERPRISE < RATE_LIMITS.INTERNAL,
        'ENTERPRISE < INTERNAL'
      );
    });

    it('should match Fibonacci sequence', () => {
      // These should correspond to FIB[9] through FIB[13]
      assert.strictEqual(RATE_LIMITS.ANONYMOUS, FIB[9], 'ANONYMOUS should be FIB[9]');
      assert.strictEqual(RATE_LIMITS.AUTHENTICATED, FIB[10], 'AUTHENTICATED should be FIB[10]');
      assert.strictEqual(RATE_LIMITS.PREMIUM, FIB[11], 'PREMIUM should be FIB[11]');
      assert.strictEqual(RATE_LIMITS.ENTERPRISE, FIB[12], 'ENTERPRISE should be FIB[12]');
      assert.strictEqual(RATE_LIMITS.INTERNAL, FIB[13], 'INTERNAL should be FIB[13]');
    });
  });

  // ── phiRetryDelays function ──────────────────────────────────────────
  describe('phiRetryDelays function', () => {
    it('should return an array', () => {
      const delays = phiRetryDelays();
      assert.ok(Array.isArray(delays), 'should return an array');
    });

    it('should accept maxRetries parameter', () => {
      const delays3 = phiRetryDelays(3);
      const delays5 = phiRetryDelays(5);

      assert.strictEqual(delays3.length, 3, 'should respect maxRetries parameter');
      assert.strictEqual(delays5.length, 5, 'should respect maxRetries parameter');
    });

    it('should default to 5 retries', () => {
      const delays = phiRetryDelays();
      assert.strictEqual(delays.length, 5, 'should default to 5 retries');
    });

    it('should return φ-exponential series', () => {
      const delays = phiRetryDelays(5);

      // Each delay should be approximately 1000 * PHI^i
      for (let i = 0; i < delays.length; i++) {
        const expected = Math.round(1000 * Math.pow(PHI, i));
        assert.strictEqual(delays[i], expected, `delays[${i}] should be 1000 * PHI^${i}`);
      }
    });

    it('should produce increasing delays', () => {
      const delays = phiRetryDelays(5);

      for (let i = 1; i < delays.length; i++) {
        assert.ok(delays[i] > delays[i - 1], `delays should be increasing`);
      }
    });

    it('should produce positive integer delays', () => {
      const delays = phiRetryDelays(5);

      delays.forEach((delay, i) => {
        assert.ok(Number.isInteger(delay), `delays[${i}] should be an integer`);
        assert.ok(delay > 0, `delays[${i}] should be positive`);
      });
    });
  });

  // ── cslGate function ─────────────────────────────────────────────────
  describe('cslGate function', () => {
    it('should return 0 when confidence < SUPPRESS', () => {
      const result = cslGate(100, 0.1); // 0.1 < SUPPRESS
      assert.strictEqual(result, 0, 'should return 0 below suppress threshold');
    });

    it('should apply PSI2 weighting when SUPPRESS <= confidence < threshold', () => {
      const signal = 100;
      const confidence = 0.4; // between SUPPRESS and BOOST
      const result = cslGate(signal, confidence, CSL.BOOST);

      const expected = signal * PSI2;
      assert.strictEqual(result, expected, 'should apply PSI2 weighting');
    });

    it('should apply full confidence weighting at threshold', () => {
      const signal = 100;
      const confidence = CSL.BOOST;
      const result = cslGate(signal, confidence, CSL.BOOST);

      const expected = signal * confidence;
      assert.strictEqual(result, expected, 'should apply full confidence weighting');
    });

    it('should apply PHI amplification above INJECT', () => {
      const signal = 100;
      const confidence = 0.8; // >= CSL.INJECT
      const result = cslGate(signal, confidence, CSL.BOOST);

      const expected = signal * PHI;
      assert.strictEqual(result, expected, 'should apply PHI amplification above INJECT');
    });

    it('should use default threshold of CSL.BOOST', () => {
      const signal = 100;
      const confidence = CSL.BOOST;
      const result1 = cslGate(signal, confidence);
      const result2 = cslGate(signal, confidence, CSL.BOOST);

      assert.strictEqual(result1, result2, 'should use CSL.BOOST as default threshold');
    });

    it('should handle zero signal', () => {
      const result = cslGate(0, 0.9);
      assert.strictEqual(result, 0, 'should return 0 for zero signal');
    });

    it('should handle perfect confidence', () => {
      const signal = 100;
      const result = cslGate(signal, 1.0);

      const expected = signal * PHI;
      assert.strictEqual(result, expected, 'should apply PHI amplification at perfect confidence');
    });
  });
});
