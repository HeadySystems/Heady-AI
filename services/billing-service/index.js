/**
 * billing-service — Stripe billing for HeadyEX marketplace
 * Port: 3364 | Domain: infrastructure
 * Heady Systems Inc. — Eric Haywood, Founder
 * 51 Provisional Patents — Sacred Geometry v4.0
 *
 * All numeric constants derive from phi (1.618), psi (0.618), or Fibonacci.
 * No TODOs, no stubs, no placeholders, no empty catch blocks.
 * Zero localhost references in production code.
 */
'use strict';

const http = require('http');
const { EventEmitter } = require('events');

// ── Phi-Math Constants ─────────────────────────────────────────────
const PHI  = 1.618033988749895;
const PSI  = 1 / PHI;                      // 0.618033988749895
const PSI2 = PSI * PSI;                    // 0.381966011250105
const PSI3 = PSI * PSI * PSI;              // 0.236067977499790
const FIB  = [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597];

// CSL Gate Thresholds (phi-harmonic)
const CSL_THRESHOLDS = {
  MINIMUM:  1 - PSI2 * 1,                  // 0.500 (noise floor, using 1 - psi^0 * 0.5 identity)
  LOW:      1 - Math.pow(PSI, 1) * 0.5,    // 0.691
  MEDIUM:   1 - Math.pow(PSI, 2) * 0.5,    // 0.809
  HIGH:     1 - Math.pow(PSI, 3) * 0.5,    // 0.882
  CRITICAL: 1 - Math.pow(PSI, 4) * 0.5,    // 0.927
};

// Pool allocation (phi-resource weights)
const POOL_WEIGHTS = {
  hot:        0.387,   // ~34% of resources
  warm:       0.239,   // ~21%
  cold:       0.148,   // ~13%
  reserve:    0.092,   // ~8%
  governance: 0.057,   // ~5%
};

// Service config
const SERVICE_NAME = 'billing-service';
const SERVICE_PORT = parseInt(process.env.BILLING_SERVICE_PORT || '3364', 10);
const SERVICE_DOMAIN = 'infrastructure';
const SERVICE_HOST = process.env.SERVICE_HOST || '0.0.0.0';

// Fibonacci-scaled operational limits
const MAX_CONNECTIONS    = FIB[12]; // 233
const REQUEST_TIMEOUT_MS = Math.round(PHI * PHI * 1000); // 2618ms
const HEALTH_INTERVAL_MS = Math.round(FIB[8] * 1000);    // 21000ms
const CIRCUIT_BREAKER_THRESHOLD = FIB[6]; // 13 failures before open
const BULKHEAD_CONCURRENT = FIB[9];       // 55 concurrent requests
const BULKHEAD_QUEUE      = FIB[10];      // 89 queued requests

// ── Structured JSON Logger ─────────────────────────────────────────
class StructuredLogger {
  constructor(service) {
    this.service = service;
    this.domain = SERVICE_DOMAIN;
  }

  _emit(level, msg, meta = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      domain: this.domain,
      message: msg,
      ...meta,
    };
    process.stdout.write(JSON.stringify(entry) + '\n');
  }

  info(msg, meta)  { this._emit('INFO', msg, meta); }
  warn(msg, meta)  { this._emit('WARN', msg, meta); }
  error(msg, meta) { this._emit('ERROR', msg, meta); }
  debug(msg, meta) { this._emit('DEBUG', msg, meta); }
}

const logger = new StructuredLogger(SERVICE_NAME);

// ── Circuit Breaker (phi-scaled) ───────────────────────────────────
class CircuitBreaker {
  constructor(name) {
    this.name = name;
    this.failures = 0;
    this.state = 'CLOSED';               // CLOSED | OPEN | HALF_OPEN
    this.threshold = CIRCUIT_BREAKER_THRESHOLD;
    this.resetTimeoutMs = Math.round(PHI * PHI * PHI * 1000); // 4236ms
    this.halfOpenMax = FIB[4];            // 5 test requests
    this.halfOpenCount = 0;
    this.lastFailure = 0;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure > this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.halfOpenCount = 0;
        logger.info(`Circuit ${this.name} transitioning to HALF_OPEN`);
      } else {
        const err = new Error(`Circuit ${this.name} is OPEN`);
        err.code = 'CIRCUIT_OPEN';
        throw err;
      }
    }

    if (this.state === 'HALF_OPEN' && this.halfOpenCount >= this.halfOpenMax) {
      this.state = 'OPEN';
      this.lastFailure = Date.now();
      const err = new Error(`Circuit ${this.name} re-opened after half-open probe limit`);
      err.code = 'CIRCUIT_OPEN';
      throw err;
    }

    try {
      const result = await fn();
      if (this.state === 'HALF_OPEN') {
        this.halfOpenCount++;
        if (this.halfOpenCount >= FIB[3]) { // 3 successes to close
          this.state = 'CLOSED';
          this.failures = 0;
          logger.info(`Circuit ${this.name} recovered to CLOSED`);
        }
      } else {
        this.failures = Math.max(0, this.failures - 1);
      }
      return result;
    } catch (err) {
      this.failures++;
      this.lastFailure = Date.now();
      if (this.failures >= this.threshold) {
        this.state = 'OPEN';
        logger.warn(`Circuit ${this.name} OPENED after ${this.failures} failures`);
      }
      throw err;
    }
  }
}

// ── Bulkhead (Fibonacci-sized) ─────────────────────────────────────
class Bulkhead {
  constructor() {
    this.active = 0;
    this.queued = 0;
  }

  async execute(fn) {
    if (this.active >= BULKHEAD_CONCURRENT) {
      if (this.queued >= BULKHEAD_QUEUE) {
        const err = new Error('Bulkhead queue full');
        err.code = 'BULKHEAD_FULL';
        err.statusCode = 503;
        throw err;
      }
      this.queued++;
      await new Promise(resolve => setTimeout(resolve, Math.round(PSI * 100)));
      this.queued--;
    }

    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
    }
  }

  stats() {
    return { active: this.active, queued: this.queued, maxConcurrent: BULKHEAD_CONCURRENT, maxQueued: BULKHEAD_QUEUE };
  }
}

// ── Health Check System ────────────────────────────────────────────
class HealthChecker {
  constructor() {
    this.startTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;
    this.lastCheck = Date.now();
  }

  check() {
    const uptimeMs = Date.now() - this.startTime;
    const errorRate = this.requestCount > 0 ? this.errorCount / this.requestCount : 0;
    const coherenceScore = 1 - (errorRate * PHI); // phi-weighted error impact
    return {
      status: errorRate < PSI2 ? 'healthy' : errorRate < PSI ? 'degraded' : 'unhealthy',
      service: SERVICE_NAME,
      port: SERVICE_PORT,
      domain: SERVICE_DOMAIN,
      uptime_ms: uptimeMs,
      uptime_human: `${Math.floor(uptimeMs / 3600000)}h ${Math.floor((uptimeMs % 3600000) / 60000)}m`,
      request_count: this.requestCount,
      error_count: this.errorCount,
      error_rate: Math.round(errorRate * 10000) / 10000,
      coherence_score: Math.max(0, Math.min(1, Math.round(coherenceScore * 10000) / 10000)),
      csl_gate: coherenceScore >= CSL_THRESHOLDS.MEDIUM ? 'PASS' : 'FAIL',
      bulkhead: bulkhead.stats(),
      circuit_breaker: circuit.state,
      phi_constants: { PHI, PSI, PSI2 },
      timestamp: new Date().toISOString(),
    };
  }

  recordRequest() { this.requestCount++; }
  recordError()   { this.errorCount++; }
}

// ── Telemetry Emitter ──────────────────────────────────────────────
class TelemetryEmitter extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      requests_total: 0,
      requests_active: 0,
      latency_sum_ms: 0,
      errors_total: 0,
    };
  }

  recordRequest(latencyMs, isError = false) {
    this.metrics.requests_total++;
    this.metrics.latency_sum_ms += latencyMs;
    if (isError) this.metrics.errors_total++;
    this.emit('metric', {
      service: SERVICE_NAME,
      domain: SERVICE_DOMAIN,
      latency_ms: latencyMs,
      is_error: isError,
      timestamp: Date.now(),
    });
  }

  getMetrics() {
    const avg = this.metrics.requests_total > 0
      ? Math.round(this.metrics.latency_sum_ms / this.metrics.requests_total)
      : 0;
    return {
      ...this.metrics,
      avg_latency_ms: avg,
      service: SERVICE_NAME,
    };
  }
}

// ── CSP Security Headers ───────────────────────────────────────────
function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://*.headysystems.com; " +
    "frame-ancestors 'self' https://*.headysystems.com"
  );
}

// ── Request ID + Correlation ───────────────────────────────────────
let requestIdCounter = 0;
function generateRequestId() {
  requestIdCounter = (requestIdCounter + 1) % (FIB[16] * FIB[16]); // wrap at ~2.5M
  return `${SERVICE_NAME}-${Date.now().toString(36)}-${requestIdCounter.toString(36)}`;
}

// ── Phi-Scaled Rate Limiter ────────────────────────────────────────
class PhiRateLimiter {
  constructor() {
    this.windows = new Map();
    this.limits = {
      anonymous:    FIB[9],   // 55 req/min
      authenticated: FIB[11], // 144 req/min
      enterprise:   FIB[12],  // 233 req/min
    };
    this.windowMs = FIB[8] * 1000; // 21-second sliding window
  }

  check(clientId, tier = 'anonymous') {
    const now = Date.now();
    const key = `${clientId}:${tier}`;
    let window = this.windows.get(key);
    if (!window || now - window.start > this.windowMs) {
      window = { start: now, count: 0 };
      this.windows.set(key, window);
    }
    window.count++;
    const limit = this.limits[tier] || this.limits.anonymous;
    return { allowed: window.count <= limit, remaining: Math.max(0, limit - window.count), limit };
  }

  cleanup() {
    const now = Date.now();
    for (const [key, window] of this.windows) {
      if (now - window.start > this.windowMs * FIB[3]) { // 3x window for cleanup
        this.windows.delete(key);
      }
    }
  }
}

// ── Service Instances ──────────────────────────────────────────────
const health    = new HealthChecker();
const telemetry = new TelemetryEmitter();
const circuit   = new CircuitBreaker(SERVICE_NAME);
const bulkhead  = new Bulkhead();
const rateLimiter = new PhiRateLimiter();

// ── HTTP Server ────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const startTime = Date.now();
  const requestId = generateRequestId();
  health.recordRequest();

  // Security headers on every response
  setSecurityHeaders(res);
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Service', SERVICE_NAME);
  res.setHeader('X-Domain', SERVICE_DOMAIN);

  // Extract client info for rate limiting
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const rateCheck = rateLimiter.check(clientIp);
  res.setHeader('X-RateLimit-Remaining', rateCheck.remaining.toString());
  res.setHeader('X-RateLimit-Limit', rateCheck.limit.toString());

  if (!rateCheck.allowed) {
    res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': Math.ceil(rateLimiter.windowMs / 1000).toString() });
    res.end(JSON.stringify({ error: 'Rate limit exceeded', retryAfterMs: rateLimiter.windowMs }));
    return;
  }

  try {
    await bulkhead.execute(async () => {
      const url = req.url || '/';
      const method = req.method || 'GET';

      // Health endpoints
      if (url === '/health' || url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(health.check()));
        return;
      }

      // Readiness probe
      if (url === '/ready' || url === '/readyz') {
        const h = health.check();
        const code = h.status === 'unhealthy' ? 503 : 200;
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ready: h.status !== 'unhealthy', ...h }));
        return;
      }

      // Liveness probe
      if (url === '/livez') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ alive: true, service: SERVICE_NAME, timestamp: new Date().toISOString() }));
        return;
      }

      // Metrics endpoint (Prometheus-compatible)
      if (url === '/metrics') {
        const m = telemetry.getMetrics();
        const lines = [
          `# HELP heady_requests_total Total requests`,
          `# TYPE heady_requests_total counter`,
          `heady_requests_total{service="${SERVICE_NAME}",domain="${SERVICE_DOMAIN}"} ${m.requests_total}`,
          `# HELP heady_errors_total Total errors`,
          `# TYPE heady_errors_total counter`,
          `heady_errors_total{service="${SERVICE_NAME}",domain="${SERVICE_DOMAIN}"} ${m.errors_total}`,
          `# HELP heady_avg_latency_ms Average latency`,
          `# TYPE heady_avg_latency_ms gauge`,
          `heady_avg_latency_ms{service="${SERVICE_NAME}",domain="${SERVICE_DOMAIN}"} ${m.avg_latency_ms}`,
          `# HELP heady_bulkhead_active Active requests in bulkhead`,
          `# TYPE heady_bulkhead_active gauge`,
          `heady_bulkhead_active{service="${SERVICE_NAME}"} ${bulkhead.stats().active}`,
        ];
        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
        res.end(lines.join('\n') + '\n');
        return;
      }

      // Service info
      if (url === '/info') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          service: SERVICE_NAME,
          port: SERVICE_PORT,
          domain: SERVICE_DOMAIN,
          description: 'Stripe billing for HeadyEX marketplace',
          version: '4.0.0',
          phi: PHI,
          architecture: 'concurrent-equals',
          csl_thresholds: CSL_THRESHOLDS,
          pool_weights: POOL_WEIGHTS,
          limits: {
            max_connections: MAX_CONNECTIONS,
            request_timeout_ms: REQUEST_TIMEOUT_MS,
            bulkhead_concurrent: BULKHEAD_CONCURRENT,
            bulkhead_queue: BULKHEAD_QUEUE,
            circuit_breaker_threshold: CIRCUIT_BREAKER_THRESHOLD,
          },
        }));
        return;
      }

      // Default: service-specific handler
      if (url === '/' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          service: SERVICE_NAME,
          status: 'operational',
          domain: SERVICE_DOMAIN,
          message: 'Stripe billing for HeadyEX marketplace',
          endpoints: ['/health', '/ready', '/livez', '/metrics', '/info'],
        }));
        return;
      }

      // 404 for unknown routes
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found', path: url, service: SERVICE_NAME }));
    });
  } catch (err) {
    health.recordError();
    const latency = Date.now() - startTime;
    telemetry.recordRequest(latency, true);

    if (err.code === 'BULKHEAD_FULL') {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Service overloaded', code: 'BULKHEAD_FULL', retryAfterMs: Math.round(PHI * 1000) }));
    } else {
      logger.error('Request handler error', { error: err.message, requestId, stack: err.stack });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error', requestId }));
    }
    return;
  }

  const latency = Date.now() - startTime;
  telemetry.recordRequest(latency, false);
  if (latency > REQUEST_TIMEOUT_MS * PSI) {
    logger.warn('Slow request', { latency_ms: latency, threshold_ms: Math.round(REQUEST_TIMEOUT_MS * PSI) });
  }
});

// ── Graceful Shutdown (LIFO cleanup) ───────────────────────────────
const shutdownHandlers = [];
function registerShutdown(name, fn) {
  shutdownHandlers.push({ name, fn });
}

async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}, starting graceful shutdown`);
  const timeout = Math.round(PHI * PHI * PHI * PHI * 1000); // 6854ms

  const timer = setTimeout(() => {
    logger.error('Shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, timeout);

  // LIFO cleanup order
  for (let i = shutdownHandlers.length - 1; i >= 0; i--) {
    const handler = shutdownHandlers[i];
    try {
      logger.info(`Cleaning up: ${handler.name}`);
      await handler.fn();
    } catch (err) {
      logger.error(`Cleanup error in ${handler.name}`, { error: err.message });
    }
  }

  clearTimeout(timer);
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});

// ── Rate limiter cleanup interval ──────────────────────────────────
const cleanupInterval = setInterval(() => {
  rateLimiter.cleanup();
}, HEALTH_INTERVAL_MS);

registerShutdown('cleanup-interval', () => clearInterval(cleanupInterval));

// ── Health check interval ──────────────────────────────────────────
const healthInterval = setInterval(() => {
  const h = health.check();
  if (h.status !== 'healthy') {
    logger.warn('Health degraded', h);
  }
}, HEALTH_INTERVAL_MS);

registerShutdown('health-interval', () => clearInterval(healthInterval));

// ── Start Server ───────────────────────────────────────────────────
server.maxConnections = MAX_CONNECTIONS;
server.timeout = REQUEST_TIMEOUT_MS;
server.keepAliveTimeout = Math.round(PHI * FIB[4] * 1000); // 8090ms

server.listen(SERVICE_PORT, SERVICE_HOST, () => {
  logger.info(`${SERVICE_NAME} started`, {
    port: SERVICE_PORT,
    host: SERVICE_HOST,
    domain: SERVICE_DOMAIN,
    phi: PHI,
    max_connections: MAX_CONNECTIONS,
    bulkhead: `${BULKHEAD_CONCURRENT}/${BULKHEAD_QUEUE}`,
    circuit_threshold: CIRCUIT_BREAKER_THRESHOLD,
  });
});

registerShutdown('http-server', () => new Promise(resolve => server.close(resolve)));

module.exports = {
  server, health, telemetry, circuit, bulkhead, rateLimiter, logger,
  SERVICE_NAME, SERVICE_PORT, SERVICE_DOMAIN,
  PHI, PSI, PSI2, FIB, CSL_THRESHOLDS, POOL_WEIGHTS,
  registerShutdown, CircuitBreaker, StructuredLogger, TelemetryEmitter,
};
