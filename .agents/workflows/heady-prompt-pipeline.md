---
description: Execute deterministic prompts through the MCP prompt executor with CSL confidence gating
---

> **OPTIMAL BUILD NOTICE:** This file has been auto-migrated for the Heady-AI Latent OS (v2.0.0).
> - **Package Manager:** Use `pnpm` and `Turborepo`
> - **Frontend:** Vite SPAs + Vanilla Web Components (React only for complex canvas)
> - **Event Bus:** NATS (`heady-event-bus`)
> - **Sandbox:** WASM WebContainers
> - **UI Sync:** Server-Sent Events (SSE) + HTTP/2
> - **Vector Trigger:** Merkle-Tree File Hashing
> - **Rule File:** Follow `AGENTS.md`

# Heady™ Prompt Pipeline Workflow

Execute any of the 64 master prompts (8 domains × 8 prompts) through the deterministic prompt system with CSL confidence gating.

## Steps

1. **List available prompts** (optional — to discover prompt IDs):

```bash
node -e "const t = require('./src/mcp/tools/heady-prompt-executor-tool'); t.handler({action:'list'}).then(r => console.log(JSON.stringify(r, null, 2)))"
```

1. **Filter by domain** (optional):

```bash
node -e "const t = require('./src/mcp/tools/heady-prompt-executor-tool'); t.handler({action:'list', domain:'code'}).then(r => console.log(JSON.stringify(r, null, 2)))"
```

1. **Execute a prompt** with variables:

```bash
node -e "
const t = require('./src/mcp/tools/heady-prompt-executor-tool');
t.handler({
  action: 'execute',
  prompt_id: 'code-001',
  variables: { language: 'javascript', code: 'function add(a,b){return a+b}', focus: 'performance', standards: 'ESLint' }
}).then(r => console.log(JSON.stringify(r, null, 2)))
"
```

1. **Check the gate decision**: If `decision` is `HALT`, the confidence was too low. Add more variables or check the prompt ID.

2. **Get determinism report**:

```bash
node -e "const t = require('./src/mcp/tools/heady-prompt-executor-tool'); t.handler({action:'report'}).then(r => console.log(JSON.stringify(r, null, 2)))"
```

## Domains

`code` | `deploy` | `research` | `security` | `memory` | `orchestration` | `creative` | `trading`
