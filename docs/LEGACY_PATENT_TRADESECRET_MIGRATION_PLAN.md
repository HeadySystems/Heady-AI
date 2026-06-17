<!-- HEADY_BRAND:BEGIN
  ╔══════════════════════════════════════════════════════════════════╗
  ║  HEADY™ — Legacy Patent & Trade-Secret Concept Migration Plan      ║
  ║  ∞ Sacred Geometry ∞  Continuous Semantic Logic · φ-Scaled         ║
  ║  LAYER: docs/ (planning) · governed by CONSTITUTION v9.0.0         ║
  ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
  ╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# Legacy Patent & Trade-Secret Concept Migration Plan

> **Status:** Draft for founder approval · **Date:** 2026-06-17 · **Owner:** Eric Anthony Haywood
> **Scope:** Migrate the *inventive concepts* (patents + trade secrets) reduced to practice in
> `governance/legacy/` — and the broader 60+ provisional estate — **into the rebuild with updated
> context**, without editing the frozen legacy source.
> **Governed by:** `governance/CONSTITUTION.md` (v9.0.0), `AGENTS.md` §Patent Lock Zones,
> `docs/LEGACY_EXTRACTION_SYSTEM.md`, `docs/adr/` (0000–0029), `docs/compendium/`.
> **IP framing standard:** `heady-patent-intel` skill — careful language only
> (*potentially novel*, *appears differentiated by*, *likely overlap in*, *reduction to practice may be
> evidenced by*). No legal certainty is claimed anywhere in this document.

---

## 0. What this document is (and is not)

The rebuild already has a **code-migration** engine. `docs/LEGACY_EXTRACTION_SYSTEM.md` carves legacy
*components* into conformant packages one disposition row at a time, and `AGENTS.md` already defines a
**patent-lock zone** review gate (ARBITER swarm, patent IDs `HS-2026-051..062`, Ed25519-signed HCP
records). This document is the **missing connective tissue on the IP axis**: it maps the *concepts the
patents and trade secrets actually protect* to their new homes, so that when a component is carved out,
the invention travels with **updated context** and the provisional-→-nonprovisional record stays clean.

| This plan IS | This plan IS NOT |
|---|---|
| A concept-level migration map (invention → rebuild target → approach) | A re-inventory of components (`LEGACY_STACK_COMPONENT_DISPOSITION.md` owns that) |
| The IP-safe framing + reduction-to-practice (RTP) chain for each concept | A legal filing or claim chart (legal track: PandaDoc/Drive, counsel) |
| A patent-zone gating + trade-secret handling protocol for the carve-out | A phase re-ordering (`REBUILD_PLAN_V2.md` owns phases) |
| Concrete, executable next steps with owners and gates | A modification of any `governance/legacy/*` file (those are **frozen**, ADR-style provenance) |

> **Hard rule inherited from the Constitution (Law L-A3 Sovereignty + the legacy-freeze convention):**
> `governance/legacy/*` is **read-only provenance**. Migration = *copy the concept out and re-found it in
> the rebuild with updated context*, never edit the frozen source. This preserves the unbroken
> reduction-to-practice trail that the provisional applications rely on.

---

## 1. Why now, and why concept-first

Three forces converge:

1. **The provisional clock.** The business roadmap records **51 provisionals filed with USPTO** and a
   **provisional→granted conversion deadline of 2027-03-06** (Gate 4), against a **60+ provisional**
   estate. Provisionals must be converted to non-provisionals (or PCT) within **12 months** of filing or
   the priority date is lost. A clean, navigable concept-to-code map is the single highest-leverage input
   to a low-cost, defensible conversion.
2. **The carve-out is live.** The Extraction Engine is already porting patent-zone components
   (`csl-engine`, `security-mesh`, `bees` are flagged `⚠️ patent zone` in `docs/PACKAGE_CATALOG.md`). If
   the concept map lags the code carve-out, the RTP evidence fragments across two repos and a frozen
   archive.
3. **Updated context changes claim scope.** Several legacy descriptions are now **stale** (the
   reconciliation already corrected 12-stage→21-stage pipeline and all-MiniLM→`bge-small-en-v1.5` 384-dim
   — `governance/CONSTITUTION.md` Part C, ADR-0015). A concept whose RTP cites a stale embedding model or
   a dropped datastore (Qdrant, R2 reconciliation) needs its invention narrative refreshed to match what
   the rebuild actually runs, or the strongest embodiment won't be the one on record.

**Concept-first** (not file-first) because a single provisional often spans several legacy files and will
land across several rebuild packages. The unit of migration here is the *invention*, not the *file*.

---

## 2. Source corpus — what the frozen legacy actually contains

The 7 frozen files under `governance/legacy/` are the **pre-reconciliation source corpus** the active
governance was distilled from (`governance/legacy/README.md`). They are also the densest surviving
**reduction-to-practice prose** for the platform's inventive concepts:

| Frozen file | Concept density (RTP signal) |
|---|---|
| `BUDDY_KERNEL.md` (v4.0.0 "Liquid Latent") | CSL gate truth table (AND/OR/NOT/GATE/IMPLY/CONSENSUS/XOR/ANALOGY), φ-harmonic gate thresholds, adaptive gate temperature `T = ψ^(1+2(1−H/Hmax))`, deterministic replay + SHA-256 drift window, 3-tier φ-decay memory, 9-stage battle-sim, ORS scoring |
| `UNBREAKABLE_LAWS.md` | Arena Mode protocol (seeded-PRNG competition), phi-exponential backoff, 10,000-bee scale design, Auto-Success φ⁷ heartbeat invariants |
| `MASTER_DIRECTIVES.md` | 21-stage HCFullPipeline state machine, CSL-replaces-conditionals routing, MIDI→{UDP,TCP,MCP,API} deterministic protocol matrix, Socratic execution loop, Sacred Geometry φ-scaling table |
| `SYSTEM_PRIME_DIRECTIVE.md` | 7 Cognitive Archetypes, CSL resonance gate 0.618, 3D spatial projection (384→3), embedding density gate 0.92 |
| `LAW-09-ASAP-EXECUTION.md` | ASAP-execution operating posture (now Constitution Law +9) |
| `RECONCILIATION_DECISIONS.md` | The canonical decisions (21-stage, 6765 runtime guard, 29034 ms base) — *prevents re-migrating settled questions* |
| `README.md` | The supersession map (legacy → active authority) |

> **Already migrated — do NOT re-do.** The *governance* surface of these files is done: the
> `CONSTITUTION.md` (Laws 0–9 + 4 Liquid laws), the 10 `governance/directives/*`, and the
> `docs/compendium/*` already reconcile and supersede the legacy law/directive text. This plan covers the
> **inventive-concept residue** that governance reconciliation did *not* itself carry into code: the
> mathematics, data structures, protocols, and orchestration methods that the **patents** protect.

---

## 3. The migratable concept inventory (the IP backbone)

Twelve concept clusters carry the patent/trade-secret weight. Each is tagged with an IP posture and the
existing rebuild anchor (if any). φ = 1.618033988749895; ψ = 1/φ = 0.618; ψ² = 0.382.

| # | Concept cluster | IP posture | Existing rebuild anchor |
|---|---|---|---|
| C1 | **Continuous Semantic Logic (CSL)** — cosine/projection logic gates replacing `if/else` | **Patent (HS-058 zone)** + method trade secret (adaptive gate temperature) | `packages/csl-engine` (`⚠️ patent zone`) |
| C2 | **Sacred Geometry / φ-math foundation** — all constants φ/Fibonacci-derived | **Trade secret** (the *specific constant table*); concept is hard to patent (math per se) | `packages/phi-math` |
| C3 | **HCFullPipeline** — 21-stage deterministic cognitive state machine | **Patent** (orchestration method) + trade secret (stage gates/weights) | `governance/directives/07-hcfullpipeline.md`, `docs/compendium/03` |
| C4 | **HeadyBee swarm + 17-swarm matrix** — Fibonacci-pooled worker factory at scale | **Patent** (`bees` `⚠️ patent zone`) | `packages/bees` (planned, Phase 3) |
| C5 | **3-tier φ-decay vector memory + 384→3 spatial projection** | **Patent** (spatial-memory) + trade secret (decay/consolidation schedule) | `packages/memory-stream`, `packages/embedding`, ADR-0017/0023 |
| C6 | **Deterministic replay + SHA-256 drift detection + auto-reconfig** | **Patent** (self-stabilizing determinism) | partially in `packages/csl-engine`; Law 5 (planned) |
| C7 | **Arena Mode / Multi-Model Council** — seeded competitive eval + φ-resonance modulation + consensus R-metric | **Patent** (competitive selection) + trade secret (rubric weights) | ADR-0018 model gateway (Phase 3) |
| C8 | **Auto-Success Engine** — φ⁷ (29,034 ms) heartbeat, CSL-discovered categories, φ-ratio budget | **Trade secret** (the cycle + tiering) | Law 7; `observability-kernel` |
| C9 | **PQC / security-mesh** — post-quantum-ready crypto agility, Ed25519 receipts, zero-trust sanitize | **Patent** (`security-mesh` `⚠️ patent zone`) | `packages/security-mesh` (`⚠️`), R3 aspirational |
| C10 | **Deterministic protocol matrix** — MIDI→{UDP<1ms, TCP<10ms, MCP<50ms, API<200ms} | **Patent** (latency-tiered actuation) | Directive 04; `docs/compendium/07-transforms-midi-creative.md` |
| C11 | **Socratic execution loop + ORS gating** — 4-gate pre-action check, ORS-gated behaviors | **Trade secret** (gate composition) | Directive 03; ORS in compendium/06 |
| C12 | **Continuous-learning / anti-regression (`wisdom.json` + Graph RAG)** — pattern hit/learn loop | **Trade secret** + possible patent (learned-pattern routing) | Directive 08; ADR-0020 event bus |

**Cross-cutting binder — HS-058 (BZ-05 VSA→CSL bridge).** `docs/LEGACY_EXTRACTION_SYSTEM.md` §G2 already
records that the CSL carve-out *touches `HS-058`* and must open an HCP. That is the canonical example of
the gating this plan generalizes to all twelve clusters.

---

## 4. The migration map — per concept

Each row gives: **legacy RTP source** → **updated-context delta** → **rebuild target** → **migration
approach** → **IP-safe framing focus** → **pros / cons / risks**. The approach verbs follow the Extraction
Engine's disposition vocabulary (`Integrate ✅` / `Adapt 🔧` / `Defer ⏸`).

### C1 — Continuous Semantic Logic (CSL) `⚠️ patent zone HS-058`

- **Legacy RTP.** `BUDDY_KERNEL.md` §2 CSL Gate Truth Table + "CSL Replaces All Conditionals" table;
  adaptive gate temperature `T = ψ^(1+2(1−H/Hmax))`; gate contract flow (HALT < ψ², CAUTIOUS < ψ,
  EXECUTE ≥ ψ).
- **Updated-context delta.** Embedding dim is **locked to 384** (`@cf/baai/bge-small-en-v1.5`, mean
  pooling — ADR-0015), *not* the legacy dual 384/1536. The 1536D "full-mode" embodiment is **retired**;
  the strongest current embodiment is single-dim 384 with `@heady/csl-engine` `cosineSimilarity`. The RTP
  narrative must be refreshed to the 384-dim embodiment so the on-record claim matches production.
- **Rebuild target.** `packages/csl-engine/src/index.mjs` (gates) + `@heady/phi-math` (thresholds:
  `CSL_THRESHOLDS{MINIMUM 0.5, LOW 0.691, MEDIUM 0.809, HIGH 0.882, CRITICAL 0.927}`, `GATE{HALT≈0.382,
  EXECUTE≈0.618}`).
- **Approach.** **Adapt 🔧** under **ARBITER + HCP** (this is the HS-058 zone). Port the 8-gate algebra and
  the adaptive-temperature function as pure vector arithmetic (no LLM in the math path — Law 5 / Directive
  04 §4.3). Keep AND/OR/NOT/GATE/IMPLY/CONSENSUS/XOR/ANALOGY; document any gate not yet implemented as a
  tracked gap, never a stub (Law 1).
- **IP-safe framing focus.** *Potentially novel*: using orthogonal projection (`NOT: a − proj_b(a)`) and a
  φ-derived adaptive threshold-temperature as the **sole** control-flow substrate. *Likely overlap in*:
  generic cosine-similarity routing / MoE gating (cite as closest prior art). *Differentiation angle*:
  the entropy-adaptive gate temperature + the φ-quantized threshold ladder + determinism guarantee.
- **Pros.** Highest-value patent; already has a package + threshold source of truth.
  **Cons/Risks.** Crowded prior-art space (MoE routers, VSA); the *math itself* is not patentable — the
  **applied system** is. Mitigation: frame claims around the integrated system (gates + φ-thresholds +
  determinism + audit), and keep the adaptive-temperature *parameterization* as a trade secret rather than
  disclosing it fully.

### C2 — Sacred Geometry / φ-math foundation

- **Legacy RTP.** `MASTER_DIRECTIVES.md` Directive 10 φ-scaling table; `BUDDY_KERNEL.md` §6 resource
  derivation table (29,034 ms = φ×18,000; 144=fib(12); 47=φ⁸; pools 34/21/13).
- **Updated-context delta.** Now a single source: `@heady/phi-math` (`PHI`, `PSI`, `PHI_7`,
  `HEARTBEAT_MS=29034`, `FIB[]`, `CSL_THRESHOLDS`, `DEDUP_THRESHOLD`). Constitution Law L-A2 makes this a
  fail-closed expectation ("one source: `@heady/phi-math`").
- **Rebuild target.** `packages/phi-math` (done) — this concept is **migrated as infrastructure**.
- **Approach.** **Integrate ✅** (largely complete). Remaining: ensure every *other* migrated concept
  imports constants from `@heady/phi-math` rather than re-deriving (the coherence registry / Law 7
  constant-import check).
- **IP-safe framing focus.** Do **not** attempt to patent golden-ratio math. Protect as **trade secret**
  the *specific constant table* (which value maps to which subsystem) and the *empirical tuning rationale*
  in `Directive 10 §10.3`. The defensible patent angle is narrow: a *system* that derives all operational
  constants from one φ-source with a CI gate forbidding magic numbers (a process/architecture claim, weak).
- **Pros.** Already the substrate; zero migration risk. **Cons/Risks.** Minimal IP value standalone; value
  is as the *binder* that makes C1/C3/C5/C8 cohere. Treat as supporting evidence, not a standalone filing.

### C3 — HCFullPipeline (21-stage deterministic state machine) `patent`

- **Legacy RTP.** `MASTER_DIRECTIVES.md` Directive 7 (full 21-stage table with per-stage gates + the 4
  path variants Fast/Full/Arena/Learning); `BUDDY_KERNEL.md` Layer 1 + §3 9-stage battle-sim.
- **Updated-context delta.** Canonical count is **21 stages** (RECONCILIATION_DECISIONS; both
  `hcfullpipeline.{yaml,json}`), reconciled away from the legacy Prime Directive's stale "12-stage." Ground
  truth = `docs/compendium/03-pipeline-and-nodes.md`; the rebuild's stage-00 (CHANNEL_ENTRY) already
  carries the `enrichForStage` auto-context contract from the prior phase. Stage weights updated
  (JUDGE: correctness 34% / safety 21% / perf 21% / quality 13% / elegance 11% — Fibonacci-derived).
- **Rebuild target.** `governance/directives/07-hcfullpipeline.md` (canonical prose, done) →
  **execution package** `packages/kernel` (orchestrator; the state-machine implementation lands Phase 3
  alongside `packages/bees`).
- **Approach.** **Adapt 🔧**. Concept (governance) migrated; **executable state machine** is the open work.
  Port stages, gates, and the 4 variants; bind each stage to its enforcer; emit narrative bus events
  (`heady.action.build.*`) per the HeadyLens spine already wired.
- **IP-safe framing focus.** *Potentially novel*: a deterministic, seeded-PRNG, CSL-gated cognitive
  pipeline with explicit **self-awareness / self-critique / mistake-analysis / evolution** stages
  (14–19) as first-class, auditable steps. *Likely overlap in*: generic LLM-agent pipelines / DAG
  orchestrators. *Differentiation*: the metacognitive stages + φ-backoff stage retry + Ed25519 receipt
  (stage 20) as a single reproducible unit.
- **Pros.** Strong method claim; governance already done. **Cons/Risks.** Pipeline-orchestration prior art
  is dense (LangGraph, Temporal, Step Functions). Anchor novelty on the *metacognition-as-pipeline-stage*
  and *determinism+receipt* combination, not on "it has stages."

### C4 — HeadyBee swarm + 17-swarm matrix `⚠️ patent zone`

- **Legacy RTP.** `UNBREAKABLE_LAWS.md` Law 6 (10,000-bee scale table, Fibonacci pool sizing, spawn
  <50 ms, lease-based dead-bee detection); `MASTER_DIRECTIVES.md` §5 lifecycle (SPAWN→…→DEAD),
  `BUDDY_KERNEL.md` §3 Stage 5/6 bee dispatch + swarm route (Hot 34 / Warm 21 / Cold 13).
- **Updated-context delta.** **Runtime guard 6765** (Fibonacci, enforced) with **10,000 strategic ceiling**
  (RECONCILIATION_DECISIONS; Constitution Law 6). 17 swarms is **canonical and frozen** (do not change);
  bee count reconciled to the rebuild's catalog. Pools stay 34/21/13.
- **Rebuild target.** `packages/bees` (planned, Phase 3, `⚠️ patent zone`); registry + lifecycle +
  Fibonacci pre-warm pools.
- **Approach.** **Adapt 🔧** under **ARBITER + HCP**. Port the worker factory, Fibonacci pool sizing, and
  lease/heartbeat lifecycle; enforce the 6765 runtime guard in config; keep 10,000 as roadmap language
  only.
- **IP-safe framing focus.** *Potentially novel*: Fibonacci-stepped pre-warmed pools with CSL-scored task
  routing and φ-threshold scale triggers (`queue_depth > pool × φ`). *Likely overlap in*: actor systems,
  worker pools, autoscalers. *Differentiation*: the **φ-scale-trigger + CSL-affinity dispatch + lease
  lifecycle** integrated under a fixed Sacred-Geometry topology.
- **Pros.** Distinctive scale story; already zoned. **Cons/Risks.** "Worker pool that autoscales" is prior
  art everywhere — claim must be tightly scoped to the φ/CSL specifics. Capacity claims (6765/10,000) are
  *unverified at runtime* — do not assert tested-at-scale in the RTP until load-forge data exists.

### C5 — 3-tier φ-decay vector memory + 384→3 spatial projection `patent`

- **Legacy RTP.** `BUDDY_KERNEL.md` Layer 3 (T0/T1/T2, HNSW, φ-decay consolidation) + §6 memory TTL
  ladder (T1 47 h=φ⁸, consolidation 6.85 h=φ⁴, T2 warm 55 h, archive 144 h); `SYSTEM_PRIME_DIRECTIVE.md`
  projection 384→3.
- **Updated-context delta.** **Neon = system of record; pgvector = sole retrieval authority; Vectorize =
  derived 384-dim edge cache; Qdrant dropped** (RECONCILIATION_DECISIONS R2, ADR-0003). RAM-first /
  latent-as-truth is **rejected** (ADR-0000) — so the legacy "3-tier vector latent space" must be re-framed
  as *reconstructible projections over the Neon SoR*, not as primary truth. Projection trigger is
  ADR-0023; embedding acquisition ADR-0024.
- **Rebuild target.** `packages/memory-stream`, `packages/embedding` (acquire-tiers, corpus, embedder),
  ADR-0017 projections engine.
- **Approach.** **Adapt 🔧**. Port the φ-decay consolidation schedule and the 384→3 spatial projection as a
  **generated projection** over Neon (Law: generated-not-authored). Keep the TTL ladder as `@heady/phi-math`
  constants.
- **IP-safe framing focus.** *Potentially novel*: a φ-decay tiered memory whose 3D spatial projection +
  consolidation cadence are golden-ratio-timed, *derived deterministically* from a relational SoR. *Likely
  overlap in*: standard vector DBs + HNSW + TTL caches. *Differentiation*: the **deterministic
  reconstructibility** (no latent-as-truth) + φ-timed consolidation + octant-indexed spatial events.
- **Pros.** The "reconstructible, not RAM-first" reframing is *stronger* IP than the legacy version and
  aligns with ADR-0000. **Cons/Risks.** Must explicitly *abandon* the RAM-first embodiment in the RTP
  narrative; if old provisional text leans on latent-as-truth, the conversion should pivot the strongest
  embodiment to the reconstructible one.

### C6 — Deterministic replay + SHA-256 drift detection + auto-reconfig `patent`

- **Legacy RTP.** `BUDDY_KERNEL.md` §2 step 6 (SHA-256 hash, drift window of last 11, drift > ψ² →
  auto-reconfig: lock temp=0/seed=42, raise MC iterations, tighten CSL by ψ²) + §3 Stage 7/8 (ResultCapture
  / DriftCheck) + deterministic_params (temp 0, top_p 1, seed 42).
- **Updated-context delta.** Constitution **Law 5 (Determinism)** owns this and is **planned** (lands with
  `packages/model-gateway`, Phase 3, ADR-0018). Outputs SHA-256 hashed + signed; CSL math stays pure.
- **Rebuild target.** `packages/csl-engine` (drift window) + model gateway (deterministic params) +
  `packages/security-mesh` (Ed25519 signing of receipts).
- **Approach.** **Adapt 🔧**. Port the rolling-hash drift window + the auto-reconfig remediation ladder;
  wire into the gateway's deterministic call path.
- **IP-safe framing focus.** *Potentially novel*: a **self-stabilizing** loop where output-hash drift
  beyond a φ²-threshold automatically tightens determinism parameters and CSL gates. *Likely overlap in*:
  reproducible-build hashing, canary drift alarms. *Differentiation*: the **closed-loop auto-reconfig**
  (drift → parameter lock → threshold tighten) tied to semantic gates.
- **Pros.** Genuinely unusual closed loop; clean RTP prose. **Cons/Risks.** "Same input → same output" is
  only achievable on the *deterministic path* (CSL math), not stochastic LLM generation — the claim must
  scope to the math/routing layer, and the RTP must be honest about that boundary.

### C7 — Arena Mode / Multi-Model Council `patent + trade-secret weights`

- **Legacy RTP.** `UNBREAKABLE_LAWS.md` Law 8 (generate→simulate→score→compete→promote→learn→audit, seeded
  PRNG); `BUDDY_KERNEL.md` §5 (φ-resonance modulation `score×(1+0.05·sin(score·φ·π))`, consensus R-metric
  `R=|Σwᵢaᵢ|/Σ|wᵢaᵢ|`, escalate if R < ψ²); `MASTER_DIRECTIVES.md` Directive 9 routing.
- **Updated-context delta.** Constitution **Law 8 (Arena default + no-ship-without-tests)** is partially
  enforced. Model egress is **single-path via CF AI Gateway** (locked decision); routing is ADR-0018
  liquid routing. Council models refreshed to current generation.
- **Rebuild target.** model gateway package (ADR-0018) + a competition harness; consensus/scoring in
  `@heady/csl-engine` (`CONSENSUS` gate).
- **Approach.** **Adapt 🔧**. Port the protocol + φ-resonance modulation + consensus R-metric; keep the
  **rubric weights** as a trade secret (config, not committed literals where avoidable).
- **IP-safe framing focus.** *Potentially novel*: φ-resonance score modulation creating harmonic peaks at
  golden-ratio quality balance + a vector consensus-strength metric R that auto-escalates on disagreement.
  *Likely overlap in*: LLM-as-judge, ensemble voting, model routing. *Differentiation*: the **φ-resonance
  modulation function** + **R-metric escalation gate**.
- **Pros.** The resonance-modulation function is a crisp, unusual, demonstrable claim element.
  **Cons/Risks.** LLM-ensemble prior art is exploding in 2026 — file/convert promptly; the modulation
  formula is the defensible core, the "compete then pick best" wrapper is not.

### C8 — Auto-Success Engine `trade secret`

- **Legacy RTP.** `UNBREAKABLE_LAWS.md` Law 7 (φ⁷=29,034 ms cycle, φ³=4,236 ms task timeout, φ-backoff
  retry, φ-ratio category tiers 38.2/23.6/14.6/9.0%); `BUDDY_KERNEL.md` §4 (13 categories, 144 tasks).
- **Updated-context delta.** Constitution **Law 7** locks base cycle φ⁷=29,034 ms + heartbeats
  `PHI_7×1000` sourced from `@heady/phi-math` (partially enforced via centralized constants). Categories
  are **CSL-discovered at runtime**, not hardcoded.
- **Rebuild target.** scheduler/engine bound to `observability-kernel`; constants from `@heady/phi-math`.
- **Approach.** **Adapt 🔧 / Defer ⏸** (runs after the kernel + bees land). Port the heartbeat + φ-ratio
  budget allocation; keep the **exact tier percentages + category-discovery heuristic** as trade secret.
- **IP-safe framing focus.** Treat as **trade secret**, not a filing — the value is the *tuned cadence +
  CSL category discovery*, which is hard to claim and easy to design around if disclosed. Protect via
  access control + the fact it's runtime-computed.
- **Pros.** Cheap to protect (don't disclose). **Cons/Risks.** None significant; just resist the urge to
  patent a timer.

### C9 — PQC / security-mesh `⚠️ patent zone`

- **Legacy RTP.** `MASTER_DIRECTIVES.md` Directive 3 (zero-trust sanitize layers, self-healing protocol);
  `UNBREAKABLE_LAWS.md` Law 8 audit (Ed25519); Constitution Part C notes PQC-everywhere.
- **Updated-context delta.** Constitution marks **PQC-everywhere as aspirational (R3)** — *not* a day-one
  hard gate; tracked under the security-mesh roadmap. Secrets resolve from **GCP Secret Manager (keyless
  OIDC)**, never `.env` (Law L-A3). Ed25519 receipts are real today (used in HCP signing).
- **Rebuild target.** `packages/security-mesh/src/index.mjs` (`⚠️ patent zone`).
- **Approach.** **Adapt 🔧** under **ARBITER + HCP** for the patentable crypto-agility concept; **Defer ⏸**
  the full PQC-everywhere embodiment to R3. Migrate Ed25519 receipt signing + zero-trust sanitize now.
- **IP-safe framing focus.** *Potentially novel*: cryptographic **agility** (pluggable classical→PQC suites
  with phi-scheduled rotation) bound to a semantic firewall. *Likely overlap in*: standard PQC migration
  patterns (NIST), crypto-agility frameworks. *Differentiation*: the **CSL-gated sanitize + φ-scheduled
  rotation + agent-identity receipt** integration. Be conservative — PQC prior art (NIST standards) is
  authoritative; claim the *integration*, not the primitives.
- **Pros.** Aligns with sovereign-AI positioning. **Cons/Risks.** PQC is heavily standardized — low
  patentability for primitives; do not over-claim. The aspirational status means RTP for "PQC-everywhere"
  is **weak today** — record only what's actually reduced to practice (Ed25519, sanitize layers).

### C10 — Deterministic protocol matrix (MIDI→{UDP/TCP/MCP/API}) `patent`

- **Legacy RTP.** `MASTER_DIRECTIVES.md` Directive 4 protocol-selection matrix (latency tiers <1ms / <10ms
  / <50ms / <200ms with explicit guarantees) + determinism requirements.
- **Updated-context delta.** Lives in `docs/compendium/07-transforms-midi-creative.md`; aligns with the
  rebuild's SSE+HTTP/2 client sync (WebSockets replaced) and NATS event bus.
- **Rebuild target.** a transforms/bridge package (compendium 07) — currently **concept-only**, no package
  yet; **Defer ⏸** to a later phase.
- **Approach.** **Defer ⏸** (low rebuild priority) but **preserve the RTP** here so the provisional record
  stays intact. When built, **Adapt 🔧**.
- **IP-safe framing focus.** *Potentially novel*: mapping physical-gesture MIDI control-change values
  (0–127) to JSON-RPC tool calls across a latency-tiered protocol ladder with per-tier delivery guarantees.
  *Likely overlap in*: MIDI-over-network, OSC, protocol gateways. *Differentiation*: the **gesture→LLM-tool
  via tiered guarantees** binding.
- **Pros.** Distinctive, demoable, low prior-art overlap in the *AI-tool* framing. **Cons/Risks.** Not on
  the critical rebuild path — risk is *neglect*, not conflict. Keep the RTP warm even while deferring code.

### C11 — Socratic execution loop + ORS gating `trade secret`

- **Legacy RTP.** `MASTER_DIRECTIVES.md` Directive 3 §3.4 (Necessity/Safety/Efficiency/Learning 4-gate);
  `BUDDY_KERNEL.md` §8 ORS (components + weights + ORS-gated behaviors).
- **Updated-context delta.** ORS lives in `docs/compendium/06-governance.md`; gates bind to enforcers.
- **Rebuild target.** kernel pre-action check + `observability-kernel` ORS metric.
- **Approach.** **Adapt 🔧**. Port as a pre-action middleware; keep ORS component weights as config.
- **IP-safe framing focus.** **Trade secret** (gate composition + ORS weighting). Low patentability;
  protect by non-disclosure.
- **Pros.** Cheap. **Cons/Risks.** Negligible.

### C12 — Continuous-learning / anti-regression (`wisdom.json` + Graph RAG) `trade secret / possible patent`

- **Legacy RTP.** `MASTER_DIRECTIVES.md` Directive 8 (pattern hit/learn loop, anti-regression protocol,
  4-source learning) + `BUDDY_KERNEL.md` §4 confidence calibration.
- **Updated-context delta.** Pattern store re-homed onto Neon SoR + pgvector (not a loose `wisdom.json`
  file — ADR-0000 forbids file-as-truth); Graph RAG over the event bus (ADR-0020).
- **Rebuild target.** memory-stream + event bus; a learned-pattern registry table in Neon.
- **Approach.** **Adapt 🔧**. Re-found `wisdom.json` as a Neon-backed pattern registry; port the
  hit/miss/learn loop + confidence-calibration delta tracking.
- **IP-safe framing focus.** *Possibly novel*: CSL-similarity pattern retrieval driving anti-regression
  immunization with per-domain confidence-calibration correction factors. *Likely overlap in*: RAG, few-
  shot memory, experience replay. *Differentiation*: the **anti-regression rule generation** (pipeline
  stage 16) feeding a CSL-indexed registry.
- **Pros.** Reinforces C3 (pipeline). **Cons/Risks.** RAG prior art is vast; keep claim narrow to the
  anti-regression-rule generation loop, otherwise hold as trade secret.

---

## 5. Patent-zone gating & trade-secret handling (the protocol)

This plan **reuses** the existing IP machinery rather than inventing new gates.

**5.1 Patent-zone carve-out gate (reuse `AGENTS.md` §Patent Lock Zones + Extraction Engine G2).**
Any concept tagged `⚠️ patent zone` (C1/C4/C9, and C6/C7 where they touch HS-058/security-mesh) follows
the established flow on extraction:

```
disposition row (e.g. BE-04 csl-engine 🔧)
  → G2 Pre-port: ARBITER checks patent zones (HS-2026-051..062 / HS-058)
    → if touched: verdict BLOCK → DEFER, open HCP-2026-0NN declaring the patent-lock zone
      → Founder signs (Ed25519) → ALLOW
        → port with updated context → characterization tests → ledger record → STEPWISE entry
```

No patent-zone concept merges without an **Ed25519-signed HCP**. This plan adds one obligation: the HCP
**must cite the matching concept row (C1–C12) and its updated-context delta**, so the RTP chain is
explicit in the signed record.

**5.2 Trade-secret handling.** For C2 (constant table), C8 (cycle + tiers), C11 (ORS weights), and the
parameterized parts of C1/C7:
- Do **not** disclose the tuned values in public filings; keep them as runtime-computed or
  config-resolved (GCP Secret Manager / Neon), never as committed literals where avoidable.
- Mark the owning files/sections with a trade-secret note in the HEADY_BRAND block.
- Record their existence (not their values) in the legal track register so counsel can decide
  patent-vs-secret per concept.

**5.3 Reduction-to-practice preservation.** Because `governance/legacy/*` is frozen, the RTP prose stays
intact by definition. This plan adds a **forward pointer**: each migrated concept's new home carries a
one-line provenance comment `// RTP: governance/legacy/<file> §<section> — see LEGACY_PATENT_TRADESECRET_MIGRATION_PLAN.md C<n>`
so an examiner or counsel can trace invention → frozen RTP → live embodiment in one hop.

---

## 6. Phased execution schedule (φ-aligned, condition-gated)

Gates are **conditions, not clocks** (ADR-0013). Phases align to `REBUILD_PLAN_V2.md` (P0–P4) and the
business gates; this plan adds the **IP deliverable per phase**.

| Phase | Concept work | IP deliverable | Gate to advance |
|---|---|---|---|
| **P1 (now)** | C2 confirm `@heady/phi-math` is the sole constant source; C1 RTP-refresh narrative to 384-dim | This document approved; HS-058 HCP template drafted | Founder sign-off on the concept map |
| **P2** | C1 CSL gate parity (8 gates) under HCP; C6 drift window; C11 Socratic middleware | Concept-to-package provenance comments landed; CSL RTP narrative refreshed | ARBITER ALLOW on csl-engine HCP |
| **P3** | C3 pipeline state machine; C4 bees factory (6765 guard); C7 Arena harness; C9 Ed25519 receipts + sanitize; C5 memory φ-decay + 384→3 projection | HCPs for bees + security-mesh; updated RTP for C3/C4/C5/C7 | Load-forge data exists before asserting scale claims |
| **P4** | C8 Auto-Success engine; C12 Neon pattern registry; C10 MIDI matrix (if prioritized) | Trade-secret register complete; **provisional→nonprovisional conversion package** assembled (deadline 2027-03-06) | Counsel review; conversion filed |

**Critical path for the provisional clock:** C1 → C3 → C4/C5/C7 RTP refreshes feed the conversion
package. Start the C1 RTP-refresh in P1 even though the gate parity lands in P2 — the narrative is
independent of the code completion.

---

## 7. Risks, pros & cons (rolled up)

**Top risks.**
1. **Stale-embodiment risk (high).** Provisionals filed against legacy text (12-stage, 1536D, all-MiniLM,
   RAM-first) describe embodiments the rebuild no longer runs. *Mitigation:* the per-concept
   updated-context deltas in §4 are the conversion checklist — pivot each strongest embodiment to the
   reconciled one before conversion.
2. **Crowded prior art (high for C1/C7/C12).** CSL, ensemble-judging, and RAG are dense 2026 fields.
   *Mitigation:* IP-safe framing focuses every claim on the *integrated, φ/CSL-specific* element, not the
   generic wrapper; convert promptly.
3. **Over-claiming PQC (medium).** C9 PQC-everywhere is aspirational (R3); RTP is weak today.
   *Mitigation:* record only reduced-to-practice security (Ed25519, sanitize); defer PQC claims.
4. **Unverified scale (medium).** C4 6765/10,000 are not load-tested. *Mitigation:* gate any
   tested-at-scale RTP language on load-forge data (P3).
5. **Frozen-source drift (low).** Editing `governance/legacy/*` would break the provenance chain.
   *Mitigation:* the freeze rule + forward-pointer comments (§5.3); never modify the archive.

**Pros.** The rebuild's reconciled architecture (reconstructible memory, single embedding lock,
deterministic CSL, signed receipts) yields **stronger, cleaner embodiments** than the legacy versions —
conversion can claim the better system. The IP gates already exist; this plan only wires the concept axis
into them.

**Cons.** Real engineering hours (C3/C4/C5 are Phase-3 builds) sit on the critical path to a defensible
conversion package; the provisional deadline (2027-03-06) makes sequencing unforgiving.

---

## 8. Concrete next steps (ASAP — Law +9)

1. **Founder review + sign-off** on the C1–C12 concept map and IP postures (this doc). *(Owner: Eric)*
2. **Draft the HS-058 HCP template** referencing concept rows, ready for the CSL carve-out
   (`docs/hcp/` follows `HCP-0001` format). *(Owner: Eric + ARBITER)*
3. **Land provenance forward-pointers** (§5.3) in `packages/csl-engine`, `packages/phi-math`,
   `packages/security-mesh`, `packages/memory-stream` as HEADY_BRAND comments — no logic change, pure
   traceability. *(Owner: agent, P1)*
4. **Refresh the C1 (CSL) RTP narrative** to the 384-dim embodiment and stage it for counsel — independent
   of code completion, on the provisional critical path. *(Owner: Eric + counsel)*
5. **Open the trade-secret register** (C2/C8/C11 + parameterized C1/C7) on the legal track (PandaDoc/Drive)
   recording *existence, not values*. *(Owner: Eric)*
6. **Bind each Phase-3 build (C3/C4/C5/C7/C9) to its HCP + RTP refresh** in `STEPWISE_BUILD_SPEC.md` so the
   invention travels with the code. *(Owner: agent, P3)*

---

## 9. Source map (traceability)

| Claim in this plan | Source (in-repo / frozen) |
|---|---|
| Legacy freeze rule; supersession map | `governance/legacy/README.md` |
| 21-stage canonical; 6765 guard; 29034 ms base | `governance/legacy/RECONCILIATION_DECISIONS.md`; `governance/CONSTITUTION.md` Part C |
| Laws 0–9 dispositions; PQC aspirational (R3); memory not-RAM-first | `governance/CONSTITUTION.md`; `docs/adr/0000-reject-ram-first-latent-as-truth.md` |
| CSL gate truth table; adaptive temperature; determinism params; ORS; φ resource table | `governance/legacy/BUDDY_KERNEL.md` |
| Arena Mode; 10,000-bee scale; Auto-Success φ⁷ invariants | `governance/legacy/UNBREAKABLE_LAWS.md` |
| 21-stage pipeline; CSL-replaces-conditionals; MIDI protocol matrix; φ-scaling table | `governance/legacy/MASTER_DIRECTIVES.md` |
| 7 archetypes; CSL resonance 0.618; 384→3 projection | `governance/legacy/SYSTEM_PRIME_DIRECTIVE.md` |
| Patent-lock zones HS-2026-051..062; ARBITER; HCP; embedding lock | `AGENTS.md` §Patent Lock Zones / §Stack; `docs/adr/0015-embedding-model-lock.md` |
| HS-058 VSA→CSL bridge HCP precedent; 3 real gates | `docs/LEGACY_EXTRACTION_SYSTEM.md` §G2 |
| Patent-zone packages (csl-engine, security-mesh, bees) | `docs/PACKAGE_CATALOG.md` |
| 51 provisionals; conversion deadline 2027-03-06; org frame | `docs/compendium/10-business-and-roadmap.md` |
| Embedding model `@cf/baai/bge-small-en-v1.5` 384-dim | `AGENTS.md`; `docs/adr/0015-embedding-model-lock.md` |

---

*Heady™ — HeadySystems Inc. — All Rights Reserved — 60+ Provisional Patents.*
*This plan claims no legal certainty. IP posture decisions are advisory pending counsel review.*
*Authority: `governance/CONSTITUTION.md` v9.0.0. Frozen provenance: `governance/legacy/`.*
