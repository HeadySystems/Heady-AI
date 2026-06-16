# ADR-0023: Vector Projection Ingestion Trigger

- **Status:** Accepted (2026-06-15)
- **Deciders:** Eric Anthony Haywood

## Context

To keep the 3D vector space and the latent LLM memory perfectly aligned with the source code, we must trigger re-embedding operations reliably when files change.

## Decision

1. **Merkle-Tree File Hashing (`heady-merkle-index`)** is the authoritative trigger for vector re-indexing.
2. The system computes incremental hashes of the file system.
3. Only files whose Merkle hash has changed will be re-embedded into Neon `pgvector` (the retrieval authority) and projected to the Vectorize derived edge cache (ADR-0003, amended; Qdrant dropped per R2).
4. Postgres CDC (Change Data Capture) and Git webhooks are rejected for file-level syncs to ensure deterministic performance independent of database latency or remote git pushes.

## Consequences

- (+) Deterministic, fast, and works seamlessly during local offline development.
- (+) Significantly reduces redundant LLM embedding costs.
- (−) Requires maintaining an accurate local Merkle tree index.

## Reconciliation (v2, 2026-06-15 — resolves the CDC apparent-conflict)

**Scoped by source — two triggers, two domains, no conflict with ADR-0014:**
- **File/code re-indexing:** **Merkle-tree hashing** (`heady-merkle-index`) triggers re-embedding when
  source files change (this ADR). Incremental: only changed leaf→root paths rehash.
- **Database → derived-store projection:** **WAL-driven logical-replication CDC** (ADR-0014) keeps
  Vectorize/KV in sync with the Neon system of record.
This ADR's "reject CDC" applies **only to file-level syncs**, not the SoR→projection path. Note: the
"re-embed into Qdrant" clause is superseded by **R2** (Qdrant dropped; target is pgvector + Vectorize cache).
See ADR-0014, ADR-0003 (amended), and R2.
