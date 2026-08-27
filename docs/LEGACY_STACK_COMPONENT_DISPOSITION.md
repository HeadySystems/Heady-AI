<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ Legacy Stack → Rebuild Component Disposition              ║
║  Made with ❤️ by HeadySystems Inc.                                ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# Legacy Stack → Rebuild: Component Disposition & Approval

> **Status:** For founder approval · **Date:** 2026-06-16 · **Owner:** Eric Anthony Haywood
> **Source:** legacy stack at `/home/headyme/Heady` (372 top-level entries) · **Target:** rebuild at `/home/headyme/Heady-AI`
> **Method:** 8 parallel layer audits, each grounded in the locked rebuild decisions (`SOURCE_OF_TRUTH.md`, `REBUILD_PLAN_V2.md`, ADRs 0000–0024).

This document inventories **every component in every layer** of the current Heady build and gives each a **how / what / when / where / why-or-why-not** with a recommended disposition, so you can approve — component-by-component — what goes into the rebuild.

## How to use this document

**Disposition legend (my recommendation):**

| Mark | Meaning |
|---|---|
| ✅ **Integrate** | Port largely as-is; already conforms to the locked stack. |
| 🔧 **Adapt** | Concept/logic is valuable but must be rewritten to conform (ESM, framework, store, gateway, etc.). |
| ⏸ **Defer** | Valuable but post-launch / Phase-4+ / gated on evidence. |
| ❌ **Drop** | Dead, duplicate, superseded, or violates a locked decision. |

**To approve:** in each table's **`✔`** column, replace `☐` with **`A`** (approve my recommendation) or write your override (`→✅`, `→🔧`, `→⏸`, `→❌`). The **Approval ledger** at the end is for layer-level sign-off.

**Authority for every disposition:** `SOURCE_OF_TRUTH.md` + locked decisions — ONE Turborepo+pnpm modular monolith; Neon Postgres SoR; **pgvector = sole retrieval authority**, Vectorize = derived edge cache (384-dim, `bge-small-en-v1.5`), **Qdrant dropped**; Cloud Run (Node22) + Cloudflare edge (Workers/Pages/DO/Workflows); **CF AI Gateway = single model egress**; Vercel AI SDK v6 harness (Claude Agent SDK only as an MCP tool); NATS event bus; SSE+HTTP/2; Firebase Auth; GCP Secret Manager via keyless OIDC; Renovate primary; φ-constants; generated-not-authored projections; pre-launch **greenfield** (free to drop unused).

---

## Executive summary

- **Scale.** ~372 top-level entries collapse to ~100 meaningful components; the rest is duplication, build output, status-report sprawl, and dead scaffolds. The locked rebuild **is** the consolidation of this sprawl — most "rebuild/monorepo/complete" snapshots are superseded by `Heady-AI` itself.
- **Where the real value is (integrate/adapt):** the φ-math + CSL engine, the bee/swarm runtime, the canonical `heady_*` pgvector schema, the Cloudflare Workers fleet, the security module set, the mature observability layer, `facts.yaml`, the patent-implementations IP, and the MCP-server family that feeds the `headyme-portal` spearhead.
- **What dominates the drop pile:** triplicated docs/skills/ADRs, 14 docker-compose files, off-platform CI (Azure/Render/PM2), self-hosted Postgres/pgbouncer/nginx, hollow Perplexity-generated scaffolds, and ~18 empty `apps/*` stubs.
- **Disposition rollup (approximate, by component rows below):** ✅ ~20 · 🔧 ~45 · ⏸ ~25 · ❌ ~40.
- **Read the Critical Risks section first** — several items (a committed live API key, a fail-open auth path) are action-now regardless of any integrate decision.

---

## 🔴 Critical cross-cutting risks & action items

These are independent of the integrate/drop choices — they need action before or during migration.

| # | Severity | Finding | Location | Action |
|---|---|---|---|---|
| R-1 | 🔴 Critical | **Live Google/Firebase API key committed** (`‹live-key-redacted›`) + real GCP project + CF account id | `perplexity-build/.env.template` | **Rotate the key now**; scrub before any import. Feeds SEC-001. |
| R-2 | 🔴 Critical | **Fail-open auth** — mock mode mints/accepts ANY session cookie as `dev-user`, no `NODE_ENV==='production'` hard-stop | `auth-session-server/src/index.js:113,156-157` | Drop component; ensure rebuild auth fails **closed** (SEC-002). |
| R-3 | 🔴 High | **AI-Gateway bypass is universal** — every model call (Gemini/Claude/GPT-4o/Groq) hits providers directly; zero `gateway.ai.cloudflare` usage | `mcp-servers/liquid-nodes`, `colab/*`, `python/*` | Route ALL egress through CF AI Gateway on port. |
| R-4 | 🟠 High | **Embedding-dim drift** — `db/` lineage uses `vector(1536)`, violating the 384 lock | `db/001_*`, `db/002_*` | Quarantine `db/` SQL; only the `heady_*` 384-dim lineage may seed Neon. |
| R-5 | 🟠 High | **Neon may already hold live schema** — `001_initial_schema.sql` marked "Applied 2026-03-07" | `migrations/_superseded/README` | **Verify actual Neon state** before assuming greenfield DB. |
| R-6 | 🟠 Med | **Canary rollback fragile (INFRA-001)** — captures `traffic[0].revisionName`, not guaranteed 100%-serving revision | `.github/workflows/deploy-cloud-run.yml:52-58` | Select highest-traffic/`=100` revision explicitly. Re-point INFRA-001 here. |
| R-7 | 🟠 Med | **CORS / rate-limit fail-open** — localhost origins allowed when `NODE_ENV!=='production'`; `skipOnError=true` | `security-middleware/cors-policy.js:197,351`, `rate-limiter-advanced.js:506` | Fix to fail-closed on port. |
| R-8 | 🟢 IP | **Patent IP single source** — only full-source copy of 8 provisionals (HS-051–062, 59 claims, 806 tests) | `heady-patent-implementations/` | Preserve; port under ARBITER patent-lock review, never bulk-delete. |
| R-9 | 🟢 Hygiene | **Unresolved git merge-conflict markers** (break install) | `frontend/package.json`, `HeadyAI-IDE/package.json`+lock, `apps/desktop/package.json`, `oracle_service/requirements.txt` | Resolve before porting those components. |
| R-10 | 🟢 Hygiene | **Zero-localhost violations** | `heady-agents/agent-config.json` (`:3310`), `12-heady-registry-context7-patch.json` (`:3371`), `launchers/` (Windows paths), `extensions/chrome/` (old dupe) | Scrub on port; env-var all URLs. |

---

## Layer 1 — Frontend / UI / Sites / Desktop / CMS

The frontend layer is a heavily-duplicated mix of a React+Vite admin/IDE family, three overlapping static-site representations of ~16 domains, three competing desktop stacks, and a Drupal triad. Almost nothing matches the locked **Vanilla Web Components** model (React is allowed only for complex canvas) — so most Vite/React apps are **Adapt** (right build tool, wrong component model), the static-site sprawl collapses to one Adapt + mass Drop, and Vue/Module-Federation/Drupal are Drop.

| ID | Component | What | How (tech) | When/Where | Disp | Why / Why-not → target | ✔ |
|---|---|---|---|---|---|---|---|
| FE-01 | `frontend/` | Admin/IDE SPA (Monaco, xterm, MCPDashboard) | React 18 + Vite + Tailwind | Primary admin shell | 🔧 Adapt | MCPDashboard is the **MCP-console seed**; React-everywhere violates Vanilla-WC; has merge conflict → `headyme-portal` | ☐ |
| FE-02 | `public/mcp-dashboard.html`, `apps/heady-mcp-portal`, `admin-ui/` | MCP admin-console candidates | Static HTML / Next stub / Express+static | Scattered MCP UI seeds | 🔧 Adapt | The locked **spearhead**; consolidate to one; `admin-ui/server.js` calls providers directly (gateway bypass) → `headyme-portal` | ☐ |
| FE-03 | `ui/` (command-center + panels) | Ops dashboard, swarm/topology/vector panels | React + Express | Ops monitoring | 🔧 Adapt | Valuable; rewrite to Vanilla-WC + SSE → console widgets | ☐ |
| FE-04 | `HeadyAI-IDE/` | Electron + web AI IDE | React+Vite+Electron | Standalone IDE | ⏸ Defer | Heavy, Phase-4+; Electron not in stack; merge conflicts → deferred IDE | ☐ |
| FE-05 | `heady-ide/`, `heady-ide-ui/dist/` | Vue fragments / built widgets | Vue SFC / Vite output | Near-empty / artifact | ❌ Drop | Vue banned; committed build output → regen | ☐ |
| FE-06 | `apps/headyweb`, `heady-microfrontend-portal` | Micro-frontend shell, 7 remotes | Webpack Module Federation + Three.js | Universal shell concept | ❌ Drop | Module Federation off the Vite/monolith direction (3D→React canvas only) | ☐ |
| FE-07 | `apps/desktop`, `desktop-overlay/` | Tauri + Electron desktop shells | Tauri v2 / Electron 41 | Desktop/overlay | ⏸ Defer | Two competing desktop stacks; gate on evidence → deferred desktop | ☐ |
| FE-08 | `electron-test/`, `electron-*.js`, `headybrowser-desktop/` | Electron probes / no-code dir | snippets / design stubs | Throwaway | ❌ Drop | Dead scaffolding, no real source | ☐ |
| FE-09 | `websites/` | Eleventy SSG for ~13 domains | 11ty (njk/md) | Marketing-site source | 🔧 Adapt | Best single SSG source candidate (contested — see risks) → CF Pages + WC | ☐ |
| FE-10 | `sites/`, `_site/`, `apps/sites`, `pages/`, `public/*.html` | Duplicate static site outputs (~16 domains, 50+ HTML) | Static HTML; `_site` marked DEPRECATED | Build artifacts/dupes | ❌ Drop | Overlapping representations of same sites → regen from one source | ☐ |
| FE-11 | `content/` | CMS copy for 30+ domains | JSON + MD/YAML | Marketing content | ✅ Integrate | Framework-agnostic, directly reusable → content store | ☐ |
| FE-12 | `assets/` (brand, og, media) | Brand + media + OG images | Static (Git-LFS pointers) | Branding | ✅ Integrate | Portable; LFS pull needed → asset store | ☐ |
| FE-13 | `css/`, `designs/` | Shared stylesheet + 1 design note | CSS / MD | Docs-hub styling | 🔧 Adapt | Fold tokens into WC design system | ☐ |
| FE-14 | `accessibility/`, `i18n/` | A11y + localization tooling | Vanilla JS | Build/runtime | ⏸ Defer | Vanilla, conforms; not Phase-1 → a11y/i18n utils | ☐ |
| FE-15 | `web/` (openapi-gen, seo-engine) | OpenAPI + SEO generators | Node.js | Build tooling | 🔧 Adapt | Backend tooling mis-filed; reusable → build tooling | ☐ |
| FE-16 | `extensions/` (chrome v3.2.3, vscode v1.1.0) | Browser + IDE extensions | MV3 / VS Code API | HeadyBuddy companion | ⏸ Defer | Real & active; dead `chrome/`+`vscode/` dupes drop → deferred extensions | ☐ |
| FE-17 | `drupal/`, `drupal-config/`, `14-drupal-config/` | Headless CMS, 13 content-types | Drupal 11 + Docker | CMS attempt | ❌ Drop | Off Node22/CF/Firebase stack; **salvage the 13 content-type schemas** as content model | ☐ |
| FE-18 | `apps/*` stubs (~18), `gift-packs/`, `heady-digital-presence` (UI) | Near-empty app dirs / demo bundles / spec stub | static-HTML / Next stubs | Placeholders | ❌ Drop | Stubs duplicate marketing content; demo cruft → regen | ☐ |

**Layer risks:** merge conflicts in 4 manifests (FE-01/04/07); **contradictory "canonical site source"** — `websites/` vs `apps/sites` vs `public/` vs deprecated `_site/` (you must pick ONE); three desktop stacks; `admin-ui/server.js` AI-Gateway bypass; reusable Drupal content-type schemas survive even though the stack drops.

---

## Layer 2 — Backend / Core runtime / Services / Auth / Middleware

A CJS-dominant monolith-plus-sprawl: a 136KB `heady-manager.js` god-server, a partially-complete **ESM microkernel rewrite** (`core/heady-manager-kernel.js`) that already implements `cslGate`+`phiBackoff`, and a `services/` dir of ~220 claimed services where **only 4 conform** to the Latent Service Pattern. Real load-bearing code lives in `src/`, `core/`, `shared/`, `shared-ts/`, `circuit-breaker/`, `orchestration/`, `auth/`. Module systems are mixed CJS/ESM — colliding with the Node22-ESM-only lock, so nearly everything is at least **Adapt**.

| ID | Component | What | How (tech) | When/Where | Disp | Why / Why-not → target | ✔ |
|---|---|---|---|---|---|---|---|
| BE-01 | `heady-manager.js` | 136KB god-server: MCP+API+health | CJS Express | Legacy main runtime | 🔧 Adapt | Named legacy core to migrate then **archive**; CJS monolith → split into Cloud Run app pkg | ☐ |
| BE-02 | `core/heady-manager-kernel.js` | Modular microkernel (cslGate/phiBackoff) | ESM | Live core | 🔧 Adapt | Closest to target; already ESM+CSL+φ → core runtime pkg | ☐ |
| BE-03 | `heady-main.js`, `index.js` | Unified boot / export barrel | CJS / ESM | Entrypoints | 🔧 Adapt | Boot+barrel logic useful → monorepo bootstrap + index barrels | ☐ |
| BE-04 | `shared/csl-engine-v2.js` | Canonical CSL (cosine gates) | ESM | Imported everywhere | 🔧 Adapt | The CSL differentiator (live dep) → `@heady/csl` (`cslGate`) | ☐ |
| BE-05 | `csl-engine.js` (root) | Superseded CSL copy | ESM | archives/benchmarks only | ❌ Drop | **Broken import** `../../shared/`; dead → use BE-04 | ☐ |
| BE-06 | `core/`, `src/` | Pipeline, conductor, scheduler, bees, swarms, MCP, vector mem | CJS | Core infra (primary impl) | 🔧 Adapt | Real substantial code; CJS sprawl → decompose into monorepo pkgs | ☐ |
| BE-07 | `shared/` | Utils: auth-mgr, bee-factory, CSL, encryption, CORS×3 | CJS (+Python) | Shared lib | 🔧 Adapt | Real but **duplicates `src/`** → merge into `@heady/shared` | ☐ |
| BE-08 | `shared-ts/` | TS φ-math, logger, health, errors, config | ESM TS | Clean lib | ✅ Integrate | Already ESM TS, clean barrel — only true port-as-is → `@heady/shared` | ☐ |
| BE-09 | `backend/` (+ `python_worker`) | MCP stdio wrapper / job worker | ESM / Python | MCP entry / jobs | 🔧 Adapt | Wrapper only, nested dup; worker localhost-coupled → CF/Cloud Run MCP entry + queue consumer | ☐ |
| BE-10 | `circuit-breaker/` | Per-provider breakers + middleware | CJS, YAML | Resilience | 🔧 Adapt | **Genuine φ-backoff** matches lock; CJS → φ-backoff breaker pkg | ☐ |
| BE-11 | `orchestration/` | HCFP runner, arena, socratic, custom LangGraph | Mixed CJS/ESM | Pipeline orchestration | 🔧 Adapt | Custom engine; **no Temporal** → reimplement on CF Workflows+Queues+DO | ☐ |
| BE-12 | `auth/` | Firebase identity + cross-domain SSO, 27 providers | ESM, firebase-admin | Central auth | 🔧 Adapt | Aligns with Firebase lock; `__Host-` cookies, CSRF → Firebase Auth + SSO pkg | ☐ |
| BE-13 | `auth-service/` | Standalone HS256 JWT IdP (headykey.com) | CJS Express4 | Zero-trust IdP | 🔧 Adapt | Most complete & fail-**closed**, but **custom JWT conflicts with Firebase lock** → fold RBAC/API-keys into Firebase | ☐ |
| BE-14 | `auth-session-server/` | Firebase session-cookie issuer | CJS Express5 | Session cookies | ❌ Drop | Near-dup of `auth/`; **CRITICAL fail-open** (R-2) → `auth/` covers it | ☐ |
| BE-15 | `security-middleware/` | CORS, rate-limit, req-id, sanitizer, headers | CJS lib | HTTP hardening | 🔧 Adapt | Useful; **localhost-CORS + skipOnError fail-open** (R-7) → Hono/Express middleware pkg | ☐ |
| BE-16 | `middleware/` | Bulkhead, compression, graceful-shutdown | Mixed (CJS requires ESM) | Ops resilience | 🔧 Adapt | Real but **broken module mix** → resilience middleware pkg | ☐ |
| BE-17 | `adapters/` | Template registries, projection-manifest gen | CJS | Bee/swarm templates | 🔧 Adapt | Real; expects peer `registry/` → template/projection pkg | ☐ |
| BE-18 | `oracle_service/` | Crypto truth/sensor verification (MQTT→InfluxDB) | Python FastAPI | Sensor oracle | ⏸ Defer | Niche IoT; **requirements.txt merge conflict** → Phase-4+ if needed | ☐ |
| BE-19 | `heady-native-services/` | 7 self-hosted AI services behind gateway | CJS Node22 | Provider replacement | ⏸ Defer | Partial stub; conflicts with AI-Gateway chokepoint → Phase-4+ | ☐ |
| BE-20 | SKILL.md stub dirs (`heady-cloud-orchestrator`, `-resilience-cache`, `-sandbox-execution`, `-middleware-armor`, `heady-manager/`) | Doc stubs, no code | Markdown | — | ❌ Drop | No code; impls live in `src/` → specs map to respective pkgs | ☐ |
| BE-21 | `heady-voice-relay/` | Voice relay spec | Markdown | — | ⏸ Defer | Later-phase voice → Phase-4+ | ☐ |
| BE-22 | `services/` — ~4 conformant + ~15 real | Services with `{start,stop,health,metrics}` (heady-bus, circuit-breaker, sandbox) | Mixed CJS/ESM | Microservices | 🔧 Adapt | Salvage the conformant few → Latent-pattern service pkgs | ☐ |
| BE-23 | `services/` — ~290 sprawl/dupes/dead | snake/kebab dupes, `.js`-shadows-dir ×9, stubs | — | — | ❌ Drop | Only 4/220 conform; massive dup → rebuild needed ones on demand | ☐ |

**Layer risks:** the `heady-manager` monolith→kernel migration is the single biggest effort; CSL exists 3+ places (canonical = BE-04); locked-decision conflicts to confirm — custom JWT vs Firebase (BE-13), custom LangGraph vs CF Workflows (BE-11), self-hosted AI vs AI Gateway (BE-19), `new Function()` sandbox vs CF Sandboxes (BE-20).

---

## Layer 3 — Agents / Bees / Swarms / Cognition / Personas

Overwhelmingly **prompt-engineering and design IP, not runtime**. The only real runnable code is the φ-math swarm engine (`agents/*`, `maximum-potential/liquid-nodes`, `heady-10-10`, `directives/source`), the `heady-hive-sdk`, and the HeadyBuddy assistant (web + Android). Everything else is markdown and **massively duplicated 5×**, with `heady-cognition/` the canonical superset. The topology here = **Taxonomy B**, already reconciled in `docs/compendium/02`.

| ID | Component | What | How (tech) | When/Where | Disp | Why / Why-not → target | ✔ |
|---|---|---|---|---|---|---|---|
| AG-01 | `agents/` (bee-factory, hive-coordinator, federation-manager) | φ-math swarm engine: spawn→dispatch→consensus→fuse | Node ESM, CSL gates | Core swarm runtime | 🔧 Adapt | Best code in layer; CSL+φ is the IP; CJS barrel broken → `packages/bees` + NATS orchestrator | ☐ |
| AG-02 | `agents/headybee-swarm.js` | Swarm v3, 6 fixed nodes (CODEMAP/JULES/…) | Node ESM, Redis/Pinecone | Alt/older impl | 🔧 Adapt | Salvage routing; drop Pinecone/Redis (→pgvector/NATS); a **4th taxonomy** — don't propagate | ☐ |
| AG-03 | `maximum-potential/liquid-nodes/` | `BaseHeadyBee` lifecycle + breaker | Node ESM | Canonical bee interface | ✅ Integrate | Defines the lifecycle compendium standardizes on; some broken imports → `packages/bees` BaseBee | ☐ |
| AG-04 | `maximum-potential/phi-constants.cjs` | Canonical φ/Fibonacci constants | Node CJS | φ-math foundation | ✅ Integrate | The differentiator constants → `packages/phi-math` | ☐ |
| AG-05 | `heady-10-10/` + `directives/source/auto-success-engine.ts` | LAW-07 auto-success engine (135-task cycle) | CJS + TS twin | Governance/orchestration | 🔧 Adapt | Real; two impls (dup) — keep the TS/ESM one → orchestrator loop | ☐ |
| AG-06 | `heady-hive-sdk/` | `HeadyGateway` client, 14 domain proxies | Node CJS SDK | Platform client | 🔧 Adapt | Clean API surface; rebuild routes via AI Gateway+NATS not REST → typed client / drop | ☐ |
| AG-07 | `heady-cognition/` + `heady-cognitive-config.json` | Canonical superset: archetypes/personas/directives/laws/topology + φ thresholds | Markdown + JSON | Cognitive architecture | ✅ Integrate | Single source of truth for design IP; config directly portable → `docs/compendium/02` + CSL config | ☐ |
| AG-08 | `archetypes/`, `animal-archetypes/`, `13-animal-archetypes/` | Animal cognitive-function defs | Markdown | Reasoning layers | 🔧 Adapt | `archetypes/` superset; other two **byte-identical dupes** → persona/archetype prompts | ☐ |
| AG-09 | `personas/` | 10 persona files + master prompt | Markdown | Multi-persona system | 🔧 Adapt | Richer than layer files; dup of cognition copy → harness persona library | ☐ |
| AG-10 | `directives/`, `prompts/` | Constitutional trio + DIR/LAW files | Markdown | System governance | 🔧 Adapt | Partial dupes with **version drift** (`prompts/` newer) — reconcile → AGENTS.md/system rules | ☐ |
| AG-11 | `stage-prompts/` | 7 of 21 pipeline-stage prompts | Markdown | Pipeline stages | ⏸ Defer | Incomplete subset; maps loosely to stage0/1/2 → bootstrap prompts later | ☐ |
| AG-12 | `prompts/perplexity/`, `context/perplexity/` | One-shot deploy prompts | Markdown | One-time ops | ❌ Drop | Single-use legacy deploy scripts, obsolete | ☐ |
| AG-13 | `heady-agents/` | 4 Claude-Agent-SDK agents, 47 MCP tools | JSON + MD | Agent defs v5.0 | 🔧 Adapt | Reuse personas/prompts; built on **rejected harness SDK** + `localhost:3310` → AI SDK v6 agents | ☐ |
| AG-14 | `headybuddy/` | Web/desktop chat companion + 39KB system prompt | Vite/React/Electron | Web assistant | 🔧 Adapt | Real product; host inconsistency (`manager.` vs `api.`) → Buddy app in monorepo | ☐ |
| AG-15 | `headybuddy-mobile/` | Native Android Buddy (~36 Kotlin files) | Kotlin/Compose | Android assistant | ⏸ Defer | Real & substantial; mobile is post-launch → mobile phase | ☐ |
| AG-16 | `heady-buddy/dist/`, `heady-buddy-device` | Build artifact / unbuilt spec | Vite bundle / MD | Output / aspirational | ❌ Drop / ⏸ Defer | Regenerable output (drop); computer-use bridge → CF Sandboxes later (defer) | ☐ |
| AG-17 | SKILL.md specs (`heady-bee-swarm-ops`, `-a2a-protocol`, `-cognitive-runtime`) | Bee registry / A2A / runtime governor specs | Markdown | Design refs | 🔧 Adapt | Specs not code; A2A→NATS, CSL ternary = 3-layer gate IP → designs feed impl | ☐ |

**Layer risks:** taxonomy is **4-way** (AG-02 adds a competing vocabulary); 5× markdown duplication (canonical = `heady-cognition/`); version drift between two "canonical" directive sets; reuse agent *personas* not the rejected Agent-SDK wiring; localhost in `heady-agents` config.

---

## Layer 4 — Data / Memory / Vector / Database / Projections

A tangle of **competing schema lineages** (namespaced `heady_*` ✅ canonical, flat `public`, singular `heady.`) plus a working-but-stubbed in-memory φ-vector engine. The `migrations/` dir was already triaged into one forward-only `heady_*` sequence — the only schema worth porting. Vector/embedding code is φ-rich but uses **fake deterministic embeddings**, a 7-provider router, and RAM-first HNSW — all conflicting with the single-provider/pgvector-authority lock.

| ID | Component | What | How (tech) | When/Where | Disp | Why / Why-not → target | ✔ |
|---|---|---|---|---|---|---|---|
| DA-01 | `migrations/0001–0009` | Canonical schema: tenants+RLS, `vector_memories`, audit, queues, swarm, pipeline | PG + pgvector **384**, HNSW, 3D octant, RLS | Source-of-truth lineage | 🔧 Adapt | Correct 384+HNSW; port to Neon; drop RLS if single-tenant → Neon SoR + pgvector authority | ☐ |
| DA-02 | `db/` (`schema.sql`, `001/002`, migrate.mjs) | Flat `public` v3.1 + **1536-dim** HNSW + multi-tenant | PG, `vector(1536)` | Older flat lineage | ❌ Drop | **1536 violates 384 lock** (R-4); superseded namespacing | ☐ |
| DA-03 | `postgres/init.sql` | Singular `heady.` schema + `projected_3d vector(3)` | PG | Oldest lineage | ❌ Drop | Superseded namespacing | ☐ |
| DA-04 | `migrations/_superseded/` | 11 quarantined migrations | mixed | Recovery archive | ⏸ Defer | **Port 2 features**: `projection_tables`, `graph_rag_schema`; rest dead → `0010+` | ☐ |
| DA-05 | `heady-db-infra/` | Cloud SQL setup, run-migrations, redis-pool (7 roles, φ-backoff) | bash + ioredis | Infra bootstrap | 🔧 Adapt | redis-pool reusable for T0; migrations half is **byte-identical dup** of DA-01 → T0 Redis/KV adapter | ☐ |
| DA-06 | `memory/vector-store.js` | RAM-first HNSW, φ-eviction, TTL, namespaces | ESM, Float32 | In-memory cache | 🔧 Adapt | φ-eviction/CSL-gate valuable; RAM HNSW ≠ authority → maps to Vectorize T2 (net-new) | ☐ |
| DA-07 | `memory/embedding-pipeline.js` | 7-provider embed router + breaker + LRU | ESM | Embed generation | ❌ Drop core / 🔧 keep breaker | **Fake hash embeddings + multi-provider** violate single-CF lock → single-provider CF embed | ☐ |
| DA-08 | `memory/projection-engine.js` | Latent→physical projection matrices | ESM, CSL-gated | Code/config projection | 🔧 Adapt | Learned-matrix ≠ manifest-authoritative content-addressed → projection generator | ☐ |
| DA-09 | `memory/memory-cache.js`, `index.js` | Tier cache + barrel | CJS/ESM | Module entry | ❌ Drop | **Broken barrel** (CJS require over ESM default) → rebuilt module | ☐ |
| DA-10 | `data/` (415 files) | Runtime dumps: null/zero embeddings, shards, wallets | JSON/JSONL | Legacy runtime state | ❌ Drop | Junk state, not authority → regenerated | ☐ |
| DA-11 | `heady-projection/` | Autonomous projection daemon app | TS, turbo, Docker | STAGING daemon | ⏸ Defer | Daemon-push model; reconcile with Merkle-trigger + WAL → projection service later | ☐ |
| DA-12 | `projections/`, `sacred-projections/` | Per-domain manifests + static shells | JSON / HTML | Domain shells | ❌ Drop | Placeholder SHAs, `echo 'static'`; wrong format (`.json` vs `projection.yaml`) → regenerate | ☐ |
| DA-13 | `heady-vector-projection`, `heady-drift-detection` (SKILL) | Vector-projection / drift skills | Markdown | Agent skills | ⏸/✅ | drift aligns with Merkle re-index (Integrate); vector-projection rewrite (Defer) | ☐ |
| DA-14 | `registry/`, `heady-registry.json` | Ecosystem catalog + health/scenario matrix | JSON + JS | Control catalog | 🔧 Adapt | Concept useful; v5.0.0 stale, regenerate → service registry table | ☐ |
| DA-15 | `12-heady-registry-context7-patch.json` | Registry patch adding Context7 | JSON | Registry mutation | ❌ Drop | **`localhost:3371`** (R-10); stale | ☐ |
| DA-16 | `sacred-geometry.js` | φ topology, node rings, Fibonacci allocation | CJS | Shared φ-math | ✅ Integrate | Core differentiator; verify deps → shared φ-constants module | ☐ |
| DA-17 | `memory-payload.json`, `memories/`, `prisma/`, `pgbouncer/`, `repos/`, `repo-type.yaml`, `laws/` | Handoff dumps / Prisma auth / pooler / repo catalog / governance | mixed | Misc | ❌ Drop / ⏸ | Neon has pooling (drop pgbouncer); `repo-type.yaml` `LOCAL_FIRST` conflicts cloud-first; prisma+laws → other layers | ☐ |

**Layer risks:** embedding-dim drift (R-4); **verify live Neon state** (R-5); migration duplication (DA-01 vs DA-05); 2 features stranded in `_superseded/`; Qdrant effectively absent here (clean); Vectorize T2 is **net-new** (closest analog = DA-06).

---

## Layer 5 — MCP servers / AI providers / Colab / Integrations / Python-ML

The AI brain. Canonical live surface = `mcp-servers/` (8 Node MCP servers + 8 tool services) plus a 4-runtime **Colab GPU fabric** wrapped by a TS `colab-gateway` (the intended inference-fallback tail). **No component routes through CF AI Gateway** (R-3), and `perplexity-build/` is a 50-service hollow scaffold that leaks a live key (R-1).

| ID | Component | What | How (tech) | When/Where | Disp | Why / Why-not → target | ✔ |
|---|---|---|---|---|---|---|---|
| MC-01 | `mcp-servers/heady-mcp-server.js` v6 | Canonical unified MCP entry (merges 7) | Node + MCP SDK (stdio) | Active prod | 🔧 Adapt | Real canonical; re-front on contracts → `packages/contracts` → MCP Console | ☐ |
| MC-02 | `mcp-servers/heady-unified-mcp-server.js` | Earlier merge attempt | Node | Superseded | ❌ Drop | Dead dup of v6 | ☐ |
| MC-03 | `mcp-servers/{governance,intelligence,memory,orchestration}` MCP | Cost/RBAC/audit, arena scoring, 3-tier memory, swarm DAG | Node | Active | 🔧 Adapt | Real logic; memory dup of pgvector authority → contracts + MCP tools | ☐ |
| MC-04 | `mcp-servers/liquid-nodes-mcp-server.js` | 6 connectors incl. **direct Gemini** | Node + https | Active | 🔧 Adapt | **Bypasses AI Gateway** (R-3) → reroute via CF AI Gateway | ☐ |
| MC-05 | `mcp-servers/render-mcp-server.js` | Render deploy mgmt | Node + MCP SDK | Active | ❌ Drop | Render not in stack → Cloud Run tooling | ☐ |
| MC-06 | `mcp-servers/services/*` + `tool-schemas.js` | 8 utility tool services, 45+ tools | Node | Active | 🔧 Adapt | Solid generic tools; regenerate via OpenAPI/Kubb → `mcp-tools.json` | ☐ |
| MC-07 | `heady-mcp-enhancement/` | Expansion pack (mesh, liquid nodes) | Node v5 | **Unwired** | ❌ Drop | Complete code never integrated; speculative | ☐ |
| MC-08 | `heady-mcp-security/` | Gateway: RBAC, scan, secret-rotation, sandbox, audit | Node, GCP SM | **Unwired** | 🔧 Adapt | Strong patterns; harvest into edge gateway → CF Worker gateway / security-bee | ☐ |
| MC-09 | `colab/` runtimes 1–3 + nodes | 4-runtime GPU fabric; embeddings + LLM router | Python asyncio, pgvector | Active | 🔧 Adapt | Real fallback tail; **Nomic-384 not bge-small**; providers direct → inference fallback (swap embed) | ☐ |
| MC-10 | `colab-gateway/` (TS) | Prod HTTP wrapper over runtimes | Node22 TS, Docker | Active canonical | ✅ Integrate | Newest, typed, the real gateway → Colab inference adapter | ☐ |
| MC-11 | `colab-integration/` | Older JS gateway + py bridge | JS + Python | JS dead / py active | ❌ Drop JS / 🔧 py | JS superseded by MC-10; keep runtime-bridge.py → fold into colab-gateway | ☐ |
| MC-12 | `python/` core + `services/mcp_bridge.py` | Python SDK: vector ops, CSL, geometry; FastAPI MCP | Python FastAPI | Active | ⏸ Defer | ML-justified but **prefer no Python servers**; salvage libs → notebooks/ML; logic→TS/Workers | ☐ |
| MC-13 | `notebooks/`, `python/notebooks/` | Tutorials/examples | Jupyter | Reference | ⏸ Defer | Keep as ML reference → docs/notebooks | ☐ |
| MC-14 | `perplexity-build/` (50 services) | Perplexity-generated scaffold; identical Express stubs | Node, compose | **Zero logic** | ❌ Drop | Hollow stubs, shadow-dup real servers, **leaks live key** (R-1); salvage only φ/CSL/OTel patterns | ☐ |
| MC-15 | `huggingface/` | Org metadata: 3 models (incl `heady-embeddings-384d`), 3 datasets | Markdown | Metadata only | ✅ Integrate | HF Space target + dataset refs → HF Space/datasets | ☐ |
| MC-16 | `heady-hf-space`, `-connection`, `-systems` | Empty (0 files) | — | Empty | ❌ Drop | Nothing there | ☐ |
| MC-17 | `heady-academic-research/`, `research/` | Real CSL/vector/MCP/patent research | Markdown | Reference | ✅ Integrate | Substantive → docs/ + embed into vector memory | ☐ |
| MC-18 | `HeadyAcademy/`, `training/` | Training/supervisor routing + curriculum | Node / MD-HTML | Reference | ⏸ Defer | Agent-pattern reference; not core path → docs | ☐ |
| MC-19 | `midi_bridge/`, `heady-midi-creative`, `integrations/max-for-live` | MIDI↔Docker FastAPI bridge + Ableton device | Python FastAPI; Max JS | Active (niche) | ⏸ Defer | Off critical path; revisit if music is strategic → optional edge worker | ☐ |
| MC-20 | `heady-connector-vault` (SKILL), `proto/` | Secret/connector synthesis spec; uncompiled gRPC | Markdown / Protobuf | Metadata/schema | 🔧 Adapt | concept→keyless OIDC+GCP SM; proto→OpenAPI/Kubb (not raw proto) | ☐ |
| MC-21 | `tool_calls/` | Cached AI tool-call logs | JSON/MD | Ephemeral | ❌ Drop | Scratch output, no logic | ☐ |

**Layer risks:** R-1 (live key) and R-3 (gateway bypass) both originate here; embedding model mismatch (Nomic-384 vs locked bge-small-384 — dim matches, model doesn't); avoid carrying Python servers forward; collapse the unwired/hollow dups (MC-02/07/14).

---

## Layer 6 — Infra / Deploy / CI-CD / Edge / Observability / Security

Multi-target sprawl: production split across **GCP Cloud Run (canonical)** plus dead Azure/Render configs, CI on GitHub Actions+pnpm. Container story = 14 compose files + 5 Dockerfiles standing up self-hosted Postgres/Redis/NATS/Consul/Envoy/Nginx/Ollama; edge tier is a real Cloudflare Workers fleet. Security/observability are surprisingly **mature** (OTel+Prometheus, fail-closed RBAC/CORS/CSP, OPA facts, credential-rotation) — but directory rot and triplicated canary logic abound.

| ID | Component | What | How (tech) | When/Where | Disp | Why / Why-not → target | ✔ |
|---|---|---|---|---|---|---|---|
| IN-01 | `.github/workflows/ci.yml` | CI: lint/test/audit/build/push | GHA, pnpm, Node22, OIDC | On push/PR | ✅ Integrate | Matches locked GHA+pnpm+OIDC, no SA keys → GHA+Turborepo | ☐ |
| IN-02 | `deploy-cloud-run.yml` + per-service deploys | φ-canary 5/25/50/100 + rollback | GHA, gcloud, wrangler | On CI success | 🔧 Adapt | **INFRA-001** rollback fragile (R-6); consolidate per-service → GHA φ-canary | ☐ |
| IN-03 | `cloudbuild.yaml` (+ `deployment/`, `heady-build/`, `ci/`, `heady-deploy/`) | Cloud Build pipelines + canary-config | Cloud Build, TruffleHog | Alt CI path | 🔧 Adapt | Canary **triplicated**; GHA is chosen CI → salvage canary-config, drop redundancy | ☐ |
| IN-04 | `azure-pipelines.yml`, `render.yaml`+`render.yml`, `ecosystem.config.*` | Azure / Render / PM2 | off-platform / PM2 | Dead-parallel | ❌ Drop | Off GCP-Cloud-Run/CF-only; monolith needs no PM2 | ☐ |
| IN-05 | `Makefile`, `CODEOWNERS`, `renovate.json`, `commitlint.config.js`, `branch-protection/`, `gitleaks.yml` | Build targets, review routing, dep automation, rulesets, secret scan | Make/GitHub/Renovate/commitlint | Governance | ✅ Integrate | All match locked governance (Renovate primary, signed commits, fail-closed) | ☐ |
| IN-06 | `ci-pipelines/`, `enforcement/`, `policy/` | Security pipelines, no-placeholder protocol, OPA facts.rego | YAML/Semgrep/Rego | CI policy | 🔧 Adapt | Fold into GHA security stage; expand OPA to route/deploy policy → CI gate + OPA/Rego | ☐ |
| IN-07 | **docker-compose family (14)** | Local/full stacks | Compose | Local/dev | 🔧 Adapt | Collapse to ONE dev compose (`unified`+`production`+`full`); drop 11 specialized/dead | ☐ |
| IN-08 | **Dockerfile family (5)** | distroless/monorepo/production/service/universal | Multi-stage, distroless | Build | 🔧 Adapt | Keep `distroless`(N22)+`production`; drop service/universal/monorepo (N25 drift) → distroless Node22 | ☐ |
| IN-09 | `infra/` | Terraform, k8s, helm, consul/nats/envoy/otel/pgbouncer | HCL/YAML | IaC | 🔧 Adapt | Salvage Terraform+OTel; drop k8s/helm (Cloud Run+CF) → Terraform (GCP+CF) | ☐ |
| IN-10 | `infrastructure/`, `heady-infra-hardening/`, `02-infrastructure-hardening/` | Secondary infra dup + hardening docs | YAML/MD | Redundant/reference | ❌/⏸ | `infrastructure/` dups `infra/` (drop); hardening docs (defer) → consolidate to `infra/` | ☐ |
| IN-11 | `nats/`, `consul/`, `envoy/`, `nginx/` | Event bus / discovery / mTLS proxy / reverse proxy | conf files | Networking | 🔧/❌ | **NATS** is locked bus (keep, eval host); consul/envoy evaluate vs CF/Cloud Run native; nginx Drop | ☐ |
| IN-12 | `scale/`, `scaling/` | Design patterns / runtime libs (cloud-run-optimizer, nats bus) | docs / JS | Reference/imported | ⏸/🔧 | patterns→docs (defer); salvage cloud-run-optimizer+NATS bus, drop pgbouncer-pool (Neon) | ☐ |
| IN-13 | `cloudflare/` + `cloudflare-workers/` | Worker fleet: router, edge-node, mcp-telemetry, ai-gateway | Wrangler, DO, KV, D1, Vectorize, R2 | Edge (active) | ✅ Integrate | Matches CF edge lock; nested `cloudflare/cloudflare/` dup + legacy middleware drop → CF Workers/Pages/DO | ☐ |
| IN-14 | `workers/` | Core workers: liquid-gateway, edge-auth, buddy, mcp, secret-service | Wrangler TS, DO, Queues | Edge (active) | ✅ Integrate | Real edge logic; `workers/workers/` nested dup drop; secret-service keyless-templated → CF Workers+Queues+DO | ☐ |
| IN-15 | `edge/`, `boot/`, `bin/`, `launchers/` | KV/D1 libs, boot orderer, prod CLI, dev launchers | JS / MJS / Node CLI | Utility/tooling | 🔧/⏸/❌ | edge+boot fold to libs; `bin/` rework creds to OIDC (adapt); `launchers/` **Windows paths** Drop (R-10) | ☐ |
| IN-16 | `monitoring/` + `observability/` + `otel-wrappers/` | OTel SDK + 13 traced wrappers, Prometheus, PII-redacting log pipeline | OTel, OTLP, Prometheus | Active | 🔧 Adapt | Strong; **swap logger→pino, add Sentry+Langfuse (net-new, not present)** → OTel+Sentry+Langfuse+pino | ☐ |
| IN-17 | `security/` (18 modules) | RBAC, CORS, autonomy-guardrails, request-signer, CSP, prompt-injection, secret-manager, container-scanner | JS, AES-GCM, HMAC, CSL | Active | ✅ Integrate | All **fail-closed** (SEC-002 satisfied here); high reuse → security lib | ☐ |
| IN-18 | `credential-rotation/`, `certs/`, `compliance-templates/` | Secret scanner+rotation, TLS certs, GDPR/HIPAA/SOC2 | JS/Bash/YAML, LFS certs | Governance | 🔧/✅ | rotation re-target to GCP SM (adapt); certs are public LFS pointers, dup dir drop; compliance middleware integrate | ☐ |
| IN-19 | `heady-pqc-security/` | Post-quantum crypto guide (Kyber/Dilithium) | SKILL.md | Documented | ⏸ Defer | Forward-looking; modules unverified → defer | ☐ |
| IN-20 | `metrics_scraper.js`, `tracer.js`, `logs/`, `audit/`, `deploy/`, `distribution/`, `deployments/`, `deploy`(low-level) | Misnamed lister / madge util / runtime logs / outputs / deployers / release meta | JS / files | Mixed | ❌/⏸/🔧 | scraper+logs Drop; tracer/audit/release-meta Defer; salvage cloud-run+cloudflare deployers, drop k8s/render | ☐ |

**Layer risks:** SEC-001 not clean (full git-history scan still needed); INFRA-001 = R-6; canary triplicated (IN-02/03); compose sprawl (IN-07); self-hosted Postgres/pgbouncer/nginx → drop (Neon/CF); **Sentry+Langfuse+pino are net-new** despite being locked; directory rot (`cloudflare/cloudflare`, `workers/workers`, `infra/infra`, `certs/certs`, `infrastructure/`).

---

## Layer 7 — Business / Vertical products / Meta-rebuild snapshots

Overwhelmingly **meta-rebuild snapshots and skill manifests, not shippable products**. The six "verticals" are single `SKILL.md` files with no code; the "rebuild/monorepo/complete" cluster is ~10 overlapping scaffolds superseded by `Heady-AI` itself. The genuinely valuable assets are narrow: the **patent-implementations** package and the **heady-latent-os** φ-runtime.

| ID | Component | What | How (tech) | When/Where | Disp | Why / Why-not → target | ✔ |
|---|---|---|---|---|---|---|---|
| BZ-01 | `heady-patent-implementations/` | 8 patents (HS-051–062), 59 claims, 806 tests | Node, crypto-only, PROPRIETARY | Authoritative IP | ⏸ Defer/preserve | IP-sensitive working code; port under **ARBITER patent-lock**, not bulk-merge (R-8) → `packages/*` | ☐ |
| BZ-02 | `heady-latent-os/` | φ-runtime: 21-stage pipeline, LAW-07, evolution, persona-router, council | Node 22, zero deps | Canonical engine source | 🔧 Adapt | Most mature engine versions; port logic (Heady-AI is the core, not this) → `packages/orchestration`,`engines` | ☐ |
| BZ-03 | `heady-missing-modules/` | Earlier drafts of the SAME engines | Node | Superseded snapshot | ❌ Drop | Confirmed earlier/stub copies of BZ-02 (346L vs 2641L) — integrating both = double-port | ☐ |
| BZ-04 | `heady-latent-os-runtime-bundle/` | TS runtime SDK: phi-math, csl-router, kernel, observability | TS 5.9 | "merge-ready" v0.1 | 🔧 Adapt | TS-typed kernel/boundary layer not in latent-os → `packages/kernel`,`observability` | ☐ |
| BZ-05 | `heady-vsa-integration/` | VSA→CSL bridge (4096D hypervector) | Node | CSL gate impl | 🔧 Adapt | Real; **overlaps patent HS-058** — coordinate → `packages/csl-engine` | ☐ |
| BZ-06 | `heady-system-build/` | Platform scaffold + `build-sites.py` + generators | apps/pkgs/services, docker | Old snapshot | ❌ Drop scaffold / 🔧 scripts | Bulk superseded; only `build-sites.py` + gen scripts unique → `scripts/` | ☐ |
| BZ-07 | `heady-implementation/` | Research pkg; section1 = pgvector migrations + hybrid-search/graph-rag | SQL, JS | Vector-DB R&D | ❌ docs / 🔧 section1 | Sections 2-7 are docs; only section1 portable → `db/migrations`,`packages/vector` | ☐ |
| BZ-08 | `heady-platform-fixes/` | 5 prod fixes + domain-verify + repo-bootstrap | Next.js, CF Workers, mjs/py | Actionable fixes | 🔧 Adapt | Real fix logic + CI domain-verify → `scripts/ci`, worker configs | ☐ |
| BZ-09 | `platform-fixes/` | Near-identical copy of BZ-08 | same | Dup | ❌ Drop | Functionally identical (banner+trivial CORS diff) → keep BZ-08 | ☐ |
| BZ-10 | `heady-enterprise/` | Enterprise distribution: K8s, Terraform, Helm, SDKs, compliance | Node/K8s/Terraform | v3.2.2, 193 files | ⏸ Defer | Only real vertical; defer unless core to portal spearhead → post-launch ops | ☐ |
| BZ-11 | `enterprise/` | ~50% subset of BZ-10 | same | Dup subset | ❌ Drop | Partial stale copy | ☐ |
| BZ-12 | `heady-improvement/`, `heady-system-fix/` | Earlier monorepo snapshot / partial crypto-scoring fragments | monorepo / JS | Snapshots | ⏸ Defer (audit) | Possibly unique tests/crypto — inspect before drop | ☐ |
| BZ-13 | `heady-improvements/`, `heady-academic-research/` (biz), `HeadyConnectionKits/`, `compliance-templates/` (product) | Architecture/deployment docs, research, GTM templates, compliance | MD + JS | Reference/GTM | ⏸ Defer | Design/GTM/legal assets, post-launch → `docs/`, `packages/compliance` | ☐ |
| BZ-14 | `heady-cognition/` (product angle), `HeadyAcademy/` | Cognitive schema / node-routing manifest | JSON-MD / Node | Config/routing | 🔧/❌ | cognition schema port (adapt); HeadyAcademy routing already exists in latent-os (drop) | ☐ |
| BZ-15 | `heady-desktop-suite/` | Electron wrapper for Buddy/Web/IDE | Electron 39 | v4.0 build harness | ⏸ Defer | Real but Phase-2 (after web stabilizes); consider Tauri → desktop phase | ☐ |
| BZ-16 | Vertical SKILL.md dirs (fintech-trading, nonprofit-ops, intelligence-analytics, incident-ops, digital-presence, pqc-security) | Skill *manifests*, no code | YAML frontmatter | Skill defns | ⏸ Defer | Not products; routing capability descriptions → `.claude/skills/` (now registered) | ☐ |
| BZ-17 | Meta snapshots (`heady-complete`, `heady-monorepo`, `HeadySystems_v13`, `heady-production`, `heady-output`, `heady-full-rebuild`) | Superseded full-platform scaffolds / GitHub mirror / status docs | generic boilerplate | Stale | ❌ Drop | All superseded by `Heady-AI` itself | ☐ |
| BZ-18 | Zip bundles (`heady-complete-bundle-v5.0.0.zip`, `heady-mcp-enhancement-v5.0.0.zip`) | Git-LFS pointer stubs (content absent) | LFS pointers | Not materialized | ❌ Drop | No local content; fetch from LFS only if a file proves unique | ☐ |

**Layer risks:** double-integrate risk **resolved** (BZ-02 canonical, BZ-03 superseded — do not approve both); patent-IP preservation is non-negotiable (R-8); the "Heady-AI consumes patents via packages/*" claim is **unverified** — confirm before relying; only `heady-enterprise` is a real vertical, and it's not launch-blocking.

---

## Layer 8 — Docs / Foundations / Skills / Workflows / Tooling / Config

A sprawling, triplicated, status-report-choked snapshot of pre-rebuild thinking: 327 `docs/*.md`, 459 scripts, 236 configs, ADRs across three colliding directories, skills stored three ways. **Almost all of it is superseded** by the rebuild's curated compendium, 25 ADRs, REBUILD_PLAN_V2, and 136-skill `.agents`. High-value survivors are narrow.

| ID | Component | What | How (tech) | When/Where | Disp | Why / Why-not → target | ✔ |
|---|---|---|---|---|---|---|---|
| DX-01 | `facts.yaml` | Self-declared golden record / canonical master-data | YAML, PR+ADR-gated | Consistency engine source | ✅ Integrate | Matches locked decision; **absent from rebuild** → `Heady-AI/facts.yaml` (root) | ☐ |
| DX-02 | `01-foundations/`, `02-implementation-references/` | csl-theory, phi-math, vsa-foundations; duckdb-vss, sentence-transformers, torchhd | Markdown spec | Theory/impl refs | 🔧 Adapt | Authoritative theory; reconcile vs compendium/locked stack → `docs/compendium/` | ☐ |
| DX-03 | **67 unique concept skills** | dream-engine, empathy-core, ghost-protocol, mycelium-network, treasury-nexus, patent-sentinel, etc. | SKILL.md packs | Not in rebuild's 136 | 🔧 Adapt | Genuinely new by name but **concept-stage** (build-readiness unvalidated) — triage individually → `.agents/skills/` | ☐ |
| DX-04 | Skill triplication (`skills/` 32, `heady-skills/`, `.agents/skills` 121) | Same packs stored 3 ways; ~125 overlap rebuild | dirs + numbered .md | Legacy skill stores | ❌ Drop | Already in rebuild's 136 → keep only the 67 (DX-03) | ☐ |
| DX-05 | `dropzone/06-Skills-Library` | Skills 23-42 + manifests | .md | Dropzone (25 synced) | ⏸ Defer | Subset already synced via `heady-sync` → merge remainder into DX-03 triage | ☐ |
| DX-06 | `docs/adr` (137, colliding nums) + `docs/ADR` (6) + `docs/adrs` (25) | ADRs across 3 dirs | Markdown | Decision records | ❌ Drop / ⏸ archive | Rebuild's 25 ADRs are curated descendant of `docs/adrs`; **verify no unique ADR stranded** | ☐ |
| DX-07 | `docs/` foundational+arch (C4 *.puml, ARCHITECTURE-MAP, build-specs) | Arch diagrams & specs | MD/PlantUML | Design refs | ⏸ Defer | Mine for compendium gaps else archive → `docs/compendium/` | ☐ |
| DX-08 | Root status-report sprawl (~20: DEEP_SCAN_*, FINALIZATION, PERFECTION_ACHIEVEMENT, STATUS-DASHBOARD, SYNC_STATUS, ECOSYSTEM-AUDIT) | Point-in-time snapshots | Markdown | Historical | ❌ Drop | Greenfield rule: stale status = drop (archive tarball for provenance) | ☐ |
| DX-09 | `AGENTS.md`, `ARCHITECTURE.md`, `BUDDY_KERNEL.md`, `ACTIVE_LAYER_POLICY.md`, `START_HERE.md`, `ONBOARDING.md` | Legacy system rules + boot docs | MD/YAML-in-MD | Old consolidation era | ⏸ Defer | Superseded by rebuild AGENTS.md/SOURCE_OF_TRUTH; **BUDDY_KERNEL has φ/Fib params to harvest** → facts/compendium | ☐ |
| DX-10 | `stage-prompts/` | 7 pipeline-stage prompts | Markdown | Stage prompts | ⏸ Defer | Possibly reusable for eval/agent loop; verify vs STEPWISE → `.agents/`/specs | ☐ |
| DX-11 | `scripts/` (459) | auto-deploy*.ps1, audit-*.js, ban-localhost.sh, backup-pgvector.js | PowerShell + JS | Ad-hoc ops | ❌ Drop / 🔧 rescue | PowerShell+localhost violate locked rules; rescue only `ban-localhost.sh`,`backup-pgvector.js` | ☐ |
| DX-12 | `tools/`, `tooling/cce/check-facts.js`, `source-reference/`, `utils/`, `templates/` | Scaffolding CLIs, facts validator, CJS reference impls, utils, codegen templates | JS/Python/HTML | Tooling | 🔧/⏸ | `check-facts.js` pairs with facts.yaml (adapt → consistency engine); rest logic-mine/defer | ☐ |
| DX-13 | `config/` (16) + `configs/` (236) | agents.json, providers.json, site-registry, domain-aliases, **api-keys.json** | JSON/YAML | Runtime config | ❌ Drop / 🔧 select | Massive dup; **api-keys.json = secret risk**; harvest registry/domain facts → `facts.yaml` | ☐ |
| DX-14 | `env`, `env.local`, `env.production` | Env templates + populated envs | dotenv | Local + prod | ❌ Drop | env.production/local may hold **secrets** — rotate, never port → Secret-Manager injection | ☐ |
| DX-15 | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig*.json`, manifests, `gitignore-configs/` | Legacy build-meta + manifests | pnpm/Turbo/TS/JSON | Build/meta | ❌ Drop | Rebuild has its own canonical set; legacy is the sprawl being replaced | ☐ |
| DX-16 | `remediation-tracker.yaml` | Open-defect tracker | YAML | Remediation | ⏸ Defer | Cross-check open items vs rebuild backlog, then archive → issue tracker | ☐ |

**Layer risks:** authoritative survivors = `facts.yaml` (DX-01, top priority, absent from rebuild), foundations packs (DX-02), 67 unique skills (DX-03); ADR mess is **not 111 ADRs to port** — bulk drop with one verification pass; **secrets** in `configs/api-keys.json` + `env.production`/`env.local` (rotate-and-drop); harvest φ/Fib constants from `BUDDY_KERNEL.md`.

---

## Consolidated "integrate-now" shortlist

The highest-confidence ports for Phase-1 (the ✅ set + the load-bearing 🔧):

1. **φ-math + CSL core** — `shared-ts/` (BE-08), `maximum-potential/phi-constants` (AG-04), `sacred-geometry.js` (DA-16), `shared/csl-engine-v2.js` (BE-04) → `packages/phi-math`, `packages/csl`.
2. **Bee/swarm runtime** — `agents/` + `maximum-potential/liquid-nodes` (AG-01/03) → `packages/bees`.
3. **pgvector schema** — `migrations/0001–0009` (DA-01) → Neon SoR (after R-5 verification).
4. **Cloudflare edge + workers** — `cloudflare/` + `workers/` (IN-13/14) → CF Workers/Pages/DO.
5. **MCP server family** — `mcp-servers/` v6 + tool services + `colab-gateway` (MC-01/06/10) → `packages/contracts` + `headyme-portal`.
6. **Security + governance** — `security/` (IN-17), governance configs (IN-05), `compliance-templates` (IN-18).
7. **Golden record + content** — `facts.yaml` (DX-01), `content/` + `assets/` (FE-11/12), `heady-cognition/` (AG-07).
8. **IP preservation** — `heady-patent-implementations` (BZ-01) under ARBITER review.

---

## Approval ledger (founder sign-off)

Mark each layer once you've reviewed its `✔` column. Overrides noted in the table take precedence over my recommendations.

| Layer | Reviewed | Notes / overrides |
|---|---|---|
| 1 Frontend / UI / Sites | ☐ | (e.g. pick canonical site source: ______) |
| 2 Backend / Core / Auth | ☐ | (confirm: custom-JWT vs Firebase; LangGraph vs CF Workflows) |
| 3 Agents / Bees / Swarms | ☐ | |
| 4 Data / Memory / Vector | ☐ | (confirm live Neon state — R-5) |
| 5 MCP / AI / Integrations | ☐ | (confirm AI-Gateway reroute scope — R-3) |
| 6 Infra / Deploy / Security | ☐ | (confirm self-hosted→managed drops; Sentry/Langfuse net-new) |
| 7 Business / Verticals | ☐ | (confirm patent port plan — R-8) |
| 8 Docs / Skills / Tooling | ☐ | |
| **Critical risks R-1…R-10** | ☐ | (R-1 key rotation + R-2 fail-open are action-now) |

> Once approved, each ✅/🔧 component becomes a `STEPWISE_BUILD_SPEC.md` entry and an HCP (Heady Change Proposal) where it touches a patent-lock zone or a locked decision.
