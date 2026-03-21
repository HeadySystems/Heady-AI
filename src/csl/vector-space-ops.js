/**
 * Heady™ Latent OS v5.4.0
 * © 2026 HeadySystems Inc. — Eric Haywood — 51 Provisional Patents
 * ZERO MAGIC NUMBERS — All constants φ-derived or Fibonacci
 *
 * VECTOR SPACE OPS — Full CSL Geometric Logic Operations
 *
 * Implements all CSL gate operations in vector space:
 *   AND  — cosine similarity (semantic alignment)
 *   OR   — normalized superposition (soft union)
 *   NOT  — orthogonal projection removal (semantic negation)
 *   IMPLY — projection onto target direction
 *   XOR  — exclusive components after removing mutual projection
 *   CONSENSUS — phi-weighted centroid of multiple agent opinions
 *   GATE — soft sigmoid gating with CSL threshold
 *
 * All operations work on unit vectors in ℝᴰ where D ∈ {384, 1536}
 * 51 Provisional Patents — CSL geometric logic is patent-pending
 */
'use strict';

const {
  PHI,
  PSI,
  fib,
  CSL_THRESHOLDS,
  sigmoid
} = require('../../shared/phi-math');

// ─── φ-Constants ─────────────────────────────────────────────────────────────

const DEFAULT_DIM = fib(14); // 377 (close to 384)
const PHI_TEMPERATURE = PSI * PSI * PSI; // ψ³ ≈ 0.236
const ANTI_COLLAPSE_WEIGHT = Math.pow(PSI, 8); // ψ⁸ ≈ 0.0131
const COLLAPSE_THRESHOLD = Math.pow(PSI, 9); // ψ⁹ ≈ 0.0081

// ─── Core Operations ────────────────────────────────────────────────────────

/**
 * CSL AND — Cosine Similarity (semantic alignment measure)
 * Returns scalar in [-1, +1]: +1=aligned, 0=orthogonal, -1=opposed
 */
function cslAND(vecA, vecB) {
  let dot = 0,
    magA = 0,
    magB = 0;
  const len = Math.min(vecA.length, vecB.length);
  for (let i = 0; i < len; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom > 0 ? dot / denom : 0;
}

/**
 * CSL OR — Normalized Superposition (soft union)
 * Returns unit vector: the blended direction of both inputs
 */
function cslOR(vecA, vecB) {
  const result = new Float32Array(vecA.length);
  for (let i = 0; i < vecA.length; i++) {
    result[i] = vecA[i] + vecB[i];
  }
  return normalize(result);
}

/**
 * CSL NOT — Orthogonal Projection Removal (semantic negation)
 * Removes the component of vecA in the direction of vecB
 * Property: cslNOT(a, b) · b = 0 (orthogonality)
 * Property: cslNOT(cslNOT(a, b), b) = cslNOT(a, b) (idempotent)
 */
function cslNOT(vecA, vecB) {
  const proj = cslIMPLY(vecA, vecB);
  const result = new Float32Array(vecA.length);
  for (let i = 0; i < vecA.length; i++) {
    result[i] = vecA[i] - proj[i];
  }
  const mag = magnitude(result);
  if (mag < 1e-10) return new Float32Array(vecA.length); // zero vector if fully aligned
  return normalize(result);
}

/**
 * CSL IMPLY — Projection of vecA onto vecB direction
 * Returns the component of A in the direction of B
 */
function cslIMPLY(vecA, vecB) {
  const dotAB = dot(vecA, vecB);
  const dotBB = dot(vecB, vecB);
  if (dotBB < 1e-10) return new Float32Array(vecA.length);
  const scale = dotAB / dotBB;
  const result = new Float32Array(vecA.length);
  for (let i = 0; i < vecA.length; i++) {
    result[i] = vecB[i] * scale;
  }
  return result;
}

/**
 * CSL XOR — Exclusive components (what's in A or B but not both)
 */
function cslXOR(vecA, vecB) {
  const union = cslOR(vecA, vecB);
  const mutual = cslIMPLY(vecA, vecB);
  const result = new Float32Array(vecA.length);
  for (let i = 0; i < union.length; i++) {
    result[i] = union[i] - mutual[i];
  }
  return normalize(result);
}

/**
 * CSL CONSENSUS — Phi-weighted centroid of multiple vectors
 * Each vector gets weight = ψ^rank (best-scoring carries most weight)
 */
function cslCONSENSUS(vectors, weights = null) {
  if (!vectors || vectors.length === 0) return null;
  if (vectors.length === 1) return normalize(vectors[0]);
  const dim = vectors[0].length;
  const result = new Float32Array(dim);

  // Default weights: phi-geometric series
  const w = weights || vectors.map((_, idx) => Math.pow(PSI, idx));
  const totalWeight = w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < dim; i++) {
    let sum = 0;
    for (let j = 0; j < vectors.length; j++) {
      sum += vectors[j][i] * (w[j] / totalWeight);
    }
    result[i] = sum;
  }
  return normalize(result);
}
function cslGATE(value, cosScore, tau = CSL_THRESHOLDS.MINIMUM, temperature = PHI_TEMPERATURE) {
  const gateValue = sigmoid((cosScore - tau) / temperature);
  if (typeof value === 'number') return value * gateValue;
  if (Array.isArray(value) || value instanceof Float32Array) {
    const result = new Float32Array(value.length);
    for (let i = 0; i < value.length; i++) {
      result[i] = value[i] * gateValue;
    }
    return result;
  }
  return gateValue;
}
function adaptiveGATE(value, cosScore, entropy, maxEntropy, tau = CSL_THRESHOLDS.MINIMUM) {
  const entropyRatio = maxEntropy > 0 ? entropy / maxEntropy : PSI;
  const adaptiveTemp = PHI_TEMPERATURE * (1 + entropyRatio * PSI);
  return cslGATE(value, cosScore, tau, adaptiveTemp);
}

// ─── Utility Functions ──────────────────────────────────────────────────────

function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}
function magnitude(v) {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  return Math.sqrt(sum);
}
function normalize(v) {
  const mag = magnitude(v);
  if (mag < 1e-10) return v;
  const result = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) result[i] = v[i] / mag;
  return result;
}
function randomUnitVector(dim = DEFAULT_DIM) {
  const v = new Float32Array(dim);
  for (let i = 0; i < dim; i++) v[i] = Math.random() * 2 - 1;
  return normalize(v);
}
function zeroVector(dim = DEFAULT_DIM) {
  return new Float32Array(dim);
}

/**
 * Phi-weighted fusion of N scores
 */
function phiFusionScores(scores) {
  if (scores.length === 0) return 0;
  let weightedSum = 0;
  let weightTotal = 0;
  for (let i = 0; i < scores.length; i++) {
    const w = Math.pow(PSI, i);
    weightedSum += scores[i] * w;
    weightTotal += w;
  }
  return weightedSum / weightTotal;
}

/**
 * Check if vector is near-zero (collapsed)
 */
function isCollapsed(v) {
  return magnitude(v) < COLLAPSE_THRESHOLD;
}
module.exports = {
  // CSL Operations
  cslAND,
  cslOR,
  cslNOT,
  cslIMPLY,
  cslXOR,
  cslCONSENSUS,
  cslGATE,
  adaptiveGATE,
  // Utilities
  dot,
  magnitude,
  normalize,
  randomUnitVector,
  zeroVector,
  phiFusionScores,
  isCollapsed,
  // Constants
  DEFAULT_DIM,
  PHI_TEMPERATURE,
  ANTI_COLLAPSE_WEIGHT,
  COLLAPSE_THRESHOLD
};