/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Phi-Math Foundation — shared/phi-math.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Canonical module for φ-derived constants, Fibonacci sequences, CSL thresholds,
 * backoff timing, fusion weights, pressure levels, and resource allocation.
 *
 * DESIGN PRINCIPLE: No magic numbers. Every constant derives from φ = (1+√5)/2.
 *
 * © HeadySystems Inc. — Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

'use strict';

// ─── Core Constants ──────────────────────────────────────────────────────────

const PHI   = (1 + Math.sqrt(5)) / 2;  // φ  ≈ 1.6180339887
const PSI   = 1 / PHI;                 // ψ  ≈ 0.6180339887 (conjugate)
const PHI_SQ = PHI + 1;                // φ² ≈ 2.6180339887
const PHI_CU = 2 * PHI + 1;            // φ³ ≈ 4.2360679775
const PHI_4  = 3 * PHI + 2;            // φ⁴ ≈ 6.8541019662
const PHI_5  = 5 * PHI + 3;            // φ⁵ ≈ 11.0901699437

// Pre-computed ψ powers for threshold calculations
const PSI_POWERS = Array.from({ length: 16 }, (_, i) => Math.pow(PSI, i));

// ─── Fibonacci ───────────────────────────────────────────────────────────────

const _fibCache = new Map([[0, 0], [1, 1]]);

/**
 * Compute Fibonacci number with memoization.
 * @param {number} n - Index (0-based)
 * @returns {number}
 */
function fib(n) {
  if (n < 0) return 0;
  if (_fibCache.has(n)) return _fibCache.get(n);
  const val = fib(n - 1) + fib(n - 2);
  _fibCache.set(n, val);
  return val;
}

/**
 * Return an array of Fibonacci numbers from fib(from) to fib(to).
 * @param {number} from
 * @param {number} to
 * @returns {number[]}
 */
function fibRange(from, to) {
  const result = [];
  for (let i = from; i <= to; i++) result.push(fib(i));
  return result;
}

/**
 * Find the nearest Fibonacci number to a given value.
 * @param {number} value
 * @returns {number}
 */
function nearestFib(value) {
  if (value <= 0) return 0;
  let a = 0, b = 1;
  while (b < value) { [a, b] = [b, a + b]; }
  return (value - a) < (b - value) ? a : b;
}

// ─── CSL Thresholds ──────────────────────────────────────────────────────────

/**
 * Phi-harmonic threshold: 1 - ψ^level × spread
 * @param {number} level  - 0=MINIMUM, 1=LOW, 2=MEDIUM, 3=HIGH, 4=CRITICAL
 * @param {number} [spread=0.5]
 * @returns {number}
 */
function phiThreshold(level, spread = 0.5) {
  return 1 - PSI_POWERS[level] * spread;
}

const CSL_THRESHOLDS = Object.freeze({
  MINIMUM:  phiThreshold(0),   // ≈ 0.500
  LOW:      phiThreshold(1),   // ≈ 0.691
  MEDIUM:   phiThreshold(2),   // ≈ 0.809
  HIGH:     phiThreshold(3),   // ≈ 0.882
  CRITICAL: phiThreshold(4),   // ≈ 0.927
  DEDUP:    1 - PSI_POWERS[5] * 0.5, // ≈ 0.955 — semantic identity
  IDENTITY: 1 - PSI_POWERS[6] * 0.5, // ≈ 0.972 — near-identical
});

// ─── Pressure Levels ─────────────────────────────────────────────────────────

const PRESSURE_LEVELS = Object.freeze({
  NOMINAL:  { min: 0,                      max: PSI_POWERS[2] },    // 0 – 0.382
  ELEVATED: { min: PSI_POWERS[2],          max: PSI },              // 0.382 – 0.618
  HIGH:     { min: PSI,                    max: 1 - PSI_POWERS[3] },// 0.618 – 0.854
  CRITICAL: { min: 1 - PSI_POWERS[4],     max: 1.0 },              // 0.910 – 1.0
});

/**
 * Determine pressure level from a 0–1 value.
 * @param {number} value
 * @returns {'NOMINAL'|'ELEVATED'|'HIGH'|'CRITICAL'}
 */
function pressureLevel(value) {
  if (value >= PRESSURE_LEVELS.CRITICAL.min) return 'CRITICAL';
  if (value >= PRESSURE_LEVELS.HIGH.min)     return 'HIGH';
  if (value >= PRESSURE_LEVELS.ELEVATED.min) return 'ELEVATED';
  return 'NOMINAL';
}

// ─── Alert Thresholds ────────────────────────────────────────────────────────

const ALERT_THRESHOLDS = Object.freeze({
  WARNING:  PSI,               // ≈ 0.618
  CAUTION:  1 - PSI_POWERS[2], // ≈ 0.764 (1 - ψ² ≈ 1 - 0.236)
  CRITICAL: 1 - PSI_POWERS[3], // ≈ 0.854
  EXCEEDED: 1 - PSI_POWERS[4], // ≈ 0.910
  HARD_MAX: 1.0,
});

// ─── Backoff Timing ──────────────────────────────────────────────────────────

/**
 * Phi-exponential backoff with optional jitter.
 * @param {number} attempt - 0-based attempt number
 * @param {number} [baseMs=1000] - Base delay in milliseconds
 * @param {number} [maxMs=60000] - Maximum delay cap
 * @param {boolean} [jitter=true] - Apply ±ψ² jitter
 * @returns {number} Delay in milliseconds
 */
function phiBackoff(attempt, baseMs = 1000, maxMs = 60000, jitter = true) {
  const raw = baseMs * Math.pow(PHI, attempt);
  const capped = Math.min(raw, maxMs);
  if (!jitter) return Math.round(capped);
  // Jitter: ±ψ² (≈ ±38.2%)
  const jitterFactor = 1 + (Math.random() * 2 - 1) * PSI_POWERS[2];
  return Math.round(Math.min(capped * jitterFactor, maxMs));
}

/**
 * Phi-harmonic interval for adaptive polling / heartbeats.
 * @param {number} level - 0=fastest, higher=slower
 * @param {number} [baseMs=1000]
 * @returns {number}
 */
function phiInterval(level, baseMs = 1000) {
  return Math.round(baseMs * Math.pow(PHI, level));
}

// ─── Fusion Weights ──────────────────────────────────────────────────────────

/**
 * Generate N phi-geometric fusion weights that sum to 1.
 * First weight is largest (ψ-geometric series).
 * @param {number} n - Number of factors
 * @returns {number[]}
 */
function phiFusionWeights(n) {
  if (n <= 0) return [];
  if (n === 1) return [1.0];
  const raw = Array.from({ length: n }, (_, i) => PSI_POWERS[i]);
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(w => w / sum);
}

/**
 * Compute priority score from weighted factors using phi-fusion.
 * @param {...number} factors - Numeric factor values (most important first)
 * @returns {number}
 */
function phiPriorityScore(...factors) {
  const weights = phiFusionWeights(factors.length);
  return factors.reduce((sum, f, i) => sum + f * weights[i], 0);
}

// ─── Resource Allocation ─────────────────────────────────────────────────────

/**
 * Phi-geometric resource split: allocate a whole into N parts.
 * @param {number} whole - Total to split
 * @param {number} n - Number of parts
 * @returns {number[]} Array of allocations summing to whole
 */
function phiMultiSplit(whole, n) {
  const weights = phiFusionWeights(n);
  const parts = weights.map(w => Math.floor(whole * w));
  // Distribute remainder to the first bucket
  const remainder = whole - parts.reduce((a, b) => a + b, 0);
  parts[0] += remainder;
  return parts;
}

/**
 * Standard 5-pool resource allocation (Hot/Warm/Cold/Reserve/Governance).
 * Based on Fibonacci ratios: 34% / 21% / 13% / 8% / 5%.
 * @param {number} total
 * @returns {{ hot: number, warm: number, cold: number, reserve: number, governance: number }}
 */
function poolAllocation(total) {
  const fibs = [fib(9), fib(8), fib(7), fib(6), fib(5)]; // 34, 21, 13, 8, 5
  const sum = fibs.reduce((a, b) => a + b, 0); // 81
  const alloc = fibs.map(f => Math.floor(total * f / sum));
  const remainder = total - alloc.reduce((a, b) => a + b, 0);
  alloc[0] += remainder;
  return {
    hot:        alloc[0],
    warm:       alloc[1],
    cold:       alloc[2],
    reserve:    alloc[3],
    governance: alloc[4],
  };
}

// ─── Token Budgets ───────────────────────────────────────────────────────────

/**
 * Phi-geometric token budget progression.
 * @param {number} [base=8192]
 * @returns {{ working: number, session: number, memory: number, artifacts: number }}
 */
function phiTokenBudgets(base = 8192) {
  return {
    working:   base,
    session:   Math.round(base * PHI_SQ),   // ≈ 21,450
    memory:    Math.round(base * PHI_4),     // ≈ 56,131
    artifacts: Math.round(base * Math.pow(PHI, 6)), // ≈ 146,920
  };
}

// ─── CSL Gate Helper ─────────────────────────────────────────────────────────

/**
 * Soft sigmoid gate: output = value × σ((cosScore - τ) / temperature)
 * @param {number} value - Input signal
 * @param {number} cosScore - Cosine similarity score
 * @param {number} [tau=CSL_THRESHOLDS.MEDIUM] - Gate threshold
 * @param {number} [temp] - Temperature (default ψ³ ≈ 0.236)
 * @returns {number}
 */
function cslGate(value, cosScore, tau = CSL_THRESHOLDS.MEDIUM, temp = PSI_POWERS[3]) {
  const sigmoid = 1 / (1 + Math.exp(-(cosScore - tau) / temp));
  return value * sigmoid;
}

/**
 * CSL smooth weight interpolation.
 * @param {number} wHigh - Weight when cosScore >> tau
 * @param {number} wLow  - Weight when cosScore << tau
 * @param {number} cosScore
 * @param {number} [tau=CSL_THRESHOLDS.MEDIUM]
 * @param {number} [temp]
 * @returns {number}
 */
function cslBlend(wHigh, wLow, cosScore, tau = CSL_THRESHOLDS.MEDIUM, temp = PSI_POWERS[3]) {
  const sigmoid = 1 / (1 + Math.exp(-(cosScore - tau) / temp));
  return wLow + (wHigh - wLow) * sigmoid;
}

/**
 * Adaptive temperature based on entropy.
 * Higher entropy → higher temperature (softer gating).
 * @param {number} entropy
 * @param {number} maxEntropy
 * @returns {number}
 */
function adaptiveTemperature(entropy, maxEntropy) {
  const ratio = Math.min(entropy / maxEntropy, 1);
  return PSI_POWERS[3] + ratio * (PSI - PSI_POWERS[3]); // ψ³ to ψ range
}

// ─── Eviction Weights ────────────────────────────────────────────────────────

const EVICTION_WEIGHTS = Object.freeze({
  importance: PSI_POWERS[0] / (PSI_POWERS[0] + PSI_POWERS[1] + PSI_POWERS[2]),  // ≈ 0.486
  recency:    PSI_POWERS[1] / (PSI_POWERS[0] + PSI_POWERS[1] + PSI_POWERS[2]),  // ≈ 0.300
  relevance:  PSI_POWERS[2] / (PSI_POWERS[0] + PSI_POWERS[1] + PSI_POWERS[2]),  // ≈ 0.214
});

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Core constants
  PHI, PSI, PHI_SQ, PHI_CU, PHI_4, PHI_5, PSI_POWERS,

  // Fibonacci
  fib, fibRange, nearestFib,

  // Thresholds and levels
  CSL_THRESHOLDS, phiThreshold,
  PRESSURE_LEVELS, pressureLevel,
  ALERT_THRESHOLDS,
  EVICTION_WEIGHTS,

  // Timing
  phiBackoff, phiInterval,

  // Scoring and fusion
  phiFusionWeights, phiPriorityScore,

  // Resource allocation
  phiMultiSplit, poolAllocation,

  // Token budgets
  phiTokenBudgets,

  // CSL helpers
  cslGate, cslBlend, adaptiveTemperature,
};
