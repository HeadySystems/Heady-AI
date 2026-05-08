// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ CSL Engine v5.0.0                                      ║
// ║  Continuous Semantic Logic — vector operations as logical gates ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

'use strict';

/**
 * @fileoverview CSL Engine — Continuous Semantic Logic core operations.
 *
 * Implements geometric vector logic: cosine similarity as truth value,
 * with AND, OR, NOT, IMPLY gates and phi-harmonic threshold gating.
 *
 * Domain: Unit vectors in ℝ³⁸⁴ (384-dimensional embeddings).
 * Truth value: τ(a,b) = cos(θ) ∈ [-1, +1]
 *   +1 = aligned (TRUE)
 *    0 = orthogonal (UNKNOWN)
 *   -1 = antipodal (FALSE)
 *
 * @module csl-engine
 * @version 5.0.0
 * @see HEA-146
 */

const {
  PHI,
  PSI,
  CSL_GATE_THRESHOLDS,
  dot,
  magnitude,
  normalize,
  cosineSimilarity
} = require('../shared/phi-math.js');

// ─────────────────────────────────────────────────────────────────────────────
// CSL GATE CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ordered gate levels from highest threshold to lowest.
 * Used for descending threshold comparison in cslGate().
 * @type {Array<{name: string, threshold: number}>}
 */
const GATE_LEVELS = [
  { name: 'DEDUP', threshold: CSL_GATE_THRESHOLDS.DEDUP },
  { name: 'CRITICAL', threshold: CSL_GATE_THRESHOLDS.CRITICAL },
  { name: 'HIGH', threshold: CSL_GATE_THRESHOLDS.HIGH },
  { name: 'MEDIUM', threshold: CSL_GATE_THRESHOLDS.MEDIUM },
  { name: 'LOW', threshold: CSL_GATE_THRESHOLDS.LOW },
  { name: 'MINIMUM', threshold: CSL_GATE_THRESHOLDS.MINIMUM }
];

/**
 * Classifies a cosine similarity score into a named CSL gate level.
 *
 * Gate levels (descending):
 * | Level    | Threshold |
 * |----------|-----------|
 * | DEDUP    | ≥ 0.972   |
 * | CRITICAL | ≥ 0.927   |
 * | HIGH     | ≥ 0.882   |
 * | MEDIUM   | ≥ 0.809   |
 * | LOW      | ≥ 0.691   |
 * | MINIMUM  | ≥ 0.500   |
 * | BELOW    | < 0.500   |
 *
 * @param {number} score - Cosine similarity score in [-1, 1]
 * @returns {string} Gate level name: 'DEDUP'|'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'|'MINIMUM'|'BELOW'
 *
 * @example
 * cslGate(0.95)  // 'CRITICAL'
 * cslGate(0.85)  // 'HIGH'
 * cslGate(0.30)  // 'BELOW'
 */
function cslGate(score) {
  for (const level of GATE_LEVELS) {
    if (score >= level.threshold) {
      return level.name;
    }
  }
  return 'BELOW';
}

// ─────────────────────────────────────────────────────────────────────────────
// CSL LOGICAL OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CSL AND — Geometric conjunction via cosine similarity.
 *
 * The AND of two vectors is their cosine similarity: how aligned they are.
 * High similarity = both "true" in the same semantic direction.
 *
 * @param {number[]} vecA - First 384D vector
 * @param {number[]} vecB - Second 384D vector
 * @returns {number} Cosine similarity in [-1, 1]
 *
 * @example
 * cslAND(embeddingA, embeddingB) // 0.87 → both vectors agree
 */
function cslAND(vecA, vecB) {
  return cosineSimilarity(vecA, vecB);
}

/**
 * CSL OR — Vector superposition (disjunction) normalized to unit length.
 *
 * The OR of two vectors is their element-wise sum, normalized.
 * The result points in the "average" direction — the semantic union.
 *
 * @param {number[]} vecA - First 384D vector
 * @param {number[]} vecB - Second 384D vector
 * @returns {number[]} Normalized superposition vector
 *
 * @example
 * const union = cslOR(embeddingA, embeddingB);
 * // union is a unit vector pointing between A and B
 */
function cslOR(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error(`cslOR: dimension mismatch (${vecA.length} vs ${vecB.length})`);
  }
  const sum = vecA.map((val, i) => val + vecB[i]);
  return normalize(sum);
}

/**
 * CSL NOT — Orthogonal projection rejection (negation relative to context).
 *
 * Removes the component of `vec` that lies along `context`, leaving only
 * the orthogonal remainder. This is semantic negation: "everything in
 * context that is NOT vec."
 *
 * Formula: NOT(v, c) = normalize(c - (c·v̂)v̂)
 *   where v̂ = normalize(v)
 *
 * @param {number[]} vec - The vector to negate
 * @param {number[]} context - The context vector (what remains after negation)
 * @returns {number[]} Normalized rejection vector
 *
 * @example
 * const notAnimal = cslNOT(animalEmbedding, queryEmbedding);
 * // notAnimal is the query with animal-semantics removed
 */
function cslNOT(vec, context) {
  if (vec.length !== context.length) {
    throw new Error(`cslNOT: dimension mismatch (${vec.length} vs ${context.length})`);
  }
  const unitVec = normalize(vec);
  const projection = dot(context, unitVec);
  const rejection = context.map((val, i) => val - projection * unitVec[i]);
  return normalize(rejection);
}

/**
 * CSL IMPLY — Projection of conclusion onto premise (material implication).
 *
 * Measures how much the conclusion is "contained in" or "implied by" the premise.
 * Returns the scalar projection magnitude: high = conclusion follows from premise.
 *
 * Formula: IMPLY(p, c) = (c · p̂) where p̂ = normalize(p)
 *
 * @param {number[]} premise - The premise vector
 * @param {number[]} conclusion - The conclusion vector to project
 * @returns {number} Projection magnitude — how much conclusion is implied by premise
 *
 * @example
 * cslIMPLY(premiseVec, conclusionVec) // 0.78 → conclusion mostly follows
 */
function cslIMPLY(premise, conclusion) {
  if (premise.length !== conclusion.length) {
    throw new Error(`cslIMPLY: dimension mismatch (${premise.length} vs ${conclusion.length})`);
  }
  const unitPremise = normalize(premise);
  return dot(conclusion, unitPremise);
}

// ─────────────────────────────────────────────────────────────────────────────
// THRESHOLD CHECK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks whether a cosine similarity score meets or exceeds a required gate level.
 *
 * @param {number} score - Cosine similarity score to check
 * @param {string} requiredLevel - Required gate level name: 'MINIMUM'|'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'|'DEDUP'
 * @returns {boolean} True if score meets or exceeds the required level's threshold
 * @throws {Error} If requiredLevel is not a valid gate level name
 *
 * @example
 * meetsThreshold(0.85, 'MEDIUM')   // true  (0.85 ≥ 0.809)
 * meetsThreshold(0.85, 'HIGH')     // false (0.85 < 0.882)
 * meetsThreshold(0.95, 'CRITICAL') // true  (0.95 ≥ 0.927)
 */
function meetsThreshold(score, requiredLevel) {
  const threshold = CSL_GATE_THRESHOLDS[requiredLevel];
  if (threshold === undefined) {
    throw new Error(
      `meetsThreshold: unknown level "${requiredLevel}". ` +
      `Valid levels: ${Object.keys(CSL_GATE_THRESHOLDS).join(', ')}`
    );
  }
  return score >= threshold;
}

// ─── CommonJS Exports ─────────────────────────────────────────────────────────

module.exports = {
  cosineSimilarity,
  cslGate,
  cslAND,
  cslOR,
  cslNOT,
  cslIMPLY,
  meetsThreshold,
  GATE_LEVELS,
  CSL_GATE_THRESHOLDS
};
