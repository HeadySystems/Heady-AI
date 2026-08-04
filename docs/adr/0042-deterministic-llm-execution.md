# ADR-0042: Deterministic LLM Execution — Temperature-0 + SHA-256 Proof Receipts

**Status:** Proposed
**Date:** 2026-08-04
**Deciders:** Eric Haywood (HeadySystems Inc.) — acceptance via the ADR-0031 founder ceremony
**Strength of Acceptance:** ⭐⭐⭐ (Medium — load-bearing for ADR-0018's cache and the governance posture)

> **Provenance:** rewritten from legacy `docs/ADR/0014-determinism-temperature-zero-seed-42.md`
> (`e911513b`). **Adapted, not copied verbatim:** the legacy `seed: 42` mandate is
> demoted to *best-effort* because rebuild's frontier (`class=reason`) tier is Anthropic
> Claude, which exposes no seed parameter — a limitation legacy 0014 itself flagged.

## Context

Non-deterministic LLM output makes regression testing, audit trails, and patent
reduction-to-practice hard: when the same prompt yields different output on retry, model
drift is indistinguishable from a provider error. Rebuild already *depends* on
determinism without mandating it — `docs/adr/0018-model-gateway-liquid-routing.md`
specifies a **SHA-256 exact-match gateway cache**, which is only sound if identical
inputs deterministically produce identical outputs. No rebuild ADR, `AGENTS.md` rule, or
`SOURCE_OF_TRUTH.md` law currently states that requirement.

## Decision

All LLM calls on **orchestration and pipeline paths** use:

- **`temperature: 0`** — greedy decoding where supported (firm requirement).
- **SHA-256 proof-of-execution receipt** — hash every output and store it in the
  governance log as a verifiable reduction-to-practice / audit record (firm requirement).
- **`seed` — best-effort:** set where the provider honours it (e.g. OpenAI, Groq);
  Anthropic Claude (rebuild's `class=reason` tier) exposes no seed, so determinism there
  rests on `temperature: 0` + the output-hash receipt, not on a seed.

**Documented exceptions** (must be explicit in code): creative/generative routing
(HeadyVinci) and Battle-Arena candidate diversity deliberately use `temperature > 0`.

## Consequences

**Positive:** regression tests can assert exact output hashes (true deterministic
coverage); gateway-cache receipts are verifiable; patent reduction-to-practice can cite
reproducible runs; provider debugging is simpler; aligns with the Glass-Box governance
mandate and reinforces ADR-0018 (cache), ADR-0006-class idempotency, and deterministic
recovery.

**Negative:** `temperature: 0` can lower quality for generative tasks (mitigated by the
exceptions); seed portability is partial across providers (accepted — hashing is the
defence-in-depth); SHA-256 hashing adds marginal per-output overhead.

## Alternatives Considered

- Variable temperature with logging — rejected (non-reproducible, breaks audit integrity).
- Deterministic embeddings only — rejected (pipeline *outputs* must also be auditable).
- Provider-level determinism only — rejected (insufficient; app-level hashing is defence-in-depth).

## References

- Legacy source: `docs/ADR/0014-determinism-temperature-zero-seed-42.md` @ `e911513b`
- Depends-on / reinforces: `docs/adr/0018-model-gateway-liquid-routing.md` (SHA-256 exact-match cache)
