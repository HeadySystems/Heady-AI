/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * @module vector-ops/arithmetic
 * @description Full vector space operations for 384-dimensional embeddings.
 *   Includes add, subtract, scale, normalize, cosineSimilarity, dotProduct,
 *   magnitude, centroid, lerp, and slerp. All operations validate dimension
 *   compatibility and guard against degenerate inputs.
 *
 *   Design note: slerp degrades gracefully to lerp when vectors are nearly
 *   parallel (cosine > 0.9999) or nearly antipodal (cosine < -0.9999) to
 *   avoid numerical instability.
 */

import { PHI, PSI, CSL } from '../shared/phi-math.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Vec = number[];

/** Canonical embedding dimension (384D Sentence-BERT / text-embedding-004) */
export const EMBEDDING_DIM = 384;

// ─── Validation Helpers ───────────────────────────────────────────────────────

function assertSameDim(a: Vec, b: Vec, op: string): void {
  if (a.length !== b.length) {
    throw new RangeError(
      `${op}: dimension mismatch — a.length=${a.length}, b.length=${b.length}.`,
    );
  }
}

function assertNonEmpty(v: Vec, op: string): void {
  if (v.length === 0) {
    throw new RangeError(`${op}: vector must be non-empty.`);
  }
}

function assertFinite(v: Vec, op: string): void {
  for (let i = 0; i < v.length; i++) {
    if (!Number.isFinite(v[i]!)) {
      throw new TypeError(`${op}: vector[${i}] is not finite (got ${v[i]}).`);
    }
  }
}

function validate(v: Vec, op: string): void {
  assertNonEmpty(v, op);
  assertFinite(v, op);
}

function validatePair(a: Vec, b: Vec, op: string): void {
  validate(a, op);
  validate(b, op);
  assertSameDim(a, b, op);
}

// ─── Core Operations ──────────────────────────────────────────────────────────

/**
 * Element-wise addition: result[i] = a[i] + b[i]
 */
export function add(a: Vec, b: Vec): Vec {
  validatePair(a, b, 'add');
  return a.map((ai, i) => ai + b[i]!);
}

/**
 * Element-wise subtraction: result[i] = a[i] - b[i]
 */
export function subtract(a: Vec, b: Vec): Vec {
  validatePair(a, b, 'subtract');
  return a.map((ai, i) => ai - b[i]!);
}

/**
 * Scalar multiplication: result[i] = v[i] * scalar
 */
export function scale(v: Vec, scalar: number): Vec {
  validate(v, 'scale');
  if (!Number.isFinite(scalar)) {
    throw new TypeError(`scale: scalar must be a finite number (got ${scalar}).`);
  }
  return v.map(vi => vi * scalar);
}

/**
 * L2 norm (Euclidean magnitude): sqrt(Σ v[i]²)
 */
export function magnitude(v: Vec): number {
  validate(v, 'magnitude');
  let sumSq = 0;
  for (let i = 0; i < v.length; i++) sumSq += v[i]! * v[i]!;
  return Math.sqrt(sumSq);
}

/**
 * L2 normalization: v / ||v||
 * Returns a zero vector if ||v|| ≈ 0 (degenerate embedding — never route these).
 */
export function normalize(v: Vec): Vec {
  validate(v, 'normalize');
  const mag = magnitude(v);
  if (mag < Number.EPSILON) {
    // Degenerate vector — return zero vector; callers should detect this.
    return new Array(v.length).fill(0) as Vec;
  }
  return v.map(vi => vi / mag);
}

/**
 * Dot product: Σ a[i] * b[i]
 */
export function dotProduct(a: Vec, b: Vec): number {
  validatePair(a, b, 'dotProduct');
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
  return sum;
}

/**
 * Cosine similarity: (a · b) / (||a|| × ||b||)
 * Returns 0 if either vector is degenerate (zero magnitude).
 * Result is clamped to [-1, 1] to correct floating-point drift.
 */
export function cosineSimilarity(a: Vec, b: Vec): number {
  validatePair(a, b, 'cosineSimilarity');
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA < Number.EPSILON || magB < Number.EPSILON) return 0;
  const cosine = dotProduct(a, b) / (magA * magB);
  // Clamp to [-1, 1] to handle floating-point imprecision
  return Math.max(-1, Math.min(1, cosine));
}

/**
 * Centroid (mean vector) of an array of vectors.
 * All vectors must have the same dimension.
 */
export function centroid(vectors: Vec[]): Vec {
  if (vectors.length === 0) {
    throw new RangeError('centroid: vectors array must be non-empty.');
  }
  const dim = vectors[0]!.length;
  if (dim === 0) {
    throw new RangeError('centroid: vectors must be non-empty.');
  }

  // Validate all vectors
  for (let vi = 0; vi < vectors.length; vi++) {
    validate(vectors[vi]!, 'centroid');
    if (vectors[vi]!.length !== dim) {
      throw new RangeError(
        `centroid: dimension mismatch at index ${vi} — expected ${dim}, got ${vectors[vi]!.length}.`,
      );
    }
  }

  const result = new Array<number>(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) {
      result[i]! += v[i]!;
    }
  }
  const n = vectors.length;
  return result.map(x => x / n);
}

/**
 * Linear interpolation: a + t*(b - a)
 * t ∈ [0, 1] — t=0 returns a, t=1 returns b.
 */
export function lerp(a: Vec, b: Vec, t: number): Vec {
  validatePair(a, b, 'lerp');
  if (!Number.isFinite(t) || t < 0 || t > 1) {
    throw new RangeError(`lerp: t must be in [0, 1] (got ${t}).`);
  }
  return a.map((ai, i) => ai + t * (b[i]! - ai));
}

/**
 * Spherical linear interpolation (slerp) on the unit hypersphere.
 *
 * Follows the standard slerp formula:
 *   slerp(a, b, t) = sin((1-t)θ)/sin(θ) * a + sin(tθ)/sin(θ) * b
 *
 * Where θ = arccos(a · b) for unit vectors.
 *
 * Falls back to lerp (then normalizes) when:
 *   - Vectors are nearly parallel   (cosine > 1 - 1e-10)
 *   - Vectors are nearly antipodal  (cosine < -1 + 1e-10)
 *
 * Input vectors are normalized before interpolation.
 * t ∈ [0, 1].
 */
export function slerp(a: Vec, b: Vec, t: number): Vec {
  validatePair(a, b, 'slerp');
  if (!Number.isFinite(t) || t < 0 || t > 1) {
    throw new RangeError(`slerp: t must be in [0, 1] (got ${t}).`);
  }

  const aN = normalize(a);
  const bN = normalize(b);

  const dot = Math.max(-1, Math.min(1, dotProduct(aN, bN)));

  // Near-parallel: lerp + normalize
  if (dot > 1 - 1e-10) {
    return normalize(lerp(aN, bN, t));
  }

  // Antipodal: choose an arbitrary perpendicular for graceful interpolation
  if (dot < -1 + 1e-10) {
    // Rotate halfway through a phi-derived orthogonal arc
    const halfT = t * Math.PI;
    const ort   = findOrthogonalUnit(aN);
    const sinHalf = Math.sin(halfT);
    const cosHalf = Math.cos(halfT);
    return aN.map((ai, i) => cosHalf * ai + sinHalf * ort[i]!);
  }

  const theta    = Math.acos(dot);
  const sinTheta = Math.sin(theta);
  const scaleA   = Math.sin((1 - t) * theta) / sinTheta;
  const scaleB   = Math.sin(t * theta)        / sinTheta;

  return aN.map((ai, i) => scaleA * ai + scaleB * bN[i]!);
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Find a unit vector orthogonal to v using Gram-Schmidt.
 * Used by slerp to handle antipodal vectors.
 */
function findOrthogonalUnit(v: Vec): Vec {
  const dim = v.length;
  // Start with the standard basis vector e_k where v[k] has smallest magnitude
  let minIdx = 0;
  let minAbs = Math.abs(v[0]!);
  for (let i = 1; i < dim; i++) {
    const a = Math.abs(v[i]!);
    if (a < minAbs) { minAbs = a; minIdx = i; }
  }

  // Gram-Schmidt: e_k - (e_k · v) * v
  const ek = new Array<number>(dim).fill(0);
  ek[minIdx] = 1;

  const proj  = dotProduct(ek, v);
  const ortho = ek.map((eki, i) => eki - proj * v[i]!);
  return normalize(ortho);
}

// ─── φ-Weighted Combination ───────────────────────────────────────────────────

/**
 * φ-weighted superposition of two vectors.
 * weight = [PSI, PSI²] = [0.618, 0.382] — standard phi-fusion weights.
 * Used by memory scoring, context blending, and attention heads.
 */
export function phiFuse(primary: Vec, secondary: Vec): Vec {
  validatePair(primary, secondary, 'phiFuse');
  // phiFusionWeights(2) = [0.618, 0.382]
  const w0 = PSI;           // 0.618
  const w1 = PSI * PSI;     // 0.382
  return primary.map((pi, i) => w0 * pi + w1 * secondary[i]!);
}

/**
 * Orthogonal projection of a onto b.
 * CSL NOT operation: a - proj_b(a)
 */
export function project(a: Vec, b: Vec): Vec {
  validatePair(a, b, 'project');
  const magBSq = dotProduct(b, b);
  if (magBSq < Number.EPSILON) {
    return new Array<number>(a.length).fill(0);
  }
  const scalar = dotProduct(a, b) / magBSq;
  return b.map(bi => scalar * bi);
}

/**
 * Remove the component of a that lies along b (CSL NOT).
 * Returns the part of a perpendicular to b.
 */
export function orthogonalComplement(a: Vec, b: Vec): Vec {
  validatePair(a, b, 'orthogonalComplement');
  const proj = project(a, b);
  return subtract(a, proj);
}

/**
 * Check if two vectors are semantically identical (cosine > CSL.DEDUP = 0.972).
 */
export function isDuplicate(a: Vec, b: Vec): boolean {
  return cosineSimilarity(a, b) >= CSL.DEDUP;
}

/**
 * Check if two vectors meet the coherence floor (cosine ≥ CSL.MEDIUM = 0.809).
 */
export function isCoherent(a: Vec, b: Vec): boolean {
  return cosineSimilarity(a, b) >= CSL.MEDIUM;
}

// ─── Batch Utilities ──────────────────────────────────────────────────────────

/**
 * Pairwise cosine similarity matrix (upper-triangular computed, rest mirrored).
 * Returns an N×N matrix where matrix[i][j] = cosineSimilarity(vectors[i], vectors[j]).
 */
export function similarityMatrix(vectors: Vec[]): number[][] {
  const n = vectors.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    matrix[i]![i] = 1;
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(vectors[i]!, vectors[j]!);
      matrix[i]![j] = sim;
      matrix[j]![i] = sim;
    }
  }
  return matrix;
}

/**
 * Find the k nearest neighbors of a query vector by cosine similarity.
 * Returns indices sorted by descending similarity.
 */
export function kNearestNeighbors(
  query:   Vec,
  corpus:  Vec[],
  k:       number,
): Array<{ index: number; similarity: number }> {
  if (k <= 0 || !Number.isInteger(k)) {
    throw new RangeError(`kNearestNeighbors: k must be a positive integer (got ${k}).`);
  }
  const scored = corpus.map((v, index) => ({
    index,
    similarity: cosineSimilarity(query, v),
  }));
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, Math.min(k, scored.length));
}
