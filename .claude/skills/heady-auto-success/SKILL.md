# /heady-auto-success

Inspect, debug, control, and extend the Heady Auto-Success Engine — the always-on,
event-driven autonomous task reactor that drives continuous HCFullPipeline execution.

## What This Does

The Auto-Success Engine (`src/orchestration/hc_auto_success.js`) is an event-driven reactor:
- **144 tasks** across 13 φ-scaled categories (fib(12) × fib(7))
- Reacts to 39 system events (`pipeline:started`, `deploy:completed`, `health:degraded`, etc.)
- Never idle — reacts to `system:boot`, then to every downstream event
- 100% success rate — all errors absorbed as learning events
- **New (2026-03-19)**: 13 HCFullPipeline tasks added (hcfp-001 through hcfp-013)

## Key Files

| File | Purpose |
|------|---------|
| `src/orchestration/hc_auto_success.js` | Main engine — task catalog, reactor, trial ledger |
| `src/orchestration/hcfp-event-bridge.js` | Bridges HCFPRunner ↔ global.eventBus (NEW) |
| `src/orchestration/auto-commit-deploy.js` | Auto-commit/push on φ⁸-interval (NEW) |
| `src/bootstrap/engine-wiring.js` | Boot wiring — section 8 (auto-success), section 13 (HCFP bridge) |
| `data/auto-success-tasks.json` | Persistent task history (MAX_HISTORY=2584) |
| `data/auto-success-audit.json` | Tamper-evident audit chain (MAX_AUDIT=6765) |
| `data/trial-ledger.json` | Input/output hash ledger for repeat detection |

## Usage

### Check Engine Status
```bash
curl http://localhost:3301/api/auto-success/status | jq .
# Returns: running, reactionCount, taskCount, safeMode, lastReactionTs
```

### Check HCFP Bridge Status
```bash
curl http://localhost:3301/api/hcfp-bridge/status | jq .
# Returns: cycleCount, wiredEventCount, lastRunAt, triggerIntervalMs
```

### Force a Cycle
```bash
curl -X POST http://localhost:3301/api/auto-success/force-cycle | jq .
# Triggers immediate reaction with all 144 tasks
```

### Trigger a Manual Pipeline Run
```bash
curl -X POST http://localhost:3301/api/hcfp-bridge/trigger \
  -H "Content-Type: application/json" \
  -d '{"task": "manual-debug-run"}' | jq .
```

### Add a Task to the Catalog (runtime)
```javascript
const { AutoSuccessEngine } = require('./src/orchestration/hc_auto_success');
// Task is added to TASK_CATALOG at module load via TASK_CATALOG.push()
// To add at runtime, emit a 'registry:updated' event:
global.eventBus.emit('registry:updated', { source: 'custom', task: 'added' });
```

### Check Task History
```bash
curl http://localhost:3301/api/auto-success/history?limit=20 | jq .
```

## Critical Architecture

```
global.eventBus
     │
     ├── pipeline:trigger ──→ HCFPEventBridge._autonomousTrigger()
     │                               │
     │                               └──→ HCFPRunner.run('autonomous-cycle-N')
     │                                         │
     │                                         ├── run:start  ──→ pipeline:started
     │                                         ├── run:complete ──→ pipeline:completed
     │                                         └── stage:failed ──→ pipeline:failed
     │
     ├── pipeline:started ──→ AutoSuccessEngine.react('pipeline:started')
     │                               │
     │                               └──→ All 144 tasks fire in parallel
     │                                    including hcfp-001 (re-triggers pipeline)
     │
     └── system:boot ──→ AutoSuccessEngine.react('system:boot')  ← bootstrap
```

## φ-Math Timing

| Constant | Value | Purpose |
|----------|-------|---------|
| φ⁷ × 1000ms | 29,034ms | HCFPEventBridge autonomous trigger interval |
| φ⁸ × 1000ms | 46,971ms | auto-commit-deploy check interval |
| φ⁵ × 1000ms | 11,090ms | Initial delay before first pipeline trigger |
| φ⁴ × 1000ms | 6,854ms | Auto-success engine cycle (legacy timer mode) |

## Diagnosing Issues

### Auto-success engine not reacting to pipeline events
```
Root cause: global.eventBus not passed to engine.wire() OR HCFPEventBridge not started
Fix: Check engine-wiring.js section 13 — verify bridge.start() called with valid eventBus
```

### Pipeline never runs autonomously
```
Root cause: HCFPEventBridge._timer is null OR runner not connected
Fix: POST /api/hcfp-bridge/trigger to manually start a run, then check bridge status
```

### auto-commit-deploy silently failing
```
Root cause: src/orchestration/auto-commit-deploy.js was MISSING (fixed 2026-03-19)
Fix: File now exists. Verify: node -e "require('./src/orchestration/auto-commit-deploy').getStatus()"
```

### 100+ vulnerability warnings on push
```
Root cause: GitHub Dependabot on HeadyAI/Heady default branch (2 critical, 40 high)
Fix: Run npm audit fix on root package.json, or use --force for critical deps
```

## Autonomy Policy

- `requires_approval`: none (all tasks self-contained)
- `auto_run`: true
- `can_modify_files`: true (auto-commit writes commits)
- `can_execute_commands`: true (git, gcloud for deploy)
- `pipeline_trigger`: true (emits pipeline:trigger events)
