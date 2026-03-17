# AGENTS.md — Heady AI Platform

> AI coding agents: read this file for context before modifying any code.

## Project Overview
HeadyAI is a globally distributed, self-improving AI platform (Liquid Architecture v9.0). Monorepo structure with 60+ packages, 120+ services, 30+ apps.

## Architecture Laws — MUST FOLLOW
1. **Law of Liquidity** — Every function has a fallback. Every state is checkpointed.
2. **Law of φ** — All timeouts, TTLs, thresholds use golden ratio (φ = 1.618033988749895).
3. **Law of Sovereignty** — ZERO localhost, ZERO tunnels. Everything cloud-deployed with real domains.
4. **Law of Zero Placeholders** — Every line of code must be real, functional, connected. No stubs, no mocks in production.

## Tech Stack
- **Runtime:** Node.js ESM (no CommonJS `require()`)
- **Frontend:** Vanilla HTML/CSS/JS only (no React/Vue/Angular)
- **API:** Express (Cloud Run) + Hono (Cloudflare Workers)
- **Database:** Neon Postgres + pgvector (384D, all-MiniLM-L6-v2)
- **Cache:** Upstash Redis (REST API)
- **LLM Chain:** Gemini Flash-Lite → DeepSeek V3.2 → Azure GPT-4o-mini → Groq → Workers AI → Colab vLLM
- **Auth:** Firebase Auth (27 OAuth providers) + cross-domain SSO
- **Observability:** Sentry (10% trace sampling) + Langfuse
- **CI/CD:** GitHub Actions + Turborepo

## Key Constants
```js
PHI = 1.618033988749895
PHI_INV = 0.618033988749895  // CSL include gate
PHI_SQ = 2.618033988749895   // retry backoff
PHI_7 = 29034                // heartbeat ms
TOP_K = 21                   // Fibonacci[7]
MAX_BEES = 34                // Fibonacci[8]
VECTOR_DIM = 384
```

## CSL Scoring (Continuous Semantic Logic)
- CORE ≥ 0.718 — inject into active context
- INCLUDE ≥ 0.618 — add to response context
- RECALL ≥ 0.382 — searchable
- VOID < 0.382 — filtered

## Redis Key Namespace
All keys: `tenant:{userId}:{type}:{subtype}`

## Directory Layout
- `packages/heady-core/` — φ-constants, CSL, tenant keys
- `packages/heady-llm/` — LLM fallback chain + embeddings
- `packages/heady-memory/` — T0 Redis + T1 Neon + bootstrap
- `packages/hcfullpipeline/` — 22-stage cognitive pipeline
- `packages/heady-guard/` — Zod schemas, Ed25519 signing
- `services/heady-api/` — Express API (Cloud Run)
- `services/heady-cf-worker/` — Cloudflare Worker (Hono)

## Protocols
- **MCP** — agent↔tool (Streamable HTTP transport)
- **A2A** — agent↔agent (Agent Cards, HTTP/SSE/JSON-RPC)
- **AG-UI** — agent↔user (event-based streaming)

## Before Making Changes
1. Run `node -c <file>` to syntax-check
2. Ensure no `localhost` or `127.0.0.1` references
3. Use ESM imports (`import`), never CommonJS (`require`)
4. Validate inputs with Zod schemas
5. Use φ-scaled timeouts and retry intervals
