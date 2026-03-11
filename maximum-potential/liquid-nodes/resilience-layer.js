/**
 * resilience-layer.js — Circuit breakers, retry, backpressure, deduplication.
 *
 * All thresholds, delays, and pool sizes derived from phi (1.618) and Fibonacci.
 * No magic numbers.
 */

import { randomUUID } from 'crypto';
import {
  PHI, PSI, FIB,
  CIRCUIT_BREAKER_THRESHOLD, CIRCUIT_BREAKER_HALF_OPEN_MAX,
  CIRCUIT_BREAKER_RESET_MS, RETRY_BASE_DELAY_MS, BACKOFF_MAX_MS,
} from './constants.js';
import { cosineSimilarity } from './vector-space-ops.js';

// ---------------------------------------------------------------------------
// Phi-backoff delay
// ---------------------------------------------------------------------------

/**
 * Compute phi-exponential backoff delay.
 * @param {number} attempt — 0-indexed
 * @param {number} [baseMs=RETRY_BASE_DELAY_MS]
 * @param {number} [maxMs=BACKOFF_MAX_MS]
 * @returns {number}
 */
export function phiBackoffDelay(attempt, baseMs = RETRY_BASE_DELAY_MS, maxMs = BACKOFF_MAX_MS) {
  const delay = baseMs * Math.pow(PHI, attempt);
  const jitter = delay * PSI * Math.random();
  return Math.min(delay + jitter, maxMs);
}

/**
 * Fibonacci-sequence delay.
 * @param {number} attempt
 * @param {number} [baseMs=RETRY_BASE_DELAY_MS]
 * @returns {number}
 */
export function fibonacciDelay(attempt, baseMs = RETRY_BASE_DELAY_MS) {
  const idx = Math.min(attempt, FIB.length - 1);
  return baseMs * FIB[idx];
}

// ---------------------------------------------------------------------------
// CircuitBreaker
// ---------------------------------------------------------------------------

export class CircuitBreaker {
  /**
   * @param {object} [opts={}]
   * @param {number} [opts.threshold=5]
   * @param {number} [opts.resetMs]
   * @param {number} [opts.halfOpenMax=3]
   * @param {string} [opts.name='default']
   */
  constructor(opts = {}) {
    this.name = opts.name || 'default';
    this.threshold = opts.threshold || CIRCUIT_BREAKER_THRESHOLD;
    this.resetMs = opts.resetMs || CIRCUIT_BREAKER_RESET_MS;
    this.halfOpenMax = opts.halfOpenMax || CIRCUIT_BREAKER_HALF_OPEN_MAX;

    this._state = 'CLOSED';
    this._failures = 0;
    this._successes = 0;
    this._halfOpenAttempts = 0;
    this._lastFailure = 0;
    this._openedAt = 0;
    this._tripCount = 0;
  }

  get state() { return this._state; }

  /**
   * Execute a function through the circuit breaker.
   * @template T
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async execute(fn) {
    if (this._state === 'OPEN') {
      const elapsed = Date.now() - this._openedAt;
      const backoff = phiBackoffDelay(this._tripCount, this.resetMs);
      if (elapsed < backoff) {
        throw new Error(`CircuitBreaker [${this.name}] OPEN — retry after ${Math.round(backoff - elapsed)}ms`);
      }
      this._state = 'HALF_OPEN';
      this._halfOpenAttempts = 0;
    }

    if (this._state === 'HALF_OPEN' && this._halfOpenAttempts >= this.halfOpenMax) {
      this._trip();
      throw new Error(`CircuitBreaker [${this.name}] HALF_OPEN limit reached`);
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      throw err;
    }
  }

  _onSuccess() {
    if (this._state === 'HALF_OPEN') {
      this._successes++;
      if (this._successes >= this.halfOpenMax) {
        this._state = 'CLOSED';
        this._failures = 0;
        this._successes = 0;
        this._tripCount = Math.max(0, this._tripCount - 1);
      }
    } else {
      this._failures = Math.max(0, this._failures - 1);
    }
  }

  _onFailure() {
    this._failures++;
    this._lastFailure = Date.now();

    if (this._state === 'HALF_OPEN') {
      this._halfOpenAttempts++;
      if (this._halfOpenAttempts >= this.halfOpenMax) this._trip();
    } else if (this._failures >= this.threshold) {
      this._trip();
    }
  }

  _trip() {
    this._state = 'OPEN';
    this._openedAt = Date.now();
    this._tripCount++;
  }

  reset() {
    this._state = 'CLOSED';
    this._failures = 0;
    this._successes = 0;
    this._halfOpenAttempts = 0;
    this._tripCount = 0;
  }

  getStatus() {
    return {
      name: this.name,
      state: this._state,
      failures: this._failures,
      tripCount: this._tripCount,
      threshold: this.threshold,
    };
  }
}

// ---------------------------------------------------------------------------
// BackpressureManager
// ---------------------------------------------------------------------------

const PRESSURE_LEVELS = Object.freeze({
  NOMINAL: { name: 'nominal', threshold: 0 },
  ELEVATED: { name: 'elevated', threshold: FIB[6] },   // 13
  HIGH: { name: 'high', threshold: FIB[7] },            // 21
  CRITICAL: { name: 'critical', threshold: FIB[8] },    // 34
});

export class BackpressureManager {
  constructor(opts = {}) {
    this.maxQueueDepth = opts.maxQueueDepth || FIB[8]; // 34
    this._current = 0;
  }

  admit() {
    if (this._current >= this.maxQueueDepth) {
      return { admitted: false, level: 3, levelName: 'critical' };
    }
    this._current++;
    return { admitted: true, level: this._getLevel(), levelName: this._getLevelName() };
  }

  release() {
    this._current = Math.max(0, this._current - 1);
  }

  _getLevel() {
    if (this._current >= PRESSURE_LEVELS.CRITICAL.threshold) return 3;
    if (this._current >= PRESSURE_LEVELS.HIGH.threshold) return 2;
    if (this._current >= PRESSURE_LEVELS.ELEVATED.threshold) return 1;
    return 0;
  }

  _getLevelName() {
    return ['nominal', 'elevated', 'high', 'critical'][this._getLevel()];
  }

  getStatus() {
    return {
      current: this._current,
      max: this.maxQueueDepth,
      level: this._getLevel(),
      levelName: this._getLevelName(),
    };
  }
}

// ---------------------------------------------------------------------------
// SemanticDeduplicator
// ---------------------------------------------------------------------------

export class SemanticDeduplicator {
  constructor(opts = {}) {
    this.threshold = opts.threshold || (1 - PSI * PSI * PSI); // ~0.764
    this.maxEntries = opts.maxEntries || FIB[10]; // 89
    this._entries = [];
  }

  check(embedding) {
    for (const entry of this._entries) {
      const sim = cosineSimilarity(embedding, entry.embedding);
      if (sim >= this.threshold) {
        return { isDuplicate: true, matchId: entry.id, similarity: sim };
      }
    }
    return { isDuplicate: false, matchId: null, similarity: 0 };
  }

  register(id, embedding) {
    this._entries.push({ id, embedding, ts: Date.now() });
    if (this._entries.length > this.maxEntries) {
      this._entries.splice(0, this._entries.length - this.maxEntries);
    }
  }

  clear() { this._entries = []; }
}

// ---------------------------------------------------------------------------
// ConnectionPool
// ---------------------------------------------------------------------------

export class ConnectionPool {
  constructor(opts = {}) {
    this.minSize = opts.minSize || FIB[2];  // 2
    this.maxSize = opts.maxSize || FIB[6];  // 13
    this.factory = opts.factory || (async () => ({ id: randomUUID(), createdAt: Date.now() }));
    this.destroy = opts.destroy || (async () => {});
    this._available = [];
    this._inUse = new Set();
  }

  async acquire() {
    if (this._available.length > 0) {
      const conn = this._available.pop();
      this._inUse.add(conn);
      return conn;
    }
    if (this._inUse.size >= this.maxSize) {
      throw new Error('ConnectionPool exhausted');
    }
    const conn = await this.factory();
    this._inUse.add(conn);
    return conn;
  }

  release(conn) {
    this._inUse.delete(conn);
    if (this._available.length < this.maxSize) {
      this._available.push(conn);
    }
  }

  async drain() {
    for (const conn of this._available) await this.destroy(conn);
    for (const conn of this._inUse) await this.destroy(conn);
    this._available = [];
    this._inUse.clear();
  }

  getStatus() {
    return {
      available: this._available.length,
      inUse: this._inUse.size,
      total: this._available.length + this._inUse.size,
      maxSize: this.maxSize,
    };
  }
}

// ---------------------------------------------------------------------------
// Retry with backoff
// ---------------------------------------------------------------------------

export async function retryWithBackoff(fn, opts = {}) {
  const maxRetries = opts.maxRetries ?? FIB[4]; // 5
  const baseMs = opts.baseMs ?? RETRY_BASE_DELAY_MS;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = phiBackoffDelay(attempt, baseMs);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}
