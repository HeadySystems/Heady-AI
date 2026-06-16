<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: AGENTS.md                                                    ║
<!-- ║  LAYER: root                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# AGENTS.md — Heady AI Coding Agent Guidelines

> Version: 2.0.0 | Updated: 2026-06-15 | Applies to the Heady-AI Monorepo
> Drop this file in the root of every repository for AI coding agent compatibility.

## Identity

This codebase belongs to **HeadySystems Inc.** — the Heady™ Latent-Space Operating System.
- **Founder:** Eric Haywood
- **Architecture:** Liquid Architecture v9.0
- **IP:** 60+ provisional patents — treat patent-locked zones with care

## Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Backend | Node.js ESM, Express (Cloud Run), Hono (CF Workers) | No CommonJS `require()` |
| Frontend | Vite SPAs + Vanilla Web Components | No Vue/Angular. React allowed strictly for complex canvas components. |
| Database | Neon Postgres + pgvector | UUID PKs, TIMESTAMPTZ, vector(384) (embedding lock: `@cf/baai/bge-small-en-v1.5`, ADR-0015) |
| Cache | Upstash Redis | Namespace: `tenant:{id}:*` |
| Auth | Firebase Auth + 27 OAuth | Cross-domain SSO via `auth.headysystems.com` |
| Execution Sandbox | WASM WebContainers | AI-generated code must run in the browser, not Cloud Run containers |
| Event Bus | NATS (`heady-event-bus`) | Typed pub/sub with wildcard routing (`agent.coder.*`) |
| Client UI Sync | Server-Sent Events (SSE) + HTTP/2 | Replaces WebSockets for unilateral server-to-client updates |
| CI/CD | GitHub Actions + Turborepo + pnpm | `pnpm turbo run build test --filter='...[origin/main...HEAD]'` |
| Observability | OpenTelemetry + Sentry + Langfuse | Structured JSON logs only |

## Coding Rules

1. **ESM only.** `import/export`, never `require()`.
2. **Zero `console.log`.** Use `pino` structured logger with `X-Heady-Trace-Id`.
3. **Zero `TODO`/`FIXME`/`HACK`.** If it's not done, don't commit it.
4. **Zero `localhost`.** All URLs from env vars. Cloud-deployed only.
5. **Zod validation** on all API inputs. No unvalidated data crosses service boundaries.
6. **HEADY_BRAND header** required in all new files.
7. **Redis keys** always namespaced: `tenant:{id}:*`.
8. **φ-derived constants.** Timeouts, TTLs, pool sizes from `phi-constants.js`. Zero magic numbers.
9. **Tests alongside code.** Vitest for unit, Playwright for E2E, k6 for load.
10. **Error handling everywhere.** No empty catch blocks. No swallowed promises.
11. **Vector Embeddings Trigger.** File indexing is triggered locally via **Merkle-tree file hashing**, never Postgres CDC.

## File Header Template

```javascript
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ [Module Name] v[X.Y.Z]                                ║
// ║  [One-line description]                                        ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝
```

## Architecture Patterns

- **Latent Service Pattern:** Every service exports `{ start, stop, health, metrics }`.
- **CSL Gates:** Use `cslGate(value, cosScore, tau)` for thresholds, not `if/else`.
- **φ-Scaling:** `phiBackoff()` for retries, `FIB[n]` for pool sizes, `PHI_7 * 1000` for heartbeats.
- **3-Tier Memory:** T0 Redis/KV (hot, best-effort TTL ≤60s) → T1 Neon pgvector (warm, retrieval authority) → T2 Vectorize (derived edge cache, reconstructible, dim-locked 384). Qdrant is dropped (ADR-0003 amended, R2).
- **Fallback Chain:** Every critical function has a fallback. Never single point of failure.
- **Circuit Breaker:** 5 failures → open, φ-backoff (1,618,034µs base), probe after 30s.

## Systemic Services & MCP Tool Governance

All system-level services and MCP tools are classified into **Permanent (Mandatory)** and **Optional (Discretionary)** categories. All agents must default to executing through the permanent stack unless a fallback path is explicitly triggered.

### Permanent Systemic Services
* **HeadyAutoContext (5-Pass Middleware):** Ubiquitous and mandatory. Runs automatically prior to any reasoning stage to build grounded workspace context.
* **HeadyEventBus (NATS):** Authoritative inter-service messaging channel (`agent.coder.*`). Standard pub/sub communication is permanent.
* **HeadyVault & GCP Secret Manager:** Canonical keyless secret resolver (OIDC). Direct credential storage in code or `.env` files is strictly blocked.
* **Neon PostgreSQL & pgvector:** Authoritative storage and semantic memory retriever. No external DB/vector stores (e.g. Qdrant) may serve as source of truth.
* **SSE Client Sync:** Authoritative Server-Sent Events channel for UI synchronization.

### Mandatory MCP Tool Invocations
Agents **must** invoke these tools on specific execution triggers:
* **Context Mutation (`heady_autocontext_enrich`):** Call immediately when establishing new project invariants, new service routes, or secret metadata.
* **Context Diagnostics (`heady_autocontext_history`):** Query immediately during debugging or when a confidence check (`phiGATE`) fails.
* **Policy Compliance (`heady_governance_enforce`):** Call prior to code submission, PR creation, or canary deployment to verify rule conformance.
* **Workspace Structuring (`heady_project_tree` & `heady_env_audit`):** Call on startup to establish monorepo scope and environmental variables.

### Optional & Discretionary Services
* **Perplexity Sonar Search (`perplexity_ask` / HeadyResearch):** Optional. Fallback for external web grounding when local documentation is insufficient.
* **React UI Canvas:** Optional. Strictly allowed for advanced graphic canvases/dashboards; standard UI must use Vanilla Web Components.
* **WASM WebContainer Sandbox:** Optional. Used strictly for running client-side previews of AI-generated widgets in-browser.
* **Integration Connectors (Slack, Cloudflare Pages, etc.):** Optional. Invoked selectively based on targeted distribution workflows.

## Patent Lock Zones

Files marked with `⚠️ PATENT LOCK` require ARBITER swarm review before modification.
Patent IDs: HS-2026-051 through HS-2026-062.

## Environment Variables

All secrets from GCP Secret Manager or `.env` with `[SECRET]` markers. Key env vars:
- `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `DATABASE_URL` (Neon Postgres)
- `INTERNAL_NODE_SECRET` (inter-service auth)
- `VAULT_PASSPHRASE` (API key encryption)

## Testing

```bash
# Unit tests
pnpm vitest run

# Lint
pnpm eslint src/ --ext .js,.ts

# Type check (if TS)
pnpm tsc --noEmit

# Build (monorepo)
pnpm turbo run build test --filter='...[origin/main...HEAD]'
```

## Deploy

```bash
# Cloud Run (φ-stepped canary)
gcloud run deploy heady-manager --image gcr.io/gen-lang-client-0920560496/heady-manager:$VERSION \
  --region us-central1 --min-instances 1 --max-instances 13

# Cloudflare Workers
pnpm wrangler deploy

# Cloudflare Pages
pnpm wrangler pages deploy dist/
```

## Do Not

- Add Vue, Angular, or other frontend frameworks (React is allowed when it is beneficial for Heady)
- Use `localhost`, `127.0.0.1`, or hardcoded URLs
- Write placeholder code, stubs, or TODO comments
- Use magic numbers — derive from `PHI`, `PSI`, or `FIB[]`
- Commit secrets to source control
- Skip error handling or validation
- Modify patent-locked files without review

---

*∞ Sacred Geometry · Liquid Intelligence · Permanent Life ∞*
*© 2026 HeadySystems Inc. — Eric Haywood, Founder*
