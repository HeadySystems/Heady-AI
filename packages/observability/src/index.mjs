// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Observability v1.0.0 — metrics + spans                   ║
// ║  Vendor-neutral core; OTel + Sentry + Langfuse exporters wire on  ║
// ║  top. © 2026 HeadySystems Inc. — Eric Haywood, Founder            ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Dependency-free metrics registry + span timer. Trace ids come from
// @heady/logger's async context. Real exporters (OpenTelemetry OTLP, Sentry,
// Langfuse) implement the `exporter` interface; the default is a no-op.

import { currentTraceId } from "@heady/logger";

/** In-memory metrics registry: counters, gauges, histograms. */
export class Metrics {
  constructor() { this.counters = new Map(); this.gauges = new Map(); this.histograms = new Map(); }
  counter(name) {
    return { inc: (n = 1) => this.counters.set(name, (this.counters.get(name) ?? 0) + n) };
  }
  gauge(name) {
    return { set: (v) => this.gauges.set(name, v) };
  }
  histogram(name) {
    return {
      observe: (v) => {
        const h = this.histograms.get(name) ?? { count: 0, sum: 0, min: Infinity, max: -Infinity };
        h.count += 1; h.sum += v; h.min = Math.min(h.min, v); h.max = Math.max(h.max, v);
        this.histograms.set(name, h);
      },
    };
  }
  snapshot() {
    const hist = {};
    for (const [k, h] of this.histograms) hist[k] = { ...h, avg: h.count ? h.sum / h.count : 0 };
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: hist,
    };
  }
}

export const metrics = new Metrics();

/** No-op exporter; OTel/Sentry/Langfuse adapters replace this. */
export const noopExporter = Object.freeze({ span: () => {}, error: () => {} });

/**
 * Start a span. Returns `{ end(attrs?) }`; on end it records the duration to a
 * `span.<name>.ms` histogram and forwards to the exporter (with the current
 * trace id). `now` injectable for deterministic tests.
 */
export function startSpan(name, attrs = {}, { exporter = noopExporter, registry = metrics, now = () => Date.now() } = {}) {
  const startedAt = now();
  const traceId = currentTraceId() ?? null;
  return {
    end(endAttrs = {}) {
      const durationMs = now() - startedAt;
      registry.histogram(`span.${name}.ms`).observe(durationMs);
      const span = { name, traceId, durationMs, attrs: { ...attrs, ...endAttrs } };
      try { exporter.span(span); } catch { /* exporter must never break the caller */ }
      return span;
    },
  };
}

/** Report an error to the exporter (Sentry adapter, etc.) without throwing. */
export function captureError(error, context = {}, { exporter = noopExporter, registry = metrics } = {}) {
  registry.counter("errors.total").inc();
  try { exporter.error(error, { traceId: currentTraceId() ?? null, ...context }); } catch { /* never throw */ }
}
