// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ φ-Math Constants v2.0.0                                ║
// ║  Sacred Geometry Mathematical Foundation — ESM Edition          ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

// ═══════════════════════════════════════════════════════════════════
// Core Constants
// ═══════════════════════════════════════════════════════════════════

/** Golden Ratio φ ≈ 1.618 */
export const PHI = 1.618033988749895;

/** Reciprocal of φ (1/φ) ≈ 0.618 */
export const PSI = 1 / PHI;

/** PSI squared ≈ 0.382 */
export const PSI2 = PSI * PSI;

/** First 21 Fibonacci numbers */
export const FIB = Object.freeze([
  0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144,
  233, 377, 610, 987, 1597, 2584, 4181, 6765,
]);

// ═══════════════════════════════════════════════════════════════════
// CSL Gates — Continuous Semantic Logic confidence thresholds
// ═══════════════════════════════════════════════════════════════════

export const CSL_GATES = Object.freeze({
  include:  PSI2,          // 0.382 — lower threshold for system inclusion
  boost:    PSI,           // 0.618 — normal confidence threshold
  inject:   PSI + 0.1,    // 0.718 — high confidence for pattern injection
  certify:  0.854102,     // φ^(-1/3) — certification-grade confidence
});

export const CSL_BANDS = Object.freeze({
  DORMANT_MAX:  0.236068,       // φ^-3
  LOW_MAX:      PSI2,           // 0.381966
  MODERATE_MAX: PSI,            // 0.618034
  HIGH_MAX:     0.854102,       // φ^(-1/3)
  CRITICAL_MAX: 1.0,
});

// ═══════════════════════════════════════════════════════════════════
// Derived Constants: Timeouts, Circuit Breakers, Rate Limits
// ═══════════════════════════════════════════════════════════════════

/** Connection timeout: φ × 1000 ≈ 1618ms */
export const PHI_TIMEOUT_CONNECT = Math.round(PHI * 1000);

/** Request timeout: φ³ × 1000 ≈ 4236ms */
export const PHI_TIMEOUT_REQUEST = Math.round(PHI * PHI * PHI * 1000);

/** Circuit Breaker configuration using Fibonacci thresholds */
export const PHI_CIRCUIT_BREAKER = Object.freeze({
  threshold:    FIB[11],        // 89 failures to open circuit
  resetTimeout: FIB[10] * 1000, // 55s reset timeout
  halfOpenMax:  FIB[9],         // 34 requests in half-open state
});

/** Bulkhead pattern — concurrent + queued limits */
export const PHI_BULKHEAD = Object.freeze({
  concurrent: FIB[9],   // 34 concurrent requests
  queued:     FIB[10],   // 55 queued requests
});

/** Rate limits (requests per window) by authentication level */
export const PHI_RATE_LIMITS = Object.freeze({
  anonymous:     FIB[9],   // 34 req/min for anonymous
  authenticated: FIB[11],  // 89 req/min for authenticated
  enterprise:    FIB[13],  // 233 req/min for enterprise
});

/** Cache sizes (entries) by tier */
export const PHI_CACHE_SIZES = Object.freeze({
  small:  FIB[8],   // 21 entries
  medium: FIB[10],  // 55 entries
  large:  FIB[12],  // 144 entries
});

/** Retry configuration — φ-based exponential backoff */
export const PHI_RETRY = Object.freeze({
  maxRetries: FIB[5],          // 5 retries
  baseDelay:  FIB[6] * 100,   // 800ms
  multiplier: PHI,             // φ-based multiplier
});

/** Feature flag rollout stages (proportion of users) */
export const PHI_ROLLOUT = Object.freeze([
  PSI2 / PHI,  // ~0.0618 (6.18%)
  PSI2,        // ~0.382  (38.2%)
  PSI,         // ~0.618  (61.8%)
  1.0,         // 100%
]);

/** Fibonacci-based TTL decay for memory consolidation (in days) */
export const PHI_TTL_DECAY_DAYS = Object.freeze([
  1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89,
]);

/** Memory retention threshold weights */
export const PHI_RETENTION_WEIGHTS = Object.freeze({
  importance: 0.4,
  recency:    0.35,
  frequency:  0.25,
  retainAbove:  PSI,      // 0.618 — retain and promote
  discardBelow: PSI2 / 8, // ~0.05 — permanently delete
});

/** Scaling trigger threshold: 1/φ ≈ 61.8% utilization */
export const PHI_SCALING_THRESHOLD = PSI;

/** Canary deployment stages */
export const PHI_CANARY_STAGES = Object.freeze([
  0.05,   // 5% — smoke test
  0.25,   // 25% — expand
  0.50,   // 50% — half traffic
  1.00,   // 100% — full rollout
]);

// ═══════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════

/**
 * Scale a base value by φ raised to power n.
 * @param {number} base - Base value to scale
 * @param {number} n - Exponent (can be negative for shrinking)
 * @returns {number} base × φⁿ
 * @example phiScale(100, 2) => 261.8
 */
export function phiScale(base, n) {
  return base * Math.pow(PHI, n);
}

/**
 * Compute the nth Fibonacci number (0-indexed).
 * Uses lookup table for small n, iterative for larger values.
 * @param {number} n - Index (0-based)
 * @returns {number}
 */
export function fib(n) {
  if (n < 0) return 0;
  if (n < FIB.length) return FIB[n];
  let a = FIB[FIB.length - 2];
  let b = FIB[FIB.length - 1];
  for (let i = FIB.length; i <= n; i++) {
    const next = a + b;
    a = b;
    b = next;
  }
  return b;
}

/**
 * Find the nearest Fibonacci number to a given value.
 * @param {number} n - Target value
 * @returns {number} Closest Fibonacci number
 */
export function fibNearest(n) {
  return FIB.reduce((prev, curr) =>
    Math.abs(curr - n) < Math.abs(prev - n) ? curr : prev,
  );
}

/**
 * Check if confidence passes a CSL gate.
 * @param {number} value - Confidence score (0–1)
 * @param {number} cosScore - Cosine similarity score (0–1)
 * @param {number} [tau=PSI] - Gate threshold (default: 0.618)
 * @returns {boolean} Whether the gate passes
 * @example cslGate(0.7, 0.8) => true (geometric mean ~0.748 >= 0.618)
 */
export function cslGate(value, cosScore, tau = PSI) {
  const combined = Math.sqrt(value * cosScore);
  return combined >= tau;
}

/**
 * Simple CSL gate check against named gates.
 * @param {number} confidence - Score to evaluate
 * @param {string} [gate='boost'] - Gate name from CSL_GATES
 * @returns {boolean}
 */
export function cslGateSimple(confidence, gate = 'boost') {
  return confidence >= (CSL_GATES[gate] ?? PSI);
}

/**
 * Calculate φ-scaled exponential backoff with jitter.
 * Produces delay sequences: 1000ms, 1618ms, 2618ms, 4236ms, 6854ms...
 * @param {number} attempt - Retry attempt number (0-based)
 * @param {number} [baseMs=1000] - Base delay in milliseconds
 * @param {number} [maxMs=30000] - Maximum delay cap
 * @returns {number} Delay in milliseconds with ±10% jitter
 */
export function phiBackoff(attempt, baseMs = 1000, maxMs = 30000) {
  const delay = baseMs * Math.pow(PHI, Math.max(0, attempt));
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.round(Math.min(delay + jitter, maxMs));
}

/**
 * Calculate deterministic φ-scaled backoff (no jitter) for testing.
 * @param {number} attempt - Retry attempt number (0-based)
 * @param {number} [baseMs=1000] - Base delay in milliseconds
 * @param {number} [maxMs=30000] - Maximum delay cap
 * @returns {number}
 */
export function phiBackoffDeterministic(attempt, baseMs = 1000, maxMs = 30000) {
  const delay = baseMs * Math.pow(PHI, Math.max(0, attempt));
  return Math.round(Math.min(delay, maxMs));
}

/**
 * Calculate pipeline stage timeout using φ-scaling.
 * Stage 0: 100ms, Stage 5: ~1109ms, Stage 10: ~12299ms, Stage 15: ~136400ms
 * @param {number} stage - Pipeline stage index (0-based)
 * @param {number} [baseMs=100] - Base timeout for stage 0
 * @returns {number} Timeout in milliseconds
 */
export function stageTimeout(stage, baseMs = 100) {
  return Math.round(baseMs * Math.pow(PHI, stage));
}

/**
 * Calculate pipeline stage retry delay using φ-scaling.
 * @param {number} stage - Pipeline stage index (0-based)
 * @param {number} [baseMs=1000] - Base retry delay for stage 0
 * @returns {number} Retry delay in milliseconds
 */
export function stageRetryDelay(stage, baseMs = 1000) {
  return Math.round(baseMs * Math.pow(PHI, stage));
}

/**
 * Calculate pipeline stage buffer size using φ-scaling.
 * @param {number} stage - Pipeline stage index (0-based)
 * @param {number} [baseKB=1] - Base buffer in KB for stage 0
 * @returns {number} Buffer size in KB
 */
export function stageBuffer(stage, baseKB = 1) {
  return Math.round(baseKB * Math.pow(PHI, stage));
}

/**
 * Get the appropriate Fibonacci-indexed queue depth for a given load level.
 * @param {'minimal'|'low'|'medium'|'high'|'extreme'} level
 * @returns {number}
 */
export function fibQueueDepth(level) {
  const levels = { minimal: 5, low: 7, medium: 8, high: 10, extreme: 12 };
  const idx = levels[level] ?? levels.medium;
  return FIB[idx];
}

/**
 * Compute a weighted retention score for memory consolidation.
 * @param {{ importance: number, recency: number, frequency: number }} scores - Each 0–1
 * @returns {{ score: number, action: 'retain'|'review'|'discard' }}
 */
export function retentionScore({ importance = 0, recency = 0, frequency = 0 }) {
  const score =
    importance * PHI_RETENTION_WEIGHTS.importance +
    recency * PHI_RETENTION_WEIGHTS.recency +
    frequency * PHI_RETENTION_WEIGHTS.frequency;

  let action = 'review';
  if (score >= PHI_RETENTION_WEIGHTS.retainAbove) action = 'retain';
  if (score < PHI_RETENTION_WEIGHTS.discardBelow) action = 'discard';

  return { score: Math.round(score * 1000) / 1000, action };
}

/**
 * Golden section search — find the minimum of a unimodal function.
 * Each iteration narrows the search interval by factor 1/φ.
 * @param {Function} fn - Unimodal function to minimize
 * @param {number} a - Lower bound
 * @param {number} b - Upper bound
 * @param {number} [tolerance=1e-6] - Convergence tolerance
 * @returns {{ x: number, fx: number, iterations: number }}
 */
export function goldenSectionSearch(fn, a, b, tolerance = 1e-6) {
  let iterations = 0;
  let x1 = b - PSI * (b - a);
  let x2 = a + PSI * (b - a);
  let f1 = fn(x1);
  let f2 = fn(x2);

  while (Math.abs(b - a) > tolerance) {
    iterations++;
    if (f1 < f2) {
      b = x2;
      x2 = x1;
      f2 = f1;
      x1 = b - PSI * (b - a);
      f1 = fn(x1);
    } else {
      a = x1;
      x1 = x2;
      f1 = f2;
      x2 = a + PSI * (b - a);
      f2 = fn(x2);
    }
  }

  const x = (a + b) / 2;
  return { x, fx: fn(x), iterations };
}
