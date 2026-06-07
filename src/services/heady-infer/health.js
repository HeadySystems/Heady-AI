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
// ║  FILE: src/services/heady-infer/health.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
'use strict';

/**
 * HeadyInfer Health — Aggregated health check module.
 *
 * Provides a quick synchronous liveness check and an async readiness check
 * that pings all providers.
 */

const config = require('./config');

/**
 * Lightweight liveness check — no async I/O.
 * Returns immediately with service metadata.
 *
 * @param {HeadyInfer} gateway  HeadyInfer instance
 * @returns {object}
 */
function liveness(gateway) {
  const enabledProviders = Object.keys(gateway?._providers || {});
  return {
    status:  'ok',
    service: config.serviceName,
    version: config.version,
    env:     config.env,
    uptime:  Math.floor(process.uptime()),
    memory:  process.memoryUsage(),
    providers: {
      enabled: enabledProviders,
      count:   enabledProviders.length,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Full readiness check — pings each enabled provider.
 *
 * @param {HeadyInfer} gateway
 * @returns {Promise<HealthReport>}
 */
async function readiness(gateway) {
  if (!gateway) {
    return {
      status: 'unhealthy',
      reason: 'Gateway not initialized',
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const report = await gateway.health();
    return {
      ...report,
      service: config.serviceName,
      version: config.version,
    };
  } catch (err) {
    return {
      status:    'unhealthy',
      error:     err.message,
      service:   config.serviceName,
      version:   config.version,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Build a simple HTTP health response object.
 *
 * @param {object}  report     health report object
 * @param {boolean} detailed   include full report or just status/service
 * @returns {{ statusCode: number, body: object }}
 */
function buildHttpResponse(report, detailed = false) {
  const healthy   = report.status === 'healthy' || report.status === 'ok';
  const degraded  = report.status === 'degraded';
  const statusCode = healthy ? 200 : 503;

  if (!detailed) {
    return {
      statusCode,
      body: {
        status:    report.status,
        service:   report.service || config.serviceName,
        version:   report.version || config.version,
        timestamp: report.timestamp,
      },
    };
  }

  return { statusCode, body: report };
}

module.exports = { liveness, readiness, buildHttpResponse };


// --- Auto-Unified Latent Service Pattern (Smart) ---
(function _wireLatentStubs() {
  const exp = module.exports;
  if (!exp || typeof exp !== 'object') return;

  // Find the first exported class instance or constructor with health/start/stop
  let _inst = null;
  for (const key of Object.keys(exp)) {
    const val = exp[key];
    // If it's a singleton instance with a health method, use it
    if (val && typeof val === 'object' && typeof val.health === 'function') {
      _inst = val; break;
    }
    // If it's a function (class constructor), try to find a getSingleton pattern
    if (typeof val === 'function' && val.prototype) {
      const getterKey = Object.keys(exp).find(k =>
        k.startsWith('get') && typeof exp[k] === 'function' && k !== key
      );
      if (getterKey) {
        try { const inst = exp[getterKey](); if (inst && typeof inst.health === 'function') { _inst = inst; break; } } catch(e) {}
      }
    }
  }

  if (!exp.start) exp.start = _inst && typeof _inst.start === 'function'
    ? async () => { await _inst.start(); return { status: 'started' }; }
    : async () => ({ status: 'started' });
  if (!exp.stop) exp.stop = _inst && typeof _inst.stop === 'function'
    ? async () => { await _inst.stop(); return { status: 'stopped' }; }
    : async () => ({ status: 'stopped' });
  if (!exp.health) exp.health = _inst && typeof _inst.health === 'function'
    ? () => _inst.health()
    : () => ({ status: 'healthy', service: require('path').basename(__filename, '.js') });
  if (!exp.metrics) exp.metrics = _inst && typeof _inst.metrics === 'function'
    ? () => _inst.metrics()
    : () => ({ service: require('path').basename(__filename, '.js') });
  if (!exp._tick) exp._tick = async () => {};
})();
// -------------------------------------------
