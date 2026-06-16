---
description: Run the 9-stage battle-sim orchestration pipeline for competitive AI evaluation
---

> **OPTIMAL BUILD NOTICE:** This file has been auto-migrated for the Heady-AI Latent OS (v2.0.0).
> - **Package Manager:** Use `pnpm` and `Turborepo`
> - **Frontend:** Vite SPAs + Vanilla Web Components (React only for complex canvas)
> - **Event Bus:** NATS (`heady-event-bus`)
> - **Sandbox:** WASM WebContainers
> - **UI Sync:** Server-Sent Events (SSE) + HTTP/2
> - **Vector Trigger:** Merkle-Tree File Hashing
> - **Rule File:** Follow `AGENTS.md`

# Heady™ Battle Sim Workflow

Run the full 9-stage pipeline: Task → Sim → CSL Gate → Battle/MC → Bee → Swarm → Result → Drift → Audit.

## Steps

1. **View pipeline stages**:

```bash
node -e "const t = require('./src/mcp/tools/heady-battle-sim-tool'); t.handler({action:'stages'}).then(r => console.log(JSON.stringify(r, null, 2)))"
```

1. **Execute a battle sim**:

```bash
node -e "
const t = require('./src/mcp/tools/heady-battle-sim-tool');
t.handler({
  action: 'execute',
  task: { id: 'test-1', prompt: 'Compare sorting algorithms', domain: 'code' }
}).then(r => console.log(JSON.stringify(r, null, 2)))
"
```

1. **Compare with external output**:

```bash
node -e "
const t = require('./src/mcp/tools/heady-battle-sim-tool');
t.handler({
  action: 'compare',
  task: { prompt: 'Compare sorting algorithms' },
  external_output: 'QuickSort is generally fastest for average case...'
}).then(r => console.log(JSON.stringify(r, null, 2)))
"
```

1. **Get determinism report** (after multiple runs):

```bash
node -e "const t = require('./src/mcp/tools/heady-battle-sim-tool'); t.handler({action:'report'}).then(r => console.log(JSON.stringify(r, null, 2)))"
```
