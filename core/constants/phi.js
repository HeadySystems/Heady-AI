/**
 * Heady™ φ-Math Foundation — Single Source of Truth
 * ═══════════════════════════════════════════════════
 *
 * EVERY numeric constant in Heady derives from this module.
 * Zero magic numbers. Zero duplication.
 *
 * Previously scattered across:
 *   - shared/phi-math.js
 *   - services/heady-mcp-server/src/config/phi-constants.js
 *   - src/engines/hybrid-pipeline.js (inline)
 *   - src/auto-success-engine.ts (imported subset)
 *   - src/src/orchestration/heady-conductor.js (imported subset)
 *
 * Now: ONE canonical source.
 *
 * @module core/constants/phi
 * @version 5.0.0
 * © 2026 HeadySystems Inc. All Rights Reserved.
 */
'use strict';

// ─── Golden Ratio Primitives ─────────────────────────────────────────────────

const PHI  = 1.618033988749895;
const PSI  = 0.618033988749895;   // 1/PHI = PHI - 1
const PSI2 = 0.381966011250105;   // 1 - PSI = 1/PHI²

// ─── Fibonacci Sequence ──────────────────────────────────────────────────────

const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

/** Get fib(n) safely */
function fib(n) {
  if (n < FIB.length) return FIB[n];
  let a = FIB[FIB.length - 2], b = FIB[FIB.length - 1];
  for (let i = FIB.length; i <= n; i++) { [a, b] = [b, a + b]; }
  return b;
}

// ─── Powers of φ ─────────────────────────────────────────────────────────────

const PHI_POWERS = {};
for (let i = 0; i <= 12; i++) {
  PHI_POWERS[`PHI_${i}`] = Math.pow(PHI, i);
}

// ─── CSL (Confidence Signal Logic) ───────────────────────────────────────────

const CSL = {
  SUPPRESS:  0.236,                // Below threshold — discard
  INCLUDE:   PSI2,                 // 0.382 — minimum for consideration
  MINIMUM:   0.500,                // Bare minimum gate
  BOOST:     PSI,                  // 0.618 — promoted/boosted
  INJECT:    0.718,                // Force injection
  MEDIUM:    PHI / (PHI + PSI2),    // 0.809 — routing decisions
  HIGH:      0.882,                // High confidence
  CRITICAL:  0.927,                // Critical — near certain
};

// ─── Timing (milliseconds, all φ-derived) ────────────────────────────────────

const TIMING = {
  CONNECT:    Math.round(PHI * 1000),                    // 1,618ms
  REQUEST:    Math.round((PHI * PHI + 1) * 1000),        // 4,236ms
  TASK:       Math.round(PHI_POWERS.PHI_3 * 1000),       // 4,236ms
  IDLE:       Math.round(PHI * 8 * 1000),                // 12,944ms
  DRAIN:      Math.round(PHI * 13 * 1000),               // 21,034ms
  CYCLE:      Math.round(PHI_POWERS.PHI_7 * 1000),       // 29,034ms
  LONG:       Math.round(PHI * 21 * 1000),               // 33,978ms
  HOT:        Math.round(PHI_POWERS.PHI_4 * 1000),       // 6,854ms
  WARM:       Math.round(PHI_POWERS.PHI_6 * 1000),       // 17,944ms
  COLD:       Math.round(PHI_POWERS.PHI_8 * 1000),       // 46,979ms
  MAX:        Math.round(PHI * 55 * 1000),               // 89,042ms
};

// ─── Rate Limits (requests/window, Fibonacci-derived) ────────────────────────

const RATE_LIMITS = {
  ANONYMOUS:     fib(9),     // 34
  AUTHENTICATED: fib(10),    // 55
  PREMIUM:       fib(11),    // 89
  ENTERPRISE:    fib(12),    // 144
  INTERNAL:      fib(13),    // 233
};

// ─── Pool Allocation (percentage, φ-derived) ─────────────────────────────────

const POOLS = {
  HOT:  { share: fib(9),  label: 'Hot',  timeout: TIMING.HOT  },   // 34%
  WARM: { share: fib(8),  label: 'Warm', timeout: TIMING.WARM },   // 21%
  COLD: { share: fib(7),  label: 'Cold', timeout: TIMING.COLD },   // 13%
};

// ─── Service Ports ───────────────────────────────────────────────────────────

const PORTS = {
  MCP_SERVER:      3310,
  HEADY_BRAIN:     3311,
  HEADY_MEMORY:    3312,
  HEADY_CONDUCTOR: 3313,
  AUTH_SESSION:     3314,
  API_GATEWAY:     3315,
  NOTIFICATION:    3316,
  BILLING:         3317,
  ANALYTICS:       3318,
  SEARCH:          3319,
  SCHEDULER:       3320,
  HEADY_SOUL:      3321,
  HEADY_VINCI:     3322,
  HEADY_ORCHESTRATOR: 3323,
  HEADY_CODER:     3324,
  HEADY_BATTLE:    3325,
  HEADY_BUDDY:     3326,
  HEADY_LENS:      3327,
  HEADY_MAID:      3328,
  HEADY_GUARD:     3329,
  HCFP:            3330,
  EDGE_AI:         3331,
};

// ─── Utility Functions ───────────────────────────────────────────────────────

/** Generate φ-exponential retry delays: delay_i = base × φ^i */
function phiRetryDelays(maxRetries = 5, baseMs = 1000) {
  return Array.from({ length: maxRetries }, (_, i) =>
    Math.round(baseMs * Math.pow(PHI, i))
  );
}

/** φ-backoff with jitter: delay × (1 + random * PSI2) */
function phiBackoffWithJitter(attempt, baseMs = 1000) {
  const delay = baseMs * Math.pow(PHI, attempt);
  const jitter = delay * PSI2 * Math.random();
  return Math.round(delay + jitter);
}

/** CSL gate: apply confidence weighting to a signal */
function cslGate(signal, confidence, threshold = CSL.BOOST) {
  if (confidence < CSL.SUPPRESS) return 0;
  if (confidence < threshold) return signal * PSI2;
  if (confidence >= CSL.INJECT) return signal * PHI;
  return signal * confidence;
}

/** Phi-weighted fusion weights for N factors */
function phiFusionWeights(n) {
  const raw = Array.from({ length: n }, (_, i) => Math.pow(PSI, i));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(w => w / sum);
}

/** Cosine similarity between two vectors */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/** Normalize a vector to unit length */
function normalize(vec) {
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return mag === 0 ? vec : vec.map(v => v / mag);
}

/** Pressure level from utilization ratio */
function getPressureLevel(utilization) {
  if (utilization >= CSL.CRITICAL) return 'CRITICAL';
  if (utilization >= CSL.HIGH) return 'HIGH';
  if (utilization >= CSL.BOOST) return 'MEDIUM';
  return 'LOW';
}

// ─── Auto-Success Constants ──────────────────────────────────────────────────

const AUTO_SUCCESS = {
  CYCLE_MS:             Math.round(PHI_POWERS.PHI_7 * 1000),  // 29,034ms
  CATEGORIES:           fib(7),                                 // 13
  TASKS_TOTAL:          fib(12),                                // 144
  TASKS_PER_CATEGORY:   Math.floor(fib(12) / fib(7)),          // 11
  TASK_TIMEOUT_MS:      Math.round(PHI_POWERS.PHI_3 * 1000),  // 4,236ms
  MAX_RETRIES_PER_CYCLE: fib(4),                                // 3
  MAX_RETRIES_TOTAL:    fib(6),                                 // 8
};

module.exports = {
  // Primitives
  PHI, PSI, PSI2, FIB, fib,
  PHI_POWERS,

  // Thresholds
  CSL,

  // Timing
  TIMING,

  // Sizing
  RATE_LIMITS,
  POOLS,
  PORTS,
  AUTO_SUCCESS,

  // Functions
  phiRetryDelays,
  phiBackoffWithJitter,
  cslGate,
  phiFusionWeights,
  cosineSimilarity,
  normalize,
  getPressureLevel,
};
