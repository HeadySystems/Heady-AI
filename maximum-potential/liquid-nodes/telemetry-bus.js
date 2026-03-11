/**
 * telemetry-bus.js — Structured observability for Heady liquid node system.
 *
 * Provides structured JSON logging (pino), health endpoint aggregation,
 * metrics collection, distributed traces, and error classification.
 * All timing constants phi-scaled.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import pino from 'pino';
import { PHI, PSI, HEALTH_CHECK_INTERVAL_MS, FIB } from './constants.js';

const ERROR_CLASSES = Object.freeze({
  TRANSIENT: 'transient',
  PERMANENT: 'permanent',
  DEGRADED: 'degraded',
  UNKNOWN: 'unknown',
});

/**
 * Classify an error for routing/retry decisions.
 * @param {Error|object} err
 * @returns {string}
 */
function classifyError(err) {
  const msg = (err?.message || '').toLowerCase();
  if (msg.includes('timeout') || msg.includes('econnreset') || msg.includes('econnrefused')) {
    return ERROR_CLASSES.TRANSIENT;
  }
  if (msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('invalid')) {
    return ERROR_CLASSES.PERMANENT;
  }
  if (msg.includes('rate') || msg.includes('throttle') || msg.includes('capacity')) {
    return ERROR_CLASSES.DEGRADED;
  }
  return ERROR_CLASSES.UNKNOWN;
}

/**
 * TelemetryBus — Centralized event bus for logging, metrics, health, and traces.
 */
export class TelemetryBus extends EventEmitter {
  /**
   * @param {object} [opts={}]
   * @param {string} [opts.service='liquid-nodes']
   * @param {string} [opts.level='info']
   * @param {boolean} [opts.pretty=false]
   */
  constructor(opts = {}) {
    super();
    this.service = opts.service || 'liquid-nodes';

    const transport = opts.pretty
      ? pino.transport({ target: 'pino-pretty', options: { colorize: true } })
      : undefined;

    this.logger = pino({ name: this.service, level: opts.level || 'info' }, transport);

    /** @type {Map<string, { name: string, status: string, lastCheck: number, details: object }>} */
    this._healthRegistry = new Map();

    /** @type {Map<string, number[]>} metric name -> array of values */
    this._metrics = new Map();

    /** @type {Map<string, object>} traceId -> trace data */
    this._activeTraces = new Map();

    this._healthInterval = null;
    this._running = false;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  start() {
    if (this._running) return;
    this._running = true;
    this._healthInterval = setInterval(() => this._aggregateHealth(), HEALTH_CHECK_INTERVAL_MS);
    this._healthInterval.unref();
    this.info('telemetry.started', { service: this.service });
  }

  stop() {
    if (!this._running) return;
    this._running = false;
    if (this._healthInterval) {
      clearInterval(this._healthInterval);
      this._healthInterval = null;
    }
    this.info('telemetry.stopped');
  }

  // -------------------------------------------------------------------------
  // Logging (structured JSON via pino)
  // -------------------------------------------------------------------------

  info(event, data = {}) {
    this.logger.info({ event, ...data });
    this.emit('log', { level: 'info', event, data, ts: Date.now() });
  }

  warn(event, data = {}) {
    this.logger.warn({ event, ...data });
    this.emit('log', { level: 'warn', event, data, ts: Date.now() });
  }

  error(event, data = {}) {
    const classification = data.error ? classifyError(data.error) : ERROR_CLASSES.UNKNOWN;
    this.logger.error({ event, errorClass: classification, ...data });
    this.emit('log', { level: 'error', event, data, classification, ts: Date.now() });
    this.emit('error-event', { event, data, classification, ts: Date.now() });
  }

  debug(event, data = {}) {
    this.logger.debug({ event, ...data });
    this.emit('log', { level: 'debug', event, data, ts: Date.now() });
  }

  // -------------------------------------------------------------------------
  // Metrics
  // -------------------------------------------------------------------------

  /**
   * Record a numeric metric value.
   * @param {string} name
   * @param {number} value
   */
  recordMetric(name, value) {
    if (!this._metrics.has(name)) this._metrics.set(name, []);
    const arr = this._metrics.get(name);
    arr.push(value);
    if (arr.length > FIB[10]) arr.splice(0, arr.length - FIB[10]); // cap at 89
    this.emit('metric', { name, value, ts: Date.now() });
  }

  /**
   * Get summary stats for a metric.
   * @param {string} name
   * @returns {{ count: number, min: number, max: number, avg: number, p50: number }|null}
   */
  getMetricSummary(name) {
    const arr = this._metrics.get(name);
    if (!arr || arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const sum = sorted.reduce((s, v) => s + v, 0);
    return {
      count: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: Math.round((sum / sorted.length) * 100) / 100,
      p50: sorted[Math.floor(sorted.length * PSI)],
    };
  }

  getMetricNames() {
    return Array.from(this._metrics.keys());
  }

  // -------------------------------------------------------------------------
  // Health registry
  // -------------------------------------------------------------------------

  registerComponent(componentId, name) {
    this._healthRegistry.set(componentId, {
      name, status: 'unknown', lastCheck: 0, details: {},
    });
  }

  updateHealth(componentId, status, details = {}) {
    const entry = this._healthRegistry.get(componentId);
    if (entry) {
      entry.status = status;
      entry.lastCheck = Date.now();
      entry.details = details;
    }
  }

  getHealthReport() {
    const components = [];
    let hasUnhealthy = false;
    let hasDegraded = false;

    for (const [id, entry] of this._healthRegistry) {
      components.push({ id, ...entry });
      if (entry.status === 'unhealthy') hasUnhealthy = true;
      if (entry.status === 'degraded') hasDegraded = true;
    }

    const overall = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';
    return { overall, components };
  }

  getAllHealthReports() {
    return this.getHealthReport();
  }

  /** @private */
  _aggregateHealth() {
    const report = this.getHealthReport();
    this.emit('health', report);
    if (report.overall !== 'healthy') {
      this.warn('telemetry.healthDegraded', { overall: report.overall });
    }
  }

  // -------------------------------------------------------------------------
  // Distributed tracing
  // -------------------------------------------------------------------------

  /**
   * Start a trace span.
   * @param {string} name
   * @param {object} [metadata={}]
   * @returns {{ traceId: string, end: (status: string, extra?: object) => void }}
   */
  startTrace(name, metadata = {}) {
    const traceId = randomUUID();
    const startTime = Date.now();
    const trace = { traceId, name, metadata, startTime, status: 'active' };
    this._activeTraces.set(traceId, trace);
    this.debug('trace.start', { traceId, name, ...metadata });

    return {
      traceId,
      end: (status = 'ok', extra = {}) => {
        const duration = Date.now() - startTime;
        trace.status = status;
        trace.duration = duration;
        this._activeTraces.delete(traceId);
        this.recordMetric(`trace.${name}.durationMs`, duration);
        this.debug('trace.end', { traceId, name, status, duration, ...extra });
      },
    };
  }

  get activeTraces() {
    return this._activeTraces.size;
  }

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  getStatus() {
    return {
      running: this._running,
      service: this.service,
      health: this.getHealthReport(),
      metrics: this.getMetricNames().length,
      activeTraces: this._activeTraces.size,
      components: this._healthRegistry.size,
    };
  }
}

export { classifyError, ERROR_CLASSES };
