# ADR-0014: Logical Replication & WAL-Driven CDC

- **Status:** Proposed (2026-06-15)
- **Deciders:** Eric Anthony Haywood

## Context

`auto-context` and the Tier-5 derived projections (Vectorize edge cache, KV) must stay in sync with the
SoR without a second write path (ADR-0002) and without a heavyweight broker. The corpus specifies a
WAL→projector CDC pipeline; this ADR fixes its mechanism and its hard constraints.

## Decision

1. **Neon `wal_level = logical`** (irreversible on Neon — this ADR is the record of that one-way choice).
2. **CDC consumer** = a small Node `pg-logical-replication` (`pgoutput`) consumer — **no Kafka/Debezium**
   at this scale. Use the **direct endpoint, not the pooler**, for the replication slot; heartbeat the
   slot via `pg_logical_emit_message()`.
3. **Change-significance filtering**: diff before/after row images; skip re-embedding/re-projection when
   only metadata changed (eliminates the majority of embedding calls).
4. **Projector → derived stores only** (Vectorize/KV), never back to the SoR; every projected record
   carries `{content_hash, model_id, model_version, embedded_at, valid_from}`.
5. **Three drift checks** (the consistency guarantee): count parity at quiescence; PK-sample
   `content_hash` audit (Postgres vs Vectorize); frozen-Q→relevant-doc-id retrieval canary on a golden
   set. Drift pages on-call (ADR-0011).

## Consequences

- (+) One write path; derived stores reconstructible (ADR-0000); no broker to operate.
- (+) Significance filtering slashes embedding cost (ADR-0012).
- (−) Logical replication does **not** replicate DDL — schema changes need ADR-0007 coordination.
- See ADR-0002, ADR-0003 (amended), ADR-0007, ADR-0009.
