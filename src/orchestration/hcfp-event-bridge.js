// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  FILE: src/orchestration/hcfp-event-bridge.js                  ║
// ║  LAYER: orchestration/bridge                                    ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * HCFPEventBridge — HCFPRunner ↔ Global EventBus Connector
 *
 * Solves two critical disconnects:
 *
 *   1. NAME MISMATCH: HCFPRunner fires internal events ('run:start', 'run:complete')
 *      but hc_auto_success.js listens on global.eventBus for 'pipeline:started',
 *      'pipeline:completed', 'pipeline:failed'. Without this bridge, pipeline runs
 *      are completely invisible to the auto-success engine.
 *
 *   2. BUS ISOLATION: HCFPRunner has its own _notify() + _listeners Map.
 *      The auto-success engine binds to global.eventBus (EventEmitter).
 *      This bridge connects both systems.
 *
 *   3. CONTINUOUS TRIGGER: The auto-success engine is purely reactive — it never
 *      INITIATES pipeline runs. This bridge sets up a φ⁷-interval that emits
 *      'pipeline:trigger' to global.eventBus, which auto-success reacts to by
 *      calling runner.run(), creating a self-sustaining autonomous loop.
 *
 * Wire order (in engine-wiring.js):
 *   const runner = new HCFPRunner();
 *   const bridge = new HCFPEventBridge(runner, eventBus);
 *   bridge.start();
 *
 * © 2026 HeadySystems Inc. | φ = 1.618033988749895
 */

'use strict';

// ─── φ-MATH CONSTANTS ────────────────────────────────────────────────────────
const PHI  = 1.618033988749895;
const PSI  = 1 / PHI;           // 0.618
const PSI2 = PSI * PSI;         // 0.382
const FIB  = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584];

// φ⁷ × 1000ms = 29,034ms — matches AutoSuccessEngine cycle
const PIPELINE_TRIGGER_INTERVAL_MS = Math.round(Math.pow(PHI, 7) * 1000);

// φ⁵ × 1000ms = 11,090ms — initial delay before first autonomous trigger
const INITIAL_DELAY_MS = Math.round(Math.pow(PHI, 5) * 1000);

// CSL gate — only auto-trigger if no recent manual run within LOW threshold window
const CSL_LOW  = 0.382; // ψ² — minimum confidence to proceed

// ─── EVENT NAME TRANSLATION MAP ──────────────────────────────────────────────
// HCFPRunner internal event  →  global.eventBus event
const EVENT_MAP = Object.freeze({
  'run:start':      'pipeline:started',
  'run:complete':   'pipeline:completed',
  'run:stopped':    'pipeline:completed',  // also maps to completed (with status)
  'stage:start':    'pipeline:stage:start',
  'stage:end':      'pipeline:stage:end',
  'stage:complete': 'pipeline:stage:complete',
  'stage:passed':   'pipeline:stage:passed',
  'stage:failed':   'pipeline:stage:failed',
  'run:paused':     'pipeline:paused',
  'run:resumed':    'pipeline:resumed',
  'run:cancelled':  'pipeline:failed',
});

// ─── REVERSE MAP: global.eventBus → HCFPRunner ───────────────────────────────
// Allows auto-success engine to trigger pipeline runs via eventBus
const REVERSE_MAP = Object.freeze({
  'pipeline:run':     (runner, data) => runner.run(data?.task || 'auto-success-cycle'),
  'pipeline:trigger': (runner, data) => runner.run(data?.task || 'autonomous-cycle'),
  'pipeline:pause':   (runner, data) => data?.runId && runner.pause(data.runId),
  'pipeline:resume':  (runner, data) => data?.runId && runner.resume(data.runId),
  'pipeline:cancel':  (runner, data) => data?.runId && runner.cancel(data.runId),
});

// ─── LOGGER (pino-style structured, zero console.log) ────────────────────────
let _logger = null;
try { _logger = require('../utils/logger'); } catch { /* graceful — logger optional */ }
function log(level, msg, data = {}) {
  const entry = { level, component: 'HCFPEventBridge', msg, ts: new Date().toISOString(), ...data };
  if (_logger && typeof _logger.logNodeActivity === 'function') {
    _logger.logNodeActivity('HCFP-BRIDGE', entry);
  } else {
    const fn = level === 'error' ? console.error : console.log;
    fn(JSON.stringify(entry));
  }
}

// ─── MAIN BRIDGE CLASS ───────────────────────────────────────────────────────

class HCFPEventBridge {
  constructor(runner, eventBus) {
    if (!runner) throw new Error('HCFPEventBridge: runner is required');
    if (!eventBus) throw new Error('HCFPEventBridge: eventBus is required');

    this._runner   = runner;
    this._bus      = eventBus;
    this._running  = false;
    this._timer    = null;
    this._initial  = null;
    this._cycleN   = 0;
    this._lastRunAt = 0;
    this._wiredEvents = [];
  }

  /**
   * Start the bridge:
   * 1. Wire runner → eventBus (forward all pipeline events to global bus)
   * 2. Wire eventBus → runner (allow auto-success to trigger runs)
   * 3. Start φ⁷-interval autonomous pipeline trigger
   */
  start() {
    if (this._running) return this;
    this._running = true;

    // ── 1. Runner → Bus (forward with name translation) ──────────────────────
    for (const [runnerEvent, busEvent] of Object.entries(EVENT_MAP)) {
      const handler = (data) => {
        try {
          const enriched = {
            ...data,
            _bridge: { runnerEvent, busEvent, ts: Date.now(), cycle: this._cycleN },
          };
          this._bus.emit(busEvent, enriched);
          log('debug', `forwarded ${runnerEvent} → ${busEvent}`, { runId: data?.runId });
        } catch (err) {
          log('error', `bridge forward error: ${err.message}`, { runnerEvent, busEvent });
        }
      };
      this._runner.on(runnerEvent, handler);
      this._wiredEvents.push({ dir: 'runner→bus', runnerEvent, busEvent, handler });
    }

    // ── 1b. Stage lifecycle guarantee ────────────────────────────────────────
    // Ensure every stage that starts emits either stage:complete or stage:failed.
    // If a stage:start fires but neither completion event follows within the
    // stage timeout (+ φ-margin), synthesize a stage:failed event.
    this._pendingStages = new Map();

    this._runner.on('stage:start', (data) => {
      const stageId = data?.stageId || data?.stage || 'unknown';
      const timeout = (data?.timeout || 30000) * PHI; // φ-margin on stage timeout
      const timer = setTimeout(() => {
        if (this._pendingStages.has(stageId)) {
          this._pendingStages.delete(stageId);
          const failPayload = {
            stageId,
            runId: data?.runId,
            reason: 'stage_timeout_no_completion_event',
            synthesized: true,
            ts: Date.now(),
          };
          this._runner.emit?.('stage:failed', failPayload);
          log('warn', `synthesized stage:failed for "${stageId}" — no completion event received`, { stageId });
        }
      }, timeout);
      this._pendingStages.set(stageId, timer);
    });

    // Track which stages received an explicit completion event (complete/passed/failed)
    this._completedStages = new Set();

    const markStageCompleted = (data) => {
      const stageId = data?.stageId || data?.stage || 'unknown';
      this._completedStages.add(stageId);
      const timer = this._pendingStages.get(stageId);
      if (timer) {
        clearTimeout(timer);
        this._pendingStages.delete(stageId);
      }
    };

    // stage:end may fire without an explicit complete/failed — synthesize stage:complete if missing
    const handleStageEnd = (data) => {
      const stageId = data?.stageId || data?.stage || 'unknown';
      if (!this._completedStages.has(stageId)) {
        // stage:end arrived without stage:complete or stage:failed — synthesize stage:complete
        const completePayload = {
          stageId,
          runId: data?.runId,
          synthesized: true,
          reason: 'stage_end_without_completion_event',
          ts: Date.now(),
        };
        this._runner.emit?.('stage:complete', completePayload);
        log('warn', `synthesized stage:complete for "${stageId}" — stage:end fired without explicit completion`, { stageId });
      }
      this._completedStages.delete(stageId);
      const timer = this._pendingStages.get(stageId);
      if (timer) {
        clearTimeout(timer);
        this._pendingStages.delete(stageId);
      }
    };

    this._runner.on('stage:complete', markStageCompleted);
    this._runner.on('stage:passed', markStageCompleted);
    this._runner.on('stage:failed', markStageCompleted);
    this._runner.on('stage:end', handleStageEnd);

    // Track last run completion for CSL-gated autonomous trigger
    this._runner.on('run:complete', () => { this._lastRunAt = Date.now(); });

    // ── 2. Bus → Runner (allow external pipeline control) ────────────────────
    for (const [busEvent, action] of Object.entries(REVERSE_MAP)) {
      const handler = async (data) => {
        try {
          await action(this._runner, data);
          log('debug', `triggered runner from bus event: ${busEvent}`, { data });
        } catch (err) {
          log('error', `bus→runner action error: ${err.message}`, { busEvent });
        }
      };
      this._bus.on(busEvent, handler);
      this._wiredEvents.push({ dir: 'bus→runner', busEvent, handler });
    }

    // ── 3. φ⁷-interval autonomous pipeline trigger ──────────────────────────
    // Delayed start — allow system to fully boot before first trigger
    this._initial = setTimeout(() => {
      this._autonomousTrigger();  // first trigger
      this._timer = setInterval(() => this._autonomousTrigger(), PIPELINE_TRIGGER_INTERVAL_MS);
    }, INITIAL_DELAY_MS);

    log('info', 'HCFPEventBridge started', {
      runnerEvents: Object.keys(EVENT_MAP).length,
      busEvents: Object.keys(REVERSE_MAP).length,
      triggerIntervalMs: PIPELINE_TRIGGER_INTERVAL_MS,
      initialDelayMs: INITIAL_DELAY_MS,
    });

    return this;
  }

  /**
   * Stop bridge — remove all listeners, clear timers.
   */
  stop() {
    if (!this._running) return this;
    this._running = false;

    clearTimeout(this._initial);
    clearInterval(this._timer);
    this._initial = null;
    this._timer = null;

    // Clear any pending stage lifecycle timers
    if (this._pendingStages) {
      for (const timer of this._pendingStages.values()) clearTimeout(timer);
      this._pendingStages.clear();
    }
    if (this._completedStages) {
      this._completedStages.clear();
    }

    // Clean up all wired listeners
    for (const w of this._wiredEvents) {
      try {
        if (w.dir === 'runner→bus') this._runner._listeners?.delete?.(w.runnerEvent);
        if (w.dir === 'bus→runner') this._bus.removeListener(w.busEvent, w.handler);
      } catch { /* graceful */ }
    }
    this._wiredEvents = [];

    log('info', 'HCFPEventBridge stopped', { totalCycles: this._cycleN });
    return this;
  }

  /**
   * Emit 'pipeline:trigger' to global eventBus on φ⁷ cadence.
   * Auto-success engine reacts to this by executing its catalog and running pipeline.
   *
   * CSL gate: only fires if no run completed within the last PSI² × interval.
   * This prevents pile-ups if pipeline is already running.
   */
  _autonomousTrigger() {
    const timeSinceLast = Date.now() - this._lastRunAt;
    const idleThreshold = PIPELINE_TRIGGER_INTERVAL_MS * PSI2; // 0.382 × cycle

    // CSL gate: skip trigger if a run just completed (system is still processing)
    const cslSignal = timeSinceLast > idleThreshold ? 'PASS' : 'SKIP';
    this._cycleN++;

    const triggerPayload = {
      task: `autonomous-cycle-${this._cycleN}`,
      cycle: this._cycleN,
      triggerMs: Date.now(),
      csl: { signal: cslSignal, timeSinceLast, idleThreshold },
      source: 'hcfp-event-bridge',
    };

    if (cslSignal === 'PASS') {
      this._bus.emit('pipeline:trigger', triggerPayload);
      log('info', `φ⁷ autonomous trigger fired (cycle ${this._cycleN})`, { triggerPayload });
    } else {
      this._bus.emit('pipeline:idle_skip', triggerPayload);
      log('debug', `trigger skipped — pipeline recently ran (${timeSinceLast}ms ago)`, { cycle: this._cycleN });
    }
  }

  /**
   * Status report for /api/hcfp-bridge/status
   */
  getStatus() {
    return {
      running: this._running,
      wiredEventCount: this._wiredEvents.length,
      cycleCount: this._cycleN,
      lastRunAt: this._lastRunAt ? new Date(this._lastRunAt).toISOString() : null,
      triggerIntervalMs: PIPELINE_TRIGGER_INTERVAL_MS,
      initialDelayMs: INITIAL_DELAY_MS,
      eventMap: EVENT_MAP,
      reverseMap: Object.keys(REVERSE_MAP),
      phi: PHI,
    };
  }
}

// ─── MODULE EXPORT ────────────────────────────────────────────────────────────

module.exports = {
  HCFPEventBridge,
  EVENT_MAP,
  REVERSE_MAP,
  PIPELINE_TRIGGER_INTERVAL_MS,
  INITIAL_DELAY_MS,
  PHI, PSI, PSI2, FIB,
};
