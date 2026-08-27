// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Admin Guard — tests (SEC-002 deny-by-default)             ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";
import { createAdminGuard, sha256Digest } from "../src/index.mjs";

const TOKEN = "correct-horse-battery-staple-9f3a";

function fakeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

function req(headers = {}) {
  return { headers };
}

test("unarmed guard denies with 503 (fail-closed before resolution)", () => {
  const guard = createAdminGuard();
  // Pre-seed armPromise via a never-resolving loader so the middleware call
  // cannot fall through to the real @heady/secrets import.
  guard.armFromSecrets({ loadSecretsImpl: () => new Promise(() => {}) });
  const res = fakeRes();
  let nextCalled = false;
  guard.middleware(req({ "x-admin-token": TOKEN }), res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.ok, false);
  assert.equal(nextCalled, false);
});

test("failed resolution stays deny-all with state=failed", async () => {
  const guard = createAdminGuard();
  await guard.armFromSecrets({ loadSecretsImpl: async () => { throw new Error("secret resolution failed"); } });
  assert.deepEqual(guard.status().armed, false);
  assert.equal(guard.status().state, "failed");
  const res = fakeRes();
  guard.middleware(req({ "x-admin-token": TOKEN }), res, () => assert.fail("next must not run"));
  assert.equal(res.statusCode, 503);
});

test("armed guard rejects a wrong or missing credential with 401", async () => {
  const guard = createAdminGuard();
  await guard.armFromSecrets({ loadSecretsImpl: async () => ({ ADMIN_TOKEN: TOKEN }) });
  for (const headers of [{}, { "x-admin-token": "wrong-token-of-similar-len" }, { authorization: "Bearer nope" }]) {
    const res = fakeRes();
    guard.middleware(req(headers), res, () => assert.fail("next must not run"));
    assert.equal(res.statusCode, 401);
  }
});

test("armed guard passes the correct credential (header and bearer)", async () => {
  const guard = createAdminGuard();
  await guard.armFromSecrets({ loadSecretsImpl: async () => ({ ADMIN_TOKEN: TOKEN }) });
  for (const headers of [{ "x-admin-token": TOKEN }, { authorization: `Bearer ${TOKEN}` }]) {
    const res = fakeRes();
    let nextCalled = false;
    guard.middleware(req(headers), res, () => { nextCalled = true; });
    assert.equal(nextCalled, true, JSON.stringify(headers));
    assert.equal(res.statusCode, null);
  }
});

test("arm() accepts only a 32-byte digest and status never leaks values", async () => {
  const guard = createAdminGuard();
  assert.throws(() => guard.arm("raw-string"), TypeError);
  guard.arm(sha256Digest(TOKEN));
  const s = guard.status();
  assert.equal(s.armed, true);
  assert.equal(JSON.stringify(s).includes(TOKEN), false);
});
