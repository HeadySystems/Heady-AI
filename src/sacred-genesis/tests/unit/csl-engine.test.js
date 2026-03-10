/**
 * Unit Tests — CSL Engine Operations
 * @author Eric Haywood, HeadySystems Inc.
 */

'use strict';

const assert = require('assert');

const EPSILON = 1e-6;

/**
 * Helper: Create unit vector from values
 * @param {number[]} values
 * @returns {number[]}
 */
function normalize(values) {
  const mag = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  if (mag === 0) return values;
  return values.map(v => v / mag);
}

/**
 * Helper: Cosine similarity (CSL AND)
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function cslAND(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Helper: CSL OR (superposition)
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number[]}
 */
function cslOR(a, b) {
  const sum = a.map((v, i) => v + b[i]);
  return normalize(sum);
}

/**
 * Helper: CSL NOT (orthogonal projection removal)
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number[]}
 */
function cslNOT(a, b) {
  let dot = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magB += b[i] * b[i];
  }
  const proj = dot / magB;
  return a.map((v, i) => v - proj * b[i]);
}

/**
 * Helper: CSL GATE (sigmoid gating)
 * @param {number} value
 * @param {number} cosScore
 * @param {number} tau
 * @param {number} temp
 * @returns {number}
 */
function cslGATE(value, cosScore, tau = 0.5, temp = 0.236) {
  return value * (1 / (1 + Math.exp(-(cosScore - tau) / temp)));
}

const vecA = normalize([1, 0, 0, 0]);
const vecB = normalize([0, 1, 0, 0]);
const vecC = normalize([1, 1, 0, 0]);
const vecSame = normalize([1, 0, 0, 0]);

module.exports = {
  'CSL AND: identical vectors have similarity 1': () => {
    const sim = cslAND(vecA, vecSame);
    assert(Math.abs(sim - 1.0) < EPSILON, `Expected ~1.0, got ${sim}`);
  },

  'CSL AND: orthogonal vectors have similarity 0': () => {
    const sim = cslAND(vecA, vecB);
    assert(Math.abs(sim) < EPSILON, `Expected ~0, got ${sim}`);
  },

  'CSL AND is commutative': () => {
    const ab = cslAND(vecA, vecC);
    const ba = cslAND(vecC, vecA);
    assert(Math.abs(ab - ba) < EPSILON, `${ab} !== ${ba}`);
  },

  'CSL AND returns values in [-1, 1]': () => {
    const sim = cslAND(vecA, vecC);
    assert(sim >= -1 - EPSILON && sim <= 1 + EPSILON, `Out of range: ${sim}`);
  },

  'CSL OR produces unit vector': () => {
    const result = cslOR(vecA, vecB);
    const mag = Math.sqrt(result.reduce((s, v) => s + v * v, 0));
    assert(Math.abs(mag - 1.0) < EPSILON, `Magnitude: ${mag}`);
  },

  'CSL OR result has similarity to both inputs': () => {
    const result = cslOR(vecA, vecB);
    const simA = cslAND(result, vecA);
    const simB = cslAND(result, vecB);
    assert(simA > 0, `Should be similar to A: ${simA}`);
    assert(simB > 0, `Should be similar to B: ${simB}`);
  },

  'CSL NOT produces orthogonal result': () => {
    const result = cslNOT(vecC, vecA);
    const dot = result.reduce((s, v, i) => s + v * vecA[i], 0);
    assert(Math.abs(dot) < EPSILON, `NOT result should be orthogonal to B: dot=${dot}`);
  },

  'CSL NOT is idempotent': () => {
    const first = cslNOT(vecC, vecA);
    const second = cslNOT(first, vecA);
    for (let i = 0; i < first.length; i++) {
      assert(Math.abs(first[i] - second[i]) < EPSILON, `Dimension ${i}: ${first[i]} !== ${second[i]}`);
    }
  },

  'CSL NOT removes the B component': () => {
    const result = cslNOT(vecC, vecA);
    const simToA = cslAND(normalize(result.filter((_, i) => true)), vecA);
    assert(Math.abs(simToA) < 0.01 || result.every((v, i) => i === 0 ? Math.abs(v) < EPSILON : true));
  },

  'CSL GATE: high score passes value': () => {
    const gated = cslGATE(1.0, 0.9, 0.5, 0.236);
    assert(gated > 0.8, `Expected >0.8, got ${gated}`);
  },

  'CSL GATE: low score blocks value': () => {
    const gated = cslGATE(1.0, 0.1, 0.5, 0.236);
    assert(gated < 0.2, `Expected <0.2, got ${gated}`);
  },

  'CSL GATE: at threshold returns ~0.5 of value': () => {
    const gated = cslGATE(1.0, 0.5, 0.5, 0.236);
    assert(Math.abs(gated - 0.5) < 0.01, `Expected ~0.5, got ${gated}`);
  },

  'CSL GATE is bounded': () => {
    const gated = cslGATE(1.0, 100, 0.5, 0.236);
    assert(gated <= 1.0 + EPSILON, `Should be bounded: ${gated}`);
  },

  'CSL GATE is non-negative for non-negative input': () => {
    for (let cos = -1; cos <= 1; cos += 0.1) {
      const gated = cslGATE(1.0, cos, 0.5, 0.236);
      assert(gated >= -EPSILON, `Negative at cos=${cos}: ${gated}`);
    }
  }
};
