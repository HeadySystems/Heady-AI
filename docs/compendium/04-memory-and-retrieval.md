# 04 — Memory & Retrieval

> The latent memory spine: tiers, the AutoContext middleware, the cognitive-memory patterns ported as TS
> schemas, and the retrieval stack. **What · Why · How · When · Where · Disposition.** Grounded in
> ADR-0000/0002/0003(amended)/0014/0015.

---

## M1. The memory tiers (canonical, reconciled from V9 §9)

**What.** A tiered memory hierarchy from working set to cold archive. **Why.** Latency/cost/durability
tradeoff: hot data instant, cold data cheap, all reconstructible from the SoR (ADR-0000). **How/Where —
canonical mapping (R2):**

| Tier | Role | V9 backend | **Canonical backend** |
|---|---|---|---|
| **T0 Working** | session-bound, instant, 21 capsules | Upstash Redis | Upstash Redis / CF KV — **best-effort, TTL≤60s, never authoritative** |
| **T1 Short-term** | 144K vectors, 47h TTL, consolidation at ψ | Neon pgvector HNSW | **Neon pgvector HNSW** (authority) |
| **T2 Hot/Warm** | 0–55d | **Qdrant** | **Vectorize derived edge cache** (Qdrant DROPPED, R2) |
| **T2 Cold/Archive** | 55–144d+ | pgvector in Neon | **pgvector in Neon** (co-located, cheap) |
| Cross-region | distributed session state | Azure Cosmos (free) | deferred (multi-region = P4) |

**Consolidation cadence:** T1→T2 every φ⁴≈6.85h; T0 eviction every 21h; hot→warm every 55h. **When.**
Phase 2. **Disposition:** baseline with the store reconciliation — one authority (pgvector), one derived
cache (Vectorize), best-effort KV in front; **no Qdrant, no Upstash-Vector-DiskANN** in baseline (P4
evidence-gated).

## M2. AutoContext — the 5-pass intelligence middleware

**What.** "Nothing executes without AutoContext. It IS the intelligence." A mandatory middleware that
assembles grounded context before any action. **Why.** Anti-hallucination + recall + recipe fast-pathing.
**How — 5 passes:** (1) Intent embedding → 1536-D; (2) Memory retrieval T0→T1→T2, top-21 CSL-gated
(τ=ψ²); (2.5) **Recipe retrieval** from the distiller registry — Tier-3 match ≥ψ fast-paths to EXECUTE,
Tier-2 injects pipeline config, Tier-1 injects an optimized prompt; (3) Knowledge grounding (Graph-RAG +
`wisdom.json` + domain docs); (4) Context compression (`NOT(compressed, noise)` dedup); (5) Confidence
assessment (`phiGATE` → EXECUTE/CAUTIOUS/HALT). **When.** Before every pipeline stage that reasons.
**Where.** `heady-auto-context`, `heady-memory-knowledge-os`. **Disposition:** baseline (the
`auto-context` package, fed by the CDC projector, ADR-0014).

## M3. Cognitive-memory patterns (ported as TS schemas, not Python servers)

**What/Why/How** — port the *patterns*, run them on the durable spine (ADR-0003):

| Pattern | Source | Heady implementation |
|---|---|---|
| Episodic / semantic / procedural | **CoALA** taxonomy | `events` / `facts` / `skills` tables |
| In-context typed memory blocks | **Letta/MemGPT** | `memory_blocks` (character-budgeted); tools `core_memory_append`, `archival_memory_insert`, `conversation_search` |
| Derived-memory mutation | **mem0** ADD/UPDATE/DELETE/NOOP | conservative LLM-as-arbiter for v1 |
| Evolving facts (bi-temporal) | **Zep/Graphiti** | two timestamp pairs + `invalidated_by_event_id` **in Neon** — no Neo4j/FalkorDB |
| Background consolidation | **sleep-time agent** | Cloudflare Cron / DO-on-alarm; primary loses core-memory edit tools, paired idle agent owns them |
| Retrieval scoring | **Park et al.** | recency × importance × relevance (cheap on pgvector) |
| Skill accretion | **Voyager** | code → embedding → index in `skills` |

**Disposition:** baseline (Phase 2 `memory-stream`). **Latent reasoning** (Coconut/Huginn/Quiet-STaR) is
**research-only** — treat reasoning as an opaque LLM call; do not bake latent-reasoning assumptions in.

## M4. The retrieval stack

**What.** Hybrid-first retrieval with agentic refinement. **How.** In Neon: pgvector **HNSW (m=16,
ef_construction=200)** + GIN-indexed generated `tsvector` (+ optional `pg_trgm`), fused via **Reciprocal
Rank Fusion (k=60)** in one SQL CTE; **Vectorize** is the edge cache for hot queries, not the primary
retriever. Add a **reranker** (Cohere Rerank v3.5 / bge-reranker-v2-m3 / LFM2-ColBERT-350M) to recover
recall lost to 384-D. **HyDE opt-in** on low-confidence paths only; **CRAG-style relevance gating** (cheap
evaluator + web-search fallback) in the agentic flow. The retriever is just another MCP tool ("LLM
decides when to retrieve"). **Embedding locked** (ADR-0015). **When.** Phase 2. **Disposition:** baseline.

## M5. HeadyFS & spatial memory (x-ref `07-T5`)

**What.** 3D UMAP projection of memory (semantic domain × temporal recency × importance) for the "3D
vector workspace" UX. **Disposition:** P4 visual; UMAP coords precomputable as a Tier-5 derived
projection earlier.

## M6. Memory governance

Retention/TTL per tier enforced by `pg_cron` (ADR-0008); right-to-erasure fans out through the outbox to
SoR + Vectorize + KV (ADR-0008); every vector carries `embedding_model_version` (ADR-0015); drift checks
guard SoR↔cache parity (ADR-0014). MemoryBee/EmbedBee/VectorBee are the runtime arms (`02`).

**Disposition rollup:** memory is **canonical and central** — the one place V9 and v2 most agree (both
reject RAM-first; both put pgvector at the center). The only changes from V9 are R2 (Qdrant→Vectorize-
cache) and the explicit reconstructibility guarantee (ADR-0000/0014).
