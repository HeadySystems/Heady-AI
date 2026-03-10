/**
 * Heady™ Semantic Backpressure v5.0.0
 * SRE adaptive throttling, semantic dedup, circuit breaker, φ-scored admission
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */

import { PHI, PSI, FIB, CSL_THRESHOLDS, cosineSimilarity, phiBackoff, TIMING } from '../../shared/phi-math.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('backpressure');

// ═══ Types ═══
export type PressureLevel = 'NOMINAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
export type CriticalityTier = 'CRITICAL_PLUS' | 'CRITICAL' | 'SHEDDABLE_PLUS' | 'SHEDDABLE';
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface BackpressureMetrics {
  pressureLevel: PressureLevel;
  queueDepth: number;
  maxQueueDepth: number;
  acceptRate: number;
  rejectRate: number;
  dedupCount: number;
  circuitState: CircuitState;
  throttleRatio: number;
}

interface QueueEntry {
  id: string;
  embedding: number[] | null;
  criticality: CriticalityTier;
  score: number;
  enqueuedAt: number;
}

interface DedupCacheEntry {
  embedding: number[];
  result: unknown;
  createdAt: number;
}

// ═══ Pressure Thresholds (φ-derived) ═══
const PRESSURE_THRESHOLDS = {
  NOMINAL_MAX:   Math.pow(PSI, 2),        // ≈ 0.382
  ELEVATED_MAX:  PSI,                      // ≈ 0.618
  HIGH_MAX:      1 - Math.pow(PSI, 3),    // ≈ 0.854
  CRITICAL_MIN:  1 - Math.pow(PSI, 4),    // ≈ 0.910
};

// ═══ Criticality Weights (Fibonacci) ═══
const CRITICALITY_WEIGHTS: Record<CriticalityTier, number> = {
  CRITICAL_PLUS:   FIB[7],   // 13
  CRITICAL:        FIB[6],   // 8
  SHEDDABLE_PLUS:  FIB[5],   // 5
  SHEDDABLE:       FIB[3],   // 2
};

// ═══ State ═══
const queue: QueueEntry[] = [];
const MAX_QUEUE_DEPTH = FIB[13];              // 233
const dedupCache = new Map<string, DedupCacheEntry>();
const DEDUP_CACHE_MAX = FIB[17];              // 1597
const DEDUP_CACHE_TTL_MS = FIB[11] * 1000;   // 89,000ms
const DEDUP_THRESHOLD = CSL_THRESHOLDS.CRITICAL; // ≈ 0.927

// SRE Adaptive Throttle State
let requestCount = 0;
let acceptCount = 0;
let windowStart = Date.now();
const SRE_WINDOW_MS = FIB[11] * 1000;        // 89s (≈ 2 min rolling window)
const SRE_K = PHI + PSI;                     // K ≈ 2.236 (√5, naturally)

// Circuit Breaker
let circuitState: CircuitState = 'CLOSED';
let consecutiveFailures = 0;
const CIRCUIT_FAILURE_THRESHOLD = FIB[5];     // 5
const CIRCUIT_RECOVERY_MS = FIB[9] * 1000;   // 34,000ms
let circuitOpenedAt = 0;
const HALF_OPEN_PROBES = FIB[3];              // 3
let halfOpenProbeCount = 0;

// ═══ Compute Pressure Level ═══
export function computePressure(): PressureLevel {
  const utilization = queue.length / MAX_QUEUE_DEPTH;
  if (utilization < PRESSURE_THRESHOLDS.NOMINAL_MAX) return 'NOMINAL';
  if (utilization < PRESSURE_THRESHOLDS.ELEVATED_MAX) return 'ELEVATED';
  if (utilization < PRESSURE_THRESHOLDS.HIGH_MAX) return 'HIGH';
  return 'CRITICAL';
}

// ═══ SRE Adaptive Throttle ═══
// Google SRE algorithm: P(reject) = max(0, (requests - K * accepts) / (requests + 1))
function shouldThrottle(): boolean {
  const now = Date.now();
  if (now - windowStart > SRE_WINDOW_MS) {
    requestCount = 0;
    acceptCount = 0;
    windowStart = now;
  }

  requestCount++;
  const rejectProbability = Math.max(0, (requestCount - SRE_K * acceptCount) / (requestCount + 1));

  if (Math.random() < rejectProbability) {
    logger.warn('SRE throttle rejected request', { requestCount, acceptCount, rejectProbability });
    return true;
  }

  acceptCount++;
  return false;
}

// ═══ Semantic Deduplication ═══
function checkDedup(embedding: number[]): { isDuplicate: boolean; cachedResult: unknown | null } {
  const now = Date.now();

  // Clean expired entries
  for (const [key, entry] of dedupCache) {
    if (now - entry.createdAt > DEDUP_CACHE_TTL_MS) {
      dedupCache.delete(key);
    }
  }

  // Check for semantic duplicates
  for (const [key, entry] of dedupCache) {
    const similarity = cosineSimilarity(embedding, entry.embedding);
    if (similarity >= DEDUP_THRESHOLD) {
      logger.info('Semantic duplicate detected', { similarity, threshold: DEDUP_THRESHOLD });
      return { isDuplicate: true, cachedResult: entry.result };
    }
  }

  return { isDuplicate: false, cachedResult: null };
}

export function cacheDedupResult(id: string, embedding: number[], result: unknown): void {
  if (dedupCache.size >= DEDUP_CACHE_MAX) {
    // Evict oldest entries (ψ⁴ ≈ 14.6% of cache)
    const evictCount = Math.ceil(DEDUP_CACHE_MAX * Math.pow(PSI, 4));
    const entries = Array.from(dedupCache.entries())
      .sort((a, b) => a[1].createdAt - b[1].createdAt)
      .slice(0, evictCount);
    for (const [key] of entries) {
      dedupCache.delete(key);
    }
  }

  dedupCache.set(id, { embedding, result, createdAt: Date.now() });
}

// ═══ Circuit Breaker ═══
function checkCircuit(): boolean {
  if (circuitState === 'CLOSED') return true;

  if (circuitState === 'OPEN') {
    const elapsed = Date.now() - circuitOpenedAt;
    if (elapsed > CIRCUIT_RECOVERY_MS) {
      circuitState = 'HALF_OPEN';
      halfOpenProbeCount = 0;
      logger.info('Circuit breaker entering HALF_OPEN');
      return true;
    }
    return false;
  }

  if (circuitState === 'HALF_OPEN') {
    halfOpenProbeCount++;
    return halfOpenProbeCount <= HALF_OPEN_PROBES;
  }

  return true;
}

export function recordSuccess(): void {
  consecutiveFailures = 0;
  if (circuitState === 'HALF_OPEN') {
    circuitState = 'CLOSED';
    logger.info('Circuit breaker CLOSED (recovered)');
  }
}

export function recordFailure(): void {
  consecutiveFailures++;
  if (consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
    circuitState = 'OPEN';
    circuitOpenedAt = Date.now();
    logger.warn('Circuit breaker OPENED', { failures: consecutiveFailures });
  }
}

// ═══ Priority Scoring (φ-weighted) ═══
function computeScore(criticality: CriticalityTier, urgency: number, impact: number): number {
  const critWeight = CRITICALITY_WEIGHTS[criticality];
  // φ-fusion: [0.528, 0.326, 0.146]
  return critWeight * 0.528 + urgency * 0.326 + impact * 0.146;
}

// ═══ Admission Control ═══
export function admit(
  id: string,
  embedding: number[] | null,
  criticality: CriticalityTier,
  urgency: number = PSI,
  impact: number = PSI,
): { admitted: boolean; reason: string; cachedResult?: unknown } {
  // 1. Circuit breaker check
  if (!checkCircuit()) {
    return { admitted: false, reason: 'Circuit breaker OPEN' };
  }

  // 2. SRE throttle check
  if (shouldThrottle()) {
    return { admitted: false, reason: 'SRE adaptive throttle rejected' };
  }

  // 3. Semantic dedup check
  if (embedding) {
    const { isDuplicate, cachedResult } = checkDedup(embedding);
    if (isDuplicate) {
      return { admitted: false, reason: 'Semantic duplicate', cachedResult };
    }
  }

  // 4. Queue capacity check
  if (queue.length >= MAX_QUEUE_DEPTH) {
    const pressure = computePressure();

    // Load shedding by pressure level
    if (pressure === 'CRITICAL' && criticality !== 'CRITICAL_PLUS') {
      return { admitted: false, reason: 'CRITICAL pressure — only CRITICAL_PLUS admitted' };
    }
    if (pressure === 'HIGH' && (criticality === 'SHEDDABLE' || criticality === 'SHEDDABLE_PLUS')) {
      return { admitted: false, reason: 'HIGH pressure — SHEDDABLE tasks shed' };
    }

    return { admitted: false, reason: 'Queue at capacity' };
  }

  // 5. Admit
  const score = computeScore(criticality, urgency, impact);
  queue.push({ id, embedding, criticality, score, enqueuedAt: Date.now() });

  // Sort by score (highest first)
  queue.sort((a, b) => b.score - a.score);

  return { admitted: true, reason: 'Admitted' };
}

// ═══ Dequeue ═══
export function dequeue(): QueueEntry | null {
  return queue.shift() || null;
}

// ═══ Metrics ═══
export function getBackpressureMetrics(): BackpressureMetrics {
  const now = Date.now();
  const windowRequests = requestCount;
  const windowAccepts = acceptCount;

  return {
    pressureLevel: computePressure(),
    queueDepth: queue.length,
    maxQueueDepth: MAX_QUEUE_DEPTH,
    acceptRate: windowRequests > 0 ? windowAccepts / windowRequests : 1.0,
    rejectRate: windowRequests > 0 ? 1 - windowAccepts / windowRequests : 0,
    dedupCount: dedupCache.size,
    circuitState,
    throttleRatio: windowRequests > 0 ? Math.max(0, (windowRequests - SRE_K * windowAccepts) / (windowRequests + 1)) : 0,
  };
}
