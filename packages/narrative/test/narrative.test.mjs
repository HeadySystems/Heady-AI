// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Narrative tests — node:test                              ║
// ║  Proves: beats publish typed events on the real subject prefix,   ║
// ║  HeadyLens captures + filters them, and narrateStep brackets work.║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryBus } from "@heady/events";
import { createCollector, RingStore } from "@heady/headylens";
import { CSL_THRESHOLDS } from "@heady/phi-math";
import { createNarrator, narrateStep, NARRATIVE_PREFIX, BEAT } from "../src/index.mjs";

function harness() {
  const bus = new InMemoryBus();
  const collector = createCollector({ store: new RingStore({ capacity: 100 }) });
  collector.attachEvents(bus); // exactly how the host wires HeadyLens to the spine
  const n = createNarrator(bus, { traceId: "t-build", build: "phase1" });
  return { bus, collector, n };
}

test("createNarrator rejects a non-bus", () => {
  assert.throws(() => createNarrator({}), /event bus/);
});

test("beats publish typed events under the canonical prefix", async () => {
  const { collector, n } = harness();
  await n.plan("scope", "Scope the work");
  await n.start("compile", "Compiling");
  await n.done("compile", "Compiling — done", { durationMs: 5 });

  const recs = collector.query({ subjectPrefix: NARRATIVE_PREFIX, maxDetail: 3 });
  assert.equal(recs.length, 3);
  assert.ok(recs.every((r) => r.subject.startsWith(NARRATIVE_PREFIX)));
  assert.ok(recs.every((r) => r.traceId === "t-build"));
  assert.equal(recs[0].subject, "heady.action.build.plan");
  assert.equal(recs[1].subject, "heady.action.build.start");
  // payload carries the human story + the build label
  assert.equal(recs[2].payload.build, "phase1");
  assert.equal(recs[2].payload.step, "compile");
  assert.equal(recs[2].payload.durationMs, 5);
});

test("gate derives passed from score vs threshold", async () => {
  const { collector, n } = harness();
  await n.gate("judge", "Quality gate", { score: 0.9 });
  await n.gate("judge", "Quality gate", { score: 0.5 });
  const [pass, fail] = collector.query({ subjectPrefix: NARRATIVE_PREFIX });
  assert.equal(pass.payload.threshold, CSL_THRESHOLDS.MEDIUM);
  assert.equal(pass.payload.passed, true);
  assert.equal(fail.payload.passed, false);
});

test("decision requires a rationale and carries it", async () => {
  const { collector, n } = harness();
  assert.throws(() => n.decision("route", "Chose HeadyLens", ""), /rationale/); // validates synchronously
  await n.decision("route", "Reuse HeadyLens as the spine", "one authority per concern");
  const [d] = collector.query({ subjectPrefix: NARRATIVE_PREFIX });
  assert.equal(d.payload.beat, BEAT.DECISION);
  assert.equal(d.payload.rationale, "one authority per concern");
});

test("unknown beat kind is rejected", async () => {
  const { n } = harness();
  assert.throws(() => n.beat("nope", "x", "y"), /unknown narrative beat/); // validates synchronously
});

test("narrateStep brackets success with start+done and a duration", async () => {
  const { collector, n } = harness();
  const out = await narrateStep(n, "embed", "Embedding fragments", async () => 42);
  assert.equal(out, 42);
  const recs = collector.query({ subjectPrefix: NARRATIVE_PREFIX });
  assert.equal(recs.length, 2);
  assert.equal(recs[0].subject, "heady.action.build.start");
  assert.equal(recs[1].subject, "heady.action.build.done");
  assert.equal(typeof recs[1].payload.durationMs, "number");
});

test("narrateStep emits a fail beat then rethrows", async () => {
  const { collector, n } = harness();
  await assert.rejects(
    () => narrateStep(n, "deploy", "Deploying", async () => { throw new Error("boom"); }),
    /boom/,
  );
  const recs = collector.query({ subjectPrefix: NARRATIVE_PREFIX });
  assert.equal(recs.at(-1).subject, "heady.action.build.fail");
  assert.equal(recs.at(-1).payload.error, "boom");
});

test("redaction at the lens still applies to narrative payloads", async () => {
  const { collector, n } = harness();
  await n.start("auth", "Authenticating", { token: "supersecret", email: "eric@heady.dev" });
  const [r] = collector.query({ subjectPrefix: NARRATIVE_PREFIX });
  assert.equal(r.payload.token, "[REDACTED:token]");
  assert.ok(r.payload.email.startsWith("e***@"));
});
