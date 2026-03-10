/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  @heady/platform — csl/index.js                                  ║
 * ║  Continuous Semantic Logic (CSL) Engine                          ║
 * ║  Geometric vector operations as logical gates                    ║
 * ║  © 2026 HeadySystems Inc. — 51 Provisional Patents             ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * CSL replaces ranking-based routing. Domain membership is determined
 * by cosine similarity (semantic alignment) between request vectors
 * and domain embedding centroids. No integer routing queues.
 * No hardcoded routing weights. Only geometric truth values.
 *
 * Truth value: τ(a,b) = cos(θ) ∈ [-1, +1]
 *   +1 = aligned  (TRUE)
 *    0 = orthogonal (UNKNOWN)
 *   -1 = antipodal (FALSE)
 */

'use strict';

import {
  PHI, PSI, PSI2, PSI3, CSL_THRESHOLDS, phiThreshold, phiFusion,
} from '../phi/index.js';

// ─── VECTOR PRIMITIVES ───────────────────────────────────────────────────────

/**
 * Dot product of two numeric arrays.
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {number}
 */
export function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/**
 * L2 norm of a vector.
 * @param {Float64Array|number[]} v
 * @returns {number}
 */
export function norm(v) {
  return Math.sqrt(dot(v, v));
}

/**
 * Normalize a vector to unit length. Returns zero vector if magnitude is 0.
 * @param {Float64Array|number[]} v
 * @returns {Float64Array}
 */
export function normalize(v) {
  const n = norm(v);
  if (n === 0) return new Float64Array(v.length);
  const out = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
  return out;
}

// ─── CSL GATE OPERATIONS ─────────────────────────────────────────────────────

/**
 * CSL AND — Cosine similarity (semantic alignment).
 * AND(a, b) = (a·b) / (‖a‖·‖b‖) ∈ [-1, +1]
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {number}
 */
export function cslAND(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return dot(a, b) / (na * nb);
}

/**
 * CSL OR — Superposition (soft union): normalize(a + b).
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {Float64Array}
 */
export function cslOR(a, b) {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] + b[i];
  return normalize(out);
}

/**
 * CSL NOT — Orthogonal projection (semantic negation).
 * NOT(a, b) = a - proj_b(a) = a - (a·b / ‖b‖²)·b
 * The result is orthogonal to b: NOT(a,b)·b ≈ 0
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b — reference direction to negate
 * @returns {Float64Array}
 */
export function cslNOT(a, b) {
  const nb2 = dot(b, b);
  if (nb2 === 0) return new Float64Array(a);
  const proj = dot(a, b) / nb2;
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] - proj * b[i];
  return out;
}

/**
 * CSL XOR — Superposition minus intersection.
 * XOR(a, b) = normalize( cslOR(a,b) - cslAND_vec(a,b) )
 * where cslAND_vec(a,b) = normalize(a+b) × cosine(a,b)
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {Float64Array}
 */
export function cslXOR(a, b) {
  const sim = cslAND(a, b);
  const sup = cslOR(a, b);
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = sup[i] * (1 - Math.abs(sim));
  return normalize(out);
}

/**
 * Phi-weighted soft gate: σ( k(x - 0.5) ) with k = F(8) = 21.
 * Replaces binary threshold with smooth phi-compliant transition.
 * @param {number} similarity — cosine similarity ∈ [-1, +1]
 * @returns {number} gate value ∈ (0, 1)
 */
export function cslSoftGate(similarity) {
  const k = 21; // F(8) — steepness
  return 1 / (1 + Math.exp(-k * (similarity - 0.5)));
}

/**
 * Ternary CSL evaluation: returns 'TRUE' | 'UNKNOWN' | 'FALSE'
 * based on phi-derived thresholds:
 *   TRUE  if similarity >= ψ   (0.618)
 *   FALSE if similarity <= ψ²  (0.382)
 *   else  UNKNOWN
 * @param {number} similarity
 * @returns {'TRUE'|'UNKNOWN'|'FALSE'}
 */
export function cslTernary(similarity) {
  if (similarity >= PSI)  return 'TRUE';
  if (similarity <= PSI2) return 'FALSE';
  return 'UNKNOWN';
}

// ─── CSL DOMAIN MATCHING ─────────────────────────────────────────────────────
// IMPORTANT: This replaces ALL ranking-based routing.
// Domain selection is ALWAYS based on CSL cosine alignment,
// never on integer routing values or ordered queues.

/**
 * @typedef {Object} DomainEntry
 * @property {string} id — domain identifier (e.g. 'headyme')
 * @property {Float64Array|number[]} centroid — unit embedding for this domain
 * @property {string} url — canonical URL
 * @property {string} [description]
 */

/**
 * @typedef {Object} DomainMatch
 * @property {DomainEntry} domain
 * @property {number} similarity — cosine similarity ∈ [-1, +1]
 * @property {string} ternary — 'TRUE' | 'UNKNOWN' | 'FALSE'
 * @property {number} gateScore — soft gate value ∈ (0, 1)
 * @property {boolean} passes — true if similarity >= CSL_THRESHOLDS.PASS
 */

/**
 * Compute CSL domain matches for a query embedding.
 * Returns domains sorted by cosine similarity descending.
 * No routing integers. No hardcoded order. Pure geometric alignment.
 *
 * @param {Float64Array|number[]} queryEmbedding — query unit vector
 * @param {DomainEntry[]} domains — registered domain entries
 * @param {number} [threshold=CSL_THRESHOLDS.PASS] — minimum similarity to include
 * @returns {DomainMatch[]} sorted matches (most aligned first)
 */
export function cslDomainMatch(queryEmbedding, domains, threshold = CSL_THRESHOLDS.PASS) {
  const results = [];

  for (const domain of domains) {
    const similarity = cslAND(queryEmbedding, domain.centroid);
    const gateScore = cslSoftGate(similarity);
    const ternary = cslTernary(similarity);
    const passes = similarity >= threshold;

    results.push({ domain, similarity, ternary, gateScore, passes });
  }

  // Sort by cosine similarity descending — geometric truth, not manual ranking
  results.sort((a, b) => b.similarity - a.similarity);

  return results.filter(r => r.similarity >= threshold);
}

/**
 * Select the best-matching domain (highest cosine similarity).
 * Returns null if no domain exceeds the threshold.
 *
 * @param {Float64Array|number[]} queryEmbedding
 * @param {DomainEntry[]} domains
 * @param {number} [threshold=CSL_THRESHOLDS.PASS]
 * @returns {DomainMatch|null}
 */
export function cslSelectDomain(queryEmbedding, domains, threshold = CSL_THRESHOLDS.PASS) {
  const matches = cslDomainMatch(queryEmbedding, domains, threshold);
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Multi-label CSL assignment: return all domains where ternary == 'TRUE'.
 * A single request can legitimately belong to multiple domains.
 *
 * @param {Float64Array|number[]} queryEmbedding
 * @param {DomainEntry[]} domains
 * @returns {DomainMatch[]}
 */
export function cslMultiDomainAssign(queryEmbedding, domains) {
  return cslDomainMatch(queryEmbedding, domains, PSI) // ψ = 0.618 for TRUE
    .filter(r => r.ternary === 'TRUE');
}

// ─── CSL CONFIDENCE GATE ─────────────────────────────────────────────────────

/**
 * Check if a set of confidence scores all pass the CSL threshold.
 * ALL seven archetypes must exceed 0.618 before output is produced (Law #3).
 *
 * @param {number[]} confidences — array of archetype confidence values
 * @param {number} [threshold=CSL_THRESHOLDS.PASS] — default ψ = 0.618
 * @returns {{ passes: boolean, failing: number[], min: number }}
 */
export function cslConfidenceGate(confidences, threshold = CSL_THRESHOLDS.PASS) {
  const failing = confidences.filter(c => c < threshold);
  const min = Math.min(...confidences);
  return { passes: failing.length === 0, failing, min };
}

/**
 * Blend multiple embeddings using φ-weighted average.
 * Weights: w_i = ψ^i (φ⁻¹ power series)
 *
 * @param {Array<Float64Array|number[]>} embeddings
 * @returns {Float64Array} normalized blend
 */
export function cslPhiBlend(embeddings) {
  if (!embeddings.length) throw new Error('cslPhiBlend: empty embeddings array');
  const dim = embeddings[0].length;
  const out = new Float64Array(dim);
  let totalWeight = 0;

  for (let i = 0; i < embeddings.length; i++) {
    const w = Math.pow(PSI, i);
    totalWeight += w;
    for (let j = 0; j < dim; j++) out[j] += embeddings[i][j] * w;
  }

  for (let j = 0; j < dim; j++) out[j] /= totalWeight;
  return normalize(out);
}

/**
 * CSL resonance check: are two vectors semantically identical (dedup gate)?
 * Returns true if cosine similarity >= 0.927 (phiThreshold(4)).
 *
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {boolean}
 */
export function cslResonance(a, b) {
  return cslAND(a, b) >= CSL_THRESHOLDS.RESONANT;
}

export { CSL_THRESHOLDS, phiThreshold, PHI, PSI, PSI2, PSI3 };
