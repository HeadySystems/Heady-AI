# ADR-0008: Data Retention & GDPR Posture

- **Status:** Proposed (2026-06-15)
- **Deciders:** Eric Anthony Haywood

## Context

Operational gap #3. The system stores user interactions, embeddings (ADR-0003), task ledgers, and
idempotency records (ADR-0006). With no retention policy, personal data accumulates indefinitely
across the SoR, the vector store, caches, and logs — a GDPR liability and a cost driver (ADR-0012).

## Decision

1. Every table holding personal or interaction data declares a **retention class** and TTL; expiry
   is enforced by `pg_cron` jobs, not manual cleanup.
2. **Right-to-erasure** is a first-class operation: a deletion request purges the SoR row, its
   embeddings in pgvector, derived projections, and KV cache entries — tracked via the outbox so the
   erasure fan-out is auditable and idempotent.
3. **Data minimization**: embeddings and logs store the minimum needed; no raw PII in logs or traces
   (OTel attributes scrubbed).
4. A **data map** (what is stored where, lawful basis, retention) is maintained in `heady-docs`.
5. Backups (ADR-0009) honor retention via expiry windows; erasure of long-lived backups is documented.

## Consequences

- (+) Bounded data growth, defensible GDPR posture, lower storage spend.
- (+) Erasure is provable and complete because it flows through the one write path (ADR-0002).
- (−) Erasure-across-projections requires the outbox fan-out to be correct; covered by reconciliation.
- See ADR-0003, ADR-0006, ADR-0009, ADR-0012.
