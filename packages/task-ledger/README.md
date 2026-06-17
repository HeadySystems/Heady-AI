<!-- HEADY_BRAND:BEGIN
  HEADY™ · @heady/task-ledger · LAYER: packages
  ∞ Sacred Geometry · Liquid Intelligence ∞
HEADY_BRAND:END -->

# @heady/task-ledger — Task Ledger & Transactional Outbox

Handles task queue scheduling, execution metrics, and outbox mirroring for external triggers (Linear + Sentry) with atomicity and idempotency.

## Core Features

1. **Transactional Outbox for All Syncs (ADR-0027)**: All mutations emit an outbox record in the same database transaction.
2. **Task State Machine**: Enforces valid status transitions: `PENDING` -> `RUNNING` -> `SUCCEEDED` / `FAILED` / `CANCELLED`.
3. **Idempotency Safeguard**: Uses `@heady/db` idempotency key hashes to prevent duplicate tasks.
4. **Task Dependencies**: Handles DAG-based dependencies (`task_dep`).
