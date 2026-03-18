---
name: heady-simulation-sandbox-design
description: Design the Heady Simulation Sandbox for safe experimentation, dry-run execution, what-if analysis, and rollback-safe testing of agent actions. Use when building sandboxed execution environments, designing dry-run modes, creating simulation previews for risky operations, or planning rollback mechanisms.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Simulation Sandbox Design

Use this skill when you need to **design, build, or extend the Simulation Sandbox** — Heady's environment for safe experimentation where agents and users can preview, test, and roll back actions without affecting real systems.

## When to Use This Skill

- Designing sandboxed execution environments for agent actions
- Building dry-run modes that show what would happen without doing it
- Creating what-if analysis for code changes, deployments, and configuration
- Planning rollback mechanisms for recoverable experimentation
- Defining isolation boundaries between sandbox and production
- Designing simulation previews for risky operations (deploys, migrations, bulk edits)

## Instructions

### 1. Define Sandbox Execution Modes

The Sandbox operates in three modes:

| Mode | Description | Side Effects |
|------|-------------|-------------|
| **Preview** | Show what would happen, execute nothing | Zero — pure prediction |
| **Dry Run** | Execute in an isolated copy, show results | Isolated only — no production impact |
| **Guarded Run** | Execute for real with automatic rollback capability | Real but reversible within rollback window |

### 2. Design the Isolation Architecture

Keep sandboxed execution separate from production:

```
┌──────────────────────────────────────────┐
│ Production Environment                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│  │ Files   │ │ APIs    │ │ Data    │    │
│  └─────────┘ └─────────┘ └─────────┘    │
└──────────────────┬───────────────────────┘
                   │ snapshot / copy-on-write
┌──────────────────┴───────────────────────┐
│ Sandbox Environment                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│  │ Files   │ │ API     │ │ Data    │    │
│  │ (copy)  │ │ (mock)  │ │ (copy)  │    │
│  └─────────┘ └─────────┘ └─────────┘    │
│                                           │
│  ┌─────────────────────────────────────┐  │
│  │ Agent executes here                 │  │
│  │ All writes captured, not committed  │  │
│  └─────────────────────────────────────┘  │
└───────────────────────────────────────────┘
```

**Isolation rules:**
- File system: copy-on-write snapshot; writes go to overlay, reads fall through to snapshot
- APIs: intercepted and routed to mock or replay layer
- Database: transaction-wrapped — all changes are rolled back unless explicitly committed
- Network: outbound calls are logged but optionally blocked or mocked

### 3. Build Preview Mode

Show what would happen without executing:

```yaml
preview_request:
  action: what the agent wants to do
  context: current state of the environment

preview_response:
  changes:
    - type: file_edit
      path: src/auth/login.ts
      diff: unified diff showing proposed changes
    - type: api_call
      endpoint: POST /api/users
      payload: {what would be sent}
      expected_response: {predicted response}
    - type: command
      command: npm test
      predicted_outcome: "14 tests pass, 0 fail"
  risk_assessment:
    level: low | medium | high | critical
    factors: [why this risk level was assigned]
  side_effects:
    - description: human-readable summary of each side effect
      reversible: true | false
```

### 4. Design Dry Run Execution

Execute in full isolation:

```
1. Create sandbox environment (snapshot + overlay)
2. Execute the action sequence in the sandbox
3. Capture all side effects (file changes, API calls, output)
4. Present results to user:
   - What changed (diffs, logs, output)
   - What external calls were made (mocked responses)
   - Performance metrics (duration, resource usage)
5. User decides: commit to production, discard, or modify
6. If commit: replay the action sequence against production
7. Cleanup sandbox environment
```

### 5. Implement Guarded Run with Rollback

Execute for real, but with a safety net:

```yaml
guarded_run:
  pre_execution:
    - Create checkpoint (file snapshots, git stash, DB savepoint)
    - Log all state that will be modified
    - Set rollback window (default: 30 minutes)
  during_execution:
    - Execute normally against production
    - Log every side effect in the trust receipt ledger
    - Monitor for anomalies (unexpected errors, timeouts)
  post_execution:
    - Present results with rollback option
    - If user approves: finalize, release checkpoint
    - If user rejects: trigger rollback to checkpoint
    - If anomaly detected: auto-pause and prompt user
  rollback:
    - Restore files from checkpoint
    - Revert database to savepoint
    - Cannot undo external API calls (flag these as non-reversible)
```

### 6. Design What-If Analysis

Compare multiple approaches in parallel sandboxes:

```
What-If: "Should I refactor auth as middleware or a decorator?"

Sandbox A: Middleware approach
  → Execute refactor in sandbox
  → Run tests
  → Measure: lines changed, test coverage, performance

Sandbox B: Decorator approach
  → Execute refactor in sandbox
  → Run tests
  → Measure: lines changed, test coverage, performance

Comparison:
  | Metric        | Middleware | Decorator |
  |---------------|-----------|-----------|
  | Lines changed | 45        | 32        |
  | Tests passing | 100%      | 100%      |
  | Build time    | 4.2s      | 4.1s      |

Recommendation: Decorator approach — fewer changes, same outcome
```

### 7. Plan Resource Management

Sandboxes consume resources; manage them:

- **Lifetime** — sandboxes auto-expire after configurable timeout (default: 1 hour)
- **Limits** — max concurrent sandboxes per user (default: 3)
- **Storage** — copy-on-write minimizes disk usage; cleanup overlay on expiry
- **Compute** — sandbox execution shares the same resource pool with lower priority

## Output Format

When designing Sandbox features, produce:

1. **Execution mode definitions** with side-effect profiles
2. **Isolation architecture** diagram
3. **Preview response schema**
4. **Dry-run workflow** with commit/discard flows
5. **Rollback mechanism** specification
6. **What-if comparison** framework
7. **Resource management** policies

## Tips

- **Preview is the cheapest safety net** — show what will happen before doing anything
- **Copy-on-write is essential** — full environment clones are too expensive; overlay only what changes
- **External API calls can't be rolled back** — always flag these clearly in preview and dry-run modes
- **What-if analysis sells the sandbox** — comparing approaches side-by-side is a killer feature
- **Don't sandbox everything** — low-risk reads and analyses don't need isolation; focus on writes and side effects
