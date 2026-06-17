// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Awareness — Current-State Context Snapshot v1.0.0         ║
// ║  The canonical "what is true right now" document. Heady or any    ║
// ║  external AI reads this (file, CLI, or SSE) to get live data:      ║
// ║  HEAD/branch, changes since last observation, the consistency     ║
// ║  gate verdict, the Merkle root, and the embed-outbox backlog —     ║
// ║  including an HONEST embedderBound flag (enqueue-only vs live).    ║
// ║  Read-only + cheap: reflects persisted artifacts, embeds nothing.  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { createStore, FILES } from "../../embed-corpus/src/store.mjs";
import * as g from "./git.mjs";
import { FIB } from "../../../packages/phi-math/src/index.mjs";

export const CONTEXT_SCHEMA = "heady.awareness.context/v1";

/** How many recent commits to surface — FIB[7] = 13 (φ-scaled, no magic number). */
const RECENT_COMMITS = FIB[7];

/** Count of still-pending (QUEUED) jobs in the embed outbox map. */
function pendingJobs(outbox) {
  if (!outbox || typeof outbox !== "object") return 0;
  return Object.values(outbox).filter((j) => j && j.state === "QUEUED").length;
}

/**
 * Build the current-state context snapshot. Pure-ish: reads git + the persisted
 * vector-memory artifacts, computes nothing destructive, embeds nothing.
 *
 * @param {object} args
 * @param {string} args.repoRoot
 * @param {string} args.vectorMemoryDir   .data/vector-memory
 * @param {string} args.nowIso
 * @param {string|null} [args.sinceHead]   prior observed HEAD (for the change delta)
 * @returns {object} versioned snapshot
 */
export function buildContextSnapshot({ repoRoot, vectorMemoryDir, nowIso, sinceHead = null }) {
  const store = createStore(vectorMemoryDir);
  const report = store.readJson(FILES.REPORT, null);
  const merkle = store.readJson(FILES.MERKLE, null);
  const outbox = store.readJson(FILES.JOBS, {});
  const ledger = store.readJson(FILES.LEDGER, {});

  const head = g.head(repoRoot);
  const branch = g.branch(repoRoot);
  const changedSinceLastSeen = sinceHead && sinceHead !== head
    ? g.changedFiles(repoRoot, sinceHead, head ?? "HEAD")
    : [];
  const working = g.workingChanges(repoRoot);

  const recent = g.log(repoRoot, head ?? undefined, RECENT_COMMITS).map((c) => ({
    sha: c.shortSha,
    author: c.author,
    dateIso: c.dateIso,
    subject: c.subject,
    fileCount: c.files.length,
  }));

  const pending = pendingJobs(outbox);
  const embedderBound = report?.embedderBound ?? false;
  const gateOk = report?.gate?.ok ?? null;

  return {
    schema: CONTEXT_SCHEMA,
    generatedAt: nowIso,
    repo: {
      head,
      headShort: head ? head.slice(0, 12) : null,
      branch,
      upstream: g.upstream(repoRoot),
      dirty: working.length > 0,
    },
    changes: {
      sinceHead: sinceHead ?? null,
      committedSinceLastSeen: changedSinceLastSeen,
      committedCount: changedSinceLastSeen.length,
      uncommitted: working,
      uncommittedCount: working.length,
      recentCommits: recent,
    },
    consistency: {
      // Verdict carried from the last gate run inside heady-embed (fail-closed).
      gateOk,
      errors: report?.gate?.errors ?? null,
      warns: report?.gate?.warns ?? null,
    },
    vectorMemory: {
      merkleRoot: merkle?.root ?? null,
      merkleCount: merkle?.count ?? 0,
      model: merkle?.model ?? null,
      dim: merkle?.dim ?? null,
      ledgerSize: Object.keys(ledger).length,
      pendingEmbedJobs: pending,
      // HONEST currency flag: with no embedder bound, the outbox is advanced but
      // ZERO vectors are written (CLAUDE_MEMORY §2 — blocked on the CF token).
      embedderBound,
      vectorsLive: embedderBound,
      lastEmbedRunAt: report?.ranAt ?? null,
    },
    // One-glance currency verdict for an AI deciding whether its data is fresh.
    currency: {
      fresh: gateOk === true && working.length === 0,
      blockedReason:
        gateOk === false
          ? "consistency-gate-failed"
          : !embedderBound && pending > 0
            ? "embeddings-enqueued-not-written (no embedder binding)"
            : null,
    },
  };
}
