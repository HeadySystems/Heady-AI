# ADR-0014: Deterministic LLM Execution — Temperature=0, Seed=42, SHA-256 Output Hashing
**Date:** 2026-06-17 | **Status:** Accepted | **Author:** Eric Haywood

## Context

Non-deterministic LLM outputs make regression testing, audit trails, and patent
reduction-to-practice documentation difficult. When the same prompt produces different
outputs on retry, it is impossible to distinguish provider errors from model drift.
The rebuild's SPEC.md Laws #3 and #4 formalise deterministic execution as a requirement.

## Decision

All LLM calls in orchestration and pipeline paths use:
- `temperature: 0` — maximum determinism (greedy decoding where supported)
- `seed: 42` — reproducibility seed where provider supports it (OpenAI, Groq)
- SHA-256 hash of every output is computed and stored as a proof-of-execution receipt
  in the OracleChain governance log

Exceptions (must be documented in code):
- Creative/generative tasks routed to HeadyVinci explicitly set `temperature: 0.7–1.0`
- Battle Arena competitions use variable temperature to encourage diverse candidates

Governance Law #5: _"CSL gates replace ALL boolean if/else"_ — determinism applies
to routing decisions, not just LLM temperature.

## Consequences

### Positive
- Regression tests can assert exact SHA-256 output hashes — true deterministic test coverage
- OracleChain receipts are verifiable: given the same input + seed, the same hash must result
- Patent reduction-to-practice documentation can reference specific reproducible runs
- Provider debugging is simplified: same input + temperature=0 should yield same output across calls
- Aligns with Heady's Glass Box governance mandate (Governance v5)

### Negative
- Temperature=0 may produce lower-quality creative outputs for generative tasks (mitigated by exceptions)
- Not all providers honour `seed` — Anthropic Claude does not currently expose a seed parameter
- SHA-256 hashing adds marginal compute overhead per pipeline output

## Alternatives Considered

- **Variable temperature with logging**: rejected — non-reproducible, breaks audit trail integrity
- **Deterministic embeddings only (not completions)**: rejected — pipeline outputs must also be auditable
- **Provider-level determinism only**: rejected — insufficient; application-level hashing provides defence-in-depth
