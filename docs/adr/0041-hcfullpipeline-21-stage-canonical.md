# ADR-0041: 21-Stage HCFullPipeline as the Canonical Execution Model

**Status:** Accepted
**Date:** 2026-08-04
**Accepted:** 2026-08-04 by Eric Haywood (HeadySystems Inc.) — founder acceptance per the ADR-0031 ceremony.
**Deciders:** Eric Haywood (HeadySystems Inc.)
**Strength of Acceptance:** ⭐⭐⭐⭐ (High — rebuild ADRs already treat this as authoritative)

> **Provenance:** rewritten from legacy `docs/ADR/0012-21-stage-pipeline-canonical.md`
> (`e911513b`). Ported per the legacy→rebuild ADR reconciliation; adapted to rebuild
> conventions and numbering.
>
> **Cross-reference reconciliation:** rebuild `docs/adr/0036-gcp-region-canonical-lock.md`
> (lines 20, 22, 143) and `docs/adr/0030-understanding-engine.md` cite this decision as
> **"ADR-0012"** — a *legacy* number that in rebuild collides with
> `0012-finops-spend-reporting.md`. **This ADR (0041) is the canonical rebuild home.**
> Those two ADRs are Accepted and immutable; their "ADR-0012" references should be
> reconciled to "ADR-0041" at the next ceremony (not edited here, per the ADR
> immutability rule).

## Context

The 21-stage HCFullPipeline (FULL) is referenced across the rebuild ADR set as the
canonical execution model, yet it has **no ADR of record** in rebuild — a dangling
canonical reference. Other pipeline variants (8-stage FAST, 13-stage STANDARD, 15-stage
ARENA, 13-stage LEARNING) are derivatives of the FULL definition, not alternatives.
`21 = fib(8)` aligns the canonical stage count with the φ-math standard.

## Decision

The **21-stage HCFullPipeline (FULL variant)** is the canonical execution model. All
variants are subsets or extensions of the single 21-stage definition:

| Variant | Stages | fib() | Use case |
|---------|-------:|-------|----------|
| FAST | 8 | fib(6) | Low-latency, simple tasks |
| STANDARD | 13 | fib(7) | Normal HCFP flow |
| **FULL** | **21** | **fib(8)** | Complete analysis — **canonical** |
| ARENA | 15 | — | Multi-model competition (accepted Fibonacci exception) |
| LEARNING | 13 | fib(7) | Self-improvement loops |

- Stage definitions are owned by a **single canonical module** so runtime and config
  cannot drift (the legacy home was `core/pipeline/stages.js`; the rebuild siting is
  fixed during pipeline implementation and recorded here when landed).
- The FULL variant runs `CHANNEL_ENTRY → … → RECEIPT` with **checkpoint/restore and
  error recovery at every stage boundary**.
- Auto-success heartbeat base cycle = **`φ⁷ × 1000 = 29034 ms`** — this is
  `HEARTBEAT_MS` exported by `@heady/phi-math` (no magic number).

## Consequences

**Positive:** one canonical stage definition eliminates config↔runtime drift; Fibonacci
counts are φ-justifiable; checkpoint/restore enables mid-pipeline resume; all variants
share one engine code path (no forked logic).

**Negative:** the FULL pipeline adds latency for tasks needing only 8 stages (mitigated
by variant selection at dispatch); adding a stage requires a superseding ADR + the
canonical module update; ARENA (15) breaks Fibonacci alignment — accepted as a
competition-specific exception.

## Alternatives Considered

- Single flat pipeline, no variants — rejected (latency profile unacceptable across task types).
- Dynamic runtime stage composition — deferred (scheduling complexity).
- 20 stages (round number) — rejected (breaks Fibonacci alignment).

## References

- Legacy source: `docs/ADR/0012-21-stage-pipeline-canonical.md` @ `e911513b`
- Dangling refs to reconcile: `docs/adr/0036-gcp-region-canonical-lock.md:20,22,143`; `docs/adr/0030-understanding-engine.md`
- Heartbeat constant: `@heady/phi-math` (`HEARTBEAT_MS = 29034`)
