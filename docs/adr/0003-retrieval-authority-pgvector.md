# ADR-0003: Retrieval Authority — pgvector

- **Status:** Proposed (2026-06-15) · **Amended** 2026-06-15 (v2 reconciliation — see §Amendment)
- **Deciders:** Eric Anthony Haywood

## Context

The antigravity plan proposed a 3-tier memory stack (Upstash Redis + pgvector + Qdrant) plus
Cloudflare Vectorize. For a solo-founder operation each vector store is a separate operational
surface, consistency boundary, and bill. Both deep-research passes flagged this as premature
maximalism — there is no measured workload that justifies a second vector engine.

## Decision

1. **pgvector (in Neon) is the single retrieval authority.** Vectors live beside the system of
   record, so retrieval inherits the same backups, PITR, and transactional guarantees (ADR-0009).
2. **Not Vectorize, not Qdrant** in the baseline.
3. A **KV cache sits in front** of retrieval for hot reads; it is a cache, never a source of truth.
4. Any second vector engine (Qdrant/Vectorize) is **deferred to Phase 4** and gated on a benchmark
   showing pgvector is the bottleneck, behind a feature flag with a rollback path (ADR-0013 evidence gate).

## Consequences

- (+) One store to back up, secure, and reason about; retrieval is transactionally consistent with data.
- (+) Eliminates cross-store sync drift between the SoR and the vector index.
- (−) pgvector may need index tuning (HNSW/IVFFlat) at scale; accepted until a benchmark says otherwise.
- Supersedes antigravity correction #1. See ADR-0002 (backbone), ADR-0007 (DDL on the vector schema).

## Amendment (2026-06-15, REBUILD_PLAN_V2 §4 reconciliation)

The full dropzone corpus + V9 super prompt were weighed. The newest synthesis
(`heady-liquid-latent-os-stepwise.md`) and the founder's confirmation that **nothing is in production**
settle the store question. This amendment refines (does not overturn) the decision:

1. **pgvector remains the sole retrieval *authority*** — HNSW (`m=16`, `ef_construction=200`) + GIN
   `tsvector` + optional `pg_trgm`, fused via **Reciprocal Rank Fusion (k=60)** in one SQL CTE. Add a
   **reranker** (Cohere Rerank v3.5 / bge-reranker-v2-m3 / LFM2-ColBERT-350M) to recover 384-dim recall.
2. **Vectorize is permitted as a Tier-5 *derived edge cache*** — projector-populated only, every record
   carrying `{content_hash, model_id, model_version, embedded_at, valid_from}`, reconstructible via
   `rebuild:vectorize --from-postgres`, **dimension immutable at create (384)**, **never an authority**.
   This promotes Vectorize from "deferred" (item 2/4 above) to "permitted derived cache."
3. **Qdrant is DROPPED** (not merely deferred). It is absent from the five-tier target architecture, is
   provisioned-but-unused, and is free to decommission pre-launch. Reintroduce only via an ADR-0013
   evidence gate. *(Note: V9 §9 and the MCP build guide assumed Qdrant for the T2 memory tier; that
   assumption is superseded here.)*
4. **Redis/KV is best-effort only** — TTL ≤ 60s, marked `"never authoritative"` in code. Upstash
   (already provisioned) fills this role; Cloudflare KV is an acceptable substitute.
5. **Embedding model locked:** `@cf/baai/bge-small-en-v1.5`, **384-dim, `mean` pooling** (Cloudflare
   Workers AI, MIT, edge-resident). Pooling mode is immutable after first ingest. Migration recipe:
   dual-write `heady-v2` with `embedding_model_version`, shadow-eval vs a frozen Ragas testset until
   scores stabilize, flag-flip, drop v1. Watch EmbeddingGemma-300M (Matryoshka-truncatable to 384).

See ADR-0015 (embedding-model lock), ADR-0014 (logical replication for the projector).
