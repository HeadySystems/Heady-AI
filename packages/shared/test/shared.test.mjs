// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Shared tests — node:test, zero deps                      ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  HeadyError, ValidationError, NotFoundError,
  ok, err, isOk, isErr, unwrap, mapResult,
  assert as hassert, makeHealth, HEALTH, isService, SERVICE_METHODS,
} from "../src/index.mjs";

test("HeadyError carries code/status/context and a leak-free toJSON", () => {
  const e = new ValidationError("bad input", { field: "kind" });
  assert.equal(e.code, "VALIDATION");
  assert.equal(e.status, 400);
  assert.deepEqual(e.toJSON(), { name: "ValidationError", code: "VALIDATION", status: 400, message: "bad input", context: { field: "kind" } });
  assert.ok(e instanceof HeadyError && e instanceof Error);
  assert.equal(new NotFoundError("x").status, 404);
});

test("Result ok/err/unwrap/map", () => {
  assert.ok(isOk(ok(1)) && isErr(err("e")));
  assert.equal(unwrap(ok(42)), 42);
  assert.throws(() => unwrap(err(new NotFoundError("nope"))), NotFoundError);
  assert.deepEqual(mapResult(ok(2), (x) => x * 3), ok(6));
  assert.deepEqual(mapResult(err("e"), (x) => x), err("e"));
});

test("assert throws ValidationError", () => {
  assert.throws(() => hassert(false, "must"), ValidationError);
  assert.doesNotThrow(() => hassert(true, "ok"));
});

test("makeHealth picks the worst check status", () => {
  assert.equal(makeHealth({ a: HEALTH.OK, b: HEALTH.OK }).status, HEALTH.OK);
  assert.equal(makeHealth({ a: HEALTH.OK, b: HEALTH.DEGRADED }).status, HEALTH.DEGRADED);
  assert.equal(makeHealth({ a: HEALTH.DOWN, b: HEALTH.OK }).status, HEALTH.DOWN);
});

test("isService enforces the Latent Service Pattern contract", () => {
  const noop = () => {};
  const svc = Object.fromEntries(SERVICE_METHODS.map((m) => [m, noop]));
  assert.ok(isService(svc));
  delete svc.metrics;
  assert.ok(!isService(svc));
  assert.ok(!isService(null));
});
