/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  heady-sims — Service Entry Point                               ║
 * ║  HeadySims — Multi-scenario simulation engine with replay       ║
 * ║  © 2026 HeadySystems Inc. — 60+ Provisional Patents             ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Domain:    headysystems.com
 * Port:      3341
 * Upstreams: heady-mc, heady-brain
 *
 * Middleware stack (in order):
 *   1. OpenTelemetry tracing init
 *   2. headyRequestId — trace/request ID propagation
 *   3. headyAutoContext — phi-context enrichment
 *   4. headyCslDomain — CSL domain matching across concurrent-equals domains
 *   5. headyAccessLog — structured pino JSON logging
 *   6. headyRateLimit — φ-scaled token bucket
 *   7. headySecurityHeaders — zero-trust headers
 *   8. [service-specific routes]
 *   9. headyErrorHandler — typed error handling
 *
 * Health endpoints:
 *   GET /health           — combined status
 *   GET /health/live      — Kubernetes liveness
 *   GET /health/ready     — Kubernetes readiness
 *   GET /health/startup   — Kubernetes startup
 *   GET /health/details   — phi-enriched full detail
 */

'use strict';

import express from 'express';
import {
  loadConfig,
  createLogger, logHealthEvent,
  initOtel, getTracer, createMetrics, headySpan,
  HealthRegistry, memoryCheck, envCheck,
  headyRequestId, headyAutoContext, headyCslDomain,
  headyAccessLog, headyRateLimit, headySecurityHeaders, headyErrorHandler,
  PSI, CSL_THRESHOLDS, TIMEOUTS, AUTO_SUCCESS_CYCLE_MS,
} from '@heady/platform';

// ─── BOOTSTRAP ────────────────────────────────────────────────────────────────

const SERVICE_NAME = 'heady-sims';
const config = loadConfig(SERVICE_NAME);
const logger = createLogger({
  service: SERVICE_NAME,
  domain:  config.domain,
  level:   process.env.LOG_LEVEL ?? 'info',
});

// Initialize OpenTelemetry BEFORE any imports that instrument
await initOtel({ service: SERVICE_NAME, domain: config.domain });
const tracer  = getTracer(SERVICE_NAME);
const metrics = createMetrics(SERVICE_NAME);

// ─── HEALTH REGISTRY ──────────────────────────────────────────────────────────

const health = new HealthRegistry({
  service: SERVICE_NAME,
  version: config.version,
  domain:  config.domain,
});

// Memory check (degraded if heap ratio > ψ = 0.618)
health.register('memory', memoryCheck());

// Required environment variables
health.register('env', envCheck([
  'SERVICE_NAME', 'SERVICE_VERSION', 'HEADY_DOMAIN', 'NODE_ENV',
]));

// Upstream: heady-mc
health.register('heady-mc', async () => {
  const url = process.env['HEADY_MC_URL'];
  if (!url) return { status: 'degraded', message: 'Env var HEADY_MC_URL not set' };
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), TIMEOUTS.PHI_3);
    const r = await fetch(`${url}/health/live`, { signal: controller.signal });
    clearTimeout(t);
    return { status: r.ok ? 'healthy' : 'degraded', message: `heady-mc returned ${r.status}` };
  } catch (err) {
    return { status: 'unhealthy', message: err.message };
  }
});

// Upstream: heady-brain
health.register('heady-brain', async () => {
  const url = process.env['HEADY_BRAIN_URL'];
  if (!url) return { status: 'degraded', message: 'Env var HEADY_BRAIN_URL not set' };
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), TIMEOUTS.PHI_3);
    const r = await fetch(`${url}/health/live`, { signal: controller.signal });
    clearTimeout(t);
    return { status: r.ok ? 'healthy' : 'degraded', message: `heady-brain returned ${r.status}` };
  } catch (err) {
    return { status: 'unhealthy', message: err.message };
  }
});


// ─── EXPRESS APP ─────────────────────────────────────────────────────────────

const app = express();

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// ── Middleware stack ──
app.use(headyRequestId());
app.use(headyAutoContext());           // HeadyAutoContext hooks
app.use(headyCslDomain([], null));     // CSL domain matching across concurrent-equals domains
app.use(headyAccessLog(logger));
app.use(headyRateLimit({
  windowMs:    config.rateLimit.windowMs,
  maxRequests: config.rateLimit.maxRequests,
  burst:       config.rateLimit.burst,
}));
app.use(headySecurityHeaders());

// ── Health routes ──
health.attachRoutes(app);

// ─── SERVICE ROUTES ───────────────────────────────────────────────────────────

/**
 * GET /status — Service identity and phi-context summary.
 */
app.get('/status', (req, res) => {
  res.json({
    service:     SERVICE_NAME,
    version:     config.version,
    domain:      config.domain,
    status:      'running',
    phi_context: {
      phi:         PSI + 1,              // φ = 1.618...
      confidence:  PSI,                  // ψ = 0.618
      coherence:   CSL_THRESHOLDS.HIGH,  // 0.882
    },
    liquid_node: {
      tier: 'warm',
      event_spine: {
        subscribe: ['mc:simulation-complete', 'pipeline:request-simulation', 'battle:scenario-request'],
        publish: ['sims:result', 'sims:replay-available', 'sims:scenario-complete'],
      },
    },
  });
});

// ─── SIMULATION STATE ─────────────────────────────────────────────────────────

const simulations = new Map();
const replayBuffer = [];                // Circular buffer, max fib(13) = 233 entries
const MAX_REPLAY = 233;

/**
 * POST /simulate — Run a multi-scenario simulation.
 * Body: { scenario, iterations?, params?, deterministic_seed? }
 */
app.post('/simulate', async (req, res) => {
  return headySpan(tracer, 'sims.simulate', async (span) => {
    const startMs = Date.now();
    const { scenario, iterations = 89, params = {}, deterministic_seed = 42 } = req.body;

    if (!scenario) {
      return res.status(400).json({ error: 'scenario is required' });
    }

    const simId = crypto.randomUUID();
    span.setAttribute('sim.id', simId);
    span.setAttribute('sim.scenario', scenario);
    span.setAttribute('sim.iterations', iterations);

    logger.info({ simId, scenario, iterations }, 'Simulation started');

    const outcomes = [];
    for (let i = 0; i < iterations; i++) {
      const seed = `${deterministic_seed}-${scenario}-${i}-${JSON.stringify(params)}`;
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
      const arr = new Uint32Array(hash);
      const value = arr[0] / 0xFFFFFFFF;
      outcomes.push({ iteration: i, value, seed_hash: arr[0].toString(16) });
    }

    // Statistical analysis
    const values = outcomes.map(o => o.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const sorted = [...values].sort((a, b) => a - b);

    const result = {
      simId,
      scenario,
      iterations,
      statistics: {
        mean: Math.round(mean * 10000) / 10000,
        variance: Math.round(variance * 10000) / 10000,
        stdDev: Math.round(stdDev * 10000) / 10000,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
      },
      risk_profile: {
        level: stdDev > PSI ? 'HIGH' : stdDev > (PSI * PSI) ? 'MEDIUM' : 'LOW',
        confidence: Math.max(0, Math.round((1 - stdDev) * 10000) / 10000),
      },
      latency_ms: Date.now() - startMs,
      timestamp: new Date().toISOString(),
    };

    simulations.set(simId, result);
    metrics.simulationsRun?.add(1);

    // Add to replay buffer (circular)
    replayBuffer.push({ simId, scenario, timestamp: result.timestamp });
    if (replayBuffer.length > MAX_REPLAY) replayBuffer.shift();

    logger.info({ simId, scenario, mean: result.statistics.mean, risk: result.risk_profile.level }, 'Simulation complete');
    res.json(result);
  });
});

/**
 * POST /simulate/batch — Run multiple scenarios in parallel.
 * Body: { scenarios: [{ scenario, iterations?, params? }] }
 */
app.post('/simulate/batch', async (req, res) => {
  const { scenarios = [] } = req.body;
  if (scenarios.length === 0) {
    return res.status(400).json({ error: 'scenarios array is required' });
  }

  const results = await Promise.all(
    scenarios.map(async (s) => {
      const simReq = { body: s };
      const simRes = { json: (data) => data, status: () => ({ json: (d) => d }) };
      // Re-use simulate handler internally
      return new Promise((resolve) => {
        app.handle({ ...simReq, method: 'POST', url: '/simulate' }, simRes, () => resolve(null));
      });
    })
  );

  res.json({ batch_size: scenarios.length, results, timestamp: new Date().toISOString() });
});

/**
 * GET /replay — Get replay buffer (last 233 simulations).
 */
app.get('/replay', (req, res) => {
  res.json({ buffer_size: replayBuffer.length, max_size: MAX_REPLAY, replays: replayBuffer });
});

/**
 * GET /simulation/:simId — Get a specific simulation result.
 */
app.get('/simulation/:simId', (req, res) => {
  const result = simulations.get(req.params.simId);
  if (!result) return res.status(404).json({ error: 'Simulation not found' });
  res.json(result);
});

// ── Error handler (must be last) ──
app.use(headyErrorHandler(logger));

// ─── SERVER ──────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? config.port ?? 3341);

app.listen(PORT, '0.0.0.0', () => {
  logHealthEvent(logger, SERVICE_NAME, 'started', { port: PORT, domain: config.domain });
  logger.info({ port: PORT }, `${SERVICE_NAME} Liquid Node listening`);
});
