# ADR-0043: CSL Replaces Boolean Gates

- **Status:** Accepted (2026-03-10, legacy corpus) · Transferred to canonical corpus 2026-08-09
- **Deciders:** Eric Anthony Haywood

## Context

Traditional boolean logic (if/else, true/false) forces binary decisions in a domain where confidence
is continuous. An AI agent's recommendation might be 73% confident — boolean logic loses this nuance.
Traditional boolean logic also cannot express degrees of semantic alignment: AI systems need
continuous-valued reasoning that preserves geometric relationships in embedding space. CSL unifies
routing, authorization, and health scoring under one mathematical framework.

## Decision

**Continuous Semantic Logic (CSL) is the core reasoning framework and primary decision framework.**

1. CSL gates operate on confidence scores in [0, 1], with **cosine similarity as the primary metric**;
   vector operations serve as logical gates.
2. **Operations:** AND = cosine intersection/similarity · OR = superposition · NOT = orthogonal
   projection · IMPLY = projection · XOR · CONSENSUS · GATE = sigmoid-gated thresholding.
3. **Gate thresholds are φ-derived:** MINIMUM ≈ 0.500, LOW ≈ 0.691, MEDIUM ≈ 0.809, HIGH ≈ 0.882,
   CRITICAL ≈ 0.927 (the 1 − ψ^level × 0.5 ladder of ADR-0042).
4. **Scope:** all routing decisions, authorization checks, feature gates, and health scoring use CSL
   operations, creating a unified mathematical framework across the entire platform.

## Consequences

- (+) Nuanced decisions; mathematically grounded; gradual degradation instead of hard failures.
- (+) One framework spans routing, authorization, feature gating, and health scoring.
- (+) Patent-protected: covered within HeadySystems' **51 provisional patents**.
- (−) Harder to debug than simple true/false; requires understanding vector operations; more
  computation per decision.
- Mitigations: structured logging of CSL gate decisions with scores; visualization in the HeadyLens
  dashboard; developer onboarding covers CSL fundamentals.

## Reconciliation (2026-08-09 transfer)

- **Ratification gap closed.** CSL is already load-bearing in the canonical corpus — ADR-0005 and
  ADR-0016 (three-layer CSL merge gate), ADR-0015 (full-CSL embedder), ADR-0030 (per-lens CSL
  confidence and CSL ABSTAIN), and ADR-0032 (geometric wave composition via CSL) all consume it — but
  the foundational decision itself was never transferred. This ADR is the missing root those
  references hang from.
- **The rebuild's actual CSL package is `@heady/csl-engine`** at
  `/home/headyme/Heady-AI/packages/csl-engine` (entry `src/index.mjs`): `cslAND`, `cslOR`, `cslNOT`,
  `cslIMPLY`, `cslXOR`, `cslCONSENSUS`, `cslBlend`, `cslGate` over the dim-locked 384-d space
  (`DIM = 384`, per ADR-0015), re-exporting `phiBackoff`/`GATE` from `@heady/phi-math`. A prior
  coherence-kernel audit found documentation drift referencing a nonexistent `@heady/csl` — the
  package is, and has only ever been in the rebuild, `@heady/csl-engine`.
- The runtime execute threshold is `GATE.EXECUTE = ψ ≈ 0.618` (with `GATE.HALT = ψ² ≈ 0.382`), which
  is the operational form of the `cos(Ī, C̄) ≥ 0.618` execution rule stated in `CLAUDE.md`.
- **Locked-fact correction:** legacy `ADR-005-csl-over-boolean.md` claims "patent-protected (60+ provisionals)" — drift.
  HeadySystems holds **51 provisional patents**; the sibling source
  `ADR-003-continuous-semantic-logic-engine.md` states 51 correctly, and 51 is the number carried
  into this canonical record.
- The two legacy sources were merged: `ADR-005` supplies the boolean-replacement rationale, threshold
  ladder, operations list, and consequence/mitigation analysis; `ADR-003` supplies the
  embedding-space rationale, the gate-as-vector-operation definitions, and the platform-wide scope.
  No substantive constraint was dropped.

## Provenance

- Sources: `/home/headyme/_archive/Heady/docs/adr/ADR-005-csl-over-boolean.md` (Accepted 2026-03-10)
  and `/home/headyme/_archive/Heady/docs/adr/ADR-003-continuous-semantic-logic-engine.md`
  (Accepted 2026-03-10).
- Live carrier: `/home/headyme/Heady-AI/packages/csl-engine/src/index.mjs` (`@heady/csl-engine`).
- Canonical consumers: ADR-0005, ADR-0015, ADR-0016, ADR-0030, ADR-0032.
- Transferred into the canonical corpus 2026-08-09; the originals remain in place in the archive.
