# ADR-0043: Runtime Capacity Ceiling — fib(20)=6765 Enforced, 10000 Aspirational

**Status:** Accepted
**Date:** 2026-08-04
**Accepted:** 2026-08-04 by Eric Haywood (HeadySystems Inc.) — founder acceptance per the ADR-0031 ceremony.
**Deciders:** Eric Haywood (HeadySystems Inc.)
**Strength of Acceptance:** ⭐⭐⭐ (Medium — anti-split-brain runtime guard)

> **Provenance:** rewritten from legacy `docs/ADR/0005-capacity-ceiling.md` (`e911513b`),
> ported at founder direction.

## Context

Two conflicting capacity numbers existed historically: `6765` (`fib(20)`, a runtime
ceiling) and `10000` (an aspirational business target). Runtime guards cannot enforce two
different limits; the split-brain must be resolved to one enforced number.

## Decision

- **Runtime enforcement:** `fib(20) = 6765` — all capacity guards, pool-size checks, and
  auto-scaling limits use this number until sustained soak tests validate a higher floor.
- **Strategic/roadmap language:** `10000` remains valid in external/GTM materials as the
  aspirational target (not a runtime limit).
- **Upgrade path:** once sustained load at 6765 passes the CSL-CRITICAL (0.927) gate with
  no degradation, promote to the next Fibonacci milestone (`fib(21) = 10946`).

## Reconciliation with current architecture (rebuild)

This is a **global** ceiling; rebuild's live model is **per-wave** budgets
(`ADR-0032` field-and-agent-waves: each wave carries its own `resource budget`/`ttl`) and
versioned budget config (`ADR-0010` rate-limits/token-budgets). This ADR is consistent
with both: it sets the **outer envelope** the sum of concurrent wave budgets must not
exceed; `ADR-0010`/`ADR-0032` govern allocation *within* it. If a fixed global concurrency
ceiling is not in fact a live runtime guard in rebuild, supersede this ADR rather than
delete it.

## Consequences

**Positive:** one enforced number eliminates split-brain config; Fibonacci alignment keeps
it φ-consistent; aspirational 10k preserved for GTM without runtime risk; deterministic
upgrade path (soak → CSL gate → next Fibonacci).

**Negative:** 10000 in roadmap vs 6765 in code needs explaining to reviewers;
`fib(21)=10946` overshoots the 10000 business target, requiring eventual reconciliation.

## References

- Legacy source: `docs/ADR/0005-capacity-ceiling.md` @ `e911513b`
- Allocation authorities: `docs/adr/0010-rate-limits-token-budgets.md`, `docs/adr/0032-field-and-agent-waves.md`
