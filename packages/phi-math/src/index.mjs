// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ φ-Math Foundation v1.0.0                                  ║
// ║  Golden-ratio constants + derivations. Zero magic numbers — every ║
// ║  timeout, TTL, pool size, and threshold in Heady derives from φ.  ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Canonical reference (ported from maximum-potential/phi-constants.cjs → ESM).
// Pure, dependency-free, side-effect-free — the φ source of truth the whole
// monorepo derives constants from (AGENTS.md #8).

// ─── Core constants ──────────────────────────────────────────────────────────
export const PHI = (1 + Math.sqrt(5)) / 2; // 1.618033988749895
export const PSI = 1 / PHI; //               0.618033988749895 (= PHI − 1)
export const PHI2 = PHI + 1; //              φ²
export const PHI3 = 2 * PHI + 1; //          φ³
export const PSI2 = PSI * PSI; //            φ⁻² ≈ 0.381966
export const PSI3 = PSI2 * PSI; //           φ⁻³ ≈ 0.236068

// φ⁷ ≈ 29.034 — the heartbeat scalar (PHI_7 * 1000 ≈ 29.034s, AGENTS.md φ-scaling).
export const PHI_7 = PHI ** 7;
export const HEARTBEAT_MS = Math.round(PHI_7 * 1000); // 29034

// Fibonacci sequence (index 0 = 0). Used for pool sizes, caps, TTL minutes.
export const FIB = Object.freeze([
  0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765,
]);

/** Fibonacci value at index n (extends beyond the cached array). */
export function fib(n) {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`fib(n): n must be a non-negative integer, got ${n}`);
  if (n < FIB.length) return FIB[n];
  let a = FIB[FIB.length - 2];
  let b = FIB[FIB.length - 1];
  for (let i = FIB.length; i <= n; i++) [a, b] = [b, a + b];
  return b;
}

// ─── CSL confidence thresholds (φ-tiered) ─────────────────────────────────────
/** Confidence threshold for a level: 1 − ψ^level · spread. Higher level ⇒ stricter. */
export function phiThreshold(level, spread = 0.5) {
  if (!Number.isFinite(level) || level < 0) throw new RangeError(`phiThreshold: level must be ≥ 0, got ${level}`);
  return 1 - Math.pow(PSI, level) * spread;
}

export const CSL_THRESHOLDS = Object.freeze({
  MINIMUM: phiThreshold(0), // 0.500
  LOW: phiThreshold(1), //     0.691
  MEDIUM: phiThreshold(2), //  0.809
  HIGH: phiThreshold(3), //    0.882
  CRITICAL: phiThreshold(4), //0.927
});

/**
 * Ternary gate boundaries (the EXECUTE / CAUTIOUS / HALT bands):
 * HALT < ψ² (0.382) ≤ CAUTIOUS < ψ (0.618) ≤ EXECUTE. See @heady/csl-engine `cslGate`.
 */
export const GATE = Object.freeze({ HALT: PSI2, EXECUTE: PSI });

export const DEDUP_THRESHOLD = 1 - Math.pow(PSI, 6) * 0.5;
export const COHERENCE_DRIFT_THRESHOLD = CSL_THRESHOLDS.MEDIUM;

// ─── Resilience: φ-backoff & circuit breaker ──────────────────────────────────
/** Retry delay in ms for an attempt: 1000·φⁿ → 1618, 2618, 4236, 6854, … */
export function phiBackoffMs(attempt) {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new RangeError(`phiBackoffMs: attempt must be a positive integer, got ${attempt}`);
  }
  return Math.round(1000 * Math.pow(PHI, attempt));
}

/** Await a φ-scaled backoff for `attempt` (1-based). Returns the ms waited. */
export async function phiBackoff(attempt, sleep = (ms) => new Promise((r) => setTimeout(r, ms))) {
  const ms = phiBackoffMs(attempt);
  await sleep(ms);
  return ms;
}

/** Circuit-breaker policy (AGENTS.md: 5 failures → open, φ-backoff base, probe after 30s). */
export const CIRCUIT_BREAKER = Object.freeze({
  FAILURE_THRESHOLD: FIB[5], //        5
  BASE_BACKOFF_US: 1618034, //         φ·10⁶ µs (1.618s)
  PROBE_AFTER_MS: 30000,
});

// ─── Fusion & pressure ────────────────────────────────────────────────────────
/** ψ-decaying fusion weights for n sources, normalized to sum 1 (rank-weighted). */
export function phiFusionWeights(n) {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`phiFusionWeights: n must be a positive integer, got ${n}`);
  const raw = Array.from({ length: n }, (_, i) => Math.pow(PSI, i));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / sum);
}

export const PRESSURE_LEVELS = Object.freeze({
  NOMINAL: { min: 0, max: PSI2 },
  ELEVATED: { min: PSI2, max: PSI },
  HIGH: { min: PSI, max: 1 - PSI3 },
  CRITICAL: { min: 1 - Math.pow(PSI, 4), max: 1.0 },
});

export const ALERT_THRESHOLDS = Object.freeze({
  warning: PSI,
  caution: 1 - PSI2,
  critical: 1 - PSI3,
  exceeded: 1 - Math.pow(PSI, 4),
  hard_max: 1.0,
});
