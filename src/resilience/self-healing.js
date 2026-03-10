/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  HEADY™ SELF-HEALING MESH — Auto-Recovery & Service Discovery    ║
 * ║  Detect drift, quarantine, attest, respawn — immune system       ║
 * ║  © 2024-2026 HeadySystems Inc. All Rights Reserved.              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

'use strict';

import { PHI, PSI, fib, phiBackoff, CSL_THRESHOLDS, PHI_TIMING } from '../../shared/phi-math.js';
import { cslAND } from '../../shared/csl-engine.js';

/** Health check interval — φ⁴ × 1000ms */
const HEALTH_CHECK_INTERVAL = PHI_TIMING.PHI_4;

/** Coherence drift threshold — phiThreshold(2) ≈ 0.809 */
const DRIFT_THRESHOLD = CSL_THRESHOLDS.MEDIUM;

/** Max quarantine duration — fib(11) × 1000 = 89s */
const MAX_QUARANTINE_MS = fib(11) * 1000;

/** Max respawn attempts — fib(5) = 5 */
const MAX_RESPAWN_ATTEMPTS = fib(5);

/** Service states */
const SERVICE_STATE = Object.freeze({
  HEALTHY:      'HEALTHY',
  DEGRADED:     'DEGRADED',
  QUARANTINED:  'QUARANTINED',
  RECOVERING:   'RECOVERING',
  DEAD:         'DEAD',
});

/**
 * ServiceRecord — tracks a service's health and state.
 */
class ServiceRecord {
  constructor(id, config) {
    this.id = id;
    this.config = config;
    this.state = SERVICE_STATE.HEALTHY;
    this.lastHeartbeat = Date.now();
    this.coherenceScore = 1.0;
    this.respawnAttempts = 0;
    this.quarantinedAt = null;
    this.incidents = [];
    this.embedding = null;
  }
}

/**
 * SelfHealingMesh — monitors service health, detects drift,
 * quarantines unhealthy services, and respawns them.
 */
export class SelfHealingMesh {
  /**
   * @param {Object} options
   * @param {Function} options.respawnFn - Async function to respawn a service
   * @param {Function} [options.embedFn] - Async function to embed service state
   * @param {Object} [options.telemetry]
   */
  constructor({ respawnFn, embedFn = null, telemetry = null }) {
    /** @private */ this._respawnFn = respawnFn;
    /** @private */ this._embedFn = embedFn;
    /** @private */ this._telemetry = telemetry;
    /** @private */ this._services = new Map();
    /** @private */ this._healthCheckTimer = null;
    /** @private */ this._running = false;
  }

  /**
   * Register a service with the mesh.
   * @param {string} serviceId
   * @param {Object} config - Service configuration
   */
  register(serviceId, config = {}) {
    this._services.set(serviceId, new ServiceRecord(serviceId, config));
    this._emit('service.registered', { serviceId });
  }

  /**
   * Deregister a service from the mesh.
   * @param {string} serviceId
   */
  deregister(serviceId) {
    this._services.delete(serviceId);
    this._emit('service.deregistered', { serviceId });
  }

  /**
   * Record a heartbeat from a service.
   * @param {string} serviceId
   * @param {Object} healthData - { coherenceScore, embedding, metrics }
   */
  heartbeat(serviceId, healthData = {}) {
    const record = this._services.get(serviceId);
    if (!record) return;

    record.lastHeartbeat = Date.now();
    if (typeof healthData.coherenceScore === 'number') {
      record.coherenceScore = healthData.coherenceScore;
    }
    if (healthData.embedding) {
      record.embedding = healthData.embedding;
    }

    // Auto-recover if was degraded but now healthy
    if (record.state === SERVICE_STATE.DEGRADED && record.coherenceScore >= DRIFT_THRESHOLD) {
      record.state = SERVICE_STATE.HEALTHY;
      this._emit('service.recovered', { serviceId });
    }
  }

  /**
   * Start the self-healing monitoring loop.
   */
  start() {
    if (this._running) return;
    this._running = true;
    this._healthCheckTimer = setInterval(() => this._checkAll(), HEALTH_CHECK_INTERVAL);
    this._emit('mesh.started', { services: this._services.size });
  }

  /**
   * Stop the monitoring loop.
   */
  stop() {
    this._running = false;
    if (this._healthCheckTimer) {
      clearInterval(this._healthCheckTimer);
      this._healthCheckTimer = null;
    }
    this._emit('mesh.stopped', {});
  }

  /**
   * Get mesh health status.
   * @returns {Object}
   */
  getStatus() {
    const stats = { healthy: 0, degraded: 0, quarantined: 0, recovering: 0, dead: 0 };
    const services = {};

    for (const [id, record] of this._services) {
      stats[record.state.toLowerCase()]++;
      services[id] = {
        state: record.state,
        coherenceScore: record.coherenceScore,
        lastHeartbeat: record.lastHeartbeat,
        respawnAttempts: record.respawnAttempts,
      };
    }

    return { stats, services, running: this._running };
  }

  // ─── PRIVATE ───────────────────────────────────────────────────────────────

  /**
   * Run health check across all services.
   * @private
   */
  async _checkAll() {
    const now = Date.now();

    for (const [id, record] of this._services) {
      // Check heartbeat freshness
      const heartbeatAge = now - record.lastHeartbeat;
      const heartbeatTimeout = PHI_TIMING.PHI_5; // 11,090ms

      if (heartbeatAge > heartbeatTimeout && record.state === SERVICE_STATE.HEALTHY) {
        record.state = SERVICE_STATE.DEGRADED;
        this._emit('service.degraded', { serviceId: id, reason: 'heartbeat_timeout' });
      }

      // Check coherence drift
      if (record.coherenceScore < DRIFT_THRESHOLD && record.state === SERVICE_STATE.HEALTHY) {
        record.state = SERVICE_STATE.DEGRADED;
        this._emit('service.drift', { serviceId: id, coherenceScore: record.coherenceScore });
      }

      // Quarantine degraded services after sustained failure
      if (record.state === SERVICE_STATE.DEGRADED && heartbeatAge > heartbeatTimeout * PHI) {
        await this._quarantine(record);
      }

      // Check quarantine expiry
      if (record.state === SERVICE_STATE.QUARANTINED) {
        const quarantineDuration = now - record.quarantinedAt;
        if (quarantineDuration >= MAX_QUARANTINE_MS) {
          await this._attemptRespawn(record);
        }
      }
    }
  }

  /**
   * Quarantine a service.
   * @private
   */
  async _quarantine(record) {
    record.state = SERVICE_STATE.QUARANTINED;
    record.quarantinedAt = Date.now();
    record.incidents.push({
      type: 'quarantine',
      timestamp: Date.now(),
      coherenceScore: record.coherenceScore,
    });
    this._emit('service.quarantined', { serviceId: record.id });
  }

  /**
   * Attempt to respawn a quarantined service.
   * @private
   */
  async _attemptRespawn(record) {
    if (record.respawnAttempts >= MAX_RESPAWN_ATTEMPTS) {
      record.state = SERVICE_STATE.DEAD;
      this._emit('service.dead', { serviceId: record.id, attempts: record.respawnAttempts });
      return;
    }

    record.state = SERVICE_STATE.RECOVERING;
    record.respawnAttempts++;

    try {
      await this._respawnFn(record.id, record.config);
      record.state = SERVICE_STATE.HEALTHY;
      record.coherenceScore = 1.0;
      record.lastHeartbeat = Date.now();
      record.quarantinedAt = null;
      this._emit('service.respawned', { serviceId: record.id, attempt: record.respawnAttempts });
    } catch (err) {
      // Back to quarantine with phi-backoff
      record.state = SERVICE_STATE.QUARANTINED;
      record.quarantinedAt = Date.now();
      const backoff = phiBackoff(record.respawnAttempts);
      this._emit('service.respawn.failed', { serviceId: record.id, error: err.message, retryMs: backoff });
    }
  }

  /** @private */
  _emit(event, data) {
    if (this._telemetry) {
      this._telemetry.emit(event, { source: 'SelfHealingMesh', ...data });
    }
  }
}

export { SERVICE_STATE, DRIFT_THRESHOLD, HEALTH_CHECK_INTERVAL };
export default SelfHealingMesh;
