// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Sentry Exporter v1.0.0 — envelope-API adapter              ║
// ║  Implements the observability `exporter` interface (span/error)     ║
// ║  against Sentry's envelope HTTP API directly — dependency-free,     ║
// ║  fire-and-forget, bounded, never throws into the caller. The        ║
// ║  X-Heady-Trace-Id is carried verbatim as tag `headyTraceId` (the    ║
// ║  GATE-2 visibility contract) and normalized into Sentry's 32-hex    ║
// ║  trace_id where it fits. © 2026 HeadySystems Inc. — Eric Haywood.  ║
// ╚══════════════════════════════════════════════════════════════════╝

import { randomUUID } from "node:crypto";

/** Parse a Sentry DSN (https://KEY@HOST/PROJECT) → envelope endpoint parts. */
export function parseDsn(dsn) {
  const u = new URL(dsn);
  const key = u.username;
  const projectId = u.pathname.replace(/\/+$/, "").split("/").pop();
  if (!key || !projectId) throw new TypeError("sentry-exporter: DSN must look like https://KEY@HOST/PROJECT_ID");
  return { key, projectId, endpoint: `${u.protocol}//${u.host}/api/${projectId}/envelope/?sentry_key=${key}&sentry_version=7` };
}

const hex32 = () => randomUUID().replaceAll("-", "");
/** Sentry trace_id must be 32 lowercase hex; UUIDs qualify with dashes stripped. */
const toTraceHex = (traceId) => {
  const s = String(traceId ?? "").toLowerCase().replaceAll("-", "");
  return /^[0-9a-f]{32}$/.test(s) ? s : hex32();
};

/**
 * Create a Sentry exporter. Fire-and-forget: sends never block or throw into
 * the caller; failures/drops only increment stats. `fetchImpl` injectable so
 * tests capture envelopes without a network.
 * @param {object} opts
 * @param {string} opts.dsn Sentry DSN (from vault/env — never hardcoded)
 * @param {string} [opts.release] release tag (git SHA / product version)
 * @param {string} [opts.environment]
 * @param {number} [opts.maxInFlight] bound on concurrent sends (drops beyond)
 * @param {typeof fetch} [opts.fetchImpl]
 */
export function createSentryExporter({ dsn, release, environment = "production", maxInFlight = 8, fetchImpl = fetch }) {
  const { endpoint } = parseDsn(dsn);
  const stats = { sent: 0, dropped: 0, failed: 0 };
  let inFlight = 0;

  function send(itemType, payload) {
    if (inFlight >= maxInFlight) { stats.dropped += 1; return; }
    const eventId = hex32();
    const envelope = [
      JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }),
      JSON.stringify({ type: itemType }),
      JSON.stringify({ event_id: eventId, platform: "node", release, environment, ...payload }),
    ].join("\n");
    inFlight += 1;
    Promise.resolve()
      .then(() => fetchImpl(endpoint, { method: "POST", headers: { "Content-Type": "application/x-sentry-envelope" }, body: envelope }))
      .then((res) => { stats[res?.ok ? "sent" : "failed"] += 1; })
      .catch(() => { stats.failed += 1; })
      .finally(() => { inFlight -= 1; });
  }

  return {
    /** exporter.span({name, traceId, durationMs, attrs}) → Sentry transaction. */
    span({ name, traceId, durationMs, attrs = {} }) {
      const end = Date.now() / 1000;
      send("transaction", {
        type: "transaction",
        transaction: name,
        start_timestamp: end - (durationMs ?? 0) / 1000,
        timestamp: end,
        contexts: { trace: { trace_id: toTraceHex(traceId), span_id: hex32().slice(0, 16), op: name } },
        tags: { headyTraceId: String(traceId ?? "") },
        extra: attrs,
      });
    },
    /** exporter.error(err, {traceId, ...context}) → Sentry error event. */
    error(err, { traceId, ...context } = {}) {
      send("event", {
        timestamp: new Date().toISOString(),
        level: "error",
        exception: { values: [{ type: err?.name ?? "Error", value: String(err?.message ?? err) }] },
        contexts: { trace: { trace_id: toTraceHex(traceId), span_id: hex32().slice(0, 16) } },
        tags: { headyTraceId: String(traceId ?? "") },
        extra: context,
      });
    },
    /** Observability of the observer: send outcomes, never values. */
    stats: () => ({ ...stats, inFlight }),
  };
}
