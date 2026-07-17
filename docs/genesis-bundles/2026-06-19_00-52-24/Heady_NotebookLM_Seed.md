# Heady Latent OS Genesis Bundle - 2026-06-19_00-52-24

## Current State
The system is currently focused on native Liquid Architecture (Node.js) execution, eliminating Python bridges in favor of direct WASM and native integrations. The Auto-Success Engine is actively polling intelligence tasks (Linear Sync) on a 144-task heartbeat. Sovereign architecture rules apply unconditionally.



---
# FILE: AGENTS.md
---

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
- **IP:** <!--heady:inject facts.company.patents_provisional-->51<!--/heady:inject--> provisional patents — treat patent-locked zones with care

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


---
# FILE: SOURCE_OF_TRUTH.md
---

# Source of Truth

> **Status:** Approved · **Date:** 2026-06-17
> Canonical authority declaration for the Heady ecosystem. See ADR-0001.
> **Updated 2026-06-17:** `rebuild` is now the default branch. `main` archived as `legacy/main-archive`.

## Canonical branch

| Branch | Status |
|---|---|
| **`rebuild`** | **Default + canonical — all new work targets here** |
| `legacy/main-archive` | Frozen · locked · preserved for IP provenance (sha: 3a54aeee) |
| `main` | Legacy pointer (will be retired after verification period) |

## Canonical repositories

| Role | Repository | Status |
|---|---|---|
| **Canonical engineering monorepo** | `HeadySystems/heady-ai` (`rebuild` branch) | **Authoritative** |
| **Canonical docs / strategy / IP hub** | `HeadyMe/heady-docs` | Authoritative (read-only catalog) |
| Legacy core | `HeadyMe/Heady-pre-production-9f2f0642` | Migrate `heady-manager` logic, then archive |
| `HeadySystems/main`, `HeadySystems/Heady`, `ai-workflow-engine` | — | **Archived** (do not build from) |
| `*-core` satellites (headyme, headymcp, headysystems, …) | thin projection shells | **Fold into monorepo** or label projection-only |

Releases, provenance, contract generation, and CI run **only** from the canonical monorepo, `rebuild` branch.

## Single authorities

| Concern | Authority |
|---|---|
| System of record | Neon PostgreSQL (ADR-0002) |
| Retrieval / vectors | Neon pgvector (ADR-0003) — not Vectorize, not Qdrant |
| Cross-boundary writes | Transactional outbox only (ADR-0002) |
| Contract surface | `packages/contracts` (OpenAPI → Kubb → types/Zod/`mcp-tools.json`) |
| Durable orchestration | Cloudflare Workflows + Queues + Durable Objects (ADR-0004) |
| Secrets | GCP Secret Manager via keyless OIDC (ADR-0008) |
| Identity | Firebase Auth |

## GitHub org consolidation

Collapse 4 orgs → 1 (`HeadySystems`) as the first migration step, before code consolidation.

## Action items

- [x] Approve this declaration + ADR-0001.
- [x] Flip default branch to `rebuild` (2026-06-17).
- [x] Archive `main` as `legacy/main-archive` (locked, tag: `archive/main-2026-06-17`).
- [x] Branch protections on `rebuild`: CI gate + coherence gate required.
- [ ] Add CI check: release/provenance only from canonical repo.
- [ ] Archive the repos marked Archived; add projection manifests only for satellites that survive.

## Canonical planning documents

- `docs/REBUILD_PLAN_V2.md` — current rebuild plan (supersedes `OPTIMAL_REBUILD_PLAN.md` v1).
- `docs/STEPWISE_BUILD_SPEC.md` — every component as an ordered build step (Build/Depends/Details/Done/Ref).
- `docs/BUILD_NARRATIVE.md` — the story of how the build should go (read before accepting ADRs).
- `docs/PROVIDER_AND_OSS_MASTER_PLAN.md` — provider & open-source utilization.
- `docs/compendium/` — exhaustive component-by-component reference (bees, swarms, governance, transforms, …).
- `docs/adr/0000–0018` — architecture decisions (0000 + 0014–0018 added, 0003/0005 amended in v2 reconciliation).
- `docs/ENV_SEPARATION.md` — legacy vs rebuild provider namespacing spec.

φ = 1.618033988749895 — Fibonacci-scaled per LAW-10
© 2026 HeadySystems Inc. — Eric Haywood, Founder


---
# FILE: CLAUDE_PROJECT_INSTRUCTIONS.md
---

# 🦁 HEADY LION PERSONA - SYSTEM INSTRUCTIONS

You are the Lion, the decisive leader and commander of the Heady Latent OS system. Your role is to architect, execute, and govern the Heady Latent OS Modular Monolith rebuild. 

## 1. Core Operating Directives
- **Decisive Authority:** You gather input, but YOU make the final call. Act with certainty.
- **Strict Compliance:** Adhere completely to `AGENTS.md`. 
- **Ownership:** You own the code you write. No placeholder implementations (`TODO`, `FIXME`). Write production-ready code.
- **Proactive Advisory Mandate:** Always proactively identify and recommend infrastructure safeguards, cost-saving measures, and billing protections (e.g., usage-caps, enterprise configurations) whenever relevant context appears. Never wait for the user to ask.

## 2. Architectural Mandates
1. **No Magic Numbers:** All retry intervals, pool sizes, and limits must be derived from `phi-constants.js` (φ-scaling where `phi=1.618`).
2. **ESM Only:** No CommonJS `require()`. Use `import/export`.
3. **Zero Localhost:** All URLs must come from environment variables.
4. **Zod Validation:** All API inputs must be validated at service boundaries.
5. **UI & Styling:** Use Vite SPAs + Vanilla Web Components. Style with Sacred Geometry tokens (fibonacci spacing, glassmorphism) and NO heavy frameworks like React unless strictly necessary for 3D canvas.

## 3. Current Project State
We are currently operating inside `/home/headyme/Heady-AI/`. 
- The project is an enterprise pnpm + Turborepo monorepo.
- The `headyme-portal` has been successfully deployed to Firebase.
- Always check `task.md` and `artifacts/implementation_plan.md` to see your current objectives before writing code.

*Drive execution without hesitation. Communicate with absolute authority.*


---
# FILE: facts.yaml
---

# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ facts.yaml — golden record (single source of derived facts)║
# ║  Loaded/validated by @heady/config. Derived artifacts (README       ║
# ║  badges, CI matrices, OpenAPI servers) generate FROM this file.     ║
# ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                   ║
# ╚══════════════════════════════════════════════════════════════════╝
schema: facts.v1
company:
  legal_name: HeadySystems Inc.
  trade_name: Heady
  founder: Eric Anthony Haywood
  patents_provisional: 51
product:
  name: heady-ai
  version: 3.0.0
  status: pre-launch
platform:
  package_manager: pnpm
  pnpm_version: 9.15.9
  node_version: 22
  monorepo_tool: turborepo
  module_system: esm
  phi: 1.618033988749895
registries:
  npm_scope: "@heady"
stores:
  system_of_record: neon-postgres
  retrieval_authority: pgvector
  derived_edge_cache: vectorize
  cache: upstash-redis
  dropped:
    - qdrant
embedding:
  model: "@cf/baai/bge-small-en-v1.5"
  dim: 384
  pooling: mean
model_layer:
  egress_chokepoint: cloudflare-ai-gateway
  edge_tier: workers-ai
  fallback_chain:
    - workers-ai
    - cloud-run
    - colab
event_bus: nats
ui_sync: sse-http2
durable_execution: cloudflare-workflows
agent_harness: vercel-ai-sdk-v6
auth: firebase-auth
secrets: gcp-secret-manager
supply_chain:
  primary:
  security_only: dependabot
deploy_targets:
  origin:
    kind: gcp-cloud-run
    region: us-central1
    node: 22
  edge:
    kind: cloudflare-workers
  pages:
    kind: cloudflare-pages
pipeline:
  stages:
    - lint
    - typecheck
    - test
    - build
    - scan
    - deploy
  required_checks:
    - lint
    - typecheck
    - test
    - scan
hcfullpipeline:
  # HCFullPipeline — the autonomous orchestration DAG. Canonical = 21 stages (0–20),
  # CHANNEL_ENTRY → RECEIPT, anchored to fib(8)=21 (φ-native; 22 is not a Fibonacci number and
  # cannot be canonical). Authority: .agents/context/HEADY_SUPER_PROMPT_v5.md §6 + the Accepted
  # "21-Stage HCFullPipeline as Canonical" ADR. The compendium's "22 (00–21)" was an off-by-one
  # (numbered from 00 and appended DISTILL past the canonical terminal RECEIPT). Full path = 21;
  # variants: Fast 7 / Arena 9 / Learning 7. Any prose/skill asserting "N-stage HCFullPipeline" or
  # "HCFP — N Stages" is checked against this by the coherence gate.
  stage_count: 21
consistency:
  escalation_threshold: 3
legacy:
  source_root: "~/Heady"
  disposition_doc: docs/LEGACY_STACK_COMPONENT_DISPOSITION.md
