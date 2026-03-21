// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  φ-Math Constants — Sacred Geometry Mathematical Foundation      ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const PHI = 1.618033988749895; // Golden Ratio
const PSI = 1 / PHI; // ≈ 0.618 (Reciprocal of φ)
const PSI2 = PSI * PSI; // ≈ 0.382 (PSI squared)
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987]; // Fibonacci sequence

// Closed-System Logic (CSL) Gates — confidence thresholds
const CSL_GATES = {
  include: PSI2,
  // 0.382 — lower threshold for system inclusion
  boost: PSI,
  // 0.618 — normal confidence threshold
  inject: PSI + 0.1 // 0.718 — high confidence for pattern injection
};

// ═══════════════════════════════════════════════════════════════════
// Derived Constants: Timeouts, Circuit Breakers, Rate Limits
// ═══════════════════════════════════════════════════════════════════

// Connection and request timeouts based on φ scaling
const PHI_TIMEOUT_CONNECT = Math.round(PHI * 1000); // ~1618ms
const PHI_TIMEOUT_REQUEST = Math.round(PHI * PHI * PHI * 1000); // ~4236ms

// Circuit Breaker configuration (threshold, reset timeout, half-open max)
const PHI_CIRCUIT_BREAKER = {
  threshold: FIB[10],
  // 89 failures to open circuit
  resetTimeout: FIB[9] * 1000,
  halfOpenMax: FIB[8] // 34 requests in half-open state
};

// Bulkhead pattern (concurrent + queued limits)
const PHI_BULKHEAD = {
  concurrent: FIB[8],
  // 34 concurrent requests
  queued: FIB[9] // 55 queued requests
};

// Rate limits (requests per window) by authentication level
const PHI_RATE_LIMITS = {
  anonymous: FIB[8],
  // 34 req/min for anonymous
  authenticated: FIB[10],
  // 89 req/min for authenticated
  enterprise: FIB[12] // 233 req/min for enterprise
};

// Cache sizes (entries) by tier
const PHI_CACHE_SIZES = {
  small: FIB[7],
  // 21 entries
  medium: FIB[9],
  // 55 entries
  large: FIB[11] // 144 entries
};

// Retry backoff strategy (max retries, base delay, φ multiplier)
const PHI_RETRY = {
  maxRetries: 4,
  baseDelay: FIB[5] * 100,
  // 800ms (5 * 100)
  multiplier: PHI // φ-based exponential backoff
};

// Feature flag rollout stages (proportion of users/requests)
const PHI_ROLLOUT = [0.0618, 0.382, 0.618, 1.0]; // ~6%, 38%, 62%, 100%

// ═══════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════

/**
 * Scale a base value by φ raised to power n
 * phiScale(100, 2) => 100 * φ^2 ≈ 261.8
 */
function phiScale(base, n) {
  return base * Math.pow(PHI, n);
}

/**
 * Find the nearest Fibonacci number to a given value
 */
function fibNearest(n) {
  return FIB.reduce((prev, curr) => Math.abs(curr - n) < Math.abs(prev - n) ? curr : prev);
}

/**
 * Check if confidence passes a CSL gate
 * cslGate(0.65, 'boost') => true (0.65 >= 0.618)
 */
function cslGate(confidence, gate = 'boost') {
  return confidence >= CSL_GATES[gate];
}

/**
 * Calculate exponential backoff with φ multiplier (capped at 30s)
 * phiBackoff(0) => 800ms, phiBackoff(1) => ~1294ms, phiBackoff(2) => ~2094ms
 */
function phiBackoff(attempt, baseMs = 800) {
  return Math.min(baseMs * Math.pow(PHI, attempt), 30000);
}

// ═══════════════════════════════════════════════════════════════════
// Compatibility aliases (match dist/index.js exports)
// ═══════════════════════════════════════════════════════════════════

/** Compute the nth Fibonacci number (1-indexed; fib(0)=0). */
function fib(n) {
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  let a = 1, b = 1;
  for (let i = 3; i <= n; i++) { const next = a + b; a = b; b = next; }
  return b;
}

const CSL_BANDS = {
  DORMANT_MAX: 0.236068,
  LOW_MAX:     PSI2,       // 0.381966
  MODERATE_MAX: PSI + 0.000001, // 0.618034
  HIGH_MAX:    0.854102,
  CRITICAL_MAX: 1,
};

function phiBackoffMs(attempt, baseMs = 1000, maxMs = fib(15) * 100) {
  const delay = baseMs * Math.pow(PHI, Math.max(0, attempt));
  return Math.round(Math.min(delay, maxMs));
}

// ═══════════════════════════════════════════════════════════════════
// Module Exports
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  // Core constants
  PHI,
  PSI,
  PSI2,
  FIB,
  CSL_GATES,
  // Timeout constants
  PHI_TIMEOUT_CONNECT,
  PHI_TIMEOUT_REQUEST,
  // System configuration constants
  PHI_CIRCUIT_BREAKER,
  PHI_BULKHEAD,
  PHI_RATE_LIMITS,
  PHI_CACHE_SIZES,
  PHI_RETRY,
  PHI_ROLLOUT,
  // Utility functions
  phiScale,
  fibNearest,
  cslGate,
  phiBackoff
};