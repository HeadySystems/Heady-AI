const { createLogger } = require('../../src/utils/logger');
const logger = createLogger('auto-fixed');
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
// ║  FILE: packages/hc-health/index.js                               ║
// ║  LAYER: packages                                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const os = require('os');
const {
  PHI_CIRCUIT_BREAKER
} = require('../../src/shared/phi-math-v2');

// ═══════════════════════════════════════════════════════════════════
// HC Health — System Health Monitoring and Diagnostics
// Runs health checks against node resources, services, and
// dependencies. Exposes snapshot, history, and diagnosis APIs.
// ═══════════════════════════════════════════════════════════════════

const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
  UNKNOWN: 'unknown'
};
class HCHealth {
  constructor() {
    this.history = [];
    this.checks = new Map();
    this.cronInterval = null;
  }

  /**
   * Register a named health check function.
   * @param {string} name - Check identifier
   * @param {Function} fn - Async function returning { status, message, details? }
   */
  register(name, fn) {
    this.checks.set(name, fn);
  }

  /**
   * Run all registered health checks and return a snapshot.
   */
  async check() {
    const results = {};
    let overallStatus = HEALTH_STATUS.HEALTHY;

    // Built-in system checks
    results.system = this._checkSystem();

    // Run registered checks
    for (const [name, fn] of this.checks) {
      try {
        results[name] = await fn();
      } catch (err) {
        results[name] = {
          status: HEALTH_STATUS.UNHEALTHY,
          message: err.message
        };
      }
    }

    // Derive overall status
    const statuses = Object.values(results).map(r => r.status);
    if (statuses.includes(HEALTH_STATUS.UNHEALTHY)) {
      overallStatus = HEALTH_STATUS.UNHEALTHY;
    } else if (statuses.includes(HEALTH_STATUS.DEGRADED)) {
      overallStatus = HEALTH_STATUS.DEGRADED;
    }
    const snapshot = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: results,
      nodeVersion: process.version,
      uptime: process.uptime()
    };
    this.history.push(snapshot);
    // Keep last 100 entries
    if (this.history.length > 100) this.history.shift();
    return snapshot;
  }

  /**
   * Diagnose system issues and return actionable recommendations.
   */
  async diagnose() {
    const snapshot = await this.check();
    const issues = [];
    const recommendations = [];
    for (const [name, result] of Object.entries(snapshot.checks)) {
      if (result.status === HEALTH_STATUS.UNHEALTHY) {
        issues.push({
          check: name,
          severity: 'critical',
          message: result.message
        });
        recommendations.push(`Fix critical issue in ${name}: ${result.message}`);
      } else if (result.status === HEALTH_STATUS.DEGRADED) {
        issues.push({
          check: name,
          severity: 'warning',
          message: result.message
        });
        recommendations.push(`Investigate degraded state in ${name}: ${result.message}`);
      }
    }
    return {
      snapshot,
      issues,
      recommendations,
      diagnosedAt: new Date().toISOString()
    };
  }

  /**
   * Get the current health snapshot without running checks.
   */
  snapshot() {
    return this.history[this.history.length - 1] || {
      status: HEALTH_STATUS.UNKNOWN,
      checks: {}
    };
  }

  /**
   * Get check history.
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Start periodic health checks.
   * @param {number} intervalMs - Check interval (default 60s)
   */
  startCron(intervalMs = 60000) {
    if (this.cronInterval) return;
    this.cronInterval = setInterval(() => this.check(), intervalMs);
    logger.info(`[hc-health] Cron started: every ${intervalMs}ms`);
  }

  /**
   * Stop periodic health checks.
   */
  stopCron() {
    if (this.cronInterval) {
      clearInterval(this.cronInterval);
      this.cronInterval = null;
      logger.info('[hc-health] Cron stopped.');
    }
  }

  /**
   * Built-in system resource check.
   */
  _checkSystem() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memUsageRatio = 1 - freeMem / totalMem;
    const loadAvg = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const loadPerCore = loadAvg / cpuCount;
    let status = HEALTH_STATUS.HEALTHY;
    const details = {
      memUsageRatio: Math.round(memUsageRatio * 100),
      loadPerCore: loadPerCore.toFixed(2)
    };
    if (memUsageRatio > 0.95 || loadPerCore > 2.0) {
      status = HEALTH_STATUS.UNHEALTHY;
    } else if (memUsageRatio > 0.80 || loadPerCore > 1.0) {
      status = HEALTH_STATUS.DEGRADED;
    }
    return {
      status,
      message: `mem=${details.memUsageRatio}% load/core=${details.loadPerCore}`,
      details
    };
  }
}
module.exports = new HCHealth();
module.exports.HEALTH_STATUS = HEALTH_STATUS;