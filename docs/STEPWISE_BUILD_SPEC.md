# Heady-AI — Stepwise Build Specification

> **Status:** Draft for approval · **Date:** 2026-06-15 · **Owner:** Eric Anthony Haywood
> The complete, ordered specification of **every component to be built**, step by step, in dependency
> order. Each step: **Build** (what it is) · **Depends** (prerequisite steps) · **Details** (concrete
> implementation) · **Done** (acceptance criteria) · **Ref** (governing ADR/compendium). Read alongside
> `REBUILD_PLAN_V2.md` (phases), `docs/BUILD_NARRATIVE.md` (the why-in-order), and `docs/compendium/`
> (deep reference). Every gate is a **condition, not a clock**.

**Conventions.** Steps are `P.N`. "Flag" = ships behind a feature flag. All schema via Drizzle migrations
(expand→migrate→contract). All boundaries Zod-validated. All logs pino JSON. All secrets via
`heady-vault`→Secret Manager. φ constants from `phi-math` (no magic numbers).

---

# PHASE 0 — Containment & Authority

*Goal: one repo, one truth, no leaked secrets, enforced guardrails. New platform: GCP Secret Manager.*

### 0.1 Canonical repository & org consolidation
- **Build:** declare `Heady-AI` the single engineering monorepo; collapse 4 GitHub orgs → 1 (`HeadySystems`).
- **Depends:** —
- **Details:** record in `SOURCE_OF_TRUTH.md`; archive (not delete) legacy repos to preserve redirects; legacy `~/workspace/heady-ai` becomes a read-only migration source.
- **Done:** one org holds the canonical repo; archived repos tagged; `SOURCE_OF_TRUTH.md` merged.
- **Ref:** ADR-0001.

### 0.2 ADR set & governance docs
- **Build:** ADRs 0000–0018 reviewed; `SOURCE_OF_TRUTH`, `REBUILD_PLAN_V2`, `PROVIDER_AND_OSS_MASTER_PLAN`, compendium in place.
- **Depends:** 0.1
- **Details:** ADRs move Proposed→Accepted on founder sign-off (after `BUILD_NARRATIVE` reads true).
- **Done:** ADR index current; no ADR in conflict; founder approval recorded.
- **Ref:** ADR-0013; `docs/adr/README.md`.

### 0.3 Secret Manager + keyless OIDC  *(the one new platform)*
- **Build:** GCP Secret Manager as the only secret store; CI + Cloud Run authenticate via OIDC Workload Identity Federation.
- **Depends:** 0.1
- **Details:** no static keys anywhere; `heady-vault` (1.6) will bind at runtime; rotation schedule documented in the data map.
- **Done:** a probe service reads a secret via OIDC with zero static creds; `grep` finds no keys in repo/env/CI.
- **Ref:** SEC-001; ADR-0008.

### 0.4 Secret purge & key rotation
- **Build:** purge leaked creds from git history; rotate every key.
- **Depends:** 0.3
- **Details:** `git filter-repo` across legacy history; rotate DB/Cloudflare/OpenAI/Anthropic/etc.; import James's GPG public key (investor email).
- **Done:** history clean (gitleaks/TruffleHog pass on full history); all old keys invalid.
- **Ref:** B6 remediation matrix; ADR-0008.

### 0.5 Supply-chain CI
- **Build:** gitleaks + TruffleHog + Semgrep + Trivy/Grype/Syft (SBOM) + **Renovate** (primary) + Dependabot (security-only) + mcp-scan.
- **Depends:** 0.1
- **Details:** GitHub Actions pinned to **digests** not tags; Renovate regex-managers can bump `facts.yaml`; 3-day cooldown.
- **Done:** CI red on any planted secret/CVE/unpinned action; SBOM emitted per build.
- **Ref:** REBUILD_PLAN_V2 §13; compendium `06-G11`.

### 0.6 AGENTS.md hierarchy & anti-sprawl gates
- **Build:** root `AGENTS.md` + one-line `CLAUDE.md`; CI rule rejecting new top-level dirs without an ADR; "Do not create" list.
- **Depends:** 0.1
- **Details:** nearest-file-wins; explicit bans on new microservices / `lib`/`utils`/`helpers`/`common`.
- **Done:** CI fails a test PR that adds a top-level dir without an ADR.
- **Ref:** `06-G11`.

### 0.7 Inventory & cost baseline
- **Build:** `docs/inventory.md` (every repo/service/skill/org with traffic, cost, last-touched) + daily cost dashboards.
- **Depends:** 0.1
- **Details:** baseline spend captured before any new platform incurs cost.
- **Done:** inventory complete; cost rollup posting daily.
- **Ref:** ADR-0012; REBUILD_PLAN_V2 §13.

### 0.8 Stage 0 declaration (agent untouchables)
- **Build:** write down the artifacts the future coder-agent can never edit: eval harness, fidelity gate, `phi_circuit_breaker` thresholds, CODEOWNERS, Liquid Gateway, merge button.
- **Depends:** 0.6
- **Details:** path-glob list committed; CODEOWNERS-locked.
- **Done:** the untouchable path-glob exists and is referenced by 3.19/3.24.
- **Ref:** ADR-0016; `06-G8`.

### 0.9 Operational hazard cleanup
- **Build:** find the crash-looping process; clear ~32 core dumps (~375 GB).
- **Depends:** —
- **Details:** likely a legacy-tree watcher; disable it.
- **Done:** disk pressure resolved; no new dumps for 7 days.
- **Ref:** REBUILD_PLAN_V2 §15.

### 0.10 Monorepo tooling baseline
- **Build:** pnpm workspaces + Turborepo + Node 22 + ESM-strict tsconfig + ESLint 9 + Vitest 3 + husky + branch protection + CODEOWNERS.
- **Depends:** 0.1
- **Details:** `turbo.json` task graph (build/lint/test/security:scan); workspaces `apps/ packages/ tooling/ configs/`.
- **Done:** `pnpm i && pnpm turbo build` green on an empty scaffold; branch protection on `main`.
- **Ref:** ADR-0001; R5.

---

# PHASE 1 — Backbone Packages

*Goal: the spine everything hangs on. New platform: Neon (Postgres+pgvector+pgmq+pg_cron).*

### 1.1 `phi-math`
- **Build:** the golden-ratio constants & helpers (φ, ψ, Fibonacci, φ-backoff, φ-pool sizing).
- **Depends:** 0.10
- **Details:** exports all `SACRED CONSTANTS` (`01-laws-and-constants.md` §C); pure, no deps.
- **Done:** unit-tested constants; consumed by csl-engine/db/gateway.
- **Ref:** `01`; ADR set "zero magic numbers."

### 1.2 `csl-engine`
- **Build:** Continuous Semantic Logic gates (AND/OR/NOT/GATE/IMPLY/CONSENSUS/ANALOGY) + threshold ladders.
- **Depends:** 1.1
- **Details:** 384-D quick / 1536-D full; routing cuts (HALT<.382 / CAUTIOUS / EXECUTE≥.618) + privileged-action ladder; adaptive temperature `T=ψ^(1+2(1−H/Hmax))`. **Relevance gating only, never ranking.**
- **Done:** gate functions unit-tested against known vectors; deterministic.
- **Ref:** `01-G`, `06-G2`; R6.

### 1.3 `packages/contracts`
- **Build:** OpenAPI spec → **Kubb** → TS types + Zod validators + `mcp-tools.json`; includes `@heady/mcp-contracts` shapes.
- **Depends:** 0.10
- **Details:** spec is authoritative; CI fails on drift between spec and generated artifacts; generated files carry `// AUTOGENERATED`.
- **Done:** `pnpm gen && git diff --exit-code generated/` clean; drift test red on hand-edit.
- **Ref:** ADR-0002; `06-G11`.

### 1.4 `packages/db`
- **Build:** Drizzle schema + migrations on **Neon** (the new platform); pgvector, `pgmq` outbox, `pg_cron`, `wal_level=logical`.
- **Depends:** 1.1, 0.3
- **Details:** direct endpoint (not pooler) for replication; slot heartbeat `pg_logical_emit_message()`; expand→migrate→contract discipline; HNSW (m=16, ef_construction=200).
- **Done:** migrations apply/rollback; outbox insert+consume round-trips in one tx; restore-drill script runs.
- **Ref:** ADR-0002/0003/0007/0014.

### 1.5 `security-mesh`
- **Build:** the boundary-security package: CORS allowlist (not `*`), constant-time token compare, Zod validation at every entry.
- **Depends:** 1.3
- **Details:** middleware armor; max payload 1MB; no eval/template-injection; parameterized queries only.
- **Done:** rejects bad origin/oversized/invalid payloads in tests.
- **Ref:** `06-G3`, `09-I5`.

### 1.6 `heady-vault`
- **Build:** runtime Secret Manager bindings.
- **Depends:** 0.3
- **Details:** resolves secrets via OIDC at boot; never logs values; fails closed on missing secret.
- **Done:** services boot with zero static keys; missing-secret test fails closed.
- **Ref:** ADR-0008; SEC-001.

### 1.7 OpenTelemetry (GenAI semconv)
- **Build:** tracing wired into every package; GenAI semantic conventions for LLM calls.
- **Depends:** 1.8
- **Details:** PII scrubbed from attributes; feeds Sentry SLO + Langfuse (2.12); `LangfuseSpanProcessor`.
- **Done:** traces visible end-to-end with scrubbed attributes.
- **Ref:** ADR-0011; `09-I3`.

### 1.8 `logger` (pino)
- **Build:** structured-JSON logger singleton with redaction, serializers, `X-Heady-Trace-Id` middleware (Express + Hono).
- **Depends:** 0.10
- **Details:** never `console.*` (Law 2); trace id threaded through all phases.
- **Done:** lint bans `console.*`; trace id present on every log line.
- **Ref:** Law 2; `01-L2`.

### 1.9 Module-boundary tooling
- **Build:** `eslint-plugin-boundaries` + `dependency-cruiser --validate` + `api-extractor`.
- **Depends:** 0.10
- **Details:** forbid `@core/<m>/internal/*` imports; fail forbidden edges; fail public-API change lacking ADR+contract bump; commit module-graph SVG to `docs/architecture.md`.
- **Done:** a forbidden cross-internal import fails CI.
- **Ref:** `06-G11`.

### 1.10 Firebase Auth (server-side verify)
- **Build:** identity verification at edge + origin.
- **Depends:** 1.5
- **Details:** `firebase-auth-cloudflare-workers` (WebCrypto) at edge; admin verify at origin; tokens key the rate-limiter.
- **Done:** valid token passes, invalid/expired rejected; constant-time compare.
- **Ref:** SoT identity; ADR-0010.

---

# PHASE 2 — Task Ledger & Memory

*Goal: the first living bounded context + the memory spine. Mostly open-source work on the P1 backbone.*

### 2.1 Task ledger
- **Build:** `task`, `task_dep`, `task_attempt`, `task_outbox` + idempotency table; enqueue inserts task+outbox in one tx.
- **Depends:** 1.4
- **Details:** idempotency key on every mutation (client-supplied inbound, derived internal); status machine PENDING→…; per-task serialization via SQL lock or DO lane.
- **Done:** enqueue→run→retry→audit end-to-end with no external calls; replayed key returns stored result.
- **Ref:** ADR-0006; `09`/Heady_Task_Man_Sys.

### 2.2 Outbox consumer + Queue
- **Build:** Cloudflare Queue `tasks-fanout` + consumer dispatching inline / Workflow / Cloud Run Job per kind.
- **Depends:** 2.1, (3.1 edge — may stub locally first)
- **Details:** at-least-once; idempotent consumers; dead-letter handling.
- **Done:** outbox rows drain to handlers exactly-once (effectively); DLQ on poison.
- **Ref:** ADR-0002/0006; `07-T8`.

### 2.3 Linear sync contract
- **Build:** outbox mirror to Linear (issue/state).
- **Depends:** 2.1
- **Details:** never direct API from business logic — only via outbox row + webhook handler.
- **Done:** task state changes appear in Linear; failures retried via outbox.
- **Ref:** `09`; provider plan.

### 2.4 Sentry feedback contract
- **Build:** task/agent feedback → Sentry (SLO-burn only).
- **Depends:** 2.1
- **Details:** `release=git SHA`; Seer auto-grouping feeds the optimization loop (3.x/G10).
- **Done:** errors grouped by release; no firehose alerting.
- **Ref:** ADR-0011; `06-G10`.

### 2.5 `packages/embedding` — pipeline + instantaneous-acquisition ruleset
- **Build:** the embedding pipeline (`@heady/embedding`): locked embedder, content-addressed dedup,
  significance gate, idempotent `embedding_jobs` outbox, `HCEmbedPipeline` workflow, and the tiered
  `acquireEmbedding()` read path (KV→Vectorize→pgvector). **Status: scaffolded — pure core implemented
  + tested (8/8), platform edges authored.**
- **Depends:** 1.4
- **Details:** lock `@cf/baai/bge-small-en-v1.5` 384-D/mean (immutable after first ingest); every row
  carries `embedding_model_version`; the 8 acquisition rules (embed-on-write, dedup, significance,
  idempotent, lock, write-through-warm, tiered-acquire, reconstructible).
- **Done:** core rules unit-tested (`node --test`, 8/8 ✅); embeds at 384-D/mean; startup asserts config;
  mismatch fails closed; dedup hit short-circuits; acquire never embeds.
- **Ref:** **ADR-0024**, ADR-0003/0014/0015; `04-M2/M4`; `packages/embedding/README.md`.

### 2.6 `memory-stream` schema
- **Build:** `events` (episodic, append-only, partitioned), `facts` (semantic), `skills` (rows→handlers), `memory_blocks` (Letta), `tombstones`, `eval_results`, `adr_index`.
- **Depends:** 1.4, 2.5
- **Details:** CoALA mapping; `embedding vector(384)`, `content_hash`, generated `tsvector`.
- **Done:** schema migrated; CRUD + embed round-trips.
- **Ref:** ADR-0003; `04-M3`.

### 2.7 Bi-temporal facts + mem0 arbiter
- **Build:** Zep/Graphiti bi-temporal model in Postgres (two timestamp pairs + `invalidated_by_event_id`); mem0 ADD/UPDATE/DELETE/NOOP (conservative LLM arbiter).
- **Depends:** 2.6
- **Details:** no Neo4j/FalkorDB; Park recency×importance×relevance scoring.
- **Done:** fact supersession works; arbiter chooses correctly on a test set.
- **Ref:** `04-M3`.

### 2.8 `auto-context` projector (WAL→CDC)
- **Build:** Node `pg-logical-replication` (`pgoutput`) consumer → derived stores; change-significance filtering.
- **Depends:** 1.4, 2.6
- **Details:** projector→derived only (never back to SoR); each projected record carries metadata; no Kafka/Debezium.
- **Done:** SoR write propagates to derived store; metadata-only diffs skipped.
- **Ref:** ADR-0014.

### 2.9 Vectorize derived cache + drift checks
- **Build:** Cloudflare Vectorize 384-D index populated only by the projector; 3 drift checks.
- **Depends:** 2.8
- **Details:** dimension immutable; `rebuild:vectorize --from-postgres`; checks = count parity, PK-sample content_hash, frozen-Q retrieval canary.
- **Done:** cache rebuildable from SoR; drift checks page on injected mismatch.
- **Ref:** ADR-0003 (amended)/0014; R2.

### 2.10 Retrieval stack
- **Build:** hybrid retrieval — pgvector HNSW + GIN tsvector (+ pg_trgm) fused via RRF (k=60) in one SQL CTE + reranker.
- **Depends:** 2.6, 2.9
- **Details:** reranker = Cohere v3.5 / bge-reranker-v2-m3 / LFM2-ColBERT; HyDE opt-in low-confidence; CRAG gating; retriever exposed as an MCP tool.
- **Done:** hybrid beats pure-vector on a golden set; reranker improves recall@k.
- **Ref:** `04-M4`.

### 2.11 AutoContext 5-pass middleware
- **Build:** intent-embed → memory-retrieval (top-21, τ=ψ²) → recipe-retrieval → knowledge-grounding → compression → confidence.
- **Depends:** 2.10, 1.2
- **Details:** "nothing executes without AutoContext"; recipe fast-path (Tier-3 ≥ψ → EXECUTE).
- **Done:** every reasoning call passes through it; confidence gate routes EXECUTE/CAUTIOUS/HALT.
- **Ref:** `04-M2`.

### 2.12 Langfuse + eval harness + CI gates
- **Build:** Langfuse (self-host) + `eval-results.json` + trailing-median drift + CI thresholds.
- **Depends:** 1.7
- **Details:** regression 100% pass; exploration median ≤2% drop; cost/trace +10% max; p95 +15% max; tool-call conformance 100%; run 3× median; judge ≠ agent family.
- **Done:** eval gate blocks a regressing PR; dashboards live.
- **Ref:** ADR-0011; `06-G11`.

### 2.13 Decommission Qdrant
- **Build:** switch off the unused Qdrant instance.
- **Depends:** 2.9 (Vectorize cache proven)
- **Details:** confirm no reads; remove from failover matrix.
- **Done:** Qdrant off; retrieval unaffected.
- **Ref:** R2; ADR-0003 amended.

---

# PHASE 3 — Apps, MCP Console & Native Agent Loop

*Goal: a usable face, a model mesh, and a supervised coding apprentice. New platform: Cloudflare edge.*

### 3.1 Cloudflare edge tier  *(the new platform)*
- **Build:** Workers + Workflows + Queues + Durable Objects + R2.
- **Depends:** 1.x
- **Details:** DO-per-session (10GB SQLite, WebSocket Hibernation); Worker→Cloud Run via Access service tokens; Smart Placement; selective checkpointing.
- **Done:** a Workflow runs a multi-step job with durable resume; DO holds session state.
- **Ref:** ADR-0004; `09-I1`.

### 3.2 AI Gateway chokepoint
- **Build:** Cloudflare AI Gateway as the single LLM/embedding egress.
- **Depends:** 3.1
- **Details:** SHA-256 exact-match cache; per-tenant/model budgets; mid-stream failover; DLP; semantic cache default-OFF; failover-to-direct on gateway outage.
- **Done:** all provider traffic flows through it; cache hits logged; budget cap enforced.
- **Ref:** ADR-0018; ADR-0010/0012.

### 3.3 Liquid Gateway routing + model adapters
- **Build:** route-class router (`class=reason|longctx|cheap|embed|voice`) over the 9-tier provider mesh.
- **Depends:** 3.2, 1.2
- **Details:** Liquid = edge tier; frontier reserved for reason/longctx; routing formula with budget_factor sigmoid; `phi_circuit_breaker` home; LiteLLM/Portkey/OpenRouter behaviors; normalize LFM2 tool tokens.
- **Done:** a route name resolves to a provider; budget steers under load; breaker trips on P99/error.
- **Ref:** ADR-0018; `05`.

### 3.4 `api-gateway`
- **Build:** edge reads, origin writes; circuit-breaker as a library.
- **Depends:** 3.1, 1.5
- **Details:** reads served at Worker; writes to Cloud Run (owns Neon); rate-limits at edge (ADR-0010), fail-closed.
- **Done:** read path never hits origin; write path idempotent; limiter fail-closed.
- **Ref:** ADR-0004/0010.

### 3.5 `heady-mcp-server` core
- **Build:** Express + MCP SDK Streamable HTTP on Cloud Run (port 3310); full tool surface.
- **Depends:** 3.3, 1.3
- **Details:** OAuth resource server (bearer→principal); **confused-deputy policy gate** `authorize(principal,tool)`; **6 permission groups**, ~47 tools; `/mcp`, `/manifest`, `/healthz`, `/.well-known`; tenant-namespaced stores.
- **Done:** tool calls authorized per-principal; deploy-class tools gated; manifest validates against contract.
- **Ref:** ADR-0005; `06-G3`; `08-S1`.

### 3.6 `@heady/mcp-contracts`
- **Build:** shared Zod shapes (Connector/Provenance/PermissionGroup/McpTool/ServerManifest/ConsoleSummary).
- **Depends:** 1.3
- **Details:** imported by both UI and servers; `heartbeatMs=29034`.
- **Done:** one contract; UI + server compile against it.
- **Ref:** ADR-0002; `06-G7`.

### 3.7 Projection-shell template
- **Build:** Hono Worker template — `/manifest` (`projection_only`+provenance) + `/healthz` + optional attenuated proxy.
- **Depends:** 3.6
- **Details:** build-time provenance stamp (real git hash); no DB.
- **Done:** a cloned shell reports truthful manifest; console renders its verdict.
- **Ref:** ADR-0017; `06-G7`.

### 3.8 Projections engine
- **Build:** Copybara (history) + Node projector (hashing, drift, manifest, deploy) + 15-min drift cron.
- **Depends:** 3.7
- **Details:** one-way derivation; SHA-256 tree hash; `projection.yaml` JSON-Schema; drift states in-sync/source-ahead/projection-ahead(page+freeze); patent-strip via `.headyignore`+`private_paths`+`HEADY-INTERNAL` regions; six-state lifecycle.
- **Done:** a monorepo change re-projects; injected projection-ahead pages + freezes.
- **Ref:** ADR-0017; `06-G7`.

### 3.9 MCP Console UI
- **Build:** the design-zip realized — single-route honeycomb console (HexCell/ToolRow/StatusDot/Switch/Tabs).
- **Depends:** 3.6
- **Details:** φ tokens (teal/violet, Space Grotesk + JetBrains Mono, Fibonacci spacing, 29034ms pulse); state model (incl. first-class `token_expired`, `projection_only`); per-session enable/disable; deploy-class flag. **R1:** React+Vite (complexity earns it).
- **Done:** renders all states against sample data; reduced-motion safe.
- **Ref:** `09-I6`; design brief.

### 3.10 Connector registry + health probes
- **Build:** Worker resolving the 15 connectors, probing on the 29034ms heartbeat, resolving real vs projection from the manifest.
- **Depends:** 3.7, 3.9
- **Details:** emits `Connector`/`ConsoleSummary`; renders `real_service` vs `projection_only` at runtime.
- **Done:** console shows live health for all connectors; verdicts match manifests.
- **Ref:** design brief Part C; `06-G7`.

### 3.11 OAuth/token lifecycle
- **Build:** per-server OAuth init, token store/refresh, `authExpiresAt` computation.
- **Depends:** 3.10, 1.6
- **Details:** tokens/secrets from Secret Manager, never client; drives `token_expired` → one-tap re-authorize.
- **Done:** expiry fires the UI state; re-authorize restores connection.
- **Ref:** design brief; ADR-0008.

### 3.12 `heady-manager` decomposition
- **Build:** port legacy manager into `core/modules/*` route files; standardize `PORT` (3300).
- **Depends:** 1.x
- **Details:** characterization tests from intended behavior (no live shadow — pre-launch); modular routers.
- **Done:** health/admin/registry routes pass tests inside the monolith.
- **Ref:** REBUILD_PLAN_V2 §2/§13.

### 3.13 `headyme-portal`  *(the spearhead)*
- **Build:** the portal on the verified `headyme.com` domain.
- **Depends:** 3.9, 1.10
- **Details:** Firebase-auth'd; hosts the console/onboarding; ships to unblock the Google for Startups suspension.
- **Done:** live on verified domain; auth works; suspension-unblock criteria met.
- **Ref:** REBUILD_PLAN_V2 §13; `10`.

### 3.14 Coder module (agent loop)
- **Build:** `core/modules/coder/` — Vercel AI SDK v6 `streamText({tools,stopWhen,prepareStep})` against the Liquid Gateway; wrapped in Cloudflare Workflow `HCCoderRun`.
- **Depends:** 3.3, 3.5
- **Details:** model = a route; **Claude Agent SDK rejected as harness** (one MCP tool only); `prepareStep` routes models mid-loop; `step.waitForEvent` = approval gate; public surface = `planTask`/`runTask`; ADR before code.
- **Done:** loop plans + executes a trivial task in sandbox, pauses at approval.
- **Ref:** ADR-0016; `06-G8`.

### 3.15 GitHub App `blocksorg` + token minter
- **Build:** GitHub App + Cloud Run token minter (1-hour downscoped installation tokens).
- **Depends:** 0.3
- **Details:** perms `contents/pull_requests/workflows/checks:write`, `actions:read` — **never** `administration`/`secrets`; key only in Secret Manager; minter is the only thing touching it; tokens revoked at task end.
- **Done:** minter returns a scoped token for a probe; revocation works.
- **Ref:** ADR-0016.

### 3.16 Cloudflare Sandboxes + Outbound Workers
- **Build:** Sandbox DO binding; **Outbound Worker holds credentials** (sandbox never sees token/key); `allowedHosts` allowlist-only.
- **Depends:** 3.1, 3.15
- **Details:** one sandbox per (org,branch,PR-run); HTTPS interception on; escape hatch = Cloud Run Jobs for >30min/GPU/VPC.
- **Done:** sandbox runs git+build+test with creds injected only at egress; non-allowlisted host blocked.
- **Ref:** ADR-0016; `06-G8`.

### 3.17 `dev_loop` tool + fidelity gate
- **Build:** MCP tool `dev_loop({repo,branch,commands})`; runs install/build/test/lint/eval inside the sandbox.
- **Depends:** 3.16, 2.12
- **Details:** runs the **same fidelity-gate eval harness** humans pass; publishes a `coder-fidelity-gate` Check Run signed only by `blocksorg`.
- **Done:** tool returns structured run result; Check Run reflects eval verdict.
- **Ref:** ADR-0016; `06-G8`.

### 3.18 Front-end agent shell
- **Build:** assistant-ui `<Thread/>` + Cloudflare `agents` SDK (`AIChatAgent` DO) + per-tool `makeAssistantToolUI`; diffs via `@git-diff-view/react`; terminal via xterm.js over the DO WS; PR approval card via `needsApproval`.
- **Depends:** 3.14, 1.10
- **Details:** Firebase ID token verified in `onBeforeConnect`; resumable streams; **R1** React/Vite. Web IDE deferred.
- **Done:** a session streams, shows tool timeline + diff + terminal, and an approve/reject card.
- **Ref:** ADR-0016; `07-T6`.

### 3.19 Three-layer CSL gate + branch protection
- **Build:** GitHub (branch protection + CODEOWNERS; app not a code owner) + CI (fidelity Check Run) + Workflow (`waitForEvent`).
- **Depends:** 3.17, 0.8
- **Details:** dismiss-stale-approvals; require-approval-of-most-recent-push; restrict push to default; **no "approve all" anywhere**.
- **Done:** each layer independently blocks a merge in a test.
- **Ref:** ADR-0016; `06-G8`.

### 3.20 `phi_circuit_breaker` + kill switch
- **Build:** breaker outside the LLM loop + `heady.coder.enabled` flag + per-task `abandon`.
- **Depends:** 3.14
- **Details:** trips on cost ceilings, eval drift, error spike, tool-call-rate anomaly, tool-desc hash drift, unallowlisted egress, judge-score drop >2σ, anomalous file-touch; abandon revokes token + tears down sandbox; drilled on schedule.
- **Done:** each trip condition halts the loop + writes an audit row; kill switch verified on a schedule.
- **Ref:** ADR-0016; `06-G8`.

### 3.21 HCP approval system
- **Build:** Hono-on-Workers approval API + machine-readable records (ULID, state machine, Ed25519 signed receipts) + OPA/Rego (CI `opa eval` + runtime opa-wasm) + GitHub Deployment Protection Rules + φ-canary.
- **Depends:** 3.1, 1.4
- **Details:** HCP template gates **deploys** not just merges; `required_count:=2 if patent_locked`; canary 5/25/50/100 with φⁿ soak; nightly audit-replay re-verifies signatures.
- **Done:** a deploy requires a valid signed approval; OPA denies an out-of-policy change in CI and runtime identically.
- **Ref:** `06-G6`; Eng_Playbook §6.

### 3.22 Sentry SLO-burn alerting
- **Build:** SLOs per user-facing surface; burn-rate alerts only.
- **Depends:** 1.7, 2.4
- **Details:** fast-burn pages, slow-burn tickets; every alert carries a runbook; no raw-threshold pages.
- **Done:** an injected burn pages with a runbook link; CPU spike does not page.
- **Ref:** ADR-0011.

### 3.23 Consistency engine (MAPE-K)
- **Build:** `heady consistency` CLI — Monitor→Analyze→Plan→Execute over `facts.yaml`.
- **Depends:** 1.9, 2.12
- **Details:** drift types docs/config/manifest/stale/orphan/duplicate; knip + dependency-cruiser + syncpack + ls-lint + lychee; severity→CI (info/warn/error-opens-PR/blocking); self-healing PR batching ≤5/day, escalate after ⌈φ²⌉=3.
- **Done:** an injected drift opens a fix PR; blocking drift fails the build.
- **Ref:** `06-G10`; Eng_Playbook §5.

### 3.24 Stage 1 agent activation
- **Build:** turn on the apprentice with the scope allowlist (docs, new tests, small typed refactors) + Writer/Reviewer.
- **Depends:** 3.19, 3.20, 0.8
- **Details:** 3-layer enforcement (Outbound allowlist + token narrowing + `submit_pr` path-glob refusal); separate cleared-context reviewer run before PR opens; every turn → Langfuse trace + signed `Co-authored-by`.
- **Done:** agent opens a docs/test PR that passes all gates; an out-of-scope attempt is refused at all 3 layers.
- **Ref:** ADR-0016; `06-G8`.

---

# PHASE 4 — Expand Carefully (evidence-gated)

*Goal: earn trust, earn revenue. Every step needs a benchmark + flag + rollback before it ships.*

### 4.1 Stage 2 agent unlock
- **Build:** allow the agent to edit prompt templates / non-critical MCP tools / router heuristics.
- **Depends:** 3.24
- **Details:** unlock **only** when ALL hold: stage1 first-try eval ≥ bar; zero breaker trips; zero allowlist violations; fixed-point eval ≥ immutable baseline; one human-signed ADR naming exact new scope. Stage 0 stays untouchable forever. Not multi-agent, not infra autonomy.
- **Done:** conditions verified on the trailing window; ADR signed; scope expanded by exactly the named paths.
- **Ref:** ADR-0016; `06-G8`.

### 4.2 IRS Form 990 Parser (beachhead)
- **Build:** ParserBee service on Cloud Run — high-performance 990 XML translation.
- **Depends:** 3.x
- **Details:** first revenue vertical; output embedded + receipted.
- **Done:** parses real 990 filings to structured output; first pilot users onboarded.
- **Ref:** `10-B1`.

### 4.3 PHI compliance layer + sovereign DB
- **Build:** PHI anomaly gate + single-tenant sovereign DB + KV audit trails + governance bees.
- **Depends:** 4.2, ADR-0008 data map
- **Details:** 0% PHI transit leak; <50ms audit retrieval; CSL ≥0.70 RBAC; residency per CLOUD Act.
- **Done:** PHI markers quarantined before external inference; audit trail complete.
- **Ref:** `10-B2`; `06-G11`.

### 4.4 Billing — Stripe + reserve-commit + tiers
- **Build:** reserve-commit pattern at the gateway + per-thought micro-transactions + Fibonacci tiers (Seed $89 / Grow $233 / Scale $610) via Stripe.
- **Depends:** 3.2 (budgets), 4.2
- **Details:** out-of-band reservation, commit on completion; `Cost=BaseRate×φ^intensity`.
- **Done:** a multi-step job reserves then commits exact cost; tiers enforce limits.
- **Ref:** `10-B3/B4`; ADR-0012.

### 4.5 MIDI & creative studio
- **Build:** midi-event-bus + network-midi (RTP-MIDI over UDP) + creative-bee + edge-diffusion + sonification.
- **Depends:** 3.1
- **Details:** φ-scaled CC maps/velocity curves; Ableton remote script; CSL-gated creative params; outputs embedded; RTP-MIDI recovery journal.
- **Done:** MIDI in→event→RTP-MIDI out to a DAW; image/music generation works; state sonified.
- **Ref:** `07-T1/T2/T3`.

### 4.6 Edge Code Mode / DO-per-session
- **Build:** Cloudflare Code Mode (search()+execute() JS sandbox) to collapse large tool surfaces; DO-per-session deepening.
- **Depends:** 3.5
- **Details:** keep tools <~30/server; behind flag + benchmark.
- **Done:** large tool surface collapsed without losing capability; benchmark shows latency/cost win.
- **Ref:** ADR-0004; REBUILD_PLAN_V2 §13.

### 4.7 Second vector engine (only if proven)
- **Build:** Qdrant/Vectorize-as-authority or Upstash-Vector-DiskANN.
- **Depends:** benchmark proving pgvector is the bottleneck
- **Details:** flag + rollback; dual-write migration.
- **Done:** benchmark justifies it; rollback path tested. *(Default outcome: not built.)*
- **Ref:** ADR-0003; R2.

### 4.8 PQC transition
- **Build:** ML-DSA-65 / ML-KEM-768 / SLH-DSA alongside Ed25519 (dual-sign).
- **Depends:** ecosystem readiness
- **Details:** sign with both, verify either; never a flag-day swap; future PQC-transition ADR.
- **Done:** receipts dual-signed; verifiers accept both; rollback to Ed25519-only possible.
- **Ref:** R3; `06-G9`.

### 4.9 Multi-region & cross-region state
- **Build:** multi-region Cloud Run + Azure Cosmos cross-region session state.
- **Depends:** 3.x, evidence of need
- **Details:** session consistency; failover.
- **Done:** region failover preserves sessions.
- **Ref:** `09-I3`; REBUILD_PLAN_V2 §13.

### 4.10 Fintech vertical
- **Build:** TraderBee/BacktestBee + trading-compliance (Apex rules) + risk models.
- **Depends:** 4.4
- **Details:** compliance-gated; backtests validated.
- **Done:** signals + risk models pass compliance checks.
- **Ref:** `02` domain 8; `08` business verticals.

### 4.11 Visual computing
- **Build:** ProjectionBee 3D logic-gate visualization + Logic Visualizer + HeadyFS 3D UMAP.
- **Depends:** 2.x memory
- **Details:** UMAP coords precomputed as a derived projection; interactive 3D.
- **Done:** memory navigable in 3D; CSL decisions visualized.
- **Ref:** `07-T5`.

### 4.12 Drupal content sites (optional)
- **Build:** Drupal 11 + Twig + Vanilla content sites; JSON:API → auto-context CDC.
- **Depends:** 2.8
- **Details:** only if a structured-content need is proven; dependency-minimal (no build step).
- **Done:** content indexes into vector memory; sites live.
- **Ref:** `09-I7`; R1.

---

# Running throughout (always-on, from Phase 1)

| Component | Step it starts | Spec |
|---|---|---|
| OTel tracing | 1.7 | scrubbed GenAI semconv |
| pino logging | 1.8 | Glass Box, no `console.*` |
| Eval gates on every agent PR | 2.12 | regression 100%, 3× median |
| Daily FinOps rollup | 0.7→ongoing | spike pages in ≤24h (ADR-0012) |
| Monthly Neon restore drill | 1.4→ongoing | measured RTO/RPO (ADR-0009) |
| Rate-limit + token budgets | 3.4/3.2 | fail-closed (ADR-0010) |
| Retention/erasure sweeps | 1.4 `pg_cron` | TTL + right-to-erasure (ADR-0008) |
| Projection drift cron | 3.8 | 15-min, page+freeze |
| Consistency MAPE-K loop | 3.23 | daily 03:14 / weekly 16:18 |
| `phi_circuit_breaker` | 3.20 | bounds the agent loop |

---

# Acceptance ladder (how "done" rolls up)

1. **Component done** = its Done criteria pass + eval slice green + ADR (if new bounded context).
2. **Phase done** = all steps done + the phase retired ≥1 complexity source + ≤1 net-new platform added.
3. **Build done** = Phase 4 verticals shipping behind evidence gates, agent at Stage 2, beachhead earning,
   and `BUILD_NARRATIVE.md` reads true end to end.

> Every gate above is a **condition, not a clock** (ADR-0013). Sequence the bets; parallelize only the
> execution inside a step.
