# Heady-AI — Optimal Rebuild Plan v2

> **Status:** Draft for approval · **Date:** 2026-06-15 · **Owner:** Eric Anthony Haywood
> **Supersedes** `OPTIMAL_REBUILD_PLAN.md` (v1). v1 synthesized 4 dropzone reports; v2 folds in the
> full `~/Heady/dropzone` corpus of AI-chat reports (see §16) plus the **Heady MCP Console design
> system** (the admin-UI zip). Governed by `SOURCE_OF_TRUTH.md` and ADRs 0001–0013. Where v2 changes a
> prior decision, §14 lists the exact ADR/provider-plan amendments required.

---

## 0. What changed in v2 (changelog vs v1)

v1's backbone holds. v2 adds the detail the newer reports supply and corrects three things:

1. **Premise correction — it's pre-launch.** Nothing is in production use by anyone but the founder.
   The elaborate strangler-fig / live-shadow / Scientist-diff machinery in the reports is built for
   migrating *live* traffic; here it **collapses to "port → characterization tests → flag-flip"** with
   no live shadow needed. This materially de-risks and speeds the consolidation (§2).
2. **Store reconciliation settled** (the one real conflict). pgvector stays the sole retrieval
   authority; **Vectorize is demoted to a derived edge cache** (reconstructible, never authoritative);
   **Qdrant is dropped** (absent from the latest five-tier synthesis, unused, free to decommission);
   Redis/KV are best-effort TTL≤60s. This refines ADR-0003 rather than overturning it (§4, §14).
3. **Five concrete subsystems now have implementation-grade specs** that v1 only named:
   the five-tier reference architecture (§3), the Liquid model gateway (§5), the memory/retrieval layer
   (§6), the native agent loop with a rustc-style bootstrap (§7), and the MCP services + Console admin
   UI (§8). Plus the projections engine + consistency engine + approval system (§10), CI-enforced
   anti-sprawl governance (§11), and the business/product layer (§12).

Everything in v2 is grounded in a dropzone report; §16 maps each section to its source.

---

## 1. Backbone (unchanged from v1 — do not reopen)

Modular monolith, strict bounded contexts · **Neon Postgres = single system of record** · transactional
outbox = the only cross-boundary write · **OpenAPI-first contracts** (Kubb → types/Zod/`mcp-tools.json`,
CI drift-fail) · **one durable orchestration surface** (Cloudflare Workflows + Queues + Durable
Objects) · **pgvector = single retrieval authority**. The newest report (`heady-liquid-latent-os`)
independently re-derives this exact backbone and explicitly **rejects RAM-first/latent-as-truth** —
"derived stores must be reconstructible from the system of record." v1 and the corpus agree.

---

## 2. Premise: pre-launch greenfield (the key simplifier)

> Confirmed by the founder: nothing is consumed by users other than him; it was always "internal until
> functional." There is **no live traffic to shadow and no production data to migrate.**

Consequence for the consolidation method. The reports prescribe the full Fowler/Newman migration kit
(StranglerFig, Parallel Run + GitHub-Scientist diff, Branch-by-Abstraction, Characterization Tests,
Anti-Corruption Layer, edge Worker as routing seam). **Pre-launch, most of that is unnecessary cost:**

| Report technique | v2 disposition (pre-launch) |
|---|---|
| Edge Worker pass-through in front of live origins | **Skip.** No live origins to front. Edge router is built fresh in Phase 3. |
| Parallel Run + Scientist shadow-diff vs legacy | **Skip.** No production to compare against. |
| Anti-corruption proxy to live legacy service | **Skip.** Port logic directly into the monolith module. |
| Characterization (golden) tests from prod traffic | **Keep, reframed.** Author tests from the legacy *code's* intended behavior, not captured traffic. |
| `git filter-repo` history import per package | **Keep selectively.** Only for packages whose history is worth preserving (e.g. `heady-manager`). |
| Feature flags + expand-migrate-contract | **Keep.** Cheap, and they pay off the moment there *are* users. |

Net: the migration is a **port-and-verify**, not a live cutover. Sequence the bets (ADR-0013); each
bounded context is ported, tested, flagged, and merged.

---

## 3. Target reference architecture — five tiers

The corpus converges on a five-tier shape. This is the canonical target; the phase plan (§13) builds it
bottom-up.

- **Tier 1 — Edge (Cloudflare Workers).** DNS/TLS, gateway routing, auth pre-check, rate-limit, MCP
  ingress, the **LLM provider gateway**, and tiny-model inference (`@cf/baai/bge-small-en-v1.5`
  embedder; small classifiers/guardrails). **One Durable Object per session** (single-writer
  linearizable, 10 GB SQLite-per-DO, WebSocket Hibernation) owns conversation/plan/in-flight-tool
  state. Worker→Cloud Run over HTTPS with Cloudflare Access service tokens; Smart Placement on
  origin-bound Workers.
- **Tier 2 — Origin (Cloud Run, Node 22 modular monolith).** Orchestrator, business modules, projector,
  RAG pipeline, model routes needing private Neon access. `--min-instances=1`, `--cpu-boost`, heavy
  clients in global scope, concurrency 80 for I/O routes / low single digits for CPU paths. pnpm
  workspaces under `core/modules/*`; each a bounded context with `src/index.ts` public API, private
  `internal/`, ports-and-adapters, Zod in `packages/contracts`, **no cross-`internal/` imports**.
- **Tier 3 — Durable execution (Cloudflare Workflows).** Multi-step plans; `step.do` (memoized retry),
  `step.sleep` (free hibernation), `step.waitForEvent` (CSL human-in-the-loop gate). **Selective
  checkpointing** — only externally-visible-state-mutating steps. **No Temporal** (DOs + Workflows +
  Neon already give durable execution).
- **Tier 4 — Data plane (Neon Postgres, SoR).** Tables: `events` (episodic, append-only, partitioned),
  `facts` (bi-temporal semantic memory; `embedding vector(384)`, `content_hash`,
  `embedding_model_version`, generated `tsvector`), `skills` (the 116+ skills **as data rows** →
  handler modules), `memory_blocks` (Letta-style), `embedding_jobs` (outbox), `tombstones`,
  `eval_results`, `adr_index`. `wal_level=logical` (irreversible — write the ADR), direct endpoint (not
  pooler) for replication, slot heartbeat via `pg_logical_emit_message()`. Projector = small Node
  `pg-logical-replication` consumer (**no Kafka/Debezium**) with **change-significance filtering**.
- **Tier 5 — Derived projections.** **Vectorize** = 384-dim edge vector *cache*, populated **only** by
  the projector, every record carrying `{content_hash, model_id, model_version, embedded_at,
  valid_from}`; **dimension immutable at create** → model migration always dual-writes a new index.
  Redis/KV best-effort, **TTL ≤ 60s, "never authoritative" in code.** Projector enforces three drift
  checks: count parity at quiescence; PK-sample `content_hash` audit (Postgres vs Vectorize); frozen-Q→
  doc-id retrieval canary on a golden set.

---

## 4. Store reconciliation (the one real conflict, resolved)

The MCP Build Guide assumed the orchestration core holds **Neon + Upstash + Qdrant**. ADR-0003 said
pgvector-only. The newest synthesis settles it, and pre-launch makes the cleanup free:

| Concern | v2 decision | Status vs ADR-0003 |
|---|---|---|
| **Retrieval authority** | **Neon pgvector** — HNSW (`m=16`, `ef_construction=200`) + GIN `tsvector` + optional `pg_trgm`, fused via **RRF (k=60)** in one SQL CTE. Primary retriever. | Unchanged — confirmed |
| **Edge vector cache** | **Vectorize** — derived, projector-populated, reconstructible (`rebuild:vectorize --from-postgres`), dimension-locked 384. Hot-query cache only, **never an authority**. | **Amend**: promote from "P4-deferred" to "permitted Tier-5 derived cache" |
| **2nd vector engine (Qdrant)** | **Dropped.** Absent from the five-tier architecture; provisioned but unused; decommission. Reintroduce only via an ADR-0013 evidence gate. | **Amend**: from "deferred" to "dropped (decommission unused instance)" |
| **Cache / KV (Redis)** | Best-effort, **TTL ≤ 60s, never authoritative.** Upstash (already provisioned) or Cloudflare KV — either fills the role; pick Upstash since it exists. | Consistent ("KV cache in front") |
| **Embedding model** | **Locked:** `@cf/baai/bge-small-en-v1.5`, **384-dim, `mean` pooling** (Cloudflare Workers AI, MIT, edge-resident). Migration recipe: dual-write `heady-v2` + `embedding_model_version`, shadow-eval vs frozen Ragas testset, flag-flip, drop v1. Watch EmbeddingGemma-300M. | New detail |

**Net:** one authority (pgvector), one derived cache (Vectorize), one best-effort cache (Redis/KV),
zero Qdrant. Honors "one authority per concern" and "derived stores reconstructible from SoR."

---

## 5. Model layer — Liquid routing inside a multi-provider gateway

Refines v1's "Multi-Model Council." **Strategic stance: Liquid is the fast/private/cheap *edge* tier,
not the smart tier.**

- **Single egress chokepoint: Cloudflare AI Gateway.** All provider traffic flows Liquid → OpenRouter →
  CF AI Gateway. Edge logging, SHA-256 exact-match caching, per-tenant/per-model budgets (ADR-0010/0012),
  mid-stream provider fallback, DLP. **Semantic caching default-OFF, per-route opt-in** (poisoning is
  real); tool-call and personalized outputs are exact-match only.
- **Gateway behaviors borrowed:** LiteLLM (priority-ordered deployments, weighted shuffle,
  latency/usage routing, Redis cooldowns, fallbacks); Portkey (real circuit-breaking on P99 + error
  rate with **active probe requests during recovery**); OpenRouter (`:nitro`/`:floor`,
  `cost_quality_tradeoff` scalar); CF AI Gateway (the chokepoint above). This gateway is the home of
  `phi_circuit_breaker`.
- **Routing (classified by a cheap edge model):** intent/classifier → LFM2-350M; summarize/extract →
  LFM2-1.2B-Extract; cheap tool-calls → LFM2-1.2B-Tool; voice → LFM2.5-Audio-1.5B; speed on large open
  models → **Groq**; frontier reasoning (math/code/long planning) → **Claude Opus/Sonnet**; long-context
  multimodal → **Gemini Pro**; deep agentic → **OpenAI o-series/GPT-5**. **Reserve frontier providers
  for explicit `class=reason` / `class=longctx`.**
- **Liquid licensing nuance:** LFM Open License v1.0 — **"open weight," never "open source"** (not
  OSI). Access: OpenRouter (cloud first line), self-hosted vLLM/SGLang on Cloud Run GPU (custom Nanos),
  WebGPU+ONNX in a Worker (client-side privacy), LEAP Edge SDK (mobile). Normalize LFM2's Pythonic
  tool-call tokens to OpenAI `tool_calls[]`.

---

## 6. Latent memory & retrieval layer

On the durable spine (§3 Tier 4/5), porting **patterns, not Python servers** (ADR-0003):

- **Vocabulary:** CoALA episodic/semantic/procedural → `events` / `facts` / `skills` tables.
- **In-context:** Letta/MemGPT memory blocks (typed, character-budgeted, `memory_blocks`); tools
  `core_memory_append`, `archival_memory_insert`, `conversation_search`.
- **Consolidation:** the **sleep-time agent** (primary loses core-memory edit tools; a paired idle agent
  owns them) → Cloudflare Cron Trigger / DO-on-alarm.
- **Derived-memory mutation:** **mem0 ADD/UPDATE/DELETE/NOOP** (conservative LLM-as-arbiter for v1).
- **Evolving facts:** Zep/Graphiti **bi-temporal** model **directly in Neon** (two timestamp pairs +
  `invalidated_by_event_id`) — **no Neo4j/FalkorDB**.
- **Scoring:** Park et al. **recency × importance × relevance** (cheap on pgvector).
- **Retrieval:** hybrid-first (pgvector + tsvector via RRF), **reranker** (Cohere Rerank v3.5 /
  bge-reranker-v2-m3 / LFM2-ColBERT-350M) to recover 384-dim recall; **HyDE opt-in** on low-confidence;
  **CRAG-style relevance gating** with web-search fallback. The retriever is just another MCP tool —
  default "LLM decides when to retrieve."
- **Latent reasoning is research-only** (Coconut/Huginn/Quiet-STaR): treat reasoning as an opaque LLM
  call; do not bake latent-reasoning assumptions into the architecture.

---

## 7. Native agent loop — "Heady codes Heady" (supersedes/expands ADR-0005)

The single new bounded context `core/modules/coder/` plus one Worker route, one DO class, one React
surface, one GitHub App. This is the implementation-grade version of ADR-0005.

**Stack (production-ready picks):**
- **Agent substrate: Vercel AI SDK v6** (`streamText({tools, stopWhen, prepareStep})`) against an
  OpenAI-compatible `baseURL` = the **Liquid Gateway**. The model id is a *route*, not a vendor.
  **Reject the Anthropic Claude Agent SDK as the harness** (proprietary, protocol-locked, spawns a CLI
  binary that won't run in Workers/DO, separately metered from 2026-06-15) — permitted only as **one MCP
  tool** the agent can call. Fallback substrate: Cline SDK (Apache-2.0).
- **Durable execution:** wrap the loop in a Cloudflare Workflow `HCCoderRun` (sibling of
  `HCFullPipeline`); each `stopWhen` boundary = a `step.do`; `step.waitForEvent` = the CSL approval gate.
- **Sandbox:** **Cloudflare Sandboxes SDK** (`gitCheckout` + `exec`), **Outbound Workers hold the
  credentials** (the sandbox never sees the GitHub token or model key); `allowedHosts` allowlist-only.
  Escape hatch: **Cloud Run Jobs** (gen2 microVM) for >30 min / GPU / private-VPC.
- **Git write path:** GitHub App **`blocksorg`** with per-installation, downscoped, 1-hour tokens minted
  by a Cloud Run minter; private key **only in GCP Secret Manager**. Permissions: `contents:write`,
  `pull_requests:write`, `workflows:write`, `checks:write`, `actions:read` — **never `administration`
  or `secrets`.**
- **Front-end:** **assistant-ui** (MIT) `<Thread/>` + Cloudflare `agents` SDK (`AIChatAgent` DO,
  WebSocket Hibernation, resumable streams) + `makeAssistantToolUI` per tool; diffs via
  `@git-diff-view/react`; terminal via `xterm.js` + `addon-attach` over the DO WS; PR approval via AI
  SDK v6 `needsApproval`/`respondToApproval`. Auth: Firebase ID token verified in `onBeforeConnect` via
  `firebase-auth-cloudflare-workers` (WebCrypto). **Web IDE (code-server) deferred to v2.**

**The CSL gate = three independent layers, any one blocks merge:**
1. **GitHub:** branch protection + CODEOWNER review on protected paths; `blocksorg` is **not** a code
   owner; "dismiss stale approvals on new push" + "require approval of most recent reviewable push."
2. **CI:** `coder-fidelity-gate` Check Run (only `blocksorg` can sign) publishes eval pass/fail +
   trailing-median drift.
3. **Workflow:** `step.waitForEvent` holds at approval; the event fires only on `respondToApproval` from
   a Firebase-authenticated human. **"Approve all" exists nowhere** (users approved ~93% of prompts —
   approval is accountability transfer, not control).

**Rustc-style bootstrap (the safety spine):**
- **Stage0 is external and untouchable, forever.** The eval harness, fidelity gate,
  `phi_circuit_breaker` thresholds, CODEOWNERS, Liquid Gateway, and the merge button are stage0
  artifacts; **the agent can never edit them, regardless of pass-rate.** Stage0 compiler = Claude
  Code / Cursor for any change to those paths. (Guards against the Self-Rewarding-LM failure mode.)
- **Stage1** turns on with a hard scope allowlist: **docs, new tests for existing code, small typed
  refactors** the OpenAPI gate already covers. Enforced in three layers (Outbound `allowedHosts`, token
  `permissions`+`repositories` narrowing, server-side path-glob refusal in `submit_pr`). **Writer/
  Reviewer pattern mandatory** (separate cleared-context review run before the PR opens).
- **Stage2** (agent edits prompt templates / non-critical MCP tools / router heuristics) unlocks only by
  **condition, never timer**: stage1 first-try eval pass-rate ≥ bar; zero circuit-breaker trips; zero
  allowlist violations; fixed-point eval ≥ immutable baseline; one human-signed ADR granting exact
  scope. **Not multi-agent, not infra autonomy.**
- **`phi_circuit_breaker`** (outside the LLM loop) trips on: per-PR/per-day cost ceiling, eval-pass-rate
  trailing-median drift, error-rate spike, tool-call-rate anomaly, tool-description hash drift,
  unallowlisted egress, rolling-50-trace judge-score drop >2σ, or anomalous file-touch
  (`evals/`/`ci/`/`.github/`/`core/modules/coder/`). Kill switch = `heady.coder.enabled` flag +
  per-task `abandon` (revokes token, tears down sandbox), exercised on a schedule.

---

## 8. MCP services + the Console admin UI (the near-term spearhead)

A matched pair (build guide + design brief) that ships **internal-first** and solves three documented
pain points at once: projection drift, OAuth token non-persistence, and no machine-readable
real-vs-projected view.

**Servers (the build guide):**
- **Orchestration core** `@heady-ai/mcp-server` (port 3310) → **Cloud Run**, **Express** + MCP SDK
  Streamable HTTP. The only server exposing the full tool surface; holds Neon (pgvector) + Redis
  connections (tenant-namespaced `tenant:{id}:`). Endpoints `POST /mcp`, `GET /manifest`, `GET /healthz`,
  `/.well-known/...`. OAuth resource server (bearer→principal), **confused-deputy policy gate**
  `authorize(principal, tool)`, **6 permission groups**, ~47 tools.
- **Projection shells** (the nine `headyX-core` satellites) → **Cloudflare Workers/Pages**, **Hono**,
  fetch-native, no DB. Each shell's only job is **to tell the truth about itself**: emit a
  `ServerManifest` (`projection_only` + `Provenance`) and `/healthz`, optionally proxy an attenuated
  tool subset. This **kills projection drift** — a shell can't masquerade as a backend because the
  console reads its manifest verdict.
- **Shared contract** `@heady/mcp-contracts` — one set of Zod `.strict()` shapes (`Connector`,
  `Provenance`, `PermissionGroup`, `McpTool`, `ServerManifest`, `ConsoleSummary`) imported by **both**
  UI and servers. Folds into `packages/contracts` (ADR-0002). `heartbeatMs = 29034` (φ⁷×1000).

**Console (the design-system zip → `headyme-portal` internal console):**
- Single-route internal tool, Firebase-auth'd, edge-deployed, secrets from Secret Manager — **never in
  the client.** Audience: Heady engineers (the founder), not customer-facing.
- **The living honeycomb:** a HexCell per connector that *reports its own state*; canvas:drawer ≈ φ:1;
  teal `#00d4aa` + violet `#7c5eff` as **state signals, not wallpaper**; Space Grotesk display +
  JetBrains Mono for all machine values; φ Fibonacci spacing (3/5/8/13/21/34/55/89/144); ambient
  φ-heartbeat pulse on healthy cells (suppressed under `prefers-reduced-motion`).
- **15 connectors:** 10 Heady-owned (1 real core + 9 projection candidates resolved at runtime) + 5
  infra (Neon, Redis, **Qdrant** [observed only — see §4: decommission], GitHub-4-orgs, Google Drive).
- **State model:** `not_connected / connecting / connected×{healthy,degraded} / unreachable /
  token_expired / projection_only / empty / global-error`. `token_expired` is **first-class** (OAuth
  persistence is a known issue) with one-tap **Re-authorize** — never a dead end. Deploy-class tools are
  visually flagged (the confused-deputy surface). Per-session **Enable/Disable** toggles.
- The zip already delivers the vanilla-HTML/CSS/JS + React components + φ tokens; **what's wired in
  code afterward:** connector registry + health probes on the 29034 ms heartbeat, OAuth/token
  lifecycle, MCP invocation with caller-identity propagation, and the projection-manifest source.

> **Why this is the spearhead:** it's internal (low risk), it directly retires projection drift and the
> OAuth pain, and the same `headyme-portal` surface on the verified domain is what **unblocks the Google
> for Startups suspension** (§12). It exercises Tiers 1–4 end-to-end as the first real vertical slice.

---

## 9. Task system — native, anchored by Linear + Sentry

The first living bounded context (v1 Phase 2), now with anchors. `task` / `task_dep` / `task_attempt` /
`task_outbox` + idempotency table (ADR-0006); enqueue inserts `task` + `task_outbox` in one transaction.
A Cloudflare Queue (`tasks-fanout`) Worker consumes the outbox and dispatches inline / Workflow / Cloud
Run Job per kind; per-task serialization via SQL locks or DO lanes. **Outbox-driven mirroring** (never
direct external calls): **Linear** for issue/state sync (the auto-extract-tasks workflow files here),
**Sentry** for the feedback contract (SLO-burn only, ADR-0011). PACELC-mapped for the consistency/latency
tradeoffs. Plugs into HeadySwarm/HeadyBee/coder as the work ledger.

---

## 10. Projections engine, consistency engine & approval system (the operating spine)

These operationalize ADR-0001 (projection manifests), ADR-0005/0013 (approval), and the "missing OS."

- **Projections engine.** A projection is a pure one-way derivation `(monorepo_SHA, source_path,
  transform_fn) → public *-core repo`. Four invariants: one-way, content-addressable (SHA-256 tree
  hash), manifest-authoritative (`projection.yaml`, full JSON-Schema 2020-12), license/patent-bounded.
  Tooling: **Google Copybara** (Starlark, SQUASH, `GitOrigin-RevId`) for git history + a small **Node
  projector** owning hashing, drift, manifest enforcement, deploy dispatch. **Drift states:** `in-sync`
  / `source-ahead` (re-project) / `projection-ahead` (**page + freeze** — unexpected), cron every 15
  min. **Lifecycle:** `proposed→scaffolded→active→deprecated→archived→eliminated` (backward forbidden
  except `deprecated→active`); deprecate injects RFC-8594 `Sunset` = +89 days; eliminate gated on zero
  inbound refs + <13 req/day for 34 days + dual approval. Patent-locked content stripped via
  `.headyignore` + `private_paths` + `// HEADY-INTERNAL-BEGIN/END`.
- **Continuous Consistency Engine.** A **MAPE-K loop** (`heady consistency` CLI: monitor→analyze→
  plan→execute over `facts.yaml` knowledge). Drift types: docs/config/manifest/stale/orphan/duplicate.
  Tools (2026): **knip** (ts-prune deprecated), dependency-cruiser, syncpack, ls-lint, lychee, gitleaks.
  **Renovate** (not Dependabot) as primary — regex managers can bump `facts.yaml` itself; Dependabot
  retained only for GitHub Advisory security alerts. Severity→CI: info/warn/error(opens PR)/blocking
  (fails build). Self-healing PR batching (≤5/day), escalate after ⌈φ²⌉=3 recurrences.
- **Approval system (HCP).** Heady Change Proposal = Nygard ADR + MADR 4.0 + Y-statement + Rust-RFC +
  Oxide-RFD, with three Heady affordances: **gates deploys not just merges**, declares patent-locked
  zones, embeds the φ-canary plan. Machine-readable approval record (ULID, state machine, **Ed25519
  signed receipts** verifiable from public JWK, OPA/Rego policy run in both CI and runtime via
  opa-wasm). **GitHub-native enforcement:** Environments + Deployment Protection Rules (the approval
  service is a GitHub App answering `deployment_protection_rule` webhooks) + CODEOWNERS on
  `/patent-locked/**`. **φ-canary:** 5/25/50/100% with φⁿ soak (φ²≈2.62h … φ⁴≈6.85h), Cloud Run revision
  tags. *(Caveat: custom protection rules on private repos need GitHub Enterprise Cloud.)*

---

## 11. Anti-sprawl governance — every invariant enforced in CI

The corpus is emphatic: encode rules as automation, not documents.

- **One org, one monorepo.** Freeze repo creation in the other three orgs by policy; **CI rejects new
  top-level directories without an ADR.** Archive-not-delete (preserves redirects).
- **Generated code is not authored.** `// AUTOGENERATED — DO NOT EDIT` on every generated file;
  pre-commit runs `pnpm gen` + `git diff --exit-code generated/`; CODEOWNERS-lock `generated/`.
  `api/openapi.yaml` generates routes + SDK + `mcp-tools.json`; never hand-edit downstream.
- **Typed, linted module boundaries.** `eslint-plugin-boundaries` forbids `@core/<m>/internal/*`
  imports; `dependency-cruiser --validate` fails forbidden edges; `api-extractor` fails public-API
  changes lacking a paired ADR + contract bump.
- **Trunk-based + flags + ParallelChange (expand-migrate-contract) for every schema/contract change
  (ADR-0007); Branch-by-Abstraction for cross-cutting migrations.**
- **AGENTS.md hierarchy.** Truth in `AGENTS.md` (root + per-module, nearest-wins, kept short);
  `CLAUDE.md` is one line pointing at it. Explicit **"Do not create"** list: no new top-level packages
  without an ADR, no new microservices, no new `lib/`/`utils/`/`helpers/`/`common/`.
- **ADRs append-only, Nygard format, cite the literature in Context.**

**Evals are "the OS of the OS."** Langfuse (self-host) + Sentry (`release=git SHA`) + `eval-results.json`
+ trailing-median drift. CI gate thresholds: regression set **100% pass** (mandatory); exploration
median may not drop >2%; bottom-decile mean may not drop >5%; cost-per-trace +10% max; p95 +15% max;
tool-call schema conformance 100%; **run regressions 3× take median**; **judge model never the same
family as the agent under test.** Tool-call distribution drift (chi-squared) is a first-class metric.

---

## 12. Business & product layer

The 88KB blueprint adds the commercial frame the engineering plan serves.

- **Beachhead product: IRS Form 990 Parser** on Cloud Run (target Months 3–6). High-margin, nonprofit-
  adjacent, exercises the pipeline. First revenue vertical.
- **Compliance layer (for fintech/healthcare):** PHI anomaly gate (quarantine HIPAA markers before
  external inference; 0% PHI transit), single-tenant **sovereign DB** instances (CLOUD Act / data
  residency), edge KV audit trails (<50ms), governance bees (Audit/Compliance/PermissionGuard) for RBAC.
  Targets HIPAA / GDPR / EU AI Act. (Sequence behind the core; gate per ADR-0013.)
- **Monetization:** **Reserve-Commit** billing (reserve a thought-budget out-of-band, commit actual cost
  on completion — no DB-lock latency on the hot path); per-thought micro-transactions with φ-multipliers;
  **Fibonacci tiers** Trial / Seed $89 / Grow $233 / Scale $610. Stripe wired when there's something to
  charge for (v1 provider plan: Phase 4).
- **Cost & credits:** target infra ≈ **$618/mo** (serverless scale-to-zero). Immediate ~$1,200–1,500
  token bottleneck. **Credit programs (act on these):** Cloudflare for Startups **$250k pending**
  (covers edge/KV/Workers AI); **Anthropic ×Goodstack** (verify email sent 2026-06-10 — click link);
  **OpenAI ×Goodstack** (upload involvement proof); **Adobe ×Goodstack approved** (activate Express +
  Acrobat); **Perplexity Enterprise** 25% offer, ticket closes ~2026-06-16.

---

## 13. Revised phase plan (≤1 net-new platform per phase; every gate is a condition)

### Phase 0 — Containment & authority *(P0)*
Org consolidation 4→1, freeze repo creation elsewhere (CI-enforced). **GCP Secret Manager** (keyless
OIDC) — the new platform. `git filter-repo` secret purge + key rotation. Supply-chain CI (gitleaks /
TruffleHog / Semgrep / Trivy/Grype/Syft / **Renovate** + Dependabot-security-only / mcp-scan), actions
pinned to **digests**. Root `AGENTS.md` + one-line `CLAUDE.md`. ADR set 0001–0013 (done) + ADR-0000
(reject RAM-first) + the §14 amendments. `docs/inventory.md` (every repo/service/skill/org with cost +
last-touched). Cost dashboards + baseline. **Stage0 declared untouchable** (§7). Investigate the ~32
core dumps (~375 GB). *Resolves:* credential sprawl, org sprawl, projection-readiness lies.

### Phase 1 — Backbone packages *(P0)*
**Neon** (the new platform: SoR + pgvector + pgmq outbox + pg_cron + `wal_level=logical`). `phi-math`,
`csl-engine`, `packages/contracts` (OpenAPI+Kubb+Zod, incl. `@heady/mcp-contracts` shapes),
`packages/db` (Drizzle, the five-tier Tier-4 schema), `security-mesh`, `heady-vault`, OTel GenAI
semconv. Module-boundary tooling (eslint-plugin-boundaries / dependency-cruiser / api-extractor) live.

### Phase 2 — Task ledger + memory *(P0/P1)*
Task ledger (§9) — first living bounded context, Linear/Sentry outbox mirrors. `memory-stream` (§6:
CoALA/Letta/mem0/bi-temporal as TS schemas on pgvector). `auto-context` (WAL→projector CDC with
change-significance filtering, ADR-0007). Embedding locked (`bge-small-en-v1.5`, 384/mean). Vectorize as
derived edge cache + the three drift checks. Langfuse + eval harness ("OS of the OS") with CI gates.
Perplexity research tooling. *Decommission unused Qdrant.*

### Phase 3 — Apps, MCP services + Console, native agent loop *(P1)*
**Cloudflare** (the new platform: Workers/Workflows/Queues/DOs/R2 + AI Gateway as egress chokepoint) +
Cloud Run write origin. **MCP services + Console (§8)** as the first vertical slice (internal-first;
ships `headyme-portal` on the verified domain → **unblocks Google for Startups**). `api-gateway` (edge
reads, origin writes, circuit-breaker library), `heady-manager` (route decomposition, `PORT`),
`heady-mcp-server` (Streamable HTTP, single transport). **Native agent loop (§7)** — stage0 only, then
stage1 behind the scope allowlist + Writer/Reviewer. Liquid Gateway routing (§5). Sentry SLO-burn.
Projections engine + Consistency engine + HCP approval system (§10).

### Phase 4 — Expand carefully *(P2 · evidence-gated)*
Agent **stage2** (condition-gated, never timer). 990 Parser beachhead + PHI compliance layer + sovereign
DB. Stripe + Reserve-Commit billing + Fibonacci tiers. Edge Code Mode / DO-per-session. Any second
vector engine (Qdrant/Vectorize-as-authority) only on a benchmark proving pgvector is the bottleneck.

### Running throughout (the OS)
OTel · Sentry SLO-burn only · Langfuse + eval gates on every agent PR · daily FinOps rollup · monthly
Neon restore drill · rate-limit + token budgets · retention/erasure sweeps · projection drift cron ·
consistency MAPE-K loop · `phi_circuit_breaker` · kill-switch drills.

---

## 14. Required doc amendments (apply for consistency)

1. **ADR-0003 (Retrieval).** Add: *Vectorize is a permitted Tier-5 **derived edge cache** (projector-
   populated, reconstructible, dimension-locked 384), never an authority.* Change Qdrant from "deferred"
   to **"dropped — decommission unused instance; reintroduce only via evidence gate."* Add the locked
   embedding (`bge-small-en-v1.5`, 384, mean) and the dual-write migration recipe.
2. **ADR-0001 (Repo authority).** Strengthen the projection posture: shells are **legitimate one-way,
   manifest-authoritative projections** (Copybara + Node projector), not merely "fold or mark." Logic
   lives in the monorepo; shells project truthfully and the Console renders the verdict.
3. **ADR-0005 (Agent governance).** Replace the summary loop with the §7 spec: rustc-style
   stage0/1/2 bootstrap, Vercel-AI-SDK harness (Claude Agent SDK rejected as harness), three-layer CSL
   gate, `phi_circuit_breaker`, Writer/Reviewer, `blocksorg` App + token minter.
4. **PROVIDER_AND_OSS_MASTER_PLAN.md.** Stores: Upstash=best-effort cache (baseline, provisioned),
   Vectorize=derived edge cache (was deferred), Qdrant=dropped. Supply chain: **Renovate primary**,
   Dependabot security-only. Add: CF AI Gateway (egress chokepoint), Liquid/OpenRouter, Cloudflare
   Sandboxes, GitHub App `blocksorg`, Copybara, OPA/Rego, Cohere Rerank, assistant-ui. Add the credit-
   program register (§12).
5. **adr/README.md + SOURCE_OF_TRUTH.md.** Link this v2 plan and add **ADR-0000 (reject RAM-first/
   latent-as-truth)** to the index.
6. **New ADRs to author:** 0014 logical-replication (`wal_level=logical`, irreversible) · 0015
   embedding-model lock · 0016 native-agent-loop bootstrap · 0017 projections engine + lifecycle · 0018
   model gateway / Liquid routing.

---

## 15. Time-sensitive register (act now)

- ⏰ **Perplexity Enterprise** — ticket closes **~2026-06-16**; reply with org name/site/501(c)(3).
- 🔑 **Anthropic ×Goodstack** — click the verification link (email sent 2026-06-10).
- 🔑 **OpenAI ×Goodstack** — upload HeadyConnection involvement proof.
- ✅ **Adobe ×Goodstack approved** — activate Express Premium + Acrobat Pro.
- 💳 **Cloudflare for Startups $250k** — confirm allocation; it covers the entire edge tier.
- 🎯 **Google for Startups** (suspended 2026-06-10) — ship `headyme-portal` (the Console, §8) on the
  verified domain to restore the GCP credits underpinning Cloud Run / Secret Manager.
- 📧 **James Haywood GPG** — import his public key to decrypt investor `.asc` emails.
- 📜 **Patents** — assign 51 provisionals off never-formed "Heady Systems LLC" → HeadySystems Inc.;
  non-provisional deadline **2027-03-06**. TM licensing (HeadyConnection↔HeadySystems) for IRS inurement.
- 🧹 **~32 core dumps (~375 GB)** on `~/` at 68% — a legacy watcher is crash-looping; clear it.

---

## 16. Source-report provenance (what fed v2)

| Report (in `~/Heady/dropzone`) | Fed into |
|---|---|
| `heady-liquid-latent-os-stepwise.md` | §3 five tiers, §5 model layer, §6 memory, §11 governance, §4 stores |
| `Heady_Native_Interface.md` | §7 native agent loop + bootstrap |
| `Heady_mcp_Build_Guide.md` + `HEADY_MCP_CONSOLE__Claude_Design_Input_Brief.md` + the design-system zip | §8 MCP services + Console |
| `Eng_Playbook.md` | §10 projections/consistency/approval, §11 governance |
| `gpt-exec-sum.md` + `gpt-research-rebuild.md` | §2 migration method, §13 phases, eval gates |
| `Heady_Task_Man_Sys.md` | §9 task system |
| `AI Project Consolidation and Migration Plan.md` | §12 business/product, §15 register |
| `heady_current_state_handoff.md`, `Gem_Heady_Rebuild.md`, `gpt-deep-research-report.md`, `Heady_Arch_Audit_Open_Source_Int.md` | v1 backbone (carried forward) |

> **Operating principle (corpus consensus):** re-read Anthropic's "Building Effective Agents" before each
> major decision; modular monolith over microservices; workflows over agents; prompts + tools as the
> primary surface; **derived stores reconstructible from the system of record**; one authority per
> concern; sequence the bets. v2 changes the detail, never the spine.
