/**
 * @fileoverview Graceful Lifecycle Manager — Ecosystem Startup and Shutdown
 * @description Manages ecosystem-wide boot order respecting Sacred Geometry layers
 * (Center first, then Inner, Middle, Outer, Governance). LIFO shutdown.
 * Health gates between layers ensure dependent services are ready.
 * @module graceful-lifecycle
 */

'use strict';

const {
  PHI, PSI, PHI_SQUARED, FIB, CSL, CSL_ERROR_CODES,
  SACRED_GEOMETRY, INTERVALS,
  phiBackoff, adaptiveInterval, correlationId, structuredLog,
} = require('./phi-constants');

// ─── LIFECYCLE STATES ────────────────────────────────────────────────────────

/**
 * @enum {string} LifecycleState
 */
const LifecycleState = {
  COLD: 'COLD',
  BOOTING: 'BOOTING',
  HEALTHY: 'HEALTHY',
  DEGRADED: 'DEGRADED',
  SHUTTING_DOWN: 'SHUTTING_DOWN',
  STOPPED: 'STOPPED',
};

// ─── BOOT ORDER ──────────────────────────────────────────────────────────────

/**
 * @constant {string[]} BOOT_ORDER - Sacred Geometry layer boot order
 * Center boots first (foundation), then outward to Governance
 */
const BOOT_ORDER = ['CENTER', 'INNER_RING', 'MIDDLE_RING', 'OUTER_RING', 'GOVERNANCE'];

/**
 * @constant {string[]} SHUTDOWN_ORDER - LIFO shutdown (reverse of boot)
 */
const SHUTDOWN_ORDER = [...BOOT_ORDER].reverse();

// ─── SERVICE HANDLE ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} ServiceHandle
 * @property {string} id - Service identifier
 * @property {string} ring - Sacred Geometry ring
 * @property {Function} start - Async start function
 * @property {Function} stop - Async stop function
 * @property {Function} health - Health check function returning {status, coherence}
 * @property {number} [priority] - Boot priority within ring (lower = first)
 */

// ─── LAYER GATE ──────────────────────────────────────────────────────────────

/**
 * @class LayerGate
 * @description Health gate that blocks until a layer reaches minimum coherence
 */
class LayerGate {
  /**
   * @param {string} layerName
   * @param {number} minCoherence - Minimum CSL for gate to pass
   * @param {number} timeoutMs - Gate timeout
   */
  constructor(layerName, minCoherence, timeoutMs) {
    this.layerName = layerName;
    this.minCoherence = minCoherence;
    this.timeoutMs = timeoutMs;
    this.passed = false;
    this.coherence = 0;
  }

  /**
   * Wait for the gate to pass
   * @param {Function} checkFn - Async function returning current coherence
   * @returns {Promise<boolean>} True if gate passed
   */
  async wait(checkFn) {
    const start = Date.now();
    const pollInterval = FIB[5] * 100; // 500ms

    while (Date.now() - start < this.timeoutMs) {
      this.coherence = await checkFn();
      if (this.coherence >= this.minCoherence) {
        this.passed = true;
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    return false;
  }
}

// ─── GRACEFUL LIFECYCLE MANAGER ──────────────────────────────────────────────

/**
 * @class GracefulLifecycle
 * @description Manages ecosystem startup/shutdown with Sacred Geometry layer ordering
 */
class GracefulLifecycle {
  /**
   * @param {Object} [config={}]
   * @param {number} [config.gateTimeoutMs] - Per-layer gate timeout (default: FIB[10]*1000 = 55s)
   * @param {number} [config.gateMinCoherence] - Min coherence to pass gate (default: CSL.LOW)
   * @param {number} [config.serviceStartTimeoutMs] - Per-service start timeout
   * @param {number} [config.serviceStopTimeoutMs] - Per-service stop timeout
   * @param {Object} [config.eventBus] - LiquidEventBus instance
   */
  constructor(config = {}) {
    /** @private */
    this._config = {
      gateTimeoutMs: config.gateTimeoutMs || FIB[10] * 1000,
      gateMinCoherence: config.gateMinCoherence || CSL.LOW,
      serviceStartTimeoutMs: config.serviceStartTimeoutMs || FIB[9] * 1000,
      serviceStopTimeoutMs: config.serviceStopTimeoutMs || FIB[8] * 1000,
      eventBus: config.eventBus || null,
    };

    /** @private {Map<string, ServiceHandle[]>} Services by ring */
    this._layers = new Map();
    for (const ring of BOOT_ORDER) {
      this._layers.set(ring, []);
    }

    /** @private */
    this._state = LifecycleState.COLD;
    this._corrId = correlationId('life');
    this._bootLog = [];
    this._shutdownLog = [];

    /** @private */
    this._stats = {
      totalServices: 0,
      startedServices: 0,
      failedStarts: 0,
      stoppedServices: 0,
      failedStops: 0,
      bootDuration: 0,
      shutdownDuration: 0,
    };
  }

  /**
   * Register a service for lifecycle management
   * @param {ServiceHandle} handle
   */
  register(handle) {
    const ring = handle.ring || 'OUTER_RING';
    const layer = this._layers.get(ring);
    if (!layer) {
      throw new Error(`${CSL_ERROR_CODES.E_BELOW_MINIMUM.code}: Unknown ring '${ring}'`);
    }
    layer.push(handle);
    // Sort by priority within ring (lower = first)
    layer.sort((a, b) => (a.priority || FIB[11]) - (b.priority || FIB[11]));
    this._stats.totalServices++;
  }

  /**
   * Boot the entire ecosystem in Sacred Geometry order
   * @returns {Promise<Object>} Boot report
   */
  async boot() {
    if (this._state !== LifecycleState.COLD && this._state !== LifecycleState.STOPPED) {
      throw new Error(`${CSL_ERROR_CODES.E_PIPELINE_FAILED.code}: Cannot boot from state '${this._state}'`);
    }

    this._state = LifecycleState.BOOTING;
    this._bootLog = [];
    const bootStart = Date.now();

    this._log('info', 'Ecosystem boot sequence initiated');
    this._emitEvent('lifecycle.boot.start', { order: BOOT_ORDER });

    for (const ring of BOOT_ORDER) {
      const layerStart = Date.now();
      this._log('info', `Booting layer: ${ring}`);
      this._emitEvent('lifecycle.layer.start', { ring });

      const services = this._layers.get(ring);
      const results = await this._startLayer(ring, services);

      this._bootLog.push({
        ring,
        duration: Date.now() - layerStart,
        services: results,
      });

      // Health gate before proceeding to next layer
      if (BOOT_ORDER.indexOf(ring) < BOOT_ORDER.length - 1) {
        const gate = new LayerGate(ring, this._config.gateMinCoherence, this._config.gateTimeoutMs);
        const passed = await gate.wait(async () => {
          return this._computeLayerCoherence(services);
        });

        if (!passed) {
          this._log('warn', `Health gate for '${ring}' did not reach min coherence — continuing with degraded state`);
        }

        this._emitEvent('lifecycle.gate.result', {
          ring,
          passed,
          coherence: gate.coherence,
          required: this._config.gateMinCoherence,
        });
      }
    }

    this._stats.bootDuration = Date.now() - bootStart;
    this._state = this._stats.failedStarts > 0 ? LifecycleState.DEGRADED : LifecycleState.HEALTHY;

    this._log('info', `Boot complete in ${this._stats.bootDuration}ms — state: ${this._state}`);
    this._emitEvent('lifecycle.boot.complete', {
      state: this._state,
      duration: this._stats.bootDuration,
      started: this._stats.startedServices,
      failed: this._stats.failedStarts,
    });

    return {
      state: this._state,
      duration: this._stats.bootDuration,
      layers: this._bootLog,
      stats: { ...this._stats },
    };
  }

  /**
   * Shutdown the entire ecosystem in LIFO order
   * @returns {Promise<Object>} Shutdown report
   */
  async shutdown() {
    if (this._state === LifecycleState.COLD || this._state === LifecycleState.STOPPED) {
      return { state: this._state, message: 'Already stopped' };
    }

    this._state = LifecycleState.SHUTTING_DOWN;
    this._shutdownLog = [];
    const shutdownStart = Date.now();

    this._log('info', 'Ecosystem shutdown sequence initiated (LIFO)');
    this._emitEvent('lifecycle.shutdown.start', { order: SHUTDOWN_ORDER });

    for (const ring of SHUTDOWN_ORDER) {
      const layerStart = Date.now();
      this._log('info', `Shutting down layer: ${ring}`);

      const services = this._layers.get(ring);
      // Reverse order within layer for LIFO
      const reversed = [...services].reverse();
      const results = await this._stopLayer(ring, reversed);

      this._shutdownLog.push({
        ring,
        duration: Date.now() - layerStart,
        services: results,
      });
    }

    this._stats.shutdownDuration = Date.now() - shutdownStart;
    this._state = LifecycleState.STOPPED;

    this._log('info', `Shutdown complete in ${this._stats.shutdownDuration}ms`);
    this._emitEvent('lifecycle.shutdown.complete', {
      duration: this._stats.shutdownDuration,
      stopped: this._stats.stoppedServices,
      failed: this._stats.failedStops,
    });

    return {
      state: this._state,
      duration: this._stats.shutdownDuration,
      layers: this._shutdownLog,
      stats: { ...this._stats },
    };
  }

  /**
   * Start all services in a layer
   * @private
   */
  async _startLayer(ring, services) {
    const results = [];

    for (const handle of services) {
      const serviceStart = Date.now();
      try {
        await this._withTimeout(handle.start(), this._config.serviceStartTimeoutMs);
        this._stats.startedServices++;
        results.push({
          id: handle.id,
          status: 'started',
          duration: Date.now() - serviceStart,
        });
      } catch (err) {
        this._stats.failedStarts++;
        this._log('error', `Failed to start '${handle.id}' in ${ring}: ${err.message}`);
        results.push({
          id: handle.id,
          status: 'failed',
          error: err.message,
          duration: Date.now() - serviceStart,
        });
      }
    }

    return results;
  }

  /**
   * Stop all services in a layer
   * @private
   */
  async _stopLayer(ring, services) {
    const results = [];

    for (const handle of services) {
      const serviceStart = Date.now();
      try {
        await this._withTimeout(handle.stop(), this._config.serviceStopTimeoutMs);
        this._stats.stoppedServices++;
        results.push({
          id: handle.id,
          status: 'stopped',
          duration: Date.now() - serviceStart,
        });
      } catch (err) {
        this._stats.failedStops++;
        this._log('error', `Failed to stop '${handle.id}' in ${ring}: ${err.message}`);
        results.push({
          id: handle.id,
          status: 'failed',
          error: err.message,
          duration: Date.now() - serviceStart,
        });
      }
    }

    return results;
  }

  /**
   * Compute average coherence for a layer's services
   * @private
   */
  async _computeLayerCoherence(services) {
    if (services.length === 0) return 1.0;
    let total = 0;
    let count = 0;

    for (const handle of services) {
      try {
        const h = typeof handle.health === 'function' ? handle.health() : { coherence: CSL.HIGH };
        total += h.coherence || 0;
        count++;
      } catch {
        // Service health check failed — contributes 0
        count++;
      }
    }

    return count > 0 ? total / count : 0;
  }

  /**
   * Promise with timeout
   * @private
   */
  _withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${CSL_ERROR_CODES.E_TIMEOUT.code}: Operation timed out after ${ms}ms`));
      }, ms);
      Promise.resolve(promise)
        .then(result => { clearTimeout(timer); resolve(result); })
        .catch(err => { clearTimeout(timer); reject(err); });
    });
  }

  /**
   * Emit lifecycle event via event bus
   * @private
   */
  _emitEvent(type, payload) {
    if (this._config.eventBus) {
      this._config.eventBus.publish('system', type, payload, {
        correlationId: this._corrId,
        source: 'GracefulLifecycle',
      });
    }
  }

  /**
   * Log helper
   * @private
   */
  _log(level, message, meta = {}) {
    // Structured log entry (can be connected to external logging)
    structuredLog(level, 'GracefulLifecycle', message, meta, this._corrId);
  }

  /**
   * Get current lifecycle state
   * @returns {string}
   */
  getState() {
    return this._state;
  }

  /**
   * Get health status
   * @returns {Object}
   */
  health() {
    const isHealthy = this._state === LifecycleState.HEALTHY;
    const coherence = isHealthy ? CSL.HIGH :
      this._state === LifecycleState.DEGRADED ? CSL.LOW :
      CSL.MINIMUM;

    return {
      status: isHealthy ? 'healthy' : this._state.toLowerCase(),
      coherence: parseFloat(coherence.toFixed(FIB[4])),
      state: this._state,
      totalServices: this._stats.totalServices,
      startedServices: this._stats.startedServices,
      bootDuration: this._stats.bootDuration,
      shutdownDuration: this._stats.shutdownDuration,
      phi: PHI,
    };
  }
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

module.exports = {
  GracefulLifecycle,
  LayerGate,
  LifecycleState,
  BOOT_ORDER,
  SHUTDOWN_ORDER,
};
