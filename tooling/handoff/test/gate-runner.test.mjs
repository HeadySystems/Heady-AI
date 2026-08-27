// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Handoff Gate Runner Tests v1.0.0                        ║
// ║  Transient retries and execution-error classification.           ║
// ║  Made with ❤️ by HeadySystems Inc.                              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";
import { FIB, phiBackoffMs } from "@heady/phi-math";
import { GATE_MAX_ATTEMPTS, runGate } from "../src/gate-runner.mjs";

function spawnError(code) {
  const error = new Error(`${code} while spawning gate`);
  error.code = code;
  return { error, status: null, stdout: "", stderr: "" };
}

test("runGate returns a classified pass and uses the requested working directory", async () => {
  const calls = [];
  const candidateFiles = ["AGENTS.md", "new-untracked.mjs"];
  const result = await runGate("law-lint", ["gate.mjs"], {
    cwd: "/workspace",
    candidateFiles,
    execute: async (args, options) => {
      calls.push({ args, options });
      return { status: 0, stdout: "law-lint complete", stderr: "" };
    },
  });
  assert.equal(result.status, "pass");
  assert.equal(result.attempts, 1);
  assert.deepEqual(calls[0].args, ["gate.mjs"]);
  assert.equal(calls[0].options.cwd, "/workspace");
  assert.deepEqual(calls[0].options.candidateFiles, candidateFiles);
});

test("runGate retries transient spawn exhaustion with phi backoff", async () => {
  let attempts = 0;
  const delays = [];
  const result = await runGate("secret-scan", ["gate.mjs"], {
    execute: async () => {
      attempts += 1;
      return attempts < GATE_MAX_ATTEMPTS
        ? spawnError("EAGAIN")
        : { status: 0, stdout: "secret-scan complete", stderr: "" };
    },
    sleep: async (milliseconds) => delays.push(milliseconds),
  });
  assert.equal(result.status, "pass");
  assert.equal(result.attempts, GATE_MAX_ATTEMPTS);
  assert.deepEqual(delays, [phiBackoffMs(1), phiBackoffMs(2)]);
});

test("runGate reports persistent spawn exhaustion as execution error", async () => {
  const result = await runGate("coherence", ["gate.mjs"], {
    execute: async () => spawnError("EAGAIN"),
    sleep: async () => {},
  });
  assert.equal(GATE_MAX_ATTEMPTS, FIB[4]);
  assert.equal(result.ok, false);
  assert.equal(result.status, "error");
  assert.equal(result.attempts, GATE_MAX_ATTEMPTS);
  assert.match(result.detail, /execution error EAGAIN/);
});

test("runGate does not retry a non-transient missing executable error", async () => {
  let attempts = 0;
  const result = await runGate("governance", ["gate.mjs"], {
    execute: async () => {
      attempts += 1;
      return spawnError("ENOENT");
    },
    sleep: async () => assert.fail("non-transient errors must not sleep"),
  });
  assert.equal(attempts, 1);
  assert.equal(result.status, "error");
  assert.match(result.detail, /ENOENT/);
});
