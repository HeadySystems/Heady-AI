// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ HeadyLens — Collector + taps v1.0.0                       ║
// ║  Unifies @heady/events + @heady/logger + @heady/observability via ║
// ║  their EXISTING hooks (no duplication) into one time-ordered       ║
// ║  store + a live fan-out for the SSE tail. © 2026 HeadySystems     ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Completeness note (advisor gate #1): the EVENT BUS is the comprehensive spine — events are NOT
// sampled, so subscribing to `>` captures everything published. The logger sink is SUPPLEMENTARY:
// @heady/logger φ-samples debug/trace at the source, so sub-sample low-level lines never reach the
// sink and are not recoverable here. For guaranteed capture of a reasoning/routing step, emit it as
// a bus event (heady.action.*, agent.*, heady.observation.*), not only a debug log.

import {
  normalizeEvent, normalizeLog, normalizeSpan, normalizeError, matchesFilter,
} from "./record.mjs";

/** Create a collector over a pluggable store. `now` injectable for deterministic tests. */
export function createCollector({ store, now = Date.now } = {}) {
  if (!store) throw new Error("createCollector requires a store");
  const listeners = new Set();

  /** Append a normalized record and fan out to live subscribers. Never throws into a tap. */
  function record(rec) {
    store.append(rec);
    for (const l of listeners) {
      try { l(rec); } catch { /* a bad live subscriber never blocks ingest */ }
    }
    return rec;
  }

  /** Subscribe to the live stream (optionally filtered). Returns an unsubscribe fn. */
  function subscribe(listener, filter) {
    const wrapped = filter ? (rec) => { if (matchesFilter(rec, filter)) listener(rec); } : listener;
    listeners.add(wrapped);
    return () => listeners.delete(wrapped);
  }

  return {
    record,
    subscribe,
    query: (filter) => store.query(filter),
    prune: (beforeMs) => store.prune(beforeMs),
    eraseByTrace: (traceId) => store.eraseByTrace(traceId),
    get size() { return store.size; },
    // ── Taps: wire the three substrates via their public extension points ──
    /** Subscribe the collector to every event on a @heady/events bus (the comprehensive spine). */
    attachEvents(bus) {
      return bus.subscribe(">", (ev) => record(normalizeEvent(ev, now())));
    },
    /** A @heady/logger `sink` (receives one NDJSON string per line). Supplementary — see note above. */
    loggerSink() {
      return (line) => {
        try { record(normalizeLog(JSON.parse(line), now())); } catch { /* never break the logger */ }
      };
    },
    /** A @heady/observability `exporter` ({ span, error }). Spans/errors are unsampled. */
    observabilityExporter() {
      return {
        span: (span) => { try { record(normalizeSpan(span, now())); } catch { /* never break caller */ } },
        error: (err, ctx) => { try { record(normalizeError(err, ctx, now())); } catch { /* never break caller */ } },
      };
    },
  };
}
