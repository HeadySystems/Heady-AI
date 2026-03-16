---
name: heady-durable-execution
description: Use when implementing crash-proof workflows, long-running orchestration with replay capability, or activity-based execution with heartbeats in the Heady™ ecosystem. Keywords include durable execution, Temporal, workflow, activity, replay, crash recovery, long-running, heartbeat, event history.
metadata:
  author: HeadySystems
  version: '1.0'
  liquid_node: LiquidDurable
  absorption_source: "Temporal.io ($5B) durable execution patterns"
---

# Heady™ Durable Execution (LiquidDurable)

## When to Use This Skill

Use this skill when the user needs to:
- Run workflows that survive crashes and restarts
- Implement long-running agent tasks (hours/days) with persistence
- Add human-in-the-loop approval gates to automated pipelines
- Replay failed workflows from the exact point of failure
- Coordinate multi-step operations with rollback capability

## Architecture

### Core Separation: Workflows vs Activities

| Component | Deterministic? | Examples |
|---|---|---|
| **Workflow** | ✅ Yes — pure orchestration logic | Pipeline stage sequencing, branching, waiting |
| **Activity** | ❌ No — side effects allowed | LLM API calls, file writes, HTTP requests, tool use |

```
Workflow (deterministic orchestration)
  ├─ scheduleActivity('llm_call', { prompt, model })
  ├─ scheduleActivity('file_write', { path, content })
  ├─ waitForSignal('human_approval')        ← sleeps hours/days
  ├─ scheduleActivity('deploy', { target })
  └─ return result
```

### Event History (Immutable Audit Trail)

```typescript
interface WorkflowEvent {
  id: number;                 // Monotonic sequence
  type: 'ActivityScheduled' | 'ActivityCompleted' | 'ActivityFailed'
      | 'SignalReceived' | 'TimerStarted' | 'TimerFired'
      | 'WorkflowStarted' | 'WorkflowCompleted';
  timestamp: string;
  data: unknown;
  deterministic_hash: string; // For replay verification
}
```

### Replay Mechanism

1. On crash/restart, reload Event History from persistent store.
2. Re-execute Workflow code — deterministic, produces same decisions.
3. For each `scheduleActivity` call, check Event History:
   - If ActivityCompleted exists → return cached result (skip execution).
   - If not → execute Activity for real.
4. Workflow resumes exactly where it left off.

## Instructions

### Implementing a Durable Workflow

1. **Separate orchestration from execution** — Workflows contain no I/O, Activities contain all I/O.
2. **Model calls are Activities** — They run once, results recorded in Event History.
3. **Human approvals use Signals** — Workflow sleeps (hours/days), resumes on Signal.
4. **No random/time in Workflows** — Use `workflow.now()` for deterministic time, seeded PRNG for randomness.
5. **Persist Event History** — Neon Postgres or Redis Streams.

### Activity Heartbeats

```javascript
// Long-running activities send heartbeats
async function longLLMCall(ctx, input) {
  for (const chunk of streamResponse(input)) {
    ctx.heartbeat({ progress: chunk.index });  // Prevents timeout
    await processChunk(chunk);
  }
}
// Heartbeat interval: φ³ seconds (≈4.24s)
```

### Failure Recovery

| Failure Type | Recovery |
|---|---|
| Activity timeout | Retry with exponential backoff (φ-scaled: 1.6s, 2.6s, 4.2s) |
| Activity crash | Replay from Event History, skip completed activities |
| Workflow crash | Full replay — deterministic code produces same decisions |
| Infrastructure failure | New worker picks up workflow from persisted state |

### Integration with HCFullPipeline

- Each pipeline stage = one Activity.
- Pipeline orchestration = Workflow.
- APPROVE gate (Stage 11) = Signal wait.
- Stage failures trigger Activity retry, not full pipeline restart.

## Output Format

- Workflow Execution Status
- Event History Viewer
- Activity Heartbeat Dashboard
- Replay Verification Report
- Signal Queue Status
