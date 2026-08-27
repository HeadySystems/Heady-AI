<!-- HEADY_BRAND:BEGIN
  HEADY™ · MASTER DIRECTIVE 7 — DIRECTIVE 7: HCFULLPIPELINE — THE 22-STAGE COGNITIVE DAG
  LAYER: root · scope: GLOBAL_PERMANENT · enforcement: MANDATORY
  ∞ Sacred Geometry · Liquid Intelligence ∞
  Made with ❤️ by HeadySystems Inc.
HEADY_BRAND:END -->

# DIRECTIVE 7: HCFULLPIPELINE — THE 22-STAGE COGNITIVE DAG (v9.0)

## Purpose
All non-trivial tasks flow through HCFullPipeline — the deterministic, auditable, replayable nervous
system. **22 stages (00–21)** whose execution order is a **data-dependency DAG** (stages fire when their
inputs are ready, **not** by priority). Critical path = 16 stages; 6 run off-path in parallel pools.
Backed by **durable Cloudflare Workflows** (each stage = `step.do`; human gate = `step.waitForEvent`).
*(Canonical per `docs/compendium/03-pipeline-and-nodes.md`, v9.0. This supersedes the legacy 21-stage
count from `RECONCILIATION_DECISIONS.md` — stage 21 `DISTILL` was added in the v9.0 compendium scan
2026-03-16. The legacy "12-stage" reference is also stale.)*

## The 22 Stages

| # | Stage | Gate / metric |
|---|---|---|
| 00 | CHANNEL_ENTRY | auth + AutoContext (`enrichForStage`, coherence ≥ ψ) |
| 01 | RECON | scan protocol |
| 02 | INTAKE | embed → CSL (context ≥ 0.92) |
| 03 | CLASSIFY | CSL Resonance Gate `cos ≥ ψ` (0.618) |
| 04 | TRIAGE | risk score, swarm assignment |
| 05 | DECOMPOSE | subtask DAG produced (Rabbit layer) |
| 06 | TRIAL_AND_ERROR | sandboxed, auto-rollback (≥ 2 trials) |
| 07 | ORCHESTRATE | Bee Factory: spawn, alloc, wire |
| 08 | MONTE_CARLO | HeadySims 1K+ scenarios, ≥ 80% pass |
| 09 | ARENA | multi-candidate competition (seeded PRNG), ≥ 5% margin |
| 10 | JUDGE | correctness .34 / safety .21 / perf .21 / quality .13 / elegance .11 |
| 11 | APPROVE | **Progressive Autonomy Gate** (human/CSL) |
| 12 | EXECUTE | metacognitive gate, confidence ≥ ψ² |
| 13 | VERIFY | post-exec validation, integration tests pass |
| 14 | SELF_AWARENESS | confidence calibration, blind-spot detection |
| 15 | SELF_CRITIQUE | bottlenecks, weaknesses, waste |
| 16 | MISTAKE_ANALYSIS | 5-Whys + Ishikawa → LR registry |
| 17 | OPTIMIZATION_OPS | dead-code detection, CSL ROI ranking |
| 18 | CONTINUOUS_SEARCH | new tools, research, security advisories |
| 19 | EVOLUTION | mutate → simulate → measure → promote (gated, max 13% change) |
| 20 | RECEIPT | audit log + wisdom.json (ML-DSA / Ed25519 signed) |
| 21 | DISTILL | trace → optimized recipe (DSPy MIPROv2/GEPA; Voyager skill synth) |

## Stage 00 contract — CHANNEL_ENTRY (AutoContext)
CHANNEL_ENTRY is the single chokepoint where every request enters the pipeline. After auth it MUST
flow through the systemic `@heady/auto-context` middleware before any reasoning stage runs (Constitution
Law 4, Directive 01):
1. **Enrich** — `enrichForStage(task, profileName)` CSL-ranks ecosystem fragments against the request
   embedding (384-dim), gates at `CSL_THRESHOLDS.LOW` (0.691), dedupes at `DEDUP_THRESHOLD`, caps to a
   φ-budget (`FIB[8]`=21 fragments), and returns a context capsule with `coherence` = mean retained score.
2. **Gate** — `wrapGateway` halts the request when `coherence < GATE.HALT` (ψ²≈0.382); the capsule is
   attached as `req.autoContext`.
3. **Assert** — `assertEnriched(req)` throws if a downstream reasoning stage (`.complete`/`.battle`/
   `.council`) is reached without a context capsule.
Build-time, `tooling/enforcers/autocontext.mjs` (governance CI job) fails any reasoning call that does
not route through this middleware. The narrative of each build flows onto the event bus
(`heady.action.build.*`) and is captured by the HeadyLens spine (`@heady/narrative`).

## Parallel pools (off critical path)
- **A** {RECON ∥ INTAKE}
- **B** {TRIAL_AND_ERROR ∥ ORCHESTRATE}
- **C** {MONTE_CARLO ∥ ARENA}
- **D** {SELF_AWARENESS ∥ SELF_CRITIQUE ∥ MISTAKE_ANALYSIS}
- **E** {OPTIMIZATION_OPS ∥ CONTINUOUS_SEARCH}

## Canonical reduction (buildable spine)
The 22 stages are the *designed* loop. The buildable Phase-3 version implements the reduction spine —
`CLASSIFY → TRIAGE → DECOMPOSE → (ARENA/JUDGE) → APPROVE → EXECUTE → VERIFY → RECEIPT → DISTILL` — and
runs `SELF_*` / `EVOLUTION` as the **MAPE-K loop** (not inline per-request). V9's "no queues, all fire at
once" framing is rejected: the data-dependency DAG is real and durable queues/outbox are required
(ADR-0002). Only externally-visible-state-mutating steps are checkpointed.

## Stage Transition Rules
Data-dependency DAG (a stage fires when its inputs are ready; no priority ordering) · failed stages →
φ-backoff retry 1618 → 2618 → 4236ms (max 3) · after 3 → escalate to HeadyBuddy with full diagnostics ·
durations tracked via `observability-kernel` · SLA < 60s MEDIUM, < 300s HIGH.

## Variants
- **Fast** (low-consequence): `00-01-02-07-12-13-20`
- **Full** (all 22): `00 … 21`
- **Arena** (competition-focused): `00-01-02-03-04-08-09-10-20`
- **Learning** (MAPE-K): `00-01-16-17-18-19-21`

---
*Heady™ — HeadySystems Inc. — Implements the Constitution (`governance/CONSTITUTION.md`). Canonical source: `docs/compendium/03-pipeline-and-nodes.md`.*
