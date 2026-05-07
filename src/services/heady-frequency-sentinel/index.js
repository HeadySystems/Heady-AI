/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ThermalMonitorBee — Sentinel Swarm Frequency Interference Service
 * ═════════════════════════════════════════════════════════════════
 *
 * A specialized bee within the Sentinel Swarm (Swarm #13: Defense) that
 * provides real-time frequency interference monitoring. Implements the
 * Latent Service pattern (start/stop/health/getMetrics) and integrates
 * with the Auto-Success heartbeat at 29,034ms intervals.
 *
 * Responsibilities:
 *   1. Auto-register known subsystem frequencies on boot
 *   2. Run interference scans on each heartbeat
 *   3. Emit thermal alerts to governance/lens_stream
 *   4. Apply anti-resonance damping autonomously
 *   5. Expose metrics for Prometheus/OpenTelemetry
 *
 * Swarm Taxonomy: Sentinel (Defense) → ThermalMonitorBee
 */

'use strict';

const {
  FrequencyInterferenceDetector,
  SEVERITY,
  THRESHOLDS,
} = require('../../frequency-interference-detector');

const PHI = 1.6180339887;
const PSI = 0.6180339887;
const CYCLE_MS = 29034; // φ × 18,000

// ─── Default Subsystem Frequency Map ─────────────────────────────────────────
// Maps known Heady subsystems to their characteristic operational frequencies.
// Frequencies derived from service heartbeat intervals converted to Hz.

const DEFAULT_SUBSYSTEM_FREQUENCIES = [
  // Core OS — Layer 0-1
  { id: 'heady-manager',    hz: 1000 / 29034,   desc: 'Core API Gateway (29,034ms cycle)' },
  { id: 'heady-conductor',  hz: 1000 / 17944,   desc: 'Meta-Brain orchestrator (φ⁵ timeout)' },
  { id: 'heady-monitor',    hz: 1000 / 11090,   desc: 'Observability service (φ⁴ timeout)' },
  // Intelligence — Layer 2-3
  { id: 'csl-engine',       hz: 1000 / 6854,    desc: 'CSL gate processor (φ³ timeout)' },
  { id: 'heady-memory',     hz: 1000 / 46978,   desc: 'Vector memory consolidation (φ⁷)' },
  { id: 'auto-context',     hz: 1000 / 29034,   desc: 'AutoContext file watcher (heartbeat)' },
  // Swarm — Layer 3
  { id: 'swarm-coordinator', hz: 1000 / 4236,   desc: 'Bee dispatch scheduler (φ² timeout)' },
  { id: 'battle-arena',     hz: 1000 / 11090,   desc: 'Multi-model evaluation (φ⁴)' },
  // Edge — Layer 0
  { id: 'edge-proxy',       hz: 1000 / 1618,    desc: 'Cloudflare Worker cycle (φ × 1000ms)' },
  // Evolution — Layer 5
  { id: 'auto-success',     hz: 1000 / 29034,   desc: 'Auto-Success Engine (heartbeat)' },
  { id: 'drift-detector',   hz: 1000 / 29034,   desc: 'Drift detection cycle (heartbeat)' },
  // Self
  { id: 'frequency-sentinel', hz: 1000 / 29034, desc: 'This service (heartbeat)' },
  // MIDI bridge (if active)
  { id: 'midi-bridge',      hz: 1000 / 4236,    desc: 'MIDI protocol bridge (φ²)' },
];

// ─── ThermalMonitorBee ───────────────────────────────────────────────────────

class ThermalMonitorBee {
  /**
   * @param {object} [opts]
   * @param {function} [opts.logger] - Structured logger instance
   * @param {function} [opts.governanceEmit] - Emit to governance/lens_stream
   * @param {boolean} [opts.autoRegister=true] - Auto-register default subsystems
   */
  constructor(opts = {}) {
    this._logger = opts.logger || console;
    this._governanceEmit = opts.governanceEmit || null;
    this._autoRegister = opts.autoRegister !== false;

    this._detector = new FrequencyInterferenceDetector({
      scanIntervalMs: CYCLE_MS,
      onInterference: (result, idA, idB) => this._handleInterference(result, idA, idB),
      onDampen: (dampResult, target, source) => this._handleDampen(dampResult, target, source),
    });

    // Metrics counters
    this._metrics = {
      scansTotal: 0,
      interferencesDetected: 0,
      dampingApplied: 0,
      thermalExceededCount: 0,
      lastScanDurationMs: 0,
      lastGlobalThermal: 0,
    };

    this._started = false;
    this._startedAt = null;
  }

  // ─── Latent Service Interface ────────────────────────────────────────────

  /**
   * Start the ThermalMonitorBee service.
   * Registers default subsystems and begins scanning.
   * @returns {Promise<this>}
   */
  async start() {
    if (this._started) return this;

    this._log('info', 'ThermalMonitorBee starting...');

    // Auto-register known subsystem frequencies
    if (this._autoRegister) {
      for (const sub of DEFAULT_SUBSYSTEM_FREQUENCIES) {
        this._detector.register(sub.id, sub.hz);
      }
      this._log('info', `Registered ${DEFAULT_SUBSYSTEM_FREQUENCIES.length} subsystem frequencies`);
    }

    // Start the scan loop
    this._detector.start(CYCLE_MS);
    this._started = true;
    this._startedAt = Date.now();

    this._log('info', 'ThermalMonitorBee ONLINE — monitoring frequency interference');
    return this;
  }

  /**
   * Stop the service gracefully.
   * @returns {Promise<this>}
   */
  async stop() {
    if (!this._started) return this;
    this._detector.stop();
    this._started = false;
    this._log('info', 'ThermalMonitorBee stopped');
    return this;
  }

  /**
   * Deep health check.
   * @returns {{ healthy: boolean, details: object }}
   */
  health() {
    const summary = this._detector.summary();
    const healthy = !summary.thermalExceeded &&
                    summary.lastSeverity !== SEVERITY.CRITICAL;

    return {
      healthy,
      status: healthy ? 'GREEN' : 'RED',
      details: {
        ...summary,
        uptime: this._startedAt ? Date.now() - this._startedAt : 0,
        metrics: { ...this._metrics },
      },
    };
  }

  /**
   * Prometheus-compatible metrics.
   * @returns {object}
   */
  getMetrics() {
    return {
      fipl_scans_total: this._metrics.scansTotal,
      fipl_interferences_total: this._metrics.interferencesDetected,
      fipl_damping_applied_total: this._metrics.dampingApplied,
      fipl_thermal_exceeded_total: this._metrics.thermalExceededCount,
      fipl_last_scan_duration_ms: this._metrics.lastScanDurationMs,
      fipl_global_thermal: this._metrics.lastGlobalThermal,
      fipl_registered_subsystems: this._detector.getRegistry().size,
      fipl_active_corrections: this._detector.getActiveCorrections().length,
    };
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Manually trigger a scan (outside the heartbeat cycle).
   * @returns {object} Scan result
   */
  manualScan() {
    const start = Date.now();
    const result = this._detector.scan();
    this._metrics.scansTotal++;
    this._metrics.lastScanDurationMs = Date.now() - start;
    this._metrics.lastGlobalThermal = result.globalThermal;
    if (result.thermalExceeded) this._metrics.thermalExceededCount++;
    return result;
  }

  /**
   * Register a new subsystem frequency for monitoring.
   * @param {string} subsystemId
   * @param {number} frequencyHz
   * @returns {object} FrequencySignature
   */
  registerSubsystem(subsystemId, frequencyHz) {
    return this._detector.register(subsystemId, frequencyHz);
  }

  /**
   * Update a subsystem's current load/amplitude.
   * @param {string} subsystemId
   * @param {number} amplitude - 0.0 to 1.0
   */
  updateLoad(subsystemId, amplitude) {
    this._detector.updateAmplitude(subsystemId, amplitude);
  }

  /**
   * Get the current thermal status across all subsystems.
   */
  getThermalStatus() { return this._detector.getThermalStatus(); }

  /**
   * Get the full interference summary.
   */
  getSummary() { return this._detector.summary(); }

  /**
   * Get the underlying detector for advanced operations.
   * @returns {FrequencyInterferenceDetector}
   */
  getDetector() { return this._detector; }

  // ─── Internal Handlers ───────────────────────────────────────────────────

  /** @private */
  _handleInterference(result, idA, idB) {
    this._metrics.interferencesDetected++;
    const msg = `INTERFERENCE DETECTED: ${idA} ↔ ${idB} — score=${result.score.toFixed(3)} severity=${result.severity}`;
    this._log('warn', msg);

    if (this._governanceEmit) {
      try {
        this._governanceEmit({
          type: 'frequency_interference',
          severity: result.severity,
          subsystemA: idA,
          subsystemB: idB,
          score: result.score,
          cosineAlignment: result.cosineAlignment,
          timestamp: Date.now(),
        });
      } catch (_) {}
    }
  }

  /** @private */
  _handleDampen(dampResult, target, source) {
    this._metrics.dampingApplied++;
    const msg = `DAMPING APPLIED: ${target.subsystemId} phase-shifted by ${dampResult.offset.toFixed(3)} rad (interference with ${source.subsystemId})`;
    this._log('info', msg);

    if (this._governanceEmit) {
      try {
        this._governanceEmit({
          type: 'frequency_damping',
          target: target.subsystemId,
          source: source.subsystemId,
          phaseOffset: dampResult.offset,
          reason: dampResult.reason,
          timestamp: Date.now(),
        });
      } catch (_) {}
    }
  }

  /** @private */
  _log(level, message) {
    if (this._logger && typeof this._logger[level] === 'function') {
      this._logger[level]({ component: 'ThermalMonitorBee' }, message);
    } else if (this._logger && typeof this._logger.log === 'function') {
      this._logger.log(`[ThermalMonitorBee] [${level.toUpperCase()}] ${message}`);
    }
  }
}

module.exports = { ThermalMonitorBee, DEFAULT_SUBSYSTEM_FREQUENCIES };
