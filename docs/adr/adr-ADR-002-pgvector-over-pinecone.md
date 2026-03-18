   # ADR-002: pgvector over Pinecone

   **Status:** Accepted
   **Date:** 2026-01-15
   **Author:** Eric Haywood
   **Heady Systems Inc. — Sacred Geometry v4.0**

   ## Problem

   Which vector database to use for 384-dimensional embeddings

   ## Decision

   Use self-hosted pgvector with HNSW indexing (m=21, ef_construction=144)

   ## Consequences

- Full data sovereignty — no vendor lock-in, no data leaves our infrastructure
- Hybrid search: BM25 full-text + dense vector with Reciprocal Rank Fusion
- Co-located with relational data (sessions, analytics, feature flags)
- HNSW parameters are Fibonacci-derived: m=21 (fib(8)), ef_construction=144 (fib(12))
- Trade-off: Requires self-management, but PgBouncer (pool_size=34) handles connection scale

   ---
   *© 2026 HeadySystems Inc. — 51 Provisional Patents*
