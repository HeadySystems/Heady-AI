/**
 * CSL Engine V2 — Cognitive Significance Level computation engine
 * with text embedding, geometric gates, and MoE routing.
 *
 * @module src/shared/csl-engine-v2
 * @version 2.0.0
 * @author HeadySystems™
 */

import { PHI, PSI, PSI2, CSL_THRESHOLDS, cosineSimilarity, cslGate, fibonacci, phiThreshold, sha256 } from './phi-math-v2.js';

// Re-export from phi-math-v2 for convenience
export { PHI, PSI, PSI2, CSL_THRESHOLDS, cosineSimilarity, cslGate, fibonacci, phiThreshold };

// ─── Embedding Dimension ─────────────────────────────────────────
export const DIM = 128;

// ─── Text → Embedding (deterministic hash-based for local use) ──
export function textToEmbedding(text, dim = DIM) {
  const str = String(text || '');
  const vec = new Float64Array(dim);
  for (let i = 0; i < dim; i++) {
    let h = 0;
    for (let j = 0; j < str.length; j++) {
      h = ((h << 5) - h + str.charCodeAt(j) * (i + 1)) | 0;
    }
    vec[i] = Math.sin(h * PHI) * PSI;
  }
  // Normalize
  let mag = 0;
  for (let i = 0; i < dim; i++) mag += vec[i] * vec[i];
  mag = Math.sqrt(mag) || 1;
  for (let i = 0; i < dim; i++) vec[i] /= mag;
  return Array.from(vec);
}

// ─── CSL Geometric Gates ─────────────────────────────────────────
export function cslAND(a, b) {
  if (!a || !b || a.length !== b.length) return [];
  return a.map((v, i) => v * b[i]);
}

export function cslOR(a, b) {
  if (!a || !b || a.length !== b.length) return a || b || [];
  const result = a.map((v, i) => v + b[i]);
  let mag = 0;
  for (const v of result) mag += v * v;
  mag = Math.sqrt(mag) || 1;
  return result.map(v => v / mag);
}

export function cslNOT(vec) {
  if (!vec) return [];
  return vec.map(v => -v);
}

export function cslCONSENSUS(vectors, weights) {
  if (!vectors || vectors.length === 0) return [];
  const dim = vectors[0].length;
  const result = new Array(dim).fill(0);
  const w = weights || vectors.map(() => 1 / vectors.length);
  for (let v = 0; v < vectors.length; v++) {
    for (let d = 0; d < dim; d++) {
      result[d] += (vectors[v][d] || 0) * (w[v] || 0);
    }
  }
  let mag = 0;
  for (const v of result) mag += v * v;
  mag = Math.sqrt(mag) || 1;
  return result.map(v => v / mag);
}

// ─── MoE CSL Router ─────────────────────────────────────────────
export class MoECSLRouter {
  constructor(experts = []) {
    this.experts = experts;
  }

  addExpert(name, embedding, handler) {
    this.experts.push({ name, embedding, handler });
  }

  route(queryEmbedding) {
    let best = null;
    let bestScore = -Infinity;
    for (const expert of this.experts) {
      const score = cosineSimilarity(queryEmbedding, expert.embedding);
      if (score > bestScore) {
        bestScore = score;
        best = expert;
      }
    }
    return best ? { expert: best.name, score: bestScore, handler: best.handler } : null;
  }
}

// ─── Trust Receipt Signer ────────────────────────────────────────
export class TrustReceiptSigner {
  constructor(secret = 'heady-trust-default') {
    this._secret = secret;
  }

  sign(payload) {
    const data = JSON.stringify(payload);
    const sig = sha256(data + this._secret);
    return { payload, signature: sig, timestamp: Date.now() };
  }

  verify(receipt) {
    if (!receipt || !receipt.payload || !receipt.signature) return false;
    const expected = sha256(JSON.stringify(receipt.payload) + this._secret);
    return expected === receipt.signature;
  }
}
