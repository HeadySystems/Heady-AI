// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Change Awareness Service v1.0.0                           ║
// ║  Latent Service { start, stop, health, metrics } over the         ║
// ║  awareness pipeline. Triggered two ways, both cheap:              ║
// ║   • git hooks (event-driven, zero idle cost) — the primary path   ║
// ║   • an optional HEAD-poll loop (φ⁷≈29s) that reacts ONLY when the  ║
// ║     commit sha actually moved — catches commits from ANY source   ║
// ║     (external AIs, `git pull`) WITHOUT a filesystem watcher.       ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { HEARTBEAT_MS } from "../../../packages/phi-math/src/index.mjs";
import { logger as rootLogger } from "../../../packages/logger/src/index.mjs";
import { react } from "./react.mjs";
import { openState } from "./state.mjs";
import { installHooks, hooksStatus } from "./hooks.mjs";
import * as g from "./git.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = join(HERE, "..", "..", "..");

/**
 * Construct the awareness service.
 * @param {object} [opts]
 * @param {string} [opts.repoRoot]
 * @param {string} [opts.vectorMemoryDir]  default .data/vector-memory
 * @param {string} [opts.stateDir]         default .data/awareness
 * @param {object} [opts.env]              default process.env (embedder resolution)
 * @returns {{ start, stop, health, metrics, reactOnce }}
 */
export function createAwarenessService(opts = {}) {
  const repoRoot = opts.repoRoot ?? DEFAULT_REPO_ROOT;
  const vectorMemoryDir = opts.vectorMemoryDir ?? join(repoRoot, ".data", "vector-memory");
  const stateDir = opts.stateDir ?? join(repoRoot, ".data", "awareness");
  const env = opts.env ?? process.env;
  const log = rootLogger.child
    ? rootLogger.child({ service: "heady-awareness" })
    : rootLogger;

  const state = openState(stateDir);
  let timer = null;
  let reacting = false;
  let lastError = null;
  const startedAt = { iso: null };

  const allowHf = env.HEADY_ALLOW_HF_EMBED === "1";

  async function reactOnce(trigger) {
    if (reacting) return null; // never overlap reactions (poll vs hook race)
    reacting = true;
    try {
      const result = await react({ repoRoot, vectorMemoryDir, stateDir, trigger, embedOpts: { allowHf }, logger: log });
      lastError = null;
      return result;
    } catch (err) {
      lastError = err.message;
      state.bump({ errors: 1 });
      log.error({ err: err.message }, "awareness: reaction failed");
      throw err;
    } finally {
      reacting = false;
    }
  }

  /**
   * @param {object} [startOpts]
   * @param {boolean} [startOpts.installGitHooks=true]
   * @param {boolean} [startOpts.poll=false]   enable the φ-heartbeat HEAD-poll loop
   * @param {boolean} [startOpts.reactNow=true]
   */
  async function start(startOpts = {}) {
    const { installGitHooks = true, poll = false, reactNow = true } = startOpts;
    if (!g.isGitRepo(repoRoot)) throw new Error(`awareness: ${repoRoot} is not a git repository`);

    let hooks = hooksStatus(repoRoot);
    if (installGitHooks && hooks.installed.length < 4) {
      installHooks(repoRoot);
      hooks = hooksStatus(repoRoot);
    }

    startedAt.iso = new Date().toISOString();
    state.mergeState({ running: true });

    if (reactNow) await reactOnce("service-start");

    if (poll && !timer) {
      // Cheap: one `git rev-parse HEAD` per beat; react only when the sha moved.
      timer = setInterval(() => {
        const head = g.head(repoRoot);
        const seen = state.readState().lastSeenHead;
        if (head && head !== seen) {
          reactOnce("head-poll").catch(() => {/* logged + counted in reactOnce */});
        }
      }, HEARTBEAT_MS);
      if (timer.unref) timer.unref(); // never keep the event loop alive on our account
      log.info({ heartbeatMs: HEARTBEAT_MS }, "awareness: HEAD-poll loop armed");
    }

    log.info({ repoRoot, hooks: hooks.installed, poll }, "awareness: started");
    return health();
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    state.mergeState({ running: false });
    log.info({}, "awareness: stopped");
    return health();
  }

  /** Latent health: fast, read-only. Degraded when the gate is blocked or a reaction errored. */
  function health() {
    const snap = state.readContext();
    const st = state.readState();
    const gateOk = snap?.consistency?.gateOk ?? null;
    const status = lastError
      ? "error"
      : gateOk === false
        ? "degraded"
        : st.running
          ? "running"
          : "stopped";
    return {
      service: "heady-awareness",
      status,
      running: st.running,
      head: snap?.repo?.headShort ?? g.head(repoRoot)?.slice(0, 12) ?? null,
      branch: snap?.repo?.branch ?? g.branch(repoRoot),
      gateOk,
      embedderBound: snap?.vectorMemory?.embedderBound ?? false,
      vectorsLive: snap?.vectorMemory?.vectorsLive ?? false,
      pendingEmbedJobs: snap?.vectorMemory?.pendingEmbedJobs ?? null,
      lastReactionAt: st.lastReactionAt,
      lastTrigger: st.lastTrigger,
      hooks: hooksStatus(repoRoot).installed,
      polling: Boolean(timer),
      startedAt: startedAt.iso,
      lastError,
    };
  }

  /** Latent metrics: cumulative counters + the current freshness verdict. */
  function metrics() {
    const st = state.readState();
    const snap = state.readContext();
    return {
      service: "heady-awareness",
      reactions: st.counters.reactions,
      gateBlocks: st.counters.gateBlocks,
      jobsEnqueued: st.counters.jobsEnqueued,
      errors: st.counters.errors,
      pendingEmbedJobs: snap?.vectorMemory?.pendingEmbedJobs ?? 0,
      ledgerSize: snap?.vectorMemory?.ledgerSize ?? 0,
      currencyFresh: snap?.currency?.fresh ?? null,
      heartbeatMs: HEARTBEAT_MS,
    };
  }

  return { start, stop, health, metrics, reactOnce, repoRoot, stateDir, vectorMemoryDir };
}
