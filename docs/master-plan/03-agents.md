# 03 — Agents

> Domain 03 of the Heady™ Master Incorporation Plan. Inventories the **8 canonical cognitive
> agents** (lexicon.yaml), the **agent harness** that runs them, the **HeadyPerspective role
> system** (the rebuild's only *built* artifact in this domain), and the **cognitive
> archetypes + node topology** (HeadySoul center → inner/middle/outer rings).
>
> Ground-truth priority: lexicon.yaml + legacy + `packages/perspective` > compendium > decomposition
> manifest > ADRs > skills (claims only, verified). Count authority for this domain is
> `.data/coherence/variable-registry.json`, the input the perspective system actually trains on.

---

## Domain summary

The "agents" domain is **four distinct, non-isomorphic taxonomies** that skills routinely conflate.
Keeping them separate is the load-bearing fact of this domain:

1. **8 cognitive agents** (Alpha, Risk, Execution, Sentinel, Compliance, Data, View, Bridge-Builder) —
   the HeadySwarm leadership roles, authored in `lexicon.yaml`. Trading-desk-style functional roster.
2. **7 cognitive archetypes** (OWL, EAGLE, DOLPHIN, RABBIT, ANT, ELEPHANT, BEAVER) — always-on
   reasoning lenses, not services. Plus an **archetype→node functional mapping** (Sovereign,
   Architect, Executor, Guardian, Librarian, Analyst, Researcher, Distiller) — 8 functions.
3. **11 personas** (animal interaction masks) — selectable, not always-on.
4. **Node topology** — HeadySoul at center, then Inner / Middle / Outer rings + a Governance Shell;
   ~21 logical service nodes. This is the *deployment/positional* model, not the cognitive one.

**Reality of the rebuild:** only `packages/perspective` exists. The agent **runtime**
(`packages/bees`, `packages/orchestration`, `packages/engines`) is **not yet built** — the 8 agents
are *defined* (lexicon + perspective roles, weight 0.9) but their execution surface is *planned*
(G02 → `packages/bees`; AG-13 → AI-SDK-v6 agents). The harness is decided (ADR-0016: Vercel AI SDK v6,
Claude Agent SDK **rejected as harness**) but not yet implemented. Archetypes/personas are a
**prompt-architecture pattern** for `AGENTS.md` + the system prompt, never services.

**Verified counts** (`.data/coherence/variable-registry.json`): `agent: 8`, `bee: 35`, `skill: 135`,
`decision: 30`, `fact: 45`. The `heady-agent-orchestration` skill's "8 agent names" is **correct**;
the memory-cited "8 agents/35 bees/134 skills" has a **stale 134** (now 135). lexicon enumerates **35**
bees (matches registry). See drift flags per system.

---

## Roll-up — the 8 canonical agents

All 8 are **defined** (lexicon.yaml + perspective `KIND_WEIGHT.agent = 0.9`); none has a built runtime.
The roster is **rebuild-canonical** — only **Bridge-Builder** has a clean legacy lineage (the Cathedral
"Sacred Role" Bridge Builder = Middleware/API Gateway). Alpha/Risk/Execution/Sentinel/Compliance/Data/
View read as functional roles authored in lexicon, not legacy carryovers; do not fabricate legacy paths.

| Agent | Role (lexicon) | Status | Legacy refs | Rebuild loc | Transfer |
|---|---|---|---|---|---|
| **Alpha** | Strategic lead — sets objective, decomposes, routes work | Defined; runtime planned | rebuild-canonical (lexicon); no direct legacy | perspective role (0.9); runtime → `packages/orchestration` (absent) | G02 |
| **Risk** | Scores downside, exposure, blast radius before action | Defined; runtime planned | rebuild-canonical; cf. legacy "HeadyRisks" governance-shell node | perspective role; runtime planned | G02 |
| **Execution** | Carries out planned work units, reports results | Defined; runtime planned | rebuild-canonical (lexicon) | perspective role; runtime → `packages/bees` (absent) | G02 |
| **Sentinel** | Monitoring + security watch — health, anomalies, threats | Defined; runtime planned | legacy node `SENTINEL` (outer ring, security monitoring) | perspective role; maps to `security-bee`/`health-bee` | G02 |
| **Compliance** | Governance + RBAC — policy, permissions, audit | Defined; runtime planned | rebuild-canonical; cf. `governance-bee` | perspective role; maps to `governance-bee` | G02 |
| **Data** | Retrieval, embedding, persistence | Defined; runtime planned | rebuild-canonical; cf. legacy Memory/Vinci | perspective role; maps to `memory-bee`/`vector-ops-bee` | G02 |
| **View** | UI / projection — renders state to human surfaces | Defined; runtime planned | rebuild-canonical (lexicon) | perspective role; ties to frontend (ADR-0019) | G02 |
| **Bridge-Builder** | Integration + inter-agent connection; mediates handoffs | Defined; runtime planned | legacy Cathedral "Bridge Builder = Middleware/API Gateway"; legacy `BRIDGE` outer-ring node | perspective role; maps to `connectors-bee`/A2A (ADR-0020) | G02 |

> The 8 agents are not 1:1 with the 35 bees, the 7 archetypes, or the 21 nodes. Agents are *leadership
> roles* (weight 0.9); bees are *lifecycle workers* (0.7); skills *advise* (0.6). See HeadyPerspective.

---

## Systems

### Agent Harness (native agent loop)

- **Category** · Runtime / orchestration foundation · **Status:** Decided, not built · **Confidence:** defined (ADR-0016 Accepted)
- **What.** The execution mechanism that runs the 8 agents: an LLM tool-loop with stop conditions and
  step preparation, against an OpenAI-compatible gateway where the model is a *route, not a vendor*.
  Carries the "Heady codes Heady" coder module and the rustc-style autonomy bootstrap.
- **Legacy.** `Heady_Native_Interface.md`; AG-13 `heady-agents-defs` (`agents/`, legacy `heady-agents/`,
  ran on `localhost:3310` — a Zero-Localhost violation, to be dropped). Legacy SDK wiring is discarded;
  only the **persona/agent definitions** are reused.
- **Rebuild.** *path: none yet.* Decided: **Vercel AI SDK v6** `streamText({tools, stopWhen,
  prepareStep})` against the **Liquid Gateway** (ADR-0018). Target package per manifest:
  `packages/bees` + `packages/orchestration` (both **absent** — planned). AG-13 → "AI SDK v6 agents".
- **Parts (component→subparts).**
  - Harness loop → `streamText` + `tools` + `stopWhen` + `prepareStep`.
  - rustc-style stages → **Stage0** (eval harness, fidelity gate, `phi_circuit_breaker`, CODEOWNERS,
    gateway, merge button — *external & untouchable forever*) → **Stage1** (scope allowlist: docs/new
    tests/small typed refactors; Writer/Reviewer mandatory) → **Stage2** (condition-unlocked, not timer).
  - Three-layer CSL merge gate → GitHub (branch protection + CODEOWNERS) + CI (`coder-fidelity-gate`
    signed by `blocksorg`) + Workflow (`step.waitForEvent`, released by a Firebase-authed human).
  - Sandbox → Cloudflare Sandboxes + Outbound Workers (token lives in the Worker, never the sandbox);
    `allowedHosts` allowlist-only; escape hatch = Cloud Run Jobs (ADR-0021/0029).
  - Git write → GitHub App `blocksorg` + Cloud Run 1-hour downscoped token minter.
  - Kill switches → `phi_circuit_breaker` (outside the loop) + `heady.coder.enabled` + per-task `abandon`.
- **OSS.** *Current:* none wired. *Planned:* `ai` (Vercel AI SDK v6), `agents`, `@cloudflare/ai-chat`;
  fallback **Cline SDK**. **Claude Agent SDK is rejected as the harness** (proprietary, protocol-locked,
  won't run in Workers/DO, separately metered) — permitted **only as one MCP tool**.
- **UI.** Approval surface = the Workflow human-gate (`step.waitForEvent`) released via Firebase auth;
  no "Approve all" anywhere. MCP console (ADR-0026) is the operator view.
- **Transfer.** → `packages/bees` + `packages/orchestration`, group **G02** (bee-swarm-runtime). Agent
  *defs/personas* via **G10** (AG-08/09/10) and AG-13.
- **Incorporation steps.** (1) scaffold `packages/orchestration` + `packages/bees`; (2) wire `ai` v6
  loop to the Liquid Gateway (ADR-0018); (3) port AG-13 persona defs (drop SDK wiring + `localhost:3310`);
  (4) implement Stage0 fidelity gate + `phi_circuit_breaker` as external CI; (5) wire the three-layer
  merge gate + `blocksorg` token minter; (6) bind sandbox + kill switches.
- **⚠ Drift + decisions + ADR/law.** **ADR-0016** (harness=Vercel AI SDK v6; Claude SDK rejected),
  implements **ADR-0005** (governance/blast-radius), refs **ADR-0018/0010/0012/0021/0029**.
  `facts.yaml agent_harness = vercel-ai-sdk-v6` ✅ consistent.
  **DRIFT:** runtime packages absent — harness is decided but **0% built**; any skill claiming a live
  swarm runtime is aspirational. **Law:** Zero-Localhost (legacy `localhost:3310` must be dropped on port).

### HeadyPerspective — role system (`packages/perspective`)

- **Category** · Task-routing / authority-weighting · **Status:** Built (v1.0.0) · **Confidence:** defined
- **What.** The "optimal software company" as **weighted roles**: the 8 agents + 35 bees + 135 skills,
  each with competencies and a base perspective weight, used to (a) bias source **authority** and
  (b) **route a task** to roles by competency-match × weight. Derived from `HeadyRegistry` — no
  hand-authoring. Calibrated deterministically by `hc-train`.
- **Legacy.** Conceptual lineage in the Cathedral role mapping + persona docs; no direct legacy code —
  this is a clean rebuild artifact.
- **Rebuild.** **`packages/perspective`** — the *only built system in this domain*. Files: `roles.mjs`
  (RolePort), `perspective-level.mjs` (PerspectivePort), `assign.mjs` (AssignPort), `semantic.mjs`,
  `hc-train.mjs` (TrainPort, `bin: hc-train`), `index.mjs`. Package `@heady/perspective` v1.0.0, ESM.
- **Parts (component→subparts).**
  - **Roles** → `KIND_WEIGHT { agent: 0.9, bee: 0.7, skill: 0.6 }`; `loadRoles` reads the variable
    registry, tokenizes name+def into competencies, deterministic sort.
  - **Perspective level** → `CLASS_LEVEL { fact 1.0, constant .95, secret .9, decision/agent .85/.9,
    bee/env .7, term .65, skill .6 }` + authority modifiers (`HIGH_AUTHORITY` regex +0.05, `LOW_AUTHORITY`
    legacy/dropzone/stale −0.2), clamped [0,1].
  - **Assign** → `assign` (lexical token-overlap × weight) · `assignSemantic` (CSL-gated cosine ×
    weight, drops `REJECT` verdicts) · `assignWeighted` (semantic when embedder+vectors present, else
    lexical fallback — *never a single point of failure*).
  - **Semantic** → `getEmbedder`/`embedTexts`/`semanticScore`/`gateVerdict` (CSL ternary gate).
  - **hc-train** → builds a deterministic `perspective.v1` profile (counts + sources + roles + sha256
    hash); `embedRoles` attaches **bge-small** vectors; persists.
- **OSS.** *Current:* zero runtime deps (pure ESM). *Planned:* **bge-small** embedder (locked,
  ADR-0015) for semantic mode.
- **UI.** None directly; feeds task-routing / FleetView-style assignment.
- **Transfer.** Built in place; conceptually part of **G02** orchestration. No transfer pending.
- **Incorporation steps.** (1) ✅ built; (2) wire the bge-small embedder to enable `semantic-csl` mode
  (currently lexical fallback unless a token is configured); (3) confirm `.data/coherence/
  variable-registry.json` regenerates on registry change (its input source).
- **⚠ Drift + decisions + ADR/law.** Embedding model **ADR-0015** (bge-small lock); CSL gate is the
  `csl-engine` primitive. **Count authority confirmed here:** registry = 8 agents / 35 bees / 135 skills.
  **DRIFT:** memory note "8 agents/35 bees/134 skills" — **134 is stale**; live count is **135** (both
  `.agents/skills` and `.claude/skills` enumerate 135). 8 and 35 are correct.

### Cognitive Archetypes & Personas (prompt-architecture)

- **Category** · Reasoning-lens / prompt pattern · **Status:** Adapt → prompts (not services) · **Confidence:** defined (compendium 01 §A)
- **What.** **7 always-on archetypes** every task passes through (each emits confidence ∈[0,1]; **ALL
  must exceed 0.7**): **OWL** (wisdom/first-principles), **EAGLE** (omniscience/edge-cases), **DOLPHIN**
  (creativity), **RABBIT** (multiplication/5+ angles), **ANT** (repetition/zero-skip), **ELEPHANT**
  (memory/recall), **BEAVER** (structure/tests-alongside-code). Plus **personas** = selectable
  interaction masks (Ant, Beaver, Bee, Dolphin, Eagle, Elephant, Fox, Lion, Owl, Rabbit).
- **Legacy.** `archetypes/` (AG-08), `personas/` (AG-09), `directives/`+`prompts/` (AG-10) under G10;
  `HEADY_SUPER_PROMPT_v5.md §2`; persona files `skills/downloaded-skills/HEADY_PERSONA_*`.
- **Rebuild.** *path: none (by design).* Folded into `AGENTS.md` + the agent system prompt and a
  **harness persona library**; the "ALL exceed 0.7" rule maps to the **Judge** stage and the **eval gate**.
- **Parts.** Archetype set (7 always-on lenses) · Persona masks (selectable; incl. the empathic
  5-persona companion masking, `heady-liquid-persona`) · **Archetype→node functional mapping** (8
  functions): Sovereign=HeadySoul · Architect=Conductor/Orchestrator · Executor=Bee/Buddy/IO ·
  Guardian=Guard/Governance · Librarian=Memory/Vinci/Autobiographer · Analyst=Arena/Check/Assure/
  Corrections · Researcher=Brain/DeepScan/Perplexity · Distiller=heady-distiller.
- **OSS.** None — pure prompt architecture.
- **UI.** None (lenses); persona masks surface in companion/chat UX.
- **Transfer.** AG-08/09/10 → **G10** (content-cognition-assets) → persona/archetype prompts +
  `AGENTS.md`/system rules + harness persona library. `mark: adapt`.
- **Incorporation steps.** (1) port archetype lenses into the agent system prompt; (2) build the harness
  persona library; (3) bind the "ALL ≥ 0.7" check to the Judge/eval gate, not 11 separate services.
- **⚠ Drift + decisions + ADR/law.** Compendium 01 §A claims **"11 personas" but lists only 10**
  (Ant/Beaver/Bee/Dolphin/Eagle/Elephant/Fox/Lion/Owl/Rabbit) — **count discrepancy, flag**. Distinct
  layers: 8 agents ≠ 7 archetype animals ≠ 8 archetype→node functions ≠ 10/11 personas — **no 1:1 map**.
  Disposition: baseline as a multi-lens self-critique prompt pattern.

### Node Topology (HeadySoul center → rings)

- **Category** · Service / positional model · **Status:** Logical model (canonical as bounded contexts) · **Confidence:** defined (legacy) / inferred (ring framing vs. rebuild grouping)
- **What.** The **Sacred Geometry concentric-ring** layout of the OS — **HeadySoul at center** (awareness
  layer, values arbiter, coherence guardian), then **Inner / Middle / Outer rings** and a **Governance
  Shell** at the boundary. The rebuild re-expresses this as **21 logical service nodes** in 3 groups.
- **Legacy.** Authoritative sources: `~/Heady/index.html` (Topology page — "concentric rings from
  HeadySoul at center to the governance shell at the boundary") and
  `~/Heady/.agents/skills/heady-maximum-potential/SKILL.md` ("Sacred Geometry Node Topology").
  Registry-of-record: super-prompt §18 names `heady-registry.json` the "single source of truth for node
  topology." A `heady-registry.json` **does exist at the rebuild root** but is a *services/deployment*
  registry (services, deployments, ci, infrastructure) — it **no longer encodes ring/positional data**;
  the ring framing now lives only in legacy `index.html` + the `heady-maximum-potential` skill.
  - **Center** — HeadySoul.
  - **Inner Ring (Processing Core)** — HeadyBrains, HeadyConductor, HeadyVinci.
  - **Middle Ring (Execution)** — JULES, BUILDER, OBSERVER, MURPHY, ATLAS, PYTHIA.
  - **Outer Ring (Specialized)** — BRIDGE, MUSE, SENTINEL, NOVA, JANITOR, SOPHIA, CIPHER, LENS.
  - **Governance Shell** — HeadyCheck, HeadyAssure, HeadyAware, HeadyPatterns, HeadyMC, HeadyRisks.
- **Rebuild.** *path: logical, no per-node deploy.* Compendium 03 P4 = **21 nodes** as bounded contexts
  in the modular monolith (Cloud Run) + edge (Workers), **not 21 deployments** (R4/R5). Each node exposes
  `GET /health`, `GET /.well-known/agent.json` (A2A), pino logging, ML-DSA-signed requests, φ-backoff
  breaker. Groups: **Core Pipeline (10)** heady-brain/buddy/soul/conductor/orchestrator/patterns/aware/
  corrections/qa/vinci · **Intelligence (5)** memory/embed/vector/infer/foundry · **Integration (6)**
  mcp/io/bee-factory/guard/governance/distiller.
- **Parts.** Center (HeadySoul) · 3 rings + Governance Shell (legacy positional) → mapped to 3 service
  groups (rebuild bounded-context). HeadySoul = Sovereign archetype (per 01 §A mapping).
- **OSS.** None — topology is structure, not a dependency.
- **UI.** Legacy admin Topology page (concentric SVG). Rebuild: MCP/admin console (ADR-0026).
- **Transfer.** AG-07 `cognition-superset` → **G10** → `docs/compendium/02` + CSL config; node names map
  to bounded contexts under the modular-monolith decisions (ADR-0002).
- **Incorporation steps.** (1) keep the ring model as the *conceptual* topology in the compendium;
  (2) realize the 21 nodes as bounded contexts inside the monolith + edge tier, not separate services;
  (3) enforce the per-node contract (`/health`, agent.json, pino, ML-DSA, φ-breaker) at the service level.
- **⚠ Drift + decisions + ADR/law.** **ADR-0002** (modular monolith, reject 21-deployments / R4-R5).
  **DRIFT (taxonomy):** the legacy ring node names (JULES, ATLAS, PYTHIA, MUSE, NOVA, CIPHER…) are
  *different identifiers* from both the 8 agents and the rebuild's 21 `heady-*` nodes — they are an
  earlier topology layer; do not equate. **Ring framing = inferred** for the rebuild (the rebuild groups
  by Core/Intelligence/Integration, not literal rings); HeadySoul=center is preserved (Sovereign).
  The named topology SoT `heady-registry.json` survives in the rebuild root but **demoted to a
  services/deployment registry** — positional ring topology is no longer machine-encoded anywhere.
