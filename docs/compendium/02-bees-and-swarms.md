# 02 — HeadyBees & HeadySwarms (complete catalog)

> Every bee, every swarm, the lifecycle they share, the factory that makes them, the stigmergy that
> coordinates them — and the **canonical runtime mapping** that turns 197 designed bees into a buildable
> system. Read `00-INDEX.md` §"one mental model" first.

---

## 0. The three taxonomies (and why there are three)

"HeadyBee" appears in the corpus under **three overlapping naming systems**, authored at different times.
They describe the *same conceptual layer* — ephemeral specialized workers — at three altitudes. The
compendium unifies them; the canonical build implements the union as functions, not processes.

| Taxonomy | Source | Count | Naming | Altitude |
|---|---|---|---|---|
| **A — Module registry** | `src/bees/*.js` (`heady-bee-swarm-ops`) | 33 modules | `kebab-bee` (e.g. `brain-bee`) | Implementation modules in the monolith |
| **B — Swarm matrix** | `HEADY_SUPER_PROMPT_v9` §17/§22 | "90+ types, ≤10,000 concurrent" | `PascalBee` (e.g. `ResonanceBee`) | Logical workers grouped under 17 swarms |
| **C — Domain map** | 88KB Architectural Blueprint | 24 domains / **197 worker bees** | `PascalBee` + port ranges | Deployment-shaped (ports 3310–3396) |

**Why three:** A is what's coded; B is the cognitive/mathematical design; C is the deployment fantasy
(one process per bee on its own port). **Disposition:** A and B are canonical vocabulary; C's per-port
deployment is **superseded** (R4) — its *domains* survive as bounded-context boundaries, its *bees* as
handlers, but not as 197 listening processes.

---

## 1. BaseHeadyBee — the universal contract

**What.** Every bee, in every taxonomy, implements one interface: the lifecycle `spawn() → execute() →
report() → retire()`. **Why.** A single contract makes bees uniformly schedulable, observable, and
disposable ("cattle, not pets"). **How.** `class XBee extends BaseHeadyBee`; all tunables are φ-scaled
(no magic numbers — `01-laws-and-constants.md`); every bee emits telemetry to `telemetry-bee` and a
health beat to `health-bee`. **When.** Instantiated per-task by the Bee Factory; retired at task end.
**Where.** Canonically: a Workflow `step.do`, a Queue consumer, or a Colab task — **not** a long-lived
server.

```
spawn(config)   → allocate context, mint scoped creds (revoked at retire), register with health-bee
execute(input)  → do the one job; emit pheromone (success/failure embedding) on completion
report()        → structured result + telemetry (tokens, cost, latency, diff hash) → Langfuse
retire()        → release creds (DELETE token), tear down sandbox, decay pheromone
```

φ-scaled defaults (from `BaseHeadyBee`): `maxRetries = round(φ×5) = 8`, `timeout = round(φ×1000) =
1618ms`, retry delays `[1,1,2,3,5,8,13,21]s ±(ψ×delay)` jitter, pool sizes `min=fib(3)=2 / max=fib(7)=13`.

**Canonical runtime mapping (the key reconciliation):**

| Vision concept | Canonical implementation |
|---|---|
| A "bee" (any taxonomy) | A handler module + a row in the `skills` table; invoked as a Workflow step / Queue consumer / MCP tool |
| "≤10,000 concurrent bees" | Cloudflare Workflow/Queue concurrency + Colab task fan-out, bounded by `phi_circuit_breaker` + token budget (ADR-0010) |
| "Bee on port 33xx" | A route/module inside the Cloud Run monolith (one process, many bounded contexts) — **not** a separate listener |
| "Bee Factory compiles bees on demand" | `heady-agent-factory` / `heady-swarm-template-ops` — template → parameterized handler instance |
| "Stigmergic pheromone trails" | success/failure embeddings written to `events`/`facts` with decay `intensity(t)=intensity₀·e^(−t/φ)`; read by the router as priors |

---

## 2. Taxonomy A — the `src/bees/` module registry (33, what's actually coded)

Each is a module behind the BaseHeadyBee contract. Grouped by concern. **Disposition: baseline** (these
become handler modules / skill rows in the monolith).

| Bee | Role (What) | Canonical home |
|---|---|---|
| `agents-bee` | Agent creation & routing | orchestrator module |
| `orchestration-bee` | Multi-bee coordination | orchestrator module |
| `pipeline-bee` | Pipeline-stage execution | HCFullPipeline Workflow |
| `brain-bee` | LLM provider routing / model selection | model-mesh (`05`) |
| `providers-bee` | Provider health & failover | model-mesh |
| `mcp-bee` | MCP tool execution | mcp-server (`06`,`08`) |
| `memory-bee` | store / retrieve / embed | memory layer (`04`) |
| `vector-ops-bee` | Vector-space operations | memory layer |
| `vector-template-bee` | Vector template mgmt | memory layer |
| `creative-bee` | Image / music / text generation | transforms (`07`) |
| `midi-bee` | MIDI event processing | transforms (`07`) |
| `security-bee` | Security scan & enforce | governance (`06`) |
| `governance-bee` | Policy / compliance | governance (`06`) |
| `health-bee` | Health probes & reporting | observability (`09`) |
| `telemetry-bee` | Telemetry collection/export | observability (`09`) |
| `resilience-bee` | Circuit breakers / backoff | reliability (`06`,`09`) |
| `deployment-bee` | Cloud deploy automation | deploy (`09`) |
| `lifecycle-bee` | Service lifecycle | reliability |
| `ops-bee` | Operations automation | ops |
| `config-bee` | Config mgmt & validation | platform |
| `connectors-bee` | External connector mgmt | connector-forge (`08`) |
| `auth-provider-bee` | Auth-provider orchestration | identity (`06`) |
| `middleware-bee` | Middleware chain mgmt | gateway (`06`) |
| `routes-bee` | API route mgmt | gateway |
| `services-bee` | Service catalog mgmt | platform |
| `engines-bee` | Engine orchestration | platform |
| `intelligence-bee` | Intelligence gathering | research (`08`) |
| `refactor-bee` | Code refactoring | coder module (`06`) |
| `documentation-bee` | Auto-docs | coder module |
| `device-provisioner-bee` | Device onboarding | cross-device (`09`) |
| `sync-projection-bee` | Repo projection sync | projections engine (`06`) |
| `trading-bee` | Trading operations | fintech vertical (`10`) |
| `auto-success-bee` | Auto-success pipeline (φ⁷ heartbeat) | auto-success engine |

---

## 3. Taxonomy C — the 24 swarm domains / 197 bees (the deployment map)

**What.** The blueprint decomposes the intelligence layer into **24 domains** coordinating **up to 197
worker bees**, each domain assigned a logical **port range** (3310–3396). **Why.** To eliminate
monolithic classes and make parallel execution paths explicit and isolatable. **How (canonical).** Each
domain = a **bounded context** in the modular monolith (or a Worker/Workflow), addressed by route, not by
a dedicated port; the "Bee Factory" compiles a domain's worker configs on demand. **When.** Domains light
up across phases (most in Phase 3). **Where.** Disposition: **domains = baseline boundaries; the 87-port
1-process-per-bee deployment = superseded (R4).** Port ranges are retained only as a *logical addressing
scheme* and documentation of intent.

| # | Swarm Domain | Key worker bees | Logical port range | Canonical home / phase |
|---|---|---|---|---|
| 1 | **Cognitive Core** | BrainBee, SoulBee | 3310–3314 | orchestrator + model-mesh · P3 |
| 2 | **Memory Mesh** | EmbedBee, VectorBee | 3315–3319 | memory layer (pgvector 384-D) · P2 |
| 3 | **Sovereign Swarm** | AuditBee, ComplianceBee | 3320–3322 | governance / RBAC · P3 |
| 4 | **System Security** | SecurityBee, PermissionGuardBee | 3323–3326 | governance (secrets, mTLS) · P0/P3 |
| 5 | **Telemetry & Health** | WatchdogBee | 3327–3330 | observability · P1+ |
| 6 | **Edge Integration** | EdgeBee, ProxyBee | 3331–3335 | Cloudflare edge tier · P3 |
| 7 | **Task Automation** | AutoFlowBee | 3336–3340 | task ledger + coder · P2/P3 |
| 8 | **FinTech Engine** | TraderBee, BacktestBee | 3341–3345 | fintech vertical · P4 |
| 9 | **Identity & Access** | AuthBee, SessionBee | 3346–3349 | Firebase identity · P1/P3 |
| 10 | **Hardware & MIDI** | MidiBee | 3350–3353 | transforms (`07`) · P4 |
| 11 | **Compilation Lab** | CompilerBee | 3354–3358 | sandbox/deploy (Cloud Run) · P3 |
| 12 | **Database Ops** | MigrationBee | 3359–3362 | `packages/db` (Drizzle, HNSW) · P1 |
| 13 | **Error Isolation** | ResilienceBee | 3363–3366 | reliability (circuit breakers) · P3 |
| 14 | **Document Processing** | ParserBee | 3367–3370 | **990 Parser beachhead** (`10`) · P4 |
| 15 | **Visual Computing** | ProjectionBee | 3371–3374 | logic-visualizer / 3D (`07`) · P4 |
| 16 | **Async Messaging** | QueueBee | 3375–3378 | outbox/Queues (pgmq + CF Queues) · P2 |
| 17 | **Semantic Cache** | CacheBee | 3379–3381 | semantic cache (CF AI Gateway) · P3 |
| 18 | **Web UI Delivery** | WebBee | 3382–3384 | portal/sites · P3 |
| 19 | **Model Gateway** | RouterBee | 3385–3387 | Liquid Gateway (`05`) · P3 |
| 20 | **Saga Coordination** | SagaBee | 3388–3390 | distributed-tx compensation · P3 |
| 21 | **Content Management** | CmsBee | 3391–3392 | Drupal sync (`07`,`09`) · P4 opt |
| 22 | **Local Interface** | CliBee | 3393–3394 | `heady` CLI · P1+ |
| 23 | **Colab GPU Bridge** | GPUComputeBee | 3395 | Colab/Tailscale (`09`) · P2/P4 |
| 24 | **Sovereign Identity** | SovereignBee | 3396 | BYOK / client-side keys (`06`) · P4 |

> The "197 bees" is the sum of per-domain worker-config variants the Bee Factory can compile; it is a
> *capacity statement*, not a process count. Concurrency is bounded by `phi_circuit_breaker` + token
> budgets, not by 197 ports.

---

## 4. Taxonomy B — the 17-swarm matrix (the cognitive design)

**What.** V9 organizes intelligence into **17 swarms** computed via CSL geometric gates — "no monolithic
manager," decentralized. **Why.** Swarms are *topologies*, not teams: each is a way of composing bees for
a class of problem. **How.** A task is embedded, CSL-gated to the highest-resonance swarm
(`cos(intent, swarm) ≥ ψ`), which spawns its bees. **When.** At pipeline stage 04 TRIAGE (`03`).
**Where.** Disposition: **canonical as orchestration patterns** (HeadySwarm = orchestrator-workers +
supervisor); implemented via the agent loop + Workflow fan-out, single-agent-first (ADR-0005 / R4).

| Cluster | Swarm | Function | Notable bees |
|---|---|---|---|
| **Decision & Orchestration** | **Overmind** | Goal decomposition, routing | agents/orchestration |
| | **Governance** | Policy, secrets, compliance | AuditBee, ComplianceBee, PermissionGuardBee |
| **Operational & Creative** | **Forge** | AST mutation, hologram gen | refactor, ProjectionBee |
| | **Emissary** | Docs, MCP, SDK | documentation, mcp |
| | **Foundry** | Dataset curation, fine-tuning | EmbedBee, GPUComputeBee |
| | **Studio** | Ableton MIDI / SysEx | MidiBee, creative |
| **Business & Ecosystem** | **Arbiter** | IP, patents | research |
| | **Diplomat** | B2B procurement | — |
| | **Oracle** | Economic guardrails | cost/FinOps |
| | **Quant** | Trading, portfolio | TraderBee, BacktestBee |
| **Applied Reality & Defense** | **Fabricator** | IoT, CAD | device-provisioner |
| | **Persona** | Biometric sync | persona/companion |
| | **Sentinel** | Threat detection, self-healing | SecurityBee, ResilienceBee, WatchdogBee |
| | **Nexus** | Smart contracts | — |
| | **Dreamer** | Monte-Carlo, what-if | HeadySims (stage 08) |
| **Mathematical Core (VALU Tensor)** | **Tensor** | Boolean-as-geometry | **ResonanceBee** (IF), **SuperpositionBee** (AND), **OrthogonalBee** (NOT) |
| | **Topology** | Structure analysis | **ManifoldBee** (PCA/K-Means), **EntanglementBee** (dependency tracking) |

The **Tensor/Topology** bees are the literal implementation of the CSL gate algebra
(`01-laws-and-constants.md`): ResonanceBee computes `cos`, SuperpositionBee `normalize(a+b)`,
OrthogonalBee `a − proj_b(a)`.

---

## 5. The Bee Factory & swarm lifecycle

**What.** A dynamic factory (`heady-agent-factory`, `heady-swarm-template-ops`, `bee-factory.js`) that
compiles and deploys specialized worker configs on demand from templates in the **headybee-template-
registry**. **Why.** Avoids hand-coding every variant; lets the system spin precisely the workers a task
needs and retire them after. **How.** Template match → provision → parameterize → register → execute →
converge → extract (a successful config can be distilled back into a new template via `heady-distiller`).
**When.** Per task, at stage 07 ORCHESTRATE. **Where.** Canonically the factory is a function that yields
Workflow steps / Queue messages / MCP tool bindings.

**Swarm lifecycle (5 phases):** `Decompose → Provision → Execute → Converge → Deliver`.
- **Decompose** — split the objective into a subtask DAG (Rabbit archetype, stage 05).
- **Provision** — Bee Factory compiles the needed bees with scoped creds.
- **Execute** — bees run in parallel where data-dependencies allow (the DAG is physics, not priority).
- **Converge** — stigmergic consensus: `CONSENSUS = normalize(Σ wᵢ aᵢ)`, agreement `R ∈ [0,1]`; Byzantine
  quorum `N ≥ 3f+1` for high-stakes (Multi-Model Council, `05`).
- **Deliver** — emit result, write receipt (stage 20), distill recipe (stage 21).

**Stigmergy.** Coordination is indirect, via the environment: each bee deposits a **pheromone** (a
success/failure embedding) that decays `intensity(t) = intensity₀ · e^(−t/φ)`. The router reads
accumulated pheromone as a prior — successful paths attract future bees, failed paths repel. Canonically
these are rows in `events`/`facts` with a decay function, queried by the model-mesh router (`05`).

---

## 6. Governance bees (cross-reference)

The **Governance** and **Sovereign** swarms are the runtime arm of `06-governance.md`. AuditBee,
ComplianceBee, PermissionGuardBee, SecurityBee, and WatchdogBee implement, respectively: immutable audit
telemetry, RBAC/CSL-threshold enforcement (≥0.70), permission-graph checks + secret rotation + mTLS,
secret/CVE scanning, and loop-stall / memory-leak watchdogging. They are the bees that *enforce* the laws
the rest of the system runs under — see `06-governance.md` §"Enforcement bees" for the full treatment.

---

## 7. When each comes online (phase rollup)

| Phase | Bees/domains activated |
|---|---|
| **P0** | SecurityBee, PermissionGuardBee (secret purge, branch protection) |
| **P1** | MigrationBee (Database Ops), CliBee, health-/telemetry-bee, AuthBee |
| **P2** | EmbedBee/VectorBee (Memory Mesh), QueueBee (Async Messaging), AutoFlowBee (task ledger), GPUComputeBee |
| **P3** | BrainBee/SoulBee, RouterBee, EdgeBee/ProxyBee, CompilerBee, CacheBee, WebBee, SagaBee, ResilienceBee, AuditBee/ComplianceBee, the coder bees (refactor/documentation) |
| **P4** | ParserBee (990), TraderBee/BacktestBee (fintech), MidiBee (Studio), ProjectionBee (Visual), CmsBee (Drupal), SovereignBee (BYOK) |

> Sequencing follows ADR-0013 (≤1 net-new platform/phase). A domain "activating" means its handler ships
> behind a flag, not that a new process is deployed.

---

## 8. Disposition summary

- **Baseline / canonical:** BaseHeadyBee contract, the 33 module bees (as handlers), the 24 domains (as
  bounded contexts), the 17 swarms (as orchestration patterns), the Bee Factory (as a function),
  stigmergy (as decaying embeddings), the φ-scaled tunables.
- **Superseded (R4):** 1-process-per-bee on 87 ports; "10,000 concurrent" as a literal target; the port
  numbers as network bindings (kept only as logical addressing).
- **Reduced:** multi-agent swarms default to single-agent-first (ADR-0005); a swarm spins only when tool
  overlap / prompt complexity proves it's needed.
