# ADR-005: Why Sacred Geometry & φ Constants

**Status:** Accepted
**Date:** 2025-10-01
**Authors:** Eric Haywood

## Context

Every software system needs numeric constants for timeouts, pool sizes, cache sizes, retry counts, rate limits, and threshold values. Most systems use "magic numbers" (arbitrary values like 100, 5000, 30), which are difficult to justify, inconsistent, and create maintenance debt.

## Decision

Derive **ALL** numeric constants from the **Golden Ratio (φ = 1.618...)** and the **Fibonacci sequence**. This is the "Sacred Geometry v4.0" approach, and it is a formal design constraint — not decoration.

### The Core Constants

```javascript
const PHI  = 1.618033988749895;        // Golden Ratio
const PSI  = 1 / PHI;                  // ≈ 0.618 (Inverse)
const PSI2 = PSI * PSI;                // ≈ 0.382
const FIB  = [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];
```

### How Constants Are Derived

| Use Case | Magic Number | φ-Derived | Rationale |
|----------|:---:|:---:|---|
| Connection pool | 20 | 34 (Fib) | Fits Fibonacci-scaled load |
| Max connections | 200 | 233 (Fib) | Natural growth boundary |
| Rate limit (anon) | 30/min | 34/min (Fib) | Consistent tier scaling |
| Rate limit (auth) | 100/min | 89/min (Fib) | φ-ratio between tiers |
| Rate limit (enterprise) | 500/min | 233/min (Fib) | Fibonacci tier progression |
| Timeout (connect) | 2s | 1.618s (φ) | Golden ratio timing |
| Timeout (request) | 5s | 4.236s (φ²+1) | Derived from φ² |
| Circuit breaker threshold | 50% | 61.8% (ψ) | Inverse golden ratio |
| Retry count | 3 | 4 (φ³≈4.236) | φ-exponential attempts |
| Retry backoff | 1s, 2s, 4s | 1s, 1.618s, 2.618s | φ-exponential backoff |
| CSL include gate | 0.5 | 0.382 (ψ²) | Low confidence threshold |
| CSL boost gate | 0.7 | 0.618 (ψ) | High confidence threshold |
| Feature flag stages | 10%, 50%, 100% | 6.18%, 38.2%, 61.8%, 100% | φ-scaled rollout |
| Heartbeat interval | 15s | 21s (Fib) | Fibonacci timing |
| Idle timeout | 300s | 233s (Fib) | Natural timeout boundary |

## Consequences

### Positive

- **Eliminates magic numbers** — every constant is derivable and justifiable
- **Self-documenting** — `FIB[8]` is clearer than `34` in context
- **Mathematically harmonious** — tiers scale proportionally
- **Patent-defensible** — φ-scaling is a novel invention (Provisional #7: Fibonacci Resource Allocation)
- **Consistent across services** — shared `phi-math.js` module

### Negative

- Unfamiliar to new developers (mitigated by ADR + onboarding docs)
- Some values are close to conventional (34 vs 30) — marginal practical difference
- Requires discipline to maintain (mitigated by lint rules checking for magic numbers)

### Key Principle
>
> If you need a number, derive it from φ. If φ doesn't make sense for that domain, use Fibonacci. If neither applies, document why a specific value was chosen.
