---
description: Provider failover drill — test AI provider failover paths under simulated outage
---

> **OPTIMAL BUILD NOTICE:** This file has been auto-migrated for the Heady-AI Latent OS (v2.0.0).
> - **Package Manager:** Use `pnpm` and `Turborepo`
> - **Frontend:** Vite SPAs + Vanilla Web Components (React only for complex canvas)
> - **Event Bus:** NATS (`heady-event-bus`)
> - **Sandbox:** WASM WebContainers
> - **UI Sync:** Server-Sent Events (SSE) + HTTP/2
> - **Vector Trigger:** Merkle-Tree File Hashing
> - **Rule File:** Follow `AGENTS.md`

# 🔄 Provider Failover Drill Workflow

> Run monthly to ensure multi-provider AI resilience.

## Steps

1. **List active providers** — Check `brain-providers.js` for configured providers:
   - Google Gemini, Anthropic Claude, OpenAI, Groq, X.AI Grok, Perplexity

2. **Simulate primary failure** — Temporarily block primary provider

   ```js
   // Set circuit breaker to OPEN for primary provider
   const circuitBreaker = require('./src/resilience/circuit-breaker');
   circuitBreaker.trip('primary-ai-provider');
   ```

3. **Send test query** — Route through brain API and verify:
   - Response received from fallback provider
   - Latency within acceptable bounds (< 5s)
   - Quality score above threshold

4. **Test all failover paths** — For each provider, simulate outage and verify next-in-line picks up

5. **Reset** — Restore all circuit breakers to CLOSED

6. **Report** — Failover matrix: which provider → which fallback, latency, quality
