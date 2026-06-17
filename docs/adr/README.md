# Architecture Decision Records

One numbered file per architectural decision, Nygard format (Title · Status · Context · Decision · Consequences). **Immutable once Accepted** — superseded by a new ADR, never edited in place. This log is the single authoritative record of *why* Heady is built the way it is.

The governing principle for all of these: **pick one source of truth per concern and derive everything else from it deterministically.** "Globally consistent" does not mean synchronous replicas — it means mechanical agreement between a source and its projections, with reconciliation when they diverge.

## Status (canonical set `0000`–`0029`)

All **30 canonical ADRs are Accepted.** `0000`–`0018` (the backbone: RAM-first rejection, canonical-repo authority, architecture backbone, pgvector retrieval, durable orchestration, agent governance, idempotency, DDL coordination, GDPR, PITR, rate limits, SLO, FinOps, founder governance, CDC, embedding lock, agent loop, projections, model gateway) were ratified **2026-06-17 by founder approval per ADR-0013** in a single batch review. `0019`–`0029` were Accepted 2026-06-15 and carry v2 Reconciliation sections. Per-file `Status:` headers are authoritative.

> ✅ **Doc-drift resolved (2026-06-17):** the stale v1 ADR generation (`0001-canonical-repo`, `0002-strangler-fig-evolution`, `0003-source-of-truth-ledger`, `0004-consistency-model`, Accepted 2026-06-14) — superseded by the canonical `0001-canonical-repository-authority` / `0002-architecture-backbone` / `0003-retrieval-authority-pgvector` / `0004-durable-orchestration-center` — has been **archived to `docs/adr/superseded-v1/`** (content preserved, out of the canonical number-space). This directory indexes the canonical set only; `superseded-v1/` is quarantined from the coherence + data-consistency gates.
