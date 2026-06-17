# ADR-0002: Architecture Backbone

- **Status:** Accepted (2026-06-17, founder approval per ADR-0013)
- **Deciders:** Eric Anthony Haywood

## Context

The legacy estate accreted multiple write paths (direct DB writes, ad-hoc queues, satellite
projection shells), multiple sources of truth, and no enforced contract surface. The two
independent deep-research passes converge on the same remedy: a modular monolith with strict
bounded contexts and exactly one durable write path, rather than a constellation of services.

## Decision

1. **Modular monolith** with strict bounded contexts; one deployable backbone, not a service mesh.
2. **PostgreSQL (Neon) is the single system of record.**
3. The **transactional outbox is the *only* cross-boundary write path.** No direct cross-context
   writes, no side-channel queues. Outbox via `pgmq`; scheduling via `pg_cron`.
4. **OpenAPI-first contracts**: the spec in `packages/contracts` is authoritative; Kubb generates
   TS types, Zod schemas, and `mcp-tools.json`. CI **fails on drift** between spec and generated code.
5. Data access through `packages/db` (Drizzle) only.

## Consequences

- (+) One write path makes consistency, audit, and replay tractable for a solo founder.
- (+) Contract drift becomes a CI failure, not a production surprise.
- (+) Bounded contexts can later be extracted to services without re-architecting the data model.
- (−) Every cross-context interaction must route through the outbox — more upfront ceremony.
- Backbone is **fixed**; do not reopen without a superseding ADR. See ADR-0003 (retrieval),
  ADR-0004 (orchestration), ADR-0006 (idempotency), ADR-0007 (DDL coordination).
