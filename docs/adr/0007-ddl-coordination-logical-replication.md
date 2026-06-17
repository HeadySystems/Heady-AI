# ADR-0007: DDL Coordination across Logical Replication

- **Status:** Accepted (2026-06-17, founder approval per ADR-0013)
- **Deciders:** Eric Anthony Haywood

## Context

Operational gap #2. `auto-context` uses WAL→projector CDC (ADR change-significance filtering), and
the architecture relies on logical replication. PostgreSQL logical replication **does not replicate
DDL** — an unschedule-coordinated `ALTER TABLE` on the publisher silently breaks subscribers and the
projector. Vector schema changes (ADR-0003) are equally exposed.

## Decision

1. **All DDL is migration-managed** (Drizzle migrations in `packages/db`); no manual `ALTER` in prod.
2. DDL follows an **expand → migrate → contract** sequence: additive change first, backfill, then
   remove, so publisher and subscriber are compatible at every step (no breaking change in one shot).
3. Schema changes to replicated/published tables require **coordinated application** to subscriber and
   projector before the contract phase; CI verifies the projector understands the new shape.
4. **Change-significance filtering** on the CDC stream is part of the projector contract, not ad-hoc.
5. Migrations are reversible and gated behind the same human-approval flow as code (ADR-0005).

## Consequences

- (+) Replication and the auto-context projector never silently desync on schema change.
- (+) Expand/contract makes every migration zero-downtime and rollback-safe.
- (−) Two- or three-phase migrations are more work than a single `ALTER`; accepted for safety.
- See ADR-0002 (db package), ADR-0003 (vector schema), ADR-0009 (restore must replay migrations in order).
