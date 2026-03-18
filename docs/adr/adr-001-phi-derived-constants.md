# ADR-001: Phi-Derived Constants — No Magic Numbers

## Status
Accepted

## Date
2026-03-10

## Context
Software systems are plagued by arbitrary "magic numbers" — hard-coded values like 0.5, 0.7, 100, 1000 that lack mathematical justification and create inconsistency across modules. The Heady platform needed a principled approach to numeric constants that would be:

1. **Mathematically coherent** — every value derives from a single source
2. **Self-similar across scales** — the same ratios appear at every level
3. **Predictable** — developers can reason about thresholds without looking up arbitrary values
4. **Beautiful** — reflecting the Sacred Geometry philosophy of HeadySystems

## Decision
All numeric constants in the Heady platform derive from the golden ratio (φ ≈ 1.618) and Fibonacci sequences. Specifically:

- **Thresholds**: `phiThreshold(level, spread)` = 1 − ψ^level × spread
- **Sizes**: Fibonacci numbers (5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 987...)
- **Weights**: `phiFusionWeights(n)` for N-factor scoring
- **Timing**: `phiBackoff(attempt)` for retry/backoff (base × φ^n)
- **Pressure levels**: ψ², ψ, 1−ψ³, 1−ψ⁴
- **Resource allocation**: `phiResourceWeights(n)` for pool sizing

The canonical implementation is `shared/phi-math.js`, which all modules import.

## Consequences

### Positive
- Every developer knows exactly where any constant comes from
- Thresholds form a natural, self-consistent hierarchy
- Cache sizes, queue depths, and batch sizes follow a predictable progression
- No debates about "should this be 100 or 128" — the Fibonacci sequence decides

### Negative
- New developers need to learn the phi-math vocabulary
- Some values (e.g., fib(20) = 6765 for LRU cache) may not be optimal for specific workloads
- Debugging requires understanding the mathematical relationships

### Risks
- Over-application: not every numeric value needs phi derivation (e.g., port numbers, HTTP status codes)
- Values near Fibonacci boundaries might cause subtle performance issues if the workload doesn't match

## Related
- `shared/phi-math.js` — canonical implementation
- ADR-002 — CSL Gate Architecture
- ADR-003 — 384D Embedding Space
