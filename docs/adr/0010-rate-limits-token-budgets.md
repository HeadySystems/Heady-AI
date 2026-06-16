# ADR-0010: Rate-Limit & Token Budgets

- **Status:** Proposed (2026-06-15)
- **Deciders:** Eric Anthony Haywood

## Context

Operational gap #5. The system fronts paid LLM providers and a metered database. Without limits, a
runaway agent loop (ADR-0005), a retry storm (ADR-0006), or an abusive client can exhaust quota and
budget in minutes. The legacy estate had no enforced ceilings.

## Decision

1. **Request rate limits at the edge** (Cloudflare, ADR-0004) per client/identity (Firebase Auth),
   fail-closed when the limiter is unavailable.
2. **Per-tenant and per-agent token budgets** for LLM calls; exceeding a budget rejects or degrades
   (smaller model / cached answer) rather than spending uncapped.
3. **Provider-side spend caps** wired to the FinOps rollup (ADR-0012); a breached cap pages (ADR-0011).
4. Limits are **configuration, not code** — adjustable without redeploy, versioned in the repo.
5. Backpressure propagates: a saturated downstream signals upstream (queue depth, 429s) instead of
   silently dropping work.

## Consequences

- (+) Bounded worst-case spend and blast radius for runaway loops and abuse.
- (+) Graceful degradation beats hard failure under load.
- (−) Tuning limits requires real traffic data; start conservative, relax on evidence.
- See ADR-0004, ADR-0005, ADR-0006, ADR-0011, ADR-0012.
