/**
 * Heady™ Phi-Math Foundation — Sacred Geometry Constants & Utilities (ESM)
 * The single source of truth for ALL scaling constants across the Heady™ ecosystem.
 *
 * NO MAGIC NUMBERS. Every constant derives from φ (golden ratio) or Fibonacci.
 *
 * © 2026 HeadySystems Inc. All Rights Reserved. 60+ Provisional Patents.
 * @module shared/phi-math
 */

// ─── CORE CONSTANTS ──────────────────────────────────────────────────────────
export const PHI = 1.6180339887498948;        // φ = (1 + √5) / 2
export const PSI = 0.6180339887498949;        // ψ = 1/φ = φ − 1
export const PHI_SQ = 2.618033988749895;      // φ² = φ + 1
export const PHI_CUBED = 4.23606797749979;    // φ³ = 2φ + 1
export const SQRT5 = 2.23606797749979;        // √5
export const GOLDEN_ANGLE_DEG = 137.5077640500378; // 360 / φ²

// ─── PSI POWERS ──────────────────────────────────────────────────────────────
export const PSI_SQ = PSI * PSI;              // ψ² ≈ 0.382
export const PSI_3 = PSI * PSI * PSI;         // ψ³ ≈ 0.236
export const PSI_4 = Math.pow(PSI, 4);        // ψ⁴ ≈ 0.146
export const PSI_5 = Math.pow(PSI, 5);        // ψ⁵ ≈ 0.090
export const PSI_8 = Math.pow(PSI, 8);        // ψ⁸ ≈ 0.0213

// ─── FIBONACCI SEQUENCE ──────────────────────────────────────────────────────
export const FIB = Object.freeze([
  1, 1, 2, 3, 5, 8, 13, 21, 34, 55,
  89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765
]);

/**
 * Get Fibonacci number by index (0-based).
 * @param {number} n - Index into Fibonacci sequence
 * @returns {number}
 */
export function fib(n) {
  if (n < FIB.length) return FIB[n];
  let a = FIB[FIB.length - 2], b = FIB[FIB.length - 1];
  for (let i = FIB.length; i <= n; i++) { [a, b] = [b, a + b]; }
  return b;
}

/**
 * Fibonacci-scaled milliseconds: fib(n) × 1000ms
 * @param {number} n - Fibonacci index
 * @returns {number} milliseconds
 */
export function fibMs(n) {
  return fib(n) * 1000;
}

// ─── CSL GATE THRESHOLDS (phi-harmonic: 1 − ψ^level × 0.5) ─────────────────
export const CSL_THRESHOLDS = Object.freeze({
  CRITICAL: 0.927,   // phiThreshold(4) — near-certain
  HIGH:     0.882,   // phiThreshold(3) — strong alignment
  MEDIUM:   0.809,   // phiThreshold(2) — moderate alignment (coherence drift floor)
  LOW:      0.691,   // phiThreshold(1) — weak alignment
  MINIMUM:  0.500,   // phiThreshold(0) — noise floor
});

export const DEDUP_THRESHOLD = 0.972; // Above CRITICAL — semantic identity

/**
 * Compute phi-derived threshold at a given level.
 * phiThreshold(0) = 0.500, (1) = 0.691, (2) = 0.809, (3) = 0.882, (4) = 0.927
 * @param {number} level - Threshold level (0-based)
 * @returns {number}
 */
export function phiThreshold(level) {
  return 1 - Math.pow(PSI, level) * 0.5;
}

// ─── TIMING (all derived from φ) ────────────────────────────────────────────
export const TIMING = Object.freeze({
  PHI_MS:            1618,    // φ × 1000
  PHI_SQ_MS:         2618,    // φ² × 1000
  PHI_CUBED_MS:      4236,    // φ³ × 1000
  HEARTBEAT_MS:      1618,    // Service heartbeat interval
  HEALTH_CHECK_MS:   4236,    // Health check interval
  DEBOUNCE_MS:       618,     // ψ × 1000 — input debounce
  ANIMATION_MS:      1000,    // Base animation (φ × ψ × 1000 ≈ 1000)
  DRAIN_TIMEOUT_MS:  21000,   // fib(8) × 1000 — graceful shutdown drain
});

// ─── TIMEOUT TIERS (φⁿ × 1000ms) ────────────────────────────────────────────
export const TIMEOUT_TIERS = Object.freeze([
  1618, 2618, 4236, 6854, 11090, 17944, 29034, 46979
]);

// ─── PHI-BACKOFF ─────────────────────────────────────────────────────────────
/**
 * Golden-ratio exponential backoff with jitter.
 * Replaces arbitrary retry delays.
 * Attempt 0: 1000ms, 1: 1618ms, 2: 2618ms, 3: 4236ms, 4: 6854ms
 * @param {number} attempt - Zero-based attempt number
 * @param {number} [baseMs=1000] - Base delay in ms
 * @param {number} [maxMs=60000] - Maximum delay cap
 * @returns {number} Delay in ms with ±38.2% jitter
 */
export function phiBackoff(attempt, baseMs = 1000, maxMs = 60000) {
  const delay = Math.min(baseMs * Math.pow(PHI, attempt), maxMs);
  const jitter = delay * PSI_SQ * (Math.random() * 2 - 1); // ±38.2%
  return Math.round(Math.max(0, delay + jitter));
}

// ─── PHI-FUSION WEIGHTS ──────────────────────────────────────────────────────
/**
 * Compute phi-weighted fusion weights for N-factor scoring.
 * phiFusionWeights(2) → [0.618, 0.382]
 * phiFusionWeights(3) → [0.528, 0.326, 0.146]
 * @param {number} n - Number of factors
 * @returns {number[]} Normalized weights summing to 1
 */
export function phiFusionWeights(n) {
  const raw = Array.from({ length: n }, (_, i) => Math.pow(PSI, i));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(w => w / sum);
}

// ─── PRESSURE LEVELS (replaces arbitrary 0.60/0.80/0.95) ────────────────────
export const PRESSURE_LEVELS = Object.freeze({
  NOMINAL:  { min: 0,     max: PSI_SQ },     // 0 to ψ² ≈ 0.382
  ELEVATED: { min: PSI_SQ, max: PSI },        // ψ² to ψ ≈ 0.618
  HIGH:     { min: PSI,   max: 1 - PSI_3 },   // ψ to 1−ψ³ ≈ 0.854
  CRITICAL: { min: 1 - PSI_4, max: 1.0 },     // 1−ψ⁴ ≈ 0.910 to 1.0
});

/**
 * Determine pressure level from a 0-1 pressure value.
 * @param {number} pressure - 0 to 1
 * @returns {string} NOMINAL | ELEVATED | HIGH | CRITICAL
 */
export function getPressureLevel(pressure) {
  if (pressure >= PRESSURE_LEVELS.CRITICAL.min) return 'CRITICAL';
  if (pressure >= PRESSURE_LEVELS.HIGH.min) return 'HIGH';
  if (pressure >= PRESSURE_LEVELS.ELEVATED.min) return 'ELEVATED';
  return 'NOMINAL';
}

// ─── POOL ALLOCATION (Fibonacci percentages) ────────────────────────────────
export const POOL_ALLOCATION = Object.freeze({
  hot:        0.34,  // 34% — user-facing, latency-critical
  warm:       0.21,  // 21% — background processing
  cold:       0.13,  // 13% — batch, ingestion, analytics
  reserve:    0.08,  // 8%  — burst capacity
  governance: 0.05,  // 5%  — HeadyCheck, HeadyAssure, HeadyAware
});

// ─── TOKEN BUDGETS (phi-geometric progression) ──────────────────────────────
/**
 * Compute phi-scaled token budgets from a base.
 * @param {number} [base=8192] - Base token count
 * @returns {{ working: number, session: number, memory: number, artifacts: number }}
 */
export function phiTokenBudgets(base = 8192) {
  return {
    working:   base,
    session:   Math.round(base * PHI * PHI),          // ≈ 21,450
    memory:    Math.round(base * Math.pow(PHI, 4)),    // ≈ 56,131
    artifacts: Math.round(base * Math.pow(PHI, 6)),    // ≈ 146,920
  };
}

// ─── CSL GATE OPERATIONS ─────────────────────────────────────────────────────
/**
 * Soft sigmoid gate — replaces boolean thresholds.
 * @param {number} value - Input value to gate
 * @param {number} cosScore - Cosine similarity score (0-1)
 * @param {number} [tau=0.500] - Threshold center
 * @param {number} [temp=0.236] - Temperature (ψ³)
 * @returns {number} Gated value
 */
export function cslGate(value, cosScore, tau = CSL_THRESHOLDS.MINIMUM, temp = PSI_3) {
  return value * (1 / (1 + Math.exp(-(cosScore - tau) / temp)));
}

/**
 * Smooth weight interpolation — replaces if/else weight selection.
 * @param {number} weightHigh - Weight when above threshold
 * @param {number} weightLow - Weight when below threshold
 * @param {number} cosScore - Cosine similarity score
 * @param {number} [tau=0.809] - Threshold center
 * @returns {number} Blended weight
 */
export function cslBlend(weightHigh, weightLow, cosScore, tau = CSL_THRESHOLDS.MEDIUM) {
  const alpha = 1 / (1 + Math.exp(-(cosScore - tau) / PSI_3));
  return weightHigh * alpha + weightLow * (1 - alpha);
}

// ─── JUDGE WEIGHTS (Fibonacci-derived: 34%, 21%, 21%, 13%, 11%) ─────────────
export const JUDGE_WEIGHTS = Object.freeze({
  correctness: 0.34,
  safety:      0.21,
  performance: 0.21,
  quality:     0.13,
  elegance:    0.11,
});

/**
 * Compute JUDGE composite score.
 * @param {{ correctness: number, safety: number, performance: number, quality: number, elegance: number }} scores
 * @returns {number} Weighted composite score (0-1)
 */
export function judgeScore(scores) {
  return (
    scores.correctness * JUDGE_WEIGHTS.correctness +
    scores.safety      * JUDGE_WEIGHTS.safety +
    scores.performance * JUDGE_WEIGHTS.performance +
    scores.quality     * JUDGE_WEIGHTS.quality +
    scores.elegance    * JUDGE_WEIGHTS.elegance
  );
}

// ─── DEFAULT EXPORT ──────────────────────────────────────────────────────────
export default {
  PHI, PSI, PHI_SQ, PHI_CUBED, SQRT5, GOLDEN_ANGLE_DEG,
  PSI_SQ, PSI_3, PSI_4, PSI_5, PSI_8,
  FIB, fib, fibMs,
  CSL_THRESHOLDS, DEDUP_THRESHOLD, phiThreshold,
  TIMING, TIMEOUT_TIERS,
  phiBackoff, phiFusionWeights,
  PRESSURE_LEVELS, getPressureLevel,
  POOL_ALLOCATION, phiTokenBudgets,
  cslGate, cslBlend,
  JUDGE_WEIGHTS, judgeScore,
};
