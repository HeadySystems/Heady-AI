// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Consistency Bus — Express adapter tests                   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";
import { createConsistencyMiddleware } from "../src/express.mjs";

// The middleware factory reads the real HeadyRegistry
// (.data/coherence/variable-registry.json). These tests exercise the adapter
// against it — the same index production traffic is checked against.

function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

function run(mw, { method = "GET", path = "/api/x", body, headers = {} } = {}) {
  const req = { method, path, body, headers };
  const res = fakeRes();
  let nexted = false;
  mw.middleware(req, res, () => { nexted = true; });
  return { req, res, nexted };
}

test("factory loads the real registry (or reports passthrough honestly)", () => {
  const mw = createConsistencyMiddleware();
  const s = mw.status();
  if (s.loaded) {
    assert.ok(s.linkedKeys > 0, "loaded index must have linked keys");
    assert.equal(s.error, null);
  } else {
    assert.ok(s.error, "unloaded index must carry the reason");
  }
});

test("GET traffic passes through and egress json still works", () => {
  const mw = createConsistencyMiddleware();
  const { res, nexted } = run(mw, { method: "GET" });
  assert.equal(nexted, true);
  res.json({ hello: "world" });
  assert.deepEqual(res.body, { hello: "world" });
});

test("locked-value drift on ingress is refused with 409 (fail-closed)", (t) => {
  const mw = createConsistencyMiddleware();
  if (!mw.status().loaded) return t.skip("registry unavailable in this environment");
  // embedding dim is a locked fact (canonical 384) — a drifted inbound value must BLOCK.
  const { res, nexted } = run(mw, {
    method: "POST",
    body: { embedding: { dim: 1536 } },
  });
  assert.equal(nexted, false, "drifted locked value must not reach the route");
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, "locked-value drift (consistency-bus)");
  assert.ok(Array.isArray(res.body.blocked) && res.body.blocked.length > 0);
});

test("authorized header permits the governed change channel", (t) => {
  const mw = createConsistencyMiddleware();
  if (!mw.status().loaded) return t.skip("registry unavailable in this environment");
  const blocked = run(mw, { method: "POST", body: { embedding: { dim: 1536 } } });
  assert.equal(blocked.res.statusCode, 409);
  const key = blocked.res.body.blocked[0].key;
  const { nexted } = run(mw, {
    method: "POST",
    body: { embedding: { dim: 1536 } },
    headers: { "x-heady-authorized-keys": key },
  });
  assert.equal(nexted, true, "naming the key in the authorized header must pass");
});

test("egress normalization rewrites a stale linked value to canonical", (t) => {
  const mw = createConsistencyMiddleware();
  if (!mw.status().loaded) return t.skip("registry unavailable in this environment");
  const { res, nexted } = run(mw, { method: "GET" });
  assert.equal(nexted, true);
  res.json({ embedding: { dim: 1536 } });
  assert.equal(res.body.embedding.dim, 384, "outbound stale value must be normalized to canon");
});

test("exempt paths are skipped entirely", (t) => {
  const mw = createConsistencyMiddleware({ exemptPaths: ["/api/codeflow"] });
  if (!mw.status().loaded) return t.skip("registry unavailable in this environment");
  const { nexted } = run(mw, {
    method: "POST",
    path: "/api/codeflow/proposals",
    body: { embedding: { dim: 1536 } },
  });
  assert.equal(nexted, true, "the governed channel owns linked-value changes");
});
