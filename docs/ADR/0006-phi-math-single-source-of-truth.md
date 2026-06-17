# ADR-0006: φ-Math as Single Source of Truth — No Magic Numbers
**Date:** 2025-06-01 | **Status:** Accepted | **Author:** Eric Haywood

## Context

The legacy codebase contained arbitrary constants scattered across 5+ files:
`shared/phi-math.js`, `phi-constants.js`, and inline literals throughout pipeline and
orchestration code. This created divergence: a timeout in one module used `3000ms` while
the equivalent in another used `4236ms` (the correct φ³×1000 value). Constants were
effectively magic numbers with no derivation documentation.

The rebuild introduced `core/constants/phi.js` as the canonical module, but no formal
decision had been recorded requiring its use.

## Decision

ALL numerical constants in the Heady codebase derive from φ = 1.6180339887498948 or the
Fibonacci sequence. Direct numeric literals for timeouts, pool sizes, thresholds, cache
TTLs, batch sizes, and scoring weights are prohibited. `core/constants/phi.js` is the
single source.

Unbreakable Law #1 from `SPEC.md` codifies this: _"ALL constants derive from φ — NO magic numbers."_

Key canonical values:
- `PHI = 1.618`, `PSI = 0.618`, `PSI² = 0.382`
- `FIB = [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597,2584,4181,6765]`
- `TIMING.FAST = φ³×1000 ≈ 4236ms`, `TIMING.NORMAL = φ⁵×1000 ≈ 11090ms`
- `CSL gates`: SUPPRESS=0.236, INCLUDE=0.382, BOOST=0.618, HIGH=0.882, CRITICAL=0.927

## Consequences

### Positive
- All constants are mathematically derivable — any reviewer can verify correctness
- Changing `PHI` propagates consistently through the entire system
- Eliminates the class of bugs where equivalent operations use different arbitrary timeouts
- Patent-relevant: φ-scaling is a novel system design claim (60+ provisional patents)
- New contributors can derive any constant from first principles

### Negative
- Fibonacci pool sizes may not map neatly to infrastructure limits (e.g., k8s replicas prefer powers of 2)
- φ-derived timeouts are unusual values that confuse infrastructure monitoring dashboards
- Strict enforcement requires linting rules or CI gates — not yet implemented

## Alternatives Considered

- **Configuration-file-driven constants**: rejected — configuration drift recreates the same problem
- **Industry-standard values (e.g., 3000ms, 5000ms)**: rejected — breaks φ-alignment and patent claims
