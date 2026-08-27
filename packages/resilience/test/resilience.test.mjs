// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Resilience tests — node:test, deps: phi-math, shared      ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";

import { CircuitBreaker, BREAKER_STATE, withRetry, withTimeout, Bulkhead, gracefulShutdown } from "../src/index.mjs";

const nofail = async () => "ok";
const fail = async () => { throw new Error("boom"); };

test("breaker opens after threshold failures, then rejects fast", async () => {
  let t = 0;
  const cb = new CircuitBreaker({ threshold: 3, cooldownMs: 100, now: () => t });
  for (let i = 0; i < 3; i++) await assert.rejects(() => cb.exec(fail));
  assert.equal(cb.state, BREAKER_STATE.OPEN);
  await assert.rejects(() => cb.exec(nofail), /circuit open/); // fails fast while open
});

test("breaker half-opens after cooldown and closes on success", async () => {
  let t = 0;
  const cb = new CircuitBreaker({ threshold: 1, cooldownMs: 50, now: () => t });
  await assert.rejects(() => cb.exec(fail));
  assert.equal(cb.state, BREAKER_STATE.OPEN);
  t = 60; // past cooldown
  assert.equal(await cb.exec(nofail), "ok");
  assert.equal(cb.state, BREAKER_STATE.CLOSED);
});

test("withRetry retries with φ-backoff then succeeds", async () => {
  let n = 0;
  const delays = [];
  const out = await withRetry(async () => { if (++n < 3) throw new Error("x"); return n; },
    { retries: 5, sleep: (ms) => { delays.push(ms); return Promise.resolve(); } });
  assert.equal(out, 3);
  assert.deepEqual(delays, [1618, 2618]); // φ¹·1000, φ²·1000
});

test("withRetry respects retryable predicate", async () => {
  let n = 0;
  await assert.rejects(() => withRetry(async () => { n++; throw new Error("fatal"); },
    { retries: 5, retryable: () => false, sleep: () => Promise.resolve() }));
  assert.equal(n, 1); // not retried
});

test("withTimeout rejects slow work, resolves fast work", async () => {
  assert.equal(await withTimeout(() => Promise.resolve("fast"), 1000), "fast");
  await assert.rejects(() => withTimeout(() => new Promise((r) => setTimeout(r, 50)), 5), /timeout/);
});

test("Bulkhead caps concurrency", async () => {
  const bh = new Bulkhead({ limit: 2, queue: 10 });
  let peak = 0, active = 0;
  const task = async () => {
    active++; peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 10));
    active--;
  };
  await Promise.all(Array.from({ length: 6 }, () => bh.run(task)));
  assert.ok(peak <= 2, `peak concurrency ${peak} must be ≤ 2`);
});

test("gracefulShutdown runs handlers in reverse, once", async () => {
  const order = [];
  const run = gracefulShutdown([() => order.push("a"), () => order.push("b")], { signals: [], process: {} });
  await run();
  await run(); // idempotent
  assert.deepEqual(order, ["b", "a"]);
});
