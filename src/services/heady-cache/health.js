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
// ║  FILE: src/services/heady-cache/health.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
'use strict';

/**
 * HeadyCache Health Check Module
 *
 * Provides a detailed health check that can be used by:
 *   - Docker HEALTHCHECK
 *   - Kubernetes liveness / readiness probes
 *   - Cloud Run health checks
 *   - Load balancers
 */

const os = require('os');

/**
 * Perform a comprehensive health check.
 *
 * @param {import('./index').HeadyCache} cache
 * @returns {Promise<{status: 'ok'|'degraded'|'error', checks: object}>}
 */
async function healthCheck(cache) {
  const start = Date.now();
  const checks = {};

  // 1. Process memory
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
  const rssMb = Math.round(mem.rss / 1024 / 1024);
  checks.memory = {
    heapUsedMb,
    rssMb,
    status: heapUsedMb < 512 ? 'ok' : heapUsedMb < 1024 ? 'degraded' : 'error',
  };

  // 2. System memory
  const freeMem = os.freemem();
  const totalMem = os.totalmem();
  const freePercent = Math.round((freeMem / totalMem) * 100);
  checks.system = {
    freeMemMb: Math.round(freeMem / 1024 / 1024),
    totalMemMb: Math.round(totalMem / 1024 / 1024),
    freePercent,
    cpuCount: os.cpus().length,
    status: freePercent > 10 ? 'ok' : 'degraded',
  };

  // 3. Cache read/write roundtrip
  let cacheStatus = 'error';
  let cacheLatencyMs = 0;
  try {
    const cacheStart = Date.now();
    const result = await cache.healthCheck();
    cacheLatencyMs = Date.now() - cacheStart;
    cacheStatus = result.status;
    checks.cache = {
      status: cacheStatus,
      latencyMs: cacheLatencyMs,
      entries: result.entries,
      uptime: result.uptime,
      backend: result.backend,
    };
  } catch (err) {
    checks.cache = { status: 'error', error: err.message };
  }

  // 4. Analytics snapshot
  try {
    const stats = cache.getStats();
    checks.analytics = {
      status: 'ok',
      hitRate: stats.hitRate,
      entries: stats.entries,
      bytes: stats.bytes,
    };
  } catch {
    checks.analytics = { status: 'degraded' };
  }

  // 5. Overall status
  const statuses = Object.values(checks).map((c) => c.status);
  let overallStatus = 'ok';
  if (statuses.some((s) => s === 'error')) overallStatus = 'error';
  else if (statuses.some((s) => s === 'degraded')) overallStatus = 'degraded';

  return {
    status: overallStatus,
    service: 'heady-cache',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - start,
    checks,
  };
}

module.exports = { healthCheck };


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
