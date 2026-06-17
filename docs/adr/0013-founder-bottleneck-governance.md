# ADR-0013: Founder-Bottleneck Governance

- **Status:** Accepted (2026-06-17, founder approval per ADR-0013)
- **Deciders:** Eric Anthony Haywood

## Context

Operational gap #8, and the meta-constraint behind every other ADR. There is one engineer. The
antigravity plan's failure mode is concurrency of *architectural bets* — building four packages and
four apps at once, each a new platform to learn, operate, and debug. Both deep-research passes
identify founder attention, not compute, as the scarce resource.

## Decision

1. **Sequence the bets; parallelize only execution within a bet.** **≤1 net-new platform per phase.**
2. **Every phase retires at least one complexity source**; net platform count trends flat or down.
3. **Reserve 20% of capacity for debt paydown** each phase — non-negotiable, not the first thing cut.
4. **Human approval is a deliberate gate, not a bug** (ADR-0005): the bottleneck bounds blast radius
   while the estate is consolidating.
5. **Evidence gate for expansion** (ADR-0003/0004 Phase-4 items): no new platform without a benchmark,
   a feature flag, and a rollback path. ADRs require **founder approval** before Accepted.

## Consequences

- (+) Cognitive load stays within one person's capacity; each phase is finishable and verifiable.
- (+) Complexity is actively retired, not just added — the estate gets simpler as it consolidates.
- (−) Slower nominal feature velocity than full concurrency; this is the intended trade (correctness
   and survivability over speed).
- Governs the phasing of all other ADRs. See ADR-0001 (one repo), ADR-0005 (approval gate).
