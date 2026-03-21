/**
 * Phi-Math V2 — Sacred geometry constants, Fibonacci utilities,
 * CSL thresholds, and cryptographic helpers for HeadyOS.
 *
 * @module src/shared/phi-math-v2
 * @version 2.0.0
 * @author HeadySystems™
 */

// ─── Golden Ratio Constants ──────────────────────────────────────
export const PHI  = 1.618033988749895;
export const PSI  = 1 / PHI;          // 0.618033988749895
export const PSI2 = PSI * PSI;        // 0.381966011250105
export const PSI3 = PSI2 * PSI;       // 0.236067977499790

// ─── Fibonacci Sequence (first 21 terms) ─────────────────────────
export const FIB = [
  1, 1, 2, 3, 5, 8, 13, 21, 34, 55,
  89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765, 10946,
];

// ─── CSL Thresholds (Cognitive Significance Levels) ──────────────
export const CSL_THRESHOLDS = Object.freeze({
  CRITICAL: 0.95,
  HIGH:     0.85,
  MEDIUM:   0.70,
  LOW:      0.50,
  NOISE:    0.30,
});

// ─── Fibonacci Generator ─────────────────────────────────────────
export function fibonacci(n) {
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  let a = 1, b = 1;
  for (let i = 2; i < n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

// ─── Phi Threshold (φ-scaled confidence check) ───────────────────
export function phiThreshold(value, base = 0.5) {
  return value >= base * PHI;
}

// ─── Phi Backoff (exponential backoff scaled by φ) ───────────────
export function phiBackoff(attempt, baseMs = 1000) {
  return Math.round(baseMs * Math.pow(PHI, attempt));
}

// ─── Cosine Similarity ──────────────────────────────────────────
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── CSL Gate (pass/fail based on similarity threshold) ──────────
export function cslGate(score, threshold = CSL_THRESHOLDS.MEDIUM) {
  return score >= threshold;
}

// ─── SHA-256 Hash (using Web Crypto or Node crypto) ──────────────
import { createHash } from 'crypto';

export function sha256(input) {
  return createHash('sha256').update(String(input)).digest('hex');
}
