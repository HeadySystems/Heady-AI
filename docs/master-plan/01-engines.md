# Domain 01 — Cognitive & Orchestration Engines

> **Inventory of the Heady™ Master Incorporation Plan, Domain 01.** Ground truth established from PRIMARY
> sources: legacy code (`src/*`, root `heady-manager.js`), `docs/compendium/03,05`, `facts.yaml`,
> `tooling/decomposition/manifest.json`, `docs/adr/*`, `docs/ADR/*`. `.agents/skills` and `.claude/skills`
> were treated as CLAIMS TO VERIFY only. **Note on roots:** `~/Heady` and `~/workspace/Heady` both symlink to
> THIS repo (`/home/headyme/Heady-AI`), so "legacy" = the non-package top-level dirs (`src/`, `agents/`,
> root `.js` files) and "rebuild" = `packages/*` + `tooling/*`.

**Domain summary.** This domain holds the cognition spine: the **HCFullPipeline** (the autonomous
orchestration DAG), the **auto-success-engine** (continuous background task processor), and the cluster of
named cognitive services (Conductor, Manager, Scientist, Battle/Arena, Monte-Carlo/Sims, Socratic, Brain,
Soul, Vinci, Buddy, Lens, Vault, Narrative/Autobiographer, etc.). Most engines exist as **legacy `src/` CJS
services** that are slated to be **decomposed/rewritten** into `packages/*` + Cloudflare Workflows. Only a
handful have a real rebuild package today (`@heady/perspective`, `@heady/headylens`, `@heady/secrets`,
`@heady/narrative`, `@heady/kernel`). The most consequential reconciliation: the canonical design is **21
stages (fib(8)=21)** but the buildable legacy implementation is the **9-stage "Arena" variant** — the design
and the implementation are deliberately different altitudes, and several engines (Maid, Codex, Council,
Autobiographer-name) are skill/doc/MCP claims with thin or no load-bearing code (DRIFT).

## Roll-up table

| Engine | Status | Legacy refs | Rebuild loc | Transfer | Confidence |
|---|---|---|---|---|---|
| HCFullPipeline | partial (5-step wired; 9/10 variants; 21 designed) | 65 (`src/hcfp/pipeline-runner.js` +3 more) | CF Workflows+Queues+DO (none yet) | rewrite (BE-11, G05) | defined |
| auto-success-engine | built (legacy) | 85 (`src/hc_auto_success.js`) | `packages/orchestration` (phantom) | rewrite (AG-05, G02) | defined |
| HeadyConductor | built (legacy) | 38 (`src/heady-conductor.js`) | `packages/orchestration`/engines (phantom) | rewrite (BZ-02, G05) | defined |
| HeadyManager | legacy-only (decomposing) | 8 (`heady-manager.js`) | `packages/kernel` + `src/middleware/*` | rewrite → 5 modules (BE-01/BE-02, G05) | defined |
| HeadyMaid | skill/MCP-only (no impl) | 12 (declarations only) | none | drop or rebuild (not mapped) | inferred |
| HeadyOrchestrator | partial (stub) | 4 (`src/orchestration/hc_sys_orchestrator.js`) | `packages/orchestration` (phantom) | rewrite/absorb (AG-05/06, G02) | defined |
| HeadyScientist | built (legacy) | 8 (`src/hc_scientist.js`) | `tooling/coherence` (consistency engine) | rewrite (DX-12, G11) | defined |
| HeadyBattle / Battle Arena | built (legacy) | 28 (`src/services/battle-arena.js`) | stage 09 of HCFP | rewrite (folds to stage 09) | defined |
| HeadyArena | built (legacy) | 2 (`src/services/arena-mode-service.js`) | stage 09 / model-mesh | rewrite | defined |
| HeadyCoder | legacy contender-config only | 18 (battle contexts) | `packages/code-gen` (planned) | rebuild (skill-driven) | inferred |
| HeadyPerspective | **built (rebuild)** | 8 + pkg | `packages/perspective` | rebuild (done) | defined |
| HeadySocratic | built (legacy, mislabeled class) | 0 name / impl in `src/services/socratic-service.js` | P3 wrapping loop / AGENTS.md | rewrite (folds to P3) | defined |
| HeadyMC / HeadySims / HeadySim | built (legacy, 3 impls) | 84/23 (`monte-carlo-service.js`, `hc_monte_carlo.js`, `monte-carlo.js`) | stage 08 of HCFP | rewrite (folds to stage 08) | defined |
| HeadySoul | legacy-only (route stub) | 13 (`src/routes/soul.js`) | node `heady-soul` (planned) | rewrite | defined |
| HeadyVinci | legacy-only (route stub) | 24 (`src/routes/vinci.js`) | node `heady-vinci` (planned) | rewrite | defined |
| HeadyBrain / HeadyBrains | built (legacy) | 34 (`src/routes/brain.js`) | node `heady-brain` (planned) | rewrite | defined |
| HeadyBuddy | built (legacy, multi-stack) | 123 (`src/routes/buddy.js` + configs) | `packages` + Buddy app (AG-14/15) | rebuild (G09 now / G13 mobile) | defined |
| HeadyLens | **built (rebuild + legacy)** | 52 + pkg | `packages/headylens` | rebuild (done) | defined |
| HeadyVault | **built (rebuild + legacy)** | 7 + pkg | `packages/secrets` | rewrite (done) | defined |
| HeadyKey | **patent-gated** (draft, no impl) | 8 (HCP-0001 + scripts) | `packages/secrets/rotation-executor` (locked) | patent-gated (HCP-0001) | defined |
| HeadyCodex | legacy stub only (DRIFT) | 7 (dispatcher claim) | none / absorb into Brain | drop or rebuild | inferred |
| HeadyAutobiographer | name-drift → `@heady/narrative` is the real thing | 0 (name); narrative pkg built | `packages/narrative` | rebuild (done) | defined |
| HeadyCouncil | architecture/directive-only (DRIFT) | 0 (name); 8 partial | model-mesh (`05`) / distributed | rebuild if critical-path | inferred |
| HeadyDeepIntel (discovered) | built (legacy) | (`src/hc_deep_intel.js`) | memory/vector domain | rewrite | defined |
| Cloud Orchestrator (discovered) | built (legacy) | (`src/orchestration/cloud-orchestrator.js`) | `packages/orchestration` (phantom) | rewrite (G02/G05) | defined |
| latent-os-engine (discovered) | planned (blueprint only) | docs only | `packages/orchestration`,engines (BZ-02) | rewrite (vision) | defined |

> **Phantom rebuild targets (open decision, see drift §D4):** the manifest routes many engines to
> `packages/orchestration`, `packages/bees`, `packages/engines`, `packages/projections` — **none of these
> packages exist yet.** Engines whose rebuild-loc points there are `planned`, not `built`.

---

## P1 — Master pipeline & continuous engines

### HCFullPipeline (HCFP)
- **Cognition/orchestration · partial (9-stage built, 21-stage designed) · defined**
- **What:** The end-to-end autonomous orchestration spine; a request passes through ordered stages
  (competition, simulation, judging, approval, verify, self-improvement) as a data-dependency DAG.
- **Legacy:** 65 refs. **FOUR coexisting implementations at different stage counts:**
  (a) **`src/hcfp/pipeline-runner.js` — 5 steps, ACTIVE/WIRED** (INGEST → DECOMPOSE → ROUTE → VALIDATE →
  PERSIST; wired at `bootstrap/service-routes.js:413`, `POST /api/hcfp/ingest` → `pipelineRunner.runFull()`);
  (b) `configs/pipeline/hcfullpipeline.yaml` — 10 named stages + 4 lane-based (DAG w/ checkpoint + hot/warm/
  cold pools); (c) `src/hc-full-pipeline.js` (666 ln) — **9-stage** EventEmitter class (health-probe only, used
  by `bees/pipeline-bee.js`, NOT route-wired); (d) `src/hc_pipeline.js` (1061 ln) — YAML-config DAG executor
  (topological sort + circuit breaker + cache). Stage logic also in `heady-manager.js`, `src/hc_qa.js`.
- **Rebuild:** target = **CF Workflows + Queues + DO** (BE-11/G05, ADR-0004). **No rebuild package exists
  yet** — `packages/kernel` only provides the Latent Service boot order, not the pipeline.
- **Parts (3 levels, per `docs/compendium/03` canonical 21-stage design):**
  - **Spine (critical path ≈16):** CHANNEL_ENTRY(00) → RECON(01) → INTAKE(02) → CLASSIFY(03, CSL Resonance `cos≥ψ`)
    → TRIAGE(04) → DECOMPOSE(05, Rabbit-layer subtask DAG) → TRIAL_AND_ERROR(06, sandbox ≥2 trials) →
    ORCHESTRATE(07, bee factory) → MONTE_CARLO(08, ≥80% pass) → ARENA(09, ≥5% margin) → JUDGE(10, 5-dim rubric
    .34/.21/.21/.13/.11) → APPROVE(11, Progressive Autonomy Gate) → EXECUTE(12, confidence≥ψ²) → VERIFY(13) →
    RECEIPT(20, ML-DSA/Ed25519 signed + trace distillation→recipe).
  - **Self-improvement off-path (MAPE-K):** SELF_AWARENESS(14) · SELF_CRITIQUE(15) · MISTAKE_ANALYSIS(16,
    5-Whys+Ishikawa) · OPTIMIZATION_OPS(17) · CONTINUOUS_SEARCH(18) · EVOLUTION(19, mutate→sim→measure→promote).
  - **Parallel pools:** A{RECON∥INTAKE} · B{TRIAL∥ORCHESTRATE} · C{MONTE_CARLO∥ARENA} ·
    D{SELF_AWARENESS∥SELF_CRITIQUE∥MISTAKE} · E{OPTIMIZATION∥CONTINUOUS_SEARCH}.
  - **Legacy 9-stage variant (`src/hc-full-pipeline.js` STAGES[]):** INTAKE → TRIAGE → MONTE_CARLO → ARENA →
    JUDGE → APPROVE → EXECUTE → VERIFY → RECEIPT. Each stage = {entry guard, exec, exit validation, rollback
    hook}; emits `stage:started/completed/failed/skipped`, `run:paused` (approval), `self-heal:match`.
  - **Ports per stage:** `step.do` (durable), `step.waitForEvent` (human gate @ APPROVE/11); fast in-flight =
    Redis Streams (best-effort).
- **OSS:** current = bespoke EventEmitter state machine + bespoke YAML topo-sort executor. Planned/potential =
  **Cloudflare Workflows** (durable, chosen ADR-0004) over Temporal (rejected); MAPE-K autonomic loop pattern.
- **UI/projection:** stage events surfaced via SSE; HeadyLens taps `stage:*` events; admin pipeline view.
- **Transfer disposition:** **rewrite** → CF Workflows+Queues+DO (BE-11, group **G05 backend-core-runtime**).
  Selective checkpointing (only externally-visible-state-mutating steps).
- **Incorporation steps:** (1) lock canonical stage list in `facts.yaml` (done: `stage_count: 21`). (2) Build
  buildable spine first (CLASSIFY→…→RECEIPT→DISTILL) as a Workflow; treat SELF_*/EVOLUTION as the MAPE-K loop
  (`06-G10`), not inline per-request. (3) Map each `step.do` to a node service. (4) Add `step.waitForEvent`
  human gate at APPROVE. (5) Wire RECEIPT → trust receipt + recipe distillation.
- **⚠ Drift / open decisions:** **D1 — STAGE COUNT DRIFT (confirmed, severe).** **FIVE different stage counts
  coexist in-repo:** canonical **21** (facts.yaml `hcfullpipeline.stage_count: 21` + `docs/compendium/03`,
  fib(8), terminal RECEIPT, DISTILL folded in) · **5** (the *actually wired* `src/hcfp/pipeline-runner.js`) ·
  **10** (`configs/pipeline/hcfullpipeline.yaml`) · **9** (legacy class `src/hc-full-pipeline.js`, header says
  *"9-Stage State Machine"*) · and a stale **22** in Directive 07 (compendium explicitly refutes as off-by-one).
  facts.yaml resolves: 21 is canonical; **Fast 7 / Arena 9 / Learning 7 are the named variants** — so the
  9-stage class = "Arena 9" and the 5-step runner is a further-reduced live spine. **Open decision:** the
  *running* code (5 steps) is far below the canonical design (21) — the rebuild must reconcile to the
  21-stage Workflow DAG (or formally bless 5/9 as the Phase-3 buildable subset). Any skill asserting
  "8-stage" or "22-stage" HCFP is DRIFT vs the coherence gate. ADR touchpoints: **ADR-0004** (durable
  orchestration), **ADR-0005/0016** (autonomy gate). Unbreakable-law: APPROVE(11) = Progressive Autonomy
  Gate (rustc stage0/1/2; "Approve all" forbidden).

### auto-success-engine
- **Continuous task processor · built (legacy) · defined**
- **What:** **Event-driven reactor** (NOT cycle/timer-based — header lines 65/101: *"No cycles, no timers, no
  intervals. Reacts instantaneously to system events"*) that generates/executes/"auto-succeeds" background
  tasks across **9 categories** (learning, optimization, integration, monitoring, maintenance, discovery,
  verification/liquidity, creative, deep-intel) — errors absorbed as learnings (ORS 100.0). Triggered by 30+
  event types (`state:changed`, `deploy:*`, `health:*`, `security:alert`, `bee:*`, `circuit:*`, etc.).
- **Legacy:** 85 refs. Primary: `src/hc_auto_success.js` (1656 ln) — `class AutoSuccessEngine extends
  EventEmitter`; exports `{AutoSuccessEngine, registerAutoSuccessRoutes, TASK_CATALOG, REACTION_TRIGGERS,
  TERMINAL_STATES}`. Catalog = **135 tasks × 9 categories** (header line 106) loadable from external JSON
  (`auto-flow-200-tasks.json`, `nonprofit-tasks.json`, `buddy-tasks.json`, etc.).
- **Rebuild:** manifest target = **`packages/orchestration`** (AG-05, paths `heady-10-10/`,
  `directives/source/` — those legacy paths are now archived/absent at root). **Package does not exist yet.**
  NOTE: `tooling/auto-flow/` is NOT this engine — it is a **CSL-gated skill/workflow preflight selector**
  (`preflight.mjs`); the auto-flow *skill* reinterprets the name. (See drift D2.)
- **Parts (2 levels):**
  - **Engine core:** `react(trigger,eventData)` dispatcher → filter tasks by trigger → group by category
    (`CAT_TO_BEE` map, 24 categories → bee domains) → `_delegateToBee(domain,tasks)` (load registry workers +
    dynamic per-task workers, fire all in parallel) → ingest results into vector memory → emit to event bus.
    TASK_CATALOG (135 core + external JSON) → TERMINAL_STATES.
  - **Persistence + integrations:** `data/auto-success-tasks.json` (max 2000), `auto-success-audit.json` (max
    10000), `trial-ledger.json` (immutable input-hash, max 5000); REACTION_TRIGGERS + PROBE_TARGETS;
    resource-aware safe-mode; `_patternEngine`, `_selfCritique`, `_storyDriver`, `_eventBus`. Bee interface:
    `src/bees/auto-success-bee.js`. Wires into HeadyConductor for orchestration visibility.
- **OSS:** current = bespoke. Planned = continuous-action / drift-detection skills; could ride CF Queues.
- **Transfer disposition:** **rewrite** → `packages/orchestration` (AG-05, group **G02 bee-swarm-runtime**).
  Consistency rule "auto-success-tasks: 135" is asserted by HeadyScientist — keep as a coherence invariant.
- **Incorporation steps:** (1) extract TASK_CATALOG to data (already JSON-loadable). (2) Rebuild engine as
  ESM under `packages/orchestration`. (3) Move cycle dispatch to CF Queues (no fake "100% success" — surface
  real failure states; the "errors as learnings" framing must not hide hard failures). (4) Re-wire to
  consistency engine for the 135/9 invariant.
- **⚠ Drift:** **D2 — name reuse + chain conflation.** (i) The `heady-auto-flow` skill + `tooling/auto-flow/`
  describe a *preflight shortlister*, not the legacy 135-task auto-success engine. (ii) The skill's claimed
  **"Battle → Coder → Analyze → Risks → Patterns" chain is NOT in auto-success** — no such methods exist in
  `hc_auto_success.js`; that DECOMPOSE→CONTEST(MC+Battle)→CODE(HeadyCoder) phase chain actually lives in
  `src/orchestration/cloud-orchestrator.js`. The skill conflates two distinct engines. (iii) "100% success /
  ORS 100.0 always" is aspirational framing that must reconcile with the real VERIFY gate — do not carry
  literal "always succeeds" into the rebuild.

---

## P2 — Orchestration & control services

### HeadyConductor
- **Federated router · built (legacy) · defined**
- **What:** Central traffic controller for the multi-agent swarm; routes tasks to best-matched service
  groups via federated liquid routing (task/zone/brain/pattern). Maps to node `heady-conductor`.
- **Legacy:** 38 refs. Primary: `src/heady-conductor.js` (442 ln, `class HeadyConductor extends EventEmitter`)
  + `src/orchestration/heady-conductor.js` (unified-swarm variant).
- **Rebuild:** node `heady-conductor` (compendium P4); manifest BZ-02 latent-os-engine → `packages/
  orchestration, engines` (phantom).
- **Parts (2 levels):**
  - **Routing:** `route(task,ip)`/`routeSync(task)` → `{routeId,action,serviceGroup,vectorZone,pattern,
    weight,latency,ts}`; ROUTING_TABLE (19 service groups / 50+ actions); PATTERN_OPTIMIZATIONS (13);
    GROUP_WEIGHTS (load-aware).
  - **Layers:** `taskRouter` (dynamic-table, active) · `vectorZone` (3d-spatial-octant, inactive) ·
    `brainRouter` (hc-sys-orchestrator) · `patternEngine` (active).
  - **Execution mgmt:** retry budget per task, `taskAttempts`, `deadLetterQueue` + requeue, `_swarmPulse`,
    JSONL audit (`/data/conductor-audit.jsonl`). Auto-wires CognitiveRuntimeGovernor + governance RBAC.
  - **Ports:** `GET /api/conductor/{status,route-map,health,swarm-health,dlq}`, `POST
    /api/conductor/{tasks/outcome,dlq/:id/requeue,analyze-route}`.
- **OSS:** bespoke; planned = CF AI Gateway as the routing chokepoint (ADR-0018 liquid routing).
- **UI/projection:** route-map visualization endpoint; swarm-health.
- **Transfer disposition:** **rewrite** → `packages/orchestration`/engines (BZ-02, group **G05**); routing
  policy aligns with ADR-0018 model-gateway liquid routing.
- **Incorporation steps:** (1) extract ROUTING_TABLE/PATTERN/WEIGHTS to config. (2) Rebuild as ESM service.
  (3) Front with CF AI Gateway. (4) Keep DLQ + retry-budget; wire to event bus (ADR-0020).
- **⚠ Drift:** rebuild target package is phantom (D4). ADR-0018 (liquid routing), ADR-0020 (event bus).

### HeadyManager
- **Godserver / service bootstrap · legacy-only (decomposing) · defined**
- **What:** Main HTTP gateway + service orchestrator — wires auth, CORS, routing, health, secrets, and 40+
  services into one runtime.
- **Legacy:** 8 refs. Primary: root `heady-manager.js` (~76 KB monolithic **CJS**); kernel target
  `core/heady-manager-kernel.js` (BE-02).
- **Rebuild:** `packages/kernel` (Latent Service boot ordering, microkernel) + 5 ESM modules per **ADR-0037**.
- **Parts (2 levels):**
  - **Current monolith concerns:** middleware (helmet/compression/CORS) · secrets (GCP SM + env) · request-id
    + graceful shutdown · EdgeContextCache · service routes (`/api`, claude, vm, imagination) · Sentry · multi-
    domain site renderer · rate-limit.
  - **ADR-0037 target modules:** `auth-middleware` (`src/middleware/auth.js`, Governance) · `cors-policy`
    (`src/middleware/cors.js`, Governance) · `route-orchestrator` (`src/routes/orchestrator.js`, Center) ·
    `health-monitor` (`src/monitoring/health.js`, Ops) · `manager-core` (`src/core/manager.js`, Inner).
- **OSS:** Express today; rebuild → `@heady/kernel` microkernel + Latent Service Pattern.
- **Transfer disposition:** **rewrite** (decompose-then-rebuild) → `packages/kernel` + 5 modules (BE-01/BE-02,
  group **G05**). `mark: adapt`, `history: filter-repo` (secret scrub on git history).
- **Incorporation steps:** (1) Phase-1: fix two **P0 security bugs** — timing-attack token compare
  (`heady-manager.js:223` → `crypto.timingSafeEqual`) and CORS wildcard `*` with credentials
  (`heady-manager.js:142`). (2) Decompose into 5 ESM modules. (3) ESM-only migration (ADR-0011). (4) Move
  magic numbers to `core/constants/phi.js` (ADR-0006).
- **⚠ Drift / law touchpoints:** **ADR-0037** mandates decomposition BEFORE any further `heady-manager.js`
  change merges to `rebuild`. P0 security = **SEC-002 fail-open auth** + the CORS wildcard (security-mesh
  law). Blocks ADR-0018 CI gates until decomposed. **No placeholders** — the two P0 fixes are action-now.

### HeadyOrchestrator
- **Multi-brain router · partial (stub) · defined**
- **What:** Thin HTTP router for brain registry + task routing decisions; not production-critical.
- **Legacy:** 4 refs. Primary: `src/orchestration/hc_sys_orchestrator.js` (~52 ln) — health, `/route`,
  `/brains`, `/layers` endpoints returning static scaffolding (1 active brain, 3 layers).
- **Rebuild:** absorbed by HeadyConductor `brainRouter` layer; manifest AG-05/AG-06 → `packages/
  orchestration` (phantom).
- **Parts:** `/route` (echoes routing decision) · `/brains` (single heady-brain) · `/layers`
  (perception/reasoning/action) — all stubs, no real logic.
- **Transfer disposition:** **rewrite/absorb** into Conductor (AG-05/AG-06, group **G02**).
- **Incorporation steps:** fold into HeadyConductor; do not rebuild as a separate service.
- **⚠ Drift:** named as an "engine" but is a placeholder; real routing lives in Conductor. Phantom target (D4).

### HeadyMaid
- **Cleanup/maintenance · skill/MCP-only (no impl) · inferred**
- **What:** *Claimed* system cleanup/scheduling/housekeeping.
- **Legacy:** 12 refs — all MCP tool declarations (`src/heady-mcp-server.js`, `src/mcp/colab-mcp-bridge.js`),
  narrative mentions, and doc/registry references. **No `class HeadyMaid`, no implementation.** Candidate
  related code: `src/routes/maintenance.js` (exists, not wired to "HeadyMaid").
- **Rebuild:** none. Not in the manifest as a distinct component.
- **Transfer disposition:** **drop** the name, or **rebuild** as a real maintenance service wired to
  `src/routes/maintenance.js` (not mapped to a transfer group).
- **⚠ Drift:** **D3 — skill/MCP-only claim with zero load-bearing code.** Either implement against
  `maintenance.js` or remove the MCP tool to avoid a dead-end integration (no-placeholders law).

---

## P3 — Quality core (Monte-Carlo · Arena · Judge · Socratic)

### HeadyBattle / Battle Arena
- **Competitive evaluation · built (legacy) · defined**
- **What:** Multi-candidate / multi-model competition (HCFP **stage 09**, ≥5% margin, seeded PRNG). Legacy
  battle-arena dispatches the full project spec to 10 AI models to rebuild Heady in parallel repos.
- **Legacy:** 28 refs. Primary: `src/services/battle-arena.js` (528 ln). CONTENDERS = 10 (HeadyJules/Claude,
  HeadyCompute/GPT, HeadyPythia/Gemini, HeadyFast/Groq, Jules, Codex, HeadyResearch/Perplexity, HFModels,
  HeadyCoder, HeadyBuddy=judge). State machine IDLE→DISPATCHING→IN_PROGRESS→JUDGING→COMPLETE.
- **Rebuild:** **folds into HCFP stage 09 (ARENA)**; productization per `heady-arena-productization` skill.
- **Parts (2 levels):** blueprint generator → contender dispatch (per-model context optimizer) → result
  capture → JUDGE (5-dim rubric). Ports: `/api/battle/{start,status,blueprint,context/:id,repos,
  dispatch/:id,result/:id,contenders}`.
- **OSS:** bespoke; planned = model-mesh / AI Gateway routing for contender providers.
- **Transfer disposition:** **rewrite** → folds to stage 09 (group **G05** pipeline; model routing G04).
- **⚠ Drift:** `class` in `socratic-service.js` is mislabeled `HeadyBattleService` (see Socratic). The skill
  claim "Multi-Model Council/Battle Arena" maps to stages 09/10 + model-mesh, not a standalone service.

### HeadyArena
- **Tournament optimizer · built (legacy) · defined**
- **What:** Continuous tournament-based strategy selection ("always competing").
- **Legacy:** 2 refs. Primary: `src/services/arena-mode-service.js` (~600 ln, `class ArenaModeService extends
  EventEmitter`). 8 strategy competitors (fast_serial, fast_parallel, balanced, thorough, cached_fast,
  probe_then_commit, monte_carlo_optimal, imagination_engine); tournament cycles, champion tracking.
- **Rebuild:** folds into stage 09 / model-mesh.
- **Transfer disposition:** **rewrite** (folds to stage 09; group **G05**).
- **⚠ Drift:** overlaps HeadyBattle (strategy-arena vs model-arena) — unify under one ARENA stage.

### HeadyMC / HeadySims / HeadySim (Monte-Carlo)
- **Simulation · built (legacy, 3 impls) · defined**
- **What:** HCFP **stage 08** — 1K+ scenario Monte-Carlo, ≥80% pass before proceeding.
- **Legacy:** 84/23 refs. THREE impls: `src/services/monte-carlo-service.js` (578 ln, `HeadySimsService`,
  UCB1 multi-armed bandit over 7 strategies) · `src/hc_monte_carlo.js` (64 ln, `MCPlanScheduler` lightweight
  drift detector) · `src/monte-carlo.js` (162 ln, `MonteCarloEngine`, seeded Mulberry32 PRNG, 10K iters,
  Green/Yellow/Orange/Red readiness grading + mitigations).
- **Rebuild:** **folds into HCFP stage 08 (MONTE_CARLO)**.
- **Parts (2 levels):** strategy registry (7) → UCB1 selection → execute-with-strategy → perf update →
  optimize; scenario sim → confidence bounds → risk grade → top mitigations.
- **Transfer disposition:** **rewrite/consolidate** the 3 impls → one stage-08 module (group **G05**).
- **⚠ Drift:** three overlapping implementations; consolidate to avoid divergence. "Always succeeds" framing
  must yield to the real ≥80% pass gate.

### HeadySocratic
- **Socratic loop · built (legacy, class mislabeled) · defined**
- **What:** Pre-action interrogation (HCFP wrapping protocol **P3**, 7 questions before any code) + ethical
  validation. 4 weighted question categories: purpose .30 / consequences .25 / optimization .25 / ethics .20;
  min score 0.80.
- **Legacy:** Primary: `src/services/socratic-service.js` (678 ln). **⚠ The class is literally named
  `class HeadyBattleService extends EventEmitter`** (line 19) — a copy-paste naming bug; the file is the
  Socratic engine. `interrogate()`, `validateChange()`, `scoreResponse()`, `generateFollowUp()`.
- **Rebuild:** folds into the **P3 Socratic Execution Loop** (encode in AGENTS.md) — not a standalone service.
- **Transfer disposition:** **rewrite** (folds to P3 baseline; group **G11 governance-docs-skills**).
- **⚠ Drift:** **D5 — class-name bug** (`HeadyBattleService` inside socratic-service.js). Fix on rewrite.

### Judge / Multi-Model Council
- **Decision aggregation · built(Judge, in-pipeline) / architecture-only(Council) · defined/inferred**
- **What:** JUDGE (stage 10) = 5-dim weighted rubric (.34/.21/.21/.13/.11). Council = parallel models →
  anonymous cross-critique → chairman aggregation (Byzantine quorum N≥3f+1); 85% queries single-model.
- **Legacy:** Council declared in `governance/directives/09-multi-model-council.md`; partial logic in
  `src/routes/battle.js` (racer_a/b/c) + `src/hc_liquid.js` (CSL-scored routing). **No unified council
  orchestrator.**
- **Rebuild:** `docs/compendium/05-model-mesh.md`; Judge = HCFP stage 10.
- **Transfer disposition:** Judge **rewrite** (stage 10, G05); Council **rebuild-if-critical-path** (G04/G05)
  or keep distributed across battle/liquid/router.
- **⚠ Drift:** **D6 — HeadyCouncil is directive/architecture-only**, no orchestrator. Single-model fast-path
  is the default (cost); Council only for HIGH/CRITICAL.

---

## P4 — Cognitive node services (Brain · Soul · Vinci · DeepIntel · Scientist)

### HeadyBrain / HeadyBrains
- **AI interaction hub · built (legacy) · defined** — node `heady-brain`.
- **What:** Core multi-provider AI hub (chat/embed/analyze/refactor/complete/search) via HeadyGateway SDK;
  disk-backed session memory (50-msg sliding window).
- **Legacy:** 34 refs. Primary: `src/routes/brain.js` (~300 ln). Depends on `heady-hive-sdk/lib/gateway` +
  `providers`; sets `vectorMemory`; logs to `BRAIN_LOG_PATH`.
- **Rebuild:** node `heady-brain` (planned); pairs with model-mesh + memory domain.
- **Transfer disposition:** **rewrite** (group **G05**; model routing G04, memory G03).
- **⚠ Drift:** depends on `heady-hive-sdk` (AG-06 hive-sdk → `packages/orchestration`, phantom).

### HeadySoul
- **Consciousness/optimization layer · legacy-only (route stub) · defined** — node `heady-soul`.
- **What:** Route stub implementing a "consciousness-physics" model (ΔS ∝ Focus×Energy×Time); `/analyze`,
  `/optimize` with hardcoded scores.
- **Legacy:** 13 refs. Primary: `src/routes/soul.js` (60 ln). Memory-ops skill references HeadySoul but the
  real rebuild for ephemeral state is `packages/memory-stream`.
- **Rebuild:** node `heady-soul` (planned); memory domain (`packages/memory-stream`).
- **Transfer disposition:** **rewrite** (G03/G05); replace hardcoded scores with real signals.
- **⚠ Drift:** scores are hardcoded placeholders — must be real on rebuild (no-fake-data law).

### HeadyVinci
- **Learning/prediction · legacy-only (route stub) · defined** — node `heady-vinci`.
- **What:** Route stub for supervised learn/predict with per-category in-memory store (100 samples/cat cap).
- **Legacy:** 24 refs. Primary: `src/routes/vinci.js` (66 ln); confidence = `0.82 + random*0.15` (placeholder).
- **Rebuild:** node `heady-vinci` (planned).
- **Transfer disposition:** **rewrite** (G05); replace random confidence with a real model.
- **⚠ Drift:** randomized confidence is fake data — flag for real implementation.

### HeadyDeepIntel (discovered sibling)
- **Multi-perspective analysis · built (legacy) · defined**
- **What:** Deep-scans the ecosystem and stores findings in a 10-perspective 3D-vector schema; orchestrates
  Research+Sims+Battle for competitive analysis.
- **Legacy:** Primary: `src/hc_deep_intel.js` (383 ln). 10 perspectives (structural 1.0, behavioral .9, perf
  .8, security 1.0, quality .7, evolutionary .6, narrative .8, competitive .9, integration .85, resilience
  .75). 3D positioning (x=structural_depth, y=behavioral_complexity, z=integration_density).
- **Rebuild:** memory/vector domain (`docs/compendium/04`).
- **Transfer disposition:** **rewrite** (group **G03 data-memory-vector**).
- **⚠ Drift:** the "10 deep-intel perspectives" count is a HeadyScientist consistency invariant — keep.

### HeadyScientist
- **Consistency/determinism validator · built (legacy) · defined**
- **What:** Watches config drift, runs consistency scans vs ground-truth values, validates determinism via
  SHA-256 proof chains, emits predictions. φ-interval scans (~97s).
- **Legacy:** 8 refs. Primary: `src/hc_scientist.js` (559 ln, `class HeadyScientist extends EventEmitter`).
  CONSISTENCY_RULES assert: auto-success-tasks=135, categories=9, service-count=40+, verticals=17, phi-
  interval=16180ms, deep-intel-perspectives=10, scientist-active. Proof chain (SHA-256, max 200), EWMA
  determinism score (0.7·prev+0.3·cur), state in `data/scientist-state.json`.
- **Rebuild:** **`tooling/coherence`** (consistency engine) — already partially realized (DX-12).
- **Transfer disposition:** **rewrite** → `tooling/coherence` + consistency-bus (DX-12, group **G11**).
- **⚠ Drift / law touchpoints:** this engine IS the drift detector; its rule "auto-success-tasks=135" must
  match the auto-success engine (it does). Hardcoded counts (40+ services, 17 verticals) should be sourced
  from `facts.yaml`, not duplicated. ADR-0025 (strict global consistency / non-orphanage governance).

---

## P5 — Companion, observation & secrets engines

### HeadyBuddy
- **Cross-device companion · built (legacy, multi-stack) · defined** — node `heady-buddy`.
- **What:** Multi-modal cross-device companion (web chat, Android, thin-client service worker). Extracted from
  heady-manager.js. Runs a continuous pipeline + suggestions + orchestrator surface.
- **Legacy:** 123 refs (highest). Primary: `src/routes/buddy.js` (~300+ ln, `mountBuddyRoutes(app,deps)`) +
  `configs/INSTALLABLE_PACKAGES/HeadyBuddy/` (web) + `.../HeadyBuddyDevice/app/sw.js` (thin client).
  Ports: `/api/buddy/{health,chat,suggestions,orchestrator,pipeline/continuous,state,sync-events}`. Wires
  storyDriver, resourceDiagnostics, patternEngine, selfCritiqueEngine.
- **Rebuild:** **Buddy app** (manifest AG-14, group **G09 frontend-console-ui**); mobile = AG-15 (**G13
  deferred-postlaunch**).
- **Parts (2 levels):** router (DI deps) → continuousPipeline {running,cycleCount,gateResults} → session-aware
  chat (activeNodes registry) → resource diagnostics (CPU/RAM/bottleneck) → device bridge / computer-use.
- **OSS:** Vite/React (web) · Kotlin/Compose (Android) · service worker (thin client); skills
  `heady-buddy-device`, `heady-buddy-permission-ops`, `heady-cross-device-sync-fabric`.
- **Transfer disposition:** **rebuild** — web now (G09), mobile deferred (AG-15/G13). Permission graph +
  delegation vault per `06-governance`.
- **⚠ Drift:** fragmented across 3 stacks/configs — consolidate. Permission/delegation is a governance-law
  touchpoint (consent flows, what Buddy may do on the user's behalf).

### HeadyLens
- **Differential observer · built (rebuild + legacy) · defined**
- **What:** Taps every service's events/logger/observability → time-ordered, detail-graded, redacted stream
  with query + SSE API.
- **Legacy:** 52 refs. Primary rebuild: **`packages/headylens/src/`** (server, collector, record, store) —
  `createLens()` = RingStore (in-memory ring, capacity/TTL) + optional NdjsonStore (durable); `createCollector`
  taps bus+logger+observability; record taxonomy (tier, detail-grading, redaction). Legacy route:
  `src/routes/lens.js` (~250 ln) — serviceTruth/snapshots/differentials, MONITORED_ENDPOINTS (φ⁵≈11090ms).
- **Rebuild:** **`packages/headylens` (BUILT).**
- **Transfer disposition:** **rebuild (done)** — group **G08 infra-cicd-observability**. Signed
  audit-of-record deferred (G5/G9 per memory).
- **⚠ Drift:** none material; legacy route is superseded by the package. Captures HCFP `stage:*` +
  `@heady/narrative` events.

### HeadyVault
- **Credential vault · built (rebuild + legacy) · defined**
- **What:** Fail-closed secret resolution (GCP Secret Manager + env fallback); RAM-first encrypted store.
- **Legacy:** 7 refs. Rebuild: **`packages/secrets/src/`** — `loadSecrets()` (fail-closed), SECRETS registry,
  `providerFor`, `resolveSecrets`, `planRotation` (Fibonacci cadence). Legacy: `src/services/secure-key-vault.js`
  (AES-256-GCM, PBKDF2 100k iters, 14 credential domains). + `heady-secrets` CLI.
- **Rebuild:** **`packages/secrets` / `@heady/secrets` (BUILT).** HeadyVault deployed (per memory).
- **Transfer disposition:** **rewrite (done)** — group **G06 auth-security**. Secret injection only — never
  plaintext (org security law).
- **⚠ Drift:** rotation **executor** is patent-gated (see HeadyKey); only `planRotation()` exists today.

### HeadyKey
- **Secret-rotation executor · patent-gated (draft, no impl) · defined**
- **What:** *Proposed* zero-downtime rotation executor (Fibonacci-cadence + dual-key-overlap).
- **Legacy:** 8 refs. Primary: `docs/hcp/HCP-0001-headykey-rotation-executor.md` (status: draft,
  `patent_locked_zone: true`, required_count: 2) + `scripts/provider-setup/05-headykey-deploy.sh`.
- **Rebuild:** proposed `packages/secrets/src/rotation-executor.mjs` + security-mesh overlay — **LOCKED**.
- **Transfer disposition:** **patent-gated** (HCP-0001) — group **G12 patent-ip**. Blocked on 2-approver
  clearance + open questions (U1 pin HS-2026-0NN claim, U2 overlap window, U3 dual-secret verifyRequest).
- **⚠ Drift / law touchpoints:** **patent-locked zone (HS-2026-051…062, G9 crypto-governance band).** Use the
  **ARBITER** agent before touching. Do NOT implement until HCP-0001 is approved.

### HeadyCodex
- **Code knowledge engine · legacy stub only · inferred**
- **What:** Claimed `/api/codex/generate` (code-transform, documentation).
- **Legacy:** 7 refs — dispatcher claim in `src/hc_service_dispatcher.js` + `configs/battle-contexts/codex-
  context.json`. **No route file / implementation.**
- **Rebuild:** none — absorb into HeadyBrain `/refactor` or formally drop.
- **Transfer disposition:** **drop** the standalone claim or **rebuild** inside Brain (not mapped).
- **⚠ Drift:** **D7 — dispatcher stub with no implementation.** Dead-end endpoint claim.

### HeadyCoder
- **Code generation · legacy contender-config only · inferred**
- **What:** Multi-model code gen / refactor / inline suggestions (HeadyCodex+HeadyCopilot+HeadyRefactor).
- **Legacy:** 18 refs — mostly battle contender definition (`configs/battle-contexts/headycoder-context.json`,
  status READY) + skill `heady-code-generation`. No standalone engine implementation found.
- **Rebuild:** `packages/code-gen` (planned, skill-driven) — to be rebuilt via Battle Arena evaluation.
- **Transfer disposition:** **rebuild** (skill-driven; not directly in manifest).
- **⚠ Drift:** named as an engine but exists as a contender spec + skill, not load-bearing code.

### HeadyAutobiographer → @heady/narrative
- **Narrative engine · built (rebuild) · defined**
- **What:** Build-story narrator: publishes typed narrative beats onto the `@heady/events` bus (does not
  store/serve — HeadyLens captures; UI presents).
- **Legacy:** 0 refs for the literal name "HeadyAutobiographer." Rebuild: **`packages/narrative/src/index.mjs`**
  — `createNarrator(bus,scope)`, frozen `BEAT` vocab (PLAN/START/PROGRESS/DECISION/GATE/DONE/BLOCKED/FAIL),
  `narrateStep()`, subject prefix `heady.action.build.`.
- **Rebuild:** **`packages/narrative` / `@heady/narrative` (BUILT).**
- **Transfer disposition:** **rebuild (done)** — separation of concerns: bus delivers, Lens captures, UI shows.
- **⚠ Drift:** **D8 — name drift.** "HeadyAutobiographer" (domain prompt + some docs) has no code under that
  name; the real engine is `@heady/narrative`. Treat as the same concept; standardize the name.

### latent-os-engine (discovered)
- **Architectural vision · planned (blueprint only) · defined**
- **What:** Future VSA/latent-space execution paradigm (10K-dim hypervectors, no relational DB, autonomous
  self-modification).
- **Legacy:** docs only — `docs/blueprints/latent-os-*.md`, `docs/strategic/latent-os-blueprint.md`,
  `heady-latent-os-commander.plugin` (manifest BZ-02 path `heady-latent-os`). No runtime code.
- **Rebuild:** BZ-02 → `packages/orchestration, engines` (phantom).
- **Transfer disposition:** **rewrite** as a long-horizon vision (group **G05**); ADR-0000 already **rejected**
  "RAM-first latent as truth" — pgvector is retrieval authority (ADR-0003).
- **⚠ Drift:** ADR-0000 constrains the latent-OS ambition; keep as design, not near-term build.

---

## Cross-cutting DRIFT register & open decisions

- **D1 — HCFP stage count (PRIMARY confirmed, severe).** **FIVE counts coexist:** canonical **21** (facts.yaml
  `stage_count: 21` + `docs/compendium/03`) · **5** (the *actually wired* `src/hcfp/pipeline-runner.js`) · **10**
  (`configs/pipeline/hcfullpipeline.yaml`) · **9** (legacy class `src/hc-full-pipeline.js` = "Arena 9" variant) ·
  stale **22** (Directive 07, refuted). facts.yaml names the variants (Fast 7 / Arena 9 / Learning 7); the
  running 5-step path is below all of them. **Open decision:** reconcile running code to the 21-stage Workflow
  DAG, or bless 5/9 as the Phase-3 buildable subset. Any prose/skill asserting "8-stage" or "22-stage" HCFP is
  DRIFT vs the coherence gate. (Extends prior finding: HCFP is 21, not 8/22 — and the live impl is only 5.)
- **D11 — discovered Cloud Orchestrator.** `src/orchestration/cloud-orchestrator.js` holds the real phase
  chain DECOMPOSE→CONTEST(MC+Battle)→CODE(HeadyCoder) that the auto-flow skill mis-attributes to
  auto-success. Inventory it as its own orchestration engine (rebuild → `packages/orchestration`).
- **D2 — auto-flow name reuse.** `tooling/auto-flow/` + `heady-auto-flow` skill = a CSL-gated preflight skill
  selector, NOT the legacy 135-task `AutoSuccessEngine` (`src/hc_auto_success.js`). Do not conflate; the
  manifest's AG-05 target `packages/orchestration` is the real rebuild home.
- **D3 — HeadyMaid** = MCP/skill-declared with **no implementation** → drop or implement against
  `src/routes/maintenance.js`.
- **D4 — Phantom rebuild target packages.** `packages/orchestration`, `packages/bees`, `packages/engines`,
  `packages/projections` are manifest targets but **do not exist**. Every engine routed there is `planned`,
  not `built`. **Open decision:** create these packages (and which engines land in each) before claiming any
  of Conductor/Orchestrator/auto-success/latent-os/hive-sdk as "rebuilt."
- **D5 — `socratic-service.js` class is mislabeled `HeadyBattleService`** (copy-paste bug). Fix on rewrite.
- **D6 — HeadyCouncil** = governance directive (`09-multi-model-council.md`) only; no unified orchestrator —
  rebuild only if it becomes critical-path, else keep distributed.
- **D7 — HeadyCodex** = dispatcher stub claim, no route → dead-end; drop or fold into Brain.
- **D8 — HeadyAutobiographer** name has no code; the real engine is `@heady/narrative` — standardize naming.
- **D9 — Triple Monte-Carlo** implementations (`monte-carlo-service.js`, `hc_monte_carlo.js`, `monte-carlo.js`)
  — consolidate into one stage-08 module on rewrite.
- **D10 — "Always succeeds / 100% ORS"** framing in auto-success and "always competing/100% uptime" in
  Arena/Sims/Socratic must reconcile with real VERIFY gates — do not carry literal infallibility claims into
  the rebuild (no-fake-data / observability law).
- **Unbreakable-law touchpoints:** APPROVE/11 Progressive Autonomy Gate (ADR-0005/0016, rustc stage0/1/2,
  "Approve all" forbidden) · HeadyManager P0 security (SEC-002 fail-open + CORS wildcard, ADR-0037 must
  decompose first) · HeadyKey HCP-0001 patent-lock (HS-2026-051…062, ARBITER gate) · VSA integration patent
  HS-058 (BZ-05) · strict global consistency / non-orphanage (ADR-0025) enforced by HeadyScientist →
  `tooling/coherence`. ADR-0037 (Manager decomposition) and ADR-0004 (durable orchestration) are the two
  immediate decision anchors for this domain.
