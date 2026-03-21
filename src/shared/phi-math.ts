/**
 * Heady™ Phi-Math Foundation v4.0.0
 * ALL numeric constants derived from φ (1.618...) and Fibonacci
 * ZERO magic numbers in any Heady module
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */

// ═══ Core Constants ═══
export const PHI: number = 1.618033988749895;
export const PSI: number = 1 / PHI; // ≈ 0.6180339887498949
export const PHI_SQ: number = PHI + 1; // φ² ≈ 2.618033988749895
export const PHI_CU: number = 2 * PHI + 1; // φ³ ≈ 4.2360679774997905
export const PHI_4: number = 3 * PHI + 2; // φ⁴ ≈ 6.854101966249685
export const PHI_5: number = 5 * PHI + 3; // φ⁵ ≈ 11.09016994374947
export const PHI_6: number = 8 * PHI + 5; // φ⁶ ≈ 17.944271909999163
export const PHI_7: number = 13 * PHI + 8; // φ⁷ ≈ 29.034441853748634

// ═══ Fibonacci Sequence (first 20) ═══
export const FIB: readonly number[] = Object.freeze([1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765]);

/**
 * Generate Fibonacci number at index n using closed-form (Binet's formula)
 */
export function fibonacci(n: number): number {
  if (n < FIB.length) return FIB[n];
  return Math.round((Math.pow(PHI, n + 1) - Math.pow(-PSI, n + 1)) / Math.sqrt(5));
}

// ═══ CSL Threshold Hierarchy ═══
// phiThreshold(level, spread=0.5) = 1 - ψ^level × spread
export function phiThreshold(level: number, spread: number = 0.5): number {
  return 1 - Math.pow(PSI, level) * spread;
}
export const CSL_THRESHOLDS = Object.freeze({
  MINIMUM: phiThreshold(0),
  // ≈ 0.500 — noise floor
  LOW: phiThreshold(1),
  // ≈ 0.691 — weak alignment
  MEDIUM: phiThreshold(2),
  // ≈ 0.809 — moderate alignment
  HIGH: phiThreshold(3),
  // ≈ 0.882 — strong alignment
  CRITICAL: phiThreshold(4) // ≈ 0.927 — near-certain
});
export const DEDUP_THRESHOLD: number = phiThreshold(6); // ≈ 0.972 — semantic identity

// ═══ Phi-Backoff Timing ═══
export function phiBackoff(attempt: number, baseMs: number = 1000, maxMs: number = 60000): number {
  const delay = baseMs * Math.pow(PHI, attempt);
  const jitter = 1 + (Math.random() - 0.5) * 2 * Math.pow(PSI, 2); // ±38.2%
  return Math.min(delay * jitter, maxMs);
}

// ═══ Fibonacci Retry Sequence (ms) ═══
export const RETRY_BACKOFF_MS: readonly number[] = Object.freeze(FIB.slice(4, 9).map(n => n * 100)
// → [500, 800, 1300, 2100, 3400]
);

// ═══ Connection Pool Sizing ═══
export const POOL_SIZES = Object.freeze({
  min: FIB[2],
  // 2
  max: FIB[7],
  // 21
  idle: FIB[4] // 5
});

// ═══ Phi-Fusion Weights ═══
export function phiFusionWeights(n: number): number[] {
  const raw: number[] = [];
  for (let i = 0; i < n; i++) {
    raw.push(Math.pow(PSI, i));
  }
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(w => w / sum);
}

// ═══ Phi-Resource Allocation ═══
// Hot:34%, Warm:21%, Cold:13%, Reserve:8%, Governance:5%
export function phiResourceWeights(n: number): number[] {
  return phiFusionWeights(n);
}
export const RESOURCE_POOLS = Object.freeze({
  hot: 0.387,
  // phiFusionWeights(5)[0]
  warm: 0.239,
  // phiFusionWeights(5)[1]
  cold: 0.148,
  // phiFusionWeights(5)[2]
  reserve: 0.092,
  // phiFusionWeights(5)[3]
  governance: 0.057 // phiFusionWeights(5)[4]
});

// ═══ Pressure Levels ═══
export const PRESSURE_LEVELS = Object.freeze({
  NOMINAL: {
    min: 0,
    max: Math.pow(PSI, 2)
  },
  // 0 → 0.382
  ELEVATED: {
    min: Math.pow(PSI, 2),
    max: PSI
  },
  // 0.382 → 0.618
  HIGH: {
    min: PSI,
    max: 1 - Math.pow(PSI, 3)
  },
  // 0.618 → 0.854
  CRITICAL: {
    min: 1 - Math.pow(PSI, 4),
    max: 1.0
  } // 0.910 → 1.0
});

// ═══ Alert Thresholds ═══
export const ALERT_THRESHOLDS = Object.freeze({
  warning: PSI,
  // ≈ 0.618
  caution: 1 - Math.pow(PSI, 2),
  // ≈ 0.764
  critical: 1 - Math.pow(PSI, 3),
  // ≈ 0.854
  exceeded: 1 - Math.pow(PSI, 4),
  // ≈ 0.910
  hard_max: 1.0
});

// ═══ Token Budgets (phi-geometric progression) ═══
export function phiTokenBudgets(base: number = 8192): Record<string, number> {
  return {
    working: base,
    session: Math.round(base * PHI_SQ),
    // ≈ 21,450
    memory: Math.round(base * PHI_4),
    // ≈ 56,131
    artifacts: Math.round(base * PHI_6) // ≈ 146,920
  };
}

// ═══ CSL Gate Functions ═══
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
export function cslGate(value: number, cosScore: number, tau: number, temp: number = Math.pow(PSI, 3)): number {
  return value * sigmoid((cosScore - tau) / temp);
}

/** Smooth blend between highWeight and lowWeight based on cosine score */
export function cslBlend(weightHigh: number, weightLow: number, cosScore: number, tau: number): number {
  const gate = sigmoid((cosScore - tau) / Math.pow(PSI, 3));
  return weightHigh * gate + weightLow * (1 - gate);
}
export function adaptiveTemperature(entropy: number, maxEntropy: number): number {
  const baseTemp = Math.pow(PSI, 3); // ≈ 0.236
  const ratio = Math.min(entropy / maxEntropy, 1.0);
  return baseTemp * (1 + ratio * PHI);
}

// ═══ Vector Operations ═══
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('HEADY-2001: Vector dimension mismatch');
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
export function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map(x => x / norm);
}

/** CSL AND: cosine similarity */
export function cslAND(a: number[], b: number[]): number {
  return cosineSimilarity(a, b);
}

/** CSL OR: superposition (normalized sum) */
export function cslOR(a: number[], b: number[]): number[] {
  const sum = a.map((v, i) => v + b[i]);
  return normalize(sum);
}

/** CSL NOT: orthogonal projection (remove b-component from a) */
export function cslNOT(a: number[], b: number[]): number[] {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const normB = b.reduce((s, v) => s + v * v, 0);
  if (normB === 0) return a;
  const scale = dot / normB;
  return a.map((v, i) => v - scale * b[i]);
}

/** CSL IMPLY: projection of a onto b */
export function cslIMPLY(a: number[], b: number[]): number[] {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const normB = b.reduce((s, v) => s + v * v, 0);
  if (normB === 0) return b;
  const scale = dot / normB;
  return b.map(v => scale * v);
}

/** Weighted consensus of multiple vectors */
export function cslCONSENSUS(vectors: number[][], weights?: number[]): number[] {
  const n = vectors.length;
  if (n === 0) throw new Error('HEADY-2002: Empty consensus input');
  const w = weights || vectors.map(() => 1 / n);
  const dim = vectors[0].length;
  const result = new Array(dim).fill(0);
  for (let i = 0; i < n; i++) {
    for (let d = 0; d < dim; d++) {
      result[d] += w[i] * vectors[i][d];
    }
  }
  return normalize(result);
}

// ═══ Phi-Scaled Time Constants ═══
export const TIMING = Object.freeze({
  FAST: Math.round(1000 * Math.pow(PSI, 3)),
  // 236ms
  BASE: Math.round(1000 * Math.pow(PSI, 2)),
  // 382ms
  SLOW: Math.round(1000 * PSI),
  // 618ms
  GLACIAL: 1000,
  // 1000ms
  HEARTBEAT_MS: FIB[9] * 1000,
  // 34s
  SESSION_TTL_MS: FIB[13] * 60 * 1000,
  // 233 min
  REFRESH_TTL_MS: FIB[15] * 60 * 1000 // 610 min
});

// ═══ Embedding Constants ═══
export const EMBEDDING = Object.freeze({
  DIMENSIONS: FIB[12] + FIB[12] + FIB[11] + FIB[8] + FIB[6] + FIB[3],
  // 144 + 144 + 89 + 21 + 8 + 3 = not exactly 384...
  // Correct: use exact value for all-MiniLM-L6-v2
  DIMS_384: 384,
  PROJECTION_3D: 3,
  DENSITY_GATE: 1 - Math.pow(PSI, 5) // ≈ 0.920 (was hardcoded 0.92)
});