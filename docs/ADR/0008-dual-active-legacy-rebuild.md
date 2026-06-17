# ADR-0008: Dual-Active Branch Strategy — Legacy and Rebuild Are Interchangeable, Not Successive
**Date:** 2026-06-17 | **Status:** Accepted | **Author:** Eric Haywood

## Context

An earlier separation plan proposed making the `rebuild` branch the default, retiring
`legacy-main`, and performing a hard cutover. This was revised: the rebuild is not a
replacement but a parallel evolution. Both HeadyMe (legacy foundation) and HeadyAI
(rebuild organisation) must remain fully functional and state-interchangeable at all times.

The decision was captured in session notes but never formalised as an ADR, leaving
ambiguity about whether legacy components could be safely deprecated.

## Decision

The rebuild (HeadyAI org) and legacy (HeadyMe/HeadySystems org) branches are maintained
as **dual-active**. Neither branch is retired until explicit feature-parity verification
passes CSL CRITICAL (0.927) on all pipeline variants. The authoritative source of truth
for both branches is `github.com/HeadySystems/heady-ai`.

Requirements for legacy retirement (future ADR):
1. All 21 HCFullPipeline stages validated equivalent between branches
2. Vector memory import/export parity confirmed at DEDUP threshold
3. All 9 domain sites serving from rebuild origin without degradation
4. Sustained 72-hour soak test at fib(20)=6765 capacity ceiling

Until those conditions are met: any change to rebuild must preserve state
interchangeability with legacy.

## Consequences

### Positive
- Zero-downtime migration path — production traffic never has a hard cutover moment
- Legacy components remain valid fallback targets if rebuild regressions occur
- IP continuity: patent filings reference both HeadyMe and HeadyAI lineage
- Parallel validation possible — the same request can be routed to both branches and diff'd

### Negative
- Maintaining two active branches doubles some maintenance burden
- State interchangeability requires strict interface contracts between branches (additional engineering)
- Ambiguity about "which branch is production" must be resolved with explicit routing config

## Alternatives Considered

- **Hard cutover**: rejected — production risk unacceptable without full soak validation
- **Legacy-only until rebuild is complete**: rejected — rebuild cannot be validated without live traffic
- **Feature-flag-gated rollout**: considered as the eventual promotion mechanism once parity is confirmed
