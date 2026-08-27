// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Kernel tests — node:test, deps: shared, resilience, logger║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";

import { Kernel, defineService } from "../src/index.mjs";
import { ValidationError, HEALTH } from "@heady/shared";

function svc(name, deps, hooks = {}) {
  return defineService({
    name, deps,
    start: hooks.start ?? (async () => {}),
    stop: hooks.stop ?? (async () => {}),
    health: hooks.health ?? (async () => ({ status: HEALTH.OK })),
    metrics: hooks.metrics ?? (async () => ({})),
  });
}

const quietKernel = () => new Kernel({ logger: { info() {}, child() { return this; }, error() {} } });

test("defineService rejects an incomplete service", () => {
  assert.throws(() => defineService({ name: "x", start() {} }), ValidationError);
  assert.throws(() => defineService({ start() {}, stop() {}, health() {}, metrics() {} }), /name/);
});

test("boot starts services in dependency order", async () => {
  const order = [];
  const k = quietKernel();
  k.register(svc("db", [], { start: async () => order.push("db") }));
  k.register(svc("api", ["db"], { start: async () => order.push("api") }));
  k.register(svc("edge", ["api"], { start: async () => order.push("edge") }));
  await k.boot();
  assert.deepEqual(order, ["db", "api", "edge"]);
});

test("unknown dependency and cycles are rejected", async () => {
  const k1 = quietKernel();
  k1.register(svc("api", ["ghost"]));
  await assert.rejects(() => k1.boot(), /unknown service dependency: ghost/);

  const k2 = quietKernel();
  k2.register(svc("a", ["b"]));
  k2.register(svc("b", ["a"]));
  await assert.rejects(() => k2.boot(), /cycle/);
});

test("duplicate registration is a conflict", () => {
  const k = quietKernel();
  k.register(svc("dup", []));
  assert.throws(() => k.register(svc("dup", [])), /already registered/);
});

test("aggregate health is the worst service status", async () => {
  const k = quietKernel();
  k.register(svc("a", [], { health: async () => ({ status: HEALTH.OK }) }));
  k.register(svc("b", [], { health: async () => ({ status: HEALTH.DEGRADED }) }));
  await k.boot();
  assert.equal((await k.health()).status, HEALTH.DEGRADED);
});

test("shutdown stops started services in reverse, collecting errors", async () => {
  const order = [];
  const k = quietKernel();
  k.register(svc("db", [], { stop: async () => order.push("db") }));
  k.register(svc("api", ["db"], { stop: async () => { order.push("api"); throw new Error("stop fail"); } }));
  await k.boot();
  const errors = await k.shutdown();
  assert.deepEqual(order, ["api", "db"]); // reverse of boot
  assert.equal(errors.length, 1);
  assert.equal(errors[0].service, "api");
});
