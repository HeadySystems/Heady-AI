# ADR-0012: FinOps Caps & Daily Spend Reporting

- **Status:** Proposed (2026-06-15)
- **Deciders:** Eric Anthony Haywood

## Context

Operational gap #7. Spend is spread across LLM providers, Neon, Cloudflare, and Cloud Run. For a
bootstrapped solo founder, an un-surfaced cost spike (e.g. a retry storm, a hot embedding job, an
egress-heavy edge miss) is an existential risk before it is ever noticed in a monthly invoice.

## Decision

1. **Daily FinOps rollup**: a scheduled job aggregates spend per provider/service/tenant and posts a
   digest; a day-over-day spike beyond a threshold pages (ADR-0011).
2. **Hard caps** per provider tied to token budgets (ADR-0010); breaching a cap degrades or stops
   non-essential work, never silently overspends.
3. Cost is **attributed** — per tenant and per agent — so the rollup pinpoints the source of a spike.
4. Architectural cost rules are honored: edge reads over origin hops (ADR-0004), one vector store
   (ADR-0003), retention limits (ADR-0008).
5. Spend data is retained for trend analysis and budget setting.

## Consequences

- (+) Cost surprises surface in ≤24h, not at month-end; spikes are attributable to a cause.
- (+) Caps convert "uncapped overspend" into "degraded service" — a recoverable failure mode.
- (−) Requires per-call cost instrumentation; built into the LLM router and DB layer.
- See ADR-0003, ADR-0004, ADR-0008, ADR-0010, ADR-0011.
