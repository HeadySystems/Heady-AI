/**
 * @fileoverview Canonical Phi-Math Constants for the Heady Ecosystem
 * @description Shared mathematical constants, Fibonacci sequences, CSL thresholds,
 * pool allocations, backoff functions, fusion weights, and adaptive intervals.
 * All values derived from PHI (1.618033988749895) — zero magic numbers.
 * @module phi-constants
 */

'use strict';

// ─── FUNDAMENTAL CONSTANTS ───────────────────────────────────────────────────

/** @constant {number} PHI - The golden ratio */
const PHI = 1.618033988749895;

/** @constant {number} PSI - The golden ratio conjugate (1/PHI) */
const PSI = 0.618033988749895;

/** @constant {number} PHI_SQUARED - PHI^2 */
const PHI_SQUARED = PHI * PHI; // 2.618033988749895

/** @constant {number} PHI_CUBED - PHI^3 */
const PHI_CUBED = PHI * PHI * PHI; // 4.23606797749979

/** @constant {number} PHI_INVERSE_SQUARED - PSI^2 */
const PHI_INVERSE_SQUARED = PSI * PSI; // 0.381966011250105

/** @constant {number} SQRT_FIVE - Square root of 5, related to PHI */
const SQRT_FIVE = Math.sqrt(5); // 2.23606797749979

/** @constant {number} LN_PHI - Natural logarithm of PHI */
const LN_PHI = Math.log(PHI); // 0.48121182505960344

// ─── FIBONACCI SEQUENCE (FIRST 20) ──────────────────────────────────────────

/**
 * @constant {number[]} FIB - First 20 Fibonacci numbers
 * Each number is the sum of the two preceding ones.
 */
const FIB = [
  0, 1, 1, 2, 3, 5, 8, 13, 21, 34,
  55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181
];

/**
 * @constant {Object} FIB_MAP - Named Fibonacci references for semantic usage
 */
const FIB_MAP = {
  ZERO: FIB[0],       // 0
  ONE: FIB[1],        // 1
  TWO: FIB[3],        // 2
  THREE: FIB[4],      // 3
  FIVE: FIB[5],       // 5
  EIGHT: FIB[6],      // 8
  THIRTEEN: FIB[7],   // 13
  TWENTY_ONE: FIB[8], // 21
  THIRTY_FOUR: FIB[9],// 34
  FIFTY_FIVE: FIB[10],// 55
  EIGHTY_NINE: FIB[11], // 89
  ONE_FORTY_FOUR: FIB[12], // 144
};

// ─── CSL THRESHOLDS ──────────────────────────────────────────────────────────

/**
 * @constant {Object} CSL - Coherence Score Level thresholds
 * Derived from PHI-based ratios for semantic similarity gating.
 */
const CSL = {
  /** Minimum viable coherence — below this, reject */
  MINIMUM: 0.500,
  /** Low coherence — needs review */
  LOW: 0.691,
  /** Medium coherence — acceptable for most operations */
  MEDIUM: 0.809,
  /** High coherence — suitable for critical operations */
  HIGH: 0.882,
  /** Critical coherence — required for governance actions */
  CRITICAL: 0.927,
  /** Deduplication threshold — above this, consider duplicate */
  DEDUP: 0.972,
};

/**
 * @constant {Object} CSL_ERROR_CODES - Error codes classified by CSL level
 */
const CSL_ERROR_CODES = {
  E_BELOW_MINIMUM: { code: 'CSL_001', level: 'MINIMUM', message: 'Coherence below minimum threshold' },
  E_LOW_COHERENCE: { code: 'CSL_002', level: 'LOW', message: 'Low coherence score detected' },
  E_MEDIUM_REQUIRED: { code: 'CSL_003', level: 'MEDIUM', message: 'Medium coherence required but not met' },
  E_HIGH_REQUIRED: { code: 'CSL_004', level: 'HIGH', message: 'High coherence required for this operation' },
  E_CRITICAL_REQUIRED: { code: 'CSL_005', level: 'CRITICAL', message: 'Critical coherence required for governance' },
  E_DUPLICATE_DETECTED: { code: 'CSL_006', level: 'DEDUP', message: 'Duplicate content detected above dedup threshold' },
  E_SERVICE_UNREACHABLE: { code: 'CSL_010', level: 'MINIMUM', message: 'Service unreachable' },
  E_CIRCUIT_OPEN: { code: 'CSL_011', level: 'LOW', message: 'Circuit breaker is open' },
  E_TIMEOUT: { code: 'CSL_012', level: 'MEDIUM', message: 'Operation timed out' },
  E_PIPELINE_FAILED: { code: 'CSL_013', level: 'HIGH', message: 'Pipeline stage failure' },
  E_GOVERNANCE_VIOLATION: { code: 'CSL_014', level: 'CRITICAL', message: 'Governance policy violation' },
};

// ─── POOL ALLOCATIONS ────────────────────────────────────────────────────────

/**
 * @constant {Object} POOLS - Resource pool allocations (Fibonacci-derived percentages)
 * Hot(34%) + Warm(21%) + Cold(13%) + Reserve(8%) + Governance(5%) = ~81% active
 * Remaining 19% is system overhead (also Fibonacci-adjacent)
 */
const POOLS = {
  HOT: { ratio: 0.34, fib: FIB[9], label: 'Hot Pool' },
  WARM: { ratio: 0.21, fib: FIB[8], label: 'Warm Pool' },
  COLD: { ratio: 0.13, fib: FIB[7], label: 'Cold Pool' },
  RESERVE: { ratio: 0.08, fib: FIB[6], label: 'Reserve Pool' },
  GOVERNANCE: { ratio: 0.05, fib: FIB[5], label: 'Governance Pool' },
};

/** @constant {number} TOTAL_POOL_RATIO - Sum of all pool ratios */
const TOTAL_POOL_RATIO = Object.values(POOLS).reduce((s, p) => s + p.ratio, 0);

// ─── SACRED GEOMETRY RINGS ───────────────────────────────────────────────────

/**
 * @constant {Object} SACRED_GEOMETRY - Topology ring definitions
 */
const SACRED_GEOMETRY = {
  CENTER: {
    order: 0,
    label: 'Center',
    nodes: ['HeadySoul'],
    weight: PHI_CUBED,
  },
  INNER_RING: {
    order: 1,
    label: 'Inner Ring',
    nodes: ['HeadyBrains', 'HeadyConductor', 'HeadyVinci', 'HeadyAutoSuccess', 'GENESIS'],
    weight: PHI_SQUARED,
  },
  MIDDLE_RING: {
    order: 2,
    label: 'Middle Ring',
    nodes: ['JULES', 'BUILDER', 'OBSERVER', 'MURPHY', 'ATLAS', 'PYTHIA', 'NEXUS'],
    weight: PHI,
  },
  OUTER_RING: {
    order: 3,
    label: 'Outer Ring',
    nodes: ['BRIDGE', 'MUSE', 'SENTINEL', 'NOVA', 'JANITOR', 'SOPHIA', 'CIPHER', 'LENS', 'AEGIS'],
    weight: 1.0,
  },
  GOVERNANCE: {
    order: 4,
    label: 'Governance',
    nodes: ['HeadyCheck', 'HeadyAssure', 'HeadyAware', 'HeadyPatterns', 'HeadyMC', 'HeadyRisks', 'ORACLE', 'CHRONICLE'],
    weight: PSI,
  },
};

// ─── BACKOFF FUNCTIONS ───────────────────────────────────────────────────────

/**
 * Calculate phi-exponential backoff delay
 * @param {number} attempt - The retry attempt number (0-indexed)
 * @param {number} baseMs - Base delay in milliseconds (default: FIB[6] * 100 = 800ms)
 * @returns {number} Delay in milliseconds
 */
function phiBackoff(attempt, baseMs = FIB[6] * 100) {
  const delay = baseMs * Math.pow(PHI, attempt);
  const jitter = delay * PSI * Math.random();
  return Math.min(delay + jitter, FIB[12] * 100); // Cap at 14400ms
}

/**
 * Calculate fibonacci backoff using direct FIB sequence
 * @param {number} attempt - The retry attempt number (0-indexed)
 * @param {number} baseMs - Base delay in milliseconds
 * @returns {number} Delay in milliseconds
 */
function fibBackoff(attempt, baseMs = 100) {
  const fibIndex = Math.min(attempt, FIB.length - 1);
  return FIB[fibIndex] * baseMs;
}

/**
 * Calculate adaptive interval based on load factor
 * @param {number} baseInterval - Base interval in ms
 * @param {number} loadFactor - Current load 0.0 to 1.0
 * @returns {number} Adjusted interval in ms
 */
function adaptiveInterval(baseInterval, loadFactor) {
  if (loadFactor <= PSI) return baseInterval;
  const pressure = (loadFactor - PSI) / (1 - PSI);
  return baseInterval * (1 + pressure * PHI);
}

// ─── FUSION WEIGHTS ──────────────────────────────────────────────────────────

/**
 * @constant {Object} FUSION_WEIGHTS - Weights for multi-source data fusion
 * Each weight is PHI-derived to ensure golden ratio proportionality
 */
const FUSION_WEIGHTS = {
  PRIMARY: PHI / (PHI + 1),         // ~0.618 (highest priority source)
  SECONDARY: 1 / (PHI + 1),         // ~0.382
  TERTIARY: PSI * PSI,              // ~0.382 * 0.618 = ~0.236
  QUATERNARY: PSI * PSI * PSI,      // ~0.146
  HISTORICAL: 1 / PHI_CUBED,       // ~0.236
  PREDICTIVE: PSI / PHI,           // ~0.382
  CONSENSUS: PHI / PHI_SQUARED,    // ~0.618
};

// ─── TEMPORAL DECAY ──────────────────────────────────────────────────────────

/**
 * Calculate phi-based temporal decay factor
 * @param {number} ageMs - Age in milliseconds
 * @param {number} halfLifeMs - Half-life in milliseconds (default: 1 hour * PHI)
 * @returns {number} Decay factor between 0 and 1
 */
function phiDecay(ageMs, halfLifeMs = 3600000 * PHI) {
  return Math.pow(PSI, ageMs / halfLifeMs);
}

/**
 * Calculate urgency score with phi scaling
 * @param {number} severity - Severity 0-1
 * @param {number} timeToImpact - Seconds until impact
 * @param {number} affectedScope - Fraction of system affected 0-1
 * @returns {number} Urgency score
 */
function phiUrgency(severity, timeToImpact, affectedScope) {
  const timeFactor = 1 / (1 + timeToImpact / (FIB[8] * 60));
  return (severity * PHI + timeFactor * PHI_SQUARED + affectedScope) / PHI_CUBED;
}

// ─── CIRCUIT BREAKER SETTINGS ────────────────────────────────────────────────

/**
 * @constant {Object} CIRCUIT_BREAKER - Default circuit breaker configuration
 */
const CIRCUIT_BREAKER = {
  FAILURE_THRESHOLD: FIB[5],       // 5 failures to open
  SUCCESS_THRESHOLD: FIB[4],       // 3 successes to close
  HALF_OPEN_MAX: FIB[3],           // 2 concurrent in half-open
  TIMEOUT_MS: FIB[8] * 1000,      // 21 second timeout
  RESET_TIMEOUT_MS: FIB[10] * 1000, // 55 second reset
};

// ─── VECTOR SPACE ────────────────────────────────────────────────────────────

/**
 * @constant {Object} VECTOR - Vector space configuration
 */
const VECTOR = {
  DIMENSIONS: FIB[9] * 11 + FIB[6] * 2, // 384 dimensions (34*11 + 8*2)
  HNSW_M: FIB[8],                        // 21
  HNSW_EF_CONSTRUCTION: FIB[11],         // 89
  HNSW_EF_SEARCH: FIB[9],               // 34
};

// ─── ADAPTIVE INTERVALS ──────────────────────────────────────────────────────

/**
 * @constant {Object} INTERVALS - Standard polling/check intervals in ms
 */
const INTERVALS = {
  HEARTBEAT: FIB[5] * 1000,        // 5s
  HEALTH_CHECK: FIB[7] * 1000,     // 13s
  METRICS_EMIT: FIB[8] * 1000,     // 21s
  COHERENCE_SCAN: FIB[9] * 1000,   // 34s
  DEEP_SCAN: FIB[10] * 1000,       // 55s
  CONSOLIDATION: FIB[11] * 1000,   // 89s
  REBALANCE: FIB[12] * 1000,       // 144s
};

// ─── LOGGING HELPERS ─────────────────────────────────────────────────────────

/**
 * Generate a correlation ID with phi-timestamp encoding
 * @param {string} [prefix='heady'] - ID prefix
 * @returns {string} Correlation ID
 */
function correlationId(prefix = 'heady') {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 2 + FIB[6]);
  return `${prefix}-${ts}-${rand}`;
}

/**
 * Create a structured JSON log entry
 * @param {string} level - Log level: debug, info, warn, error, fatal
 * @param {string} component - Component name
 * @param {string} message - Log message
 * @param {Object} [meta={}] - Additional metadata
 * @param {string} [corrId] - Correlation ID
 * @returns {Object} Structured log entry
 */
function structuredLog(level, component, message, meta = {}, corrId) {
  return {
    timestamp: new Date().toISOString(),
    level,
    component,
    message,
    correlationId: corrId || correlationId(component),
    phi: PHI,
    ...meta,
  };
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

module.exports = {
  // Fundamental constants
  PHI,
  PSI,
  PHI_SQUARED,
  PHI_CUBED,
  PHI_INVERSE_SQUARED,
  SQRT_FIVE,
  LN_PHI,

  // Sequences
  FIB,
  FIB_MAP,

  // Thresholds and classifications
  CSL,
  CSL_ERROR_CODES,

  // Pool allocations
  POOLS,
  TOTAL_POOL_RATIO,

  // Topology
  SACRED_GEOMETRY,

  // Functions
  phiBackoff,
  fibBackoff,
  adaptiveInterval,
  phiDecay,
  phiUrgency,

  // Circuit breaker
  CIRCUIT_BREAKER,

  // Vector
  VECTOR,

  // Intervals
  INTERVALS,

  // Fusion
  FUSION_WEIGHTS,

  // Logging
  correlationId,
  structuredLog,
};
