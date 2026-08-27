// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Embedding — tiered acquisition adapters                   ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
// Tiered acquisition adapters (Rules 1 & 7). Canonical stack: Cloudflare KV → Vectorize → Neon pgvector.
// Wires the platform stores into the pure `acquire()` from core.mjs. The read path NEVER embeds.
import { acquire, type AcquireTier } from "./core.mjs";

// Minimal shapes of the platform bindings we depend on.
interface KVNamespace {
  get(key: string, type: "json"): Promise<number[] | null>;
}
interface VectorizeIndex {
  getByIds(ids: string[]): Promise<{ id: string; values: number[] }[]>;
}
interface PgVectorClient {
  getEmbedding(id: string): Promise<number[] | null>;
}

/** KV exact-match cache — best-effort, TTL ≤ 60s, never authoritative (ADR-0003 amended). O(1). */
export function kvTier(kv: KVNamespace): AcquireTier {
  return {
    name: "kv",
    latencyClass: "O(1) edge",
    get: async (key) => (await kv.get(key, "json")) ?? undefined,
  };
}

/** Vectorize derived edge cache — projector-populated, reconstructible (ADR-0014). ~O(log n) edge. */
export function vectorizeTier(idx: VectorizeIndex): AcquireTier {
  return {
    name: "vectorize",
    latencyClass: "edge ~O(log n)",
    get: async (key) => (await idx.getByIds([key]))[0]?.values ?? undefined,
  };
}

/** pgvector authority — the system of record. HNSW ~O(log n) at origin. Always correct. */
export function pgvectorTier(pg: PgVectorClient): AcquireTier {
  return {
    name: "pgvector",
    latencyClass: "authority ~O(log n)",
    get: async (key) => (await pg.getEmbedding(key)) ?? undefined,
  };
}

/**
 * Acquire a stored embedding by its content-addressed key, fastest tier first.
 * This is the canonical "instantaneous data acquisition" read entrypoint.
 */
export function acquireEmbedding(
  key: string,
  bindings: { kv: KVNamespace; vectorize: VectorizeIndex; pg: PgVectorClient },
) {
  return acquire(key, [kvTier(bindings.kv), vectorizeTier(bindings.vectorize), pgvectorTier(bindings.pg)]);
}
