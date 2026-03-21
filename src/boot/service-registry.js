/**
 * ServiceRegistry — Singleton registry for all Heady Latent Services
 * 
 * Central hub for service lifecycle management: register, start, stop, health.
 * Every Latent Service in the Heady OS registers here on boot.
 * 
 * @module boot/service-registry
 * @author Eric Haywood
 * @license Proprietary — HeadySystems Inc.
 * @version 1.0.0
 */
'use strict';

const { PHI, phiMs, PHI_TIMING, CSL_THRESHOLDS } = require('../shared/phi-math');
const { createLogger } = require('../utils/logger');
const logger = createLogger('service-registry');

const SERVICE_STATUS = {
  REGISTERED: 'registered',
  STARTING:   'starting',
  ACTIVE:     'active',
  DEGRADED:   'degraded',
  STOPPING:   'stopping',
  STOPPED:    'stopped',
  FAILED:     'failed',
};

class ServiceRegistry {
  constructor() {
    /** @type {Map<string, {service: object, status: string, startedAt: number|null, meta: object}>} */
    this._services = new Map();
    this._bootStart = null;
    this._healthInterval = null;
  }

  /**
   * Register a Latent Service with the registry
   * @param {string} name - Unique service name
   * @param {object} service - Service instance (must have start/stop/health)
   * @param {object} [meta] - Optional metadata (layer, priority, pool)
   */
  register(name, service, meta = {}) {
    if (this._services.has(name)) {
      logger.warn({ service: name }, 'Service already registered — skipping duplicate');
      return this;
    }

    this._services.set(name, {
      service,
      status: SERVICE_STATUS.REGISTERED,
      startedAt: null,
      meta: {
        layer: meta.layer || 'application',
        priority: meta.priority || 5,
        pool: meta.pool || 'warm',
        ...meta,
      },
    });

    logger.info({ service: name, layer: meta.layer }, 'Service registered');
    return this;
  }

  /**
   * Start all registered services in priority order
   * @returns {Promise<{started: string[], failed: string[]}>}
   */
  async startAll() {
    this._bootStart = Date.now();
    const sorted = [...this._services.entries()]
      .sort((a, b) => a[1].meta.priority - b[1].meta.priority);

    const started = [];
    const failed = [];

    for (const [name, entry] of sorted) {
      try {
        entry.status = SERVICE_STATUS.STARTING;
        if (typeof entry.service.start === 'function') {
          await entry.service.start();
        }
        entry.status = SERVICE_STATUS.ACTIVE;
        entry.startedAt = Date.now();
        started.push(name);
        logger.info({ service: name, startMs: entry.startedAt - this._bootStart }, 'Service started');
      } catch (err) {
        entry.status = SERVICE_STATUS.FAILED;
        failed.push(name);
        logger.error({ service: name, error: err.message }, 'Service failed to start');
      }
    }

    const bootMs = Date.now() - this._bootStart;
    logger.info({ started: started.length, failed: failed.length, bootMs }, 'Boot sequence complete');

    // Start periodic health checks at φ-scaled interval
    this._startHealthBroadcast();

    return { started, failed, bootMs };
  }

  /**
   * Stop all services in reverse priority order (graceful shutdown)
   */
  async stopAll() {
    const sorted = [...this._services.entries()]
      .sort((a, b) => b[1].meta.priority - a[1].meta.priority); // reverse

    if (this._healthInterval) clearInterval(this._healthInterval);

    for (const [name, entry] of sorted) {
      try {
        entry.status = SERVICE_STATUS.STOPPING;
        if (typeof entry.service.stop === 'function') {
          await entry.service.stop();
        }
        entry.status = SERVICE_STATUS.STOPPED;
        logger.info({ service: name }, 'Service stopped');
      } catch (err) {
        logger.error({ service: name, error: err.message }, 'Error stopping service');
      }
    }
  }

  /**
   * Collect health from all registered services
   * @returns {object} Aggregated health report
   */
  healthAll() {
    const services = {};
    let healthy = 0;
    let degraded = 0;
    let failed = 0;

    for (const [name, entry] of this._services) {
      let serviceHealth = { status: entry.status };
      
      try {
        if (typeof entry.service.health === 'function') {
          serviceHealth = { ...serviceHealth, ...entry.service.health() };
        }
      } catch (err) {
        serviceHealth.error = err.message;
      }

      services[name] = serviceHealth;

      if (entry.status === SERVICE_STATUS.ACTIVE) healthy++;
      else if (entry.status === SERVICE_STATUS.DEGRADED) degraded++;
      else if (entry.status === SERVICE_STATUS.FAILED) failed++;
    }

    const total = this._services.size;
    const cslScore = total > 0 ? healthy / total : 0;
    const overallStatus = cslScore >= CSL_THRESHOLDS.HIGH ? 'healthy' 
      : cslScore >= CSL_THRESHOLDS.MEDIUM ? 'degraded' 
      : 'critical';

    return {
      status: overallStatus,
      cslScore: Math.round(cslScore * 1000) / 1000,
      totalServices: total,
      healthy,
      degraded,
      failed,
      uptime: process.uptime(),
      services,
    };
  }

  /**
   * Get a registered service by name
   */
  get(name) {
    const entry = this._services.get(name);
    return entry ? entry.service : null;
  }

  /**
   * List all registered services
   */
  list() {
    return [...this._services.entries()].map(([name, entry]) => ({
      name,
      status: entry.status,
      layer: entry.meta.layer,
      priority: entry.meta.priority,
      pool: entry.meta.pool,
      uptime: entry.startedAt ? Date.now() - entry.startedAt : 0,
    }));
  }

  /**
   * Number of registered services
   */
  get size() {
    return this._services.size;
  }

  /**
   * Start periodic health broadcast at φ-scaled interval
   */
  _startHealthBroadcast() {
    const intervalMs = phiMs ? phiMs(PHI_TIMING?.CYCLE || 18000) : Math.round(PHI * 18000);
    this._healthInterval = setInterval(() => {
      const report = this.healthAll();
      logger.info({
        healthReport: true,
        status: report.status,
        cslScore: report.cslScore,
        healthy: report.healthy,
        total: report.totalServices,
      }, 'Health broadcast');
    }, intervalMs);

    // Don't block process exit
    if (this._healthInterval.unref) this._healthInterval.unref();
  }
}

// Singleton instance
const registry = new ServiceRegistry();

module.exports = { ServiceRegistry, registry, SERVICE_STATUS };
