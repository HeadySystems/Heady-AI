/*
 * © 2026 Heady™Systems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 */
// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  LIQUID NODE BASE — Universal Microservice Contract             ║
// ║  Every Heady service extends this to become a Liquid Node       ║
// ║  FILE: src/core/liquid-node-base.js                             ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const EventEmitter = require('events');
const crypto = require('crypto');
const logger = (() => { try { return require('../utils/logger'); } catch { return console; } })();

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const PSI_SQ = 0.381966011250105;

// φ-scaled timing constants
const TIMING = {
  HEALTH_CHECK_MS: Math.round(Math.pow(PHI, 7) * 1000),    // 29,034ms
  METRICS_FLUSH_MS: Math.round(Math.pow(PHI, 8) * 1000),   // 46,979ms
  GRACEFUL_SHUTDOWN_MS: Math.round(Math.pow(PHI, 5) * 1000), // 11,090ms
  STARTUP_DELAY_MS: Math.round(Math.pow(PHI, 3) * 1000),   // 4,236ms
  FAST_OP_MS: Math.round(Math.pow(PHI, 3) * 1000),         // 4,236ms
  NORMAL_OP_MS: Math.round(Math.pow(PHI, 5) * 1000),       // 11,090ms
  LONG_OP_MS: Math.round(Math.pow(PHI, 8) * 1000),         // 46,979ms
};

// Circuit breaker states
const CB_STATES = { CLOSED: 'closed', OPEN: 'open', HALF_OPEN: 'half_open' };

class LiquidNodeBase extends EventEmitter {
  constructor(config = {}) {
    super();
    this.serviceId = config.serviceId || 'unknown-service';
    this.serviceVersion = config.serviceVersion || '1.0.0';
    this.serviceTier = config.serviceTier || 'warm'; // hot | warm | cold
    this.port = config.port || 3300;

    // Metrics
    this._metrics = {
      requestCount: 0,
      errorCount: 0,
      errorRate: 0,
      p99LatencyMs: 0,
      memoryMb: 0,
      uptimeMs: 0,
      lastHealthCheck: null,
      latencies: [],
    };

    // Circuit breaker per downstream dependency
    this._circuitBreakers = new Map();

    // EventSpine connection
    this._eventSpine = null;
    this._subscriptions = config.subscribeTopics || [];
    this._publishTopics = config.publishTopics || [];

    // State
    this._started = false;
    this._startedAt = null;
    this._healthTimer = null;
    this._metricsTimer = null;

    // Sentry integration
    this._sentryDsn = process.env.SENTRY_DSN || null;
    this._sentry = null;
  }

  // ─── LIFECYCLE ──────────────────────────────────────────────────────────

  async start() {
    if (this._started) return;
    logger.info(`[${this.serviceId}] Starting Liquid Node v${this.serviceVersion} (tier: ${this.serviceTier})`);

    // Initialize Sentry
    await this._initSentry();

    // Connect to EventSpine (Upstash Redis Streams)
    await this._connectEventSpine();

    // Start health check timer
    this._healthTimer = setInterval(() => this._runHealthCheck(), TIMING.HEALTH_CHECK_MS);

    // Start metrics flush timer
    this._metricsTimer = setInterval(() => this._flushMetrics(), TIMING.METRICS_FLUSH_MS);

    this._started = true;
    this._startedAt = Date.now();

    // Emit boot event
    this.emitEvent('service:started', {
      serviceId: this.serviceId,
      version: this.serviceVersion,
      tier: this.serviceTier,
      port: this.port,
      timestamp: new Date().toISOString(),
    });

    logger.info(`[${this.serviceId}] Liquid Node started on port ${this.port}`);
  }

  async stop() {
    if (!this._started) return;
    logger.info(`[${this.serviceId}] Graceful shutdown initiated (${TIMING.GRACEFUL_SHUTDOWN_MS}ms drain)`);

    // Emit shutdown event
    this.emitEvent('service:stopping', { serviceId: this.serviceId });

    // Clear timers
    if (this._healthTimer) clearInterval(this._healthTimer);
    if (this._metricsTimer) clearInterval(this._metricsTimer);

    // Drain connections
    await new Promise(resolve => setTimeout(resolve, Math.min(TIMING.GRACEFUL_SHUTDOWN_MS, 5000)));

    this._started = false;

    this.emitEvent('service:stopped', { serviceId: this.serviceId });
    logger.info(`[${this.serviceId}] Liquid Node stopped`);
  }

  // ─── HEALTH ─────────────────────────────────────────────────────────────

  health() {
    const uptimeMs = this._started ? Date.now() - this._startedAt : 0;
    const memUsage = process.memoryUsage();
    const errorRate = this._metrics.requestCount > 0
      ? this._metrics.errorCount / this._metrics.requestCount
      : 0;

    let status = 'healthy';
    if (!this._started) status = 'unhealthy';
    else if (errorRate > PSI) status = 'unhealthy';     // > 61.8% error rate
    else if (errorRate > PSI_SQ) status = 'degraded';   // > 38.2% error rate

    return {
      status,
      serviceId: this.serviceId,
      version: this.serviceVersion,
      tier: this.serviceTier,
      uptimeMs,
      latencyMs: this._metrics.p99LatencyMs,
      errorRate: Math.round(errorRate * 10000) / 10000,
      memoryMb: Math.round(memUsage.heapUsed / 1048576 * 100) / 100,
      circuitBreakers: this._getCircuitBreakerSummary(),
      timestamp: new Date().toISOString(),
    };
  }

  // ─── METRICS ────────────────────────────────────────────────────────────

  metrics() {
    return {
      serviceId: this.serviceId,
      requestCount: this._metrics.requestCount,
      errorCount: this._metrics.errorCount,
      errorRate: this._metrics.requestCount > 0
        ? this._metrics.errorCount / this._metrics.requestCount : 0,
      p99LatencyMs: this._metrics.p99LatencyMs,
      memoryMb: Math.round(process.memoryUsage().heapUsed / 1048576 * 100) / 100,
      uptimeMs: this._started ? Date.now() - this._startedAt : 0,
      timestamp: new Date().toISOString(),
    };
  }

  recordRequest(latencyMs, isError = false) {
    this._metrics.requestCount++;
    if (isError) this._metrics.errorCount++;
    this._metrics.latencies.push(latencyMs);

    // Keep only last fib(13) = 233 latencies for P99 calc
    if (this._metrics.latencies.length > 233) {
      this._metrics.latencies = this._metrics.latencies.slice(-233);
    }

    // Update P99
    const sorted = [...this._metrics.latencies].sort((a, b) => a - b);
    const p99Idx = Math.floor(sorted.length * 0.99);
    this._metrics.p99LatencyMs = sorted[p99Idx] || 0;
  }

  // ─── EVENT SPINE ────────────────────────────────────────────────────────

  async onEvent(topic, data) {
    // Override in subclass
    logger.info(`[${this.serviceId}] Received event: ${topic}`, { data: typeof data });
  }

  emitEvent(topic, data) {
    const event = {
      id: crypto.randomUUID(),
      topic,
      source: this.serviceId,
      data,
      timestamp: new Date().toISOString(),
      phi: PHI,
    };

    // Emit locally
    this.emit(topic, event);

    // Publish to EventSpine if connected
    if (this._eventSpine && typeof this._eventSpine.publish === 'function') {
      this._eventSpine.publish(topic, event).catch(err => {
        logger.error(`[${this.serviceId}] EventSpine publish failed`, { error: err.message, topic });
      });
    }

    return event;
  }

  // ─── CIRCUIT BREAKER ────────────────────────────────────────────────────

  getCircuitBreaker(dependencyId) {
    if (!this._circuitBreakers.has(dependencyId)) {
      this._circuitBreakers.set(dependencyId, {
        state: CB_STATES.CLOSED,
        failures: 0,
        maxFailures: 5,          // fib(5)
        resetTimeMs: TIMING.FAST_OP_MS,
        lastFailure: null,
        halfOpenAt: null,
      });
    }
    return this._circuitBreakers.get(dependencyId);
  }

  async callWithCircuitBreaker(dependencyId, fn) {
    const cb = this.getCircuitBreaker(dependencyId);

    if (cb.state === CB_STATES.OPEN) {
      if (Date.now() >= cb.halfOpenAt) {
        cb.state = CB_STATES.HALF_OPEN;
      } else {
        throw new Error(`Circuit breaker OPEN for ${dependencyId}`);
      }
    }

    try {
      const result = await fn();
      // Success — reset
      cb.failures = 0;
      cb.state = CB_STATES.CLOSED;
      return result;
    } catch (err) {
      cb.failures++;
      cb.lastFailure = Date.now();
      if (cb.failures >= cb.maxFailures) {
        cb.state = CB_STATES.OPEN;
        cb.halfOpenAt = Date.now() + cb.resetTimeMs;
        logger.error(`[${this.serviceId}] Circuit breaker OPEN for ${dependencyId}`, {
          failures: cb.failures,
          resetAt: new Date(cb.halfOpenAt).toISOString(),
        });
      }
      throw err;
    }
  }

  // ─── PRIVATE ────────────────────────────────────────────────────────────

  async _initSentry() {
    if (!this._sentryDsn) return;
    try {
      const Sentry = require('@sentry/node');
      Sentry.init({
        dsn: this._sentryDsn,
        environment: process.env.NODE_ENV || 'development',
        release: `${this.serviceId}@${this.serviceVersion}`,
        tracesSampleRate: this.serviceTier === 'hot' ? 1.0 : PSI,
        serverName: this.serviceId,
      });
      this._sentry = Sentry;
      logger.info(`[${this.serviceId}] Sentry initialized`);
    } catch (err) {
      logger.error(`[${this.serviceId}] Sentry init failed`, { error: err.message });
    }
  }

  async _connectEventSpine() {
    // Connect to Upstash Redis Streams
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!redisUrl || !redisToken) {
      logger.info(`[${this.serviceId}] EventSpine: No Upstash credentials — running in local-only mode`);
      return;
    }

    try {
      const { Redis } = require('@upstash/redis');
      this._eventSpine = new Redis({ url: redisUrl, token: redisToken });
      logger.info(`[${this.serviceId}] EventSpine connected via Upstash Redis`);
    } catch (err) {
      logger.error(`[${this.serviceId}] EventSpine connection failed`, { error: err.message });
    }
  }

  async _runHealthCheck() {
    const h = this.health();
    this._metrics.lastHealthCheck = h;

    if (h.status !== 'healthy') {
      this.emitEvent('health:degraded', h);
    }
  }

  async _flushMetrics() {
    const m = this.metrics();
    this.emitEvent('metrics:flushed', m);

    // Report to Sentry as custom metrics
    if (this._sentry) {
      this._sentry.setContext('liquid_node_metrics', m);
    }
  }

  _getCircuitBreakerSummary() {
    const summary = {};
    for (const [id, cb] of this._circuitBreakers) {
      summary[id] = { state: cb.state, failures: cb.failures };
    }
    return summary;
  }
}

// Export constants for use by all services
LiquidNodeBase.PHI = PHI;
LiquidNodeBase.PSI = PSI;
LiquidNodeBase.PSI_SQ = PSI_SQ;
LiquidNodeBase.TIMING = TIMING;
LiquidNodeBase.CB_STATES = CB_STATES;

module.exports = { LiquidNodeBase, PHI, PSI, PSI_SQ, TIMING, CB_STATES };
