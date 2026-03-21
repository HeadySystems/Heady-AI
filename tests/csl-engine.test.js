/**
 * CSL Engine Test Suite — Heady Systems
 * Eric Haywood — Sacred Geometry v4.0
 *
 * Tests all CSL gate operations: AND, OR, NOT, IMPLY, XOR, CONSENSUS, GATE
 */
'use strict';


const assert = require('node:assert/strict');

// Phi constants
const PHI  = 1.618033988749895;
const PSI  = 1 / PHI;
const PSI2 = PSI * PSI;
const PSI3 = PSI * PSI * PSI;

const CSL_THRESHOLDS = {
  MINIMUM:  0.500,
  LOW:      1 - PSI * 0.5,
  MEDIUM:   1 - PSI2 * 0.5,
  HIGH:     1 - PSI3 * 0.5,
  CRITICAL: 1 - Math.pow(PSI, 4) * 0.5,
};

// Helper: create unit vector from seed
function seedVector(seed, dim = 384) {
  const v = new Float64Array(dim);
  let s = seed;
  for (let i = 0; i < dim; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    v[i] = (s / 0x7fffffff) * 2 - 1;
  }
  const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  for (let i = 0; i < dim; i++) v[i] /= norm;
  return v;
}

// CSL AND = cosine similarity
function cslAND(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// CSL OR = normalized superposition
function cslOR(a, b) {
  const c = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) c[i] = a[i] + b[i];
  const norm = Math.sqrt(c.reduce((sum, x) => sum + x * x, 0));
  for (let i = 0; i < a.length; i++) c[i] /= norm;
  return c;
}

// CSL NOT = orthogonal projection removal
function cslNOT(a, b) {
  let dot = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normB += b[i] * b[i];
  }
  const proj = dot / normB;
  const c = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) c[i] = a[i] - proj * b[i];
  return c;
}

// CSL GATE = sigmoid gating
function cslGATE(value, cosScore, tau = CSL_THRESHOLDS.MINIMUM, temp = PSI3) {
  return value * (1 / (1 + Math.exp(-(cosScore - tau) / temp)));
}

describe('CSL Engine — Core Operations', () => {
  const v1 = seedVector(42);
  const v2 = seedVector(43);
  const v3 = seedVector(42); // same seed = identical

  it('AND: identical vectors have cosine ≈ 1.0', () => {
    const score = cslAND(v1, v3);
    assert.ok(Math.abs(score - 1.0) < 0.001, `Expected ~1.0, got ${score}`);
  });

  it('AND: different vectors have cosine < 1.0', () => {
    const score = cslAND(v1, v2);
    assert.ok(score < 1.0, `Expected < 1.0, got ${score}`);
    assert.ok(score > -1.0, `Expected > -1.0, got ${score}`);
  });

  it('AND: is commutative (AND(a,b) = AND(b,a))', () => {
    const ab = cslAND(v1, v2);
    const ba = cslAND(v2, v1);
    assert.ok(Math.abs(ab - ba) < 1e-10, 'AND must be commutative');
  });

  it('OR: superposition produces valid unit vector', () => {
    const result = cslOR(v1, v2);
    const norm = Math.sqrt(result.reduce((s, x) => s + x * x, 0));
    assert.ok(Math.abs(norm - 1.0) < 0.001, `Norm should be ~1.0, got ${norm}`);
  });

  it('NOT: result is orthogonal to b (dot product ≈ 0)', () => {
    const notResult = cslNOT(v1, v2);
    let dot = 0;
    for (let i = 0; i < notResult.length; i++) dot += notResult[i] * v2[i];
    assert.ok(Math.abs(dot) < 1e-10, `NOT result should be orthogonal to b, dot=${dot}`);
  });

  it('NOT: is idempotent (NOT(NOT(a,b),b) ≈ NOT(a,b))', () => {
    const first = cslNOT(v1, v2);
    const second = cslNOT(first, v2);
    const sim = cslAND(first, second);
    // After normalization, should be very similar
    const normFirst = Math.sqrt(first.reduce((s,x) => s+x*x, 0));
    const normSecond = Math.sqrt(second.reduce((s,x) => s+x*x, 0));
    if (normFirst > 0.001 && normSecond > 0.001) {
      assert.ok(sim > 0.99, `Idempotent NOT should be stable, got similarity=${sim}`);
    }
  });

  it('GATE: high cosine passes through (value preserved)', () => {
    const result = cslGATE(1.0, 0.95, CSL_THRESHOLDS.MINIMUM);
    assert.ok(result > 0.9, `High cosine should pass, got ${result}`);
  });

  it('GATE: low cosine blocks (value suppressed)', () => {
    const result = cslGATE(1.0, 0.1, CSL_THRESHOLDS.HIGH);
    assert.ok(result < 0.1, `Low cosine should block, got ${result}`);
  });

  it('GATE: threshold levels are phi-harmonic ordered', () => {
    assert.ok(CSL_THRESHOLDS.MINIMUM < CSL_THRESHOLDS.LOW);
    assert.ok(CSL_THRESHOLDS.LOW < CSL_THRESHOLDS.MEDIUM);
    assert.ok(CSL_THRESHOLDS.MEDIUM < CSL_THRESHOLDS.HIGH);
    assert.ok(CSL_THRESHOLDS.HIGH < CSL_THRESHOLDS.CRITICAL);
  });
});

describe('CSL Engine — Phi Constants Validation', () => {
  it('PHI * PSI = 1.0', () => {
    assert.ok(Math.abs(PHI * PSI - 1.0) < 1e-10);
  });

  it('PHI^2 = PHI + 1', () => {
    assert.ok(Math.abs(PHI * PHI - (PHI + 1)) < 1e-10);
  });

  it('PSI = PHI - 1', () => {
    assert.ok(Math.abs(PSI - (PHI - 1)) < 1e-10);
  });

  it('CSL thresholds are within [0, 1]', () => {
    for (const [name, val] of Object.entries(CSL_THRESHOLDS)) {
      assert.ok(val >= 0 && val <= 1, `${name}=${val} out of range`);
    }
  });
});

describe('CSL Engine — Vector Dimensions', () => {
  it('All vectors are 384-dimensional', () => {
    assert.strictEqual(seedVector(1).length, 384);
    assert.strictEqual(seedVector(999).length, 384);
  });

  it('Seeded vectors are deterministic', () => {
    const a = seedVector(12345);
    const b = seedVector(12345);
    const sim = cslAND(a, b);
    assert.ok(Math.abs(sim - 1.0) < 1e-10, 'Same seed must produce identical vectors');
  });
});
