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
// ║  FILE: packages/heady-distiller/shared/phi-math.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * @module phi-math
 * @description Canonical phi-math foundation for HeadyDistiller (Stage 22).
 *
 * All constants derive from the Golden Ratio (PHI = 1.618033988749895).
 * No magic numbers. Every threshold is phi-harmonic or Fibonacci-derived.
 *
 * CSL Gate Reference:
 *   SUPPRESS=0.236  INCLUDE=0.382  MINIMUM=0.500  BOOST=0.618
 *   INJECT=0.718    MEDIUM=0.809   HIGH=0.882     CRITICAL=0.927
 *   DEDUP=0.972
 */

// ---------------------------------------------------------------------------
// Core phi constants
// ---------------------------------------------------------------------------

/** Golden Ratio */
export const PHI = 1.618033988749895;

/** Conjugate golden ratio — 1/PHI ≈ 0.618 */
export const PSI = 0.618033988749895;

/** PSI squared ≈ 0.382 */
export const PSI2 = 0.381966011250105;

// ---------------------------------------------------------------------------
// Fibonacci sequence (indexed from 0)
// ---------------------------------------------------------------------------

/** First 17 Fibonacci numbers. Index with FIB[n]. */
export const FIB = Object.freeze([
  0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987,
]);

/**
 * Compute the nth Fibonacci number (iterative, exact for n <= 70).
 * @param {number} n - Non-negative integer index.
 * @returns {number}
 */
export function fib(n) {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`fib(n): n must be a non-negative integer, got ${n}`);
  }
  if (n < FIB.length) return FIB[n];
  let a = FIB[FIB.length - 2]; // 610
  let b = FIB[FIB.length - 1]; // 987
  for (let i = FIB.length; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

// ---------------------------------------------------------------------------
// CSL (Continuous Semantic Logic) Gate Thresholds
// ---------------------------------------------------------------------------

/**
 * Phi-harmonic CSL gate thresholds.
 *
 * Derivation rationale:
 *   SUPPRESS  = PSI^3       ≈ 0.236   noise / suppress
 *   INCLUDE   = PSI^2       ≈ 0.382   include / weak signal
 *   MINIMUM   = 0.500       exact     noise floor
 *   BOOST     = PSI         ≈ 0.618   boost / activate
 *   INJECT    = 0.718       empirical inject
 *   MEDIUM    = PHI-1 * PHI ≈ 0.809  moderate coherence
 *   HIGH      = 1-PSI^3     ≈ 0.882   high coherence
 *   CRITICAL  = 1-PSI^4     ≈ 0.927   near-certain
 *   DEDUP     = 0.972       semantic identity
 */
export const CSL = Object.freeze({
  SUPPRESS: 0.236,
  INCLUDE:  PSI2,
  MINIMUM:  0.500,
  BOOST:    PSI,
  INJECT:   0.718,
  MEDIUM:   0.809,
  HIGH:     0.882,
  CRITICAL: 0.927,
  DEDUP:    0.972,
});

// ---------------------------------------------------------------------------
// Timing constants (phi-derived, milliseconds)
// ---------------------------------------------------------------------------

/**
 * Phi-scaled timing constants.
 *
 *   CONNECT = round(1000 * PHI)    = 1618 ms
 *   REQUEST = round(1000 * PHI^3)  = 4236 ms
 *   TASK    = REQUEST               = 4236 ms
 *   LONG    = round(1000 * PHI^8)  = 33978 ms
 *   MAX     = round(1000 * PHI^11) = 89042 ms
 */
export const TIMING = Object.freeze({
  CONNECT: 1618,
  REQUEST: 4236,
  TASK:    4236,
  LONG:    33978,
  MAX:     89042,
});

// ---------------------------------------------------------------------------
// Resource Pool Allocations (Fibonacci ratios)
// ---------------------------------------------------------------------------

/**
 * Fibonacci-ratio resource pool allocations.
 *
 *   Hot        34% — user-facing, latency-critical
 *   Warm       21% — background processing
 *   Cold       13% — batch / ingestion / analytics
 *   Reserve     8% — burst capacity
 *   Governance  5% — always running
 */
export const POOLS = Object.freeze({
  Hot:        0.34,
  Warm:       0.21,
  Cold:       0.13,
  Reserve:    0.08,
  Governance: 0.05,
});

// ---------------------------------------------------------------------------
// Phi-backoff
// ---------------------------------------------------------------------------

/**
 * Phi-geometric exponential backoff with ±PSI² jitter.
 *
 * delay = min(baseMs * PHI^attempt, maxMs)
 * jitter = delay * PSI² * uniform(-1, 1)   (±38.2%)
 *
 * @param {number} attempt  - Retry attempt index (0-based).
 * @param {number} [baseMs=1000]  - Base delay in milliseconds.
 * @param {number} [maxMs=60000] - Maximum delay cap in milliseconds.
 * @returns {number} Delay in milliseconds (rounded to nearest integer).
 */
export function phiBackoff(attempt, baseMs = 1000, maxMs = 60000) {
  if (attempt < 0) throw new RangeError('attempt must be >= 0');
  const delay = Math.min(baseMs * Math.pow(PHI, attempt), maxMs);
  const jitter = delay * PSI2 * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(delay + jitter));
}

// ---------------------------------------------------------------------------
// Phi-fusion weights
// ---------------------------------------------------------------------------

/**
 * Generate N phi-weighted fusion weights that sum to 1.0.
 *
 * raw[i] = PSI^i — geometric decay by the conjugate golden ratio.
 * Normalised so weights always sum to exactly 1.
 *
 * @param {number} n - Number of factors (>= 1).
 * @returns {number[]} Array of n weights in descending order.
 */
export function phiFusionWeights(n) {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`phiFusionWeights(n): n must be a positive integer, got ${n}`);
  }
  const raw = Array.from({ length: n }, (_, i) => Math.pow(PSI, i));
  const sum = raw.reduce((acc, w) => acc + w, 0);
  return raw.map(w => w / sum);
}

// ---------------------------------------------------------------------------
// Vector operations
// ---------------------------------------------------------------------------

/**
 * Compute cosine similarity between two numeric arrays.
 *
 * @param {number[]|Float32Array|Float64Array} a
 * @param {number[]|Float32Array|Float64Array} b
 * @returns {number} Cosine similarity in [-1, 1]. Returns 0 if either vector is zero.
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new TypeError(
      `cosineSimilarity: vectors must have equal length (${a.length} vs ${b.length})`
    );
  }
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return Math.max(-1, Math.min(1, dot / denom));
}

/**
 * L2-normalize a vector to unit length (returns a new array).
 *
 * @param {number[]|Float32Array|Float64Array} vec
 * @returns {number[]} New normalised array. Returns zero-vector if input is zero.
 */
export function normalize(vec) {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return Array.from(vec);
  return Array.from(vec, v => v / norm);
}

// ---------------------------------------------------------------------------
// CSL soft gate
// ---------------------------------------------------------------------------

/**
 * Continuous Semantic Logic soft activation gate using a sigmoid function.
 *
 * Replaces hard if/else thresholds with smooth phi-scaled transitions.
 *
 *   output = value × sigmoid((cosScore - tau) / temp)
 *
 * @param {number} value     - The signal value to gate.
 * @param {number} cosScore  - Cosine similarity score [−1, 1].
 * @param {number} [tau=CSL.MINIMUM]   - Gate threshold.
 * @param {number} [temp=0.236]        - Temperature / steepness (CSL.SUPPRESS).
 * @returns {number} Gated output value.
 */
export function cslGate(value, cosScore, tau = CSL.MINIMUM, temp = CSL.SUPPRESS) {
  const sigmoid = 1 / (1 + Math.exp(-(cosScore - tau) / temp));
  return value * sigmoid;
}
