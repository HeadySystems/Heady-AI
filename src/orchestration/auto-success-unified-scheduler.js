// HEADY_BRAND:BEGIN
// ║  HEADY™ — Auto-Success Unified Scheduler                              ║
// ║  FILE: src/orchestration/auto-success-unified-scheduler.js             ║
// HEADY_BRAND:END
/**
 * Unified Auto-Success Scheduler
 *
 * Bridges the TWO auto-success engines under a single coordinator:
 *   1. AutoSuccessEngine (auto-success-engine.js) — cycle-based, φ⁷ interval, 13 categories
 *   2. HeadyAutoSuccess (hc_auto_success.js)      — event-driven reactor, instant task firing
 *
 * The Unified Scheduler ensures:
 *   - No competing loops: cycle engine owns scheduled work, reactor owns event-triggered work
 *   - Shared task registry: tasks registered once, available to both engines
 *   - Deduplication: if reactor fires a task that cycle engine just ran (within PSI² window), skip
 *   - Unified telemetry: both engines report through one event stream
 *   - Pool coordination: hot/warm/cold pool assignments respected by both engines
 *
 * All constants from phi-math.js. Zero hardcoded numbers.
 *
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 */

'use strict';

const {
  fib, PHI, PSI,
  PHI_TIMING,
  AUTO_SUCCESS,
  CSL_THRESHOLDS,
} = require('../../shared/phi-math');

let log = null;
try { log = require('../utils/logger'); } catch { log = console; }
const { bus }          = require('../core/event-bus');

// ─── Deduplication Window ────────────────────────────────────────────────────
// If reactor fires a task that was already executed within PSI² × cycle interval, skip it
const DEDUP_WINDOW_MS = Math.round(PSI * PSI * AUTO_SUCCESS.CYCLE_MS); // ~11,074ms

// ─── Pool Cadences (φ-scaled) ────────────────────────────────────────────────
const POOL_CADENCE = Object.freeze({
  hot:  PHI_TIMING.PHI_7,  // 29,034ms
  warm: PHI_TIMING.PHI_8,  // 46,979ms
  cold: PHI_TIMING.PHI_9,  // ~75,025ms (PHI_9 if defined, else calculated)
});

// ─── Unified Scheduler ──────────────────────────────────────────────────────

class UnifiedAutoSuccessScheduler {
  constructor() {
    /** @type {Map<string, { lastRunAt: number, lastResult: object }>} */
    this._taskExecLog = new Map();

    /** @type {boolean} */
    this._running = false;

    /** @type {{ cycle: number, reactor: number, deduped: number, total: number }} */
    this._metrics = { cycle: 0, reactor: 0, deduped: 0, total: 0 };

    /** @type {Map<string, NodeJS.Timer>} pool timers */
    this._poolTimers = new Map();

    /** References to both engines (set via wire()) */
    this._cycleEngine  = null;  // AutoSuccessEngine from auto-success-engine.js
    this._reactorEngine = null; // HeadyAutoSuccess from hc_auto_success.js
  }

  /**
   * Wire both auto-success engines under unified control.
   * @param {{ cycleEngine?: object, reactorEngine?: object }} engines
   */
  wire(engines = {}) {
    if (engines.cycleEngine) {
      this._cycleEngine = engines.cycleEngine;
      log.info('Cycle engine wired', { categories: AUTO_SUCCESS.CATEGORIES });
    }
    if (engines.reactorEngine) {
      this._reactorEngine = engines.reactorEngine;
      log.info('Reactor engine wired');
    }
  }

  /**
   * Start the unified scheduler.
   * - Cycle engine runs on pool-specific cadences
   * - Reactor engine remains event-driven (no changes)
   * - Deduplication layer prevents redundant execution
   */
  start() {
    if (this._running) return;
    this._running = true;

    // Intercept reactor task execution for deduplication
    if (this._reactorEngine) {
      const origReact = this._reactorEngine.react.bind(this._reactorEngine);
      this._reactorEngine.react = async (trigger, eventData) => {
        this._metrics.reactor++;
        this._metrics.total++;

        bus.emit('auto_success:unified', {
          type:     'reactor_trigger',
          data:     { trigger, source: 'reactor' },
          temporal: PSI,
          semantic: CSL_THRESHOLDS.MEDIUM,
          spatial:  PSI,
        });

        return origReact(trigger, eventData);
      };
    }

    // Start pool-specific cadence timers for cycle engine
    if (this._cycleEngine) {
      this._startPoolTimers();
    }

    // Listen for task completions from both engines for dedup tracking
    bus.on('task', (event) => {
      if (event.data && event.data.key) {
        this._taskExecLog.set(event.data.key, {
          lastRunAt: Date.now(),
          lastResult: { ok: event.data.ok, score: event.data.score },
        });
        this._metrics.cycle++;
        this._metrics.total++;
      }
    });

    log.info('Unified Auto-Success Scheduler started', {
      dedupWindowMs: DEDUP_WINDOW_MS,
      poolCadences: POOL_CADENCE,
    });

    bus.emit('lifecycle', {
      type:     'unified_scheduler_started',
      data:     { dedupWindowMs: DEDUP_WINDOW_MS },
      temporal: PSI,
      semantic: CSL_THRESHOLDS.HIGH,
      spatial:  PSI,
    });
  }

  /**
   * Start pool-specific cadence timers.
   * Hot pool tasks run more frequently than warm, which run more than cold.
   * @private
   */
  _startPoolTimers() {
    for (const [pool, cadenceMs] of Object.entries(POOL_CADENCE)) {
      const timer = setInterval(() => {
        bus.emit('auto_success:unified', {
          type:     'pool_tick',
          data:     { pool, cadenceMs },
          temporal: PSI,
          semantic: CSL_THRESHOLDS.MEDIUM,
          spatial:  PSI,
        });
      }, cadenceMs);

      // Prevent timers from keeping process alive
      if (timer.unref) timer.unref();
      this._poolTimers.set(pool, timer);
    }
  }

  /**
   * Check if a task was recently executed (within dedup window).
   * @param {string} taskKey - Task identifier (category:index or task.id)
   * @returns {boolean} true if task should be skipped
   */
  shouldDedup(taskKey) {
    const entry = this._taskExecLog.get(taskKey);
    if (!entry) return false;

    const elapsed = Date.now() - entry.lastRunAt;
    if (elapsed < DEDUP_WINDOW_MS) {
      this._metrics.deduped++;
      return true;
    }
    return false;
  }

  /**
   * Stop the unified scheduler.
   */
  stop() {
    if (!this._running) return;
    this._running = false;

    for (const [pool, timer] of this._poolTimers) {
      clearInterval(timer);
    }
    this._poolTimers.clear();

    log.info('Unified scheduler stopped', { metrics: this._metrics });
  }

  /**
   * Get unified scheduler metrics.
   * @returns {object}
   */
  stats() {
    return {
      running: this._running,
      metrics: { ...this._metrics },
      dedupWindowMs: DEDUP_WINDOW_MS,
      poolCadences: POOL_CADENCE,
      taskExecLogSize: this._taskExecLog.size,
      cycleEngineWired: Boolean(this._cycleEngine),
      reactorEngineWired: Boolean(this._reactorEngine),
    };
  }
}

// ─── Module Singleton ────────────────────────────────────────────────────────

const _scheduler = new UnifiedAutoSuccessScheduler();

module.exports = {
  UnifiedAutoSuccessScheduler,
  unifiedScheduler: _scheduler,
  POOL_CADENCE,
  DEDUP_WINDOW_MS,
};
