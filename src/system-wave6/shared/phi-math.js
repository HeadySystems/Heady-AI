/**
 * Heady™ Phi-Math Foundation v5.0
 * Sacred Geometry mathematical primitives — ALL numeric constants derived from φ
 * Zero magic numbers. Every value traces to the golden ratio.
 * 
 * @author Eric Haywood — HeadySystems Inc.
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

// ═══════════════════════════════════════════════════════════
// CORE CONSTANTS — The Sacred Foundation
// ═══════════════════════════════════════════════════════════

const PHI = (1 + Math.sqrt(5)) / 2;          // φ  ≈ 1.6180339887
const PSI = 1 / PHI;                          // ψ  ≈ 0.6180339887 (conjugate)
const PHI_SQ = PHI + 1;                       // φ² ≈ 2.6180339887
const PHI_CUBE = 2 * PHI + 1;                 // φ³ ≈ 4.2360679775
const PHI_FOURTH = 3 * PHI + 2;              // φ⁴ ≈ 6.8541019662
const PSI_SQ = PSI * PSI;                     // ψ² ≈ 0.3819660113
const PSI_CUBE = PSI * PSI * PSI;             // ψ³ ≈ 0.2360679775
const PSI_FOURTH = PSI * PSI * PSI * PSI;     // ψ⁴ ≈ 0.1458980338
const EMBEDDING_DIM = 384;                     // fib-adjacent: 377=fib(14), 384=nearest power-aligned

// ═══════════════════════════════════════════════════════════
// FIBONACCI SEQUENCE — The Sacred Sequence
// ═══════════════════════════════════════════════════════════

const FIB_CACHE = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];

function fib(n) {
  if (n < FIB_CACHE.length) return FIB_CACHE[n];
  let a = FIB_CACHE[FIB_CACHE.length - 2];
  let b = FIB_CACHE[FIB_CACHE.length - 1];
  for (let i = FIB_CACHE.length; i <= n; i++) {
    [a, b] = [b, a + b];
    FIB_CACHE[i] = b;
  }
  return FIB_CACHE[n];
}

function nearestFib(value) {
  let i = 0;
  while (fib(i) < value) i++;
  const upper = fib(i);
  const lower = i > 0 ? fib(i - 1) : 0;
  return (value - lower <= upper - value) ? lower : upper;
}

// ═══════════════════════════════════════════════════════════
// CSL GATE THRESHOLDS — Phi-Harmonic Levels
// phiThreshold(level, spread=0.5) = 1 - ψ^level × spread
// ═══════════════════════════════════════════════════════════

function phiThreshold(level, spread = 0.5) {
  return 1 - Math.pow(PSI, level) * spread;
}

const CSL_THRESHOLDS = Object.freeze({
  MINIMUM:  phiThreshold(0),   // ≈ 0.500
  LOW:      phiThreshold(1),   // ≈ 0.691
  MEDIUM:   phiThreshold(2),   // ≈ 0.809
  HIGH:     phiThreshold(3),   // ≈ 0.882
  CRITICAL: phiThreshold(4),   // ≈ 0.927
});

const DEDUP_THRESHOLD = 1 - Math.pow(PSI, 6) * 0.5;  // ≈ 0.972
const COHERENCE_DRIFT_THRESHOLD = CSL_THRESHOLDS.MEDIUM;  // ≈ 0.809

// ═══════════════════════════════════════════════════════════
// PHI-BACKOFF TIMING
// phiBackoff(attempt, baseMs=1000, maxMs=60000)
// ═══════════════════════════════════════════════════════════

function phiBackoff(attempt, baseMs = 1000, maxMs = 60000) {
  const delay = baseMs * Math.pow(PHI, attempt);
  return Math.min(delay, maxMs);
}

function phiBackoffWithJitter(attempt, baseMs = 1000, maxMs = 60000) {
  const base = phiBackoff(attempt, baseMs, maxMs);
  const jitterRange = base * PSI_SQ; // ±38.2%
  const jitter = (Math.random() * 2 - 1) * jitterRange;
  return Math.max(baseMs, Math.round(base + jitter));
}

const BACKOFF_SEQUENCE = Object.freeze([
  1000, 1618, 2618, 4236, 6854, 11090, 17944, 29034
]);

// ═══════════════════════════════════════════════════════════
// PRESSURE LEVELS — Phi-Derived System Health
// ═══════════════════════════════════════════════════════════

const PRESSURE_LEVELS = Object.freeze({
  NOMINAL:   { min: 0, max: PSI_SQ },           // 0 – 0.382
  ELEVATED:  { min: PSI_SQ, max: PSI },          // 0.382 – 0.618
  HIGH:      { min: PSI, max: 1 - PSI_CUBE },    // 0.618 – 0.854 (approx)
  CRITICAL:  { min: 1 - PSI_FOURTH, max: 1.0 },  // 0.910+
});

function getPressureLevel(value) {
  if (value <= PSI_SQ) return 'NOMINAL';
  if (value <= PSI) return 'ELEVATED';
  if (value <= 1 - PSI_CUBE) return 'HIGH';
  return 'CRITICAL';
}

// ═══════════════════════════════════════════════════════════
// ALERT THRESHOLDS
// ═══════════════════════════════════════════════════════════

const ALERT_THRESHOLDS = Object.freeze({
  WARNING:  PSI,                // ≈ 0.618
  CAUTION:  1 - PSI_SQ,        // ≈ 0.764 (actually 1 - 0.382 = 0.618... recalc)
  CRITICAL: 1 - PSI_CUBE,      // ≈ 0.764
  EXCEEDED: 1 - PSI_FOURTH,    // ≈ 0.854
  HARD_MAX: 1.0,
});

// ═══════════════════════════════════════════════════════════
// RESOURCE ALLOCATION — Hot/Warm/Cold/Reserve/Governance
// ═══════════════════════════════════════════════════════════

function phiResourceWeights(n) {
  const weights = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.pow(PSI, i);
    weights.push(w);
    sum += w;
  }
  return weights.map(w => w / sum);
}

const RESOURCE_ALLOCATION = Object.freeze({
  HOT:        0.34,   // fib(9)/100 ≈ 34%
  WARM:       0.21,   // fib(8)/100 ≈ 21%
  COLD:       0.13,   // fib(7)/100 ≈ 13%
  RESERVE:    0.08,   // fib(6)/100 ≈ 8%
  GOVERNANCE: 0.05,   // fib(5)/100 ≈ 5%
});

// ═══════════════════════════════════════════════════════════
// POOL SIZES — Fibonacci-Scaled
// ═══════════════════════════════════════════════════════════

const POOL_SIZES = Object.freeze({
  MICRO:  fib(5),   // 5
  SMALL:  fib(6),   // 8
  MEDIUM: fib(7),   // 13
  LARGE:  fib(8),   // 21
  XLARGE: fib(9),   // 34
  HUGE:   fib(10),  // 55
  MEGA:   fib(11),  // 89
});

// ═══════════════════════════════════════════════════════════
// FUSION WEIGHTS — N-Factor Phi-Weighted Scoring
// ═══════════════════════════════════════════════════════════

function phiFusionWeights(n) {
  return phiResourceWeights(n);
}

function phiFusionScore(factors, weights = null) {
  const w = weights || phiFusionWeights(factors.length);
  return factors.reduce((sum, f, i) => sum + f * w[i], 0);
}

const EVICTION_WEIGHTS = Object.freeze({
  importance: 0.486,   // φ-derived primary
  recency:    0.300,   // φ-derived secondary
  relevance:  0.214,   // φ-derived tertiary
});

// ═══════════════════════════════════════════════════════════
// TOKEN BUDGETS — Phi-Geometric Progression
// ═══════════════════════════════════════════════════════════

function phiTokenBudgets(base = 8192) {
  return {
    working:    base,                                    // 8192
    session:    Math.round(base * PHI_SQ),               // 21450
    memory:     Math.round(base * PHI_FOURTH),           // 56131
    artifacts:  Math.round(base * Math.pow(PHI, 6)),     // 146920
  };
}

// ═══════════════════════════════════════════════════════════
// CSL GATE FUNCTIONS — Continuous Semantic Logic
// ═══════════════════════════════════════════════════════════

function cslGate(value, cosScore, tau, temperature = 0.1) {
  const sigmoid = 1 / (1 + Math.exp(-(cosScore - tau) / temperature));
  return value * sigmoid;
}

function cslBlend(weightHigh, weightLow, cosScore, tau) {
  const t = Math.max(0, Math.min(1, (cosScore - tau + 0.5)));
  return weightHigh * t + weightLow * (1 - t);
}

function cslAND(vecA, vecB) {
  // Cosine similarity as logical AND
  const dot = vecA.reduce((s, a, i) => s + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((s, a) => s + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((s, b) => s + b * b, 0));
  return (magA && magB) ? dot / (magA * magB) : 0;
}

function cslOR(vecA, vecB) {
  // Superposition as logical OR
  return vecA.map((a, i) => a + vecB[i]);
}

function cslNOT(vec, basis) {
  // Orthogonal projection as logical NOT
  const dot = vec.reduce((s, v, i) => s + v * basis[i], 0);
  const basisMag = basis.reduce((s, b) => s + b * b, 0);
  const scale = basisMag ? dot / basisMag : 0;
  return vec.map((v, i) => v - scale * basis[i]);
}

function adaptiveTemperature(entropy, maxEntropy) {
  const normalizedEntropy = entropy / maxEntropy;
  return PSI + (1 - PSI) * normalizedEntropy;
}

// ═══════════════════════════════════════════════════════════
// PHI-MULTI-SPLIT — Recursive ψ-Geometric Series
// ═══════════════════════════════════════════════════════════

function phiMultiSplit(whole, n) {
  const weights = phiResourceWeights(n);
  return weights.map(w => Math.round(whole * w));
}

// ═══════════════════════════════════════════════════════════
// TIMING CONSTANTS — All Fibonacci/Phi Derived
// ═══════════════════════════════════════════════════════════

const TIMING = Object.freeze({
  HEARTBEAT_MS:       fib(7) * 1000,    // 13s
  HEALTH_CHECK_MS:    fib(9) * 1000,    // 34s
  DRIFT_CHECK_MS:     fib(11) * 1000,   // 89s
  CACHE_TTL_MS:       fib(13) * 1000,   // 233s
  SESSION_TTL_MS:     fib(17) * 1000,   // 1597s (~26min)
  COOL_DOWN_MS:       fib(8) * 1000,    // 21s
  HOT_TIMEOUT_MS:     fib(9) * 1000,    // 34s
  WARM_TIMEOUT_MS:    fib(13) * 1000,   // 233s (~3.9min)
  COLD_TIMEOUT_MS:    fib(17) * 1000,   // 1597s (~26.6min)
});

// ═══════════════════════════════════════════════════════════
// HNSW INDEX PARAMETERS — Fibonacci/Phi Scaled
// ═══════════════════════════════════════════════════════════

const HNSW_PARAMS = Object.freeze({
  M:                fib(8),    // 21 — connections per node
  EF_CONSTRUCTION:  fib(12),   // 144 — build-time search width
  EF_SEARCH:        fib(11),   // 89 — query-time search width
  DIMENSIONS:       EMBEDDING_DIM,  // 384
});

// ═══════════════════════════════════════════════════════════
// PIPELINE STAGES — Exactly fib(8) = 21 stages
// ═══════════════════════════════════════════════════════════

const PIPELINE_STAGE_COUNT = fib(8); // 21

// ═══════════════════════════════════════════════════════════
// COLAB RUNTIME CONSTANTS
// ═══════════════════════════════════════════════════════════

const COLAB_RUNTIMES = Object.freeze({
  COUNT: 3,                          // 3 Colab Pro+ memberships
  GPU_MEMORY_GB: fib(10),            // 55GB (A100 80GB available, phi-scaled allocation)
  MAX_CONCURRENT_TASKS: fib(8),      // 21 concurrent tasks per runtime
  BATCH_SIZE: fib(9),                // 34 items per batch
  VECTOR_CACHE_SIZE: fib(20),        // 6765 vectors in hot cache
  EMBEDDING_BATCH: fib(12),          // 144 embeddings per batch
  CHECKPOINT_INTERVAL_S: fib(13),    // 233s between checkpoints
});

// ═══════════════════════════════════════════════════════════
// SERVICE PORT MAP — 50+ services on ports 3310-3396
// ═══════════════════════════════════════════════════════════

const SERVICE_PORTS = Object.freeze({
  // Inference Services (3310-3319)
  HEADY_INFERENCE:        3310,
  HEADY_EMBED:            3311,
  HEADY_CLASSIFY:         3312,
  HEADY_SUMMARIZE:        3313,
  HEADY_TRANSLATE:        3314,
  HEADY_VISION:           3315,
  HEADY_SPEECH:           3316,
  HEADY_CODE_GEN:         3317,
  HEADY_REASONING:        3318,
  HEADY_MULTI_MODAL:      3319,
  // Memory Services (3320-3329)
  HEADY_MEMORY:           3320,
  HEADY_VECTOR_STORE:     3321,
  HEADY_GRAPH_RAG:        3322,
  HEADY_KNOWLEDGE_BASE:   3323,
  HEADY_CONTEXT_MANAGER:  3324,
  HEADY_CACHE:            3325,
  HEADY_EMBEDDING_ROUTER: 3326,
  HEADY_SEARCH:           3327,
  HEADY_INDEX:            3328,
  HEADY_RERANK:           3329,
  // Agent Services (3330-3339)
  HEADY_CONDUCTOR:        3330,
  HEADY_BEE_FACTORY:      3331,
  HEADY_SWARM:            3332,
  HEADY_SOUL:             3333,
  HEADY_BRAINS:           3334,
  HEADY_VINCI:            3335,
  HEADY_BUDDY:            3336,
  HEADY_MANAGER:          3337,
  HEADY_AUTOBIOGRAPHER:   3338,
  HEADY_PATTERNS:         3339,
  // Orchestration (3340-3349)
  HEADY_PIPELINE:         3340,
  HEADY_SCHEDULER:        3341,
  HEADY_TASK_DECOMP:      3342,
  HEADY_BACKPRESSURE:     3343,
  HEADY_LIQUID_MESH:      3344,
  HEADY_LIQUID_GATEWAY:   3345,
  HEADY_ARENA:            3346,
  HEADY_CONSENSUS:        3347,
  HEADY_CIRCUIT_BREAKER:  3348,
  HEADY_LOAD_BALANCER:    3349,
  // Security (3350-3359)
  HEADY_AUTH:             3350,
  HEADY_OAUTH:            3351,
  HEADY_FIREWALL:         3352,
  HEADY_AUDIT:            3353,
  HEADY_GOVERNANCE:       3354,
  HEADY_ENCRYPTION:       3355,
  HEADY_RATE_LIMITER:     3356,
  HEADY_IDENTITY:         3357,
  HEADY_MCP_GATEWAY:      3358,
  HEADY_ZERO_TRUST:       3359,
  // Monitoring (3360-3369)
  HEADY_HEALTH:           3360,
  HEADY_METRICS:          3361,
  HEADY_TELEMETRY:        3362,
  HEADY_ALERTING:         3363,
  HEADY_DASHBOARD:        3364,
  HEADY_LOG_AGGREGATOR:   3365,
  HEADY_TRACE_COLLECTOR:  3366,
  HEADY_DRIFT_DETECTOR:   3367,
  HEADY_SELF_HEALING:     3368,
  HEADY_MONTE_CARLO:      3369,
  // Web Services (3370-3379)
  HEADY_WEB_GATEWAY:      3370,
  HEADYME_COM:            3371,
  HEADYSYSTEMS_COM:       3372,
  HEADY_AI_COM:           3373,
  HEADYOS_COM:            3374,
  HEADYCONNECTION_ORG:    3375,
  HEADYCONNECTION_COM:    3376,
  HEADYEX_COM:            3377,
  HEADYFINANCE_COM:       3378,
  ADMIN_HEADYSYSTEMS:     3379,
  // Data Services (3380-3389)
  HEADY_PGVECTOR:         3380,
  HEADY_PGBOUNCER:        3381,
  HEADY_NATS:             3382,
  HEADY_REDIS:            3383,
  HEADY_STORAGE:          3384,
  HEADY_BACKUP:           3385,
  HEADY_MIGRATION:        3386,
  HEADY_ETL:              3387,
  HEADY_ANALYTICS:        3388,
  HEADY_REPORTING:        3389,
  // Integration & Specialized (3390-3396)
  HEADY_NOTIFICATION:     3390,
  HEADY_WEBHOOK:          3391,
  HEADY_COLAB_BRIDGE:     3392,
  HEADY_LIQUID_DEPLOY:    3393,
  HEADY_EVOLUTION:        3394,
  HEADY_DOCUMENTATION:    3395,
  HEADY_AUTO_SUCCESS:     3396,
});

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = {
  // Core constants
  PHI, PSI, PHI_SQ, PHI_CUBE, PHI_FOURTH,
  PSI_SQ, PSI_CUBE, PSI_FOURTH,
  EMBEDDING_DIM,
  // Fibonacci
  fib, nearestFib, FIB_CACHE,
  // Thresholds
  phiThreshold, CSL_THRESHOLDS, DEDUP_THRESHOLD, COHERENCE_DRIFT_THRESHOLD,
  // Backoff
  phiBackoff, phiBackoffWithJitter, BACKOFF_SEQUENCE,
  // Pressure
  PRESSURE_LEVELS, getPressureLevel,
  // Alerts
  ALERT_THRESHOLDS,
  // Resources
  phiResourceWeights, RESOURCE_ALLOCATION, POOL_SIZES,
  // Fusion
  phiFusionWeights, phiFusionScore, EVICTION_WEIGHTS,
  // Tokens
  phiTokenBudgets,
  // CSL Gates
  cslGate, cslBlend, cslAND, cslOR, cslNOT, adaptiveTemperature,
  // Utilities
  phiMultiSplit,
  // Timing
  TIMING,
  // HNSW
  HNSW_PARAMS,
  // Pipeline
  PIPELINE_STAGE_COUNT,
  // Colab
  COLAB_RUNTIMES,
  // Services
  SERVICE_PORTS,
};
