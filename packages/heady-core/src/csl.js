// packages/heady-core/src/csl.js
// §1 — Continuous Semantic Logic (CSL) Classifier
import { CSL, PHI_INV } from './phi.js';

/**
 * Classify a raw CSL score into a named tier.
 * @param {number} score — 0.0 to 1.0
 * @returns {{ value: number, tier: string, label: string }}
 */
export function classifyCSL(score) {
  if (score >= CSL.CORE)    return { value: score, tier: 'core',    label: 'CORE ACTIVE' };
  if (score >= CSL.INCLUDE) return { value: score, tier: 'include', label: 'INCLUDE' };
  if (score >= CSL.RECALL)  return { value: score, tier: 'recall',  label: 'RECALL' };
  return { value: score, tier: 'void', label: 'FILTER' };
}

/**
 * Compute a φ-weighted composite CSL score from an array of scores.
 * Each successive score decays by PHI_INV unless custom weights provided.
 * @param {number[]} scores
 * @param {number[]} [weights]
 * @returns {number}
 */
export function compositeCSL(scores, weights) {
  const w = weights ?? scores.map((_, i) => Math.pow(PHI_INV, i));
  const total = w.reduce((a, b) => a + b, 0);
  return scores.reduce((sum, s, i) => sum + s * (w[i] / total), 0);
}

/**
 * Check if a score passes the minimum gate for inclusion.
 * @param {number} score
 * @param {number} [gate=CSL.INCLUDE]
 * @returns {boolean}
 */
export function passesGate(score, gate = CSL.INCLUDE) {
  return score >= gate;
}
