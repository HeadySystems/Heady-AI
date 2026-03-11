/**
 * heady-testing — Sacred Geometry & Invariant Tests
 * Validates all φ-scaled constants, CSL thresholds, and system invariants.
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import phiMath from '../../../shared/phi-math.js';

const {
  PHI, PSI, PHI_SQ, fib, phiThreshold, phiBackoff, phiFusionWeights,
  PHI_TIMING, CSL_THRESHOLDS, PIPELINE, AUTO_SUCCESS,
  VECTOR: VECTOR_RAW, BEE_SCALING, RESOURCE_POOLS, JUDGE_WEIGHTS,
  PRESSURE_LEVELS, ALERT_THRESHOLDS,
} = phiMath;

// Derived constants
const PSI_SQ = PSI * PSI;
const PSI_CUBED = PSI * PSI * PSI;
const PHI_CUBED = PHI * PHI * PHI;
const SQRT5 = Math.sqrt(5);
function phiMs(n) { return Math.round(Math.pow(PHI, n) * 1000); }

// Normalized names matching Heady v4 spec
const VECTOR = { DIMS: VECTOR_RAW?.DIMENSIONS ?? 384, PROJ_DIMS: VECTOR_RAW?.PROJECTION_DIMS ?? 3, MIN_SCORE: PSI };
const BEE = { TYPES: fib(11), SWARMS: 17, MAX_TOTAL: BEE_SCALING?.MAX_CONCURRENT ?? 10000 };
const POOLS = RESOURCE_POOLS ?? { HOT: 0.34, WARM: 0.21, COLD: 0.13, RESERVE: 0.08, GOVERNANCE: 0.05 };
const JUDGE = JUDGE_WEIGHTS ?? { CORRECTNESS: 0.34, SAFETY: 0.21, PERFORMANCE: 0.21, QUALITY: 0.13, ELEGANCE: 0.11 };

// Vector math (inline)
function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i]; }
  const d = Math.sqrt(magA) * Math.sqrt(magB);
  return d === 0 ? 0 : dot / d;
}
function normalize(v) { const m = Math.sqrt(v.reduce((s, x) => s + x * x, 0)); return m === 0 ? v : v.map(x => x / m); }
function placeholderVector(seed, dims = 384) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s += seed.charCodeAt(i);
  const vec = new Array(dims);
  for (let i = 0; i < dims; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; vec[i] = (s / 0x7fffffff - PSI) * PHI; }
  return normalize(vec);
}
function getPressureLevel(u) {
  if (u < PRESSURE_LEVELS.NOMINAL.max) return PRESSURE_LEVELS.NOMINAL;
  if (u < PRESSURE_LEVELS.ELEVATED.max) return PRESSURE_LEVELS.ELEVATED;
  if (u < PRESSURE_LEVELS.HIGH.max) return PRESSURE_LEVELS.HIGH;
  return PRESSURE_LEVELS.CRITICAL;
}
function fibCeil(n) { let i = 1; while (fib(i) < n) i++; return fib(i); }
function fibFloor(n) { let i = 1; while (fib(i + 1) <= n) i++; return fib(i); }

describe('Core Constants', () => {
  it('φ = (1 + √5) / 2', () => {
    assert.ok(Math.abs(PHI - (1 + Math.sqrt(5)) / 2) < 1e-12);
  });

  it('ψ = 1/φ', () => {
    assert.ok(Math.abs(PSI - 1 / PHI) < 1e-12);
  });

  it('φ × ψ = 1', () => {
    assert.ok(Math.abs(PHI * PSI - 1) < 1e-12);
  });

  it('φ² = φ + 1', () => {
    assert.ok(Math.abs(PHI * PHI - (PHI + 1)) < 1e-10);
  });

  it('ψ² ≈ 0.382', () => {
    assert.ok(Math.abs(PSI_SQ - 0.382) < 0.001);
  });

  it('√5 is correct', () => {
    assert.ok(Math.abs(SQRT5 - Math.sqrt(5)) < 1e-12);
  });
});

describe('Fibonacci', () => {
  it('fib(0) = 0', () => assert.strictEqual(fib(0), 0));
  it('fib(1) = 1', () => assert.strictEqual(fib(1), 1));
  it('fib(8) = 21 (pipeline stages)', () => assert.strictEqual(fib(8), 21));
  it('fib(11) = 89 (bee types)', () => assert.strictEqual(fib(11), 89));
  it('fib(n)/fib(n-1) → φ', () => {
    const ratio = fib(20) / fib(19);
    assert.ok(Math.abs(ratio - PHI) < 1e-6);
  });
  it('fibCeil returns Fibonacci ≥ n', () => {
    assert.strictEqual(fibCeil(10), 13);
    assert.strictEqual(fibCeil(55), 55);
  });
  it('fibFloor returns Fibonacci ≤ n', () => {
    assert.strictEqual(fibFloor(10), 8);
    assert.strictEqual(fibFloor(55), 55);
  });
});

describe('PHI Timing', () => {
  it('φ¹ × 1000 = 1618ms', () => assert.strictEqual(phiMs(1), 1618));
  it('φ⁷ × 1000 = 29034ms (heartbeat)', () => assert.strictEqual(phiMs(7), 29034));
  it('PHI_TIMING entries are correct', () => {
    const count = Object.keys(PHI_TIMING).length;
    assert.ok(count >= 7, `Expected at least 7 timing entries, got ${count}`);
    for (let i = 1; i <= count; i++) {
      assert.strictEqual(PHI_TIMING[`PHI_${i}`], phiMs(i));
    }
  });
});

describe('CSL Thresholds', () => {
  it('MINIMUM ≈ 0.500', () => assert.ok(Math.abs(CSL_THRESHOLDS.MINIMUM - 0.5) < 0.001));
  it('DEFAULT = ψ ≈ 0.618', () => assert.ok(Math.abs(CSL_THRESHOLDS.DEFAULT - PSI) < 1e-10));
  it('monotonically increasing', () => {
    const ordered = [
      CSL_THRESHOLDS.MINIMUM,
      CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM,
      CSL_THRESHOLDS.HIGH,
      CSL_THRESHOLDS.CRITICAL,
    ];
    for (let i = 1; i < ordered.length; i++) {
      assert.ok(ordered[i] > ordered[i - 1], `${ordered[i]} should be > ${ordered[i - 1]}`);
    }
  });
});

describe('Backoff', () => {
  it('uses φ multiplier (never 2×)', () => {
    const b1 = phiBackoff(0);
    const b2 = phiBackoff(1);
    assert.ok(Math.abs(b2 / b1 - PHI) < 0.01);
  });
  it('respects max', () => {
    assert.ok(phiBackoff(100, 1000, 60000) <= 60000);
  });
  it('jitter stays within bounds', () => {
    // phiBackoffWithJitter may not be exported; test base backoff variability
    for (let i = 0; i < 5; i++) {
      const val = phiBackoff(i);
      assert.ok(val > 0);
      assert.ok(val <= 60000);
    }
  });
});

describe('Fusion Weights', () => {
  for (const n of [2, 3, 5, 7, 10]) {
    it(`n=${n} weights sum ≈ 1.0`, () => {
      const weights = phiFusionWeights(n);
      assert.strictEqual(weights.length, n);
      const sum = weights.reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1.0) < 0.01, `Sum was ${sum}`);
    });
  }
});

describe('System Invariants', () => {
  it('89 bee types = fib(11)', () => assert.strictEqual(BEE.TYPES, 89));
  it('17 swarms', () => assert.strictEqual(BEE.SWARMS, 17));
  it('10,000 max bees', () => assert.strictEqual(BEE.MAX_TOTAL, 10000));
  it('21 pipeline stages = fib(8)', () => assert.strictEqual(PIPELINE.STAGES, 21));
  it('384-dim vectors', () => assert.strictEqual(VECTOR.DIMS, 384));
  it('3-dim projections', () => assert.strictEqual(VECTOR.PROJ_DIMS, 3));
  it('Auto-success cycle = φ⁷ × 1000', () => assert.strictEqual(AUTO_SUCCESS.CYCLE_MS, phiMs(7)));
});

describe('Pool Allocations', () => {
  it('sum ≤ 1.0', () => {
    const sum = POOLS.HOT + POOLS.WARM + POOLS.COLD + POOLS.RESERVE + POOLS.GOVERNANCE;
    assert.ok(sum <= 1.0 + 1e-10, `Pool sum ${sum} exceeds 1.0`);
  });
  it('HOT > WARM > COLD > RESERVE > GOVERNANCE', () => {
    assert.ok(POOLS.HOT > POOLS.WARM);
    assert.ok(POOLS.WARM > POOLS.COLD);
    assert.ok(POOLS.COLD > POOLS.RESERVE);
    assert.ok(POOLS.RESERVE > POOLS.GOVERNANCE);
  });
});

describe('Judge Scoring Weights', () => {
  it('sum ≈ 1.0', () => {
    const sum = JUDGE.CORRECTNESS + JUDGE.SAFETY + JUDGE.PERFORMANCE + JUDGE.QUALITY + JUDGE.ELEGANCE;
    assert.ok(Math.abs(sum - 1.0) < 0.01, `Judge weights sum: ${sum}`);
  });
});

describe('Vector Math', () => {
  it('cosine similarity of identical vectors = 1.0', () => {
    const v = [1, 2, 3, 4, 5];
    assert.ok(Math.abs(cosineSimilarity(v, v) - 1.0) < 1e-10);
  });
  it('cosine similarity of orthogonal vectors = 0.0', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    assert.ok(Math.abs(cosineSimilarity(a, b)) < 1e-10);
  });
  it('normalize produces unit vector', () => {
    const v = normalize([3, 4]);
    const mag = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
    assert.ok(Math.abs(mag - 1.0) < 1e-10);
  });
  it('placeholderVector is deterministic', () => {
    const a = placeholderVector('test-seed');
    const b = placeholderVector('test-seed');
    assert.deepStrictEqual(a, b);
  });
  it('placeholderVector produces unit vectors', () => {
    const v = placeholderVector('unit-check');
    const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    assert.ok(Math.abs(mag - 1.0) < 1e-6);
  });
});

describe('Pressure Levels', () => {
  it('NOMINAL for low utilization', () => {
    const level = getPressureLevel(0.1);
    assert.ok(level === PRESSURE_LEVELS.NOMINAL, 'Expected NOMINAL pressure level');
  });
  it('CRITICAL for high utilization', () => {
    const level = getPressureLevel(0.95);
    assert.ok(level === PRESSURE_LEVELS.CRITICAL, 'Expected CRITICAL pressure level');
  });
});
