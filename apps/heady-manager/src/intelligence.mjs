// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady-manager — intelligence stack wiring                   ║
// ║  Composes the cognition packages (csl-engine, embedding, events,    ║
// ║  perspective, auto-context) into a kernel-managed service whose     ║
// ║  health self-checks each component with a real operation.           ║
// ║  © 2026 HeadySystems Inc.                                           ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// In-process by design: a deterministic embedder + seeded retriever make the cognition
// layer functional BEFORE deploy. In production the retriever is @heady/memory-stream over
// Neon pgvector and embeddings come from Workers-AI bge-small-en-v1.5 (ADR-0003/0015) — the
// enrichment math (cosine gate, dedup, φ-budget) is identical either way.

import { createHash } from "node:crypto";
import { cosineSimilarity, cslGate } from "@heady/csl-engine";
// The package "." entry is TypeScript (the Workers-AI embedder, built at deploy); the pure
// content-addressing primitives live in the runnable "./core" export — use those in-process.
import { contentHash, idempotencyKey, assertModelLock, LOCKED_MODEL } from "@heady/embedding/core";
import { InMemoryBus } from "@heady/events";
import { assign } from "@heady/perspective";
import { ContextEnricher } from "@heady/auto-context";
import { HEALTH, makeHealth } from "@heady/shared";

const DIM = LOCKED_MODEL.dim; // 384

/** Deterministic 384-d embedder for the in-process cognition path (prod = Workers-AI bge-small). */
export function embed384(text) {
  const seed = createHash("sha256").update(String(text)).digest();
  const v = new Array(DIM);
  for (let i = 0; i < DIM; i += 1) {
    const b = seed[i % seed.length] ^ ((i * 31) & 0xff);
    v[i] = (b / 255) * 2 - 1; // [-1, 1]
  }
  const mag = Math.hypot(...v) || 1;
  return v.map((x) => x / mag); // unit vector → cosine well-defined
}

export function createIntelligence({ log, bus = new InMemoryBus() } = {}) {

  // Seed corpus. Production swaps in @heady/memory-stream.retrieveMemories over Neon pgvector.
  const corpus = [
    "Heady runs a five-tier architecture: edge, origin, durable, data, derived.",
    "pgvector is the single retrieval authority; Vectorize is a derived edge cache.",
    "CSL gates relevance and privileged actions using vector geometry.",
    "The MCP server serves /mcp and /mcp/v1 over Streamable HTTP.",
    "Secrets load fail-closed from GCP Secret Manager via the secrets package.",
  ].map((text, i) => ({ id: `seed-${i}`, content: text, source: "seed", embedding: embed384(text) }));

  const retriever = {
    async retrieve(_query, { limit } = {}) { return corpus.slice(0, limit ?? corpus.length); },
  };
  const enricher = new ContextEnricher({ retriever });

  const COMPONENTS = ["csl-engine", "embedding", "events", "perspective", "auto-context"];

  /** Run a real operation per component; returns an aggregated health report (worst wins). */
  async function selfCheck() {
    const checks = {};

    try {
      const v = embed384("csl self-check"); // 384-d unit vector (cosineSimilarity enforces the dim lock)
      const c = cosineSimilarity(v, v); // identical vectors → 1.0
      const g = cslGate(0.5, c); // returns a routing verdict; max relevance → "EXECUTE"
      checks["csl-engine"] = Math.abs(c - 1) < 1e-9 && g === "EXECUTE" ? HEALTH.OK : HEALTH.DOWN;
    } catch { checks["csl-engine"] = HEALTH.DOWN; }

    try {
      assertModelLock();
      const ok = contentHash("a") === contentHash("a")
        && typeof idempotencyKey("a") === "string"
        && embed384("a").length === DIM;
      checks["embedding"] = ok ? HEALTH.OK : HEALTH.DOWN;
    } catch { checks["embedding"] = HEALTH.DOWN; }

    try {
      let hit = false;
      const off = bus.subscribe("selfcheck.*", () => { hit = true; });
      await bus.publish("selfcheck.ping", { ok: true });
      if (typeof off === "function") off();
      checks["events"] = hit ? HEALTH.OK : HEALTH.DOWN;
    } catch { checks["events"] = HEALTH.DOWN; }

    try {
      const r = assign("embed memory vector", [
        { id: "memory", kind: "core", weight: 1, competencies: ["embed", "memory", "vector"] },
      ]);
      checks["perspective"] = r.length > 0 && r[0].score > 0 ? HEALTH.OK : HEALTH.DOWN;
    } catch { checks["perspective"] = HEALTH.DOWN; }

    try {
      const capsule = await enricher.enrich(
        { text: "retrieval authority", embedding: embed384("retrieval authority") },
        "stage",
      );
      checks["auto-context"] = capsule && typeof capsule.considered === "number" ? HEALTH.OK : HEALTH.DOWN;
    } catch { checks["auto-context"] = HEALTH.DOWN; }

    return makeHealth(checks);
  }

  const service = {
    name: "intelligence",
    deps: [],
    start: async () => {
      await bus.start?.();
      log?.info({ components: COMPONENTS, embedDim: DIM, eventTransport: bus.status?.().name ?? "in-memory" }, "intelligence stack online (prod retrieval uses Neon pgvector + Workers-AI)");
    },
    stop: async () => { await bus.stop?.(); },
    health: async () => selfCheck(),
    metrics: async () => ({ components: COMPONENTS.length, corpus: corpus.length, embedDim: DIM, model: LOCKED_MODEL.id }),
  };

  return { service, selfCheck, enricher, bus, embed384, components: COMPONENTS };
}
