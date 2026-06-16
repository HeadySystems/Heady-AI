// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Corpus Embed Pipeline v1.0.0                              ║
// ║  The real embed path: drain QUEUED jobs through the locked        ║
// ║  embedder, write-through to the SoR projection + dedup ledger.    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Storage-free so it is unit-testable with an injected embedder (no Cloudflare/Neon needed). The
// orchestrator reads the current vectors+ledger maps, calls embedJobs(), and persists the result.

// FIB(7): φ-scaled embedding batch size (AGENTS.md §8 — no magic numbers).
export const EMBED_BATCH = 13;

/**
 * Embed every QUEUED job and write-through to the in-memory projection (Rule 6). Idempotent: the
 * vector id IS the content-addressed key, so re-embedding the same content overwrites in place.
 * @returns {Promise<{vectors:object, ledger:object, embedded:number}>}
 */
export async function embedJobs(jobs, embedder, { vectors = {}, ledger = {} } = {}, nowIso, batchSize = EMBED_BATCH) {
  const v = { ...vectors };
  const l = { ...ledger };
  let embedded = 0;
  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);
    const vecs = await embedder.embed(batch.map((j) => j.content));
    if (vecs.length !== batch.length) {
      throw new Error(`embedder returned ${vecs.length} vectors for ${batch.length} inputs`);
    }
    for (let k = 0; k < batch.length; k++) {
      const job = batch[k];
      v[job.id] = {
        sourceId: job.sourceId,
        sourceKind: job.sourceKind,
        contentHash: job.contentHash,
        embeddingModelVersion: job.embeddingModelVersion,
        servedBy: embedder.serving ?? "workers-ai",
        dim: embedder.model.dim,
        embedding: vecs[k],
        embeddedAt: nowIso,
      };
      l[job.id] = { vectorId: job.id, refCount: (l[job.id]?.refCount ?? 0) + 1, createdAt: nowIso };
      job.state = "PROJECTED";
      embedded++;
    }
  }
  return { vectors: v, ledger: l, embedded };
}

/** Merge freshly-planned jobs into the durable outbox, idempotent on idempotencyKey. */
export function mergeOutbox(existing, jobs) {
  const outbox = { ...existing };
  for (const job of jobs) {
    // The durable outbox stores job metadata, not the file body (re-derivable from sourceId = rel).
    const { content, ...meta } = job;
    outbox[job.idempotencyKey] = { ...outbox[job.idempotencyKey], ...meta };
  }
  return outbox;
}
