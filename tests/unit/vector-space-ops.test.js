/**
 * Heady™ Latent OS v5.4.0
 * Tests: Vector Space Operations (CSL)
 * © 2026 HeadySystems Inc. — Eric Haywood — 51 Provisional Patents
 */
'use strict';

const assert = require('assert');
const {
  cslAND, cslOR, cslNOT, cslIMPLY, cslXOR,
  cslCONSENSUS, cslGATE, adaptiveGATE,
  dot, magnitude, normalize, randomUnitVector, zeroVector,
  phiFusionScores, isCollapsed,
  DEFAULT_DIM, PHI_TEMPERATURE,
} = require('../../src/csl/vector-space-ops');
const { CSL_THRESHOLDS, PSI } = require('../../shared/phi-math');

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    process.stdout.write(JSON.stringify({ level: 'info', test: name, status: 'PASS' }) + '\n');
  } catch (err) {
    process.stdout.write(JSON.stringify({ level: 'error', test: name, status: 'FAIL', error: err.message }) + '\n');
  }
}

// ─── AND (cosine similarity) ────────────────────────────────────────────────

test('cslAND: identical vectors = 1.0', () => {
  const v = randomUnitVector(8);
  const sim = cslAND(v, v);
  assert.ok(Math.abs(sim - 1.0) < 0.001, `Expected ~1.0, got ${sim}`);
});

test('cslAND: opposite vectors ≈ -1.0', () => {
  const v = new Float32Array([1, 0, 0, 0]);
  const neg = new Float32Array([-1, 0, 0, 0]);
  const sim = cslAND(v, neg);
  assert.ok(Math.abs(sim - (-1.0)) < 0.001, `Expected ~-1.0, got ${sim}`);
});

test('cslAND: orthogonal vectors = 0', () => {
  const a = new Float32Array([1, 0, 0, 0]);
  const b = new Float32Array([0, 1, 0, 0]);
  const sim = cslAND(a, b);
  assert.ok(Math.abs(sim) < 0.001, `Expected ~0, got ${sim}`);
});

test('cslAND: is commutative', () => {
  const a = randomUnitVector(8);
  const b = randomUnitVector(8);
  const ab = cslAND(a, b);
  const ba = cslAND(b, a);
  assert.ok(Math.abs(ab - ba) < 0.0001, 'AND should be commutative');
});

// ─── OR (superposition) ─────────────────────────────────────────────────────

test('cslOR: result is unit vector', () => {
  const a = randomUnitVector(8);
  const b = randomUnitVector(8);
  const result = cslOR(a, b);
  const mag = magnitude(result);
  assert.ok(Math.abs(mag - 1.0) < 0.001, `Expected unit vector, got magnitude ${mag}`);
});

test('cslOR: self-union is self', () => {
  const v = normalize(new Float32Array([1, 2, 3, 4]));
  const result = cslOR(v, v);
  const sim = cslAND(v, result);
  assert.ok(Math.abs(sim - 1.0) < 0.001, `Expected ~1.0, got ${sim}`);
});

// ─── NOT (orthogonal projection removal) ────────────────────────────────────

test('cslNOT: result is orthogonal to b', () => {
  const a = normalize(new Float32Array([1, 1, 0, 0]));
  const b = normalize(new Float32Array([1, 0, 0, 0]));
  const notAB = cslNOT(a, b);
  const dotResult = dot(notAB, b);
  assert.ok(Math.abs(dotResult) < 0.001, `Expected orthogonal (~0 dot), got ${dotResult}`);
});

test('cslNOT: is idempotent (NOT(NOT(a,b),b) = NOT(a,b))', () => {
  const a = randomUnitVector(8);
  const b = randomUnitVector(8);
  const first = cslNOT(a, b);
  const second = cslNOT(first, b);
  const sim = cslAND(first, second);
  assert.ok(Math.abs(sim - 1.0) < 0.01 || isCollapsed(first),
    `Expected idempotent (sim ~1.0), got ${sim}`);
});

// ─── IMPLY (projection) ─────────────────────────────────────────────────────

test('cslIMPLY: projection of aligned vectors', () => {
  const a = normalize(new Float32Array([2, 0, 0, 0]));
  const b = normalize(new Float32Array([1, 0, 0, 0]));
  const proj = cslIMPLY(a, b);
  const sim = cslAND(normalize(proj), b);
  assert.ok(Math.abs(sim - 1.0) < 0.001, 'Projection should align with b');
});

// ─── CONSENSUS ──────────────────────────────────────────────────────────────

test('cslCONSENSUS: single vector returns itself', () => {
  const v = randomUnitVector(8);
  const result = cslCONSENSUS([v]);
  const sim = cslAND(v, result);
  assert.ok(Math.abs(sim - 1.0) < 0.001);
});

test('cslCONSENSUS: result is unit vector', () => {
  const vectors = [randomUnitVector(8), randomUnitVector(8), randomUnitVector(8)];
  const result = cslCONSENSUS(vectors);
  const mag = magnitude(result);
  assert.ok(Math.abs(mag - 1.0) < 0.001);
});

// ─── GATE ───────────────────────────────────────────────────────────────────

test('cslGATE: high score passes gate', () => {
  // cosScore=0.95 with tau=MINIMUM(0.5): (0.95-0.5)/0.236 → sigmoid ≈ 0.87
  const gated = cslGATE(1.0, 0.95, CSL_THRESHOLDS.MINIMUM);
  assert.ok(gated > 0.8, `Expected >0.8, got ${gated}`);
});

test('cslGATE: low score blocks gate', () => {
  const gated = cslGATE(1.0, 0.1, CSL_THRESHOLDS.MEDIUM);
  assert.ok(gated < 0.1, `Expected <0.1, got ${gated}`);
});

test('cslGATE: works with vectors', () => {
  const v = new Float32Array([1, 2, 3, 4]);
  const result = cslGATE(v, 0.95, CSL_THRESHOLDS.MINIMUM);
  assert.ok(result instanceof Float32Array);
  assert.ok(result[0] > 0, 'Should pass through gate');
});

// ─── Utilities ──────────────────────────────────────────────────────────────

test('normalize: produces unit vector', () => {
  const v = new Float32Array([3, 4, 0, 0]);
  const n = normalize(v);
  assert.ok(Math.abs(magnitude(n) - 1.0) < 0.001);
});

test('randomUnitVector: correct dimension and unit length', () => {
  const v = randomUnitVector(13);
  assert.strictEqual(v.length, 13);
  assert.ok(Math.abs(magnitude(v) - 1.0) < 0.001);
});

test('phiFusionScores: single score returns itself', () => {
  assert.ok(Math.abs(phiFusionScores([0.8]) - 0.8) < 0.001);
});

test('phiFusionScores: first score carries most weight', () => {
  const result = phiFusionScores([1.0, 0.0, 0.0]);
  // Weights: [ψ⁰,ψ¹,ψ²]=[1,0.618,0.382] → 1.0/2.0 = 0.5 (boundary)
  assert.ok(result >= 0.5, `Expected >=0.5, got ${result}`);
});

test('isCollapsed: zero vector is collapsed', () => {
  assert.strictEqual(isCollapsed(zeroVector(8)), true);
});

test('isCollapsed: unit vector is not collapsed', () => {
  assert.strictEqual(isCollapsed(randomUnitVector(8)), false);
});

test('DEFAULT_DIM is fib(14) = 377', () => {
  assert.strictEqual(DEFAULT_DIM, 377);
});

test('PHI_TEMPERATURE is ψ³', () => {
  const expected = PSI * PSI * PSI;
  assert.ok(Math.abs(PHI_TEMPERATURE - expected) < 0.0001);
});

// ─── Summary ────────────────────────────────────────────────────────────────

process.stdout.write(JSON.stringify({
  level: 'info', suite: 'vector-space-ops',
  passed, total, status: passed === total ? 'ALL_PASS' : 'SOME_FAIL',
}) + '\n');
process.exitCode = passed === total ? 0 : 1;
