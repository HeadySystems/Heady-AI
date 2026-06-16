# ADR-0027: Task Ledger & Outbox-driven Sync (Linear/Sentry)

- **Status:** Accepted (2026-06-16)
- **Deciders:** Eric Anthony Haywood

## Context

The task-ledger coordinates complex, long-running agent tasks and must sync states with external platforms (Linear for project management, Sentry for error loops) without introducing latency or failures into the core database transactions. Performing direct, synchronous API calls during database transactions risks thread blockages, API rate limit crashes, and split-brain states if the transaction rolls back after an external request succeeds.

## Decision

1. **Transactional Outbox for All Syncs**: All integrations (including Linear issue syncing and Sentry issue tracking) must be driven via a transactional outbox (`task_outbox` table in Neon Postgres).
2. **Atomic In-Transaction Enqueuing**: When a task state is mutated, the database change and the corresponding outbox sync record are committed within the **same** relational transaction.
3. **Asynchronous Edge Dispatching**: A Cloudflare Queue Worker consumes outbox events asynchronously, managing the API calls to Linear and Sentry.
4. **Consistency Model**: We apply the **PACELC** theorem. Under partition (P), the system prioritizes consistency (C) for local ledger states and latency (L) for the user, allowing Linear and Sentry records to become eventually consistent (E).
5. **Idempotency Safeguard**: Every outbox processor run is gated by the `idempotency_key` table to prevent duplicate issue creation or double-firing.

## Consequences

- (+) Guarantees database transactions execute with sub-millisecond latencies, independent of external network speeds.
- (+) Eliminates split-brain states: an external sync message is never dispatched if the local transaction fails.
- (+) Automatically handles external API outages via queue retries with exponential φ-backoffs.
- (−) Updates on Linear and Sentry are eventually consistent, introducing a sub-second propagation delay.
- (−) Increases database write volumes by writing outbox logs to Neon for every task state transition.
