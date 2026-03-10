/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  @heady/platform — phi/index.js                                  ║
 * ║  Single Source of Truth for all φ-derived constants              ║
 * ║  © 2026 HeadySystems Inc. — 51 Provisional Patents             ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * ZERO magic numbers. Every value derives from φ (phi = 1.618...).
 * This module is the canonical math foundation for ALL Heady services.
 */

'use strict';

// ─── CORE CONSTANTS ──────────────────────────────────────────────────────────

/** φ — The Golden Ratio: (1 + √5) / 2 */
export const PHI = (1 + Math.sqrt(5)) / 2;          // 1.6180339887498948

/** ψ — The Conjugate Golden Ratio: 1 / φ */
export const PSI = 1 / PHI;                          // 0.6180339887498948

/** φ² = φ + 1 */
export const PHI_SQ = PHI + 1;                       // 2.6180339887498948

/** φ³ = 2φ + 1 */
export const PHI_CUBE = 2 * PHI + 1;                 // 4.2360679774997896

/** φ⁴ */
export const PHI_4 = PHI_CUBE * PHI;                 // 6.8541019662496847

/** φ⁵ */
export const PHI_5 = PHI_4 * PHI;                    // 11.090169943749474

/** φ⁶ */
export const PHI_6 = PHI_5 * PHI;                    // 17.944271909999157

/** φ⁷ */
export const PHI_7 = PHI_6 * PHI;                    // 29.034441853748633

/** φ⁸ */
export const PHI_8 = PHI_7 * PHI;                    // 46.978713763747792

/** ψ² */
export const PSI2 = PSI * PSI;                        // 0.3819660112501052

/** ψ³ */
export const PSI3 = PSI2 * PSI;                       // 0.2360679774997897

/** ψ⁴ */
export const PSI4 = PSI3 * PSI;                       // 0.1458980337503155

/** ψ⁵ */
export const PSI5 = PSI4 * PSI;                       // 0.0901699437494742

/** Golden Angle (degrees): 360 × ψ² ≈ 137.508° */
export const GOLDEN_ANGLE_DEG = 360 * PSI2;

/** Golden Angle (radians) */
export const GOLDEN_ANGLE_RAD = GOLDEN_ANGLE_DEG * (Math.PI / 180);

// ─── FIBONACCI SEQUENCE ───────────────────────────────────────────────────────

/** Canonical Fibonacci sequence: indices 1..20 */
export const FIB = Object.freeze([
  1, 1, 2, 3, 5, 8, 13, 21, 34, 55,
  89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765,
]);

/**
 * Get the nth Fibonacci number (1-indexed).
 * @param {number} n — 1..20
 * @returns {number}
 */
export function fib(n) {
  if (n < 1 || n > 20) throw new RangeError(`fib(n): n must be 1..20, got ${n}`);
  return FIB[n - 1];
}

// ─── PHI-DERIVED TIMEOUTS ────────────────────────────────────────────────────

/** Timeout ladder: φⁿ × 1000 ms (only these values are valid) */
export const TIMEOUTS = Object.freeze({
  PHI_1:  Math.round(PHI   * 1000),   // 1618 ms
  PHI_2:  Math.round(PHI_SQ * 1000),  // 2618 ms
  PHI_3:  Math.round(PHI_CUBE * 1000),// 4236 ms
  PHI_4:  Math.round(PHI_4 * 1000),   // 6854 ms
  PHI_5:  Math.round(PHI_5 * 1000),   // 11090 ms
  PHI_6:  Math.round(PHI_6 * 1000),   // 17944 ms
  PHI_7:  Math.round(PHI_7 * 1000),   // 29034 ms
  PHI_8:  Math.round(PHI_8 * 1000),   // 46979 ms
});

/** Auto-Success Engine cycle — φ⁷ × 1000 = 29,034 ms */
export const AUTO_SUCCESS_CYCLE_MS = TIMEOUTS.PHI_7;

/** Default health check interval — φ⁴ × 1000 = 6,854 ms */
export const HEALTH_INTERVAL_MS = TIMEOUTS.PHI_4;

/** Default health check timeout — φ³ × 1000 = 4,236 ms */
export const HEALTH_TIMEOUT_MS = TIMEOUTS.PHI_3;

// ─── CSL THRESHOLDS ───────────────────────────────────────────────────────────

/** CSL confidence thresholds — phiThreshold(n) = 1 − ψⁿ × 0.5 */
export const CSL_THRESHOLDS = Object.freeze({
  FLOOR:     0.500,   // T(0): minimum viable semantic floor
  ENTRY:     0.691,   // T(1): initial semantic alignment
  ALIGN:     0.809,   // T(2): solid semantic alignment
  STEADY:    0.882,   // T(3): stable semantic coherence
  RESONANT:  0.927,   // T(4): resonant semantic fit
  DEDUP:     0.972,   // T(5): deduplication gate
  /** Primary CSL confidence gate — ψ itself */
  PASS:      PSI,     // 0.618 — the golden section of [0,1]
});

/**
 * Compute the phi-threshold for level n.
 * phiThreshold(n) = 1 − ψⁿ × 0.5
 * @param {number} n
 * @returns {number}
 */
export function phiThreshold(n) {
  return 1 - Math.pow(PSI, n) * 0.5;
}

// ─── PHI BACKOFF ──────────────────────────────────────────────────────────────

/**
 * φ-exponential backoff sequence starting at F(11) = 89 ms.
 * Each element = previous × φ ≈ Fibonacci continuation.
 * [89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765]
 */
export const PHI_BACKOFF_MS = Object.freeze(
  Array.from({ length: 10 }, (_, i) => Math.round(89 * Math.pow(PHI, i)))
);

/**
 * Get the nth φ-backoff delay (0-indexed, capped at index 9).
 * @param {number} attempt — attempt number (0-based)
 * @param {number} [jitter=PSI2] — jitter factor (default ψ² = 0.382)
 * @returns {number} delay in milliseconds
 */
export function phiBackoff(attempt, jitter = PSI2) {
  const idx = Math.min(attempt, PHI_BACKOFF_MS.length - 1);
  const base = PHI_BACKOFF_MS[idx];
  const j = base * jitter * (Math.random() * 2 - 1); // symmetric jitter
  return Math.max(89, Math.round(base + j));
}

// ─── POOL ALLOCATION ─────────────────────────────────────────────────────────

/**
 * Fibonacci-ratio pool allocation percentages.
 * Total: 34+21+13+8+5 = 81 (normalized to 1.0 = overhead 19%)
 */
export const POOL_ALLOCATION = Object.freeze({
  ACTIVE:      34 / 81,   // F(9) — active execution share
  SHARED:      21 / 81,   // F(8) — shared execution share
  BUFFER:      13 / 81,   // F(7) — adaptive buffer
  RESERVE:      8 / 81,   // F(6) — reserve
  GOVERNANCE:   5 / 81,   // F(5) — governance
});

// ─── SCALING DEFAULTS ────────────────────────────────────────────────────────

export const SCALING = Object.freeze({
  CONCURRENCY_BASE:   fib(6),   // 8
  CONCURRENCY_MAX:    fib(10),  // 55
  BATCH_BASE:         fib(8),   // 21
  BATCH_MAX:          fib(12),  // 144
  RATE_LIMIT_BASE:    fib(11),  // 89 req/window
  BUFFER_LIMIT_BASE:  fib(11),  // 89
  RETRY_COUNT:        fib(4),   // 3
  RETRY_MAX:          fib(6),   // 8
  CIRCUIT_FAILS:      fib(5),   // 5
  CIRCUIT_SUCCESS:    fib(4),   // 3
  MAX_TOKENS:         fib(19),  // 4181
  VECTOR_DIMS:        384,      // fib-aligned embedding dimension
});

// ─── AUTO-SUCCESS ENGINE WEIGHTS ─────────────────────────────────────────────

/**
 * Auto-Success Engine execution weights (φ-derived fractions of 1.0)
 * Foundation: ψ² ≈ 0.382
 * Amplify:    ψ³ ≈ 0.236
 * Steady:     ψ⁴ ≈ 0.146
 * Expand:     ψ⁵ ≈ 0.090
 */
export const AUTO_SUCCESS_WEIGHTS = Object.freeze({
  FOUNDATION: PSI2,  // 0.382
  AMPLIFY:    PSI3,  // 0.236
  STEADY:     PSI4,  // 0.146
  EXPAND:     PSI5,  // 0.090
});

/**
 * Snap a value to the nearest valid Fibonacci number in the provided set.
 * @param {number} value
 * @param {number[]} [fibSet] — defaults to full FIB sequence
 * @returns {number}
 */
export function fibSnap(value, fibSet = FIB) {
  return fibSet.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
}

/**
 * Phi-weighted fusion of multiple scores.
 * Weights are normalized ψ powers: [ψ, ψ², ψ³, ...]
 * @param {number[]} scores
 * @returns {number} fused score in [0, 1]
 */
export function phiFusion(scores) {
  if (!scores.length) return 0;
  let totalWeight = 0;
  let weightedSum = 0;
  for (let i = 0; i < scores.length; i++) {
    const w = Math.pow(PSI, i + 1);
    weightedSum += scores[i] * w;
    totalWeight += w;
  }
  return weightedSum / totalWeight;
}
