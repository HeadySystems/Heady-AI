# ADR-002: Continuous Semantic Logic (CSL) Gate Architecture

## Status
Accepted

## Date
2026-03-10

## Context
Traditional software uses binary if/else decisions: a value either passes or fails a threshold. This creates harsh boundary effects where values just below a threshold behave entirely differently from values just above it. The Heady platform needed a smoother decision-making mechanism that:

1. Transitions gradually between states rather than snapping
2. Respects the phi-harmonic threshold hierarchy
3. Enables uncertainty-aware routing and scoring

## Decision
Adopt Continuous Semantic Logic (CSL) gates as the primary decision mechanism. CSL gates use sigmoid-smoothed thresholds:

```
cslGate(value, cosScore, tau, temperature) = value × σ((cosScore − τ) / temperature)
```

Where:
- `cosScore` is a cosine similarity or normalized quality score
- `τ` (tau) is the threshold (from `CSL_THRESHOLDS`)
- `temperature` controls transition sharpness (typically ψ ≈ 0.618)
- `σ` is the sigmoid function

CSL blend for weight interpolation:
```
cslBlend(high, low, score, tau) = high × gate + low × (1 − gate)
```

Adaptive temperature for entropy-responsive softmax:
```
adaptiveTemperature(entropy, maxEntropy) scales softmax temperature by information content
```

## Consequences

### Positive
- No harsh boundary effects — decisions are proportional to confidence
- Natural degradation: as quality drops, the system reduces capability rather than failing
- Composable: gates can be chained, blended, and nested
- 60+ provisional patents protect the mathematical framework

### Negative
- More computationally expensive than simple comparisons
- Harder to debug — "why did this value produce this output" requires understanding sigmoid math
- Testing requires understanding probability distributions, not just pass/fail

## Related
- ADR-001 — Phi-Derived Constants
- `shared/phi-math.js` — cslGate, cslBlend, adaptiveTemperature implementations
