/**
 * @fileoverview circuit-breaker.js — Production-Grade Circuit Breaker Service
 *
 * Implements the three-state circuit breaker pattern (CLOSED → OPEN → HALF_OPEN)
 * with phi-scaled thresholds, sliding Fibonacci-bucketed windows, and full
 * OpenTelemetry telemetry hooks. Backbone of cascade failure prevention for
 * 20+ Heady services.
 *
 * State Transitions:
 *   CLOSED    → OPEN      when failure count ≥ fib(5) within fib(8)-second window
 *   OPEN      → HALF_OPEN after phi-backoff timeout (φ³×1000ms, grows by φ per reset)
 *   HALF_OPEN → CLOSED    on fib(3) consecutive probe successes
 *   HALF_OPEN → OPEN      on first probe failure
 *
 * @module resilience/circuit-breaker
 * @author Heady Ecosystem
 * @version 1.0.0
 * @license MIT
 *
 * @example
 * const { CircuitBreakerRegistry } = require('./circuit-breaker');
 * const registry = new CircuitBreakerRegistry();
 * const result = await registry.execute('vector-store', () => fetchFromVectorDB());
 */

'use strict';

const EventEmitter = require('events');

const {
  PHI,
  PSI,
  PSI2,
  PSI3,
  PSI4,
  fib,
  phiThreshold,
  phiBackoff,
  phiBackoffWithJitter,
  CSL_THRESHOLDS,
  ALERT_THRESHOLDS,
  POOL_RATIOS,
  getPressureLevel,
  phiFusionWeights,
} = require('../../shared/phi-math.js');

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: CONSTANTS — ALL DERIVED FROM φ, ψ, OR FIBONACCI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Circuit states enumeration.
 * @readonly
 * @enum {string}
 */
const STATE = Object.freeze({
  /** Circuit is healthy; all calls pass through. */
  CLOSED:    'CLOSED',
  /** Circuit is tripped; calls fail fast with fallback. */
  OPEN:      'OPEN',
  /** Circuit is probing recovery; limited calls pass through. */
  HALF_OPEN: 'HALF_OPEN',
});

/**
 * Failure threshold: trip to OPEN when failures ≥ fib(5) = 5 within the window.
 * @constant {number}
 */
const FAILURE_THRESHOLD = fib(5); // 5

/**
 * Sliding window duration in milliseconds: fib(8) = 21 seconds.
 * @constant {number}
 */
const WINDOW_DURATION_MS = fib(8) * 1000; // 21 000 ms

/**
 * Number of Fibonacci-sized buckets in the sliding window: fib(9) = 34.
 * @constant {number}
 */
const BUCKET_COUNT = fib(9); // 34

/**
 * Duration of each bucket in milliseconds (window / buckets).
 * @constant {number}
 */
const BUCKET_DURATION_MS = WINDOW_DURATION_MS / BUCKET_COUNT;

/**
 * Consecutive successes needed in HALF_OPEN to close: fib(3) = 2.
 * @constant {number}
 */
const PROBE_SUCCESS_THRESHOLD = fib(3); // 2

/**
 * Maximum concurrent probes allowed in HALF_OPEN: fib(2) = 1.
 * @constant {number}
 */
const MAX_CONCURRENT_PROBES = fib(2); // 1

/**
 * Base timeout before first OPEN → HALF_OPEN transition: φ³ × 1000 ms ≈ 4236 ms.
 * @constant {number}
 */
const BASE_OPEN_TIMEOUT_MS = (2 * PHI + 1) * 1000; // φ³ × 1000 ≈ 4236 ms

/**
 * Maximum open timeout cap: phiBackoff(8) ≈ 76 844 ms, capped at fib(11) × 1000 = 89 000 ms.
 * @constant {number}
 */
const MAX_OPEN_TIMEOUT_MS = fib(11) * 1000; // 89 000 ms

/**
 * Failure rate threshold above which pressure is considered HIGH: CSL_THRESHOLDS.LOW ≈ 0.691.
 * @constant {number}
 */
const FAILURE_RATE_HIGH_THRESHOLD = CSL_THRESHOLDS.LOW; // ≈ 0.691

/**
 * Failure rate threshold above which pressure is CRITICAL: CSL_THRESHOLDS.MEDIUM ≈ 0.809.
 * @constant {number}
 */
const FAILURE_RATE_CRITICAL_THRESHOLD = CSL_THRESHOLDS.MEDIUM; // ≈ 0.809

/**
 * Minimum success rate to consider circuit healthy: PSI ≈ 0.618.
 * @constant {number}
 */
const HEALTHY_SUCCESS_RATE = PSI; // ≈ 0.618

/**
 * Number of pre-registered Heady services in the default registry: fib(7) + fib(5) = 13 + 5 = 18.
 * @constant {number}
 */
const DEFAULT_SERVICE_COUNT = fib(7) + fib(5); // 18 (≥16)

/**
 * Maximum number of retained state-change events per circuit: fib(8) = 21.
 * @constant {number}
 */
const MAX_STATE_HISTORY = fib(8); // 21

/**
 * Telemetry flush interval in milliseconds: fib(8) × 1000 = 21 000 ms.
 * @constant {number}
 */
const TELEMETRY_FLUSH_INTERVAL_MS = fib(8) * 1000; // 21 000 ms

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: SLIDING WINDOW (FIBONACCI-BUCKETED)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A circular sliding window partitioned into BUCKET_COUNT Fibonacci-sized
 * time buckets. Each bucket accumulates success, failure, and timeout counts
 * for its time slice. Old buckets are evicted as time advances.
 */
class SlidingWindow {
  /**
   * Creates a new SlidingWindow with BUCKET_COUNT circular buckets.
   */
  constructor() {
    /** @type {Array<{ts: number, success: number, failure: number, timeout: number}>} */
    this._buckets = Array.from({ length: BUCKET_COUNT }, () => ({
      ts: 0, success: 0, failure: 0, timeout: 0,
    }));
    /** @type {number} Index of the current (newest) bucket. */
    this._head = 0;
    /** @type {number} Timestamp of the last recorded event (ms). */
    this._lastTick = 0;
  }

  /**
   * Advances the window to the current time, clearing any stale buckets
   * that are older than one window duration.
   *
   * @param {number} now - Current timestamp in milliseconds
   * @returns {void}
   */
  _advance(now) {
    if (this._lastTick === 0) {
      this._lastTick = now;
      this._buckets[this._head].ts = now;
      return;
    }

    const elapsed = now - this._lastTick;
    if (elapsed < BUCKET_DURATION_MS) return;

    const bucketsToAdvance = Math.min(
      Math.floor(elapsed / BUCKET_DURATION_MS),
      BUCKET_COUNT,
    );

    for (let i = 0; i < bucketsToAdvance; i++) {
      this._head = (this._head + 1) % BUCKET_COUNT;
      this._buckets[this._head] = { ts: now, success: 0, failure: 0, timeout: 0 };
    }
    this._lastTick = now;
  }

  /**
   * Records a successful call in the current time bucket.
   *
   * @param {number} [now=Date.now()] - Current timestamp override for testing
   * @returns {void}
   */
  recordSuccess(now = Date.now()) {
    this._advance(now);
    this._buckets[this._head].success++;
  }

  /**
   * Records a failed call in the current time bucket.
   *
   * @param {number} [now=Date.now()] - Current timestamp override for testing
   * @returns {void}
   */
  recordFailure(now = Date.now()) {
    this._advance(now);
    this._buckets[this._head].failure++;
  }

  /**
   * Records a timed-out call in the current time bucket.
   *
   * @param {number} [now=Date.now()] - Current timestamp override for testing
   * @returns {void}
   */
  recordTimeout(now = Date.now()) {
    this._advance(now);
    this._buckets[this._head].timeout++;
  }

  /**
   * Returns aggregate counts across all live buckets (within the window).
   * Buckets older than WINDOW_DURATION_MS are excluded.
   *
   * @param {number} [now=Date.now()] - Current timestamp for staleness check
   * @returns {{ success: number, failure: number, timeout: number, total: number }}
   */
  getCounts(now = Date.now()) {
    this._advance(now);
    let success = 0, failure = 0, timeout = 0;
    const cutoff = now - WINDOW_DURATION_MS;

    for (const bucket of this._buckets) {
      if (bucket.ts >= cutoff) {
        success += bucket.success;
        failure += bucket.failure;
        timeout += bucket.timeout;
      }
    }

    return { success, failure, timeout, total: success + failure + timeout };
  }

  /**
   * Resets all bucket counts to zero.
   *
   * @returns {void}
   */
  reset() {
    for (const bucket of this._buckets) {
      bucket.ts = 0;
      bucket.success = 0;
      bucket.failure = 0;
      bucket.timeout = 0;
    }
    this._head = 0;
    this._lastTick = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: CIRCUIT BREAKER (SINGLE CIRCUIT)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} CircuitConfig
 * @property {string}   name                 - Unique circuit name
 * @property {number}   [failureThreshold]   - Failures before opening (default: FAILURE_THRESHOLD)
 * @property {number}   [windowDurationMs]   - Sliding window ms (default: WINDOW_DURATION_MS)
 * @property {number}   [baseOpenTimeoutMs]  - Initial open timeout ms (default: BASE_OPEN_TIMEOUT_MS)
 * @property {number}   [maxOpenTimeoutMs]   - Maximum open timeout ms (default: MAX_OPEN_TIMEOUT_MS)
 * @property {number}   [probeSuccessCount]  - Probes to close (default: PROBE_SUCCESS_THRESHOLD)
 * @property {Function} [fallback]           - Fallback factory: (err) => value
 * @property {Object}   [telemetry]          - OpenTelemetry tracer/meter refs
 */

/**
 * @typedef {Object} CircuitHealth
 * @property {string}   name             - Circuit name
 * @property {string}   state            - Current STATE value
 * @property {number}   successCount     - Successes in current window
 * @property {number}   failureCount     - Failures in current window
 * @property {number}   timeoutCount     - Timeouts in current window
 * @property {number}   totalCount       - Total calls in current window
 * @property {number}   successRate      - Success ratio [0, 1]
 * @property {number}   failureRate      - Failure ratio [0, 1]
 * @property {string}   currentPressure  - NOMINAL | ELEVATED | HIGH | CRITICAL
 * @property {number}   lastStateChange  - Unix ms of last state change
 * @property {number}   openTimeoutMs    - Current open-phase cooldown ms
 * @property {number}   resetCount       - Number of times circuit has opened
 * @property {Array}    stateHistory     - Recent state-change log
 */

/**
 * A single circuit breaker protecting one downstream dependency.
 * Emits events via the provided EventEmitter: stateChanged, circuitOpened,
 * circuitClosed, circuitHalfOpen.
 */
class CircuitBreaker {
  /**
   * Creates a CircuitBreaker for the named service.
   *
   * @param {CircuitConfig} config        - Per-circuit configuration
   * @param {EventEmitter}  emitter       - Shared event bus for state change events
   */
  constructor(config, emitter) {
    if (!config || typeof config.name !== 'string' || config.name.trim() === '') {
      throw new TypeError('CircuitBreaker: config.name must be a non-empty string');
    }
    if (!(emitter instanceof EventEmitter)) {
      throw new TypeError('CircuitBreaker: emitter must be an EventEmitter instance');
    }

    /** @type {string} */
    this.name = config.name.trim();

    /** @type {number} */
    this._failureThreshold = config.failureThreshold ?? FAILURE_THRESHOLD;

    /** @type {number} */
    this._baseOpenTimeoutMs = config.baseOpenTimeoutMs ?? BASE_OPEN_TIMEOUT_MS;

    /** @type {number} */
    this._maxOpenTimeoutMs = config.maxOpenTimeoutMs ?? MAX_OPEN_TIMEOUT_MS;

    /** @type {number} */
    this._probeSuccessCount = config.probeSuccessCount ?? PROBE_SUCCESS_THRESHOLD;

    /** @type {Function|null} */
    this._fallback = typeof config.fallback === 'function' ? config.fallback : null;

    /** @type {Object|null} */
    this._telemetry = config.telemetry ?? null;

    /** @type {EventEmitter} */
    this._emitter = emitter;

    /** @type {string} Current state (CLOSED | OPEN | HALF_OPEN) */
    this._state = STATE.CLOSED;

    /** @type {SlidingWindow} */
    this._window = new SlidingWindow();

    /** @type {number} Timestamp when circuit was opened (ms) */
    this._openedAt = 0;

    /** @type {number} Computed cooldown for current open phase (ms) */
    this._openTimeoutMs = this._baseOpenTimeoutMs;

    /** @type {number} How many times this circuit has tripped */
    this._resetCount = 0;

    /** @type {number} Consecutive probe successes in HALF_OPEN */
    this._consecutiveProbeSuccesses = 0;

    /** @type {number} Active concurrent probes in HALF_OPEN */
    this._activeProbes = 0;

    /** @type {number} Timestamp of most recent state change (ms) */
    this._lastStateChange = Date.now();

    /**
     * Mutex flag: prevents concurrent state transitions.
     * @type {boolean}
     */
    this._transitioning = false;

    /**
     * Ring buffer of state change events for diagnostics.
     * @type {Array<{from: string, to: string, ts: number, reason: string}>}
     */
    this._stateHistory = [];
  }

  // ── Getters ─────────────────────────────────────────────────────────────────

  /**
   * The current circuit state.
   * @returns {string} One of STATE.CLOSED, STATE.OPEN, STATE.HALF_OPEN
   */
  get state() {
    return this._state;
  }

  /**
   * Whether the circuit is currently closed (healthy).
   * @returns {boolean}
   */
  get isClosed() {
    return this._state === STATE.CLOSED;
  }

  /**
   * Whether the circuit is currently open (tripped).
   * @returns {boolean}
   */
  get isOpen() {
    return this._state === STATE.OPEN;
  }

  /**
   * Whether the circuit is probing for recovery.
   * @returns {boolean}
   */
  get isHalfOpen() {
    return this._state === STATE.HALF_OPEN;
  }

  // ── State Machine ────────────────────────────────────────────────────────────

  /**
   * Attempts to transition the circuit from OPEN to HALF_OPEN if the
   * cooldown period has elapsed. Thread-safe via transitioning mutex.
   *
   * @param {number} now - Current timestamp in milliseconds
   * @returns {boolean} True if the transition occurred
   */
  _tryTransitionToHalfOpen(now) {
    if (this._state !== STATE.OPEN) return false;
    if (this._transitioning) return false;
    if (now - this._openedAt < this._openTimeoutMs) return false;

    this._transitioning = true;
    try {
      // Re-check inside lock
      if (this._state !== STATE.OPEN) return false;
      this._transition(STATE.HALF_OPEN, 'open-timeout-elapsed', now);
      this._consecutiveProbeSuccesses = 0;
      this._activeProbes = 0;
      return true;
    } finally {
      this._transitioning = false;
    }
  }

  /**
   * Trips the circuit to OPEN. Computes next phi-backoff cooldown.
   * Thread-safe via transitioning mutex.
   *
   * @param {string} reason - Human-readable reason for the trip
   * @param {number} now    - Current timestamp in milliseconds
   * @returns {void}
   */
  _tripToOpen(reason, now) {
    if (this._transitioning) return;
    this._transitioning = true;
    try {
      const from = this._state;
      this._state = STATE.OPEN;
      this._openedAt = now;
      this._resetCount++;

      // Phi-backoff: each successive trip grows the cooldown by φ
      // attempt = resetCount gives φ^resetCount × baseMs, capped at max
      this._openTimeoutMs = Math.min(
        phiBackoff(this._resetCount, this._baseOpenTimeoutMs, this._maxOpenTimeoutMs),
        this._maxOpenTimeoutMs,
      );

      this._lastStateChange = now;
      this._pushHistory(from, STATE.OPEN, reason, now);
      this._emitter.emit('circuitOpened', { name: this.name, reason, resetCount: this._resetCount });
      this._emitter.emit('stateChanged', { name: this.name, from, to: STATE.OPEN, reason });
      this._recordTelemetryStateChange(from, STATE.OPEN, reason);
    } finally {
      this._transitioning = false;
    }
  }

  /**
   * Closes the circuit after sufficient probe successes in HALF_OPEN.
   * Thread-safe via transitioning mutex.
   *
   * @param {number} now - Current timestamp in milliseconds
   * @returns {void}
   */
  _closedFromHalfOpen(now) {
    if (this._transitioning) return;
    this._transitioning = true;
    try {
      this._transition(STATE.CLOSED, 'probe-successes-met', now);
      this._window.reset();
      this._openTimeoutMs = this._baseOpenTimeoutMs; // reset backoff
      this._consecutiveProbeSuccesses = 0;
      this._activeProbes = 0;
    } finally {
      this._transitioning = false;
    }
  }

  /**
   * Generic internal state transition helper.
   * Does NOT acquire the mutex — callers must hold it.
   *
   * @param {string} to     - Target state
   * @param {string} reason - Reason string
   * @param {number} now    - Current timestamp in milliseconds
   * @returns {void}
   * @private
   */
  _transition(to, reason, now) {
    const from = this._state;
    this._state = to;
    this._lastStateChange = now;
    this._pushHistory(from, to, reason, now);

    if (to === STATE.HALF_OPEN) {
      this._emitter.emit('circuitHalfOpen', { name: this.name, reason });
    } else if (to === STATE.CLOSED) {
      this._emitter.emit('circuitClosed', { name: this.name, reason });
    }
    this._emitter.emit('stateChanged', { name: this.name, from, to, reason });
    this._recordTelemetryStateChange(from, to, reason);
  }

  /**
   * Appends a state-change entry to the ring buffer, evicting the oldest
   * entry when MAX_STATE_HISTORY is exceeded.
   *
   * @param {string} from   - Previous state
   * @param {string} to     - New state
   * @param {string} reason - Reason for the transition
   * @param {number} ts     - Timestamp in milliseconds
   * @returns {void}
   * @private
   */
  _pushHistory(from, to, reason, ts) {
    this._stateHistory.push({ from, to, ts, reason });
    if (this._stateHistory.length > MAX_STATE_HISTORY) {
      this._stateHistory.shift();
    }
  }

  // ── Execution ────────────────────────────────────────────────────────────────

  /**
   * Executes a protected async operation through the circuit breaker.
   *
   * Behaviour by state:
   *   CLOSED    — runs the operation; records outcome in sliding window.
   *   OPEN      — fails fast; returns fallback if available, else throws.
   *   HALF_OPEN — allows up to MAX_CONCURRENT_PROBES probes; all other
   *               callers fail fast until circuit is resolved.
   *
   * @param {Function} operation - Async function to protect: () => Promise<any>
   * @param {*}        [fallbackValue] - Inline fallback override (takes priority over config)
   * @returns {Promise<*>} The operation's result, or fallback value
   * @throws {Error} If circuit is OPEN and no fallback is available
   */
  async execute(operation, fallbackValue) {
    if (typeof operation !== 'function') {
      throw new TypeError(`CircuitBreaker[${this.name}].execute: operation must be a function`);
    }

    const now = Date.now();

    // ── OPEN: check if we can transition to HALF_OPEN ─────────────────────
    if (this._state === STATE.OPEN) {
      const transitioned = this._tryTransitionToHalfOpen(now);
      if (!transitioned) {
        return this._handleOpenState(new Error(`Circuit ${this.name} is OPEN`), fallbackValue);
      }
    }

    // ── HALF_OPEN: probe limiting ─────────────────────────────────────────
    if (this._state === STATE.HALF_OPEN) {
      if (this._activeProbes >= MAX_CONCURRENT_PROBES) {
        return this._handleOpenState(
          new Error(`Circuit ${this.name} is HALF_OPEN — probe slot unavailable`),
          fallbackValue,
        );
      }
      this._activeProbes++;
    }

    // ── Execute the protected operation ──────────────────────────────────
    const startMs = Date.now();
    try {
      const result = await operation();
      const durationMs = Date.now() - startMs;
      this._onSuccess(durationMs);
      return result;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      const isTimeout = err && err.name === 'TimeoutError';
      this._onFailure(err, durationMs, isTimeout);
      return this._handleOpenState(err, fallbackValue);
    }
  }

  /**
   * Handles a call that failed or was blocked by an open/half-open circuit.
   * Returns fallback value (inline override → config fallback → throws).
   *
   * @param {Error} err            - The originating error
   * @param {*}     [fallbackValue] - Inline fallback override
   * @returns {*} Fallback value
   * @throws {Error} When no fallback is available
   * @private
   */
  _handleOpenState(err, fallbackValue) {
    if (fallbackValue !== undefined) return fallbackValue;
    if (this._fallback !== null) {
      return this._fallback(err);
    }
    throw err;
  }

  /**
   * Called on a successful operation outcome.
   * Updates window, handles HALF_OPEN probe counting.
   *
   * @param {number} durationMs - Call duration in milliseconds
   * @returns {void}
   * @private
   */
  _onSuccess(durationMs) {
    const now = Date.now();
    this._window.recordSuccess(now);
    this._recordTelemetryCall('success', durationMs);

    if (this._state === STATE.HALF_OPEN) {
      this._activeProbes = Math.max(0, this._activeProbes - 1);
      this._consecutiveProbeSuccesses++;
      if (this._consecutiveProbeSuccesses >= this._probeSuccessCount) {
        this._closedFromHalfOpen(now);
      }
    }
  }

  /**
   * Called on a failed or timed-out operation outcome.
   * Updates window, potentially trips the circuit.
   *
   * @param {Error}   err         - The error thrown by the operation
   * @param {number}  durationMs  - Call duration in milliseconds
   * @param {boolean} isTimeout   - Whether the failure was a timeout
   * @returns {void}
   * @private
   */
  _onFailure(err, durationMs, isTimeout) {
    const now = Date.now();

    if (isTimeout) {
      this._window.recordTimeout(now);
      this._recordTelemetryCall('timeout', durationMs);
    } else {
      this._window.recordFailure(now);
      this._recordTelemetryCall('failure', durationMs);
    }

    if (this._state === STATE.HALF_OPEN) {
      // First probe failure → re-open immediately
      this._activeProbes = Math.max(0, this._activeProbes - 1);
      this._tripToOpen(`half-open-probe-failure: ${err.message}`, now);
      return;
    }

    if (this._state === STATE.CLOSED) {
      const { failure, timeout } = this._window.getCounts(now);
      if (failure + timeout >= this._failureThreshold) {
        this._tripToOpen(`failure-threshold-exceeded: ${failure + timeout} >= ${this._failureThreshold}`, now);
      }
    }
  }

  // ── Health & Metrics ─────────────────────────────────────────────────────────

  /**
   * Returns a comprehensive health snapshot for this circuit.
   *
   * @returns {CircuitHealth} Current health metrics
   */
  getHealth() {
    const now = Date.now();
    const counts = this._window.getCounts(now);
    const successRate = counts.total > 0 ? counts.success / counts.total : 1;
    const failureRate = counts.total > 0 ? (counts.failure + counts.timeout) / counts.total : 0;

    return {
      name:            this.name,
      state:           this._state,
      successCount:    counts.success,
      failureCount:    counts.failure,
      timeoutCount:    counts.timeout,
      totalCount:      counts.total,
      successRate:     parseFloat(successRate.toFixed(6)),
      failureRate:     parseFloat(failureRate.toFixed(6)),
      currentPressure: getPressureLevel(failureRate),
      lastStateChange: this._lastStateChange,
      openTimeoutMs:   this._openTimeoutMs,
      resetCount:      this._resetCount,
      stateHistory:    [...this._stateHistory],
    };
  }

  /**
   * Forces the circuit into CLOSED state and resets all counters.
   * Should only be used by operators via admin tooling.
   *
   * @param {string} [reason='manual-reset'] - Reason for the forced reset
   * @returns {void}
   */
  forceClose(reason = 'manual-reset') {
    const now = Date.now();
    const from = this._state;
    this._state = STATE.CLOSED;
    this._openedAt = 0;
    this._openTimeoutMs = this._baseOpenTimeoutMs;
    this._consecutiveProbeSuccesses = 0;
    this._activeProbes = 0;
    this._window.reset();
    this._lastStateChange = now;
    this._pushHistory(from, STATE.CLOSED, reason, now);
    this._emitter.emit('circuitClosed', { name: this.name, reason });
    this._emitter.emit('stateChanged', { name: this.name, from, to: STATE.CLOSED, reason });
    this._recordTelemetryStateChange(from, STATE.CLOSED, reason);
  }

  /**
   * Forces the circuit into OPEN state.
   * Should only be used by operators via admin tooling or integration tests.
   *
   * @param {string} [reason='manual-open'] - Reason for the forced open
   * @returns {void}
   */
  forceOpen(reason = 'manual-open') {
    this._tripToOpen(reason, Date.now());
  }

  // ── Telemetry Hooks (OpenTelemetry) ─────────────────────────────────────────

  /**
   * Records a call outcome to any attached OpenTelemetry meter.
   * No-op if no telemetry is configured.
   *
   * @param {'success'|'failure'|'timeout'} outcome - Call result type
   * @param {number} durationMs                      - Call duration in ms
   * @returns {void}
   * @private
   */
  _recordTelemetryCall(outcome, durationMs) {
    if (!this._telemetry) return;
    try {
      const meter = this._telemetry.meter;
      if (meter && typeof meter.createCounter === 'function') {
        meter
          .createCounter('circuit_breaker.calls', {
            description: 'Number of calls through the circuit breaker',
          })
          .add(1, { circuit: this.name, outcome, state: this._state });
      }
      if (meter && typeof meter.createHistogram === 'function') {
        meter
          .createHistogram('circuit_breaker.call_duration_ms', {
            description: 'Call duration through the circuit breaker',
          })
          .record(durationMs, { circuit: this.name, outcome });
      }
    } catch (_telemetryErr) {
      // Telemetry failures must never propagate to callers
    }
  }

  /**
   * Records a state change event to any attached OpenTelemetry tracer/meter.
   * No-op if no telemetry is configured.
   *
   * @param {string} from   - Previous state
   * @param {string} to     - New state
   * @param {string} reason - Reason for transition
   * @returns {void}
   * @private
   */
  _recordTelemetryStateChange(from, to, reason) {
    if (!this._telemetry) return;
    try {
      const meter = this._telemetry.meter;
      if (meter && typeof meter.createCounter === 'function') {
        meter
          .createCounter('circuit_breaker.state_changes', {
            description: 'Number of circuit breaker state transitions',
          })
          .add(1, { circuit: this.name, from, to, reason });
      }
      const tracer = this._telemetry.tracer;
      if (tracer && typeof tracer.startSpan === 'function') {
        const span = tracer.startSpan('circuit_breaker.state_change', {
          attributes: { 'circuit.name': this.name, 'circuit.from': from, 'circuit.to': to, 'circuit.reason': reason },
        });
        span.end();
      }
    } catch (_telemetryErr) {
      // Telemetry failures must never propagate to callers
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: CIRCUIT BREAKER REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} RegistryOptions
 * @property {Object}   [telemetry]      - OpenTelemetry { tracer, meter } refs
 * @property {boolean}  [autoFlush]      - Enable periodic telemetry flush (default: true)
 * @property {number}   [flushIntervalMs] - Telemetry flush interval ms (default: TELEMETRY_FLUSH_INTERVAL_MS)
 * @property {Object}   [defaults]       - Default CircuitConfig overrides for all circuits
 */

/**
 * Central registry managing all circuit breakers in the Heady ecosystem.
 * Pre-registers DEFAULT_SERVICE_COUNT (18) Heady services on construction.
 *
 * @extends EventEmitter
 *
 * @example
 * const registry = new CircuitBreakerRegistry({ telemetry: { tracer, meter } });
 * const result = await registry.execute('vector-store', () => db.query(sql));
 */
class CircuitBreakerRegistry extends EventEmitter {
  /**
   * Creates a CircuitBreakerRegistry and pre-registers all Heady services.
   *
   * @param {RegistryOptions} [options={}] - Registry-wide options
   */
  constructor(options = {}) {
    super();

    /** @type {Map<string, CircuitBreaker>} */
    this._circuits = new Map();

    /** @type {Object|null} */
    this._telemetry = options.telemetry ?? null;

    /** @type {Object} Default overrides applied to every registered circuit */
    this._defaults = options.defaults ?? {};

    /** @type {NodeJS.Timeout|null} */
    this._flushTimer = null;

    const autoFlush = options.autoFlush !== false;
    if (autoFlush) {
      const interval = options.flushIntervalMs ?? TELEMETRY_FLUSH_INTERVAL_MS;
      this._startFlushTimer(interval);
    }

    // Pre-register all Heady services
    this._registerDefaultServices();
  }

  // ── Service Registration ─────────────────────────────────────────────────────

  /**
   * Pre-registers the canonical set of Heady platform services.
   * Covers all service categories across the phi-scaled architecture.
   *
   * @returns {void}
   * @private
   */
  _registerDefaultServices() {
    /** @type {Array<CircuitConfig>} */
    const services = [
      // Persistence & data layer
      { name: 'vector-store' },
      { name: 'postgres-primary' },
      { name: 'postgres-replica' },
      { name: 'redis-cache' },
      { name: 'redis-session' },

      // AI / inference
      { name: 'openai-embeddings' },
      { name: 'openai-chat' },
      { name: 'anthropic-claude' },

      // Heady cognitive stack
      { name: 'memory-engine' },
      { name: 'csl-engine' },
      { name: 'sacred-geometry' },
      { name: 'phi-router' },

      // Infrastructure
      { name: 'event-bus' },
      { name: 'object-storage' },
      { name: 'email-service' },
      { name: 'sms-service' },
      { name: 'cdn-edge' },
      { name: 'auth-service' },
    ];

    // Verify we have at least DEFAULT_SERVICE_COUNT entries
    if (services.length < DEFAULT_SERVICE_COUNT) {
      throw new Error(
        `CircuitBreakerRegistry: expected ≥ ${DEFAULT_SERVICE_COUNT} default services, got ${services.length}`,
      );
    }

    for (const cfg of services) {
      this.register({ ...this._defaults, ...cfg });
    }
  }

  /**
   * Registers a new circuit breaker or replaces an existing one by name.
   *
   * @param {CircuitConfig} config - Circuit configuration
   * @returns {CircuitBreaker} The newly registered circuit instance
   * @throws {TypeError} If config.name is missing or not a string
   */
  register(config) {
    const circuit = new CircuitBreaker(
      { telemetry: this._telemetry, ...config },
      this,
    );
    this._circuits.set(circuit.name, circuit);
    return circuit;
  }

  /**
   * Retrieves a registered circuit by name.
   *
   * @param {string} name - The circuit's registered name
   * @returns {CircuitBreaker} The circuit instance
   * @throws {RangeError} If no circuit is registered under that name
   */
  get(name) {
    const circuit = this._circuits.get(name);
    if (!circuit) {
      throw new RangeError(
        `CircuitBreakerRegistry: no circuit registered for "${name}". ` +
        `Registered: [${Array.from(this._circuits.keys()).join(', ')}]`,
      );
    }
    return circuit;
  }

  /**
   * Returns true if a circuit with the given name is registered.
   *
   * @param {string} name - Circuit name to check
   * @returns {boolean}
   */
  has(name) {
    return this._circuits.has(name);
  }

  // ── Execution API ────────────────────────────────────────────────────────────

  /**
   * Executes a protected async operation through the named circuit breaker.
   * If the circuit name is not yet registered, it is auto-registered with
   * default configuration before execution.
   *
   * @param {string}   name           - Registered circuit name
   * @param {Function} operation      - Async operation to protect: () => Promise<any>
   * @param {*}        [fallback]     - Inline fallback override on open/failure
   * @returns {Promise<*>} Operation result or fallback value
   * @throws {Error} If circuit is OPEN and no fallback is available
   */
  async execute(name, operation, fallback) {
    if (!this._circuits.has(name)) {
      this.register({ ...this._defaults, name });
    }
    const circuit = this._circuits.get(name);
    return circuit.execute(operation, fallback);
  }

  // ── Health & Observability ───────────────────────────────────────────────────

  /**
   * Returns a health snapshot for a single named circuit.
   *
   * @param {string} name - Circuit name
   * @returns {CircuitHealth} Health metrics for the circuit
   * @throws {RangeError} If the circuit is not registered
   */
  getCircuitHealth(name) {
    return this.get(name).getHealth();
  }

  /**
   * Returns health snapshots for all registered circuits.
   *
   * @returns {CircuitHealth[]} Array of health metrics, sorted by name
   */
  getAllHealth() {
    return Array.from(this._circuits.values())
      .map(c => c.getHealth())
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Returns summary counts of circuit states across the registry.
   *
   * @returns {{ total: number, closed: number, open: number, halfOpen: number, criticalCount: number }}
   */
  getSummary() {
    let closed = 0, open = 0, halfOpen = 0, criticalCount = 0;

    for (const circuit of this._circuits.values()) {
      if (circuit.state === STATE.CLOSED)    closed++;
      else if (circuit.state === STATE.OPEN) open++;
      else                                   halfOpen++;

      const health = circuit.getHealth();
      if (health.currentPressure === 'CRITICAL') criticalCount++;
    }

    return {
      total:         this._circuits.size,
      closed,
      open,
      halfOpen,
      criticalCount,
    };
  }

  /**
   * Returns the phi-harmonic health score for the entire registry.
   * Score is the weighted average success rate across all circuits,
   * using phi-fusion weights ordered by circuit pressure severity.
   *
   * @returns {number} Registry health score in [0, 1]
   */
  getRegistryHealthScore() {
    const healths = this.getAllHealth();
    if (healths.length === 0) return 1;

    // Weight circuits by phi-fusion — circuits under highest pressure are weighted most
    const weights = phiFusionWeights(healths.length);
    // Sort by failureRate descending so highest-risk circuits get highest weight
    const sorted = [...healths].sort((a, b) => b.failureRate - a.failureRate);

    return sorted.reduce((score, h, i) => score + h.successRate * weights[i], 0);
  }

  // ── Admin Operations ─────────────────────────────────────────────────────────

  /**
   * Forces a named circuit to CLOSED state (operator admin use only).
   *
   * @param {string} name              - Circuit name
   * @param {string} [reason]          - Reason for forced close
   * @returns {void}
   * @throws {RangeError} If the circuit is not registered
   */
  forceClose(name, reason) {
    this.get(name).forceClose(reason);
  }

  /**
   * Forces a named circuit to OPEN state (operator admin / chaos testing use only).
   *
   * @param {string} name    - Circuit name
   * @param {string} [reason] - Reason for forced open
   * @returns {void}
   * @throws {RangeError} If the circuit is not registered
   */
  forceOpen(name, reason) {
    this.get(name).forceOpen(reason);
  }

  /**
   * Deregisters a circuit by name, freeing its resources.
   *
   * @param {string} name - Circuit name to remove
   * @returns {boolean} True if the circuit was removed, false if not found
   */
  deregister(name) {
    return this._circuits.delete(name);
  }

  // ── Telemetry Flush ──────────────────────────────────────────────────────────

  /**
   * Starts the periodic telemetry flush timer.
   *
   * @param {number} intervalMs - Flush interval in milliseconds
   * @returns {void}
   * @private
   */
  _startFlushTimer(intervalMs) {
    if (this._flushTimer) return;
    this._flushTimer = setInterval(() => {
      this._flushTelemetry();
    }, intervalMs);

    // Prevent the timer from blocking process exit
    if (this._flushTimer.unref) this._flushTimer.unref();
  }

  /**
   * Pushes aggregate registry health metrics to the attached telemetry sink.
   * No-op if no telemetry is configured.
   *
   * @returns {void}
   * @private
   */
  _flushTelemetry() {
    if (!this._telemetry) return;
    try {
      const summary = this.getSummary();
      const score   = this.getRegistryHealthScore();
      const meter   = this._telemetry.meter;
      if (!meter || typeof meter.createObservableGauge !== 'function') return;

      meter
        .createObservableGauge('circuit_breaker.registry.health_score', {
          description: 'Phi-weighted registry health score [0, 1]',
        })
        .addCallback(obs => obs.observe(score));

      meter
        .createObservableGauge('circuit_breaker.registry.open_count', {
          description: 'Number of currently open circuits',
        })
        .addCallback(obs => obs.observe(summary.open));

      meter
        .createObservableGauge('circuit_breaker.registry.critical_count', {
          description: 'Number of circuits at CRITICAL pressure',
        })
        .addCallback(obs => obs.observe(summary.criticalCount));
    } catch (_flushErr) {
      // Telemetry flush failures must never affect service traffic
    }
  }

  /**
   * Stops the telemetry flush timer and frees all internal state.
   * Call during graceful shutdown.
   *
   * @returns {void}
   */
  destroy() {
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }
    this._circuits.clear();
    this.removeAllListeners();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  CircuitBreaker,
  CircuitBreakerRegistry,
  SlidingWindow,
  STATE,

  // Expose phi-derived constants for introspection / testing
  FAILURE_THRESHOLD,
  WINDOW_DURATION_MS,
  BUCKET_COUNT,
  BUCKET_DURATION_MS,
  PROBE_SUCCESS_THRESHOLD,
  MAX_CONCURRENT_PROBES,
  BASE_OPEN_TIMEOUT_MS,
  MAX_OPEN_TIMEOUT_MS,
  FAILURE_RATE_HIGH_THRESHOLD,
  FAILURE_RATE_CRITICAL_THRESHOLD,
  HEALTHY_SUCCESS_RATE,
  MAX_STATE_HISTORY,
  TELEMETRY_FLUSH_INTERVAL_MS,
  DEFAULT_SERVICE_COUNT,
};
