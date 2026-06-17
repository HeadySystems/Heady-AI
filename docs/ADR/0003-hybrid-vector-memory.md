# ADR-0003: Hybrid Vector Memory — pgvector as Source of Truth, Vectorize as Edge Cache
**Date:** 2025-06-01 | **Status:** Accepted | **Author:** Eric Haywood

## Context

Heady's 384D semantic memory layer requires persistent, queryable vector storage with
relational join capability (linking vectors to agent state, pipeline receipts, and user
sessions). Two candidate stores exist in the stack: Neon Postgres with pgvector (origin),
and Cloudflare Vectorize (edge). Cloudflare Vectorize supports up to 5M vectors per index
and 1536 dimensions, but lacks relational joins and is geographically constrained to
Cloudflare's edge network.

The rebuild required a single authoritative answer: which store owns the write path.

## Decision

Neon Postgres + pgvector is the **source of truth** for all vector memory.
Cloudflare Vectorize is an **edge acceleration layer only** — a read cache for
high-frequency similarity queries that do not require relational joins.

Write path: `agent → Cloud Run → pgvector (Neon)`
Read path (hot): `agent → Cloudflare Worker → Vectorize cache` (cache miss falls through to origin)
HNSW index parameters: `m=21` (fib(8)), `ef_construction=89` (fib(11))
Embedding dimensions: 384D (primary), 1536D (premium/extended)
Deduplication threshold: `PSI^6 × 0.5 ≈ 0.972`

## Consequences

### Positive
- pgvector retains full SQL expressiveness — vectors JOIN to pipeline receipts, governance logs, and agent state
- Neon branching enables zero-risk migration testing against production vector corpora
- Vectorize offloads repeated similarity lookups at the edge, reducing origin query load
- HNSW indices with Fibonacci parameters provide deterministic recall characteristics
- halfvec scalar quantization available for memory-efficient warm/cold tier storage

### Negative
- Dual-store introduces a cache coherence problem: Vectorize must be invalidated on pgvector writes
- Neon autoscale cold-start can add 200–500ms on first query after suspend
- Vectorize does not support filtered vector search (metadata pre-filtering requires origin fallback)

## Alternatives Considered

- **Pinecone**: rejected — external vendor, no SQL joins, cost unpredictability at scale
- **Weaviate**: rejected — operational overhead, self-hosted complexity
- **Vectorize only**: rejected — no relational capability, no Neon branch testing workflow
- **pgvector only**: rejected — edge latency for high-frequency reads is unacceptable
