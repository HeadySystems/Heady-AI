---
name: heady-durable-execution
description: >
  Use when implementing crash-proof, long-running orchestration with replay/checkpointing
  and human-in-the-loop gates in the Heady ecosystem. Durable execution runs on
  Cloudflare Workflows + Queues + Durable Objects (ADR-0004) — NOT Temporal. Keywords:
  durable execution, Cloudflare Workflows, workflow step, queue, Durable Object, replay,
  checkpoint, crash recovery, long-running, human-in-the-loop, rollback, idempotency.
metadata:
  author: HeadySystems
  version: '2.0'
  liquid_node: LiquidDurable
  supersedes: "Temporal.io durable-execution patterns (rejected — ADR-0004; not in the locked stack)"
---

> **OPTIMAL BUILD NOTICE (v2.0.0):** pnpm + Turborepo · Stores: Neon pgvector (authority) · Vectorize (derived cache, 384-dim) · Qdrant dropped · Embedding lock `@cf/baai/bge-small-en-v1.5` · Event bus: NATS · Follow `AGENTS.md`.

# Heady™ Durable Execution (LiquidDurable)

Durable, crash-proof orchestration on **Cloudflare Workflows + Queues + Durable Objects** — the locked durable-execution surface (ADR-0004). **No Temporal, no Cadence, no external orchestrator** — the prior Temporal-based design is superseded.

## When to Use This Skill

- Run workflows that survive crashes/restarts (automatic replay from the last durable step).
- Long-running agent tasks (minutes→days) with persisted state.
- Human-in-the-loop approval gates inside an automated pipeline.
- Multi-step operations with rollback/compensation.

For event-triggered chaining of skills/bees, use [[heady-auto-flow]] (which dispatches durable steps into this surface); for per-session edge state use [[heady-durable-agent-state]].

## Architecture (Cloudflare Workflows)

| Concept | Cloudflare primitive | Notes |
|---|---|---|
| Durable workflow | `WorkflowEntrypoint` | Each `step.do()` is checkpointed; on failure the run replays only from the last completed step. |
| Side-effecting work | `step.do(name, fn)` | LLM calls (via the **AI Gateway**), DB writes, HTTP — wrapped as retryable steps. |
| Wait / HITL gate | `step.sleep` / `step.waitForEvent` | Pause for a timer or an external approval event (no busy-wait). |
| Fan-out / async | **Queues** (`env.QUEUE.send`) | Decouple producers from consumers; at-least-once delivery. |
| Per-entity serialization | **Durable Object** | One writer per session/task; hibernates to SQLite when idle. |
| Retry/backoff | φ-backoff (`@heady/phi-math` `phiBackoff`) | Step retries use golden-ratio backoff; a `phi_circuit_breaker` opens after 5 failures. |

```typescript
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";

export class HCPipeline extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    // Each step is durable: re-running the workflow replays completed steps from history.
    const plan = await step.do("plan", () => planTask(event.payload));         // deterministic-ish
    const result = await step.do("execute", { retries: { limit: 8, backoff: "exponential" } },
      () => runViaAiGateway(plan));                                             // side effects isolated here
    await step.waitForEvent("approval", { type: "human.approve", timeout: "24 hours" }); // HITL gate
    await step.do("commit", () => persist(result));                             // idempotent write (outbox)
    return { ok: true };
  }
}
```

## Rules

1. **Workflow code is replay-safe** — no wall-clock reads, randomness, or un-stepped side effects in the entrypoint body; push all I/O into `step.do()`.
2. **Idempotent commits** — pair terminal writes with the transactional outbox + `idempotencyKey` (`@heady/db`) so replays don't double-apply.
3. **Egress through the gateway** — model calls inside steps go through the **Cloudflare AI Gateway**, never directly to providers.
4. **No Temporal** — if a source references Temporal/Cadence, map it: workflow→`WorkflowEntrypoint`, activity→`step.do`, signal→`waitForEvent`, timer→`step.sleep` (ADR-0004).
5. **φ-derived** retries/timeouts/caps come from `@heady/phi-math`.
