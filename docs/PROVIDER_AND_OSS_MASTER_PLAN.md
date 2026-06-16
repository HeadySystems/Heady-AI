# Heady-AI — Service-Provider & Open-Source Master Plan

> **Status:** Draft for approval · **Date:** 2026-06-15 (amended for v2) · **Owner:** Eric Anthony Haywood
> Canonical statement of **which** service providers and open-source components Heady uses, and the
> **what / when / why / how** of each across the build phases. Governed by `SOURCE_OF_TRUTH.md`,
> `REBUILD_PLAN_V2.md`, and ADRs 0000–0018. Where a legacy skill or the antigravity plan names a
> provider not listed as **Baseline** here, this document is authoritative — that provider is
> **Deferred**, **Optional**, or **Dropped** until a superseding ADR says otherwise.

> **v2 amendments (2026-06-15)** — applied below and detailed in `docs/compendium/`:
> - **Stores:** Upstash Redis = **best-effort cache baseline** (TTL≤60s, provisioned). Cloudflare
>   **Vectorize = derived edge cache** (projector-populated, reconstructible — promoted from deferred).
>   **Qdrant = DROPPED** (decommission unused; was deferred). Embedding **locked** `@cf/baai/bge-small-en-v1.5`
>   384/mean (ADR-0015). [ADR-0003 amended]
> - **Supply chain:** **Renovate is primary** (regex managers, can bump `facts.yaml`, auto-merge);
>   Dependabot retained **security-only** (GitHub Advisory).
> - **New baseline providers/components:** Cloudflare **AI Gateway** (single LLM egress chokepoint,
>   ADR-0018), **OpenRouter** + **Liquid/LFM2** ("open weight"), **Cloudflare Sandboxes** + Outbound
>   Workers (agent sandbox), GitHub App **`blocksorg`** + Cloud Run token minter (ADR-0016), **Copybara**
>   + Node projector (projections, ADR-0017), **OPA/Rego** (opa-wasm, approval policy), **Cohere Rerank /
>   bge-reranker** (retrieval), **assistant-ui** + Vercel AI SDK (agent UI), **Grafana Cloud** (OTel sink),
>   **QStash** (durable task backup, best-effort). **Tailscale** (Colab mesh).
> - **Credit programs (time-sensitive):** Cloudflare for Startups ($250k pending), Anthropic ×Goodstack,
>   OpenAI ×Goodstack, Adobe ×Goodstack (approved), Perplexity Enterprise (closes ~2026-06-16). See
>   `docs/compendium/10-business-and-roadmap.md` §B5.
> - **Crypto (R3):** Ed25519 baseline now; PQC (ML-DSA/ML-KEM) Phase-4 aspirational.
> - **Frontend (R1):** dependency-minimal — vanilla/Twig default, React/Vite only where complexity earns it.

---

## 0. How to read this document

Every provider/component entry follows the same five-field contract:

- **What** — the capability it supplies (the concern it owns).
- **Why** — why this one, stated against the alternative it beats. Single-authority-per-concern is the
  rule (ADR-0002/0003); a second tool for the same concern needs an evidence gate (ADR-0013).
- **When** — the phase it is introduced. Nothing arrives before the phase that needs it (≤1 net-new
  platform per phase, ADR-0013).
- **How** — the open-source library/protocol that wires it in, the integration pattern, and the write
  path. Heady's bias: **own the integration in open-source code; rent the undifferentiated heavy
  lifting** (managed infra). Business logic never lives in a vendor's proprietary glue.
- **Cost / limits / exit** — FinOps cap (ADR-0012), rate/token budget (ADR-0010), and the rollback or
  migration path if the provider must be replaced.

### The two axes

1. **Open-source app/component** = code or a self-hostable engine Heady runs and controls
   (PostgreSQL, Drizzle, Kubb, OTel, pgmq, the MCP SDK, Drupal, the agent loop itself).
2. **Service-provider service** = managed capability Heady rents (Neon, Cloudflare, GCP, Firebase,
   the LLM APIs, the business SaaS).

Heady's architecture is **open-source business logic projected onto managed infrastructure**. The
open-source layer is portable and owned; the managed layer is replaceable behind a thin adapter. This
plan keeps the seam between them explicit so no single vendor becomes load-bearing for logic.

---

## 1. Governing principles for provider selection

These derive directly from the ADRs and bound every choice below.

1. **One authority per concern** (ADR-0002/0003). One system of record, one retrieval engine, one
   orchestration surface, one secrets store, one identity provider. A second tool for the same concern
   is a *bet*, and bets are sequenced, not stacked.
2. **Sequence the bets; ≤1 net-new platform per phase** (ADR-0013). A provider is a quarter of
   solo-founder attention. Every phase introduces at most one new platform and retires one complexity
   source.
3. **Evidence gate for expansion** (ADR-0003/0004/0013). Any provider beyond Baseline requires a
   benchmark proving the baseline is the bottleneck, a feature flag, and a rollback path *before* it
   ships. Convenience is not evidence.
4. **Rent infra, own logic.** Managed services for undifferentiated operational burden (Postgres HA,
   edge POPs, secret rotation, auth). Open-source code for everything that encodes Heady's behavior.
5. **Everything behind an adapter.** Each provider is reached through a typed adapter in a `packages/*`
   module, generated from or validated against the contract surface (ADR-0002). Swapping a provider is
   an adapter change, not a rewrite.
6. **Every provider has a cap and an exit.** No provider ships without a FinOps cap (ADR-0012), a rate
   or token budget (ADR-0010), and a documented exit path.
7. **Secrets are keyless** (ADR-0008-era SEC-001). Every provider credential lives in GCP Secret
   Manager, reached via keyless OIDC. No long-lived keys in env files, CI, or code.

---

## 2. Provider taxonomy at a glance

| Tier | Concern | Provider/component | OSS or Managed | Phase | Authority |
|---|---|---|---|---|---|
| **Backbone** | Source of record | **Neon PostgreSQL** | Managed (OSS engine) | P1 | ADR-0002 |
| Backbone | Retrieval / vectors | **Neon pgvector** | OSS extension on managed | P1 | ADR-0003 |
| Backbone | Outbox / queue-in-db | **pgmq** | OSS extension | P1/P2 | ADR-0002 |
| Backbone | In-db scheduling | **pg_cron** | OSS extension | P1 | ADR-0002 |
| Backbone | ORM / migrations | **Drizzle** | OSS library | P1 | ADR-0002/0007 |
| Backbone | Contract surface | **OpenAPI + Kubb + Zod** | OSS toolchain | P1 | ADR-0002 |
| Backbone | Monorepo / build | **pnpm + Turborepo** | OSS | P0 | — |
| **Edge/orch** | Durable orchestration | **Cloudflare Workflows / Queues / Durable Objects** | Managed | P3 | ADR-0004 |
| Edge/orch | Edge compute / reads | **Cloudflare Workers** | Managed | P3 | ADR-0004 |
| Edge/orch | Hot-read cache (best-effort) | **Upstash Redis** / Cloudflare KV | Managed | P2 | ADR-0003 (amended) · TTL≤60s |
| Edge/orch | Object storage | **Cloudflare R2** | Managed | P3 | ADR-0004 |
| Edge/orch | Origin compute (writes) | **GCP Cloud Run** | Managed | P3 | ADR-0004 |
| **Identity/sec** | Identity | **Firebase Auth** | Managed | P1/P3 | SoT |
| Identity/sec | Secrets | **GCP Secret Manager (OIDC)** | Managed | P0 | SEC-001 |
| **AI** | Reasoning (primary) | **Anthropic Claude** | Managed API | P2/P3 | ADR-0005/0010 |
| AI | Multi-model council | **Gemini, OpenAI, Groq, Workers AI** | Managed APIs | P3 | ADR-0010 |
| AI | Embeddings | **embedding-router → Workers AI / provider** | Managed | P2 | ADR-0003 |
| AI | Research | **Perplexity (Enterprise)** | Managed API | P2 | — |
| **Observability** | Traces / GenAI semconv | **OpenTelemetry** | OSS | P1+ | ADR-0011 |
| Observability | LLM observability | **Langfuse** | OSS (self-host or cloud) | P2 | ADR-0011 |
| Observability | SLO-burn alerting | **Sentry** | Managed | P3 | ADR-0011 |
| **Supply chain** | Secret/SAST/SCA/SBOM | **gitleaks, TruffleHog, Semgrep, Trivy/Grype/Syft, mcp-scan** | OSS | P0 | OPTIMAL §5 |
| **Business SaaS** | Code host / CI | **GitHub** | Managed | P0 | ADR-0001 |
| Business SaaS | Banking | **Mercury** | Managed (MCP) | ops | — |
| Business SaaS | Payments | **Stripe** | Managed (MCP) | P4 | — |
| Business SaaS | Project mgmt | **Linear** | Managed (MCP) | ops | — |
| Business SaaS | Comms | **Slack** | Managed (MCP) | ops | ADR-0011 |
| Business SaaS | Docs/e-sign | **PandaDoc, Google Workspace** | Managed (MCP) | ops | — |
| Business SaaS | Design/brand | **Canva, Adobe Express/Acrobat** | Managed | P3 ops | — |
| Business SaaS | Models/datasets | **Hugging Face** | Managed | P2 | — |
| Business SaaS | CMS (optional) | **Drupal** | OSS self-host | P4 opt | — |
| Edge/orch | Derived vector cache | **Cloudflare Vectorize** | Managed | P2 | ADR-0003 (amended) |
| **Deferred** | 2nd vector engine (authority) | **Qdrant / Vectorize-as-authority / Upstash-Vector** | — | P4 gated | ADR-0003 |
| Deferred | Alt hosting | **Render, Vercel, Streamlit/Gradio** | — | as-needed | — |
| **Dropped** | 2nd vector store (unused) | **Qdrant** (provisioned, decommission) | — | — | ADR-0003 (amended) · R2 |
| **Dropped** | Legacy orgs/repos | `HeadySystems/main`, `Heady`, `ai-workflow-engine` | — | — | ADR-0001 |

---

## 3. Backbone providers (Phase 1 — the non-negotiable core)

### 3.1 Neon PostgreSQL — single system of record

- **What.** The one durable store for all state: task ledger, outbox, user/interaction data, and (via
  pgvector) embeddings. Everything else is a cache or a projection of this.
- **Why.** Postgres is open-source, ubiquitous, and the team already reasons in SQL. Neon adds
  serverless autoscaling, branching (cheap restore drills and PR databases), and PITR — the managed
  burden Heady should rent, not run. Chosen over PlanetScale/Supabase because pgvector + pgmq + pg_cron
  give one engine for SoR **and** retrieval **and** outbox **and** scheduling (collapses four concerns
  into one operational surface — ADR-0002/0003).
- **When.** Phase 1, first thing wired. It is the root of the dependency graph.
- **How.** Reached only through `packages/db` (Drizzle). One write path: application → outbox row →
  consumer. No service writes another context's tables directly (ADR-0002). DDL via Drizzle migrations
  with expand→migrate→contract (ADR-0007). Branching powers the monthly restore drill (ADR-0009).
- **Cost / limits / exit.** Daily spend in the FinOps rollup (ADR-0012); connection and compute caps
  set conservatively. Exit: because the engine is stock Postgres, a `pg_dump`/logical-replication
  cutover to any Postgres host is the rollback — no proprietary lock-in.

### 3.2 Neon pgvector — single retrieval authority

- **What.** Vector storage and similarity search for `memory-stream` and `auto-context`, colocated with
  the SoR.
- **Why.** One store means retrieval is transactionally consistent with the data it indexes, inherits
  the same backups/PITR, and adds no second bill or sync job. Chosen over Qdrant/Vectorize/Upstash
  explicitly (ADR-0003) — a second vector engine is deferred until a benchmark proves pgvector is the
  bottleneck.
- **When.** Phase 1 schema; populated in Phase 2 (`memory-stream`).
- **How.** HNSW/IVFFlat indexes managed as Drizzle migrations (ADR-0007). A KV cache (Cloudflare KV)
  fronts hot reads; the cache is never a source of truth. Memory patterns port CoALA/Letta/mem0 as TS
  schemas — **patterns, not Python servers** (ADR-0003).
- **Cost / limits / exit.** Index build/query cost tracked per FinOps. Exit to a dedicated vector
  engine is the Phase-4 gated path (flag + benchmark + rollback).

### 3.3 pgmq + pg_cron — outbox and in-database scheduling

- **What.** `pgmq` is the transactional outbox/queue; `pg_cron` runs scheduled jobs (retention sweeps,
  FinOps rollup, restore-drill reminders) inside the database.
- **Why.** Keeping the queue and scheduler *in the database* means the outbox commit and the business
  write are one transaction — no dual-write, no lost messages, no external broker to operate. Beats
  Kafka/NATS/SQS for a solo founder: zero extra infra, exactly the durability the backbone needs.
- **When.** P1 (pg_cron, outbox schema); outbox consumers active in P2 with the task ledger.
- **How.** Outbox is the **only** cross-boundary write path (ADR-0002). Consumers are idempotent
  (ADR-0006). pg_cron drives ADR-0008 retention, ADR-0009 drill reminders, ADR-0012 spend rollup.
- **Cost / limits / exit.** Negligible incremental cost. Exit: pgmq is replaceable by an external
  broker only if throughput evidence demands it (Phase-4 gate).

### 3.4 Drizzle — ORM and migration authority

- **What.** Typed data access and the single migration mechanism for all DDL.
- **Why.** TypeScript-native, generates types from schema, migrations are code-reviewed and reversible
  — exactly what ADR-0007's expand/migrate/contract discipline requires. Chosen over Prisma for its
  lighter runtime and SQL-first ergonomics on Neon.
- **When.** P1.
- **How.** All schema lives in `packages/db`; no manual `ALTER` in prod (ADR-0007). Migrations gated by
  human approval like code (ADR-0005) and replayed in order during restore drills (ADR-0009).

### 3.5 OpenAPI + Kubb + Zod — the contract surface

- **What.** The OpenAPI spec in `packages/contracts` is authoritative; **Kubb** generates TS types, Zod
  validators, and `mcp-tools.json` from it.
- **Why.** Contract-first makes the API, the client types, the runtime validators, and the MCP tool
  catalog a *single* source — drift becomes a CI failure, not a production surprise (ADR-0002). Zod
  enforces validation at every boundary (security-mesh). One generator (Kubb) avoids hand-sync between
  spec and code.
- **When.** P1, before any app consumes the API.
- **How.** CI fails on drift between spec and generated artifacts. `mcp-tools.json` is consumed by the
  MCP gateway (P3) so the agent tool surface is generated, never hand-written.

### 3.6 pnpm + Turborepo — monorepo and build

- **What.** Workspace management (`apps/*`, `packages/*`, `tooling/*`, `configs/*`) and cached task
  orchestration (build/lint/test/security:scan).
- **Why.** pnpm's content-addressed store and strict hoisting fit a many-package monorepo; Turborepo's
  graph-aware caching makes CI fast and deterministic. Already the scaffold's chosen tooling.
- **When.** P0 (already in place).
- **How.** `turbo.json` defines the task graph; `pnpm-workspace.yaml` the package set. The canonical
  repo is the only place releases/provenance run (ADR-0001).

---

## 4. Edge & orchestration providers (Phase 3)

### 4.1 Cloudflare Workers / Workflows / Queues / Durable Objects

- **What.** The one durable orchestration surface: Workers for edge compute and reads, Workflows for
  long-running/retryable orchestration, Queues for async fan-out, Durable Objects for per-entity
  coordinated state.
- **Why.** A single vendor for the whole durable-execution surface beats stitching Temporal + a broker
  + a cache (ADR-0004). Workers put reads at the edge — *every Worker→Cloud Run hop is a $-and-ms tax*,
  so reads are served at the POP and only writes go to origin.
- **When.** P3, when apps need orchestration. Edge Code Mode and DO-per-session are correct but
  **P4-gated** (ADR-0004 correction #6), not baseline.
- **How.** Business logic stays in `packages/*` libraries (incl. the circuit breaker — a library, not a
  service); Workflows/DOs are thin glue. Writes route to Cloud Run, which owns the Neon connection.
  Retries are idempotent (ADR-0006). Rate limits live at the edge (ADR-0010).
- **Cost / limits / exit.** Edge request and DO costs in the FinOps rollup; edge rate-limits fail-closed.
  Exit: because logic is in portable libraries, the orchestration layer can move to another durable-
  execution engine without touching business code.

### 4.2 Cache tier — Upstash Redis (baseline) / Cloudflare KV (substitute)

- **What.** Best-effort, low-latency cache in front of pgvector/SoR reads (T0/hot).
- **Why.** **v2 (R2):** **Upstash Redis is the baseline cache** because it is *already provisioned* and
  the MCP build guide's code assumes `tenant:{id}:` Redis namespacing. **Cloudflare KV** is an acceptable
  edge-local substitute (no new platform). Either fills the role; both are best-effort.
- **When.** P2. **How.** Cache only — **TTL ≤ 60s, "never authoritative" in code** (ADR-0003 amended);
  invalidation flows from the outbox.

### 4.3 Cloudflare R2 — object storage

- **What.** Blobs: exports, attachments, model artifacts, design assets.
- **Why.** S3-compatible, zero egress fees, same vendor surface. **When.** P3. **How.** Accessed via a
  typed storage adapter; lifecycle/retention per ADR-0008.

### 4.4 GCP Cloud Run — origin compute for writes

- **What.** The origin service that owns the Neon write connection and runs the modular monolith's
  write paths.
- **Why.** Containerized, scale-to-zero, keyless-OIDC-friendly with Secret Manager. Reads stay at the
  edge; Cloud Run is reserved for writes and heavy compute (ADR-0004). Chosen over Render for the write
  origin because of native GCP IAM/Secret Manager integration (Render stays an Optional alt-host).
- **When.** P3. **How.** Canary deploy captures the stable revision *before* traffic shift (INFRA-001);
  canary rollback targets that captured revision. Fail-closed admin-mutation auth (SEC-002).

---

## 5. Identity & secrets (Phase 0/1)

### 5.1 GCP Secret Manager + keyless OIDC — the secrets authority

- **What.** The one store for every provider credential and signing key.
- **Why.** Keyless OIDC eliminates long-lived secrets in CI/env/code — the SEC-001 remediation for the
  legacy credential sprawl. One store, audited access, rotation.
- **When.** P0, before any provider key exists. **How.** CI and Cloud Run assume identity via OIDC; no
  static keys. `heady-vault` package binds secrets at runtime. Rotation on a schedule; access in the
  data map (ADR-0008).

### 5.2 Firebase Auth — identity provider

- **What.** End-user and admin identity, tokens for rate-limit keying (ADR-0010).
- **Why.** Managed identity with broad protocol support; offloads the highest-risk security surface to
  a hardened provider. Chosen over Auth0/Clerk as the Source-of-Truth-declared identity authority.
- **When.** P1 (server-side verification) / P3 (portal sign-in). **How.** Tokens verified at the edge
  and origin; constant-time comparison and CORS allowlist (not `*`) in `security-mesh`.

---

## 6. AI / LLM providers (Phase 2–3)

The **Multi-Model Council**: competitive routing across providers with CSL-scored selection, every call
capped by token budget (ADR-0010) and attributed for FinOps (ADR-0012).

### 6.1 Anthropic Claude — primary reasoning

- **What.** Default reasoning/coding model for the agent loop and high-stakes generation.
- **Why.** Strongest reasoning + tool-use + long-context for the native coder-agent; default to the
  latest Claude (Opus 4.8 / Fable 5) for agent work. The agent loop's quality gate (ADR-0005) assumes a
  top-tier reasoner.
- **When.** P2 (eval harness) / P3 (native agent loop). **How.** Via a typed LLM adapter behind the
  router; never called directly from app code. Outputs go through plan→sandbox→PR→human approval
  (ADR-0005). Token budget per agent/tenant (ADR-0010).

### 6.2 Gemini, OpenAI, Groq, Cloudflare Workers AI — council members

- **What.** Alternative reasoners and latency-tier models for cost/latency/availability routing and
  provider failover.
- **Why.** Diversity buys failover (provider-failover-drill) and lets cheap/fast models take
  latency-sensitive or low-stakes work (Groq for fast inference, Workers AI for edge-local cheap calls).
  No single LLM vendor is load-bearing.
- **When.** P3. **How.** One router, one adapter interface; CSL confidence gating picks the model.
  Per-provider daily caps; a breached cap degrades to a cheaper model or cached answer rather than
  overspending (ADR-0010/0012).

### 6.3 Embedding router — Phase 2

- **What.** Generates embeddings for pgvector from a configurable provider (Workers AI or a hosted
  embedding API).
- **Why.** Embedding model choice should be swappable without touching the vector schema; the router
  isolates it. **When.** P2 with `memory-stream`. **How.** Provider behind the router adapter; embedding
  dimension pinned in the pgvector schema and changed only via expand/contract migration (ADR-0007).

### 6.4 Perplexity (Enterprise) — research authority

- **What.** Deep-research and competitive-intelligence calls (the many `heady-perplexity-*` skills).
- **Why.** Best-in-class sourced research for the deep-scan workflow and patent/competitor intel.
- **When.** P2 (research tooling). **How.** Via the research adapter; results are inputs to planning,
  never auto-applied to code (ADR-0005). ⏰ **Time-sensitive:** the Perplexity Enterprise ticket closes
  **~2026-06-16** — reply to enterprise@perplexity.ai with HeadyConnection Inc. / headyconnection.org /
  501(c)(3) letter to keep this tier.

---

## 7. Observability, supply chain & FinOps (running throughout)

### 7.1 OpenTelemetry (GenAI semconv) — tracing

- **What / Why.** Open, vendor-neutral traces for requests and LLM calls using the GenAI semantic
  conventions — portable signal that feeds SLOs without locking to one APM. **When.** P1 onward.
  **How.** PII scrubbed from attributes (ADR-0008); traces feed Sentry SLO-burn detection and Langfuse.

### 7.2 Langfuse — LLM observability

- **What / Why.** Prompt/response/eval observability and cost tracing for the council; open-source,
  self-hostable, purpose-built for LLM apps. **When.** P2. **How.** Feeds eval gates (ADR-0005) and the
  FinOps rollup (ADR-0012).

### 7.3 Sentry — SLO-burn alerting only

- **What / Why.** Error/SLO alerting — **burn-rate alerts only**, not a firehose (ADR-0011). One pager
  surface for the solo operator. **When.** P3. **How.** Fast-burn pages, slow-burn tickets; every alert
  carries a runbook link.

### 7.4 Supply-chain CI — gitleaks · TruffleHog · Semgrep · Trivy/Grype/Syft · Dependabot · mcp-scan

- **What / Why.** Open-source secret scanning, SAST, container/dependency CVE scanning, SBOM
  generation, dependency updates (3-day cooldown), and MCP-tool scanning. The supply chain is a primary
  attack surface for an agent that ships code (ADR-0005). **When.** P0, before code projection. **How.**
  Runs in CI from the canonical repo (ADR-0001); GitHub Actions pinned to **digests**, not tags.

---

## 8. Business & operations SaaS (mostly via MCP — ops-time, not build-blocking)

These are reached through connected MCP servers and used for running the company, not building the
runtime. They are introduced when the workflow needs them, each behind the same secret/cap discipline.

- **GitHub** (P0) — code host, CI, releases/provenance from the canonical repo only (ADR-0001).
- **Mercury** (ops) — banking/treasury; read for FinOps reconciliation, never auto-moves money.
- **Stripe** (P4) — payments/monetization; gated to when there is a product to charge for.
- **Linear** (ops) — issue/project tracking; the auto-extract-tasks workflow can file issues here.
- **Slack** (ops) — comms and the destination for SLO pages and the daily FinOps digest (ADR-0011/0012).
- **PandaDoc + Google Workspace (Drive/Gmail/Calendar)** (ops) — contracts/e-sign, docs, scheduling;
  supports the legal/IP track (patent assignments, TM licensing agreement).
- **Canva + Adobe Express/Acrobat** (P3 ops) — brand/design assets for `headyme-portal`; Adobe grants
  pending activation. Feeds the domain-branding-audit (Sacred Geometry as **defaults, not hard gates**).
- **Hugging Face** (P2) — model/dataset discovery and eval datasets for the embedding/eval work.
- **Drupal** (P4, **Optional**) — headless CMS *only if* a structured-content/web-publishing need is
  proven; integrates via JSON:API → auto-context CDC. Not baseline — 69 legacy mentions
  notwithstanding, it is opt-in behind a real content requirement.

---

## 9. Deferred & dropped (explicit non-use)

> **v2 correction (R2):** the rows below are updated to match the amendment banner at the top of this
> file. **Upstash Redis** and **Cloudflare Vectorize are now baseline (P2)** — Upstash as best-effort
> cache (TTL≤60s), Vectorize as the projector-populated derived edge cache. **Qdrant is DROPPED**
> (decommission the unused instance), not deferred.

**Baseline (P2), not deferred:**

- **Cloudflare Vectorize** — derived edge cache (Tier-5), populated only by the WAL→CDC projector
  (ADR-0014), reconstructible, dimension-locked 384. Never an authority.
- **Upstash Redis** — best-effort cache (T0/hot reads), TTL≤60s, marked "never authoritative" in code.

**Dropped:**

- **Qdrant** — provisioned but unused; decommission. Reintroduce a second vector engine only via the gate
  below.

**Deferred — Phase 4, evidence-gated** (flag + benchmark + rollback before adoption, ADR-0003/0013):

- **A second vector engine *as an authority*** (Qdrant / Vectorize-as-authority / Upstash-Vector DiskANN)
  — adopt only when a benchmark shows pgvector is the retrieval bottleneck.
- **Render / Vercel / Streamlit / Gradio** — alternate hosting. Cloud Run (writes) + Workers (edge) are
  baseline; Render/Vercel are Optional alt-hosts, Streamlit/Gradio acceptable for Python data
  dashboards that live in Colab and need no JS toolchain.
- **Temporal, Kafka/NATS** — external orchestration/broker. Cloudflare Workflows + pgmq cover the
  baseline; revisit only on a throughput/semantics gap.

**Dropped — do not build from** (ADR-0001): `HeadySystems/main`, `HeadySystems/Heady`,
`ai-workflow-engine` (archived); `*-core` projection shells returning `{"projected": true}` (fold into
monorepo or mark projection-only); the legacy auto-commit bot (replaced by ADR-0005 governance).

---

## 10. Phase-by-phase provider introduction matrix

Each phase adds **≤1 net-new platform** and retires a complexity source (ADR-0013). "Open-source work"
is logic Heady writes; "Provider wired" is managed capability turned on.

### Phase 0 — Containment & authority
- **Provider wired:** GitHub (canonical repo + org consolidation 4→1), **GCP Secret Manager** (keyless
  OIDC — the one new platform), supply-chain CI (gitleaks/TruffleHog/Semgrep/Trivy/Grype/Syft/mcp-scan).
- **Open-source work:** ADR set (done), `SOURCE_OF_TRUTH.md`, pinned-digest CI, `git filter-repo` purge.
- **Retires:** credential sprawl (SEC-001), org sprawl, false projection-readiness.

### Phase 1 — Backbone packages
- **Provider wired:** **Neon** (the one new platform — SoR + pgvector + pgmq + pg_cron), Firebase Auth
  (server-side verify).
- **Open-source work:** `phi-math`, `csl-engine`, `packages/contracts` (OpenAPI+Kubb+Zod), `packages/db`
  (Drizzle), `security-mesh`, `heady-vault`, OTel wiring.
- **Retires:** "architecture inferred from repo names" — contracts make it explicit.

### Phase 2 — Task ledger + memory
- **Provider wired:** embedding provider via router, **Perplexity** (research), Langfuse, Hugging Face
  (eval datasets). KV cache in front of reads.
- **Open-source work:** task ledger (`task`, `task_attempt`, `outbox`, reconciliation, idempotency —
  ADR-0006), `memory-stream` (pgvector TS schema), `auto-context` (WAL→projector CDC, ADR-0007).
- **Retires:** Python memory-server maximalism (ported to TS patterns); ad-hoc task tracking.

### Phase 3 — Apps & native agent loop
- **Provider wired:** **Cloudflare** (Workers/Workflows/Queues/DOs/R2 — the one new platform), **GCP
  Cloud Run** (write origin), the LLM council (Claude primary + Gemini/OpenAI/Groq/Workers AI), Sentry
  (SLO-burn), Canva/Adobe (branding).
- **Open-source work:** `api-gateway` (edge reads, origin writes, circuit-breaker library),
  `heady-manager` (route decomposition, standardized `PORT`), `heady-mcp-server` (Streamable HTTP,
  official MCP SDK, single transport, `mcp-tools.json`), `headyme-portal`, native agent loop
  (plan→sandbox→PR→human approval, eval gate, no auto-merge).
- **Retires:** projection-shell satellites; multi-transport MCP confusion.
- 🎯 Shipping `headyme-portal` on the verified domain unblocks the **Google for Startups** suspension.

### Phase 4 — Expand carefully (evidence-gated)
- **Provider wired (only on evidence):** Edge Code Mode / DO-per-session; optional 2nd vector engine (Qdrant/Vectorize-as-authority)
  projector; Stripe (monetization); Drupal (if a content need is proven).
- **Open-source work:** projectors and adapters behind feature flags with rollback paths.
- **Retires:** any baseline component the benchmark proves redundant.

### Running throughout (the operating system)
OTel GenAI semconv · Sentry SLO-burn alerts only (ADR-0011) · Langfuse · daily FinOps spend rollup
(ADR-0012) · monthly Neon restore drill (ADR-0009) · eval gates on every agent PR (ADR-0005) ·
rate-limit + token budgets (ADR-0010) · retention/erasure sweeps (ADR-0008).

---

## 11. Cross-cutting provider discipline

| Concern | Rule | ADR |
|---|---|---|
| Secrets | Every provider key in GCP Secret Manager via keyless OIDC; none in env/CI/code | SEC-001 / 0008 |
| Contracts | Every provider reached through a typed adapter validated against `packages/contracts` | 0002 |
| Write path | No provider writes the SoR except through the outbox | 0002 |
| Idempotency | Every provider-triggered mutation carries an idempotency key | 0006 |
| Rate/budget | Every provider call has a rate limit and (for LLMs) a token budget; fail-closed | 0010 |
| Cost | Every provider's spend appears in the daily FinOps rollup, attributed per tenant/agent | 0012 |
| Alerting | Provider failures page only on SLO burn, with a runbook | 0011 |
| Data | Provider-stored personal data has a retention class and honors erasure | 0008 |
| Exit | Every provider has a documented rollback/migration path; logic stays in OSS libraries | 0001/0013 |

---

## 12. Provider-risk & time-sensitive register

- ⏰ **Perplexity Enterprise** ticket closes **~2026-06-16** — reply to enterprise@perplexity.ai
  (HeadyConnection Inc. / headyconnection.org / 501(c)(3) letter) to retain the research tier (§6.4).
- **Google for Startups** suspended **2026-06-10** — needs a functional `headyme-portal` on the verified
  domain (Phase 3) to restore GCP credits underpinning Cloud Run / Secret Manager.
- **Adobe Express / Acrobat** grants **pending activation** — design tier blocked until activated (§8).
- **Patent assignments** — 51 provisionals list a never-formed "Heady Systems LLC"; assign to
  HeadySystems Inc.; non-provisional conversion deadline **2027-03-06** (legal track, via PandaDoc/Drive).
- **Trademark licensing** — agreement between HeadyConnection Inc. (owns "HEADY") and HeadySystems Inc.
  to avoid IRS private-inurement risk.
- **Operational hazard** — ~32 core dumps (~375 GB) on `~/` at 68% full; a legacy-tree watcher is likely
  crash-looping. Investigate and clear before scaling provider workloads (OPTIMAL §7).

---

## 13. Open-source vs managed — the decision rule

When a new capability is needed, decide in this order:

1. **Can an existing baseline provider/component already do it?** If yes, use it (one authority per
   concern). Stop.
2. **Is this Heady's differentiating logic?** If yes, build it open-source in `packages/*` behind an
   adapter. Never put differentiating logic in a vendor's proprietary glue.
3. **Is this undifferentiated operational burden** (HA, replication, edge POPs, secret rotation, auth)?
   Rent it managed — but only if it clears the ADR-0013 evidence gate (benchmark + flag + rollback) and
   adds ≤1 net-new platform this phase.
4. **Otherwise defer it.** Record the deferral here with the evidence that would unlock it.

> The steady-state shape: **a small set of open-source packages encoding Heady's behavior, projected
> onto a handful of managed providers, each replaceable behind a typed adapter, each capped, observed,
> and exitable.** Maximalism is the failure mode this plan exists to prevent.
