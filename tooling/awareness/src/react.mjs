// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Awareness — React Pipeline v1.0.0                         ║
// ║  The reaction to a codebase change. One pass:                     ║
// ║   1 observe git (HEAD delta + working tree)                       ║
// ║   2 run the fail-closed gate-then-embed workflow (heady-embed)    ║
// ║   3 (re)build the current-state context snapshot                 ║
// ║   4 publish a durable awareness event (events bus → HeadyLens)    ║
// ║   5 advance durable state (lastSeenHead, counters)                ║
// ║  Honest by construction: with no embedder bound, step 2 advances  ║
// ║  the outbox and writes ZERO vectors — surfaced, never hidden.     ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { InMemoryBus, SUBJECT } from "../../../packages/events/src/index.mjs";
import { createLens } from "../../../packages/headylens/src/index.mjs";
import { logger as rootLogger } from "../../../packages/logger/src/index.mjs";
import { runEmbed } from "./embed-bridge.mjs";
import { buildContextSnapshot } from "./context.mjs";
import { openState } from "./state.mjs";
import * as g from "./git.mjs";

/**
 * Build a durable emitter: an in-memory events bus with a HeadyLens tap that
 * persists every awareness event to an NDJSON stream (queryable + SSE-able).
 */
export function createEmitter(ndjsonPath) {
  const bus = new InMemoryBus();
  const lens = createLens({ ndjsonPath });
  lens.attachEvents(bus); // normalize + redact + append to ring + NDJSON
  return { bus, lens, publish: (subject, payload) => bus.publish(subject, payload, { source: "awareness" }) };
}

/**
 * React to a (possible) change exactly once.
 *
 * @param {object} args
 * @param {string} args.repoRoot
 * @param {string} args.vectorMemoryDir
 * @param {string} args.stateDir
 * @param {string} [args.trigger]            what fired this ("post-commit", "manual", "head-poll", …)
 * @param {object} [args.embedOpts]          forwarded to the embed bridge
 * @param {object} [args.emitter]            injected { publish } (default: durable NDJSON emitter)
 * @param {object} [args.logger]
 * @returns {Promise<object>} structured reaction result
 */
export async function react({
  repoRoot,
  vectorMemoryDir,
  stateDir,
  trigger = "manual",
  embedOpts = {},
  emitter,
  logger = rootLogger,
}) {
  const nowIso = new Date().toISOString();
  const log = logger.child ? logger.child({ component: "awareness.react", trigger }) : logger;
  const state = openState(stateDir);
  const prev = state.readState();
  const sinceHead = prev.lastSeenHead;
  const head = g.head(repoRoot);
  const emit = emitter ?? createEmitter(state.path("lens.ndjson"));

  // ── 2 — fail-closed gate-then-embed (authoritative; we observe the verdict) ──
  const embed = runEmbed(embedOpts);
  const blocked = embed.blocked;
  const report = embed.report;

  // ── 3 — current-state snapshot (reflects what step 2 just persisted) ─────────
  const snapshot = buildContextSnapshot({ repoRoot, vectorMemoryDir, nowIso, sinceHead });
  state.writeContext(snapshot);

  // ── 4 — durable awareness event ─────────────────────────────────────────────
  const enqueued = report?.enqueued ?? 0;
  const subject = blocked ? SUBJECT.system("awareness.gate-blocked") : SUBJECT.system("awareness.reacted");
  const payload = {
    trigger,
    head: snapshot.repo.headShort,
    branch: snapshot.repo.branch,
    committedSinceLastSeen: snapshot.changes.committedCount,
    uncommitted: snapshot.changes.uncommittedCount,
    gateOk: snapshot.consistency.gateOk,
    merkleRoot: snapshot.vectorMemory.merkleRoot ? snapshot.vectorMemory.merkleRoot.slice(0, 16) : null,
    pendingEmbedJobs: snapshot.vectorMemory.pendingEmbedJobs,
    embedderBound: snapshot.vectorMemory.embedderBound,
    enqueued,
    currency: snapshot.currency,
  };
  await emit.publish(subject, payload);

  if (blocked) {
    log.warn({ ...payload, findings: report?.findings?.length ?? null }, "awareness: consistency gate blocked — embedding did not run");
  } else {
    log.info(payload, "awareness: reacted to change");
  }

  // ── 5 — advance durable state ────────────────────────────────────────────────
  state.mergeState({
    lastSeenHead: head,
    lastReactionAt: nowIso,
    lastTrigger: trigger,
  });
  state.bump({
    reactions: 1,
    gateBlocks: blocked ? 1 : 0,
    jobsEnqueued: enqueued,
    errors: embed.report ? 0 : 1, // embed produced no report → count as an error, surfaced in metrics
  });

  return {
    ok: !blocked && !!report,
    blocked,
    trigger,
    head,
    changed: snapshot.changes.committedCount > 0 || snapshot.changes.uncommittedCount > 0,
    embed: report ? { status: report.status, enqueued, embedded: report.embedded, embedderBound: report.embedderBound } : null,
    snapshot,
    subject,
  };
}
