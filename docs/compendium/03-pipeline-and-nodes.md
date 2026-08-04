# 03 — HCFullPipeline, Nodes & Execution Protocols

> The 21-stage orchestration DAG, the 21 service nodes it runs across, and the loops/protocols that wrap
> every task. **What · Why · How · When · Where · Disposition.**

---

## P1. HCFullPipeline — the 22-stage DAG (DISTILL terminal per ADR-0045; the prior fib(8)=21 canon is superseded)

**What.** The end-to-end autonomous orchestration: a request enters and passes through **21 stages**
(0–20, CHANNEL_ENTRY → RECEIPT, φ-anchored to fib(8)=21) whose execution order is a
**data-dependency DAG** (stages fire when their inputs are ready, not by priority).
**Why.** A single, auditable, replayable execution spine where competition (Arena), simulation
(Monte-Carlo), judging, approval, verification, and self-improvement are explicit stages — not ad-hoc.
**How.** Stages 00–20 (21 total); critical path ≈ 16 stages, the rest run off-path in parallel pools. **When.** Every
non-trivial task. **Where.** Backed by **durable Cloudflare Workflows** (each stage = `step.do`;
human-gate = `step.waitForEvent`); fast in-flight distribution may use Redis Streams (best-effort).
**Disposition:** **canonical as a Workflow DAG** — but V9's "no queues, all fire at once" framing (R7) is
**rejected**: the data-dependency DAG is real, durable queues/outbox are required (ADR-0002). Selective
checkpointing — only externally-visible-state-mutating steps are checkpointed.

| # | Stage | What it does | Gate/metric |
|---|---|---|---|
| 00 | CHANNEL_ENTRY | multi-channel gateway, identity, context sync | auth + AutoContext |
| 01 | RECON | deep scan: codebase, configs, attack surface | scan protocol (P3) |
| 02 | INTAKE | async semantic barrier, 3D vector context | embed → CSL |
| 03 | CLASSIFY | intent via CSL Resonance Gate | `cos ≥ ψ` |
| 04 | TRIAGE | route by CSL domain match, swarm assignment | risk score |
| 05 | DECOMPOSE | subtask DAG (Rabbit layer) | DAG produced |
| 06 | TRIAL_AND_ERROR | sandboxed execution, auto-rollback (≥2 trials) | rollback safe |
| 07 | ORCHESTRATE | bee spawning, resource alloc, dependency wiring | Bee Factory |
| 08 | MONTE_CARLO | HeadySims 1K+ scenarios | ≥80% pass |
| 09 | ARENA | multi-candidate competition (seeded PRNG) | ≥5% margin |
| 10 | JUDGE | weighted rubric | correctness .34 / safety .21 / perf .21 / quality .13 / elegance .11 |
| 11 | APPROVE | **Progressive Autonomy Gate** | human/CSL (P2) |
| 12 | EXECUTE | metacognitive gate | confidence ≥ ψ² |
| 13 | VERIFY | post-exec validation, integration tests | tests pass |
| 14 | SELF_AWARENESS | confidence calibration, blind-spot detection | — |
| 15 | SELF_CRITIQUE | bottlenecks, weaknesses, waste | — |
| 16 | MISTAKE_ANALYSIS | root cause (5-Whys + Ishikawa) → prevention rule | LR registry |
| 17 | OPTIMIZATION_OPS | dead-code detection, CSL ROI ranking | — |
| 18 | CONTINUOUS_SEARCH | new tools, research, security advisories | — |
| 19 | EVOLUTION | controlled mutation: mutate→simulate→measure→promote | gated |
| 20 | RECEIPT | audit log + wisdom.json (ML-DSA/Ed25519 signed); incl. trace distillation → optimized recipe (DSPy MIPROv2/GEPA; Voyager skill synth) | trust receipt (`06-G5`) / recipe stored (`07-T7`) |

> **Stage count = 21 (fib(8)), terminal = RECEIPT.** DISTILL (recipe synthesis) is folded into RECEIPT,
> not a separate 22nd stage — an earlier draft numbered 00–21 and listed DISTILL separately, an
> off-by-one. Canonical authority: `.agents/context/HEADY_SUPER_PROMPT_v5.md` §6 + facts.yaml `hcfullpipeline.stage_count`.

**Parallel pools:** A {RECON∥INTAKE}, B {TRIAL∥ORCHESTRATE}, C {MONTE_CARLO∥ARENA}, D {SELF_AWARENESS∥
SELF_CRITIQUE∥MISTAKE}, E {OPTIMIZATION∥CONTINUOUS_SEARCH}.

**Canonical reduction:** the 21 stages are the *designed* loop. The buildable Phase-3 version implements
the spine — CLASSIFY→TRIAGE→DECOMPOSE→(ARENA/JUDGE where multi-candidate helps)→APPROVE→EXECUTE→VERIFY→
RECEIPT→DISTILL — and treats SELF_* / EVOLUTION as the MAPE-K loop (`06-G10`), not inline per-request
stages, until evidence says otherwise.

## P2. Progressive Autonomy Gate (stage 11)

**What.** The graduated authority ladder controlling how much the system may do without a human. **Why.**
Autonomy must be earned, not defaulted (ADR-0005/0016). **How.** Maps to the rustc stage0/1/2 bootstrap
(`06-G8`): read-only → scoped writes (docs/tests/small refactors) → condition-unlocked broader scope.
**When.** Before EXECUTE. **Where.** `step.waitForEvent` + the 3-layer CSL gate. **Disposition:**
baseline; "Approve all" exists nowhere.

## P3. The wrapping protocols (run around every task)

- **Socratic Execution Loop** — 7 questions before any code (true intent? what exists? minimal change?
  violates a law? what breaks + test? OSS to extract instead? CSL/φ connection?). *Disposition: baseline,
  encode in AGENTS.md.*
- **Systematic Scan Protocol** — 8 pre-task checks (repo inventory, localhost scan, build-step scan,
  console.* scan, PQC scan, dead-endpoint scan, ≥90% coverage, type-safety). Any FAIL blocks changes.
  *Disposition: baseline as CI + pre-commit; PQC scan → R3 (advisory now).*
- **6-Layer Cognitive Boot** — Edge Gateway → Memory Activation → CSL Calibration → Swarm Topology →
  Metacognitive Loop → Council+Evolution. *Disposition: a conceptual boot order; maps to service
  startup.*
- **9-Stage Battle-Sim** — pre-flight simulation pipeline (Monte-Carlo + Arena heritage). *Disposition:
  folds into stages 08/09.*

## P4. The 21 Heady nodes (the services the pipeline runs across)

**What.** 21 logical service nodes, each exposing `GET /health`, `GET /.well-known/agent.json` (A2A),
pino logging, ML-DSA-signed requests, φ-backoff circuit breaker. **Disposition:** **logical services**
in the modular monolith (Cloud Run) + edge (Workers), **not 21 separate deployments** (R4/R5); names map
to bounded contexts.

| Group | Nodes |
|---|---|
| **Core Pipeline (10)** | heady-brain, heady-buddy, heady-soul, heady-conductor, heady-orchestrator, heady-patterns, heady-aware, heady-corrections, heady-qa, heady-vinci |
| **Intelligence (5)** | heady-memory, heady-embed, heady-vector, heady-infer, heady-foundry |
| **Integration (6)** | heady-mcp, heady-io, heady-bee-factory, heady-guard, heady-governance, **heady-distiller** |

Node→archetype mapping is in `01-laws-and-constants.md` §A. The service-registry endpoints
(auth/api/memory/vector/infer/conductor/soul/brain/mcp/health/admin/events/distiller …) are in
`09-infra-and-services.md`.

## P5. Monte-Carlo · Arena · Judge · Council (the quality core)

- **HeadySims (08)** — 1K+ scenario Monte-Carlo, ≥80% pass before proceeding.
- **Battle Arena (09)** — multi-candidate competition, seeded PRNG, ≥5% margin to declare a winner
  (`heady-battle-arena`, `heady-arena-productization`).
- **Judge (10)** — 5-dim weighted rubric (correctness .34 / safety .21 / perf .21 / quality .13 /
  elegance .11).
- **Multi-Model Council** (`05-model-mesh.md`) — parallel Claude/GPT-4o/Gemini/Groq → anonymous
  cross-critique → chairman aggregation; Byzantine quorum N≥3f+1; 85% of queries handled single-model at
  confidence >0.85. *Disposition: baseline for high-stakes decisions; single-model fast-path by default
  (cost).* 

**Disposition rollup:** the pipeline + nodes are canonical as a **durable Workflow DAG over a modular
monolith**, with the self-improvement stages running as the MAPE-K loop and the 21 nodes as bounded
contexts. V9's "instantaneous, no-queue, all-parallel" maximalism is reconciled to a real DAG on durable
queues (R7).
