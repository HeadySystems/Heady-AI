// Integration tests for the scaffold sync API — shared decision state for web + CLI. `node --test`.
import { test } from "node:test";
import assert from "node:assert/strict";

import { createScaffoldServer } from "../src/server.mjs";
import { loadDecisions } from "../src/store.mjs";

async function withServer(fn) {
  const server = createScaffoldServer();
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { server.close(); }
}

test("GET /api/scaffold/plan returns a flattened build + summary for both interfaces", async () => {
  await withServer(async (base) => {
    const ai = await (await fetch(`${base}/api/scaffold/plan?build=ai`)).json();
    assert.equal(ai.build.kind, "rebuild");
    assert.ok(ai.options.length > 0 && ai.summary.total === ai.options.length);
    const v1 = await (await fetch(`${base}/api/scaffold/plan?build=v1`)).json();
    assert.equal(v1.build.kind, "legacy");
  });
});

test("POST /api/scaffold/decisions validates and persists to the shared overlay (CLI sees it)", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/scaffold/decisions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "p4.second-vector", decision: "deferred", note: "needs benchmark" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    // The CLI's store reads the SAME file → shared state, not a separate copy.
    assert.equal(loadDecisions()["p4.second-vector"].decision, "deferred");
  });
});

test("POST rejects an unknown id and a bad decision (fail-closed validation)", async () => {
  await withServer(async (base) => {
    const bad1 = await fetch(`${base}/api/scaffold/decisions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "nope", decision: "accepted" }) });
    assert.equal(bad1.status, 400);
    const bad2 = await fetch(`${base}/api/scaffold/decisions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "p3.codeflow", decision: "bogus" }) });
    assert.equal(bad2.status, 400);
  });
});

test("unknown route 404s", async () => {
  await withServer(async (base) => {
    assert.equal((await fetch(`${base}/api/scaffold/nope`)).status, 404);
  });
});
