// HCEmbedPipeline — the durable embedding workflow (Cloudflare Workflows). Canonical stack.
// Each step is memoized + retryable; the whole thing is idempotent on `idempotencyKey` (= vectorKey).
// This is where the acquisition ruleset is enforced as control flow:
//   intake → dedup-check (Rule 2, short-circuit) → significance-gate (Rule 3) → embed (Rule 5)
//          → persist to SoR + outbox (Rule 6) → project to edge tiers (Rule 6) → verify (drift)
// Embedding happens here, ASYNCHRONOUSLY at write time (Rule 1) — never on the read path.
import {
  vectorKey,
  significanceGate,
  nextState,
  type JobState,
} from "./core.mjs";
import type { Embedder } from "./embedder.js";

export interface EmbedJobPayload {
  sourceId: string;
  sourceKind: string;
  content: string;
  significantFields?: string[];
  prevRecord?: Record<string, unknown> | null;
  nextRecord?: Record<string, unknown>;
}

// Subset of the Cloudflare Workflows step API.
interface WorkflowStep {
  do<T>(name: string, fn: () => Promise<T>): Promise<T>;
}
interface Deps {
  embedder: Embedder;
  ledger: {
    get(key: string): Promise<{ vectorId: string } | undefined>;
    link(key: string, vectorId: string): Promise<void>;
  };
  store: {
    upsertVector(row: {
      id: string; sourceId: string; sourceKind: string; contentHash: string;
      embeddingModelVersion: string; embedding: number[];
    }): Promise<void>;
    emitOutbox(key: string): Promise<void>; // ADR-0014 projector picks this up
  };
  warm: {
    kv(key: string, vec: number[]): Promise<void>;
    vectorize(key: string, vec: number[]): Promise<void>;
  };
}

export interface EmbedResult {
  state: JobState;
  key: string;
  reason: string;
}

/** The workflow body. `step` provides durability; `deps` are the platform bindings. */
export async function runEmbedPipeline(
  payload: EmbedJobPayload,
  step: WorkflowStep,
  deps: Deps,
): Promise<EmbedResult> {
  let state: JobState = "QUEUED";
  const key = vectorKey(payload.content); // Rule 5 lock asserted inside

  // Rule 2 — content-addressed dedup. The fast path: if this exact content was already embedded,
  // link the existing vector and stop. No model call, no cost.
  const existing = await step.do("dedup-check", () => deps.ledger.get(key));
  if (existing) {
    await step.do("link", () => deps.ledger.link(key, existing.vectorId));
    state = nextState(state, "DEDUP_HIT");
    return { state, key, reason: "dedup-hit" };
  }

  // Rule 3 — significance gate. On an update, skip re-embedding metadata-only changes.
  const gate = significanceGate(payload.prevRecord ?? null, payload.nextRecord ?? { content: payload.content }, payload.significantFields);
  if (!gate.reembed) {
    state = nextState(state, "NOT_SIGNIFICANT");
    return { state, key, reason: gate.reason };
  }

  // Rule 5 — embed with the locked model.
  state = nextState(state, "EMBED");
  const [vec] = await step.do("embed", () => deps.embedder.embed([payload.content]));

  // Rule 6 — persist to the authority + emit the outbox row (projector → edge tiers, ADR-0014).
  await step.do("persist", async () => {
    await deps.store.upsertVector({
      id: key,
      sourceId: payload.sourceId,
      sourceKind: payload.sourceKind,
      contentHash: key.split(":")[0],
      embeddingModelVersion: deps.embedder.model.version,
      embedding: vec,
    });
    await deps.ledger.link(key, key);
    await deps.store.emitOutbox(key);
  });
  state = nextState(state, "PERSIST");

  // Rule 6 — write-through warm so the first read is already hot (instantaneous acquisition).
  await step.do("project-warm", async () => {
    await Promise.all([deps.warm.vectorize(key, vec), deps.warm.kv(key, vec)]);
  });
  state = nextState(state, "PROJECT");

  return { state, key, reason: "embedded" };
}
