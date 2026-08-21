// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Handoff Gate Runner v1.0.0                              ║
// ║  Resilient, classified execution for read-only handoff gates.    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { FIB, phiBackoffMs } from "@heady/phi-math";

const TRANSIENT_SPAWN_CODES = new Set(["EAGAIN", "EMFILE", "ENFILE"]);
const GATE_BUFFER_BYTES = FIB[17] * FIB[7] * 1024;
const DETAIL_LIMIT = FIB[13];

export const GATE_MAX_ATTEMPTS = FIB[4];

function appendBounded(current, chunk) {
  if (current.length >= GATE_BUFFER_BYTES) return current;
  return `${current}${String(chunk)}`.slice(0, GATE_BUFFER_BYTES);
}

export function executeGateWorker(cmdArgs, { cwd = process.cwd(), candidateFiles = null } = {}) {
  const [script, ...argv] = cmdArgs;
  return new Promise((complete) => {
    let worker;
    try {
      worker = new Worker(pathToFileURL(resolve(cwd, script)), {
        argv,
        stdout: true,
        stderr: true,
        workerData: { headyGateFiles: candidateFiles },
      });
    } catch (error) {
      complete({ error, status: null, stdout: "", stderr: "" });
      return;
    }

    let stdout = "";
    let stderr = "";
    let workerError = null;
    worker.stdout.on("data", (chunk) => { stdout = appendBounded(stdout, chunk); });
    worker.stderr.on("data", (chunk) => { stderr = appendBounded(stderr, chunk); });
    worker.on("error", (error) => { workerError = error; });
    worker.on("exit", (status) => complete({ error: workerError, status, stdout, stderr }));
  });
}

function compact(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, DETAIL_LIMIT);
}

function outputDetail(result, ok) {
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  if (!output) return ok ? "passed" : `exited ${result.status ?? "without a status"}`;
  const lines = output.split("\n").map((line) => line.trim()).filter(Boolean);
  const pattern = ok ? /clean|OK|in sync|complete|passed/i : /error|FAIL|violation|✗/i;
  return compact(lines.find((line) => pattern.test(line)) ?? lines.at(-1));
}

function executionError(name, error, attempts) {
  const code = String(error?.code ?? "UNKNOWN");
  return {
    name,
    ok: false,
    status: "error",
    attempts,
    detail: compact(`execution error ${code}: ${error?.message ?? "gate process did not start"}`),
  };
}

export async function runGate(name, cmdArgs, {
  execute = executeGateWorker,
  sleep = delay,
  maxAttempts = GATE_MAX_ATTEMPTS,
  cwd = process.cwd(),
  candidateFiles = null,
} = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let result;
    try {
      result = await execute(cmdArgs, { cwd, candidateFiles });
    } catch (error) {
      result = { error, status: null, stdout: "", stderr: "" };
    }

    if (result.error) {
      const errorText = `${result.error.code ?? ""} ${result.error.message ?? ""}`;
      const transient = [...TRANSIENT_SPAWN_CODES].some((code) => errorText.includes(code));
      if (transient && attempt < maxAttempts) {
        await sleep(phiBackoffMs(attempt));
        continue;
      }
      return executionError(name, result.error, attempt);
    }

    if (result.signal) {
      return executionError(name, {
        code: `SIGNAL_${result.signal}`,
        message: `gate process terminated by ${result.signal}`,
      }, attempt);
    }

    const ok = result.status === 0;
    return {
      name,
      ok,
      status: ok ? "pass" : "fail",
      attempts: attempt,
      detail: outputDetail(result, ok),
    };
  }

  return executionError(name, { code: "UNKNOWN", message: "gate attempt loop exhausted" }, maxAttempts);
}
