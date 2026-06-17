// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ HeadyLens — Record core v1.0.0                            ║
// ║  Pure normalization + redaction + φ-graded detail tiers. The one  ║
// ║  unified shape every channel collapses into. Display/diagnostic   ║
// ║  ONLY — never the audit-of-record (signed receipts/playback are   ║
// ║  the G5/G9 patent surface, deferred). © 2026 HeadySystems Inc.    ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Dependency-free (node only). Redaction MUST run here at ingest because — unlike @heady/logger —
// the events bus and observability spans are NOT redacted upstream (advisor gate #2). A
// capture-everything surface that skipped this would persist secrets/PII.

// Detail tiers — what the user "dials". A query for tier N returns every record with detailTier ≤ N,
// so tier 0 is the terse heartbeat and tier 3 is forensic (full payloads, reasoning, trace lines).
export const DETAIL = Object.freeze({ SUMMARY: 0, NORMAL: 1, VERBOSE: 2, FORENSIC: 3 });
export const DETAIL_NAMES = Object.freeze(["summary", "normal", "verbose", "forensic"]);

// Mirror of @heady/logger's redaction set (kept identical, not a weaker fork — ARBITER condition).
const REDACT_NAMES = new Set(
  ["authorization", "password", "token", "apikey", "apiKey", "secret", "cookie"].map((s) => s.toLowerCase()),
);

function maskEmail(v) {
  return typeof v === "string" && v.includes("@")
    ? v.replace(/^(.).*(@.*)$/, (_, a, b) => `${a}***${b}`)
    : v;
}

/** Recursively redact secret-named keys and mask emails (depth-bounded). Identical to logger.redact. */
export function redact(value, depth = 0) {
  if (depth > 8 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const lower = k.toLowerCase();
    if (REDACT_NAMES.has(lower)) out[k] = `[REDACTED:${k}]`;
    else if (lower === "email") out[k] = maskEmail(v);
    else out[k] = redact(v, depth + 1);
  }
  return out;
}

const LEVEL_TIER = Object.freeze({
  fatal: DETAIL.SUMMARY, error: DETAIL.SUMMARY,
  warn: DETAIL.NORMAL, info: DETAIL.NORMAL,
  debug: DETAIL.VERBOSE, trace: DETAIL.FORENSIC,
});

/** Detail tier for an event subject — routing/system are normal; agent reasoning is forensic-leaning. */
export function eventTier(subject = "") {
  if (subject.startsWith("heady.system.")) return DETAIL.SUMMARY;
  if (subject.startsWith("heady.action.")) return DETAIL.NORMAL; // routing/decisions surface
  if (subject.startsWith("heady.observation.")) return DETAIL.VERBOSE; // workers/nodes telemetry
  if (subject.startsWith("agent.")) return DETAIL.VERBOSE; // reasoning steps
  return DETAIL.NORMAL;
}

function tsMsOf(iso, fallbackNow) {
  const t = typeof iso === "string" ? Date.parse(iso) : typeof iso === "number" ? iso : NaN;
  return Number.isFinite(t) ? t : fallbackNow;
}

/** Base builder — assigns the unified shape and redacts the payload. `now` injectable. */
function lensRecord({ tsMs, traceId, source, channel, subject, level, detailTier, summary, payload }) {
  return {
    tsMs,
    ts: new Date(tsMs).toISOString(),
    traceId: traceId ?? null,
    source: source ?? "heady",
    channel, // "event" | "log" | "span" | "error"
    subject: subject ?? null,
    level: level ?? null,
    detailTier,
    summary: String(summary ?? "").slice(0, 240),
    payload: redact(payload ?? {}),
  };
}

/** Normalize a @heady/events envelope { subject, payload, traceId, source, ts }. */
export function normalizeEvent(ev, now = Date.now()) {
  return lensRecord({
    tsMs: tsMsOf(ev.ts, now),
    traceId: ev.traceId,
    source: ev.source,
    channel: "event",
    subject: ev.subject,
    detailTier: eventTier(ev.subject),
    summary: `${ev.subject}`,
    payload: ev.payload,
  });
}

/** Normalize a @heady/logger NDJSON record { time, levelName, traceId, msg, ...fields }. */
export function normalizeLog(rec, now = Date.now()) {
  const { time, levelName, level, traceId, msg, service, ...fields } = rec;
  return lensRecord({
    tsMs: tsMsOf(time, now),
    traceId,
    source: service ?? "heady",
    channel: "log",
    level: levelName ?? null,
    detailTier: LEVEL_TIER[levelName] ?? DETAIL.NORMAL,
    summary: msg ?? levelName ?? "log",
    payload: fields,
  });
}

/** Normalize a @heady/observability span { name, traceId, durationMs, attrs }. */
export function normalizeSpan(span, now = Date.now()) {
  return lensRecord({
    tsMs: now,
    traceId: span.traceId,
    channel: "span",
    subject: `span.${span.name}`,
    detailTier: DETAIL.VERBOSE,
    summary: `span ${span.name} ${span.durationMs}ms`,
    payload: { durationMs: span.durationMs, attrs: span.attrs ?? {} },
  });
}

/** Normalize an observability error report. */
export function normalizeError(error, context = {}, now = Date.now()) {
  return lensRecord({
    tsMs: now,
    traceId: context.traceId,
    channel: "error",
    detailTier: DETAIL.SUMMARY,
    level: "error",
    summary: error?.message ? `error: ${error.message}` : "error",
    payload: { name: error?.name ?? "Error", stack: error?.stack ?? null, context },
  });
}

/** Does a record pass a query filter? Pure — used by every store impl and the live tail. */
export function matchesFilter(rec, { sinceMs, untilMs, maxDetail, traceId, subjectPrefix } = {}) {
  if (sinceMs != null && rec.tsMs < sinceMs) return false;
  if (untilMs != null && rec.tsMs > untilMs) return false;
  if (maxDetail != null && rec.detailTier > maxDetail) return false;
  if (traceId && rec.traceId !== traceId) return false;
  if (subjectPrefix && !(rec.subject ?? "").startsWith(subjectPrefix)) return false;
  return true;
}
