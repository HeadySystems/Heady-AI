# ADR-004: Self-Healing Lifecycle Architecture

## Status
Accepted

## Date
2026-03-10

## Context
A platform with 50+ services, 9 websites, and multiple Colab runtimes will inevitably experience failures. Rather than relying solely on human operators, the system needs an autonomous healing cycle that can detect, diagnose, and remediate issues without human intervention for common failure modes.

## Decision
Implement a 7-stage self-healing lifecycle:

1. **Monitor** — Continuous embedding comparison via HeadyEmbed (cosine similarity)
2. **Detect** — HeadyPatterns classifies semantic drift when similarity drops below CSL_THRESHOLDS.MEDIUM (≈ 0.809)
3. **Alert** — HeadySoul notified of coherence violation
4. **Diagnose** — HeadyPatterns clusters + trend analysis; HeadyMC evaluates strategies
5. **Heal** — HeadyMC recommends and applies healing strategy (restart, rollback, scale, reroute, quarantine, patch)
6. **Verify** — HeadyCheck validates output; HeadyAssure certifies restoration
7. **Learn** — HeadyPatterns records incident; HeadyMC updates strategy history

### Component State Machine
Every healable component follows: `healthy → suspect → quarantined → recovering → restored`

### Healing Strategy Selection
HeadyMC runs Monte Carlo simulations (fib(12) = 144 runs) against the current system state, scoring strategies by:
- Success rate (weight: 0.528)
- Mean recovery time (weight: 0.326)
- Side effect risk (weight: 0.146)

## Consequences

### Positive
- Autonomous recovery for common failures (restart, scale, reroute)
- Monte Carlo evaluation prevents rash decisions
- Pattern learning prevents recurring incidents
- Full audit trail via HeadyAutobiographer

### Negative
- Complexity: 7-stage pipeline requires careful orchestration
- False positives in drift detection can trigger unnecessary healing
- Some healing strategies (hot patch) carry regression risk

## Related
- `src/intelligence/heady-patterns.js` — drift classification
- `src/intelligence/heady-mc.js` — Monte Carlo simulator
- `src/quality/heady-check.js` — quality gate
- `src/quality/heady-assure.js` — pre-deployment certification
