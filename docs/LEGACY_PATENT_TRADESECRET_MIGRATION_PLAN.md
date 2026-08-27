<!-- HEADY_BRAND:BEGIN
  ╔══════════════════════════════════════════════════════════════════╗
  ║  HEADY™ — Legacy Patent & Trade-Secret Concept Migration Plan      ║
  ║  ∞ Sacred Geometry ∞  Continuous Semantic Logic · φ-Scaled         ║
  ║  LAYER: docs/ (planning) · governed by CONSTITUTION v9.0.0         ║
  ║  Made with ❤️ by HeadySystems Inc.                                 ║
  ╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# Legacy Patent & Trade-Secret Concept Migration Plan

> **Status:** Draft for founder approval · **Owner:** Eric Anthony Haywood
> **Scope:** Migrate the *inventive concepts* (patents + trade secrets) reduced to practice in
> `governance/legacy/` — **and** the load-bearing `heady*` **service nodes** they describe — into the
> rebuild **with updated context**, without editing the frozen legacy source.
> **Governed by:** `governance/CONSTITUTION.md` (v9.0.0), `AGENTS.md` §Patent Lock Zones,
> `docs/LEGACY_EXTRACTION_SYSTEM.md`, `docs/LEGACY_STACK_COMPONENT_DISPOSITION.md`,
> `docs/STEPWISE_BUILD_SPEC.md`, `docs/REBUILD_PLAN_V2.md`, `docs/adr/` (0000–0029), `docs/compendium/`.
> **IP framing standard:** `heady-patent-intel` skill — careful language only
> (*potentially novel*, *appears differentiated by*, *likely overlap in*, *reduction to practice may be
> evidenced by*). No legal certainty is claimed anywhere in this document.

> ### ⏱ No clocks — only conditions
> This plan contains **zero time-based estimates and zero time-based dependencies.** Every step
> advances when its **entry gate** (a measurable condition) is satisfied — never on a date, duration,
> sprint, or "week N." This is `CONSTITUTION` Law +9 (ASAP) expressed correctly: *do the next ready
> thing the instant its predecessors are green.* Gates are CSL/ORS/health conditions, the same grammar
> `STEPWISE_BUILD_SPEC.md` already uses ("every gate is a condition, not a clock").

---

## 0. What this document is (and is not)

| ✅ IS | ❌ IS NOT |
|---|---|
| A **stepwise, condition-gated** plan to migrate inventive concepts **and** their `heady*` service embodiments | A schedule, Gantt chart, or anything with dates/durations |
| A **dual-track** plan: a **Legacy track** (freeze, extract, preserve, RTP-evidence) + a **Rebuild track** (re-embody with updated context) | A license to edit `governance/legacy/*` (frozen — read-only migration source) |
| A **build sequence** rooted in a native **task-management + completion system** on **Linear + Sentry** (+ Google Tasks sync) | A second orchestration framework — it routes through `@heady/task-ledger` (ADR-0027), already in-repo |
| A map of every named service node — HeadyManager, HeadyConductor, HeadyMaid, HeadyCloudConductor, HeadyAutoContext, heady-auto-sync, HCFullPipeline, HeadyPythia, HeadyJules, HeadyCoder, HeadyBattle, HeadyArena, HeadySims, HeadyMC, and the rest — to a rebuild target | A claim that all of them ship; several are **Defer** with explicit re-entry gates |
| IP-safe, ARBITER/HCP-gated, traceable to a cited source | Legal advice — IP posture is advisory pending counsel review |

---

## 1. Why concept-first **and** service-first at once

The legacy `governance/legacy/` corpus is **frozen** (`RECONCILIATION_DECISIONS.md`, `AGENTS.md`
§Patent Lock Zones). It is simultaneously (a) the **reduction-to-practice evidence** for ~51 filed
provisionals / 60+ estate (`docs/compendium/10-business-and-roadmap.md`) and (b) the **specification**
for the live service fleet (`heady-manager.js` god-server, the 9-stage battle-sim, the specialist nodes).
Migration therefore has two inseparable halves:

1. **Concept migration** — move the *inventive idea* into a cleaner rebuild embodiment that strengthens,
   not weakens, the provisional→nonprovisional conversion posture (Gate 4, deadline tracked in the
   business compendium). Cleaner embodiments = better claims.
2. **Service migration** — stand up the *runnable node* that embodies the concept, in dependency order,
   wired to the task-management + completion system so progress is observable and auditable.

The rebuild's reconciled architecture is deliberately a **stronger** embodiment than legacy
(reconstructible memory per ADR-0000; single embedding lock `@cf/baai/bge-small-en-v1.5` 384-dim per
ADR-0015; deterministic CSL; Ed25519-signed receipts). Where legacy and rebuild differ, **rebuild wins**
and the conversion narrative should pivot to the rebuild embodiment.

---

## 2. Source corpus — what the frozen legacy contains

| File | Inventive content it evidences |
|---|---|
| `governance/legacy/BUDDY_KERNEL.md` | 6-layer boot; **9-stage battle-sim** (SimPreflight→CSLGate→BattleRace→MCSampling→BeeDispatch→SwarmRoute→ResultCapture→DriftCheck→AuditLog); CSL gate truth table (AND/OR/NOT/GATE/IMPLY/CONSENSUS/XOR/ANALOGY); adaptive temperature `T=ψ^(1+2(1−H/Hmax))`; φ resource table (29,034 ms cycle, 144 tasks, ORS); HeadyAutoContext 5-pass enrichment; integration points |
| `governance/legacy/MASTER_DIRECTIVES.md` | 21-stage HCFullPipeline + path variants (Fast/Full/Arena/Learning); CSL-replaces-conditionals; **Directive 8** continuous learning (`wisdom.json` + Graph RAG + HeadyVinci + anti-regression); **Directive 9** Multi-Model Council; HeadyCoder→HeadyCodex→HeadyCopilot synthesis chain; MONTE_CARLO/HeadySims |
| `governance/legacy/UNBREAKABLE_LAWS.md` | Arena Mode; 10,000-bee ceiling; Auto-Success φ⁷ invariants; HeadySims/HeadyBattle scale rules |
| `governance/legacy/SYSTEM_PRIME_DIRECTIVE.md` | 7 cognitive archetypes; CSL resonance 0.618; 384→3 projection |
| `governance/legacy/LAW-09-ASAP-EXECUTION.md` | ASAP execution law (the condition-not-clock doctrine) |
| `governance/legacy/RECONCILIATION_DECISIONS.md` | The freeze; canonical-vs-stale reconciliations |
| `governance/legacy/README.md` | Provenance + read-only status |
| **Cross-refs (rebuild side)** | `AGENTS.md` §Patent Lock Zones (HS-2026-051..062, ARBITER, HCP); `docs/LEGACY_EXTRACTION_SYSTEM.md` (HS-058 VSA→CSL precedent, 3 real gates); `docs/LEGACY_STACK_COMPONENT_DISPOSITION.md` (8-layer component dispositions); `docs/PACKAGE_CATALOG.md` (patent-zone packages); `docs/compendium/09-infra-and-services.md` (service/domain map); `docs/adr/0015-embedding-model-lock.md` |

---

## 3. The migratable concept inventory (the IP backbone)

Twelve concept clusters carry the patent + trade-secret weight. Each maps to one or more rebuild packages
and one or more service nodes (Section 6). Disposition legend matches the disposition doc:
**Integrate ✅** (port largely as-is) · **Adapt 🔧** (rewrite to conform) · **Defer ⏸** (gated re-entry).

| # | Concept cluster | IP class | Rebuild target | Disp |
|---|---|---|---|---|
| C1 | **Continuous Semantic Logic** (cosine/projection gates replace conditionals) | patent zone **HS-058** | `packages/csl-engine` ⚠️ | 🔧 |
| C2 | **Sacred Geometry / φ-math** (φ, ψ, Fibonacci, no magic numbers) | trade secret | `packages/phi-math` | ✅ |
| C3 | **HCFullPipeline** (21-stage deterministic state machine + path variants) | patent | `governance/directives/07` + `packages/kernel` | 🔧 |
| C4 | **HeadyBee swarm + 17-swarm matrix** (resonance routing, φ pools, ≤10k ceiling) | patent zone | `packages/bees` ⚠️ | 🔧 |
| C5 | **3-tier φ-decay vector memory + 384→3 projection** | patent | `packages/memory-stream` + `packages/embedding` | 🔧 |
| C6 | **Deterministic replay + SHA-256 drift + auto-reconfig** | patent | `packages/kernel` + Law 5 audit | 🔧 |
| C7 | **Arena Mode / Multi-Model Council** (φ-resonance modulation, consensus R-metric) | patent + trade-secret weights | `packages/engines` (Arena) | 🔧 |
| C8 | **Auto-Success Engine** (φ⁷≈29,034 ms heartbeat, 144 tasks, 13 categories, ORS) | trade secret | `packages/engines` (Auto-Success) | 🔧 |
| C9 | **PQC / security-mesh** (Kyber/Dilithium posture, fail-closed) | patent zone | `packages/security-mesh` ⚠️ | ⏸ |
| C10 | **Deterministic protocol matrix** (MIDI→{UDP/TCP/MCP/API}) | patent | optional edge worker | ⏸ |
| C11 | **Socratic execution loop + ORS gating** | trade secret | `packages/kernel` gate layer | 🔧 |
| C12 | **Continuous-learning / anti-regression** (`wisdom.json`→Neon registry + Graph RAG + HeadyVinci) | trade secret / possible patent | `packages/memory-stream` + learning loop | 🔧 |

---

## 4. The named service-node inventory (the runnable embodiments)

Every `heady*` node named in your sequence — plus every other one found in the frozen corpus and the
disposition doc — mapped to its **legacy RTP evidence → updated-context delta → rebuild target →
disposition → the concept(s) it embodies**. This is exhaustive across the legacy fleet; "Defer ⏸" nodes
carry an explicit **re-entry gate** rather than a date.

### 4.1 Foundational task + orchestration spine

| Node | Legacy RTP | Updated-context delta | Rebuild target | Disp | Embodies |
|---|---|---|---|---|---|
| **Task-mgmt + completion system** | implicit in Auto-Success 13-category cycle + `wisdom.json` | becomes an **explicit** native service on **Linear + Sentry** (+ Google Tasks sync) via transactional outbox | `@heady/task-ledger` (exists) + Linear/Sentry adapters | 🔧 | C8, C12 |
| **HeadyManager** | `heady-manager.js` 136 KB CJS god-server (BE-01); ESM microkernel `core/heady-manager-kernel.js` w/ `cslGate`+`phiBackoff` (BE-02) | split god-server → Cloud Run app; kernel logic → `@heady/kernel`; **archive** the monolith | `apps/heady-manager` (scaffold exists) + `@heady/kernel` | 🔧 | C1, C3, C6, C11 |
| **HeadyConductor** | `core/`/`src/` conductor + scheduler; custom orchestration (BE-06, BE-11) | reimplement on **CF Workflows + Queues + Durable Objects** (ADR durable-orchestration); no custom LangGraph | `@heady/kernel` conductor + CF Workflows | 🔧 | C3, C4 |
| **HeadyMCP** (`headymcp.com`) | `mcp-servers/heady-mcp-server.js` v6 (MC-01), 8 servers + 8 tool services, 45+ tools (MC-03/06) | re-front on **OpenAPI-first `@heady/contracts`**; all tools regenerated (Kubb→`mcp-tools.json`); **single CF AI Gateway egress** (closes R-3) | `@heady/contracts` + MCP Console + `headyme-portal` | 🔧 | C1, C3 |
| **HeadyAutoContext** | 5-pass universal enrichment (BUDDY_KERNEL §0, §Integration); `packages/auto-context` v2 (in-repo) | **systemic, CI-enforced** (Constitution Law 4 / Directive 01) — not a node you call but a wrapper every stage passes through | `packages/auto-context` (exists) + CI enforcer | ✅ | C5, C12 |
| **heady-auto-sync** | dropzone/skill-sync cadence (DX-05) + auto-commit bot | becomes the **outbox drain** + projection sync (generated-not-authored); Merkle-trigger, not daemon-push | `@heady/task-ledger` outbox + sync worker | 🔧 | C12 |

### 4.2 AI specialist nodes (the 9-stage battle-sim cast)

These are the named specialists from `BUDDY_KERNEL.md §3` and `MASTER_DIRECTIVES.md`. Each is a **stage
or engine**, not a standalone microservice (the rebuild bans new microservices per `06-G11`).

| Node | Legacy RTP | Updated-context delta | Rebuild target | Disp | Embodies |
|---|---|---|---|---|---|
| **HeadySims** | Stage 1 SimPreflight — resource/success prediction from Memory T2; MONTE_CARLO risk sim ≥80% pass | Monte Carlo determinism-boundary detection becomes a kernel gate; predictions read from pgvector (not RAM-first) | `@heady/kernel` SimPreflight gate + `@heady/engines` | 🔧 | C3, C6 |
| **HeadyBattle** | Stage 3 BattleRace — multi-model competitive eval, 5-dim rubric, φ-resonance modulation | route models **only** via CF AI Gateway; rubric weights are the trade-secret payload | `@heady/engines` (Arena/Battle) | 🔧 | C7 |
| **HeadyArena** | Multi-Model Council / Battle Arena (BUDDY_KERNEL §5; MASTER_DIRECTIVES Dir 9); consensus R-metric | ORS-gated activation (≥70); consensus `R<ψ²`→escalate | `@heady/engines` (Arena) | 🔧 | C7, C11 |
| **HeadyMC** | Stage 4 MCSampling — Monte Carlo iteration scaling `base×φ^(1−confidence)` | deterministic seed (42), iteration scaling preserved; pairs with HeadySims | `@heady/engines` (MC sampler) | 🔧 | C6, C7 |
| **HeadyPythia** | prediction/forecast persona (temporal forecasting family) | re-embody as a **read-only forecasting engine** over pgvector history; no new store | `@heady/engines` (forecast) | ⏸ | C12 |
| **HeadyJules** | autonomous coding agent node (swarm node CODEMAP/JULES, AG-02) | re-embody as an **AI SDK v6 agent** behind contracts; drop Pinecone/Redis→pgvector/NATS | `@heady/codeflow` + agent harness | 🔧 | C1, C4 |
| **HeadyCoder → HeadyCodex → HeadyCopilot** | Code-synthesis chain (MASTER_DIRECTIVES §86) | single code-synthesis engine in `@heady/codeflow`; chain stages become pipeline sub-steps | `@heady/codeflow` | 🔧 | C3 |
| **HeadyVinci** | Pattern-recognition engine surfacing historical patterns (Dir 8.3) | becomes the **retrieval arm** of the learning loop over the Neon pattern registry + Graph RAG | `@heady/memory-stream` learning loop | 🔧 | C12 |
| **HeadyBrain** | meta-controller system-prompt host (BUDDY_KERNEL Integration) | folds into `@heady/kernel` boot (Layer 0–5) as the deterministic prompt source | `@heady/kernel` | 🔧 | C3, C11 |
| **HeadyMemory** | 3-tier vector store T0/T1/T2, φ-decay (Layer 3) | **reconstructible** (ADR-0000 rejects RAM-as-truth); Neon SoR + pgvector authority + Vectorize edge cache; 1536→**384** lock | `@heady/memory-stream` + `@heady/embedding` | 🔧 | C5, C12 |
| **HeadyBees / HeadySwarms** | Stages 5–6 BeeDispatch/SwarmRoute; resonance routing; φ pools 34/21/13; ≤10k ceiling | `BaseHeadyBee` lifecycle (AG-03) → `@heady/bees`; NATS orchestration; guard 6765/ceiling 10000 | `packages/bees` ⚠️ | 🔧 | C4 |

### 4.3 Ops / maintenance / cloud nodes

| Node | Legacy RTP | Updated-context delta | Rebuild target | Disp | Embodies |
|---|---|---|---|---|---|
| **HeadyMaid** | maintenance/cleanup persona (HeadyMaid/HeadyMaintenance family) | re-embody as a **scheduled maintenance worker** (CF cron/Workflows) gated on ORS; no destructive ops without HCP | maintenance worker + `@heady/observability` | ⏸ | C8, C11 |
| **HeadyCloudConductor** | cloud-orchestration / multi-cloud resource node (heady-cloud-orchestrator SKILL, BE-20) | re-embody as **Cloud Run + CF deploy orchestration** only (drop k8s/helm/Render); OIDC keyless | `@heady/observability` + deploy tooling | ⏸ | — |
| **HeadyHealth** | health-probe family (health-bee) | K8s-compatible probes → CF/Cloud Run health endpoints; `/health` everywhere | `@heady/observability` health routes | ✅ | — |
| **HeadyOps / HeadyDeploy** | ops + φ-canary deploy (IN-02) | GHA φ-canary 5/25/50/100 + explicit highest-traffic rollback (closes R-6) | GHA workflows + `@heady/observability` | 🔧 | — |
| **HeadyPerplexity / HeadyGrok** | external intelligence sources (Dir 8.2 — research + red-team) | research feed → vector memory via the deep-ops pipeline; red-team findings → learning loop | research pipeline + `@heady/memory-stream` | ⏸ | C12 |

> **Drop, do not migrate** (per disposition doc, for completeness): auth-session-server (fail-open R-2),
> render-mcp-server (Render off-stack), `heady-mcp-enhancement` (unwired), `perplexity-build` 50-service
> hollow scaffold (leaks live key R-1), all meta-rebuild snapshots (BZ-17), Vue/Module-Federation/Drupal
> frontends. None carry unique IP not already covered above.

---

## 5. The intelligent build sequence (condition-gated steps)

This is your requested sequence, expressed as **eight ordered steps**, each with an **entry gate**
(condition that must be green to start), the **build**, the **wiring into the task system**, and an
**exit gate** (condition that proves done). No step references time. A step starts the instant its entry
gate is satisfied — multiple steps run in parallel whenever their gates are independently green.

> **Legend.** ⚙️ Rebuild track · 🗄 Legacy track (extract/preserve/evidence) · 🔗 Task-system wiring.

### Step 1 — Task-management + completion system (the spine)
- **Entry gate:** `@heady/task-ledger` builds green; Neon reachable via OIDC; Linear + Sentry connectors authenticated.
- **⚙️ Build:** finalize `@heady/task-ledger` — task state machine (`PENDING→RUNNING→SUCCEEDED/FAILED/CANCELLED`), DAG deps (`task_dep`), idempotency hashes (`@heady/db`), transactional outbox (ADR-0027). Add **Linear adapter** (issue ↔ task mirror), **Sentry adapter** (error→task + health signal), **Google Tasks adapter** (lightweight personal sync surface).
- **🗄 Legacy:** freeze the Auto-Success 13-category cycle + `wisdom.json` as RTP evidence for C8/C12 (copy to extraction package; never edit).
- **🔗 Wiring:** *this step IS the wiring.* Every later step's progress is a task row + outbox record; Sentry errors auto-open tasks; Linear is the human-readable mirror.
- **Exit gate:** a probe task flows `Linear issue → task_ledger → outbox → Sentry health` round-trip with idempotency proven; ORS computed from real signals.
- **Embodies:** C8, C12. **Authority:** ADR-0027; `packages/task-ledger/README.md`.

### Step 2 — Parallel async task processing (the throughput layer)
- **Entry gate:** Step 1 exit gate green; NATS bus reachable; CF Queues + Durable Objects provisioned.
- **⚙️ Build:** outbox **drain worker** (`heady-auto-sync` re-embodiment) → NATS/CF Queues; idempotent consumers; φ-backoff retry (`1618/2618/4236 ms` constants from `@heady/phi-math`); bulkhead concurrency from φ pools (Hot 34 / Warm 21 / Cold 13).
- **🗄 Legacy:** preserve the φ resource table (BUDDY_KERNEL §6) as the constants RTP for C2.
- **🔗 Wiring:** every async unit is a child task with a dependency edge; failures route to Sentry→task; retries are observable.
- **Exit gate:** N independent tasks process concurrently with at-least-once + idempotent semantics; zero localhost; backpressure holds under φ-ramped load.
- **Embodies:** C2, C12. **Authority:** durable-orchestration ADR; `STEPWISE_BUILD_SPEC.md` Phase 2.

### Step 3 — HeadyMCP migration (`headymcp.com`) — the foundational gateway
- **Entry gate:** Step 2 green; `@heady/contracts` OpenAPI skeleton compiles; CF AI Gateway configured as single egress.
- **⚙️ Build:** migrate the v6 unified MCP server → contracts-first surface; regenerate all tools (Kubb → `mcp-tools.json`); stand up the MCP Console (the locked spearhead) in `headyme-portal`; **route every model call through CF AI Gateway** (closes R-3); zero-trust tool sandbox.
- **Updated data relative to context:** drop direct Gemini/Claude/GPT calls (MC-04); embedding via `@cf/baai/bge-small-en-v1.5` 384-dim only (ADR-0015); secrets via GCP SM/OIDC (no committed keys, closes R-1).
- **🗄 Legacy:** preserve `mcp-servers/` v6 + tool schemas as RTP for the MCP-gateway IP; ARBITER-review the security-gateway patterns (MC-08).
- **🔗 Wiring:** each migrated tool = a task with an acceptance check; tool parity tracked in Linear; failures → Sentry.
- **Exit gate:** `headymcp.com` serves the full tool catalog through one gateway, fully functional, with contract-drift CI green and `.well-known` discovery live.
- **Embodies:** C1, C3. **Authority:** `docs/compendium/09`; disposition MC-01/03/06/08.

### Step 4 — Orchestration core: HeadyManager + HeadyConductor
- **Entry gate:** Step 3 green (tools reachable through the gateway); `@heady/kernel` builds green.
- **⚙️ Build:** **HeadyManager** = split god-server → `apps/heady-manager` (Cloud Run) + kernel logic in `@heady/kernel` (boot Layers 0–5, `cslGate`, `phiBackoff`); **HeadyConductor** = HCFullPipeline runner on CF Workflows + Queues + DO, 21 stages, path variants (Fast/Full/Arena/Learning), checkpoint per stage, deterministic topological sort.
- **🗄 Legacy:** preserve `heady-manager.js` + `core/` conductor as RTP for C3/C6; **archive** (don't delete) the monolith.
- **🔗 Wiring:** every pipeline stage emits a checkpoint task + outbox record; the build narrative streams to the admin UI (HeadyLens `<heady-build-narrative>`).
- **Exit gate:** a request traverses all 21 stages deterministically (same input hash → same output), checkpoints recorded, ORS-gated stop rules enforced.
- **Embodies:** C1, C3, C6, C11. **Authority:** `governance/directives/07`; disposition BE-01/02/06/11; BUDDY_KERNEL §1.

### Step 5 — HeadyAutoContext (systemic enrichment) + the learning loop
- **Entry gate:** Step 4 green; `packages/auto-context` v2 present; CI enforcer wired.
- **⚙️ Build:** confirm **HeadyAutoContext is systemic** (Constitution Law 4 / Directive 01) — every stage passes through `wrapGateway`/`assertEnriched`/`enrichForStage`; build the **continuous-learning loop** (C12): `wisdom.json` → **Neon pattern registry** + **Graph RAG** + **HeadyVinci** retrieval; anti-regression protocol (pattern-hit/miss).
- **🗄 Legacy:** preserve the 5-pass enrichment spec + Directive 8 as RTP for C5/C12.
- **🔗 Wiring:** pattern hits/misses logged as task annotations; drift events open Sentry issues; regression prevention is a gated check.
- **Exit gate:** a previously-solved task is resolved by a pattern hit (not from scratch); enrichment is non-bypassable (CI fails an un-enriched call).
- **Embodies:** C5, C12. **Authority:** `packages/auto-context`; MASTER_DIRECTIVES Dir 8; `heady-auto-context-v2` skill pointer.

### Step 6 — AI specialists (the battle-sim cast)
- **Entry gate:** Step 4 green (conductor runs stages); CF AI Gateway routing proven (Step 3).
- **⚙️ Build (parallel, each gated only on the conductor):**
  - **HeadySims** (SimPreflight gate) + **HeadyMC** (MC sampler) → `@heady/engines` determinism boundary;
  - **HeadyBattle** + **HeadyArena** (Multi-Model Council, φ-resonance modulation, consensus R-metric) → `@heady/engines`, ORS≥70 gated;
  - **HeadyJules** + **HeadyCoder/Codex/Copilot** (code synthesis) → `@heady/codeflow`, AI SDK v6 agents behind contracts;
  - **HeadyVinci** (pattern retrieval) wired into Step 5's loop.
- **🗄 Legacy:** preserve the 9-stage battle-sim + rubric weights (BUDDY_KERNEL §3, §5) as RTP for C7; rubric weights handled as **trade secret** (not in public claims).
- **🔗 Wiring:** each specialist's invocation is a sub-task with metrics (latency/tokens/model/score); Arena winners/losers feed the learning loop.
- **Exit gate:** Arena produces a consensus selection with `R≥ψ²`; code-synthesis chain passes determinism + tests; HeadySims predictions calibrate against actual outcomes.
- **Embodies:** C3, C6, C7. **Authority:** BUDDY_KERNEL §3–5; MASTER_DIRECTIVES Dir 9; disposition AG-02/05/13, BZ-02.

### Step 7 — Memory + swarm depth
- **Entry gate:** Step 5 green (enrichment + learning live); pgvector schema migrated to Neon (R-5 verified).
- **⚙️ Build:** **HeadyMemory** 3-tier T0/T1/T2 with φ-decay consolidation, **reconstructible** (ADR-0000), single 384-dim lock, Vectorize edge cache (derived); **HeadyBees/HeadySwarms** `BaseHeadyBee` lifecycle → `@heady/bees`, resonance routing, φ pools, guard 6765 / ceiling 10000, NATS orchestration; **384→3 projection** for the spatial view.
- **🗄 Legacy:** preserve memory tier policy + projection matrices (BUDDY_KERNEL §6; SYSTEM_PRIME_DIRECTIVE) as RTP for C5; bees runtime under ARBITER patent-lock (`packages/bees ⚠️`).
- **🔗 Wiring:** consolidation sweeps + swarm spawns are tasks; memory health feeds ORS.
- **Exit gate:** memory survives a cold restart by reconstruction (no RAM-as-truth); a multi-bee swarm reaches CONSENSUS via superposition; projection renders in the admin UI.
- **Embodies:** C4, C5. **Authority:** ADR-0000, ADR-0015; disposition DA-01/06/08, AG-01/03.

### Step 8 — Deferred frontier (gated re-entry, not dropped)
- **Entry gate (per node, independent):** core spine (Steps 1–7) green **and** the node's specific re-entry condition.
  - **HeadyPythia** — re-enter when forecasting has ≥1 real history source in pgvector.
  - **HeadyMaid** — re-enter when ORS-gated maintenance has destructive-op HCP approval.
  - **HeadyCloudConductor** — re-enter when multi-target deploy beyond Cloud Run+CF is actually needed.
  - **C9 PQC / security-mesh** — re-enter when a verified PQC module + threat model exist (aspirational R3).
  - **C10 protocol matrix (MIDI→{UDP/TCP/MCP/API})** — re-enter only if music/real-time becomes strategic.
- **⚙️ Build:** as gated. **🗄 Legacy:** preserve specs as RTP; no premature port.
- **Exit gate:** each node ships only when its embodiment is real (zero placeholders, Law: no stubs).
- **Embodies:** C9, C10, C12. **Authority:** disposition IN-19, MC-19, BE-19/21.

---

## 6. Dual-track discipline (Legacy ↔ Rebuild)

Every step above runs **two tracks in lockstep**, never blurring them:

| | 🗄 Legacy track (read-only) | ⚙️ Rebuild track (greenfield) |
|---|---|---|
| **Source** | `governance/legacy/*` + legacy stack at `/home/headyme/Heady` | `Heady-AI` monorepo (this repo) |
| **Action** | **Extract** concept + **preserve** RTP evidence; never edit | **Re-embody** with updated context; conform to locked stack |
| **Mechanism** | Extraction Engine (`docs/LEGACY_EXTRACTION_SYSTEM.md`); copy into an extraction/IP package | HCP (Ed25519-signed Heady Change Proposal) per patent-zone touch |
| **Gate** | ARBITER review (ALLOW / BLOCK / DEFER) for any patent-zone concept | CI: contracts drift, no-localhost, no-placeholder, enrichment-enforced |
| **Task system** | Each extraction = a task tagged `legacy-rtp` in Linear/ledger | Each re-embodiment = a task tagged `rebuild`, DAG-linked to its legacy RTP task |
| **Output** | Frozen evidence bundle strengthening provisional conversion | Runnable node, observable in the admin UI |

This is why the **task system is Step 1**: it is the shared substrate that keeps the two tracks linked
(every rebuild task carries a dependency edge back to its legacy-RTP task), so conversion counsel can
trace *concept → frozen evidence → updated embodiment* in one query.

---

## 7. Patent-zone gating & trade-secret handling (the protocol)

Reuse the machinery that already exists — **do not invent new gates**.

1. **Patent-lock zones** `HS-2026-051..062` (`AGENTS.md` §Patent Lock Zones) — any touch of
   `packages/csl-engine`, `packages/security-mesh`, `packages/bees` requires an **HCP**.
2. **HS-058** (VSA→CSL bridge) is the **proven HCP precedent** (`docs/LEGACY_EXTRACTION_SYSTEM.md §G2`) —
   use it as the template for the first migration HCP (C1 / Step 4 kernel CSL gates).
3. **ARBITER** review agent decides **ALLOW / BLOCK / DEFER** on every patent-zone concept before it lands.
4. **Trade secrets stay secret:** C2 φ-constants, C7 rubric weights, C8 Auto-Success invariants, C11 ORS
   weighting, C12 wisdom-registry heuristics are **not** placed in public claims or public repos —
   they live in `@heady/phi-math` / `@heady/engines` with restricted history and are referenced, not
   published.
5. **Conversion posture:** as each concept re-embodies cleaner in the rebuild, log the rebuild artifact as
   **updated RTP evidence** for the corresponding provisional; counsel pivots the nonprovisional claim to
   the stronger embodiment (e.g., reconstructible memory beats RAM-first; deterministic CSL beats ad-hoc).

---

## 8. Risks, pros & cons (rolled up)

| Risk | Likelihood | Mitigation |
|---|---|---|
| Concept migration accidentally edits frozen legacy | Low | Read-only mount + CI guard on `governance/legacy/*`; extraction copies only |
| Patent-zone code lands without HCP | Med | CI requires HCP ref on any `⚠️` package diff; ARBITER as required reviewer |
| Trade-secret weights leak into public claims/repo | Med | Section 7.4 separation; restricted history; review checklist |
| HeadyMCP gateway bypass persists (R-3) | Med | Step 3 exit gate explicitly proves single-egress; CI asserts no direct provider calls |
| Embedding-dim drift (1536 vs 384) re-enters | Med | ADR-0015 lock; `@heady/db assertEmbedding`; quarantine legacy 1536 SQL |
| Over-porting deferred nodes (Pythia/Maid/PQC/MIDI) | Med | Step 8 per-node re-entry gates; "no premature port" |

**Pros:** single task substrate links both tracks for counsel traceability; condition-gates remove
schedule fiction and honor ASAP; reuses existing IP machinery (no duplication); rebuild embodiments
strengthen conversion; every node observable in the admin UI from Step 1.

**Cons / trade-offs:** front-loads the task-system + gateway work before visible feature output;
requires disciplined HCP/ARBITER overhead on patent zones; deferred nodes may frustrate if their
re-entry gates stay red — accepted in exchange for zero-placeholder integrity.

---

## 9. Concrete next steps (ASAP — Law +9, condition-gated)

1. **Approve Steps 1–4 as the critical path** (task system → async → HeadyMCP → Manager/Conductor).
2. **Open the first migration HCP** for **C1 / Step 4** (kernel CSL gates) using the **HS-058** precedent template.
3. **Finalize `@heady/task-ledger` adapters** (Linear, Sentry, Google Tasks) — Step 1 build.
4. **Verify live Neon state (R-5)** before Step 7 memory migration assumes greenfield DB.
5. **Stand up the Linear↔ledger↔Sentry probe** to prove Step 1's exit gate, then let the DAG pull each
   subsequent step the instant its entry gate goes green.
6. *(Optional)* commit this plan to PR #207 and create the Step-1 task tree in Linear.

---

## 10. Source map (traceability)

| Claim / mapping | Source |
|---|---|
| 9-stage battle-sim; specialist cast (Sims/Battle/MC/Bees/Swarms); AutoContext; φ resource table; ORS; integration points | `governance/legacy/BUDDY_KERNEL.md` |
| 21-stage HCFullPipeline + path variants; Dir 8 continuous learning (wisdom.json/Graph RAG/HeadyVinci); Dir 9 Council; HeadyCoder→Codex→Copilot; HeadySims MONTE_CARLO | `governance/legacy/MASTER_DIRECTIVES.md` |
| Arena Mode; 10k-bee ceiling; Auto-Success φ⁷ invariants | `governance/legacy/UNBREAKABLE_LAWS.md` |
| 7 archetypes; CSL resonance 0.618; 384→3 projection | `governance/legacy/SYSTEM_PRIME_DIRECTIVE.md` |
| ASAP / condition-not-clock doctrine | `governance/legacy/LAW-09-ASAP-EXECUTION.md` |
| Component dispositions (BE/AG/DA/MC/IN/BZ/DX, R-1..R-10) | `docs/LEGACY_STACK_COMPONENT_DISPOSITION.md` |
| Patent-lock zones HS-2026-051..062; ARBITER; HCP; embedding lock | `AGENTS.md` §Patent Lock Zones; `docs/adr/0015-embedding-model-lock.md` |
| HS-058 VSA→CSL HCP precedent; 3 real gates | `docs/LEGACY_EXTRACTION_SYSTEM.md` §G2 |
| Task ledger: state machine, DAG deps, idempotency, transactional outbox, Linear+Sentry | `packages/task-ledger/README.md`; ADR-0027 |
| Condition-gated step grammar; phase backbone | `docs/STEPWISE_BUILD_SPEC.md`; `docs/REBUILD_PLAN_V2.md` |
| Service/domain map; headymcp MCP hub; portal spearhead | `docs/compendium/09-infra-and-services.md` |
| Reconstructible memory (no RAM-as-truth) | `docs/adr/0000-*` |
| Patent-zone packages (csl-engine, security-mesh, bees) | `docs/PACKAGE_CATALOG.md` |
| ~51 provisionals; conversion posture | `docs/compendium/10-business-and-roadmap.md` |

---

*Heady™ — HeadySystems Inc. — All Rights Reserved — 60+ Provisional Patents.*
*This plan claims no legal certainty. IP posture decisions are advisory pending counsel review.*
*Authority: `governance/CONSTITUTION.md` v9.0.0. Frozen provenance: `governance/legacy/` (read-only).*
*No time-based estimates or dependencies appear in this document by design (Law +9, condition-not-clock).*
