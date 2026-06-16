---
description: Agent performance review — evaluate all agents for effectiveness and optimization
---

> **OPTIMAL BUILD NOTICE:** This file has been auto-migrated for the Heady-AI Latent OS (v2.0.0).
> - **Package Manager:** Use `pnpm` and `Turborepo`
> - **Frontend:** Vite SPAs + Vanilla Web Components (React only for complex canvas)
> - **Event Bus:** NATS (`heady-event-bus`)
> - **Sandbox:** WASM WebContainers
> - **UI Sync:** Server-Sent Events (SSE) + HTTP/2
> - **Vector Trigger:** Merkle-Tree File Hashing
> - **Rule File:** Follow `AGENTS.md`

# 📊 Agent Performance Review Workflow

> Run monthly to evaluate agent effectiveness and identify optimization opportunities.

## Steps

1. **Inventory all agents** — Scan `src/agents/` and `configs/agent-profiles/`
   - heady-buddy-agent, heady-code-agent, heady-fintech-agent, nonprofit-agent
   - buddy-error-protocol, pipeline-handlers

2. **Collect metrics per agent**:
   - Tasks executed (from telemetry ring buffer)
   - Success rate
   - Average response time
   - Error types and frequency
   - Resource consumption (memory, CPU)

3. **Evaluate against goals**:
   - HeadyBuddy: conversation quality, response relevance
   - Claude Code: code quality, security audit coverage
   - Fintech: trade accuracy, risk management compliance
   - Nonprofit: engagement metrics, community impact

4. **Identify underperformers** — Any agent below 80% success rate

5. **Generate improvement recommendations** — Based on error patterns and bottlenecks

6. **Update agent profiles** — Adjust priorities, prompts, or configurations in `configs/agent-profiles/`

7. **Report** — Performance scorecard per agent with trend indicators
