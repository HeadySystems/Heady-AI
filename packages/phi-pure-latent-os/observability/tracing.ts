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
// ║  FILE: packages/phi-pure-latent-os/observability/tracing.ts                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * OpenTelemetry custom span helpers for the Heady φ-Pure Latent OS.
 *
 * Uses @opentelemetry/api exclusively for custom span creation so that the
 * existing provider (managed by Sentry v8 via skipOpenTelemetrySetup: false)
 * is respected — no second SDK initialisation is required here.
 *
 * Heady span attributes (semantic convention):
 *   heady.service          — logical service name (e.g. "vector-ops")
 *   heady.domain           — Heady domain (e.g. "headyme.com")
 *   heady.coherence_score  — float 0–1, CSL cosine similarity gate result
 *   heady.pipeline_stage   — HCFP stage label (e.g. "context-assembly")
 *   heady.bee_type         — HeadyBee variant (e.g. "telemetry-bee")
 *
 * @module observability/tracing
 */

import {
  context,
  propagation,
  trace,
  SpanKind,
  SpanStatusCode,
  type Span,
  type Attributes,
  type Context,
  type TextMapGetter,
  type TextMapSetter,
} from '@opentelemetry/api';
import {
  ROOT_CONTEXT,
  W3CBaggagePropagator,
} from '@opentelemetry/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Heady-specific semantic attributes attached to every custom span. */
export interface HeadySpanAttributes {
  /** Logical service name — maps to OTEL service.name for Heady spans. */
  'heady.service'?: string;
  /** Heady domain (e.g. "headyme.com", "headyconnection.org"). */
  'heady.domain'?: string;
  /**
   * CSL coherence score — float in [0, 1].
   * Values below CSL_THRESHOLDS.MEDIUM (0.809) signal semantic drift.
   */
  'heady.coherence_score'?: number;
  /**
   * HCFP pipeline stage label.
   * One of: context-assembly | intent-classification | node-selection |
   *         execution | quality-gate | assurance-gate | pattern-capture | story-update
   */
  'heady.pipeline_stage'?: string;
  /** HeadyBee type that produced or owns this span. */
  'heady.bee_type'?: string;
}

/** Full attribute bag accepted by withSpan / addSpanEvent. */
export type HeadyAttributes = HeadySpanAttributes & Attributes;

/** Options for withSpan. */
export interface WithSpanOptions {
  /** OTel span kind — defaults to SpanKind.INTERNAL. */
  kind?: SpanKind;
  /** Parent context override. Defaults to the active context. */
  ctx?: Context;
  /** Heady + OTel attributes to set at span start. */
  attributes?: HeadyAttributes;
}

// ---------------------------------------------------------------------------
// Tracer
// ---------------------------------------------------------------------------

/**
 * Retrieve the tracer for the Heady instrumentation scope.
 * The tracer name and version are visible in OTel backends as the
 * instrumentation library identifier.
 */
function getTracer(): ReturnType<typeof trace.getTracer> {
  return trace.getTracer(
    'heady.phi-pure-latent-os',
    process.env.npm_package_version ?? '0.0.0',
  );
}

// ---------------------------------------------------------------------------
// Core span helper
// ---------------------------------------------------------------------------

/**
 * Execute `fn` inside a new OTel span.
 *
 * The span is automatically ended (with appropriate status) whether `fn`
 * resolves or rejects — callers never need to call `span.end()`.
 *
 * @example
 * ```ts
 * const result = await withSpan(
 *   'vector-ops.embed',
 *   {
 *     attributes: {
 *       'heady.service': 'vector-ops',
 *       'heady.domain': 'headyme.com',
 *       'heady.bee_type': 'vector-ops-bee',
 *       'heady.pipeline_stage': 'execution',
 *     },
 *   },
 *   async (span) => {
 *     const embedding = await embedText(input);
 *     span.setAttribute('heady.coherence_score', embedding.coherenceScore);
 *     return embedding;
 *   },
 * );
 * ```
 */
export async function withSpan<T>(
  name: string,
  options: WithSpanOptions,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const tracer = getTracer();
  const parentCtx = options.ctx ?? context.active();

  return tracer.startActiveSpan(
    name,
    {
      kind: options.kind ?? SpanKind.INTERNAL,
      attributes: options.attributes,
    },
    parentCtx,
    async (span: Span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (err: unknown) {
        const mapped = mapErrorToSpanStatus(err);
        span.setStatus(mapped);
        span.recordException(err as Parameters<Span['recordException']>[0]);
        throw err;
      } finally {
        span.end();
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Span event helper
// ---------------------------------------------------------------------------

/**
 * Add a named event to the currently active span.
 * No-ops gracefully when there is no active span (e.g. in unit tests without
 * an OTel SDK configured).
 *
 * @example
 * ```ts
 * addSpanEvent('heady.bee.spawned', {
 *   'heady.bee_type': 'telemetry-bee',
 *   'heady.service': 'orchestration',
 * });
 * ```
 */
export function addSpanEvent(name: string, attributes?: HeadyAttributes): void {
  const span = trace.getActiveSpan();
  if (!span) return;
  span.addEvent(name, attributes, Date.now());
}

// ---------------------------------------------------------------------------
// Span attribute helpers
// ---------------------------------------------------------------------------

/**
 * Set one or more Heady attributes on the currently active span.
 * Safe to call when there is no active span.
 */
export function setHeadyAttributes(attributes: HeadyAttributes): void {
  const span = trace.getActiveSpan();
  if (!span) return;
  span.setAttributes(attributes);
}

/**
 * Record the CSL coherence score on the active span.
 * Also adds a span event when the score falls below the MEDIUM threshold (0.809)
 * to aid alerting in OTel backends.
 */
export function recordCoherenceScore(
  score: number,
  thresholdMedium = 0.809,
): void {
  const span = trace.getActiveSpan();
  if (!span) return;

  span.setAttribute('heady.coherence_score', score);

  if (score < thresholdMedium) {
    span.addEvent('heady.coherence.drift_detected', {
      'heady.coherence_score': score,
      'heady.coherence_threshold': thresholdMedium,
      'heady.coherence_delta': thresholdMedium - score,
    });
  }
}

// ---------------------------------------------------------------------------
// Error → SpanStatus mapping
// ---------------------------------------------------------------------------

/**
 * Map an arbitrary thrown value to an OTel SpanStatus.
 *
 * HeadyErrors carry an HTTP `statusCode`:
 *   4xx → SpanStatusCode.ERROR with the original message
 *   5xx → SpanStatusCode.ERROR
 *   anything else → SpanStatusCode.ERROR (safe default)
 */
export function mapErrorToSpanStatus(
  err: unknown,
): { code: SpanStatusCode; message?: string } {
  if (err instanceof Error) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (typeof statusCode === 'number' && statusCode < 500) {
      // Client error — still an error from the span's perspective but carry
      // the HTTP status code message through for easier debugging.
      return {
        code: SpanStatusCode.ERROR,
        message: `HTTP ${statusCode}: ${err.message}`,
      };
    }
    return { code: SpanStatusCode.ERROR, message: err.message };
  }
  return { code: SpanStatusCode.ERROR, message: String(err) };
}

// ---------------------------------------------------------------------------
// Baggage propagation — correlationId
// ---------------------------------------------------------------------------

const BAGGAGE_KEY_CORRELATION_ID = 'heady.correlationId';
const BAGGAGE_KEY_SERVICE        = 'heady.service';
const BAGGAGE_KEY_DOMAIN         = 'heady.domain';

const baggagePropagator = new W3CBaggagePropagator();

/**
 * Inject the given correlation ID (and optional service/domain labels) into
 * the W3C baggage of the provided context so that downstream services can
 * retrieve it via `extractCorrelationId`.
 *
 * @example
 * ```ts
 * const enriched = injectCorrelationId(context.active(), requestId, {
 *   service: 'mcp-server',
 *   domain:  'headymcp.com',
 * });
 * // Pass enriched as parent context to withSpan({ ctx: enriched })
 * ```
 */
export function injectCorrelationId(
  ctx: Context,
  correlationId: string,
  meta?: { service?: string; domain?: string },
): Context {
  let baggage = propagation.getBaggage(ctx) ?? propagation.createBaggage();

  baggage = baggage.setEntry(BAGGAGE_KEY_CORRELATION_ID, { value: correlationId });

  if (meta?.service) {
    baggage = baggage.setEntry(BAGGAGE_KEY_SERVICE, { value: meta.service });
  }
  if (meta?.domain) {
    baggage = baggage.setEntry(BAGGAGE_KEY_DOMAIN, { value: meta.domain });
  }

  return propagation.setBaggage(ctx, baggage);
}

/**
 * Extract the Heady correlation ID from the current (or provided) OTel context.
 * Returns undefined when no baggage is present.
 */
export function extractCorrelationId(ctx?: Context): string | undefined {
  const bag = propagation.getBaggage(ctx ?? context.active());
  return bag?.getEntry(BAGGAGE_KEY_CORRELATION_ID)?.value;
}

/**
 * Inject W3C Trace-Context and Baggage headers into an outgoing carrier object
 * (e.g. HTTP headers Record). Uses the globally configured propagator which
 * Sentry v8 sets up automatically.
 *
 * @example
 * ```ts
 * const headers: Record<string, string> = {};
 * injectPropagationHeaders(headers);
 * await fetch(url, { headers });
 * ```
 */
export function injectPropagationHeaders(
  carrier: Record<string, string>,
  ctx?: Context,
): void {
  propagation.inject(ctx ?? context.active(), carrier, defaultTextMapSetter);
}

/**
 * Extract W3C Trace-Context and Baggage from an incoming carrier object and
 * return a context that can be passed as `ctx` to `withSpan`.
 *
 * @example
 * ```ts
 * const incomingCtx = extractPropagationHeaders(req.headers as Record<string, string>);
 * await withSpan('handle-request', { ctx: incomingCtx, attributes }, async (span) => { … });
 * ```
 */
export function extractPropagationHeaders(
  carrier: Record<string, string | string[] | undefined>,
): Context {
  return propagation.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter);
}

// ---------------------------------------------------------------------------
// TextMap getter/setter for plain Record<string, string> carriers
// ---------------------------------------------------------------------------

const defaultTextMapSetter: TextMapSetter<Record<string, string>> = {
  set(carrier, key, value) {
    carrier[key] = value;
  },
};

const defaultTextMapGetter: TextMapGetter<Record<string, string | string[] | undefined>> = {
  get(carrier, key) {
    const v = carrier[key];
    if (Array.isArray(v)) return v[0];
    return v;
  },
  keys(carrier) {
    return Object.keys(carrier);
  },
};

// ---------------------------------------------------------------------------
// Span kind re-exports (convenience — callers avoid importing @opentelemetry/api)
// ---------------------------------------------------------------------------

export { SpanKind, SpanStatusCode, context, trace };
export type { Span, Attributes, Context };
