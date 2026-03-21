'use strict';

const {
  PSI,
  CSL_THRESHOLDS,
  sigmoid,
  cslGate,
  cslBlend,
  cosineSimilarity,
  normalize,
  phiFusionWeights,
  adaptiveTemperature
} = require('../../shared/phi-math.js');
const PHI_TEMPERATURE = Math.pow(PSI, 3);

/** Default gate threshold (noise floor): ≈ 0.500 */
const DEFAULT_TAU = CSL_THRESHOLDS.MINIMUM;

// ─── Core vector utilities ───────────────────────────────────────────────────

/**
 * Compute the dot product of two same-length arrays.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/**
 * Project vector a onto vector b: proj_b(a) = (a·b / ‖b‖²) · b
 * @param {number[]} a - source vector
 * @param {number[]} b - direction vector
 * @returns {number[]}
 */
function project(a, b) {
  const scale = dot(a, b) / (dot(b, b) || 1e-12);
  return b.map(x => x * scale);
}

// ─── CSL Gate Operations ─────────────────────────────────────────────────────

/**
 * CSL AND — semantic alignment measure.
 * Returns the cosine similarity ∈ [-1, +1] between two vectors.
 * @param {number[]} a - unit vector
 * @param {number[]} b - unit vector
 * @returns {number} cosine similarity
 */
function cslAND(a, b) {
  return cosineSimilarity(a, b);
}

/**
 * CSL OR — superposition (soft union).
 * normalize(a + b) gives a vector pointing between a and b.
 * @param {number[]} a - vector
 * @param {number[]} b - vector
 * @returns {number[]} normalized superposition
 */
function cslOR(a, b) {
  const sum = a.map((v, i) => v + b[i]);
  return normalize(sum);
}

/**
 * CSL NOT — orthogonal projection (semantic negation).
 * Removes the component of a that aligns with b.
 * NOT(NOT(a,b),b) = NOT(a,b) — idempotent.
 * Result is orthogonal to b: NOT(a,b)·b ≈ 0.
 * @param {number[]} a - source vector
 * @param {number[]} b - reference vector (the "not-this" concept)
 * @returns {number[]} orthogonal component of a w.r.t. b (normalized)
 */
function cslNOT(a, b) {
  const proj = project(a, b);
  const residual = a.map((v, i) => v - proj[i]);
  return normalize(residual);
}

/**
 * CSL IMPLY — semantic implication via projection.
 * Projects a onto b: the component of a in the direction of b.
 * High output means a → b (a implies b).
 * @param {number[]} a - antecedent vector
 * @param {number[]} b - consequent vector
 * @returns {number[]} projection of a onto b (normalized)
 */
function cslIMPLY(a, b) {
  return normalize(project(a, b));
}

/**
 * CSL XOR — exclusive semantic components.
 * OR(a,b) minus the mutual projection; preserves exclusive content.
 * @param {number[]} a - vector
 * @param {number[]} b - vector
 * @returns {number[]} exclusive superposition (normalized)
 */
function cslXOR(a, b) {
  const orVec = cslOR(a, b);
  // Remove mutual projection to isolate exclusive content
  const projA = project(orVec, a);
  const projB = project(orVec, b);
  const mutual = normalize(projA.map((v, i) => v + projB[i]));
  const exclusive = orVec.map((v, i) => v - mutual[i] * CSL_THRESHOLDS.MINIMUM);
  return normalize(exclusive);
}

/**
 * CSL CONSENSUS — weighted centroid of N agent opinion vectors.
 * Approximates a Bayesian posterior over vector beliefs.
 * @param {Array<{vector: number[], weight?: number}>} agents - array of {vector, weight}
 * @returns {number[]} normalized consensus vector
 */
function cslConsensus(agents) {
  if (!agents || agents.length === 0) throw new Error('cslConsensus: agents array is empty');

  // Default uniform weights if not provided; otherwise normalize weights
  const total = agents.reduce((s, a) => s + (a.weight != null ? a.weight : 1), 0);
  const dims = agents[0].vector.length;
  const centroid = new Array(dims).fill(0);
  for (const agent of agents) {
    const w = (agent.weight != null ? agent.weight : 1) / (total || 1);
    for (let i = 0; i < dims; i++) {
      centroid[i] += w * agent.vector[i];
    }
  }
  return normalize(centroid);
}
function cslGateOp(value, cosScore, tau = DEFAULT_TAU, temp = PHI_TEMPERATURE) {
  return cslGate(value, cosScore, tau, temp);
}

/**
 * CSL BLEND — smooth interpolation between two weights based on cosine alignment.
 * Returns wHigh when cosScore ≫ tau, wLow when cosScore ≪ tau.
 * Re-exports phi-math primitive with CSL defaults.
 * @param {number} wHigh - weight used when aligned
 * @param {number} wLow  - weight used when not aligned
 * @param {number} cosScore
 * @param {number} [tau=DEFAULT_TAU]
 * @returns {number}
 */
function cslBlendOp(wHigh, wLow, cosScore, tau = DEFAULT_TAU) {
  return cslBlend(wHigh, wLow, cosScore, tau);
}

/**
 * Classify a cosine score into a CSL truth value.
 * @param {number} cosScore - value ∈ [-1, +1]
 * @returns {'TRUE'|'UNKNOWN'|'FALSE'}
 */
function cslClassify(cosScore) {
  if (cosScore >= CSL_THRESHOLDS.MINIMUM) return 'TRUE';
  if (cosScore <= -CSL_THRESHOLDS.MINIMUM) return 'FALSE';
  return 'UNKNOWN';
}
function cslAdaptiveGate(value, cosScore, entropy, maxEntropy, tau = DEFAULT_TAU) {
  const temp = adaptiveTemperature(entropy, maxEntropy);
  return cslGate(value, cosScore, tau, temp);
}

// ─── Phi-weighted vector fusion ──────────────────────────────────────────────

/**
 * Phi-weighted fusion of N vectors using golden-ratio weights.
 * Useful for blending hierarchical representations.
 * @param {number[][]} vectors - array of same-dimension vectors
 * @returns {number[]} normalized fused vector
 */
function cslPhiFusion(vectors) {
  if (!vectors || vectors.length === 0) throw new Error('cslPhiFusion: no vectors');
  const weights = phiFusionWeights(vectors.length);
  const dims = vectors[0].length;
  const fused = new Array(dims).fill(0);
  for (let v = 0; v < vectors.length; v++) {
    for (let i = 0; i < dims; i++) {
      fused[i] += weights[v] * vectors[v][i];
    }
  }
  return normalize(fused);
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Gate operations
  cslAND,
  cslOR,
  cslNOT,
  cslIMPLY,
  cslXOR,
  cslConsensus,
  cslGate: cslGateOp,
  cslBlend: cslBlendOp,
  // Utilities
  cslClassify,
  cslAdaptiveGate,
  cslPhiFusion,
  // Re-exports for consumers
  PHI_TEMPERATURE,
  DEFAULT_TAU,
  // Vector primitives
  dot,
  project
};