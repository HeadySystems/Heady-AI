// Unit tests for @heady/headylens — normalization, redaction, detail tiers, stores, collector. `node --test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DETAIL, normalizeEvent, normalizeLog, normalizeSpan, normalizeError, matchesFilter, redact,
} from "../src/record.mjs";
import { RingStore, NdjsonStore, multiStore } from "../src/store.mjs";
import { createCollector, } from "../src/collector.mjs";
import { createLens } from "../src/index.mjs";

test("redact masks secret-named keys and emails at any depth", () => {
  const out = redact({ token: "abc", email: "eric@x.com", nested: { password: "p", ok: 1 } });
  assert.equal(out.token, "[REDACTED:token]");
  assert.equal(out.email, "e***@x.com");
  assert.equal(out.nested.password, "[REDACTED:password]");
  assert.equal(out.nested.ok, 1);
});

test("normalizeEvent redacts payload and grades reasoning vs routing vs system", () => {
  const r = normalizeEvent({ subject: "agent.coder.step", payload: { apiKey: "sk-x", thought: "plan" }, traceId: "t1", ts: "2026-06-16T00:00:00.000Z" });
  assert.equal(r.channel, "event");
  assert.equal(r.detailTier, DETAIL.VERBOSE, "agent reasoning is verbose-tier");
  assert.equal(r.payload.apiKey, "[REDACTED:apiKey]");
  assert.equal(normalizeEvent({ subject: "heady.action.route", ts: "x" }).detailTier, DETAIL.NORMAL);
  assert.equal(normalizeEvent({ subject: "heady.system.boot", ts: "x" }).detailTier, DETAIL.SUMMARY);
});

test("normalizeLog maps levels to tiers and strips the secret fields", () => {
  assert.equal(normalizeLog({ levelName: "error", time: "2026-06-16T00:00:00Z", msg: "boom" }).detailTier, DETAIL.SUMMARY);
  assert.equal(normalizeLog({ levelName: "trace", time: "2026-06-16T00:00:00Z" }).detailTier, DETAIL.FORENSIC);
  const r = normalizeLog({ levelName: "info", time: "2026-06-16T00:00:00Z", token: "x", route: "/a" });
  assert.equal(r.payload.token, "[REDACTED:token]");
  assert.equal(r.payload.route, "/a");
});

test("normalizeSpan / normalizeError land in the right tiers", () => {
  assert.equal(normalizeSpan({ name: "embed", traceId: "t", durationMs: 12 }).detailTier, DETAIL.VERBOSE);
  assert.equal(normalizeError(new Error("nope"), { traceId: "t" }).detailTier, DETAIL.SUMMARY);
});

test("matchesFilter honors time window, maxDetail, trace, subjectPrefix", () => {
  const rec = { tsMs: 100, detailTier: DETAIL.VERBOSE, traceId: "t1", subject: "agent.x" };
  assert.equal(matchesFilter(rec, { maxDetail: DETAIL.NORMAL }), false, "verbose hidden at normal");
  assert.equal(matchesFilter(rec, { maxDetail: DETAIL.FORENSIC }), true);
  assert.equal(matchesFilter(rec, { sinceMs: 200 }), false);
  assert.equal(matchesFilter(rec, { traceId: "other" }), false);
  assert.equal(matchesFilter(rec, { subjectPrefix: "agent." }), true);
});

test("RingStore evicts by capacity and by age", () => {
  let t = 1000;
  const ring = new RingStore({ capacity: 2, maxAgeMs: 500, now: () => t });
  ring.append({ tsMs: 600, detailTier: 0 });
  ring.append({ tsMs: 800, detailTier: 0 });
  ring.append({ tsMs: 900, detailTier: 0 }); // capacity 2 → drops 600
  assert.equal(ring.size, 2);
  t = 2000; // now-maxAge = 1500 → all older than 1500 evicted on next append
  ring.append({ tsMs: 1900, detailTier: 0 });
  assert.equal(ring.size, 1, "age eviction dropped the stale records");
});

test("NdjsonStore persists, queries, and supports right-to-erasure", () => {
  const dir = mkdtempSync(join(tmpdir(), "lens-"));
  try {
    const s = new NdjsonStore({ path: join(dir, "lens.ndjson") });
    s.append({ tsMs: 1, traceId: "a", detailTier: 0, subject: "x" });
    s.append({ tsMs: 2, traceId: "b", detailTier: 0, subject: "y" });
    assert.equal(s.size, 2);
    assert.equal(s.query({ traceId: "a" }).length, 1);
    assert.equal(s.eraseByTrace("a"), 1, "erased one record by trace");
    assert.equal(s.size, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("collector records, fans out live, queries time-ordered, and erases", () => {
  const collector = createLens({ now: () => 5000 });
  const seen = [];
  const unsub = collector.subscribe((r) => seen.push(r), { maxDetail: DETAIL.NORMAL });
  collector.record(normalizeEvent({ subject: "heady.action.route", payload: { to: "coder" }, traceId: "t1", ts: "2026-06-16T00:00:00Z" }, 1));
  collector.record(normalizeEvent({ subject: "agent.coder.step", payload: { thought: "x" }, traceId: "t1", ts: "2026-06-16T00:00:01Z" }, 2));
  assert.equal(seen.length, 1, "live subscriber at NORMAL detail skipped the VERBOSE agent record");
  assert.equal(collector.query({ maxDetail: DETAIL.FORENSIC }).length, 2);
  assert.equal(collector.query({ subjectPrefix: "agent." }).length, 1);
  unsub();
  assert.equal(collector.eraseByTrace("t1"), 2);
  assert.equal(collector.size, 0);
});

test("multiStore fans writes to all stores", () => {
  const a = new RingStore({ capacity: 10, maxAgeMs: Number.MAX_SAFE_INTEGER });
  const b = new RingStore({ capacity: 10, maxAgeMs: Number.MAX_SAFE_INTEGER });
  const m = multiStore(a, b);
  m.append({ tsMs: 1, detailTier: 0 });
  assert.equal(a.size, 1);
  assert.equal(b.size, 1);
});
