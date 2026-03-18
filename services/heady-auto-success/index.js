/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  heady-auto-success — Service Entry Point                              ║
 * ║  Auto-Success Engine — φ⁷-cycle (29,034ms) background task orchestratio                                                  ║
 * ║  © 2026 HeadySystems Inc. — 60+ Provisional Patents             ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Domain:    headysystems.com
 * Port:      3334
 * Upstreams: heady-manager
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

const SERVICE_NAME = 'heady-auto-success';
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

// Upstream: heady-manager
health.register('heady-manager', async () => {
  const url = process.env['HEADY_MANAGER_URL'];
  if (!url) return { status: 'degraded', message: 'Env var HEADY_MANAGER_URL not set' };
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), TIMEOUTS.PHI_3);
    const r = await fetch(`${url}/health/live`, { signal: controller.signal });
    clearTimeout(t);
    return { status: r.ok ? 'healthy' : 'degraded', message: `heady-manager returned ${r.status}` };
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
 * GET /status
 * Service identity and phi-context summary.
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
      cycle_ms:    AUTO_SUCCESS_CYCLE_MS, // 29034 ms
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /process
 * Primary service endpoint. Executes within an OTLP-traced span
 * with phi-context attributes attached.
 */
app.post('/process', async (req, res, next) => {
  const start = Date.now();
  metrics.requestCounter.add(1, { service: SERVICE_NAME });

  try {
    const result = await headySpan(tracer, `${SERVICE_NAME}.process`, {
      confidence: PSI,
      coherence:  CSL_THRESHOLDS.HIGH,
      domain:     req.headyDomain ?? config.domain,
      pipelineStage: req.body?.stage ?? 'unknown',
    }, async (span) => {
      // ── Service-specific logic ──────────────────────────────────────
      const input = req.body ?? {};

      // Validate input CSL confidence gate
      const inputConfidence = input.confidence ?? PSI;
      if (inputConfidence < CSL_THRESHOLDS.PASS) {
        const err = new Error(`Input confidence ${inputConfidence.toFixed(3)} below CSL gate ψ = ${PSI.toFixed(3)}`);
        err.status = 422;
        throw err;
      }

      // Service-specific processing goes here
      const output = {
        service:    SERVICE_NAME,
        input_keys: Object.keys(input),
        processed:  true,
        confidence: PSI,
        domain:     config.domain,
      };

      span.setAttribute('heady.output.keys', Object.keys(output).join(','));
      return output;
    });

    const latencyMs = Date.now() - start;
    metrics.latencyHistogram.record(latencyMs, { service: SERVICE_NAME });

    res.json({
      success: true,
      data: result,
      latency_ms: latencyMs,
      phi_context: { confidence: PSI, domain: config.domain },
    });
  } catch (err) {
    next(err);
  }
});

// ─── ERROR HANDLER (last middleware, after all routes) ───────────────────────

app.use(headyErrorHandler(logger));

// ─── SERVER STARTUP ───────────────────────────────────────────────────────────

const server = app.listen(config.port, () => {
  logHealthEvent(logger, 'startup', true, {
    port: config.port,
    domain: config.domain,
    phi_cycle_ms: AUTO_SUCCESS_CYCLE_MS,
    csl_threshold: CSL_THRESHOLDS.PASS,
  });
  logger.info({ event: 'service.started', port: config.port, domain: config.domain },
    `${SERVICE_NAME} listening on :${config.port}`);
  health.markReady();
});

// Graceful shutdown — φ⁶ × 1000 = 17,944 ms window
async function gracefulShutdown(signal) {
  logger.info({ event: 'service.shutdown', signal }, `Graceful shutdown initiated (${signal})`);
  const shutdownTimeout = setTimeout(() => process.exit(1), config.timeout.shutdown);

  server.close(async () => {
    clearTimeout(shutdownTimeout);
    logger.info({ event: 'service.shutdown.complete' }, `${SERVICE_NAME} shutdown complete`);
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// Unhandled rejection safety net (Law #1: every async has error handling)
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ event: 'unhandled_rejection', reason: String(reason) },
    'Unhandled Promise rejection — this is a Law #1 violation, fix immediately');
  process.exit(1); // Force crash to trigger health check failure → restart
});

export { app, server, health, config };
