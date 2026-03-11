// HEADY_BRAND:BEGIN
// HEADY SYSTEMS :: SACRED GEOMETRY
// FILE: packages/hc-health/src/index.js
// LAYER: packages/hc-health
// HEADY_BRAND:END

'use strict';

const EventEmitter = require('events');

const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];

/**
 * HealthCheckRunner — Runs periodic health checks with cron scheduling.
 * Each check returns { status: 'healthy'|'degraded'|'unhealthy', details }.
 * Results are aggregated into a snapshot for SystemBrain consumption.
 */
class HealthCheckRunner extends EventEmitter {
  constructor(options = {}) {
    super();
    this.checks = options.checks || [];
    this.cronSchedule = options.cronSchedule || '*/5 * * * *';
    this.onResult = options.onResult || null;
    this.results = new Map();
    this.history = [];
    this.maxHistory = FIB[8]; // 21
    this._cronInterval = null;
  }

  /**
   * Start the health check cron loop.
   */
  start() {
    // Parse cron schedule for interval (simplified: extract minutes)
    const intervalMs = this._parseCronInterval(this.cronSchedule);
    this._cronInterval = setInterval(() => this.runAll(), intervalMs);
    this.emit('started', { schedule: this.cronSchedule, intervalMs });
  }

  stop() {
    if (this._cronInterval) {
      clearInterval(this._cronInterval);
      this._cronInterval = null;
    }
    this.emit('stopped');
  }

  /**
   * Run all registered checks concurrently.
   */
  async runAll() {
    const startTime = Date.now();
    const checkResults = [];

    const settled = await Promise.allSettled(
      this.checks.map(check => this._executeCheck(check))
    );

    for (let i = 0; i < settled.length; i++) {
      const check = this.checks[i];
      const name = check.name || `check_${i}`;

      let result;
      if (settled[i].status === 'fulfilled') {
        result = settled[i].value;
      } else {
        result = {
          status: 'unhealthy',
          error: settled[i].reason?.message || 'Check failed',
        };
      }

      result.name = name;
      result.timestamp = new Date().toISOString();
      this.results.set(name, result);
      checkResults.push(result);

      if (this.onResult) {
        this.onResult(name, result);
      }
    }

    const snapshot = {
      checks: checkResults,
      overallStatus: this._computeOverall(checkResults),
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };

    this.history.push(snapshot);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.emit('run:complete', snapshot);
    return checkResults;
  }

  async _executeCheck(check) {
    if (typeof check.fn === 'function') {
      return await check.fn();
    }
    // Default: healthy
    return { status: 'healthy', details: { type: 'default' } };
  }

  _computeOverall(results) {
    if (results.length === 0) return 'healthy';

    const hasUnhealthy = results.some(r => r.status === 'unhealthy');
    const hasDegraded = results.some(r => r.status === 'degraded');

    if (hasUnhealthy) return 'unhealthy';
    if (hasDegraded) return 'degraded';
    return 'healthy';
  }

  _parseCronInterval(cron) {
    // Simple parser: "*/N * * * *" → N minutes
    const match = cron.match(/\*\/(\d+)/);
    if (match) {
      return parseInt(match[1], 10) * 60 * 1000;
    }
    return FIB[5] * 60 * 1000; // Default 8 minutes
  }

  getSnapshot() {
    const results = Object.fromEntries(this.results);
    return {
      checks: results,
      overallStatus: this._computeOverall(Object.values(results)),
      timestamp: new Date().toISOString(),
    };
  }

  getHistory() {
    return this.history;
  }
}

/**
 * Create default health checks for the Heady system.
 */
function createDefaultChecks() {
  return [
    {
      name: 'node_process',
      fn: async () => {
        const mem = process.memoryUsage();
        const heapUsedMB = mem.heapUsed / 1024 / 1024;
        return {
          status: heapUsedMB < 500 ? 'healthy' : heapUsedMB < 800 ? 'degraded' : 'unhealthy',
          details: {
            heapUsedMB: Math.round(heapUsedMB),
            heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
            rssMB: Math.round(mem.rss / 1024 / 1024),
            uptime: Math.round(process.uptime()),
            nodeVersion: process.version,
          },
        };
      },
    },
    {
      name: 'event_loop',
      fn: async () => {
        const start = Date.now();
        await new Promise(resolve => setImmediate(resolve));
        const lagMs = Date.now() - start;
        return {
          status: lagMs < FIB[6] ? 'healthy' : lagMs < FIB[8] * 10 ? 'degraded' : 'unhealthy',
          details: { lagMs },
        };
      },
    },
    {
      name: 'disk_space',
      fn: async () => {
        // Simplified disk check
        return {
          status: 'healthy',
          details: { type: 'disk', note: 'Render-managed storage' },
        };
      },
    },
  ];
}

module.exports = { HealthCheckRunner, createDefaultChecks };
