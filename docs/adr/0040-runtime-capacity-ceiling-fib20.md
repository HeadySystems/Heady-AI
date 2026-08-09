# ADR-0040: Runtime Capacity Ceiling fib(20)=6765

- **Status:** Accepted (original date unrecorded, legacy corpus) · Transferred to canonical corpus 2026-08-09
- **Deciders:** Eric Anthony Haywood

## Context

Two legacy authorities disagreed on the platform's concurrency ceiling. The cognitive configuration
(`heady-cognitive-config.json`) anchors its scaling math to the Fibonacci ladder terminating at
fib(20)=6765, while the master directives describe "10,000 concurrent" as the scale target. Runtime
code needs exactly one enforced number; a guard that reads 6765 in one path and 10000 in another is
not a guardrail, it is two different systems.

`governance/legacy/RECONCILIATION_DECISIONS.md` records the resolution as canon:

- Current enforced bee capacity is **6765** for runtime guards because it is Fibonacci-aligned in
  `heady-cognitive-config.json`.
- The strategic ceiling can still be described as **10000 in roadmap language**, but runtime configs
  should not enforce 10000 until the rest of the platform is capacity-tested.

## Decision

1. **fib(20)=6765 is the enforced runtime capacity ceiling** for concurrent agent/bee workers and any
   derived pool, queue, or bulkhead sizing.
2. **10000 is aspirational business language only.** It may appear in roadmap and marketing prose; it
   must not appear as an enforced limit in any runtime configuration.
3. Raising the hard limit past 6765 requires **live soak tests** demonstrating the platform sustains
   the higher load — the ceiling moves on evidence, not ambition. Any successor ceiling remains
   Fibonacci-aligned (next candidate: fib(21)=10946, not 10000).

## Consequences

- (+) One number governs capacity everywhere; guards, bulkheads, and autoscaling derive from a single
  φ-native constant instead of two conflicting sources.
- (+) The ceiling composes with the φ-math foundation (ADR-0042): 6765 is the terminal element of the
  config's own Fibonacci sequence, so per-type bulkheads (55 concurrent, 89 queued) roll up to a
  ceiling in the same number system.
- (−) Marketing's "10,000 concurrent" claim and the enforced reality diverge until soak tests close
  the gap; external language must be worded as a target, not a spec.
- Capacity is a machine-enforced fact (wired 2026-08-09, alongside this transfer): the golden record carries
  `capacity.max_concurrent_runtime: 6765` in `facts.yaml`, the `facts.v1` schema
  (`packages/contracts/src/facts-schema.mjs`) const-locks it the way it locks the pipeline stage
  count, and the coherence gate's scalar guard `C-capacity`
  (`tooling/coherence/src/coherence.mjs`, `SCALAR_GUARDS`) fails on any prose or config that asserts
  a different enforced concurrency ceiling. Raising the ceiling therefore requires a soak-tested
  superseding ADR plus a deliberate schema change — the intended friction.

## Reconciliation (2026-08-09 transfer)

- This decision **supersedes the 10,000-concurrent claim** asserted by the legacy bee-swarm ADR
  (`/home/headyme/_archive/Heady/docs/adr/ADR-010-bee-swarm-agent-pattern.md`, "scaled to 10,000
  concurrent" / "10,000 concurrent bee scale readiness (Unbreakable Law LAW-06)"). That readiness
  claim was never capacity-tested; under this ADR it is roadmap language, not a runtime limit.
- The archived snapshots of `heady-cognitive-config.json` (both `/home/headyme/_archive/Heady/heady-cognitive-config.json`
  and `/home/headyme/_archive/Heady/configs/heady-cognitive-config.json`) still carry
  `"max_concurrent_bees": 10000` — superseded drift — while their own `fibonacci_sequence` terminates
  at 6765, the exact conflict this decision resolves. The reconciliation record's reading stands: the Fibonacci-aligned
  6765 is the enforced number; the 10000 literal in those snapshots is superseded and must not be
  copied into rebuild runtime configs.

## Provenance

- Primary source: `/home/headyme/_archive/Heady/docs/ADR/0004-capacity.md` (legacy ADR 0004,
  "Capacity guardrails").
- Corroborating primary source: `/home/headyme/Heady-AI/governance/legacy/RECONCILIATION_DECISIONS.md`
  (canonical reconciliation record for the 6765/10000 conflict).
- Superseded claim: `/home/headyme/_archive/Heady/docs/adr/ADR-010-bee-swarm-agent-pattern.md`.
- Transferred into the canonical corpus 2026-08-09; the originals remain in place in the archive.
