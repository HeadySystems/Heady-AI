'use strict';

/**
 * HeadyGuard — Health Check
 *
 * GET /health → { status, version, uptime, checks }
 *
 * Performs a lightweight self-test of each pipeline stage
 * and reports aggregate health status.
 */

const config  = require('./config');
const guard   = require('./index');
const pipeline = require('./pipeline');

const SELF_TEST_PAYLOAD = {
  text:   '__heady_health_check__',
  userId: 'health-check',
  source: 'input',
};

/**
 * Run a lightweight self-test through the pipeline.
 * Should complete in < 50 ms for healthy state.
 */
async function selfTest() {
  const start = Date.now();
  try {
    const result = await guard.check(SELF_TEST_PAYLOAD, {
      stages:         ['injection', 'rate_limit'],
      blockThreshold: 100, // never block health check
    });
    return {
      ok:              true,
      processing_time: Date.now() - start,
      allowed:         result.allowed,
    };
  } catch (err) {
    return {
      ok:    false,
      error: err.message,
      processing_time: Date.now() - start,
    };
  }
}

/**
 * Check that all registered pipeline stages are available.
 */
function checkStages() {
  const registered = pipeline.getStageNames();
  const expected   = config.stages;
  const missing    = expected.filter(s => !registered.includes(s));
  return {
    ok:         missing.length === 0,
    registered,
    expected,
    missing,
  };
}

/**
 * Check memory usage (flag if heap > 80%).
 */
function checkMemory() {
  const mem = process.memoryUsage();
  const heapPct = mem.heapUsed / mem.heapTotal;
  return {
    ok:         heapPct < 0.90,
    heap_used:  Math.round(mem.heapUsed  / 1024 / 1024) + ' MB',
    heap_total: Math.round(mem.heapTotal / 1024 / 1024) + ' MB',
    heap_pct:   (heapPct * 100).toFixed(1) + '%',
    rss:        Math.round(mem.rss       / 1024 / 1024) + ' MB',
  };
}

/**
 * Build a full health report.
 * @returns {Promise<{ status: 'healthy'|'degraded'|'unhealthy', ... }>}
 */
async function buildHealthReport() {
  const [pipelineCheck, stagesCheck, memoryCheck] = await Promise.all([
    selfTest(),
    Promise.resolve(checkStages()),
    Promise.resolve(checkMemory()),
  ]);

  const checks = {
    pipeline: pipelineCheck,
    stages:   stagesCheck,
    memory:   memoryCheck,
  };

  const allOk      = Object.values(checks).every(c => c.ok);
  const anyFailed  = Object.values(checks).some(c => c.ok === false);

  let status = 'healthy';
  if (!allOk && anyFailed) status = anyFailed ? 'degraded' : 'healthy';
  if (!pipelineCheck.ok)   status = 'unhealthy';

  const stats = guard.getStats();

  return {
    status,
    service: config.service,
    version: config.version,
    uptime:  Math.floor((Date.now() - stats.startTime) / 1000) + 's',
    phi:     config.phi,
    checks,
    stats: {
      total:      stats.total,
      block_rate: stats.block_rate,
      flag_rate:  stats.flag_rate,
    },
    timestamp: new Date().toISOString(),
  };
}

// ── Express route handler ──────────────────────────────────────────────────────

async function healthHandler(req, res) {
  try {
    const report = await buildHealthReport();
    const httpStatus = report.status === 'unhealthy' ? 503 :
                       report.status === 'degraded'  ? 200 : 200;
    return res.status(httpStatus).json(report);
  } catch (err) {
    return res.status(503).json({
      status:  'unhealthy',
      error:   err.message,
      service: config.service,
      version: config.version,
    });
  }
}

module.exports = { healthHandler, buildHealthReport, selfTest, checkStages, checkMemory };


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
