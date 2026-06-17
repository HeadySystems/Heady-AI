# ADR-0004: Durable Orchestration Center

- **Status:** Accepted (2026-06-17, founder approval per ADR-0013)
- **Deciders:** Eric Anthony Haywood

## Context

Long-running agent loops, retries, and scheduled jobs need durable execution. The legacy estate
spread this across ad-hoc cron, in-process timers, and bespoke retry code. Multiple orchestration
surfaces multiply failure modes and make recovery non-deterministic.

## Decision

1. **One durable orchestration surface: Cloudflare Workflows + Queues + Durable Objects.**
2. **Push reads to the Worker; route writes to Cloud Run** (which owns the SoR connection). Rationale:
   *every Worker→Cloud Run hop is a $-and-ms tax* — serve reads at the edge, reserve the origin for writes.
3. **Circuit breaker is a library**, not a separate service.
4. Edge Code Mode and DO-per-session are the **correct direction but Phase 2+**, not baseline (correction #6).
5. Durable workflows are the only place long-running/retryable orchestration lives — no in-process timers
   for cross-request work.

## Consequences

- (+) Deterministic recovery: workflow state survives restarts; retries are idempotent (ADR-0006).
- (+) Edge reads cut latency and origin cost.
- (−) Couples orchestration to Cloudflare primitives; mitigated by keeping business logic in libraries,
   not in DO/Workflow glue.
- See ADR-0002 (single write path via outbox), ADR-0010 (rate limits at the edge).
