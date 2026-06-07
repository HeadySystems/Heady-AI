// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: packages/phi-math/test/index.test.mjs                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ φ-Math Tests v5.0.0                                   ║
// ║  Validates all φ-derived constants and utility functions       ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PHI, PSI, PSI2, FIB, CSL_GATES, CSL_BANDS,
  PHI_TIMEOUT_CONNECT, PHI_TIMEOUT_REQUEST,
  PHI_CIRCUIT_BREAKER, PHI_BULKHEAD, PHI_RATE_LIMITS,
  PHI_CACHE_SIZES, PHI_RETRY, PHI_ROLLOUT,
  PHI_TTL_DECAY_DAYS, PHI_RETENTION_WEIGHTS,
  PHI_SCALING_THRESHOLD, PHI_CANARY_STAGES,
  phiScale, fib, fibNearest, cslGate, cslGateSimple,
  phiBackoff, phiBackoffDeterministic, stageTimeout,
  stageRetryDelay, stageBuffer, fibQueueDepth,
  retentionScore, goldenSectionSearch,
} from '../index.mjs';

describe('Core Constants', () => {
  it('PHI matches golden ratio to 15 decimal places', () => {
    assert.equal(PHI, 1.618033988749895);
    assert.ok(Math.abs(PHI - (1 + Math.sqrt(5)) / 2) < 1e-14);
  });

  it('PSI is reciprocal of PHI', () => {
    assert.ok(Math.abs(PSI - 1 / PHI) < 1e-14);
    assert.ok(Math.abs(PSI - 0.618) < 0.001);
  });

  it('PSI2 is PSI squared', () => {
    assert.ok(Math.abs(PSI2 - PSI * PSI) < 1e-14);
    assert.ok(Math.abs(PSI2 - 0.382) < 0.001);
  });

  it('PHI satisfies golden ratio identity: PHI^2 = PHI + 1', () => {
    assert.ok(Math.abs(PHI * PHI - (PHI + 1)) < 1e-14);
  });

  it('FIB array has 21 correct Fibonacci numbers', () => {
    assert.equal(FIB.length, 21);
    assert.equal(FIB[0], 0);
    assert.equal(FIB[1], 1);
    assert.equal(FIB[2], 1);
    for (let i = 2; i < FIB.length; i++) {
      assert.equal(FIB[i], FIB[i - 1] + FIB[i - 2], `FIB[${i}] mismatch`);
    }
  });

  it('FIB is frozen (immutable)', () => {
    assert.ok(Object.isFrozen(FIB));
  });
});

describe('CSL Gates', () => {
  it('gates are ordered: include < boost < inject < certify', () => {
    assert.ok(CSL_GATES.include < CSL_GATES.boost);
    assert.ok(CSL_GATES.boost < CSL_GATES.inject);
    assert.ok(CSL_GATES.inject < CSL_GATES.certify);
  });

  it('include gate equals PSI2 (0.382)', () => {
    assert.equal(CSL_GATES.include, PSI2);
  });

  it('boost gate equals PSI (0.618)', () => {
    assert.equal(CSL_GATES.boost, PSI);
  });
});

describe('CSL Bands', () => {
  it('bands cover full 0-1 range without gaps', () => {
    assert.ok(CSL_BANDS.DORMANT_MAX < CSL_BANDS.LOW_MAX);
    assert.ok(CSL_BANDS.LOW_MAX < CSL_BANDS.MODERATE_MAX);
    assert.ok(CSL_BANDS.MODERATE_MAX < CSL_BANDS.HIGH_MAX);
    assert.ok(CSL_BANDS.HIGH_MAX < CSL_BANDS.CRITICAL_MAX);
    assert.equal(CSL_BANDS.CRITICAL_MAX, 1.0);
  });
});

describe('Derived Constants', () => {
  it('PHI_TIMEOUT_CONNECT is ~1618ms', () => {
    assert.equal(PHI_TIMEOUT_CONNECT, 1618);
  });

  it('PHI_TIMEOUT_REQUEST is ~4236ms (φ³ × 1000)', () => {
    assert.equal(PHI_TIMEOUT_REQUEST, Math.round(PHI * PHI * PHI * 1000));
  });

  it('PHI_CIRCUIT_BREAKER uses Fibonacci thresholds', () => {
    assert.equal(PHI_CIRCUIT_BREAKER.threshold, 89);
    assert.equal(PHI_CIRCUIT_BREAKER.resetTimeout, 55000);
    assert.equal(PHI_CIRCUIT_BREAKER.halfOpenMax, 34);
  });

  it('PHI_SCALING_THRESHOLD equals PSI (~0.618)', () => {
    assert.equal(PHI_SCALING_THRESHOLD, PSI);
  });

  it('PHI_CANARY_STAGES has 4 stages ending at 1.0', () => {
    assert.equal(PHI_CANARY_STAGES.length, 4);
    assert.equal(PHI_CANARY_STAGES[PHI_CANARY_STAGES.length - 1], 1.0);
  });

  it('PHI_TTL_DECAY_DAYS follows Fibonacci pattern', () => {
    assert.equal(PHI_TTL_DECAY_DAYS[0], 1);
    assert.equal(PHI_TTL_DECAY_DAYS[4], 5);
    assert.equal(PHI_TTL_DECAY_DAYS[10], 89);
  });
});

describe('phiScale()', () => {
  it('scales base by φ^n', () => {
    assert.ok(Math.abs(phiScale(100, 2) - 100 * PHI * PHI) < 0.001);
  });

  it('φ^0 returns base unchanged', () => {
    assert.equal(phiScale(42, 0), 42);
  });

  it('negative n shrinks the value', () => {
    assert.ok(phiScale(100, -1) < 100);
  });
});

describe('fib()', () => {
  it('returns 0 for negative input', () => {
    assert.equal(fib(-1), 0);
    assert.equal(fib(-100), 0);
  });

  it('returns correct values from lookup table', () => {
    assert.equal(fib(0), 0);
    assert.equal(fib(1), 1);
    assert.equal(fib(10), 55);
    assert.equal(fib(20), 6765);
  });

  it('computes values beyond lookup table', () => {
    assert.equal(fib(25), 75025);
    assert.equal(fib(30), 832040);
  });
});

describe('fibNearest()', () => {
  it('returns exact match when available', () => {
    assert.equal(fibNearest(55), 55);
    assert.equal(fibNearest(89), 89);
  });

  it('returns nearest Fibonacci number', () => {
    assert.equal(fibNearest(50), 55);
    assert.equal(fibNearest(100), 89);
  });
});

describe('cslGate()', () => {
  it('passes when geometric mean exceeds tau', () => {
    assert.equal(cslGate(0.7, 0.8), true);     // sqrt(0.56) ≈ 0.748 >= 0.618
    assert.equal(cslGate(0.9, 0.9), true);      // sqrt(0.81) = 0.9 >= 0.618
  });

  it('rejects when geometric mean is below tau', () => {
    assert.equal(cslGate(0.1, 0.2), false);     // sqrt(0.02) ≈ 0.14 < 0.618
    assert.equal(cslGate(0.3, 0.3), false);     // sqrt(0.09) = 0.3 < 0.618
  });

  it('respects custom tau', () => {
    assert.equal(cslGate(0.5, 0.5, 0.3), true); // sqrt(0.25) = 0.5 >= 0.3
    assert.equal(cslGate(0.5, 0.5, 0.9), false); // sqrt(0.25) = 0.5 < 0.9
  });
});

describe('cslGateSimple()', () => {
  it('passes at boost threshold (0.618)', () => {
    assert.equal(cslGateSimple(PSI), true);
    assert.equal(cslGateSimple(0.7, 'boost'), true);
  });

  it('rejects below threshold', () => {
    assert.equal(cslGateSimple(0.5, 'boost'), false);
  });

  it('works with named gates', () => {
    assert.equal(cslGateSimple(0.4, 'include'), true);    // 0.4 >= 0.382
    assert.equal(cslGateSimple(0.3, 'include'), false);   // 0.3 < 0.382
  });
});

describe('phiBackoff()', () => {
  it('increases with each attempt', () => {
    const d0 = phiBackoffDeterministic(0);
    const d1 = phiBackoffDeterministic(1);
    const d2 = phiBackoffDeterministic(2);
    assert.ok(d1 > d0, 'attempt 1 should be greater than attempt 0');
    assert.ok(d2 > d1, 'attempt 2 should be greater than attempt 1');
  });

  it('caps at maxMs', () => {
    const delay = phiBackoffDeterministic(100, 1000, 5000);
    assert.equal(delay, 5000);
  });

  it('deterministic version has no jitter', () => {
    const d1 = phiBackoffDeterministic(3);
    const d2 = phiBackoffDeterministic(3);
    assert.equal(d1, d2);
  });

  it('jittered version stays within ±10% of deterministic', () => {
    const det = phiBackoffDeterministic(2);
    for (let i = 0; i < 20; i++) {
      const jittered = phiBackoff(2);
      assert.ok(jittered >= det * 0.89 && jittered <= det * 1.11,
        `jittered ${jittered} outside ±11% of ${det}`);
    }
  });
});

describe('stageTimeout()', () => {
  it('returns baseMs for stage 0', () => {
    assert.equal(stageTimeout(0), 100);
  });

  it('scales by φ per stage', () => {
    const t1 = stageTimeout(1);
    assert.equal(t1, Math.round(100 * PHI));
    assert.equal(t1, 162);
  });

  it('stage 10 is approximately 12,299ms', () => {
    const t10 = stageTimeout(10);
    assert.ok(Math.abs(t10 - 12299) < 2);
  });
});

describe('stageRetryDelay()', () => {
  it('returns baseMs for stage 0', () => {
    assert.equal(stageRetryDelay(0), 1000);
  });
});

describe('fibQueueDepth()', () => {
  it('returns correct Fibonacci queue depth per level', () => {
    assert.equal(fibQueueDepth('minimal'), FIB[5]);   // 5
    assert.equal(fibQueueDepth('low'), FIB[7]);        // 13
    assert.equal(fibQueueDepth('medium'), FIB[8]);     // 21
    assert.equal(fibQueueDepth('high'), FIB[10]);      // 55
    assert.equal(fibQueueDepth('extreme'), FIB[12]);   // 144
  });

  it('defaults to medium for unknown levels', () => {
    assert.equal(fibQueueDepth('unknown'), FIB[8]);
  });
});

describe('retentionScore()', () => {
  it('retains high-scoring entries', () => {
    const result = retentionScore({ importance: 0.9, recency: 0.8, frequency: 0.7 });
    assert.equal(result.action, 'retain');
    assert.ok(result.score > PSI);
  });

  it('discards very low-scoring entries', () => {
    const result = retentionScore({ importance: 0.01, recency: 0.01, frequency: 0.01 });
    assert.equal(result.action, 'discard');
  });

  it('marks medium scores for review', () => {
    const result = retentionScore({ importance: 0.5, recency: 0.3, frequency: 0.2 });
    assert.equal(result.action, 'review');
  });
});

describe('goldenSectionSearch()', () => {
  it('finds minimum of x^2 near x=0', () => {
    const result = goldenSectionSearch(x => x * x, -10, 10);
    assert.ok(Math.abs(result.x) < 0.001);
    assert.ok(Math.abs(result.fx) < 0.001);
    assert.ok(result.iterations > 0);
  });

  it('finds minimum of (x-3)^2 near x=3', () => {
    const result = goldenSectionSearch(x => (x - 3) ** 2, 0, 10);
    assert.ok(Math.abs(result.x - 3) < 0.001);
  });
});
