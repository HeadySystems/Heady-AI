/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  HEADY™ BACKPRESSURE — Semantic Dedup & Adaptive Throttling      ║
 * ║  Google SRE adaptive throttling with CSL-gated load shedding     ║
 * ║  © 2024-2026 HeadySystems Inc. All Rights Reserved.              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

'use strict';

import { PHI, PSI, fib, CSL_THRESHOLDS } from '../../shared/phi-math.js';
import { cslAND } from '../../shared/csl-engine.js';

/** Pressure levels (phi-derived) */
const PRESSURE = Object.freeze({
  NOMINAL:  { min: 0,     max: PSI * PSI,     label: 'NOMINAL' },  // 0 – 0.382
  ELEVATED: { min: PSI * PSI, max: PSI,       label: 'ELEVATED' }, // 0.382 – 0.618
  HIGH:     { min: PSI,   max: 1 - PSI * PSI * PSI, label: 'HIGH' },      // 0.618 – 0.854
  CRITICAL: { min: 1 - Math.pow(PSI, 4), max: 1.0, label: 'CRITICAL' },   // 0.910+
});

/** Sliding window size — fib(9) = 34 buckets */
const WINDOW_BUCKETS = fib(9);

/** Dedup similarity threshold — above CRITICAL */
const DEDUP_THRESHOLD = 0.972;

/**
 * BackpressureManager — adaptive throttling with semantic deduplication.
 * Uses Google SRE algorithm: reject ratio = max(0, (requests - K * accepts) / (requests + 1))
 * K = φ (golden ratio) instead of the standard 2.
 */
export class BackpressureManager {
  /**
   * @param {Object} options
   * @param {number} [options.windowMs] - Sliding window duration (default: fib(9) × 1000 = 34s)
   * @param {Object} [options.telemetry]
   */
  constructor({ windowMs = fib(9) * 1000, telemetry = null } = {}) {
    /** @private */ this._windowMs = windowMs;
    /** @private */ this._telemetry = telemetry;
    /** @private */ this._requests = 0;
    /** @private */ this._accepts = 0;
    /** @private */ this._windowStart = Date.now();
    /** @private */ this._recentEmbeddings = []; // For semantic dedup
    /** @private */ this._maxEmbeddings = fib(10); // 55
    /** @private */ this._shedCount = 0;
    /** @private */ this._dedupCount = 0;
  }

  /**
   * Check if a request should be admitted.
   * @param {Object} [request]
   * @param {Float64Array} [request.embedding] - For semantic dedup
   * @param {number} [request.priority] - 0-1, higher = more important
   * @returns {Object} { admitted: boolean, reason: string, pressure: string }
   */
  shouldAdmit(request = {}) {
    this._maybeResetWindow();

    // Step 1: Semantic deduplication
    if (request.embedding && this._isDuplicate(request.embedding)) {
      this._dedupCount++;
      return { admitted: false, reason: 'semantic_duplicate', pressure: this.pressureLevel.label };
    }

    // Step 2: Adaptive throttling (Google SRE with φ multiplier)
    const rejectRatio = Math.max(0,
      (this._requests - PHI * this._accepts) / (this._requests + 1)
    );

    this._requests++;
    const pressure = this.pressureLevel;

    // Step 3: Priority-based load shedding
    const priority = request.priority ?? PSI; // Default: medium priority
    const adjustedRejectRatio = rejectRatio * (1 - priority * PSI);

    if (Math.random() < adjustedRejectRatio) {
      this._shedCount++;
      return { admitted: false, reason: 'throttled', pressure: pressure.label, rejectRatio };
    }

    this._accepts++;

    // Track embedding for dedup
    if (request.embedding) {
      this._recentEmbeddings.push(request.embedding);
      if (this._recentEmbeddings.length > this._maxEmbeddings) {
        this._recentEmbeddings.shift();
      }
    }

    return { admitted: true, reason: 'accepted', pressure: pressure.label };
  }

  /**
   * Get current pressure level.
   * @returns {Object} Current pressure level definition
   */
  get pressureLevel() {
    const ratio = this._requests === 0 ? 0 : 1 - (this._accepts / this._requests);
    for (const level of [PRESSURE.CRITICAL, PRESSURE.HIGH, PRESSURE.ELEVATED, PRESSURE.NOMINAL]) {
      if (ratio >= level.min) return level;
    }
    return PRESSURE.NOMINAL;
  }

  /**
   * Get backpressure statistics.
   * @returns {Object}
   */
  getStats() {
    return {
      pressure: this.pressureLevel.label,
      requests: this._requests,
      accepts: this._accepts,
      acceptRate: this._requests === 0 ? 1 : this._accepts / this._requests,
      shedCount: this._shedCount,
      dedupCount: this._dedupCount,
      embeddingsTracked: this._recentEmbeddings.length,
    };
  }

  /**
   * Signal upstream backpressure.
   * @returns {Object} Backpressure signal for upstream callers
   */
  getBackpressureSignal() {
    const pressure = this.pressureLevel;
    return {
      level: pressure.label,
      retryAfterMs: pressure === PRESSURE.CRITICAL ? fib(8) * 1000 : // 21s
                    pressure === PRESSURE.HIGH ? fib(7) * 1000 :     // 13s
                    pressure === PRESSURE.ELEVATED ? fib(6) * 1000 : // 8s
                    0,
      acceptRate: this._requests === 0 ? 1 : this._accepts / this._requests,
    };
  }

  // ─── PRIVATE ───────────────────────────────────────────────────────────────

  /** @private */
  _isDuplicate(embedding) {
    for (const recent of this._recentEmbeddings) {
      const similarity = cslAND(embedding, recent);
      if (similarity >= DEDUP_THRESHOLD) return true;
    }
    return false;
  }

  /** @private */
  _maybeResetWindow() {
    if (Date.now() - this._windowStart >= this._windowMs) {
      this._requests = 0;
      this._accepts = 0;
      this._windowStart = Date.now();
    }
  }
}

export { PRESSURE, DEDUP_THRESHOLD };
export default BackpressureManager;
