# ADR-0045: Digital-Twin Engine (`@heady/digital-twin`)

**Status:** Accepted
**Date:** 2026-08-04
**Accepted:** 2026-08-04 by Eric Haywood (HeadySystems Inc.) — founder acceptance per the ADR-0031 ceremony.
**Deciders:** Eric Haywood (HeadySystems Inc.)
**Strength of Acceptance:** ⭐⭐⭐ (Medium — Wave-1 legacy-recovery pilot #2)

> **Provenance:** rewritten from legacy `services/heady-digital-twin-service/server.js`
> (`e911513b`). Second Wave-1 item of `docs/LEGACY_GAP_ANALYSIS_AND_ROADMAP.md`; follows
> the ADR-0040 causal-inference recipe (package + tests + ADR + ARBITER gate).

## Context

`digital-twin` was a High-significance legacy capability absent from rebuild: deterministic
384D entity "twins" (embedding seeded by SHA-256 of the entity id), φ-scaled preference
weights, φ-weighted behavioral decay, cosine similarity, and what-if perturbation
simulation. The legacy version was a stateful Express service whose `simulate()` and
`compare()` also banded scores into CSL verdicts.

## Decision

Port the **public-domain core** as `packages/digital-twin` — a pure-function ESM library
(no IO, deterministic), mirroring `@heady/csl-engine`/`@heady/causal-inference`:

- `createTwin`, `updateBehavior` (φ-decay), `twinSimilarity` (cosine), `simulate`
  (perturbation → drift/coherence/risk).
- Vector primitives (`DIM=384`, `cosineSimilarity`, `normalize`) and constants
  (`PHI/PSI/FIB`) are **consumed** from `@heady/csl-engine` + `@heady/phi-math` — never copied.

## Patent posture (ARBITER-reviewed)

ARBITER verdict: **ALLOW with conditions.** Findings:

- **HS-2026-058 (CSL gate) is the sole contact** and is **delegated away**: `simulate` and
  `twinSimilarity` return **raw** `drift/coherence/similarity/risk`; the discrete banding
  (SAFE/REVIEW/BLOCK; DUPLICATE/SIMILAR/RELATED/DISTINCT) is **not embodied** — callers band
  via `@heady/csl-engine.cslGate`. The `CSL={MIN,LOW,MED,HIGH,CRIT,DEDUP}` threshold ladder
  is deliberately **not reproduced** here (it is HS-058 claim scaffolding).
- **HS-2026-052 (shadow memory) not touched** — twin state is in-memory; the SHA-256 seed is
  vector *generation*, not cross-node persistence/projection.
- **HS-2026-062 (vector-native security) not touched** — `risk = drift·φ` is single-entity
  what-if, not adversarial anomaly detection against a threat registry.
- **No `⚠️ PATENT LOCK` marker** (public-domain vector math + φ-scaling); **no CODEOWNERS
  patent-zone entry** (matches the causal-inference precedent; add one only if a delegating
  verdict helper is later introduced).

## Consequences

- (+) Second legacy capability recovered onto the canonical trunk; recipe holds.
- (+) Deterministic + pure → unit-testable (8… `node --test` suite; identical inputs → identical twins/sims).
- **(!) Storage guard (ADR-0015, ARBITER cond. 7):** a twin `embedding` is a *synthetic*
  SHA-256-seeded pseudo-vector, **not** a `bge-small-en-v1.5` retrieval embedding. It **must
  not** be written into the canonical pgvector retrieval index or commingled with real
  embeddings (silent retrieval poisoning). Twin vectors live in a separate, clearly-typed
  store. This constraint is also stated in the module header.

## References

- Legacy source: `services/heady-digital-twin-service/server.js` @ `e911513b`
- Precedent: `docs/adr/0040-causal-inference-engine.md`
- Consumed libs: `packages/csl-engine` (`DIM`, `cosineSimilarity`, `normalize`, `cslGate`), `packages/phi-math`
- Embedding lock: `docs/adr/0015-embedding-model-lock.md`
- Patent specs assessed: `docs/patents/HS-058-*.md`, `HS-052-*.md`, `HS-062-*.md`
