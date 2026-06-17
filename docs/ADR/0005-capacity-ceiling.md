# ADR-0005: Runtime Capacity Ceiling — fib(20)=6765 Enforced, 10000 Aspirational
**Date:** 2025-06-01 | **Status:** Accepted | **Author:** Eric Haywood

## Context

Two conflicting numbers existed in the codebase: `heady-cognitive-config.json` defined
`6765` as the bee capacity ceiling (Fibonacci-aligned: fib(20)), while several directive
documents referenced `10000` as a target. Runtime guards cannot enforce two different limits.

The discrepancy was traced to `RECONCILIATION_DECISIONS.md` which documented the conflict
but did not formally resolve it as an ADR.

## Decision

- **Runtime enforcement:** `fib(20) = 6765` — all capacity guards, pool size checks, and
  auto-scaling limits use this number until live soak tests validate a higher floor
- **Strategic/roadmap language:** `10000` remains valid in external communications and
  roadmap documentation as the aspirational business target
- Upgrade path: once sustained load tests at 6765 pass CSL CRITICAL (0.927) gate with
  no degradation, the ceiling is promoted to the next Fibonacci milestone (fib(21) = 10946)

## Consequences

### Positive
- Single enforced number eliminates split-brain config bugs
- Fibonacci alignment keeps capacity limits consistent with all other φ-scaled constants
- Aspirational 10k target preserved for GTM/investor materials without compromising runtime safety
- Upgrade path is deterministic (soak test → CSL gate → next Fibonacci step)

### Negative
- 10000 in roadmap docs vs 6765 in code will require explanation to technical reviewers
- fib(21) = 10946 overshoots the 10000 business target, requiring eventual reconciliation

## Alternatives Considered

- **Enforce 10000 immediately**: rejected — no soak test evidence capacity holds at that ceiling
- **Remove the ceiling entirely**: rejected — unbounded capacity risks cascading failures
- **Round to 7000**: rejected — breaks Fibonacci alignment, introduces a magic number
