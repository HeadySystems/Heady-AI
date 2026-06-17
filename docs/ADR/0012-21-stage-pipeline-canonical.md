# ADR-0012: 21-Stage HCFullPipeline as the Canonical Execution Model
**Date:** 2026-06-17 | **Status:** Accepted | **Author:** Eric Haywood

## Context

Two authoritative config files (`hcfullpipeline.yaml` and `hcfullpipeline.json`) both
defined a 21-stage pipeline. However, `RECONCILIATION_DECISIONS.md` noted the conflict
without formally elevating it to an ADR. Other pipeline variants (8-stage FAST,
13-stage STANDARD, 15-stage ARENA) are derivatives, not alternatives.

21 = fib(8), the eighth Fibonacci number, providing mathematical alignment with the
φ-math standard.

## Decision

The **21-stage HCFullPipeline (FULL variant)** is the canonical execution model.
All pipeline variants are subsets or extensions of this 21-stage definition:

| Variant | Stage Count | fib() | Use Case |
|---------|-------------|-------|---------|
| FAST | 8 | fib(6) | Low-latency, simple tasks |
| STANDARD | 13 | fib(7) | Normal HCFP flow |
| FULL | 21 | fib(8) | Complete analysis — canonical |
| ARENA | 15 | — | Multi-model competition |
| LEARNING | 13 | fib(7) | Self-improvement loops |

Stage definitions live exclusively in `core/pipeline/stages.js`. The FULL variant
executes `CHANNEL_ENTRY → … → RECEIPT` with checkpoint/restore and error recovery at
every stage boundary.

Auto-success heartbeat timing: `φ⁷×1000 = 29034ms` base cycle.

## Consequences

### Positive
- Single canonical stage definition eliminates drift between `hcfullpipeline.yaml` and runtime code
- Fibonacci stage counts align with φ-math standard — all counts are justifiable
- Checkpoint/restore enables mid-pipeline resume after transient failures
- Variants share the same engine code path — no forked logic to maintain

### Negative
- 21-stage FULL pipeline introduces latency overhead for tasks that only need 8 stages
  (mitigated by variant selection at dispatch time)
- Adding a new stage requires amending this ADR and updating `core/pipeline/stages.js`
- Arena (15 stages) breaks Fibonacci alignment — this is accepted as a competition-specific exception

## Alternatives Considered

- **Single flat pipeline, no variants**: rejected — latency profile unacceptable for all task types
- **Dynamic stage composition at runtime**: considered — deferred; increases scheduling complexity
- **20 stages (round number)**: rejected — breaks Fibonacci alignment
