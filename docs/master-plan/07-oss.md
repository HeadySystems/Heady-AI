<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ Master Incorporation Plan — Domain 07: Open-Source        ║
║  Made with ❤️ by HeadySystems Inc.                                ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# Domain 07 — Open-Source Implementations

> **Scope:** Every OSS component Heady (a) currently depends on, (b) names in the architecture as
> planned/candidate/rejected, and (c) could itself extract and publish.
> **Primary sources (ground-truth, in precedence order):** all `package.json` (root + `packages/*` +
> `apps/*` + `tooling/*`), `facts.yaml` (locked stack), `docs/PROVIDER_AND_OSS_MASTER_PLAN.md`
> (authoritative provider/OSS doc), `docs/compendium/*`, `docs/adr/*`, `docs/PACKAGE_CATALOG.md`
> (legacy→monorepo extraction plan), `docs/compendium/11-reconciliation.md`.
> **GROUND-TRUTH RULE applied:** *installed reality wins over named intent.* Where the inventory hint or
> a skill names a library that is **not in any `package.json`**, it is recorded as **planned/candidate**,
> not current. Skills are claims; they are downgraded to inferred unless an ADR/compendium/facts.yaml backs them.

---

## 0. Two facts that frame this domain

1. **The rebuild's external OSS surface is deliberately tiny.** The `packages/*` rebuild modules carry
   **only `@heady/*` workspace deps** — no third-party runtime libraries yet. The only third-party OSS
   actually installed in rebuild code is **`hono` + `zod`** (edge gatekeeper), **`wrangler` + `typescript`**
   (Workers dev), **`express`** (`heady-manager`), and **`firebase` + `vite`** (`headyme-portal`), plus the
   repo-level toolchain (**pnpm, turborepo, eslint**). This is intentional: ADR-0019/R1
   dependency-minimalism. Tests run on **`node --test`**, not Vitest.
2. **The root `package.json` is the LEGACY app, not the rebuild.** It is the Express 5 / CommonJS /
   Jest monolith (`@anthropic-ai/sdk`, `openai`, `groq-sdk`, `pg`, `redis`, `duckdb`, `electron`, …) that
   the canonical rebuild (ESM Node 22, `@heady/*` packages) supersedes. Its deps are listed below but
   marked **legacy / superseded** so they do not inflate the rebuild's current-OSS count.

> **Where the inventory hint diverged from reality:** *Vercel AI SDK* = planned (harness locked in
> facts.yaml, but `@heady/agent-loop` is unscaffolded). *Vitest* = **not present** — rebuild uses
> `node --test`. *Handlebars* = **not found anywhere** (likely confused with the legacy `tinyliquid`).
> *pg/pgvector* = legacy-only as a dep; in the rebuild they are planned (`@heady/db` has zero deps yet).

---

## (a) Current OSS dependencies

### a.1 Rebuild (canonical) — actually installed

| Package | Used by | Purpose | Locked? |
|---|---|---|---|
| **pnpm** `9.15.9` | whole monorepo | workspace package manager | ✅ `facts.yaml: package_manager` |
| **Turborepo** `2.9.18` | whole monorepo | graph-aware cached task runner (`turbo.json`) | ✅ `facts.yaml: monorepo_tool` |
| **ESLint** `10` + `@typescript-eslint/*` | repo lint gate | lint stage of CI pipeline | — (pipeline-required) |
| **TypeScript** `5.x` | edge apps, type-check stage | type system / `tsc` build | implied by `module_system: esm`, Node 22 |
| **`node --test`** (node:test) | every `@heady/*` package | unit test runner (NOT Vitest/Jest) | — (de-facto rebuild standard) |
| **Hono** | `apps/heady-edge-gatekeeper` | Cloudflare Workers HTTP framework (edge entrypoints) | — (thin edge glue) |
| **Zod** | `apps/heady-edge-gatekeeper` | runtime schema validation at boundaries | partial — contract surface locks on Zod (ADR-0002) |
| **Wrangler** | edge-gatekeeper, portal-gateway, portal-proxy | Cloudflare Workers CLI / deploy | ✅ edge target = cloudflare-workers (`facts.yaml`) |
| **Express** `5` | `apps/heady-manager` | Cloud Run origin HTTP server | — (origin write path) |
| **Firebase (JS SDK)** | `apps/headyme-portal` | client auth + hosting integration | ✅ `facts.yaml: auth = firebase-auth` |
| **Vite** | `apps/headyme-portal` | portal SPA bundler/dev server | partial — R1 allows React/Vite where complexity earns it |

**Locked-stack anchors from `facts.yaml`** (constrain all of the above): `package_manager: pnpm`,
`monorepo_tool: turborepo`, `module_system: esm`, `node_version: 22`, embedding `@cf/baai/bge-small-en-v1.5`
(384/mean), `auth: firebase-auth`, `secrets: gcp-secret-manager`, `event_bus: nats`,
`durable_execution: cloudflare-workflows`, `agent_harness: vercel-ai-sdk-v6`, supply-chain `renovate`
(primary) + `dependabot` (security-only).

### a.2 Legacy root app — superseded (do not count as rebuild OSS)

| Package | Purpose | Disposition |
|---|---|---|
| `@anthropic-ai/sdk`, `openai`, `@google/genai`, `@google/generative-ai`, `groq-sdk`, `@huggingface/inference` | multi-provider LLM SDKs | superseded → rebuild routes via `@heady/model-gateway` + CF AI Gateway (ADR-0018) |
| `@modelcontextprotocol/sdk` | MCP server SDK | **kept** — rebuild `@heady/mcp` will use the official SDK |
| `pg`, `redis`, `duckdb` | Postgres / Redis / embedded OLAP | `pg`→`@heady/db` (Neon+pgvector); `redis`→Upstash; `duckdb` dropped |
| `express`, `cors`, `helmet`, `compression`, `express-rate-limit` | HTTP middleware | `express` kept for Cloud Run origin; rest fold into `@heady/security-mesh`/`@heady/resilience` |
| `tinyliquid` | Liquid templating | legacy; no rebuild equivalent adopted |
| `electron` | desktop shell | dropped (HeadyBrowser builds "not yet available") |
| `jest`, `supertest`, `nodemon` | legacy test/dev tooling | superseded by `node --test` |
| `@octokit/rest`, `@octokit/auth-app` | GitHub App (ADR-0016 token minter) | **kept** path |
| `js-yaml`/`yaml`, `axios`, `node-fetch`, `ws`, `commander`, `dotenv`, `bcrypt`, `jsonwebtoken`, `node-cron`, `minimatch`, `swagger-ui-express` | misc utilities | absorbed/replaced per `LEGACY_STACK_COMPONENT_DISPOSITION.md` |

---

## (b) Planned / potential OSS (named in architecture, not yet installed)

| Library / technique | Capability | For which Heady system | Status | ADR / source |
|---|---|---|---|---|
| **Drizzle** | TS ORM + migration authority (expand→migrate→contract) | `@heady/db` | planned | ADR-0002/0007; PROVIDER §3.4; `db` keyword |
| **pgvector** | vector store + similarity (sole retrieval authority) | `@heady/db`, `@heady/memory` | planned (rebuild) / current (legacy) | ADR-0003 |
| **pgmq + pg_cron** | in-DB transactional outbox + scheduling | `@heady/db`, task ledger | planned | ADR-0002; PROVIDER §3.3 |
| **OpenAPI 3.1 + Kubb** | contract-first → TS types / Zod / `mcp-tools.json` | `@heady/contracts` | planned | ADR-0002; PROVIDER §3.5 |
| **Vercel AI SDK v6** | native agent-loop harness | `@heady/agent-loop` | planned | `facts.yaml: agent_harness`; ADR-0016 |
| **Cline SDK** (Apache-2.0) | fallback agent-loop substrate | `@heady/agent-loop` | candidate | REBUILD_PLAN_V2 |
| **Pino** (shape) | JSON structured logging | `@heady/logger` | candidate (Pino-*shaped*, may be hand-rolled) | PACKAGE_CATALOG Tier 0 |
| **OpenTelemetry** (GenAI semconv) | vendor-neutral traces/metrics | `@heady/observability` | planned | ADR-0011; PROVIDER §7.1 |
| **Langfuse** | LLM prompt/eval/cost observability | `@heady/observability` exporter | planned | ADR-0011; PROVIDER §7.2 |
| **NATS (JetStream)** | best-effort in-flight inter-agent/stigmergy bus | `@heady/events` | planned (scoped) | ADR-0020 / R8 — **see template** |
| **DSPy (MIPROv2 / GEPA)** | prompt/program optimization from traces | `heady-distiller`, pipeline stage 21 | candidate (Python → Colab) | compendium 03/06/07/08 — **see template** |
| **Voyager** (skill synthesis) | code→embedding→`skills` accretion | `@heady/memory`, distiller | planned (pattern) | compendium 04 (skill accretion) |
| **CoALA / Letta(MemGPT) / mem0** | memory taxonomy, typed memory blocks, derived-mem ops | `@heady/memory` | planned (TS **patterns**, not Python servers) | ADR-0003; compendium 04 |
| **HNSW** (m=16, ef=200) | dense ANN index | `@heady/db` pgvector | planned | ADR-0003; compendium 04 |
| **`tsvector` / GIN + pg_trgm** | sparse full-text / BM25-style lexical | `@heady/db` hybrid retrieval | planned | ADR-0003; compendium 04 |
| **Reciprocal Rank Fusion (RRF, k=60)** | fuse dense+sparse in one SQL CTE | `@heady/memory` hybrid search | planned | ADR-0003; compendium 04 |
| **Cohere Rerank v3.5 / bge-reranker-v2-m3 / LFM2-ColBERT-350M** | second-stage reranker | `@heady/memory` | candidate | compendium 04; PROVIDER v2 banner |
| **SPLADE / BM25** | sparse retrieval option | hybrid vector search | candidate (inferred) | skill `heady-hybrid-vector-search`; blueprint (not ADR-locked) |
| **Louvain** community detection | graph community clustering | `@heady/memory` Graph-RAG | candidate (inferred, low conf) | skill `heady-graph-rag-memory` (no ADR) |
| **HDC / VSA** (bind/bundle/permute; torchhd ref) | hyperdimensional binding for CSL/associative memory | `@heady/csl-engine`, sonification | adopted as **theory** / patent-locked impl | compendium 07 T3; **HS-058 patent zone** |
| **WASM WebContainers** (StackBlitz API) + **xterm.js** | in-browser instant preview sandbox | `heady-web-container` | planned (scoped) | ADR-0021/0029, R12 — **see template** |
| **Cloudflare Sandboxes** + Outbound Workers | server-side agent-loop code execution | agent loop | planned | June spec; R12 |
| **Merkle-tree file hashing** | source-file change → re-embed trigger | `heady-merkle-index` | planned | ADR-0023 (was 0018); R11 |
| **OPA / Rego (`opa-wasm`)** | approval policy, CI + runtime parity | `@heady/approvals` | planned | compendium 06 G6; PACKAGE_CATALOG Tier 4 |
| **Ed25519** | approval-receipt + commit signing (baseline now) | `@heady/approvals`, `heady-pqc-security` | planned (baseline) | R3; compendium 06 G9 |
| **ML-DSA-65 / ML-KEM-768 / SLH-DSA** (PQC) | post-quantum signing/KEM | `heady-pqc-security` | candidate (Phase-4 aspirational) | R3; Law 4 |
| **Google Copybara** (Starlark) | history-preserving projection (`GitOrigin-RevId`) | `tooling/projector` | planned | ADR-0017 |
| **Drupal** (JSON:API) | optional headless CMS | content vertical | candidate (P4 opt-in) | PROVIDER §8 |
| **gitleaks · TruffleHog · Semgrep · Trivy/Grype/Syft · mcp-scan · Renovate · Dependabot** | secret/SAST/SCA/SBOM/MCP scan + dep updates | supply-chain CI | planned (P0 CI) | PROVIDER §7.4; `facts.yaml: supply_chain` |
| **assistant-ui** + Vercel AI SDK | agent chat UI | `apps/assistant-ui` | candidate | PROVIDER v2 banner |
| **Qdrant** | 2nd vector engine | — | **rejected/dropped** | ADR-0003 (amended); `facts.yaml: stores.dropped` |
| **Temporal · Kafka** | external orchestration/broker | — | **rejected** (deferred P4 gate) | ADR-0004; PROVIDER §9 |
| **Prisma · Redis Pub/Sub · Render/Vercel/Streamlit/Gradio** | ORM / pub-sub / alt-host | — | **rejected** (or Optional alt) | PROVIDER §3.4/§9; ADR-0020 |

### NATS
- **Category** edge/orch event bus · **Status** planned (scoped) · **Confidence** defined (named in facts.yaml + ADR-0020 + R8).
- **What.** Publish/subscribe inter-agent + stigmergy distribution with wildcard subject routing.
- **Where-used.** `@heady/events` (subjects `agent.*`, `heady.observation.*`); legacy `nats` (IN-11).
- **Parts.** NATS JetStream; optional Redis Streams for task fan-out.
- **Alternative.** pgmq outbox (the authoritative path) — NATS does **not** replace it.
- **Incorporation steps.** Wire as best-effort transport in `@heady/events`; outbox/pgmq remains the only durable write path; consumers idempotent (ADR-0006).
- **⚠ decisions+ADR.** **Tension:** `facts.yaml: event_bus: nats` reads "locked," but ADR-0020 + R8 scope NATS as **best-effort, in-flight, NEVER authoritative and never the write path**. The installed `@heady/events` package has **no `nats` dependency** — outbox-first is the reality. Treat NATS as scoped transport, not the durable bus.

### DSPy (MIPROv2 / GEPA)
- **Category** prompt/program optimizer · **Status** candidate · **Confidence** technique defined (pipeline stage 21); library adoption inferred.
- **What.** Optimize prompts/recipes from execution traces (MIPROv2, GEPA).
- **Where-used.** `heady-distiller` (pipeline stage 20/21 RECEIPT → optimized recipe); learning loop in compendium 06.
- **Parts.** DSPy compilers; trace corpus → distilled SKILL.md recipe + Voyager skill synth.
- **Alternative.** Hand-tuned prompts / in-house TS optimizer.
- **Incorporation steps.** DSPy is **Python**; Heady is ESM Node 22 → run on the **Colab fallback tail** (ADR-0018), not the monorepo; emit recipes back as artifacts.
- **⚠ decisions+ADR.** No ADR locks DSPy; it is an aspirational technique, language-mismatched to the runtime. Gate before adopting.

### WASM WebContainers (StackBlitz)
- **Category** execution sandbox · **Status** planned (scoped) · **Confidence** defined (ADR-0021/0029, R12).
- **What.** Boot a micro-OS in the browser's WASM thread for instant, zero-server code preview.
- **Where-used.** `heady-web-container` — user-facing live coding preview.
- **Parts.** StackBlitz WebContainer API; `xterm.js` terminal; authenticated WebSockets to the agent-loop DO; egress allowlist firewall.
- **Alternative.** Cloud Run Docker (rejected for iterative testing — cost + origin exposure).
- **Incorporation steps.** Browser preview only; sync files over WS from the Durable Object; restrict egress by subdomain allowlist.
- **⚠ decisions+ADR.** **R12 split:** WebContainers = in-browser preview; **Cloudflare Sandboxes** (June spec) own server-side agent-loop execution. SharedArrayBuffer/WASM browser support required; native C++ addons won't run.

### Voyager
- **Category** skill synthesis · **Status** planned (pattern) · **Confidence** defined (compendium 04).
- **What.** Accrete reusable skills: code → embedding → index in the `skills` table.
- **Where-used.** `@heady/memory` (procedural memory), `heady-distiller` pipeline tail.
- **Parts.** Skill-code generation + embedding + retrieval; pairs with DSPy recipe distillation.
- **Alternative.** Static skill registry (current `tooling/skill-registry`).
- **Incorporation steps.** Implement as a **TS pattern** over the `skills` table (not the Python Voyager agent); embeddings via the locked bge-small-384 model.
- **⚠ decisions+ADR.** Pattern, not a dependency; no separate ADR.

---

## (c) Heady components as OSS-extraction candidates (INFERRED)

> **No explicit public-OSS-publication plan exists.** Every `@heady/*` package is `private: true` and the
> repo is `license: UNLICENSED`. `docs/PACKAGE_CATALOG.md` is a **legacy→monorepo extraction** plan, not a
> publication plan. The table below is therefore **inferred**: the generic, non-differentiating,
> already-scaffolded-and-tested packages that *could* be published with the least friction.
> **Hard exclusion — patent zones:** `@heady/csl-engine`, `@heady/security-mesh`, and `@heady/bees` carry
> HS-2026-051+ patent-locked logic (HS-058 VSA→CSL bridge) under ARBITER review. They are **NOT**
> extractable as OSS.

| Component | What it'd offer the world | Readiness | Patent-safe? |
|---|---|---|---|
| `@heady/phi-math` | Golden-ratio constants, Fibonacci, φ-backoff, gate thresholds | High — pure, tested, zero deps | ✅ (math primitives) |
| `@heady/logger` | Pino-shaped JSON logging + trace-id + redaction + φ-sampling | High — scaffolded & tested | ✅ |
| `@heady/resilience` | Circuit breaker, bulkhead, graceful shutdown, φ-backoff retry/timeout | High — scaffolded & tested | ✅ |
| `@heady/kernel` | "Latent Service Pattern" `{start,stop,health,metrics}` microkernel + dependency-ordered boot | Med-High — tested; small API | ✅ (pattern, not patented) |
| `@heady/shared` | `Result<T,E>`, typed errors, health/metrics shapes | High — pure types/utils | ✅ |
| `@heady/events` | Typed action/observation bus + wildcard subjects + outbox projector | Med — couples to outbox model | ✅ |
| `@heady/config` | `facts.yaml` golden-record loader + fail-closed env access | Med — generic config pattern | ✅ |
| `@heady/observability` | Vendor-neutral metrics/spans facade (OTel/Sentry/Langfuse pluggable) | Med — useful abstraction | ✅ |
| `@heady/consistency-bus` | Runtime ingress/egress drift-blocking over a value registry | Med — novel but generic | ⚠ verify (no patent flag found) |
| `@heady/csl-engine` | — | — | ❌ **EXCLUDED** (HS-2026-051+/HS-058) |
| `@heady/security-mesh` | — | — | ❌ **EXCLUDED** (patent zone) |
| `@heady/bees` | — | — | ❌ **EXCLUDED** (patent zone) |

---

## Summary

1. **Current OSS deps (rebuild, installed):** ~11 — pnpm, Turborepo, ESLint, TypeScript, node:test, Hono, Zod, Wrangler, Express, Firebase SDK, Vite (legacy root app adds ~25 superseded; not counted).
2. **Planned/candidate OSS (named, not installed):** ~35 entries — incl. Drizzle, pgvector/pgmq/pg_cron, Kubb, Vercel AI SDK, OTel, Langfuse, NATS, DSPy/Voyager, CoALA/Letta/mem0, HNSW/tsvector/RRF, rerankers, WASM WebContainers/xterm.js, Cloudflare Sandboxes, Merkle hashing, OPA/Rego, Ed25519, Copybara, supply-chain scanners.
3. **Rejected/dropped OSS:** Qdrant (dropped), Temporal/Kafka, Prisma, Redis Pub/Sub, Render/Vercel/Streamlit/Gradio (deferred/optional alts), DuckDB/Electron (legacy).
4. **Extraction candidates (inferred):** 9 publishable infra packages (phi-math, logger, resilience, kernel, shared, events, config, observability, consistency-bus); **3 hard-excluded** by patent lock (csl-engine, security-mesh, bees).
5. **Open decisions:** No public-OSS-publication plan exists (all packages `private`/UNLICENSED); NATS "locked vs best-effort" tension (facts.yaml vs ADR-0020/R8); DSPy language mismatch (Python vs Node 22 → Colab); Ed25519→PQC migration (R3, Phase-4); SPLADE/Louvain are skill-only claims awaiting an ADR.
6. **Confidence:** facts.yaml + ADR + compendium entries = *defined*; skill-only mentions (SPLADE, Louvain, some rerankers) and DSPy library adoption = *inferred*; installed-vs-named line drawn strictly from `package.json` per the GROUND-TRUTH RULE.
