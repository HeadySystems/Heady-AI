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
<!-- ║  FILE: CLAUDE.md                                                    ║
<!-- ║  LAYER: root                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# CLAUDE.md — Heady-AI Codebase Guide

> **Read `AGENTS.md` first** for system instructions and architecture rules — it is the
> authoritative rulebook and this file never overrides it. **Read `CLAUDE_MEMORY.md`**
> for current handoff context and project status. This guide complements both with a
> map of the repository.

## What This Repository Is

`HeadySystems/heady-ai` is the **canonical engineering monorepo** for the Heady™
Latent-Space Operating System (HeadySystems Inc., founder Eric Haywood). Per
`SOURCE_OF_TRUTH.md` and `docs/adr/0001-canonical-repository-authority.md`:

- Releases, provenance, contract generation, and CI run **only** from this repo.
- Docs / strategy / IP hub lives separately in `HeadyMe/heady-docs` (read-only catalog).
- `HeadySystems/main`, `HeadySystems/Heady`, and `ai-workflow-engine` are **archived —
  do not build from them**. `*-core` satellite repos are thin projection shells.

**Position in the delivery flow:** all engineering happens here. Downstream repos —
`HeadySystems/Heady-Staging` (ORS-gated five-stage promotion surface) and the
`Heady-Main` production mirror — are promotion/projection targets, not development
surfaces (see `docs/blueprints/REFERENCE_ARCHITECTURE_PROJECTIONS_DELIVERY_RESTORE.md`).
Hash-suffixed `Heady-Main-*` duplicates are archived; treat any instruction to build
there as a misroute.

**Branch policy** — two documents govern it, read both before branch work:

- `SOURCE_OF_TRUTH.md` (ADR-0001): `rebuild` is the canonical branch; `main` was
  archived as `legacy/main-archive`.
- `docs/DUAL_ACTIVE_BRANCH_STRATEGY.md` (active policy, supersedes the retirement
  model): `main` (npm, PM2, legacy-compatible, deploys to the `heady-main` Cloud Run
  service) and `rebuild` (pnpm, clean-slate, deploys to `heady-rebuild`) are **both
  first-class and always deployable**. **Never merge one into the other** — port by
  cherry-pick or reimplementation only, and record it in `PARITY_LOG.md` /
  `docs/BRANCH-PARITY.md`.

## Tech Stack (verified)

| Layer | Tech | Where |
|---|---|---|
| Runtime | Node.js >= 22, `packageManager: pnpm@9.15.9` | `package.json` |
| Monorepo | Turborepo + pnpm workspaces (`apps/*`, `packages/*`, `tooling/*`, `configs/*`) | `turbo.json`, `pnpm-workspace.yaml` |
| Backend | Express (`heady-manager.js`, default port 3301 via `PORT`/`HEADY_PORT`); Hono on Cloudflare Workers | root, `cloudflare/` |
| Frontend | Vite SPAs + Vanilla Web Components; React only for complex canvas work | `apps/`, `public/` |
| Data | Neon Postgres + pgvector (retrieval authority, ADR-0003); Upstash Redis cache | `packages/db`, `packages/embedding` |
| Embeddings | Locked to `@cf/baai/bge-small-en-v1.5`, `vector(384)` (ADR-0015) | `tooling/embed-corpus` |
| Events | NATS typed pub/sub (`heady-event-bus`); SSE for client UI sync | `packages/events` |
| Auth | Firebase Auth + OAuth federation, SSO via `auth.headysystems.com` | `src/auth/` |
| Orchestration | Cloudflare Workflows + Queues + Durable Objects (ADR-0004) | `cloudflare/` |
| Deploy | Docker → Cloud Run (`Dockerfile`, container port 8080); Cloudflare Workers/Pages via wrangler; Terraform in `infra/` + `infrastructure/terraform/`; PM2 (`ecosystem.config.cjs`) is `main`-branch legacy only | root |
| Observability | OpenTelemetry + Sentry + Langfuse; pino structured JSON logs | `packages/observability`, `packages/logger` |
| Testing | Jest at root (`jest.config.js`, `tests/`); Vitest for new packages, Playwright E2E, k6 load per `AGENTS.md` | root, `packages/*` |

## Repository Structure

| Path | Purpose |
|---|---|
| `heady-manager.js` | Root Express server / API gateway / MCP entrypoint (Cloud Run `CMD`) |
| `apps/` | Deployable apps: `heady-manager`, `heady-portal-gateway`, `heady-portal-proxy`, `headyme-portal`, `headysystems`, `mcp-dashboard`, `heady-edge-gatekeeper`, `ableton-edge` |
| `packages/` | Shared libraries: `phi-math`, `csl-engine`, `contracts` (OpenAPI → Kubb → types/Zod/`mcp-tools.json`), `db`, `embedding`, `events`, `logger`, `observability`, `secrets`, `security-mesh`, `resilience`, `kernel`, `memory-stream`, `auto-context`, `consistency-bus`, `task-ledger`, and more |
| `tooling/` | Repo machinery: `embed-corpus` (gate-then-embed workflow), `awareness` (realtime change awareness), `governance-gate`, `data-consistency`, `skill-registry` (syncs `.agents/` → `.claude/`), `law-lint`, `coherence`, `handoff` |
| `cloudflare/` | Edge workers: `worker-ai-gateway`, `worker-heady-router`, `worker-mcp-telemetry`, `heady-edge-node` |
| `src/` | Manager runtime modules: agents, bees, auth, connectors, engines, governance, `hc-full-pipeline.js` |
| `configs/` | YAML/JSON source of truth: `governance-policies.yaml`, `resource-policies.yaml`, `service-catalog.yaml`, `concepts-index.yaml`, domain architecture, swarm matrices |
| `governance/` | `CONSTITUTION.md`, `PRIME_DIRECTIVE.md`, `directives/` (10 numbered directives), `enforcement/` (law enforcers, anti-shortcut) |
| `docs/` | `adr/` (0000–0030), `REBUILD_PLAN_V2.md`, `STEPWISE_BUILD_SPEC.md`, `BUILD_NARRATIVE.md`, `ENV_SEPARATION.md`, `compendium/`, `blueprints/`, `patents/` |
| `.agents/` | Agent-facing skills, workflows, personas, context — auto-mirrored to `.claude/commands` and `.claude/skills` (see below) |
| `tests/` | Root Jest suites (pipeline, bees, buddy system, vector memory, circuit breakers, …) |
| `extensions/` | `chrome-extension/`, `vscode-extension/` |
| `integrations/` | `max-for-live/` (Ableton) |
| `infra/`, `infrastructure/` | Terraform (`main.tf`, `variables.tf`; `infrastructure/terraform/`) |
| `scripts/` | Operational scripts: deploy, branch-sync, battle, autonomous orchestrators, maintenance |
| `heady-registry.json` | HeadyRegistry — central component/workflow/doc catalog |
| `facts.yaml`, `lexicon.yaml` | Canonical facts and terminology (injected into docs via `heady:inject` markers) |

## Development Workflow

```bash
pnpm install                 # workspace install (pnpm 9.15.9 pinned)

# Run
pnpm start                   # node heady-manager.js
pnpm dev                     # nodemon heady-manager.js
pnpm start:mcp               # manager in MCP mode

# Build / test / lint
pnpm build                   # turbo run build
pnpm test                    # turbo run test (root suites are Jest)
pnpm lint                    # eslint . --fix (flat config: eslint.config.mjs)
pnpm turbo run build test --filter='...[origin/main...HEAD]'   # CI-style affected-only

# Pipeline & consistency
pnpm pipeline                            # run HCFullPipeline (src/hc_pipeline)
pnpm run consistency:verify              # data-consistency gate (exit 1 on drift)
node tooling/embed-corpus/src/embed.mjs --dry-run   # gate-then-embed corpus workflow
node tooling/skill-registry/sync-workflows.mjs --check  # verify .agents ↔ .claude sync

# Branding
pnpm run brand:check         # verify HEADY_BRAND headers
pnpm run brand:fix
```

**Self-extension:** workflows in `.agents/workflows/*.md` and skills in
`.agents/skills/*/SKILL.md` are auto-mirrored to `.claude/` by the
`SessionStart`/`PostToolUse` hook `.claude/hooks/sync-commands.mjs` — author the
source file only; never hand-create the `/heady-*` command. CI's
`governance-gate workflow-sync` check fails if the surfaces drift.

## Key Conventions (summary — `AGENTS.md` is authoritative)

1. **ESM only** — `import`/`export`, never `require()` in new code.
2. **No `console.log`** — pino structured logger with `X-Heady-Trace-Id`.
3. **Zero `TODO`/`FIXME`/`HACK`, zero placeholder code** — if it's not done, don't commit it.
4. **Zero `localhost` / hardcoded URLs** — all endpoints from env vars; cloud-deployed only.
5. **Zod validation** on every API input crossing a service boundary.
6. **`HEADY_BRAND` header** required in all new files (template in `AGENTS.md`).
7. **No magic numbers** — timeouts, TTLs, pool sizes derive from φ-constants
   (`packages/phi-math`, `phiBackoff()`, `FIB[n]`).
8. **Latent Service pattern** — every service exports `{ start, stop, health, metrics }`.
9. **Redis keys** namespaced `tenant:{id}:*`.
10. **Patent lock zones** — files marked `⚠️ PATENT LOCK` (HS-2026-051 … HS-2026-062)
    require ARBITER review before modification.
11. **Mandatory MCP invocations** — `heady_autocontext_enrich` on context mutation,
    `heady_governance_enforce` before PR/deploy, `heady_project_tree` + `heady_env_audit`
    on startup (full list in `AGENTS.md` § Systemic Services).
12. **No Vue/Angular**; tests alongside code; no empty catch blocks or swallowed promises.
13. **Naming standards** — user-facing URLs use canonical domains (e.g.
    `headysystems.com` subdomains); never emit drive letters, raw provider domains,
    or private IPs.

## Key Configs & Docs

| File | Why it matters |
|---|---|
| `AGENTS.md` | Hard rules, stack table, deploy commands — authoritative |
| `CLAUDE_MEMORY.md` | Live handoff state, completed work, immediate next steps |
| `SOURCE_OF_TRUTH.md` | Canonical repo/branch/authority declaration (ADR-0001) |
| `docs/DUAL_ACTIVE_BRANCH_STRATEGY.md` | Active main/rebuild dual-branch policy |
| `docs/BRANCH-PARITY.md`, `PARITY_LOG.md` | What has/hasn't been ported between branches |
| `docs/adr/` | ADRs 0000–0030 — check before architectural decisions |
| `docs/REBUILD_PLAN_V2.md`, `docs/STEPWISE_BUILD_SPEC.md`, `docs/BUILD_NARRATIVE.md` | Canonical planning documents |
| `governance/CONSTITUTION.md`, `governance/directives/` | System laws enforced by `tooling/law-lint` and CI gates |
| `configs/governance-policies.yaml`, `configs/resource-policies.yaml`, `configs/service-catalog.yaml` | Policy source of truth |
| `heady-registry.json` | Central component registry |
| `turbo.json`, `pnpm-workspace.yaml`, `eslint.config.mjs`, `jest.config.js` | Build/test/lint wiring |
| `Dockerfile`, `infra/main.tf`, `renovate.json` | Deploy + dependency infrastructure |

## Environment Variables

Secrets come from **GCP Secret Manager via keyless OIDC (ADR-0008)** or a local `.env`
(never committed; `Dockerfile` deliberately excludes it). Full template: `.env.example`.
Key variables actually referenced by code/config:

- **Core:** `PORT` / `HEADY_PORT` (manager, default 3301; Cloud Run uses 8080),
  `NODE_ENV`, `HEADY_API_KEY`, `ADMIN_TOKEN`, `INTERNAL_NODE_SECRET` (inter-service
  auth), `VAULT_PASSPHRASE` (API-key encryption)
- **Data:** `DATABASE_URL` (Neon Postgres), `NEON_API_KEY`, `NEON_PROJECT_ID`,
  `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- **AI providers:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` /
  `GOOGLE_API_KEY`, `GROQ_API_KEY`, `PERPLEXITY_API_KEY`, `HF_TOKEN`
- **Edge/deploy:** `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (also gates the
  locked Workers AI embedder), `GITHUB_TOKEN`
- **Observability:** `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`
- **Auth/billing:** `FIREBASE_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLIC_KEY`

---

*∞ Sacred Geometry · Liquid Intelligence · Permanent Life ∞*
*© 2026 HeadySystems Inc. — Eric Haywood, Founder*
