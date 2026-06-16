// @heady/embedding — pure core (dependency-free; node:crypto only).
//
// This module is the runnable, testable heart of the embedding pipeline. It contains NO platform
// bindings (no Cloudflare, Neon, or Workers AI) so it can run and be unit-tested anywhere. The
// platform edges (workflow.ts, embedder.ts, schema.ts, acquire-tiers.ts) import from here.
//
// It encodes the "instantaneous data acquisition" ruleset: precompute at write, never redo work
// (content-addressed dedup + significance gating), serve from the fastest pre-built tier on read.
// See README.md and ADR-0024 / ADR-0003 / ADR-0014 / ADR-0015.

import { createHash } from "node:crypto";

// ── Rule 5: Embedding lock (ADR-0015) — pinned model identity. Immutable after first ingest. ──
export const LOCKED_MODEL = Object.freeze({
  id: "@cf/baai/bge-small-en-v1.5",
  dim: 384,
  pooling: "mean",
  version: "v1",
});

/** Fail-closed assertion that a model config matches the lock (ADR-0015). */
export function assertModelLock(model = LOCKED_MODEL) {
  for (const k of ["id", "dim", "pooling", "version"]) {
    if (model[k] !== LOCKED_MODEL[k]) {
      throw new Error(
        `embedding model lock violated: ${k}=${model[k]} expected ${LOCKED_MODEL[k]} (ADR-0015)`,
      );
    }
  }
  return true;
}

// ── Normalization → content hashing (Rule 2: content-addressed dedup) ──
// Conservative: NFC unicode + trim + collapse internal whitespace. NOT lowercased (embeddings are
// case-sensitive enough that we must not collapse distinct casings into one vector).
export function normalizeContent(text) {
  if (typeof text !== "string") throw new TypeError("content must be a string");
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** sha256 hex of normalized content — the content address. */
export function contentHash(text) {
  return createHash("sha256").update(normalizeContent(text), "utf8").digest("hex");
}

/**
 * The content-addressed identity of a vector. Deterministic: same content + same locked model
 * ⇒ same key ⇒ same cache slot ⇒ dedup hit. This key is the dedup cache key AND the idempotency key.
 */
export function vectorKey(text, model = LOCKED_MODEL) {
  assertModelLock(model);
  return `${contentHash(text)}:${model.id}:${model.version}`;
}

/** Idempotency key for an embedding job (Rule 4) — identical to the vector key by construction. */
export function idempotencyKey(text, model = LOCKED_MODEL) {
  return vectorKey(text, model);
}

// ── Rule 3: Change-significance gate ──
// Re-embed only when a *significant* field changed. `significantFields` selects what counts;
// everything else (metadata, timestamps, view counts) is ignored.
export function significantDigest(record, significantFields) {
  const fields = significantFields ?? Object.keys(record ?? {}).sort();
  const projected = {};
  for (const f of fields) projected[f] = record?.[f];
  return contentHash(JSON.stringify(projected));
}

/**
 * Decide whether an update needs re-embedding.
 * @returns {{reembed: boolean, reason: string}}
 */
export function significanceGate(prev, next, significantFields) {
  if (prev == null) return { reembed: true, reason: "new-record" };
  const a = significantDigest(prev, significantFields);
  const b = significantDigest(next, significantFields);
  return a === b
    ? { reembed: false, reason: "no-significant-change" }
    : { reembed: true, reason: "significant-change" };
}

// ── Rule 2 (read side): dedup lookup against the embedding ledger ──
// `ledger` is any object with `get(key) -> ref|undefined`. A hit short-circuits the whole pipeline.
export function dedupLookup(ledger, key) {
  const ref = ledger?.get?.(key);
  return ref ? { hit: true, ref } : { hit: false, ref: null };
}

// ── Rules 1 & 7: tiered acquisition (the "instantaneous" read path) ──
// Tiers are tried fastest-first. Each tier: { name, latencyClass, get(key) -> value|undefined }.
// Returns the value from the fastest tier that has it, plus which tier served it. Embedding NEVER
// happens here — acquisition only reads pre-built indexes.
export const DEFAULT_TIER_ORDER = ["kv", "vectorize", "pgvector"];

export async function acquire(key, tiers) {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    throw new Error("acquire requires an ordered, non-empty tier list");
  }
  for (const tier of tiers) {
    const value = await tier.get(key);
    if (value !== undefined && value !== null) {
      return { hit: true, tier: tier.name, latencyClass: tier.latencyClass ?? "unknown", value };
    }
  }
  return { hit: false, tier: null, latencyClass: null, value: null };
}

// ── Job state machine (durable workflow backbone) ──
// QUEUED ──dedup-hit──▶ DEDUPED (short-circuit, no embed)
//        ──significant─▶ EMBEDDING ─▶ PERSISTED ─▶ PROJECTED
//        ──not-signif──▶ SKIPPED
// any ──error──▶ FAILED
export const JOB_STATES = Object.freeze([
  "QUEUED",
  "DEDUPED",
  "SKIPPED",
  "EMBEDDING",
  "PERSISTED",
  "PROJECTED",
  "FAILED",
]);

const TRANSITIONS = {
  QUEUED: { DEDUP_HIT: "DEDUPED", NOT_SIGNIFICANT: "SKIPPED", EMBED: "EMBEDDING", ERROR: "FAILED" },
  EMBEDDING: { PERSIST: "PERSISTED", ERROR: "FAILED" },
  PERSISTED: { PROJECT: "PROJECTED", ERROR: "FAILED" },
  DEDUPED: {},
  SKIPPED: {},
  PROJECTED: {},
  FAILED: {},
};

/** Pure reducer for the job state machine. Throws on an illegal transition. */
export function nextState(state, event) {
  const allowed = TRANSITIONS[state];
  if (!allowed) throw new Error(`unknown state: ${state}`);
  const to = allowed[event];
  if (!to) throw new Error(`illegal transition: ${state} --${event}-->`);
  return to;
}

export function isTerminal(state) {
  return ["DEDUPED", "SKIPPED", "PROJECTED", "FAILED"].includes(state);
}

// ── The ruleset, as data (for docs, tests, and runtime assertions) ──
export const ACQUISITION_RULES = Object.freeze([
  { id: 1, name: "embed-on-write", invariant: "read path never embeds; acquire() reads pre-built tiers only" },
  { id: 2, name: "content-addressed-dedup", invariant: "vectorKey(content,model) collision ⇒ skip embed" },
  { id: 3, name: "change-significance", invariant: "re-embed only on significant-field change" },
  { id: 4, name: "idempotent-jobs", invariant: "job keyed by vectorKey ⇒ effectively-once" },
  { id: 5, name: "embedding-lock", invariant: "model/dim/pooling pinned; mismatch fails closed" },
  { id: 6, name: "write-through-warm", invariant: "on persist, warm pgvector+vectorize+kv" },
  { id: 7, name: "tiered-acquire", invariant: "serve from fastest tier holding the key" },
  { id: 8, name: "reconstructible", invariant: "derived tiers rebuildable from SoR (ADR-0000/0014)" },
]);
