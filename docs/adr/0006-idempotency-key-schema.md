# ADR-0006: Idempotency-Key Schema

- **Status:** Proposed (2026-06-15)
- **Deciders:** Eric Anthony Haywood

## Context

Operational gap #1. With an outbox-driven backbone (ADR-0002) and durable retries (ADR-0004),
the same logical operation *will* be delivered more than once (at-least-once semantics). Without
idempotency, retries double-charge, duplicate writes, and corrupt the ledger.

## Decision

1. Every externally-triggered mutation and every outbox consumer carries an **idempotency key**.
2. A dedicated table records `(idempotency_key, request_fingerprint, response, status, created_at)`
   with a **unique constraint on the key**; a replayed key returns the stored response, never re-executes.
3. Keys are **client-supplied** for inbound API mutations and **deterministically derived** (e.g. from
   the outbox row id) for internal consumers.
4. Idempotency records have a retention/TTL aligned with ADR-0008; expiry never resurrects a completed op.
5. The task ledger (Phase 2) is built idempotent from day one — `task` and `task_attempt` keyed accordingly.

## Consequences

- (+) Safe retries everywhere; at-least-once delivery becomes effectively-once at the application layer.
- (+) Reconciliation can replay the outbox without fear of duplication.
- (−) Every mutation path must thread a key; enforced by the contract layer (ADR-0002) and lint gate.
- See ADR-0002, ADR-0004, ADR-0009 (replay during restore drills must respect idempotency).
