// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ @heady/narrative — the build, as it happens v1.0.0        ║
// ║  A thin EMITTER. It does not store, serve, or stream — it only    ║
// ║  publishes typed narrative events onto the @heady/events bus.     ║
// ║  HeadyLens (the comprehensive spine) captures every event via     ║
// ║  attachEvents(bus) and exposes the live tail at /api/lens/stream. ║
// ║  One authority per concern: the bus owns delivery, HeadyLens owns ║
// ║  capture + replay, the UI owns presentation. © 2026 HeadySystems  ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Why this is not a new package with its own JSONL + SSE server: HeadyLens already unifies
// events + logs + spans into one time-ordered, redacted, detail-graded stream with query +
// live SSE. Building a parallel narrative store would be a second source of truth (drift,
// double redaction, two retention policies). Instead the narrative is a NAMED VIEW over the
// existing spine: every step is a `heady.action.build.*` event, and the UI subscribes to that
// subject prefix on the lens stream. (collector.mjs completeness note: the bus is unsampled,
// so narrative steps emitted as events are guaranteed-captured, unlike φ-sampled debug logs.)

import { SUBJECT } from "@heady/events";
import { ValidationError } from "@heady/shared";
import { CSL_THRESHOLDS } from "@heady/phi-math";

// Canonical narrative subject prefix. The admin UI filters the lens stream by exactly this.
export const NARRATIVE_PREFIX = "heady.action.build.";

// The vocabulary of a build story. Kept small and stable — these are the "beats" a human reads.
export const BEAT = Object.freeze({
  PLAN: "plan", // a unit of work was scoped
  START: "start", // a step began
  PROGRESS: "progress", // a step advanced (optional, throttle at the source)
  DECISION: "decision", // a routing/architecture choice + its rationale
  GATE: "gate", // a CSL/quality gate evaluated (pass/fail + score)
  DONE: "done", // a step completed successfully
  BLOCKED: "blocked", // a step is waiting on an external/human gate
  FAIL: "fail", // a step failed (carries the error summary)
});
const BEATS = new Set(Object.values(BEAT));

// Outcome → the tier the lens should grade the beat at is derived in record.mjs from the subject
// root (heady.action.* → NORMAL). We keep beats human-first: a `summary` line that reads as prose.

function reqStr(name, v) {
  if (typeof v !== "string" || v.length === 0) throw new ValidationError(`narrative ${name} required`);
  return v;
}

/**
 * Build a narrative emitter bound to an event bus and (optionally) a build/run scope.
 *
 * @param {{publish:Function}} bus  a @heady/events bus (InMemoryBus or the NATS adapter)
 * @param {{ traceId?:string, build?:string, source?:string }} [scope]
 *   traceId — correlate the whole story (lens groups + the UI threads by it);
 *   build   — a human label for this run (e.g. "phase1-autocontext"); rides in every payload;
 *   source  — event source tag (defaults "narrative").
 */
export function createNarrator(bus, scope = {}) {
  if (!bus || typeof bus.publish !== "function") {
    throw new ValidationError("createNarrator requires an event bus with publish()");
  }
  const traceId = scope.traceId ?? null;
  const build = scope.build ?? null;
  const source = scope.source ?? "narrative";

  /** Publish one beat. Returns the bus publish promise (fire-and-await or fire-and-forget). */
  function beat(kind, step, summary, extra = {}) {
    if (!BEATS.has(kind)) throw new ValidationError(`unknown narrative beat: ${kind}`);
    reqStr("step", step);
    reqStr("summary", summary);
    const subject = SUBJECT.action(`build.${kind}`); // heady.action.build.<kind>
    const payload = { build, step, summary, beat: kind, ...extra };
    return bus.publish(subject, payload, { traceId, source });
  }

  return {
    NARRATIVE_PREFIX,
    traceId,
    build,
    plan: (step, summary, extra) => beat(BEAT.PLAN, step, summary, extra),
    start: (step, summary, extra) => beat(BEAT.START, step, summary, extra),
    progress: (step, summary, extra) => beat(BEAT.PROGRESS, step, summary, extra),
    decision: (step, summary, rationale, extra = {}) =>
      beat(BEAT.DECISION, step, summary, { rationale: reqStr("rationale", rationale), ...extra }),
    /** A CSL/quality gate result. `score`/`threshold` surface in the UI as a pass/fail chip. */
    gate: (step, summary, { score, threshold = CSL_THRESHOLDS.MEDIUM, passed, ...extra } = {}) =>
      beat(BEAT.GATE, step, summary, {
        score: typeof score === "number" ? score : null,
        threshold,
        passed: typeof passed === "boolean" ? passed : (typeof score === "number" ? score >= threshold : null),
        ...extra,
      }),
    done: (step, summary, extra) => beat(BEAT.DONE, step, summary, extra),
    blocked: (step, summary, waitingOn, extra = {}) =>
      beat(BEAT.BLOCKED, step, summary, { waitingOn: waitingOn ?? null, ...extra }),
    fail: (step, summary, error, extra = {}) =>
      beat(BEAT.FAIL, step, summary, {
        error: error?.message ?? (typeof error === "string" ? error : null),
        ...extra,
      }),
    /** Escape hatch for a custom beat kind already in BEAT. */
    beat,
  };
}

/**
 * Wrap an async step so its lifecycle narrates itself: start → (done | fail) with duration.
 * Use at every meaningful build boundary so the story writes itself with zero extra prose.
 *
 * @example
 *   const n = createNarrator(bus, { traceId, build: "phase1" });
 *   await narrateStep(n, "compile", "Compiling auto-context v2", async () => doWork());
 */
export async function narrateStep(narrator, step, summary, fn) {
  const t0 = Date.now();
  await narrator.start(step, summary);
  try {
    const out = await fn();
    await narrator.done(step, `${summary} — done`, { durationMs: Date.now() - t0 });
    return out;
  } catch (err) {
    await narrator.fail(step, `${summary} — failed`, err, { durationMs: Date.now() - t0 });
    throw err;
  }
}
