# ADR-0011: SLO-Based On-Call Policy

- **Status:** Accepted (2026-06-17, founder approval per ADR-0013)
- **Deciders:** Eric Anthony Haywood

## Context

Operational gap #6. A solo founder cannot absorb noisy alerting. Threshold-on-everything paging
trains the one operator to ignore alerts — the worst possible outcome. Alerting must be scarce and
meaningful, tied to user-visible reliability.

## Decision

1. Define **SLOs** (availability, latency, error rate) per user-facing surface, with error budgets.
2. **Alert only on SLO burn rate** — fast-burn pages, slow-burn tickets. No raw-threshold CPU/memory
   pages; those are dashboards, not interrupts.
3. **Sentry is for SLO-burn alerts only** (not a firehose); OTel GenAI semconv traces + Langfuse for
   LLM observability feed the SLOs.
4. Every page carries a **runbook link** and an owning surface; an alert without a runbook is a bug.
5. Missed restore-drill targets (ADR-0009) and breached budgets (ADR-0010, ADR-0012) are SLO events.

## Consequences

- (+) The one operator is interrupted only when users are actually affected — sustainable on-call.
- (+) Error budgets make "ship vs. stabilize" an explicit, data-driven decision.
- (−) Requires defining and maintaining SLOs up front; thin to start, expanded as surfaces ship.
- See ADR-0009, ADR-0010, ADR-0012, ADR-0013.
