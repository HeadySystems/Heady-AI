# ADR-0028: HeadyPatterns Dual-Gate Consequence Engine

- **Status:** Accepted (2026-06-18)
- **Deciders:** Eric Anthony Haywood

## Context

The system previously relied on passive recommendations based on semantic similarity. While this successfully surfaced positive workflows, it failed to mechanically prevent the recurrence of negative patterns (e.g., hardcoded localhosts, infinite loops, failing CI checks). We needed to evolve the pattern recognition from a "suggestion engine" into an active, self-healing "immune system" capable of structural enforcement.

## Decision

1. **The HeadyPatterns Rebrand**: The generic recommendation engine is formally rebranded as `HeadyPatterns`, taking its place in the Heady Governance Shell.
2. **Dual-Gate CSL Logic**: The ranking engine now implements a dual-pass Continuous Semantic Logic (`cslGate`) check using the `φ⁻¹` (0.618) threshold.
3. **Negative Consequence Enforcement**: Before processing positive recommendations, the engine evaluates the current context against the `negative` pattern vector space.
4. **Active Circuit Breaking**: If a negative pattern similarity exceeds 0.618, the system intercepts the execution and publishes a `system.consequence.enforce` payload (e.g., `phi-backoff`) to the NATS event bus.

## Consequences

- (+) The OS acts as a self-healing immune system, mathematically blocking agents from repeating known anti-patterns.
- (+) Circuit breakers are fully decentralized—any agent listening to the NATS `system.consequence.enforce` channel can immediately halt offending operations.
- (+) Low-latency edge caching (Upstash) ensures the UI instantly reflects `BLOCKED` states without polling.
- (−) Agents attempting novel, non-standard approaches may occasionally trigger false-positive blocks if their vector proximity to a negative pattern is unusually high.
