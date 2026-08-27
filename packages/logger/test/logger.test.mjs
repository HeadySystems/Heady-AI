// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Logger tests — node:test, dep: @heady/phi-math            ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";

import { createLogger, runWithTrace, currentTraceId, LEVELS } from "../src/index.mjs";

function capture(opts = {}) {
  const lines = [];
  const log = createLogger({ sink: (l) => lines.push(JSON.parse(l)), now: () => "T", ...opts });
  return { log, lines };
}

test("emits pino-shaped records with numeric level + time + msg", () => {
  const { log, lines } = capture({ level: "info" });
  log.info({ a: 1 }, "hello");
  assert.equal(lines.length, 1);
  assert.equal(lines[0].level, LEVELS.info);
  assert.equal(lines[0].levelName, "info");
  assert.equal(lines[0].msg, "hello");
  assert.equal(lines[0].a, 1);
  assert.equal(lines[0].time, "T");
});

test("respects min level", () => {
  const { log, lines } = capture({ level: "warn" });
  log.info("dropped");
  log.error("kept");
  assert.equal(lines.length, 1);
  assert.equal(lines[0].msg, "kept");
});

test("redacts secret-named keys and masks email", () => {
  const { log, lines } = capture();
  log.info({ password: "p", token: "t", nested: { apiKey: "k" }, email: "eric@headyconnection.org" });
  const r = lines[0];
  assert.equal(r.password, "[REDACTED:password]");
  assert.equal(r.token, "[REDACTED:token]");
  assert.equal(r.nested.apiKey, "[REDACTED:apiKey]");
  assert.equal(r.email, "e***@headyconnection.org");
});

test("child loggers inherit + extend bindings", () => {
  const { log, lines } = capture();
  const child = log.child({ module: "tasks" });
  child.info("x");
  assert.equal(lines[0].module, "tasks");
});

test("trace id flows from async context into records", () => {
  const { log, lines } = capture();
  runWithTrace("trace-123", () => {
    assert.equal(currentTraceId(), "trace-123");
    log.error("boom");
  });
  assert.equal(lines[0].traceId, "trace-123");
});

test("φ-sampling: errors always kept; debug deterministic per trace", () => {
  const { log, lines } = capture({ level: "trace" });
  // errors are never sampled out
  runWithTrace("t", () => log.error("e"));
  assert.equal(lines.filter((l) => l.levelName === "error").length, 1);

  // debug decision is deterministic for a given trace id (same fate every call)
  const decisions = new Set();
  for (let i = 0; i < 5; i++) {
    const { log: l2, lines: out } = capture({ level: "trace" });
    runWithTrace("stable-trace", () => l2.debug("d"));
    decisions.add(out.length);
  }
  assert.equal(decisions.size, 1, "same trace id → identical sampling decision");
});
