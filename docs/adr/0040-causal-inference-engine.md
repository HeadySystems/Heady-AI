# ADR-0040: Causal-Inference Engine (`@heady/causal-inference`)

**Status:** Accepted
**Date:** 2026-08-04
**Deciders:** Eric Haywood (HeadySystems Inc.)
**Strength of Acceptance:** ⭐⭐⭐ (Medium — pilot port; first Wave-1 item of the legacy→rebuild roadmap)

---

## Context

`docs/LEGACY_GAP_ANALYSIS_AND_ROADMAP.md` identified `causal-inference` as the
highest-significance capability present in the legacy lineage
(`legacy/sacred-geometry-orphan-2026-06`) but absent from `rebuild`. It is the
recommended **pilot** that proves the legacy→rebuild porting recipe end-to-end
(package + tests + ADR + ARBITER gate).

The legacy service (`services/heady-causal-inference-service/server.js`) was a
stateful Express server bundling five endpoints. Two facts shape this decision:

1. **The causal core is public-domain.** `createModel` (structural causal model),
   `intervene` (Pearl do-operator = parent-severing + topological propagation),
   `counterfactual` (Pearl's abduction→action→prediction), and `monteCarloSimulate`
   are textbook Judea Pearl causal inference — **not Heady IP.**
2. **One endpoint touches a patent.** ARBITER review flagged the legacy
   `/pipeline/assess` endpoint as re-embodying **HS-2026-058** (the CSL φ-banded
   stage-transition gate, declared in `docs/hcp/HCP-0002-kernel-csl-stage-gate.md`).

## Decision

1. **Port the four public-domain capabilities** as `packages/causal-inference` — a
   **pure-function ESM library** (no IO, deterministic), mirroring `@heady/csl-engine`'s
   proven structure. Constants derive from `@heady/phi-math` (no magic numbers).
2. **Do not mark the causal core as patent-locked.** Over-claiming public-domain math
   weakens the estate (ARBITER). Standard `HEADY_BRAND` header only.
3. **Defer `/pipeline/assess`** from this pilot. It is the only HS-058 contact and must
   not be re-embodied standalone while HCP-0002 is draft. When implemented, it MUST
   **delegate to `@heady/csl-engine`'s exported `cslGate`/`GATE`** (never re-derive the
   gate), carry an HS-058 / HCP-0002 reference at the call site, and add the package to
   the patent-zone block in `.github/CODEOWNERS`.
4. **Determinism:** Monte-Carlo uses a seeded `mulberry32` PRNG with a φ-derived default
   seed, satisfying the repo determinism rule (same inputs + seed → same output).

## Consequences

- **Positive:** first legacy capability recovered onto the canonical trunk; the porting
  recipe is now demonstrated; the ARBITER gate is shown catching and deferring a real
  patent-contact surface rather than forking it.
- **Neutral:** the HTTP surface (the legacy Express routes) is intentionally out of scope —
  rebuild exposes engines via its own adapter layer, not per-package servers.
- **Follow-up:** a subsequent ADR/PR adds `assessStageTransition` delegating to
  `@heady/csl-engine` once HCP-0002 pins its HS-2026-0NN id and CODEOWNERS is updated.

## References

- Pilot spec: `docs/LEGACY_GAP_ANALYSIS_AND_ROADMAP.md`
- Cleared gate authority: `packages/csl-engine/src/index.mjs` (`cslGate`)
- Patent surface: `docs/hcp/HCP-0002-kernel-csl-stage-gate.md`; `docs/patents/README.md`
- Legacy source: `services/heady-causal-inference-service/server.js` @ `e911513b`
