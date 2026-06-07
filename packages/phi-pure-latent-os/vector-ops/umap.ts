// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: packages/phi-pure-latent-os/vector-ops/umap.ts                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * @module vector-ops/umap
 * @description Simplified UMAP (Uniform Manifold Approximation and Projection)
 *   for dimensionality reduction from 384D → 2D or 3D. Used for visualization
 *   of the 384D Heady embedding space.
 *
 *   Parameters:
 *     nNeighbors  = FIB[8]   = 21       — local neighborhood size
 *     minDist     = PSI*PSI  = 0.382    — minimum separation in low-dim space
 *     nComponents = 2 | 3              — output dimensions
 *
 *   Algorithm:
 *     1. Compute k-NN graph (cosine distance)
 *     2. Compute fuzzy simplicial set (membership strengths)
 *     3. Optimize low-dimensional embedding via force-directed layout
 *
 *   NOTE: This is a self-contained simplified UMAP suitable for small-to-medium
 *   corpora (< 10K vectors). For production scale, use the `umap-js` package.
 *   This module provides the full interface contract and a working implementation.
 */

import { PHI, PSI, FIB } from '../shared/phi-math.js';
import { cosineSimilarity, magnitude, normalize } from './arithmetic.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_N_NEIGHBORS  = FIB[8] as 21;    // 21 — FIB[8]
const DEFAULT_MIN_DIST     = PSI * PSI;        // 0.382 — PSI²
const DEFAULT_N_COMPONENTS = 2;
const DEFAULT_N_EPOCHS     = FIB[9] as 34;    // 34 — FIB[9] — enough for small corpora
const DEFAULT_LEARNING_RATE = PHI - 1;         // 0.618 — phi-harmonic LR
const NEGATIVE_SAMPLE_RATE = FIB[4] as 5;     // 5 negative samples per positive

// Force parameters (phi-harmonic)
const REPULSION_STRENGTH = 1.0;
const ATTRACTION_WEIGHT  = PSI;                // 0.618

// ─── Types ────────────────────────────────────────────────────────────────────

export type Vec = number[];

export interface UmapConfig {
  /** Local neighborhood size. Default: FIB[8]=21 */
  nNeighbors?:   number;
  /** Minimum distance in low-dim space. Default: PSI²≈0.382 */
  minDist?:      number;
  /** Output dimensions: 2 or 3. Default: 2 */
  nComponents?:  2 | 3;
  /** Training epochs. Default: FIB[9]=34 */
  nEpochs?:      number;
  /** Learning rate. Default: PHI-1≈0.618 */
  learningRate?: number;
  /** Random seed for reproducible results */
  seed?:         number;
}

export interface Point2D { x: number; y: number; }
export interface Point3D { x: number; y: number; z: number; }

export type UmapPoint = Point2D | Point3D;

export interface UmapResult {
  points:      UmapPoint[];
  config:      Required<UmapConfig>;
  durationMs:  number;
}

// ─── Seeded Random ────────────────────────────────────────────────────────────

/**
 * Mulberry32 — fast seeded 32-bit PRNG.
 * Returns a function that generates values in [0, 1).
 */
function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

// ─── K-NN Graph ───────────────────────────────────────────────────────────────

interface Neighbor {
  index:    number;
  distance: number;  // 1 - cosineSimilarity
}

/**
 * Compute cosine-distance k-NN graph for all vectors.
 * Returns an N×k matrix of (index, distance) pairs, sorted by ascending distance.
 */
function computeKnnGraph(
  vectors: Vec[],
  k:       number,
): Neighbor[][] {
  const n = vectors.length;
  const knn: Neighbor[][] = new Array(n);

  for (let i = 0; i < n; i++) {
    const row: Neighbor[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const sim  = cosineSimilarity(vectors[i]!, vectors[j]!);
      const dist = 1 - sim;  // cosine distance ∈ [0, 2]
      row.push({ index: j, distance: dist });
    }
    row.sort((a, b) => a.distance - b.distance);
    knn[i] = row.slice(0, k);
  }
  return knn;
}

// ─── Fuzzy Simplicial Set ─────────────────────────────────────────────────────

interface Edge {
  i:          number;
  j:          number;
  weight:     number;
}

/**
 * Compute membership strength for each k-NN edge using the UMAP smooth
 * approximation to the exponential decay kernel:
 *
 *   weight(d) = exp(-max(0, d - rho) / sigma)
 *
 * where rho = distance to nearest neighbor and sigma is chosen so that
 * Σ_j weight(d_ij) ≈ log2(k) (target entropy normalization).
 *
 * Symmetric combination: w(i,j) = w_ij + w_ji - w_ij * w_ji
 */
function computeFuzzySimplicialSet(
  knn:         Neighbor[][],
  nNeighbors:  number,
): Edge[] {
  const n          = knn.length;
  const targetLog  = Math.log2(nNeighbors);
  const sigmas     = new Array<number>(n).fill(1);
  const rhos       = new Array<number>(n).fill(0);

  // Compute rho (nearest neighbor distance) and sigma per point
  for (let i = 0; i < n; i++) {
    rhos[i] = knn[i]![0]?.distance ?? 0;

    // Binary search for sigma that achieves target entropy
    let lo = 0;
    let hi = 1000;
    for (let iter = 0; iter < 64; iter++) {
      const mid     = (lo + hi) / 2;
      let   entropy = 0;
      for (const nb of knn[i]!) {
        const shifted = Math.max(0, nb.distance - rhos[i]!);
        entropy += Math.exp(-shifted / mid);
      }
      if (Math.abs(entropy - targetLog) < 1e-6) {
        sigmas[i] = mid;
        break;
      }
      if (entropy > targetLog) { hi = mid; }
      else                     { lo = mid; }
      sigmas[i] = mid;
    }
  }

  // Build directed edge weights
  const edgeMap = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    for (const nb of knn[i]!) {
      const j       = nb.index;
      const shifted = Math.max(0, nb.distance - rhos[i]!);
      const w       = Math.exp(-shifted / sigmas[i]!);
      const key     = `${i}-${j}`;
      edgeMap.set(key, w);
    }
  }

  // Symmetrize: w(i,j) = w_ij + w_ji - w_ij * w_ji
  const edges: Edge[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < n; i++) {
    for (const nb of knn[i]!) {
      const j    = nb.index;
      const fwd  = `${i}-${j}`;
      const bwd  = `${j}-${i}`;
      if (seen.has(fwd) || seen.has(bwd)) continue;
      seen.add(fwd);
      seen.add(bwd);

      const wij = edgeMap.get(fwd) ?? 0;
      const wji = edgeMap.get(bwd) ?? 0;
      const w   = wij + wji - wij * wji;
      if (w > 0) edges.push({ i, j, weight: w });
    }
  }
  return edges;
}

// ─── Low-Dimensional Embedding Initialization ─────────────────────────────────

/**
 * Initialize low-dimensional embedding using spectral layout (approximate).
 * For simplicity, uses random initialization scaled to unit variance.
 */
function initEmbedding(
  n:           number,
  nComponents: number,
  rng:         () => number,
): number[][] {
  return Array.from({ length: n }, () =>
    Array.from({ length: nComponents }, () => (rng() - 0.5) * 2),
  );
}

// ─── Force-Directed Optimization ─────────────────────────────────────────────

/**
 * Clip gradient components to [-4, 4] to prevent exploding updates.
 */
function clip(v: number, lo = -4, hi = 4): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * UMAP attraction gradient for the curve (1 / (1 + a*d^(2b))) approximation.
 * We use a simplified version: attraction ∝ weight * distance.
 */
function attractionGrad(diff: number[], weight: number): number[] {
  const dist2 = diff.reduce((s, d) => s + d * d, 0);
  const dist  = Math.sqrt(dist2) + 1e-8;
  const grad  = -2 * weight / (dist * (1 + dist2));
  return diff.map(d => clip(grad * d * ATTRACTION_WEIGHT));
}

/**
 * UMAP repulsion gradient: (2 * gamma) / (dist^2 * (1 + dist^2))
 */
function repulsionGrad(diff: number[]): number[] {
  const dist2 = diff.reduce((s, d) => s + d * d, 0);
  if (dist2 < 1e-8) return diff.map(() => 4);
  const grad = 2 * REPULSION_STRENGTH / (dist2 * (1 + dist2));
  return diff.map(d => clip(grad * d));
}

/**
 * Optimize the low-dimensional embedding via stochastic gradient descent.
 * Uses negative sampling to approximate the repulsive force.
 */
function optimizeEmbedding(
  embedding:   number[][],
  edges:       Edge[],
  nEpochs:     number,
  learningRate: number,
  rng:          () => number,
): number[][] {
  const n       = embedding.length;
  const nComp   = embedding[0]!.length;

  for (let epoch = 0; epoch < nEpochs; epoch++) {
    // Decay learning rate with phi-harmonic schedule
    const lr = learningRate * Math.pow(PSI, epoch / nEpochs);

    for (const edge of edges) {
      const a = embedding[edge.i]!;
      const b = embedding[edge.j]!;
      const diff = a.map((ai, k) => ai - b[k]!);

      // Attraction
      const attrGrad = attractionGrad(diff, edge.weight);
      for (let k = 0; k < nComp; k++) {
        a[k]! += lr * attrGrad[k]!;
        b[k]! -= lr * attrGrad[k]!;
      }

      // Negative samples
      for (let s = 0; s < NEGATIVE_SAMPLE_RATE; s++) {
        const negIdx = Math.floor(rng() * n);
        if (negIdx === edge.i) continue;
        const c    = embedding[negIdx]!;
        const negDiff = a.map((ai, k) => ai - c[k]!);
        const repGrad = repulsionGrad(negDiff);
        for (let k = 0; k < nComp; k++) {
          a[k]! += lr * repGrad[k]!;
        }
      }
    }
  }

  return embedding;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Project 384D vectors to 2D or 3D using simplified UMAP.
 *
 * @param vectors384d  - Array of 384-dimensional embedding vectors
 * @param config       - UMAP configuration (all optional)
 * @returns UmapResult with projected points and runtime metadata
 *
 * @example
 * ```ts
 * const result = umapProject(embeddings, { nComponents: 2 });
 * result.points.forEach(p => console.log((p as Point2D).x, (p as Point2D).y));
 * ```
 */
export function umapProject(
  vectors384d: Vec[],
  config:      UmapConfig = {},
): UmapResult {
  if (!Array.isArray(vectors384d) || vectors384d.length === 0) {
    throw new RangeError('umapProject: vectors384d must be a non-empty array.');
  }
  if (vectors384d.length < 2) {
    throw new RangeError('umapProject: at least 2 vectors are required for UMAP projection.');
  }

  const startMs = Date.now();

  const resolvedConfig: Required<UmapConfig> = {
    nNeighbors:   config.nNeighbors   ?? DEFAULT_N_NEIGHBORS,
    minDist:      config.minDist      ?? DEFAULT_MIN_DIST,
    nComponents:  (config.nComponents ?? DEFAULT_N_COMPONENTS) as 2 | 3,
    nEpochs:      config.nEpochs      ?? DEFAULT_N_EPOCHS,
    learningRate: config.learningRate ?? DEFAULT_LEARNING_RATE,
    seed:         config.seed         ?? Math.floor(PHI * 1e9),  // phi-seeded
  };

  const { nNeighbors, nComponents, nEpochs, learningRate, seed } = resolvedConfig;

  // Clamp k to [1, n-1]
  const k = Math.min(nNeighbors, vectors384d.length - 1);

  const rng = createRng(seed);

  // Step 1: k-NN graph
  const knn = computeKnnGraph(vectors384d, k);

  // Step 2: Fuzzy simplicial set
  const edges = computeFuzzySimplicialSet(knn, k);

  // Step 3: Initialize + optimize embedding
  let embedding = initEmbedding(vectors384d.length, nComponents, rng);
  embedding     = optimizeEmbedding(embedding, edges, nEpochs, learningRate, rng);

  // Step 4: Format output
  const points: UmapPoint[] = embedding.map(coords => {
    if (nComponents === 3) {
      return { x: coords[0]!, y: coords[1]!, z: coords[2]! } as Point3D;
    }
    return { x: coords[0]!, y: coords[1]! } as Point2D;
  });

  return {
    points,
    config:     resolvedConfig,
    durationMs: Date.now() - startMs,
  };
}

// ─── Convenience Projectors ───────────────────────────────────────────────────

/**
 * Project 384D vectors to 2D (most common use case: scatter plot).
 */
export function umap2D(
  vectors384d: Vec[],
  config?:     Omit<UmapConfig, 'nComponents'>,
): Point2D[] {
  const result = umapProject(vectors384d, { ...config, nComponents: 2 });
  return result.points as Point2D[];
}

/**
 * Project 384D vectors to 3D (immersive topology visualization).
 */
export function umap3D(
  vectors384d: Vec[],
  config?:     Omit<UmapConfig, 'nComponents'>,
): Point3D[] {
  const result = umapProject(vectors384d, { ...config, nComponents: 3 });
  return result.points as Point3D[];
}
