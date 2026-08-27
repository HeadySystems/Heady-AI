// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ CSL Engine v1.0.0 — Continuous Semantic Logic            ║
// ║  Geometric logic gates over unit vectors + the ternary cslGate.   ║
// ║  Made with ❤️ by HeadySystems Inc. · ⚠️ PATENT zone                ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Vectors-as-logic: AND=cosine, OR=superposition, NOT=orthogonal projection,
// IMPLY/XOR/CONSENSUS, plus the 3-layer ternary gate (EXECUTE/CAUTIOUS/HALT).
// Ported from shared/csl-engine-v2.js → ESM, dependency-free except @heady/phi-math.
// Pure functions only (no IO) so the IP is unit-testable.

import { PSI, GATE } from "@heady/phi-math";

/** Locked retrieval/embedding dimension (ADR-0015: bge-small-en-v1.5). */
export const DIM = 384;

// ─── Vector primitives ────────────────────────────────────────────────────────
function assertVectors(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) throw new TypeError("csl: vectors must be arrays");
  if (a.length !== b.length) throw new RangeError(`csl: dimension mismatch ${a.length} vs ${b.length}`);
  if (a.length === 0) throw new RangeError("csl: vectors must be non-empty");
}

export function dot(a, b) {
  assertVectors(a, b);
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function magnitude(v) {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s);
}

export function normalize(v) {
  const m = magnitude(v);
  return m === 0 ? v.slice() : v.map((x) => x / m);
}

/** Cosine similarity ∈ [-1, 1]. The CSL truth value τ(a,b). */
export function cosineSimilarity(a, b) {
  assertVectors(a, b);
  const ma = magnitude(a);
  const mb = magnitude(b);
  if (ma === 0 || mb === 0) return 0;
  return dot(a, b) / (ma * mb);
}

export function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

// ─── Geometric logic gates ────────────────────────────────────────────────────
/** AND — semantic conjunction = cosine similarity (scalar truth). */
export function cslAND(a, b) {
  return cosineSimilarity(a, b);
}

/** OR — superposition, normalized (vector). */
export function cslOR(a, b) {
  assertVectors(a, b);
  return normalize(a.map((v, i) => v + b[i]));
}

/** NOT — a with its projection onto b removed (orthogonal complement, vector). */
export function cslNOT(a, b) {
  assertVectors(a, b);
  const bMag2 = dot(b, b);
  if (bMag2 === 0) return normalize(a);
  const k = dot(a, b) / bMag2;
  return normalize(a.map((v, i) => v - k * b[i]));
}

/** IMPLY — degree a ⇒ b ∈ [0,1] (rectified cosine; 0 when contradictory). */
export function cslIMPLY(a, b) {
  return Math.max(0, cosineSimilarity(a, b));
}

/** XOR — exclusivity ∈ [0,1]: 1 when orthogonal, 0 when aligned/anti-aligned. */
export function cslXOR(a, b) {
  return 1 - Math.abs(cosineSimilarity(a, b));
}

/** CONSENSUS — normalized centroid of n vectors (vector). */
export function cslCONSENSUS(vectors) {
  if (!Array.isArray(vectors) || vectors.length === 0) throw new RangeError("csl: CONSENSUS needs ≥1 vector");
  const dim = vectors[0].length;
  const acc = new Array(dim).fill(0);
  for (const v of vectors) {
    if (v.length !== dim) throw new RangeError("csl: CONSENSUS dimension mismatch");
    for (let i = 0; i < dim; i++) acc[i] += v[i];
  }
  return normalize(acc.map((x) => x / vectors.length));
}

/** Scalar blend: w·a + (1−w)·b, default w = ψ (golden weight). */
export function cslBlend(a, b, w = PSI) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new TypeError("csl: cslBlend needs finite scalars");
  return w * a + (1 - w) * b;
}

// ─── The 3-layer ternary gate ─────────────────────────────────────────────────
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Ternary decision gate. Combines a confidence `value` with a relevance
 * `cosScore` (geometric mean — both must be high to pass), then bands it:
 *   score ≥ execute → "EXECUTE" · score ≥ halt → "CAUTIOUS" · else "HALT".
 *
 * @param {number} value     confidence ∈ [0,1]
 * @param {number} [cosScore] cosine relevance ∈ [-1,1]; omit to gate on value alone
 * @param {{halt:number,execute:number}|number} [tau] thresholds; a number is the
 *        EXECUTE threshold (HALT derived as tau·ψ). Defaults to φ-derived GATE.
 * @returns {"EXECUTE"|"CAUTIOUS"|"HALT"}
 */
export function cslGate(value, cosScore, tau = GATE) {
  const v = clamp01(Number.isFinite(value) ? value : 0);
  const c = Number.isFinite(cosScore) ? clamp01(cosScore) : null;
  const score = c === null ? v : Math.sqrt(v * c);

  let halt;
  let execute;
  if (typeof tau === "number") {
    execute = tau;
    halt = tau * PSI;
  } else {
    halt = tau?.halt ?? GATE.HALT;
    execute = tau?.execute ?? GATE.EXECUTE;
  }
  if (score >= execute) return "EXECUTE";
  if (score >= halt) return "CAUTIOUS";
  return "HALT";
}

// Re-export φ-backoff so consumers can `import { cslGate, phiBackoff } from "@heady/csl-engine"`.
export { phiBackoff, phiBackoffMs, GATE } from "@heady/phi-math";
