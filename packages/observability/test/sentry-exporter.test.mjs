// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Sentry Exporter tests — node:test, injected fetch         ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";
import { createSentryExporter, parseDsn } from "../src/sentry-exporter.mjs";

const DSN = "https://abc123key@o999.ingest.sentry.io/4501234";
const tick = () => new Promise((r) => setImmediate(r));

function capture() {
  const sent = [];
  const fetchImpl = async (url, opts) => { sent.push({ url, body: opts.body }); return { ok: true }; };
  return { sent, fetchImpl };
}
const lines = (body) => body.split("\n").map((l) => JSON.parse(l));

test("parseDsn extracts key/project and builds the envelope endpoint", () => {
  const { key, projectId, endpoint } = parseDsn(DSN);
  assert.equal(key, "abc123key");
  assert.equal(projectId, "4501234");
  assert.match(endpoint, /^https:\/\/o999\.ingest\.sentry\.io\/api\/4501234\/envelope\/\?sentry_key=abc123key/);
  assert.throws(() => parseDsn("https://host/only"), TypeError);
});

test("span → transaction envelope carrying headyTraceId verbatim + 32-hex trace_id", async () => {
  const { sent, fetchImpl } = capture();
  const ex = createSentryExporter({ dsn: DSN, release: "3.0.0", environment: "test", fetchImpl });
  const traceId = "8b7df143-d91c-4bbe-9a3c-0f8e1c2d3e4f";
  ex.span({ name: "tasks.enqueue", traceId, durationMs: 42, attrs: { kind: "gate2" } });
  await tick();
  assert.equal(sent.length, 1);
  const [head, item, payload] = lines(sent[0].body);
  assert.ok(head.event_id && head.sent_at);
  assert.equal(item.type, "transaction");
  assert.equal(payload.transaction, "tasks.enqueue");
  assert.equal(payload.tags.headyTraceId, traceId);
  assert.equal(payload.contexts.trace.trace_id, traceId.replaceAll("-", ""));
  assert.equal(payload.release, "3.0.0");
  assert.ok(payload.timestamp - payload.start_timestamp > 0.04);
  assert.equal(ex.stats().sent, 1);
});

test("error → event envelope with exception + trace tag; non-hex trace id degrades safely", async () => {
  const { sent, fetchImpl } = capture();
  const ex = createSentryExporter({ dsn: DSN, fetchImpl });
  ex.error(new RangeError("boom"), { traceId: "not-a-uuid", route: "POST /tasks" });
  await tick();
  const [, item, payload] = lines(sent[0].body);
  assert.equal(item.type, "event");
  assert.equal(payload.exception.values[0].type, "RangeError");
  assert.equal(payload.exception.values[0].value, "boom");
  assert.equal(payload.tags.headyTraceId, "not-a-uuid"); // verbatim visibility
  assert.match(payload.contexts.trace.trace_id, /^[0-9a-f]{32}$/); // valid fallback
  assert.equal(payload.extra.route, "POST /tasks");
});

test("fire-and-forget: fetch failures never throw, only count", async () => {
  const ex = createSentryExporter({ dsn: DSN, fetchImpl: async () => { throw new Error("net down"); } });
  ex.span({ name: "x", traceId: null, durationMs: 1 });
  await tick();
  assert.equal(ex.stats().failed, 1);
});

test("bounded in-flight: drops beyond maxInFlight instead of queueing unbounded", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const ex = createSentryExporter({ dsn: DSN, maxInFlight: 2, fetchImpl: () => gate.then(() => ({ ok: true })) });
  ex.span({ name: "a", durationMs: 1 }); ex.span({ name: "b", durationMs: 1 }); ex.span({ name: "c", durationMs: 1 });
  assert.equal(ex.stats().dropped, 1);
  release({ ok: true });
  await tick();
});
