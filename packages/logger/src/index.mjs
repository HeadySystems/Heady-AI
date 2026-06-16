// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Logger v1.0.0 — structured JSON + trace-id + φ-sampling   ║
// ║  Pino-shaped records that index identically on Cloud Run (pino)    ║
// ║  and Cloudflare Workers (console). © 2026 HeadySystems Inc.        ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Dependency-free core (a real `pino` instance can wrap this on Cloud Run via
// @google-cloud/pino-logging-gcp-config). Emits the same field names on both
// runtimes so one saved query works everywhere. Threads X-Heady-Trace-Id via
// AsyncLocalStorage; redacts secrets; φ-samples debug/trace deterministically
// per-trace so a request keeps or drops ALL its low-level lines together.

import { AsyncLocalStorage } from "node:async_hooks";
import { PSI } from "@heady/phi-math";

// Pino numeric level values (so downstream tooling treats these as pino logs).
export const LEVELS = Object.freeze({ trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 });

// φ-sampling rates: errors/warns/info always; debug at 1/φ² ≈ 0.382, trace at 1/φ³ ≈ 0.236.
const SAMPLE_RATE = Object.freeze({ trace: PSI ** 3, debug: PSI ** 2, info: 1, warn: 1, error: 1, fatal: 1 });

const DEFAULT_REDACT = ["authorization", "password", "token", "apikey", "apiKey", "secret", "cookie"];

const traceStore = new AsyncLocalStorage();

/** Run `fn` with a trace id bound to the async context (Express/Node path). */
export function runWithTrace(traceId, fn) {
  return traceStore.run({ traceId }, fn);
}
/** The trace id bound to the current async context, if any. */
export function currentTraceId() {
  return traceStore.getStore()?.traceId;
}

// FNV-1a 32-bit hash → deterministic [0,1) for per-trace sampling.
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0xffffffff;
}

function maskEmail(v) {
  return typeof v === "string" && v.includes("@")
    ? v.replace(/^(.).*(@.*)$/, (_, a, b) => `${a}***${b}`)
    : v;
}

/** Recursively redact secret-named keys and partially mask emails (depth-bounded). */
function redact(value, names, depth = 0) {
  if (depth > 8 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, names, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const lower = k.toLowerCase();
    if (names.has(lower)) out[k] = `[REDACTED:${k}]`;
    else if (lower === "email") out[k] = maskEmail(v);
    else out[k] = redact(v, names, depth + 1);
  }
  return out;
}

// Default sink: stdout on Node/Cloud Run; console on Workers (optional-chained so
// the package never hard-depends on either). One JSON object per line (NDJSON).
function defaultSink(line) {
  const w = globalThis.process?.stdout?.write?.bind(globalThis.process.stdout);
  if (w) w(`${line}\n`);
  else globalThis.console?.log?.(line);
}

function shouldSample(levelName, traceId) {
  const rate = SAMPLE_RATE[levelName] ?? 1;
  if (rate >= 1) return true;
  if (!traceId) return true; // can't sample deterministically without a key → keep
  return fnv1a(`${traceId}:${levelName}`) < rate;
}

/**
 * Create a logger.
 * @param {{level?:string, sink?:(line:string)=>void, base?:object, redact?:string[], now?:()=>string}} [opts]
 */
export function createLogger(opts = {}) {
  const minLevel = LEVELS[opts.level ?? "info"] ?? LEVELS.info;
  const sink = opts.sink ?? defaultSink;
  const redactNames = new Set((opts.redact ?? DEFAULT_REDACT).map((s) => s.toLowerCase()));
  const now = opts.now ?? (() => new Date().toISOString());

  function make(bindings) {
    const emit = (levelName, arg1, arg2) => {
      const levelNum = LEVELS[levelName];
      if (levelNum < minLevel) return;
      const traceId = bindings.traceId ?? currentTraceId();
      if (!shouldSample(levelName, traceId)) return;

      const fields = typeof arg1 === "object" && arg1 !== null ? arg1 : {};
      const msg = typeof arg1 === "string" ? arg1 : arg2;
      const record = redact(
        { level: levelNum, levelName, time: now(), ...bindings, ...(traceId ? { traceId } : {}), ...fields, ...(msg ? { msg } : {}) },
        redactNames,
      );
      sink(JSON.stringify(record));
    };
    const logger = { level: opts.level ?? "info", bindings };
    for (const name of Object.keys(LEVELS)) logger[name] = (a, b) => emit(name, a, b);
    logger.child = (extra) => make({ ...bindings, ...extra });
    return logger;
  }

  return make({ ...(opts.base ?? {}) });
}

/** Singleton convenience logger (service name + trace id auto-bound). */
export const logger = createLogger({ base: { service: globalThis.process?.env?.HEADY_SERVICE ?? "heady" } });
