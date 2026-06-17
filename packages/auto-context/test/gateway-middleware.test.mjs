// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Auto-Context Gateway Middleware tests — node:test        ║
// ║  Proves Law 4 is STRUCTURAL: the wrapped gateway always attaches  ║
// ║  a capsule, narrates the beats, gates on coherence, and an        ║
// ║  un-enriched request is rejected. © 2026 HeadySystems Inc.       ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";

import { DIM } from "@heady/csl-engine";
import { InMemoryBus } from "@heady/events";
import { createCollector, RingStore } from "@heady/headylens";
import { wrapGateway, assertEnriched } from "../src/gateway-middleware.mjs";

function unit(seed) {
  const v = new Array(DIM).fill(0).map((_, i) => Math.sin(seed * (i + 1)));
  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / mag);
}
const BASE = unit(1);
function atCosine(base, cos, seed) {
  const noise = unit(seed);
  const m = base.map((b, i) => cos * b + (1 - cos) * noise[i]);
  const mag = Math.sqrt(m.reduce((s, x) => s + x * x, 0));
  return m.map((x) => x / mag);
}
function frag(id, cos, seed) {
  return { id, content: id, embedding: atCosine(BASE, cos, seed), source: "vector", metadata: {} };
}
const retrieverOf = (frags) => ({ retrieve: async (_t, { limit }) => frags.slice(0, limit) });

// A fake gateway whose methods record the request they received.
function fakeGateway() {
  const seen = {};
  return {
    seen,
    async complete(req) { seen.complete = req; return { ok: true, via: "complete" }; },
    async battle(req) { seen.battle = req; return { ok: true, via: "battle" }; },
    async council(req) { seen.council = req; return { ok: true, via: "council" }; },
    passthrough() { return "untouched"; },
  };
}

const req = (extra = {}) => ({ prompt: "build the thing", embedding: BASE, traceId: "t-mw", ...extra });

test("wrapGateway attaches a capsule before complete() runs", async () => {
  const gw = fakeGateway();
  const wrapped = wrapGateway(gw, { retriever: retrieverOf([frag("a", 0.95, 2), frag("b", 0.93, 3)]) });
  const out = await wrapped.complete(req());
  assert.deepEqual(out, { ok: true, via: "complete" });
  // The ORIGINAL gateway saw an enriched request — Law 4 held structurally.
  const cap = assertEnriched(gw.seen.complete);
  assert.equal(cap.profile, "stage");
  assert.ok(cap.items.length >= 1);
});

test("each method uses its mapped profile", async () => {
  const gw = fakeGateway();
  const frags = [frag("a", 0.95, 2), frag("b", 0.94, 3), frag("c", 0.93, 4)];
  const wrapped = wrapGateway(gw, { retriever: retrieverOf(frags) });
  await wrapped.battle(req());
  await wrapped.council(req());
  assert.equal(gw.seen.battle.autoContext.profile, "battle");
  assert.equal(gw.seen.council.autoContext.profile, "council");
});

test("passthrough methods are untouched", () => {
  const gw = fakeGateway();
  const wrapped = wrapGateway(gw, { retriever: retrieverOf([]) });
  assert.equal(wrapped.passthrough(), "untouched");
});

test("missing embedding on the request is a loud Law-4 violation", async () => {
  const gw = fakeGateway();
  const wrapped = wrapGateway(gw, { retriever: retrieverOf([]) });
  await assert.rejects(() => wrapped.complete({ prompt: "x", traceId: "t" }), /embedding.*Law 4/);
});

test("coherence below the halt floor refuses to reason", async () => {
  const gw = fakeGateway();
  // Items pass the stage gate (LOW 0.691) but sit below the halt floor we set artificially high.
  const wrapped = wrapGateway(gw, {
    retriever: retrieverOf([frag("a", 0.72, 2)]),
    haltBelow: 0.99,
  });
  await assert.rejects(() => wrapped.complete(req()), /coherence below halt floor/);
  assert.equal(gw.seen.complete, undefined, "gateway never invoked");
});

test("narrative beats land in HeadyLens under heady.action.build.*", async () => {
  const gw = fakeGateway();
  const bus = new InMemoryBus();
  const lens = createCollector({ store: new RingStore({ capacity: 100 }) });
  lens.attachEvents(bus);
  const wrapped = wrapGateway(gw, {
    retriever: retrieverOf([frag("a", 0.95, 2)]),
    bus,
    build: "phase1-autocontext",
  });
  await wrapped.complete(req());
  const story = lens.query({ subjectPrefix: "heady.action.build.", maxDetail: 3 });
  const subjects = story.map((r) => r.subject);
  assert.ok(subjects.includes("heady.action.build.start"));
  assert.ok(subjects.includes("heady.action.build.gate"));
  assert.ok(subjects.includes("heady.action.build.done"));
  assert.ok(story.every((r) => r.traceId === "t-mw"));
});

test("assertEnriched rejects an un-enriched request", () => {
  assert.throws(() => assertEnriched({ prompt: "x" }), /Law 4 violation/);
});
