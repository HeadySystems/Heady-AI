/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Custom metrics for the Heady φ-Pure Latent OS.
 *
 * Uses @opentelemetry/api exclusively so the existing MeterProvider (managed
 * by Sentry v8 or any OTel SDK bootstrap) is respected — no second provider
 * initialisation here.
 *
 * Histogram bucket boundaries are derived from the Fibonacci sequence:
 *   [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89] milliseconds
 *
 * Instruments:
 *   heady.request.duration         — histogram (ms) per service+route+method+status
 *   heady.coherence.score          — observable gauge per service
 *   heady.pipeline.stage.duration  — histogram (ms) per stage
 *   heady.vector.search.latency    — histogram (ms)
 *   heady.bee.active               — up-down counter per bee type
 *   heady.error.count              — counter by error code
 *
 * @module observability/metrics
 */

import {
  metrics,
  type Meter,
  type Histogram,
  type ObservableGauge,
  type UpDownCounter,
  type Counter,
  type BatchObservableResult,
  type ObservableResult,
} from '@opentelemetry/api';
import { FIB } from '../shared/phi-math.js';

// ---------------------------------------------------------------------------
// Fibonacci histogram boundaries
// ---------------------------------------------------------------------------

/**
 * Millisecond bucket boundaries derived from the first 11 Fibonacci numbers:
 *   [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]
 *
 * Most OTel SDKs accept boundaries as an `ExplicitBucketHistogramAggregation`
 * option. When the MeterProvider is Sentry's built-in provider the boundaries
 * are advisory — the SDK may apply defaults. The field is included so that
 * provider-specific configuration utilities (prometheus-exporter, OTLP, etc.)
 * can pick them up.
 */
export const FIBONACCI_MS_BOUNDARIES: ReadonlyArray<number> = FIB.slice(0, 11) as unknown as number[];
// → [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]

// ---------------------------------------------------------------------------
// Meter
// ---------------------------------------------------------------------------

const METER_NAME    = 'heady.phi-pure-latent-os';
const METER_VERSION = process.env.npm_package_version ?? '0.0.0';

function getMeter(): Meter {
  return metrics.getMeter(METER_NAME, METER_VERSION);
}

// ---------------------------------------------------------------------------
// Instrument registry — created once, reused on every call
// ---------------------------------------------------------------------------

interface HeadyInstruments {
  // Histograms
  requestDuration:       Histogram;
  pipelineStageDuration: Histogram;
  vectorSearchLatency:   Histogram;

  // Observable gauge (coherence score — push model via callbacks)
  coherenceScoreGauge: ObservableGauge;

  // Up-down counter
  beeActive: UpDownCounter;

  // Counter
  errorCount: Counter;
}

let _instruments: HeadyInstruments | undefined;

/** In-memory coherence score registry for the observable gauge callbacks. */
const coherenceScoreRegistry = new Map<string, number>();

/**
 * Lazily creates and caches all metric instruments.
 * Safe to call on every hot path — instruments are singletons per MeterProvider.
 */
function getInstruments(): HeadyInstruments {
  if (_instruments) return _instruments;

  const meter = getMeter();

  // ── heady.request.duration ──────────────────────────────────────────────
  const requestDuration = meter.createHistogram('heady.request.duration', {
    description: 'Duration of HTTP requests handled by Heady services (milliseconds)',
    unit: 'ms',
    // Advisory bucket boundaries — Fibonacci sequence
    // @ts-expect-error: advice is SDK-specific (not in @opentelemetry/api types)
    advice: { explicitBucketBoundaries: [...FIBONACCI_MS_BOUNDARIES] },
  });

  // ── heady.coherence.score (observable gauge) ────────────────────────────
  // Observable gauges use a callback invoked by the SDK at each collection cycle.
  const coherenceScoreGauge = meter.createObservableGauge('heady.coherence.score', {
    description: 'Current CSL coherence score per service (0–1). Values below 0.809 indicate semantic drift.',
    unit: '1',
  });

  coherenceScoreGauge.addCallback((observableResult: ObservableResult) => {
    for (const [service, score] of coherenceScoreRegistry.entries()) {
      observableResult.observe(score, { 'heady.service': service });
    }
  });

  // ── heady.pipeline.stage.duration ───────────────────────────────────────
  const pipelineStageDuration = meter.createHistogram('heady.pipeline.stage.duration', {
    description: 'Duration of each HCFP pipeline stage (milliseconds)',
    unit: 'ms',
    // @ts-expect-error: advice is SDK-specific
    advice: { explicitBucketBoundaries: [...FIBONACCI_MS_BOUNDARIES] },
  });

  // ── heady.vector.search.latency ─────────────────────────────────────────
  const vectorSearchLatency = meter.createHistogram('heady.vector.search.latency', {
    description: 'Latency of vector similarity search operations (milliseconds)',
    unit: 'ms',
    // @ts-expect-error: advice is SDK-specific
    advice: { explicitBucketBoundaries: [...FIBONACCI_MS_BOUNDARIES] },
  });

  // ── heady.bee.active ─────────────────────────────────────────────────────
  const beeActive = meter.createUpDownCounter('heady.bee.active', {
    description: 'Number of currently active HeadyBee instances by type',
    unit: '{bee}',
  });

  // ── heady.error.count ────────────────────────────────────────────────────
  const errorCount = meter.createCounter('heady.error.count', {
    description: 'Total errors recorded by the Heady platform, partitioned by error code',
    unit: '{error}',
  });

  _instruments = {
    requestDuration,
    coherenceScoreGauge,
    pipelineStageDuration,
    vectorSearchLatency,
    beeActive,
    errorCount,
  };

  return _instruments;
}

// ---------------------------------------------------------------------------
// Public recording functions
// ---------------------------------------------------------------------------

export interface RequestDurationAttributes {
  /** Logical service name (e.g. "mcp-server", "vector-ops"). */
  'heady.service': string;
  /** HTTP route pattern (e.g. "/api/v1/embed/:id"). */
  'http.route'?: string;
  /** HTTP method (GET, POST, …). */
  'http.method'?: string;
  /** HTTP status code as string (e.g. "200", "500"). */
  'http.status_code'?: string;
  /** Heady domain (e.g. "headymcp.com"). */
  'heady.domain'?: string;
}

/**
 * Record the duration of an HTTP request.
 *
 * @example
 * ```ts
 * const start = performance.now();
 * // … handle request …
 * recordRequestDuration(performance.now() - start, {
 *   'heady.service': 'mcp-server',
 *   'http.route': '/api/v1/tools',
 *   'http.method': 'GET',
 *   'http.status_code': '200',
 *   'heady.domain': 'headymcp.com',
 * });
 * ```
 */
export function recordRequestDuration(
  durationMs: number,
  attributes: RequestDurationAttributes,
): void {
  getInstruments().requestDuration.record(durationMs, attributes);
}

// ---------------------------------------------------------------------------

export interface CoherenceScoreAttributes {
  /** Service whose coherence score is being updated. */
  service: string;
}

/**
 * Update the observable coherence score for a service.
 *
 * The value is stored in an in-process registry that the gauge's callback
 * reads at each SDK collection cycle. Call this on every health-check cycle
 * or after every HeadyBrains embedding re-validation.
 *
 * @example
 * ```ts
 * const score = await vectorMemory.coherenceScore();
 * updateCoherenceScore('vector-ops', score);
 * ```
 */
export function updateCoherenceScore(service: string, score: number): void {
  // Clamp to [0, 1] — coherence scores outside this range indicate a bug
  coherenceScoreRegistry.set(service, Math.max(0, Math.min(1, score)));
  // Ensure instruments are initialised (gauge callback requires them)
  getInstruments();
}

/**
 * Remove a service's coherence score from the gauge registry (e.g. on shutdown).
 */
export function removeCoherenceScore(service: string): void {
  coherenceScoreRegistry.delete(service);
}

// ---------------------------------------------------------------------------

export interface PipelineStageDurationAttributes {
  /** HCFP stage label. */
  'heady.pipeline_stage': string;
  /** Logical service (bee or conductor). */
  'heady.service'?: string;
  /** Final stage status: "ok" | "error" | "skipped". */
  'heady.stage_status'?: 'ok' | 'error' | 'skipped';
}

/**
 * Record the duration of a single HCFP pipeline stage.
 *
 * @example
 * ```ts
 * const t0 = performance.now();
 * await runContextAssembly(task);
 * recordPipelineStageDuration(performance.now() - t0, {
 *   'heady.pipeline_stage': 'context-assembly',
 *   'heady.service': 'heady-brains',
 *   'heady.stage_status': 'ok',
 * });
 * ```
 */
export function recordPipelineStageDuration(
  durationMs: number,
  attributes: PipelineStageDurationAttributes,
): void {
  getInstruments().pipelineStageDuration.record(durationMs, attributes);
}

// ---------------------------------------------------------------------------

export interface VectorSearchAttributes {
  /** Vector index or collection name (e.g. "heady-384d-prod"). */
  'heady.vector.index'?: string;
  /** Top-K used for the query. */
  'heady.vector.top_k'?: number;
  /** Backend: "pinecone" | "pgvector" | "in-memory". */
  'heady.vector.backend'?: string;
}

/**
 * Record the round-trip latency of a vector similarity search operation.
 */
export function recordVectorSearchLatency(
  durationMs: number,
  attributes?: VectorSearchAttributes,
): void {
  getInstruments().vectorSearchLatency.record(durationMs, attributes ?? {});
}

// ---------------------------------------------------------------------------

export interface BeeActiveAttributes {
  /** HeadyBee type (e.g. "telemetry-bee", "vector-ops-bee"). */
  'heady.bee_type': string;
  /** Optional pool classification: "hot" | "warm" | "cold" | "reserve" | "governance". */
  'heady.pool'?: 'hot' | 'warm' | 'cold' | 'reserve' | 'governance';
}

/**
 * Increment the active bee counter when a bee is spawned.
 */
export function beeSpawned(attributes: BeeActiveAttributes): void {
  getInstruments().beeActive.add(1, attributes);
}

/**
 * Decrement the active bee counter when a bee retires.
 */
export function beeRetired(attributes: BeeActiveAttributes): void {
  getInstruments().beeActive.add(-1, attributes);
}

// ---------------------------------------------------------------------------

export interface ErrorCountAttributes {
  /** HeadyError code (e.g. "COHERENCE_DRIFT", "INTERNAL_ERROR"). */
  'heady.error.code': string;
  /** Logical service that raised the error. */
  'heady.service'?: string;
  /** HCFP pipeline stage where the error occurred. */
  'heady.pipeline_stage'?: string;
}

/**
 * Increment the error counter.
 *
 * @example
 * ```ts
 * catch (err) {
 *   incrementErrorCount({
 *     'heady.error.code': (err as HeadyError).code ?? 'UNKNOWN',
 *     'heady.service': 'vector-ops',
 *   });
 *   throw err;
 * }
 * ```
 */
export function incrementErrorCount(attributes: ErrorCountAttributes): void {
  getInstruments().errorCount.add(1, attributes);
}

// ---------------------------------------------------------------------------
// /metrics endpoint helper
// ---------------------------------------------------------------------------

/**
 * Returns a snapshot of the in-process observable gauge values (coherence
 * scores) plus the current bee-active state for use by a /metrics HTTP endpoint.
 *
 * For a full Prometheus scrape you should wire a PrometheusExporter to the
 * MeterProvider. This helper covers the health-dashboard use-case where a
 * lightweight JSON endpoint is sufficient.
 */
export function getMetrics(): {
  coherenceScores: Record<string, number>;
  fibonacciBucketBoundaries: ReadonlyArray<number>;
  instruments: string[];
} {
  return {
    coherenceScores: Object.fromEntries(coherenceScoreRegistry.entries()),
    fibonacciBucketBoundaries: FIBONACCI_MS_BOUNDARIES,
    instruments: [
      'heady.request.duration',
      'heady.coherence.score',
      'heady.pipeline.stage.duration',
      'heady.vector.search.latency',
      'heady.bee.active',
      'heady.error.count',
    ],
  };
}

// ---------------------------------------------------------------------------
// Re-export for convenience
// ---------------------------------------------------------------------------
export { FIBONACCI_MS_BOUNDARIES as FIB_MS_BUCKETS };
export type { Meter };
