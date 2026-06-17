# ADR-0007: Continuous Semantic Logic (CSL) Replaces Boolean Gates
**Date:** 2025-06-01 | **Status:** Accepted | **Author:** Eric Haywood

## Context

Traditional boolean if/else guards throughout the legacy codebase created brittle
decision paths: a request either passed or failed a threshold with no graduated
response. This made it impossible to implement nuanced routing (e.g., "include this
result cautiously", "prioritise but don't mandate") without nested conditionals.

CSL was developed as Heady's core geometric AI innovation — treating vector cosine
similarity as a logical gate weight rather than using arbitrary boolean thresholds.
The decision to use CSL gates as the system-wide replacement for boolean guards was
made implicitly across many modules but never formally recorded.

## Decision

All conditional routing, filtering, quality scoring, and escalation logic uses CSL
confidence-weighted signals from `core/constants/phi.js`. Boolean `if/else` on
thresholds is prohibited in orchestration, pipeline, and agent routing code.

CSL gate ladder:
| Gate | Value | Semantic |
|------|-------|---------|
| SUPPRESS | 0.236 | Filter out — below noise floor |
| INCLUDE | 0.382 | Include cautiously |
| BOOST | 0.618 | Strong signal — prioritise |
| INJECT | 0.718 | High confidence — inject into pipeline |
| HIGH | 0.882 | Very high confidence |
| CRITICAL | 0.927 | Critical path — must succeed |
| DEDUP | 0.972 | Semantic duplicate threshold |

Unbreakable Law #5: _"CSL gates replace ALL boolean if/else."_

## Consequences

### Positive
- Graduated responses replace hard cliffs — system degrades gracefully under uncertainty
- Gates are mathematically grounded in φ-derived cosine geometry
- 60+ provisional patents depend on CSL as a novel claimed invention
- Enables semantic backpressure, quality-aware routing, and nuanced failover
- All gate comparisons are deterministic — no probabilistic drift at runtime

### Negative
- Learning curve: engineers accustomed to boolean guards must adopt a new mental model
- CSL requires that inputs have meaningful cosine-comparable embeddings — binary data needs translation
- Debugging CSL failures requires understanding which gate fired, not just true/false

## Alternatives Considered

- **Probabilistic thresholds (Bayesian)**: considered — rejected in favour of determinism
- **ML-learned thresholds**: considered — rejected due to training overhead and non-determinism
- **Status codes / enums**: rejected — loses the continuous gradient that enables graduated response
