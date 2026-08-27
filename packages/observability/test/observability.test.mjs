// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Observability tests — node:test, dep: @heady/logger      ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";

import { Metrics, startSpan, captureError } from "../src/index.mjs";
import { runWithTrace } from "@heady/logger";

test("counters / gauges / histograms record and snapshot", () => {
  const m = new Metrics();
  m.counter("hits").inc();
  m.counter("hits").inc(2);
  m.gauge("queue").set(7);
  m.histogram("lat").observe(10);
  m.histogram("lat").observe(20);
  const s = m.snapshot();
  assert.equal(s.counters.hits, 3);
  assert.equal(s.gauges.queue, 7);
  assert.equal(s.histograms.lat.count, 2);
  assert.equal(s.histograms.lat.avg, 15);
  assert.equal(s.histograms.lat.max, 20);
});

test("startSpan measures duration into a histogram and forwards to exporter", () => {
  const m = new Metrics();
  let t = 1000;
  const seen = [];
  const span = startSpan("embed", { kind: "doc" }, { registry: m, now: () => t, exporter: { span: (sp) => seen.push(sp), error() {} } });
  t = 1042;
  const result = span.end({ ok: true });
  assert.equal(result.name, "embed");
  assert.equal(result.durationMs, 42);
  assert.equal(result.attrs.kind, "doc");
  assert.equal(result.attrs.ok, true);
  assert.equal(m.snapshot().histograms["span.embed.ms"].count, 1);
  assert.equal(seen.length, 1);
});

test("span binds the current trace id", () => {
  const m = new Metrics();
  let t = 0;
  runWithTrace("trace-9", () => {
    const sp = startSpan("op", {}, { registry: m, now: () => t });
    assert.equal(sp.end().traceId, "trace-9");
  });
});

test("captureError counts and never throws even if exporter throws", () => {
  const m = new Metrics();
  assert.doesNotThrow(() => captureError(new Error("x"), {}, { registry: m, exporter: { span() {}, error() { throw new Error("exporter down"); } } }));
  assert.equal(m.snapshot().counters["errors.total"], 1);
});
