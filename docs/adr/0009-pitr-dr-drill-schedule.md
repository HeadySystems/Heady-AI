# ADR-0009: PITR / DR Drill Schedule

- **Status:** Accepted (2026-06-17, founder approval per ADR-0013)
- **Deciders:** Eric Anthony Haywood

## Context

Operational gap #4. Neon is the single system of record (ADR-0002) and the single retrieval authority
(ADR-0003) — a total dependency. A backup that has never been restored is a hypothesis, not a recovery
plan. The antigravity "verify" step omitted restore testing entirely.

## Decision

1. **Point-in-time recovery (PITR) enabled** on Neon with a documented retention window.
2. **Monthly restore drill**: restore to a scratch branch, run integrity checks (row counts, outbox
   consistency, vector index sanity), record measured **RTO and RPO**, and file the result.
3. Drills replay **migrations in order** (ADR-0007) and respect **idempotency** on outbox replay (ADR-0006).
4. Documented **RTO/RPO targets**; a drill that misses target is an incident (ADR-0011), not a footnote.
5. The drill is **scheduled and tracked** (`pg_cron` reminder + checklist in `heady-docs`), not ad-hoc.

## Consequences

- (+) Recovery is a rehearsed, measured procedure, not a first-time-in-prod gamble.
- (+) Surfaces migration/replication breakage (ADR-0007) before a real outage does.
- (−) Monthly drill is recurring founder time; accepted — it is the cheapest insurance in the stack.
- See ADR-0002, ADR-0006, ADR-0007, ADR-0008, ADR-0011.
