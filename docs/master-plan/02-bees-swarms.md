# Domain 02 — HeadyBees, HeadySwarms & Swarm Coordination

> Master Incorporation Plan · one-domain inventory. Ground truth = `lexicon.yaml` (35-bee canonical
> roster) + `~/Heady` / `~/workspace/Heady` legacy code, then `docs/compendium/02-bees-and-swarms.md`,
> then `tooling/decomposition/manifest.json`, then ADRs / `facts.yaml`. Skills are claims-to-verify only.

## Domain summary

A **HeadyBee** is a single ephemeral agent worker bound to one lifecycle — `spawn() → execute() →
report() → retire()` — defined by the `BaseHeadyBee` contract (legacy `~/Heady/src/bees/base-heady-bee.js`,
985 lines). A **HeadySwarm** is a coordinated set of bees: spawn → dispatch → consensus → fuse, CSL-gated
and φ-scaled (`lexicon.yaml` §swarm). The canonical roster is **exactly 35 kebab-named bee roles**
(`lexicon.yaml` lines 193–228, `sot: packages/bees; heady-bee-swarm-ops`), one lifecycle-bound worker per
domain. This 35 is a *curated* roster: the legacy monolith actually carries **~73 `*-bee.js` files** in
`~/Heady/src/bees/` (97 `.js` total incl. projection-/swarm-/PascalBee variants such as `judge-bee`,
`hologram-bee`, `patent-bee`, `distiller-bee`, `evolution-bee`, `anomaly-detector-bee`, `*-projection-bee`)
— the lexicon names the canonical subset, the compendium reconciles three overlapping taxonomies, and the
deployment blueprint inflates to "197 worker bees / 24 domains" (a *capacity* statement, R4-superseded).

**Critical status finding** (re-verified 2026-08-22): the rebuild monorepo has **no `packages/bees`,
`packages/orchestration`, or `packages/engines`** (verified `ls packages/`), and now has **zero**
rebuild-side touchpoint at all. The sole previous one,
`packages/heady-sacred-geometry-sdk/lib/template-engine.js` — a template *scorer*, never a runtime —
moved to `_archive/legacy-packages/heady-sacred-geometry-sdk/lib/template-engine.js` in the
`ce4aa9ef53` disposition sweep (2026-07-23). Therefore **every one of the 35 bees and the entire
swarm-coordination layer is `legacy-only` or `planned`** — none is `built` in the rebuild.
`tooling/decomposition/manifest.json` group **G02 `bee-swarm-runtime`** is the transfer authority: targets
`packages/bees` + `packages/orchestration` + `packages/engines`; sources `agents/` (AG-01 adapt),
`agents/headybee-swarm.js` (AG-02 adapt — "salvage routing; drop Pinecone/Redis"),
`maximum-potential/liquid-nodes` (AG-03 integrate the BaseBee), and design specs AG-17 (A2A→NATS,
CSL ternary = 3-layer gate). Governance gate: ADR-0005 (single-agent-first, no auto-merge, sandbox,
human-approved PR) bounds how this layer may run.

## Roll-up table — the 35 canonical bees (`lexicon.yaml`)

Status legend: `legacy-only` = coded in `~/Heady/src/bees/`, not yet ported; `partial` = exists legacy +
has a rebuild package the handler will fold into (no bee runtime yet); `planned` = canonical name, no
standalone legacy module. Rebuild loc = **none** for all (no `packages/bees`); transfer target per G02.

| Bee | Purpose (lexicon) | Status | Legacy ref (`~/Heady/`) | Rebuild loc | Transfer disposition (→ pkg · group) |
|---|---|---|---|---|---|
| `agents-bee` | Agent definitions & lifecycles | legacy-only | `src/bees/agents-bee.js` | none | → `packages/orchestration` · G02 (AG-01) |
| `auth-provider-bee` | Onboards OAuth/API-key providers | legacy-only | `src/bees/auth-provider-bee.js`, `src/auth/bees/` | none | → identity / `packages/bees` · G02 |
| `auto-success-bee` | LAW-07 auto-success cycle (φ⁷ heartbeat) | legacy-only | `src/bees/auto-success-bee.js` | none | → auto-success engine · G02 |
| `brain-bee` | Cognitive/reasoning coordination | legacy-only | `src/bees/brain-bee.js` | none | → model-mesh · G02 |
| `config-bee` | Config mgmt & validation | partial | `src/bees/config-bee.js` | (`packages/config`) | → `packages/config` handler · G02 |
| `connectors-bee` | Builds/maintains connectors | legacy-only | `src/bees/connectors-bee.js` | none | → connector-forge · G02 |
| `creative-bee` | Creative/generative (incl. MIDI) | legacy-only | `src/bees/creative-bee.js` | none | → transforms (Domain 07) · G02 |
| `deployment-bee` | Deploys to Cloud Run / Cloudflare | legacy-only | `src/bees/deployment-bee.js`, `cloud-run-deployer-bee.js` | none | → deploy (Domain 09) · G02 |
| `device-provisioner-bee` | Cross-device provisioning/bridging | legacy-only | `src/bees/device-provisioner-bee.js` | none | → cross-device · G02 |
| `documentation-bee` | Generates/hydrates docs | legacy-only | `src/bees/documentation-bee.js` | none | → coder module · G02 |
| `engines-bee` | Maintains latent-OS engines | legacy-only | `src/bees/engines-bee.js` | none | → `packages/engines` · G02 |
| `governance-bee` | Audit / compliance / permission | partial | `src/bees/governance-bee.js`, `compliance-auditor-bee.js` | (`packages/security-mesh`) | → governance (Domain 06) · G02 |
| `heady-bee` | Base/generic scouting & foraging | legacy-only | `src/bees/heady-bee.js` + `base-heady-bee.js` | none | → `packages/bees` BaseBee · G02 (AG-03) |
| `health-bee` | Health checks & uptime | partial | `src/bees/health-bee.js`, `health-projection-bee.js` | (`packages/observability`) | → observability (Domain 09) · G02 |
| `intelligence-bee` | Analytics & intelligence synthesis | legacy-only | `src/bees/intelligence-bee.js` | none | → research · G02 |
| `lifecycle-bee` | Worker spawn/retire lifecycle | legacy-only | `src/bees/lifecycle-bee.js` | none | → reliability / `packages/bees` · G02 |
| `mcp-bee` | Manages MCP servers / tool surfaces | legacy-only | `src/bees/mcp-bee.js` | none | → mcp-server (Domain 06/08) · G02 |
| `memory-bee` | Vector store/search/embed | partial | `src/bees/memory-bee.js` | (`packages/memory-stream`,`embedding`) | → memory (Domain 04) · G02 |
| `middleware-bee` | HTTP middleware (CORS/rate-limit) | legacy-only | `src/bees/middleware-bee.js` | none | → gateway (Domain 06) · G02 |
| `midi-bee` | MIDI transport / creative-music | legacy-only | `src/bees/midi-bee.js` | none | → transforms (Domain 07) · G02 |
| `ops-bee` | General operations & maintenance | legacy-only | `src/bees/ops-bee.js` | none | → ops · G02 |
| `orchestration-bee` | Multi-agent DAG coordination | legacy-only | `src/bees/orchestration-bee.js` | none | → `packages/orchestration` · G02 |
| `pipeline-bee` | Runs staged HCFP pipeline | legacy-only | `src/bees/pipeline-bee.js` | none | → HCFullPipeline Workflow · G02 |
| `providers-bee` | AI provider routing & keys | legacy-only | `src/bees/providers-bee.js` | none | → model-mesh (Domain 05) · G02 |
| `refactor-bee` | Code refactoring / codemods | legacy-only | `src/bees/refactor-bee.js` | none | → coder module · G02 |
| `resilience-bee` | Circuit breakers, bulkheads, fallbacks | partial | `src/bees/resilience-bee.js` | (`packages/resilience`) | → reliability · G02 |
| `routes-bee` | Generates/validates API routes | legacy-only | `src/bees/routes-bee.js` | none | → gateway · G02 |
| `security-bee` | Security review (secrets/fail-closed/auth) | partial | `src/bees/security-bee.js` | (`packages/security-mesh`) | → governance (Domain 06) · G02 / SEC-001 |
| `services-bee` | Scaffolds Latent-pattern services | legacy-only | `src/bees/services-bee.js` | none | → platform · G02 |
| `sync-projection-bee` | Maintains projections / sync fabric | legacy-only | `src/bees/sync-projection-bee.js` | none | → projections engine (ADR-0017) · G02 |
| `telemetry-bee` | OTel / Sentry / Langfuse instrumentation | partial | `src/bees/telemetry-bee.js`, `telemetry-projection-bee.js` | (`packages/observability`) | → observability (Domain 09) · G02 |
| `trading-bee` | Apex trading & FinOps logic | legacy-only | `src/bees/trading-bee.js` | none | → fintech vertical (Domain 10) · G02 |
| `ulti-bee` | Multi-capability fallback worker | planned | template only: `src/core/bee-registry/bee-templates.js` (no `src/bees/ulti-bee.js`) | none | → `packages/bees` fallback handler · G02 |
| `vector-ops-bee` | Low-level vector index ops | legacy-only | `src/bees/vector-ops-bee.js` | none | → memory (Domain 04) · G02 |
| `vector-template-bee` | Vector/projection templates | legacy-only | `src/bees/vector-template-bee.js` | none | → memory (Domain 04) · G02 |

> **Count check:** 35 rows = the lexicon roster. `ulti-bee` is the lone canonical name with **no**
> `src/bees/` module (verified `grep -rli ulti-bee`); it exists only as a registry template, so it is the
> single `planned` row. `*-projection-bee` and PascalBee variants (Taxonomy B/C) are out-of-roster legacy
> code, folded as handlers, not separate canonical bees.

---

## Per-system decomposition

### BaseHeadyBee lifecycle
- **Category:** core worker contract · **Status:** legacy-only · **Confidence:** defined
- **What.** The universal interface every bee implements: `spawn() → execute() → report() → retire()`,
  with a singleton `BeeRegistry` and a `BeeFactory`/`BeeTemplateRegistry`. Makes bees uniformly
  schedulable, observable, disposable ("cattle, not pets"). State machine: `IDLE → SPAWNING → ACTIVE →
  EXECUTING → REPORTING → RETIRING → RETIRED`.
- **Legacy (refs+paths).** `~/Heady/src/bees/base-heady-bee.js` (985 ln) — `class BaseHeadyBee extends
  EventEmitter`; `spawn()` (mints embedding, registers, pushes LIFO cleanup), `execute()` (retry loop with
  `Promise.race` timeout, φ-backoff, coherence boost/decay), `report()` (metrics + coherence + successRate),
  `retire()` (LIFO cleanup unwind, deregister, `removeAllListeners`), `health()`, `registerCleanup()`.
  `BeeRegistry` singleton (`getInstance`/`register`/`deregister`/`getByType`/`getActive`/`aggregateHealth`),
  `_maxBees = fib(11) = 89` with retired-bee eviction. Also `~/Heady/src/bees/heady-bee.js`,
  `bee-template.js`, `headybee-template-registry.js`.
- **Rebuild (path).** none. `packages/phi-math` + `packages/csl-engine` + `packages/resilience` supply the
  primitives a ported BaseBee would compose; no contract module yet.
- **Parts (component → subparts).** lifecycle methods → {spawn, execute(retry/timeout/backoff), report,
  retire(LIFO)} · BeeRegistry → {register/evict, lookup by id/type, aggregateHealth, capacity fib(11)=89} ·
  telemetry → {executionCount, success/failureCount, totalDurationMs, coherenceScore} · pheromone hook →
  success/failure embedding emitted on `bee:execute:complete` (compendium §1; decay `e^(−t/φ)` is design).
- **OSS (current+planned).** Node `events.EmitterEmitter`/`crypto.randomUUID` (current legacy); planned
  rebuild harness = **Vercel AI SDK v6** against the Liquid Gateway (`facts.yaml: agent_harness`); runtime
  host = Cloudflare Workflow `step.do` / Queue consumer / Colab task (compendium §1) — **not** a long-lived
  server. Anthropic Claude Agent SDK explicitly **rejected** as harness (ADR-0005 amendment).
- **UI.** Bee/swarm health surfaces via observability (Domain 09) + `@heady/headylens` event stream; no
  dedicated bee UI in the rebuild.
- **Transfer disposition.** → `packages/bees` (BaseBee + Registry + Factory) · group **G02** (AG-03
  integrate `maximum-potential/liquid-nodes` BaseBee; AG-01 adapt `agents/`).
- **Incorporation steps.** (1) Port `BaseHeadyBee` contract into `packages/bees`, re-express tunables via
  `@heady/phi-math`. (2) Recast lifecycle as Workflow step / Queue consumer (drop long-lived process). (3)
  Wire `spawn` cred-mint → `report` telemetry → `retire` cred-revoke through `@heady/secrets` +
  observability. (4) Emit pheromone embeddings to `events`/`facts` (Domain 04). (5) Eval-gate per ADR-0005.
- **⚠ Drift + decisions + ADR/law.** **Numeric drift (timeout):** legacy code sets `timeout = PHI^4*1000 ≈
  6854ms`; compendium §1 asserts `timeout = round(φ×1000) = 1618ms`. Legacy code (priority 1) and compendium
  (priority 2) disagree; the rebuild implements **neither** yet → **open decision** (do not assume canonical).
  `maxRetries`: legacy `fib(6)=8` vs compendium `round(φ×5)=8` — **same value, different formula**, not a
  drift. Law: ADR-0005 (sandbox + human-approved PR), ADR-0010 (rate-limits/token-budgets bound concurrency),
  LAW-07 (auto-success). Capacity drift: registry `fib(11)=89` vs blueprint "≤10,000 concurrent" (R4
  capacity-only).

### Bee Factory & Template Registry
- **Category:** worker provisioning · **Status:** legacy-only · **Confidence:** defined
- **What.** A dynamic factory that compiles/parameterizes specialized worker configs on demand from a
  template registry, instead of hand-coding every variant.
- **Legacy (refs+paths).** `~/Heady/src/bees/bee-factory.js` (756 ln), `bee-factory-v2.js` (1239 ln),
  `~/Heady/src/08-bee-factory.js` (753 ln), `~/Heady/agents/bee-factory.js`,
  `~/Heady/src/services/heady-bee-factory/index.js`, registry `~/Heady/src/core/bee-registry/bee-templates.js`
  (the kebab-bee template definitions incl. `ulti-bee`), `~/Heady/src/autonomy/heady-template-registry.js`.
  `BeeFactory` in `base-heady-bee.js` (`registerTemplate`/`create`/`getRegisteredTypes`/`hasTemplate`).
- **Rebuild (path).** none live. `TemplateEngine` — the 6-dimensional weighted scorer (`skills` 0.20,
  `workflows` 0.20, `nodes` 0.10, `headyswarmTasks` 0.25, `bees` 0.15, `situations` 0.10) selecting
  optimal templates, **scoring only, no factory runtime** — now sits at
  `_archive/legacy-packages/heady-sacred-geometry-sdk/lib/template-engine.js` (archived `ce4aa9ef53`).
  Step (3) below reinstates it from there.
- **Parts.** template match → provision → parameterize → register → execute → converge → extract (distill
  back into a new template via `heady-distiller`).
- **OSS (current+planned).** none external (pure JS); planned = function emitting Workflow steps / Queue
  messages / MCP tool bindings (compendium §5).
- **UI.** none direct; surfaced via scaffold planner / AdminUI (out of domain).
- **Transfer disposition.** → `packages/bees` (factory as a function) + `packages/orchestration` · **G02**.
  Skills `heady-agent-factory` + `heady-swarm-template-ops` are the design/claim source.
- **Incorporation steps.** (1) Port `bee-templates.js` registry → `packages/bees`. (2) Reimplement factory
  as a pure function `template → parameterized handler instance`. (3) Bridge `template-engine.js` scorer as
  the selection front-end. (4) Add distiller feedback (recipe → new template).
- **⚠ Drift + ADR/law.** Two competing factory generations in legacy (`bee-factory.js` vs `-v2.js` vs
  `08-bee-factory.js`) — pick one on port (decision). ADR-0005 bounds what factory-spun bees may do.

### Swarm Coordination — routing, DAG, load-balancing, circuit breakers
- **Category:** macro orchestration · **Status:** legacy-only · **Confidence:** defined
- **What.** The HeadySwarm layer: route a task to the right swarm, decompose into a DAG, dispatch across
  bees with load-balancing and circuit-breaker protection, then converge.
- **Legacy (refs+paths).** `~/Heady/src/09-swarm-coordinator.js` (1331 ln), `~/Heady/src/headybee-swarm.js`
  (1464 ln), `~/Heady/agents/headybee-swarm.js` (1453 ln; AG-02 "salvage routing; drop Pinecone/Redis"),
  `~/Heady/agents/hive-coordinator.js` (413 ln), `~/Heady/src/headybee-swarm.js`.
  - **Routing — 5-tier fallback** (`09-swarm-coordinator.js` `_resolveSwarm`): (1) explicit swarmId
    `deterministic` → (2) **CSL cosine** `_cslRoute` (`cosineSimilarity(query, swarm.embedding) ≥
    cslThreshold/ψ`) → (3) domain string match (exact + fuzzy substring) → (4) LLM classification → (5)
    **Fibonacci-weighted load balance** `_fibLoadBalance` (`phiResourceWeights(17)`, descending Fib weights).
  - **DAG decomposition** (`headybee-swarm.js` `TaskDecomposer.decompose`): `simple` → 1 node;
    `medium` → 3 stages (preparation→execution→finalization, linear); `complex` → 7 stages (3 parallel
    analysis {validation,planning,optimization} → integration → 2 parallel execution → finalize); produces
    `{subtasks, graph{parents,children}, executionPlan[{level,taskIds}]}`.
  - **Circuit breakers** (both files): 3-state `closed → open → half-open`; `FAILURE_THRESHOLD`,
    `RECOVERY_TIMEOUT_MS`, `HALF_OPEN_MAX_PROBES`; open trips on consecutive fails, half-open probes recover.
  - **Topology:** hierarchical strategic/tactical/operational + Sacred-Geometry ring (HeadySoul center,
    inner/middle/outer rings); `phiFusionWeights`/`cslBlend` for fusion.
- **Rebuild (path).** none (no `packages/orchestration`). Primitives present: `packages/csl-engine`
  (cosine gate), `packages/phi-math` (φ-weights/backoff), `packages/resilience` (circuit breakers),
  `packages/events` (NATS bus, ADR-0020), `packages/task-ledger` (ADR-0027).
- **Parts.** router{deterministic, csl-cosine, domain-match, llm, fib-loadbalance} · decomposer{simple,
  medium, complex DAG} · circuit-breaker{closed/open/half-open} · topology{hierarchical + ring} ·
  consensus/locking (see next system) · global metrics{routingDecisions, loadBalance}.
- **OSS (current+planned).** legacy: in-process Node + (dropped) Pinecone/Redis; planned: **NATS** event
  bus (`facts.yaml: event_bus`, ADR-0020), **Cloudflare Workflows** durable execution
  (`facts.yaml: durable_execution`, ADR-0004), pgvector retrieval authority (ADR-0003), single-agent-first
  default (ADR-0005). LangGraph/CrewAI/AutoGen named only in the orchestration skill (not adopted).
- **UI.** swarm health / routing-decision metrics → observability + headylens; living-dashboard skill.
- **Transfer disposition.** → `packages/orchestration` (router, decomposer, topology) + `packages/resilience`
  (breakers) + `packages/engines` · group **G02**; A2A→NATS + CSL-ternary 3-layer gate per AG-17.
- **Incorporation steps.** (1) Port 5-tier router into `packages/orchestration`, back CSL tier with
  `@heady/csl-engine`. (2) Port `TaskDecomposer` DAG, replace ad-hoc stages with the task-decomposition skill
  contract. (3) Replace in-process dispatch with Cloudflare Workflow fan-out + NATS. (4) Reuse
  `@heady/resilience` for breakers. (5) Default single-agent (ADR-0005); spin a swarm only when tool overlap
  / prompt complexity proves it (compendium §8 "Reduced").
- **⚠ Drift + decisions + ADR/law.** Compendium counts **"33 module bees"** (Taxonomy A) vs lexicon
  **35** vs skill `heady-bee-swarm-ops` **"30+ bee types"** vs legacy **~73 `*-bee.js`** vs blueprint
  **"197 / 24 domains"** — the lexicon's **35 is canonical**; 33/30+/197 are drift/altitude artifacts.
  Decision: per-port (3310–3396) 1-process-per-bee deployment **superseded (R4)** — ports kept only as
  logical addressing. ADR-0005 (single-agent-first), ADR-0010 (token-budget caps concurrency, retires
  "≤10,000 concurrent" literal). AG-02 mandates dropping Pinecone/Redis on port.

### Swarm Consensus & Convergence
- **Category:** agreement / concurrency control · **Status:** legacy-only · **Confidence:** inferred
- **What.** Two distinct "consensus" notions co-exist: (a) **vote-fusion** — combine bee outputs into one
  result; (b) **lock-consensus** — prevent conflicting concurrent edits.
- **Legacy (refs+paths).** `~/Heady/src/orchestration/swarm-consensus.js` — **verified to implement
  lock-consensus**: distributed file locking + heartbeat (`acquire(file, owner) → heartbeat →
  release/expire`, exclusive/shared lock types, RAM-first, wait-queues, stale-timer). The
  **vote-fusion** math (`CONSENSUS = normalize(Σ wᵢ aᵢ)`, agreement `R ∈ [0,1]`, Byzantine quorum
  `N ≥ 3f+1`) is asserted by **compendium §5** and backed by `phiFusionWeights`/`cslBlend` imports in
  `09-swarm-coordinator.js`, but I did **not** locate a single function computing the weighted-fusion +
  Byzantine quorum in legacy code — hence **inferred**, not defined.
- **Rebuild (path).** none. `packages/csl-engine` would supply CONSENSUS/normalize; `packages/phi-math`
  supplies fusion weights.
- **Parts.** vote-fusion{`normalize(Σwᵢaᵢ)`, agreement R, Byzantine `N≥3f+1` for high-stakes / Multi-Model
  Council} *(design)* · lock-consensus{exclusive/shared locks, heartbeat, wait-queue, stale expiry}
  *(coded)* · convergence{Decompose→Provision→Execute→Converge→Deliver, compendium §5}.
- **OSS (current+planned).** legacy RAM-first locks; planned: CSL gates via `@heady/csl-engine`, durable
  coordination via Cloudflare Workflows + Durable Objects (ADR-0004).
- **UI.** consensus/agreement scores via observability; none dedicated.
- **Transfer disposition.** → `packages/orchestration` (fusion) + `packages/csl-engine` (CONSENSUS gate);
  lock-consensus → `packages/orchestration` or Durable-Object lock · **G02**.
- **Incorporation steps.** (1) Implement vote-fusion as `@heady/csl-engine` CONSENSUS over bee report
  embeddings. (2) Gate high-stakes paths with Byzantine quorum (Multi-Model Council, Domain 05). (3) Port
  lock-consensus onto Durable Objects (ADR-0004/0022) replacing RAM-first locks. (4) Persist
  consensus state to vector memory for audit (Domain 04).
- **⚠ Drift + ADR/law.** **Confidence drift:** compendium presents vote-fusion `normalize(Σwᵢaᵢ)` +
  `N≥3f+1` as if implemented; legacy `swarm-consensus.js` is actually a **file-lock manager** — verify
  before claiming the fusion math is ported. Convergence CSL threshold ≥0.70 (RBAC/governance, Domain 06).

### Stigmergy & Pheromone Coordination
- **Category:** indirect coordination · **Status:** planned · **Confidence:** inferred
- **What.** Coordination via the environment: each bee deposits a success/failure **pheromone**
  (embedding) that decays `intensity(t) = intensity₀ · e^(−t/φ)`; the router reads accumulated pheromone as
  a prior (successful paths attract, failures repel).
- **Legacy (refs+paths).** Hook exists — BaseHeadyBee emits success/failure on `bee:execute:complete`
  (`base-heady-bee.js`); the **decay + router-prior pipeline is described in compendium §1/§5**, not
  located as a discrete legacy module → inferred.
- **Rebuild (path).** none; would be rows in `events`/`facts` (Domain 04) with a decay function read by the
  model-mesh router (Domain 05).
- **Parts.** deposit (embedding on completion) · decay (`e^(−t/φ)`) · read (router prior).
- **OSS.** pgvector (`facts.yaml: retrieval_authority`) for embedding store; CF AI Gateway router (Domain 05).
- **UI.** none.
- **Transfer disposition.** → memory (Domain 04 `events`/`facts`) + model-mesh router (Domain 05) · G02-adjacent.
- **Incorporation steps.** (1) Write pheromone embeddings on bee `report()`. (2) Add decay function. (3)
  Bias router with accumulated pheromone.
- **⚠ Drift + ADR/law.** Design-level; verify the decay/read pipeline exists before marking built. Ties to
  ADR-0003 (pgvector authority), ADR-0015 (embedding model lock).

---

## Summary (6 lines)

1. **Bees covered:** all **35** canonical (`lexicon.yaml`); 34 `legacy-only`/`partial` in `~/Heady/src/bees/`, `ulti-bee` is `planned` (template-only, no module).
2. **Swarm systems covered (5):** BaseHeadyBee lifecycle, Bee Factory & Template Registry, Swarm Coordination (5-tier routing + DAG + load-balance + circuit breakers), Swarm Consensus & Convergence, Stigmergy/Pheromone.
3. **Rebuild status:** NONE built — no `packages/bees`/`orchestration`/`engines`, and since `ce4aa9ef53` not even the `template-engine.js` scorer (archived to `_archive/legacy-packages/`). All transfer via manifest **G02 → `packages/{bees,orchestration,engines}`**, whose landing is gated by `docs/hcp/HCP-0003-bee-swarm-runtime.md` → `docs/runbooks/APPROVAL_GENESIS_FOUNDER_RUNBOOK.md`.
4. **Drift flags (4):** (a) bee count 35 canonical vs compendium **33** vs skill **"30+"** vs legacy **~73** vs blueprint **197**; (b) BaseBee **timeout** 6854ms (code) vs 1618ms (compendium); (c) `swarm-consensus.js` is **file-locking**, not the vote-fusion `normalize(Σwᵢaᵢ)`/`N≥3f+1` the compendium asserts (confidence drift); (d) registry **fib(11)=89** vs "≤10,000 concurrent". (`maxRetries=8` is NOT a drift — same value, two formulas.)
5. **Open decisions (3):** canonical BaseBee timeout value (code vs compendium, rebuild implements neither); which factory generation to port (`bee-factory.js` vs `-v2.js` vs `08-bee-factory.js`); whether vote-fusion consensus is genuinely ported or must be built fresh in `@heady/csl-engine`.
6. **Law/ADR touchpoints:** ADR-0005 (single-agent-first, sandbox, human-approved PR), ADR-0010 (token-budget caps concurrency), ADR-0004 (Workflows/Durable Objects), ADR-0020 (NATS), ADR-0003/0015 (pgvector/embedding), LAW-07 (auto-success); R4 supersedes per-port 197-bee deployment; AG-02 drops Pinecone/Redis.
