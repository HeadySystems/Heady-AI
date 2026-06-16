// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Events tests — node:test, dep: @heady/shared             ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";

import { SUBJECT, subjectMatches, buildEvent, InMemoryBus, projectOutbox } from "../src/index.mjs";

test("subject builders", () => {
  assert.equal(SUBJECT.observation("task.done"), "heady.observation.task.done");
  assert.equal(SUBJECT.agent("coder.plan"), "agent.coder.plan");
});

test("subjectMatches honors * and > wildcards", () => {
  assert.ok(subjectMatches("agent.coder.*", "agent.coder.plan"));
  assert.ok(!subjectMatches("agent.coder.*", "agent.coder.plan.extra"));
  assert.ok(subjectMatches("heady.observation.>", "heady.observation.task.done"));
  assert.ok(subjectMatches("heady.>", "heady.action.x"));
  assert.ok(!subjectMatches("heady.action.x", "heady.action.y"));
  assert.ok(subjectMatches("a.b.c", "a.b.c"));
});

test("buildEvent shapes a typed envelope", () => {
  const e = buildEvent("heady.action.task.submitted", { kind: "x" }, { traceId: "t1", now: () => "T" });
  assert.equal(e.subject, "heady.action.task.submitted");
  assert.equal(e.traceId, "t1");
  assert.equal(e.ts, "T");
  assert.deepEqual(e.payload, { kind: "x" });
  assert.throws(() => buildEvent(null), /subject required/);
});

test("InMemoryBus delivers to wildcard subscribers, isolates handler errors", async () => {
  const bus = new InMemoryBus();
  const got = [];
  bus.subscribe("heady.observation.>", (e) => got.push(e.subject));
  bus.subscribe("heady.observation.task.*", () => { throw new Error("bad subscriber"); });
  const r = await bus.publish("heady.observation.task.done", { ok: true }, { now: () => "T" });
  assert.equal(r.delivered, 2);
  assert.equal(r.errors.length, 1); // one handler threw, the other still ran
  assert.deepEqual(got, ["heady.observation.task.done"]);
});

test("unsubscribe stops delivery", async () => {
  const bus = new InMemoryBus();
  let n = 0;
  const off = bus.subscribe("a.>", () => { n++; });
  await bus.publish("a.b", {});
  off();
  await bus.publish("a.b", {});
  assert.equal(n, 1);
});

test("projectOutbox publishes rows by topic", async () => {
  const bus = new InMemoryBus();
  const seen = [];
  bus.subscribe("heady.observation.>", (e) => seen.push(e.subject));
  const res = await projectOutbox(
    [{ seq: 1, topic: "heady.observation.task.done", payload: {} }, { seq: 2, topic: "heady.observation.embed.done", payload: {} }],
    bus,
  );
  assert.equal(res.length, 2);
  assert.deepEqual(seen.sort(), ["heady.observation.embed.done", "heady.observation.task.done"]);
});
