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
// ║  FILE: packages/phi-pure-latent-os/shared/phi-math.ts                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * φ-Math Foundation — No Magic Numbers
 * Every constant derives from the golden ratio.
 * @module shared/phi-math
 */

export const PHI = 1.618033988749895;
export const PSI = 1 / PHI; // ≈ 0.618
export const SQRT5 = Math.sqrt(5);

export const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987] as const;

/** CSL Gate Thresholds — phi-harmonic: 1 - PSI^level × 0.5 */
export const CSL = {
  CRITICAL: 0.927,
  HIGH:     0.882,
  MEDIUM:   0.809,
  LOW:      0.691,
  MINIMUM:  0.500,
  DEDUP:    0.972,
} as const;

/** Pressure levels — phi-derived */
export const PRESSURE = {
  NOMINAL:  { min: 0,     max: 0.382 },
  ELEVATED: { min: 0.382, max: 0.618 },
  HIGH:     { min: 0.618, max: 0.854 },
  CRITICAL: { min: 0.910, max: 1.0   },
} as const;

/** Resource pool allocation — Fibonacci percentages */
export const POOL = {
  hot:        0.34,
  warm:       0.21,
  cold:       0.13,
  reserve:    0.08,
  governance: 0.05,
} as const;

/**
 * O(1) Fibonacci via Binet's formula. Accurate for n < 71.
 */
export function fib(n: number): number {
  return Math.round((Math.pow(PHI, n) - Math.pow(PSI - 1, n)) / SQRT5);
}

/**
 * Fibonacci-sequence backoff: 1s → 1s → 2s → 3s → 5s → 8s → 13s → 21s → 34s
 */
export function fibonacciBackoff(attempt: number, baseMs = 1000, maxMs = 300_000): number {
  const n = attempt + 2;
  const fibVal = Math.round((Math.pow(PHI, n) - Math.pow(PSI - 1, n)) / SQRT5);
  return Math.min(fibVal * baseMs, maxMs);
}

/**
 * φ-exponential backoff with ±38.2% jitter
 */
export function phiBackoff(attempt: number, baseMs = 1000, maxMs = 60_000): number {
  const delay = Math.min(baseMs * Math.pow(PHI, attempt), maxMs);
  const jitter = delay * PSI * PSI * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

/**
 * Add uniform jitter to a delay
 */
export function withJitter(delayMs: number, factor = 0.5): number {
  return Math.round(delayMs * (1 - factor + Math.random() * 2 * factor));
}

/**
 * φ-fusion weights for N-factor scoring.
 * phiFusionWeights(2) → [0.618, 0.382]
 * phiFusionWeights(3) → [0.528, 0.326, 0.146]
 */
export function phiFusionWeights(n: number): number[] {
  const raw = Array.from({ length: n }, (_, i) => Math.pow(PSI, i));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(w => w / sum);
}

/**
 * Token budgets — phi-geometric progression from base
 */
export function phiTokenBudgets(base = 8192) {
  return {
    working:   base,
    session:   Math.round(base * PHI * PHI),
    memory:    Math.round(base * Math.pow(PHI, 4)),
    artifacts: Math.round(base * Math.pow(PHI, 6)),
  };
}

/**
 * Soft sigmoid CSL gate — replaces boolean thresholds
 */
export function cslGate(value: number, cosScore: number, tau = CSL.MINIMUM, temp = 0.236): number {
  return value * (1 / (1 + Math.exp(-(cosScore - tau) / temp)));
}

/**
 * Smooth weight interpolation — replaces if/else weight selection
 */
export function cslBlend(weightHigh: number, weightLow: number, cosScore: number, tau = CSL.MEDIUM): number {
  const alpha = 1 / (1 + Math.exp(-(cosScore - tau) / 0.236));
  return weightHigh * alpha + weightLow * (1 - alpha);
}

/**
 * Exponential decay for memory relevance
 */
export function exponentialDecay(ageMs: number, halfLifeMs: number): number {
  return Math.exp(-(Math.LN2 / halfLifeMs) * ageMs);
}
