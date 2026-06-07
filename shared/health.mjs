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
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: shared/health.mjs                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Heady™ Health Probe System v5.0 (ESM)
 * K8s-compatible liveness / readiness / startup probes.
 * All timing derived from φ.
 *
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * @module shared/health
 */

import {
  PHI, PSI, CSL_THRESHOLDS, TIMING, getPressureLevel
} from './phi-math.mjs';
import { createLogger } from './logger.mjs';

const logger = createLogger('health-probes');

export class HealthProbe {
  /**
   * @param {string} serviceName
   * @param {object} [options]
   * @param {number} [options.checkInterval] - Periodic check interval in ms
   */
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.startTime = Date.now();
    this.ready = false;
    this.alive = true;
    this.startupComplete = false;
    this.checks = new Map();
    this.coherenceScore = 1.0;
    this.pressure = 0;
    this.checkInterval = options.checkInterval || TIMING.HEALTH_CHECK_MS;
    this._intervalHandle = null;
  }

  /**
   * Register a named health check function.
   * @param {string} name - Check name
   * @param {Function} checkFn - Async function returning { healthy: boolean, ...details }
   */
  registerCheck(name, checkFn) {
    this.checks.set(name, { fn: checkFn, lastResult: null, lastCheck: 0 });
  }

  /**
   * Run all registered health checks.
   * @returns {Promise<object>} Aggregated health status
   */
  async runChecks() {
    const results = {};
    let allHealthy = true;

    for (const [name, check] of this.checks) {
      try {
        const result = await check.fn();
        check.lastResult = result;
        check.lastCheck = Date.now();
        results[name] = { status: result.healthy ? 'UP' : 'DOWN', ...result };
        if (!result.healthy) allHealthy = false;
      } catch (err) {
        check.lastResult = { healthy: false, error: err.message };
        check.lastCheck = Date.now();
        results[name] = { status: 'ERROR', error: err.message };
        allHealthy = false;
      }
    }

    this.alive = allHealthy;
    this.pressure = this._calculatePressure(results);

    return {
      service: this.serviceName,
      status: allHealthy ? 'HEALTHY' : 'DEGRADED',
      uptime: Date.now() - this.startTime,
      coherence: this.coherenceScore,
      pressure: this.pressure,
      pressureLevel: getPressureLevel(this.pressure),
      startupComplete: this.startupComplete,
      checks: results,
      timestamp: new Date().toISOString(),
    };
  }

  /** @private */
  _calculatePressure(results) {
    const total = Object.keys(results).length;
    if (total === 0) return 0;
    const unhealthy = Object.values(results).filter(r => r.status !== 'UP').length;
    return unhealthy / total;
  }

  setReady(ready) {
    this.ready = ready;
    logger.info('readiness_changed', { service: this.serviceName, ready });
  }

  setStartupComplete(complete = true) {
    this.startupComplete = complete;
    if (complete) {
      logger.info('startup_complete', { service: this.serviceName, startupDuration: Date.now() - this.startTime });
    }
  }

  setCoherence(score) {
    const prev = this.coherenceScore;
    this.coherenceScore = score;
    if (score < CSL_THRESHOLDS.MEDIUM && prev >= CSL_THRESHOLDS.MEDIUM) {
      logger.warn('coherence_drift_detected', {
        service: this.serviceName,
        previous: prev,
        current: score,
        threshold: CSL_THRESHOLDS.MEDIUM,
      });
    }
  }

  startPeriodicChecks() {
    this._intervalHandle = setInterval(() => this.runChecks(), this.checkInterval);
  }

  stopPeriodicChecks() {
    if (this._intervalHandle) {
      clearInterval(this._intervalHandle);
      this._intervalHandle = null;
    }
  }

  // ─── ROUTE HANDLERS ─────────────────────────────────────────────────────

  /** Liveness: is the process alive? */
  livenessHandler(req, res) {
    res.status(this.alive ? 200 : 503).json({
      status: this.alive ? 'ALIVE' : 'DEAD',
      service: this.serviceName,
      timestamp: new Date().toISOString(),
    });
  }

  /** Readiness: is the service ready to accept traffic? */
  readinessHandler(req, res) {
    res.status(this.ready ? 200 : 503).json({
      status: this.ready ? 'READY' : 'NOT_READY',
      service: this.serviceName,
      coherence: this.coherenceScore,
      timestamp: new Date().toISOString(),
    });
  }

  /** Startup: has the service completed initialization? */
  startupHandler(req, res) {
    res.status(this.startupComplete ? 200 : 503).json({
      status: this.startupComplete ? 'STARTED' : 'STARTING',
      service: this.serviceName,
      uptime: Date.now() - this.startTime,
      timestamp: new Date().toISOString(),
    });
  }

  /** Full health: detailed status with all checks */
  async fullHealthHandler(req, res) {
    const health = await this.runChecks();
    res.status(health.status === 'HEALTHY' ? 200 : 503).json(health);
  }

  /**
   * Mount the full health check triad on an Express app.
   * /health/live — liveness probe
   * /health/ready — readiness probe
   * /health/startup — startup probe
   * /health — full detailed health check
   * @param {import('express').Application} app
   */
  mountRoutes(app) {
    app.get('/health/live', (req, res) => this.livenessHandler(req, res));
    app.get('/health/ready', (req, res) => this.readinessHandler(req, res));
    app.get('/health/startup', (req, res) => this.startupHandler(req, res));
    app.get('/health', (req, res) => this.fullHealthHandler(req, res));
  }
}

/**
 * Create and configure a health probe for a service.
 * @param {string} serviceName
 * @param {object} [options]
 * @returns {HealthProbe}
 */
export function createHealthProbe(serviceName, options = {}) {
  return new HealthProbe(serviceName, options);
}

export default { HealthProbe, createHealthProbe };
