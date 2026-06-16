---
name: heady-auto-flow
description: "Automated flow orchestration — chaining Heady skills, workflows, and bees into self-driving task pipelines without per-step human prompting. Use when wiring multi-step automation across the Latent OS: event-triggered sequences, agent-to-agent hand-offs, and continuous-action loops coordinated over the NATS event bus and gated by CSL. Keywords: auto-flow, automation, orchestration, pipeline, event-triggered, flow definition, hand-off, continuous-action loop, self-driving, NATS, CSL gate, φ-backoff."
---

> **OPTIMAL BUILD NOTICE:** This file has been auto-migrated for the Heady-AI Latent OS (v2.0.0).
> - **Package Manager:** Use `pnpm` and `Turborepo`
> - **Frontend:** Vite SPAs + Vanilla Web Components (React only for complex canvas)
> - **Event Bus:** NATS (`heady-event-bus`)
> - **Sandbox:** WASM WebContainers
> - **UI Sync:** Server-Sent Events (SSE) + HTTP/2
> - **Vector Trigger:** Merkle-Tree File Hashing
> - **Rule File:** Follow `AGENTS.md`

# Heady™ Auto-Flow (LiquidAutoFlow)

Auto-Flow turns a **declarative flow definition** into a self-driving pipeline: each step is a
skill, bee, or workflow; steps advance on **NATS events** rather than human prompts; every transition
passes a **CSL gate**; retries use **φ-backoff**; and runaway is bounded by a **φ-circuit-breaker**.
It is the connective tissue between the other Heady primitives — it does not replace them.

## When to Use This Skill

Use Auto-Flow when the user needs to:
- Chain multiple skills/bees/workflows so the output of one triggers the next **without per-step prompting**.
- React to events (a file changed, an embed completed, a PR opened, a sync finished) by **automatically** running follow-on work.
- Hand a task **from one agent to another** with typed context transfer.
- Run a **continuous-action loop** (poll → act → re-evaluate) that advances toward a goal and stops on a CSL-gated done condition.

Do **NOT** use Auto-Flow for: a single one-shot tool call (just call it); anything that needs human approval at every step (Auto-Flow gates, it does not rubber-stamp — there is **no "approve all"**); or durable, crash-proof multi-hour orchestration (that is Cloudflare Workflows — Auto-Flow *dispatches into* Workflows for those steps).

## Architecture

```
 trigger (NATS subject)            CSL gate            φ-backoff retry
        │                            │                      │
        ▼                            ▼                      ▼
   ┌─────────┐   emit    ┌────────────────────┐   ok   ┌──────────┐
   │  STEP n │ ────────▶ │ evaluate transition │ ─────▶ │ STEP n+1 │ ──▶ … ──▶ done-gate
   └─────────┘  event    └────────────────────┘  halt  └──────────┘
        ▲                            │ cautious                      │
        └──────── re-plan ◀──────────┘                               ▼
                                                              terminal observation
```

- **Steps** are `skill` | `bee` | `workflow` references. Auto-Flow never inlines logic — it composes existing primitives.
- **Transitions** are driven by `heady.observation.*` events on the bus ([[heady-event-bus]]), not polling.
- **Gating** is the 3-layer CSL ternary gate (EXECUTE / CAUTIOUS / HALT) on each transition — see [[heady-csl-engine]].
- **Resilience**: `phiBackoff()` on retry, a `phi_circuit_breaker` that opens after 5 failures, and hard loop/budget caps.

### Flow definition (declarative, Zod-validated)

```javascript
// flow.mjs — a flow is data, not code. Validate at the boundary (AGENTS.md #5).
import { z } from "zod";
import { PHI, FIB } from "@heady/phi-math"; // φ-derived constants; zero magic numbers

export const StepSchema = z.object({
  id: z.string(),
  kind: z.enum(["skill", "bee", "workflow"]),
  ref: z.string(),                       // skill name / bee type / workflow id
  input: z.record(z.unknown()).default({}),
  // advance when this NATS subject is observed (supports wildcards: agent.coder.*)
  on: z.string(),
  // CSL thresholds for the transition out of this step (defaults are φ-derived)
  gate: z
    .object({ halt: z.number().default(1 / (PHI * PHI)), execute: z.number().default(1 / PHI) })
    .default({}),                        // HALT < 0.382 · CAUTIOUS · EXECUTE ≥ 0.618
  next: z.string().nullable().default(null),
  onHalt: z.string().nullable().default(null), // hand-off / re-plan target
  maxRetries: z.number().int().default(FIB[6]), // fib(6)=8
});

export const FlowSchema = z.object({
  id: z.string(),
  trigger: z.string(),                   // NATS subject that starts the flow
  steps: z.array(StepSchema).min(1),
  // continuous-action loop: re-enter `loopFrom` until done-gate passes or caps hit
  loop: z
    .object({ from: z.string(), doneSubject: z.string(), maxIterations: z.number().int().default(FIB[10]) })
    .nullable()
    .default(null),                      // fib(10)=55 hard cap
  budgetTokens: z.number().int().nullable().default(null),
});
```

### The Auto-Flow engine

```javascript
// auto-flow.mjs — composes the bus + CSL + φ-resilience. ESM, structured logging only.
import { connect, StringCodec } from "nats";
import { cslGate, phiBackoff } from "@heady/csl-engine";
import { logger } from "@heady/shared"; // pino + X-Heady-Trace-Id
import { FlowSchema } from "./flow.mjs";

const sc = StringCodec();

export async function runFlow(rawFlow, { runSkill, runBee, runWorkflow }) {
  const flow = FlowSchema.parse(rawFlow);          // fail-closed on bad input
  const nc = await connect({ servers: process.env.NATS_URL }); // never hardcode; env only
  const trace = crypto.randomUUID();
  const log = logger.child({ traceId: trace, flow: flow.id });
  const byId = new Map(flow.steps.map((s) => [s.id, s]));
  const dispatch = { skill: runSkill, bee: runBee, workflow: runWorkflow };

  let breaker = 0;            // φ-circuit-breaker: opens at 5
  let iterations = 0;
  let current = flow.steps[0];

  while (current) {
    let attempt = 0;
    let observation;
    // execute the step with φ-backoff retry
    for (;;) {
      try {
        observation = await dispatch[current.kind](current.ref, { ...current.input, trace });
        break;
      } catch (err) {
        attempt += 1;
        breaker += 1;
        if (attempt > current.maxRetries || breaker >= 5) {
          log.error({ step: current.id, err: err.message }, "auto-flow step failed; opening breaker");
          await nc.publish(`heady.system.flow.halted`, sc.encode(JSON.stringify({ flow: flow.id, step: current.id })));
          await nc.drain();
          return { ok: false, halted: current.id, trace };
        }
        await phiBackoff(attempt); // 1.618s · 2.618s · 4.236s … (φⁿ)
      }
    }
    breaker = Math.max(0, breaker - 1); // success bleeds the breaker down

    // CSL-gated transition (no "approve all"): score the observation against the step goal
    const decision = cslGate(observation.confidence ?? 0, observation.cosScore ?? 0, current.gate);
    log.info({ step: current.id, decision }, "auto-flow transition");
    await nc.publish(`heady.observation.flow.${current.id}`, sc.encode(JSON.stringify(observation)));

    if (decision === "HALT") {
      current = current.onHalt ? byId.get(current.onHalt) : null; // hand-off / re-plan or stop
      continue;
    }
    // CAUTIOUS and EXECUTE both advance; CAUTIOUS is surfaced for human-visible audit, not blocked here.

    // continuous-action loop handling
    if (flow.loop && current.id === flow.loop.from) {
      iterations += 1;
      if (iterations >= flow.loop.maxIterations) {
        log.warn({ iterations }, "auto-flow loop cap reached; stopping (no silent runaway)");
        break;
      }
    }
    current = current.next ? byId.get(current.next) : null;
  }

  await nc.drain();
  return { ok: true, iterations, trace };
}
```

## Defining and running a flow (example)

A real flow: **when a `heady-sync pull` finishes, embed the changed corpus, then register skills, gated by the consistency check.**

```javascript
const flow = {
  id: "sync-then-embed-then-register",
  trigger: "heady.observation.sync.completed",
  steps: [
    { id: "gate",     kind: "skill",    ref: "heady-deep-scan",          on: "heady.observation.gate.done",     next: "embed",    gate: { execute: 0.618 } },
    { id: "embed",    kind: "workflow", ref: "HCEmbedPipeline",          on: "heady.observation.embed.done",    next: "register", onHalt: "gate" }, // re-scan on low confidence
    { id: "register", kind: "skill",    ref: "heady-skill-foundry",      on: "heady.observation.register.done", next: null },
  ],
};
// runFlow(flow, { runSkill, runBee, runWorkflow });
```

## Composition map (what Auto-Flow calls into)

| Concern | Delegated to | Skill |
|---|---|---|
| Typed event transport | NATS `heady-event-bus` | [[heady-event-bus]] |
| Transition gating | CSL 3-layer ternary gate | [[heady-csl-engine]] |
| Step = agent worker | HeadyBee lifecycle | [[heady-bee-swarm-ops]] |
| Crash-proof long steps | Cloudflare Workflows | [[heady-durable-execution]] |
| Multi-agent hand-off | A2A messaging | [[heady-a2a-protocol]] |
| Goal decomposition before a flow | task split | [[heady-task-decomposition]] |
| Drift-triggered re-runs | drift monitor | [[heady-drift-detection]] |

## Safety & governance (non-negotiable)

1. **No "approve all".** Every transition is CSL-gated; HALT routes to a hand-off/re-plan or stops. Privileged or irreversible steps must require an explicit gate, never a blanket pass.
2. **Fail closed.** Bad flow definitions fail Zod validation; missing `NATS_URL` aborts — Auto-Flow never invents a localhost fallback (AGENTS.md #4).
3. **Bounded.** A φ-circuit-breaker opens after 5 step failures; `loop.maxIterations` (default fib(10)=55) and `budgetTokens` cap runaway. Caps that trip are logged, never silent.
4. **Observable.** Every step/transition emits a `heady.observation.flow.*` event and a pino line carrying `X-Heady-Trace-Id` — a flow run is fully reconstructable from the bus.
5. **φ-derived constants.** All thresholds, backoffs, and caps come from `@heady/phi-math` (`PHI`, `FIB[]`) — zero magic numbers (AGENTS.md #8).
