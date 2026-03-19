/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  @heady-ai/platform — otel/index.js                                 ║
 * ║  OpenTelemetry SDK bootstrap and instrumentation hooks           ║
 * ║  © 2026 HeadySystems Inc.                                        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Wraps @opentelemetry/sdk-node with Heady-standard configuration:
 *   - OTLP gRPC exporter to Collector sidecar
 *   - Prometheus scrape endpoint on /metrics
 *   - Service resource attributes (name, version, domain, phi_state)
 *   - Auto-instrumentation: HTTP, Express
 *   - Custom HeadySpan utilities for phi-context attributes
 *
 * USAGE:
 *   // Must be required BEFORE any other imports
 *   import { initOtel, HeadyTracer } from '@heady-ai/platform/otel';
 *   await initOtel({ service: 'heady-gateway', domain: 'headysystems.com' });
 */

'use strict';

import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import api, { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { PSI, CSL_THRESHOLDS, TIMEOUTS } from '../phi/index.js';

// ─── HEADY OTEL ATTRIBUTE KEYS ───────────────────────────────────────────────

export const HEADY_ATTRS = Object.freeze({
  DOMAIN:       'heady.domain',
  CONFIDENCE:   'heady.csl.confidence',
  COHERENCE:    'heady.csl.coherence',
  PHI_STATE:    'heady.phi.state',
  SWARM_ID:     'heady.swarm.id',
  BEE_ID:       'heady.bee.id',
  PERSONA:      'heady.persona',
  CSL_GATE:     'heady.csl.gate',
  PIPELINE_STAGE: 'heady.pipeline.stage',
  LAW_VIOLATION: 'heady.law.violation',
  CIRCUIT_STATE: 'heady.circuit.state',
});

// ─── SDK INIT ────────────────────────────────────────────────────────────────

let _sdk = null;

/**
 * @typedef {Object} OtelOptions
 * @property {string} service — service name (e.g. 'heady-gateway')
 * @property {string} [version] — service version
 * @property {string} [domain] — CSL domain
 * @property {string} [otlpEndpoint] — OTLP gRPC endpoint (default: env OTEL_EXPORTER_OTLP_ENDPOINT)
 * @property {number} [prometheusPort=9464] — Prometheus metrics port
 * @property {boolean} [disabled=false] — disable OTEL (testing)
 */

/**
 * Initialize OpenTelemetry SDK. MUST be called before any HTTP servers start.
 * Idempotent — safe to call multiple times, only initializes once.
 *
 * @param {OtelOptions} opts
 * @returns {Promise<void>}
 */
export async function initOtel(opts = {}) {
  if (_sdk) return; // already initialized

  const {
    service,
    version = process.env.SERVICE_VERSION ?? 'unknown',
    domain = process.env.HEADY_DOMAIN ?? 'unassigned',
    otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://heady-collector.heady-system.svc.cluster.local:4317',
    prometheusPort = parseInt(process.env.PROMETHEUS_PORT ?? '9464', 10),
    disabled = process.env.OTEL_SDK_DISABLED === 'true',
  } = opts;

  if (!service) throw new Error('initOtel: service name is required');
  if (disabled) return;

  const traceExporter = new OTLPTraceExporter({ url: otlpEndpoint });
  const metricExporter = new PrometheusExporter({ port: prometheusPort }, () => {
    // Prometheus ready callback — no-op, logger not available here
  });

  _sdk = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]:    service,
      [SEMRESATTRS_SERVICE_VERSION]: version,
      [HEADY_ATTRS.DOMAIN]:          domain,
      'heady.phi':                   PSI.toFixed(6),
      'deployment.environment':      process.env.NODE_ENV ?? 'production',
    }),
    traceExporter,
    metricReader: metricExporter,
    instrumentations: [
      new HttpInstrumentation({
        requestHook: (span, req) => {
          span.setAttribute('http.heady_service', service);
        },
      }),
      new ExpressInstrumentation(),
    ],
  });

  await _sdk.start();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await _sdk.shutdown();
  });
  process.on('SIGINT', async () => {
    await _sdk.shutdown();
  });
}

// ─── TRACER FACTORY ──────────────────────────────────────────────────────────

/**
 * Get the tracer for the given service.
 * @param {string} service
 * @returns {import('@opentelemetry/api').Tracer}
 */
export function getTracer(service) {
  return trace.getTracer(service);
}

// ─── HEADY SPAN UTILITIES ────────────────────────────────────────────────────

/**
 * Create a Heady-enriched span with phi-context attributes.
 *
 * @param {import('@opentelemetry/api').Tracer} tracer
 * @param {string} spanName
 * @param {Object} phiContext
 * @param {number} [phiContext.confidence]
 * @param {number} [phiContext.coherence]
 * @param {string} [phiContext.domain]
 * @param {string} [phiContext.swarmId]
 * @param {string} [phiContext.beeId]
 * @param {string} [phiContext.pipelineStage]
 * @param {Function} fn — async function to execute within span
 * @returns {Promise<*>}
 */
export async function headySpan(tracer, spanName, phiContext, fn) {
  return tracer.startActiveSpan(spanName, async (span) => {
    try {
      // Attach phi-context attributes
      if (phiContext.confidence !== undefined) {
        span.setAttribute(HEADY_ATTRS.CONFIDENCE, phiContext.confidence);
        span.setAttribute(HEADY_ATTRS.PHI_STATE, confidenceState(phiContext.confidence));
        span.setAttribute(HEADY_ATTRS.CSL_GATE, phiContext.confidence >= CSL_THRESHOLDS.PASS ? 'PASS' : 'FAIL');
      }
      if (phiContext.coherence   !== undefined) span.setAttribute(HEADY_ATTRS.COHERENCE,      phiContext.coherence);
      if (phiContext.domain      !== undefined) span.setAttribute(HEADY_ATTRS.DOMAIN,          phiContext.domain);
      if (phiContext.swarmId     !== undefined) span.setAttribute(HEADY_ATTRS.SWARM_ID,        phiContext.swarmId);
      if (phiContext.beeId       !== undefined) span.setAttribute(HEADY_ATTRS.BEE_ID,          phiContext.beeId);
      if (phiContext.pipelineStage !== undefined) span.setAttribute(HEADY_ATTRS.PIPELINE_STAGE, phiContext.pipelineStage);

      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      span.recordException(err);
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * Record a CSL gate event on the active span.
 * @param {number} similarity — cosine similarity
 * @param {string} [label] — gate label
 */
export function recordCslGate(similarity, label = 'csl_gate') {
  const span = trace.getActiveSpan();
  if (!span) return;
  span.addEvent(label, {
    [HEADY_ATTRS.CONFIDENCE]: similarity,
    [HEADY_ATTRS.CSL_GATE]:   similarity >= CSL_THRESHOLDS.PASS ? 'PASS' : 'FAIL',
  });
}

/**
 * Record a law violation on the active span (for CI enforcement).
 * @param {number} lawNumber — 1..8
 * @param {string} description
 */
export function recordLawViolation(lawNumber, description) {
  const span = trace.getActiveSpan();
  if (!span) return;
  span.addEvent('heady.law.violation', {
    [HEADY_ATTRS.LAW_VIOLATION]: `LAW_${lawNumber}: ${description}`,
  });
  span.setStatus({ code: SpanStatusCode.ERROR, message: `Law ${lawNumber} violation: ${description}` });
}

// ─── METRICS HELPERS ─────────────────────────────────────────────────────────

/**
 * Get an OpenTelemetry MeterProvider meter for phi-scaled metrics.
 * @param {string} service
 */
export function getMeter(service) {
  return api.metrics.getMeterProvider().getMeter(service);
}

/**
 * Create standard Heady service counters and histograms.
 * @param {string} service
 * @returns {Object} { requestCounter, latencyHistogram, cslScoreHistogram, errorCounter }
 */
export function createMetrics(service) {
  const meter = getMeter(service);

  const requestCounter = meter.createCounter(`heady.${service}.requests.total`, {
    description: 'Total requests processed',
  });

  const latencyHistogram = meter.createHistogram(`heady.${service}.latency_ms`, {
    description: 'Request latency in milliseconds',
    boundaries: [89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765], // Fibonacci boundaries
  });

  const cslScoreHistogram = meter.createHistogram(`heady.${service}.csl_score`, {
    description: 'CSL domain match similarity scores',
    boundaries: [0.382, 0.500, 0.618, 0.691, 0.809, 0.882, 0.927, 0.972],
  });

  const errorCounter = meter.createCounter(`heady.${service}.errors.total`, {
    description: 'Total errors encountered',
  });

  return { requestCounter, latencyHistogram, cslScoreHistogram, errorCounter };
}

// ─── UTILITIES ───────────────────────────────────────────────────────────────

function confidenceState(c) {
  if (c >= 0.927) return 'RESONANT_PASS';
  if (c >= 0.882) return 'STEADY';
  if (c >= 0.809) return 'ALIGN';
  if (c >= 0.691) return 'ENTRY';
  if (c >= 0.618) return 'PASS';
  return 'BELOW_THRESHOLD';
}
