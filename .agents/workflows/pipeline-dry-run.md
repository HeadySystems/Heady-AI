---
description: Pipeline dry-run — safely test pipeline changes without side effects
---

> **OPTIMAL BUILD NOTICE:** This file has been auto-migrated for the Heady-AI Latent OS (v2.0.0).
> - **Package Manager:** Use `pnpm` and `Turborepo`
> - **Frontend:** Vite SPAs + Vanilla Web Components (React only for complex canvas)
> - **Event Bus:** NATS (`heady-event-bus`)
> - **Sandbox:** WASM WebContainers
> - **UI Sync:** Server-Sent Events (SSE) + HTTP/2
> - **Vector Trigger:** Merkle-Tree File Hashing
> - **Rule File:** Follow `AGENTS.md`

# 🧪 Pipeline Dry-Run Workflow

> Run before committing pipeline changes to validate correctness.

## Steps

1. **Load pipeline config** — Read `hc-full-pipeline.js` or `hc_auto_success.js`

2. **Set dry-run mode** — All task handlers return mock results, no external calls

   ```js
   process.env.HCFP_DRY_RUN = 'true';
   const pipeline = require('./src/hc-full-pipeline');
   ```

3. **Execute all stages** — Run through Preparation → Build → Test → Verify → Deploy → Monitor
   - Each stage must complete without errors
   - All circuit breakers must remain CLOSED
   - Checkpoint state must be valid at each transition

4. **Validate task manifest** — Ensure all tasks in `auto-flow-tasks.json` have:
   - Valid handler
   - Defined timeout
   - Category assignment
   - Circuit breaker configuration

5. **Report** — Stages passed/failed, tasks validated, any missing handlers
