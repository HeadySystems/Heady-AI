// heady-manager — intelligence stack wiring tests. node:test, no extra deps.
import { test } from "node:test";
import assert from "node:assert/strict";
import { HEALTH } from "@heady/shared";
import { createApp } from "../src/app.mjs";

test("intelligence stack self-check: every component ok", async () => {
  const a = createApp({ port: 0 });
  const h = await a.intel.selfCheck();
  assert.equal(h.status, HEALTH.OK, `stack should be ok; got ${JSON.stringify(h.checks)}`);
  for (const c of ["csl-engine", "embedding", "events", "perspective", "auto-context"]) {
    assert.equal(h.checks[c], HEALTH.OK, `${c} should be ok`);
  }
});

test("GET /intelligence reports the stack over HTTP", async () => {
  const a = createApp({ port: 0 });
  await a.start();
  const { port } = a.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/intelligence`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, HEALTH.OK);
    assert.equal(Object.keys(body.components).length, 5);
  } finally { await a.stop(); }
});

test("real cross-package enrichment runs (csl + embedding + auto-context)", async () => {
  const a = createApp({ port: 0 });
  const capsule = await a.intel.enricher.enrich(
    { text: "what is the retrieval authority", embedding: a.intel.embed384("what is the retrieval authority") },
    "stage",
  );
  assert.equal(typeof capsule.considered, "number");
  assert.ok(capsule.considered > 0, "should consider seeded corpus fragments");
});
