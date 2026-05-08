/**
 * ═══════════════════════════════════════════════════════════
 * HEADY™ PHI-MATH FOUNDATION
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 * All constants derived from φ (1.618) or Fibonacci — zero magic numbers
 * ═══════════════════════════════════════════════════════════
 */

export const PHI = (1 + Math.sqrt(5)) / 2;          // ≈ 1.618033988749895
export const PSI = 1 / PHI;                          // ≈ 0.618033988749895
export const PHI_SQ = PHI + 1;                       // ≈ 2.618033988749895
export const PHI_CUBE = 2 * PHI + 1;                 // ≈ 4.236067977499790

export const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];

export function fib(n) {
  if (n < 0 || n >= FIB.length) {
    throw new RangeError(`fib(${n}) out of range [0, ${FIB.length - 1}]`);
  }
  return FIB[n];
}

export function phiThreshold(level, spread = 0.5) {
  return 1 - Math.pow(PSI, level) * spread;
}

export const CSL_THRESHOLDS = Object.freeze({
  MINIMUM:  phiThreshold(0),    // ≈ 0.500
  LOW:      phiThreshold(1),    // ≈ 0.691
  MEDIUM:   phiThreshold(2),    // ≈ 0.809
  HIGH:     phiThreshold(3),    // ≈ 0.882
  CRITICAL: phiThreshold(4),    // ≈ 0.927
});

export const DEDUP_THRESHOLD = 1 - Math.pow(PSI, 5) * 0.5; // ≈ 0.972

export const CSL_GATES = Object.freeze({
  VOID:    Math.pow(PSI, 2),    // ≈ 0.382
  RECALL:  Math.pow(PSI, 2),    // ≈ 0.382
  INCLUDE: PSI,                 // ≈ 0.618
  CORE:    PSI + 0.1,           // ≈ 0.718
  INJECT:  PSI + 0.168,         // ≈ 0.786
});

export function phiFusionWeights(n) {
  const raw = Array.from({ length: n }, (_, i) => Math.pow(PSI, i));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(w => w / sum);
}

export function phiBackoff(attempt, baseMs = 1000, maxMs = 60000) {
  const delay = Math.min(baseMs * Math.pow(PHI, attempt), maxMs);
  const jitter = delay * (Math.random() * Math.pow(PSI, 2) * 2 - Math.pow(PSI, 2));
  return Math.round(delay + jitter);
}

export function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new RangeError(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export function cslGate(value, score, tau, temp = Math.pow(PSI, 3)) {
  const sigmoid = 1 / (1 + Math.exp(-(score - tau) / temp));
  return value * sigmoid;
}
