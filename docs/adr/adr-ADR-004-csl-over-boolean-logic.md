   # ADR-004: CSL over Boolean Logic

   **Status:** Accepted
   **Date:** 2026-01-15
   **Author:** Eric Haywood
   **Heady Systems Inc. — Sacred Geometry v4.0**

   ## Problem

   How to make routing and gating decisions

   ## Decision

   Use Continuous Semantic Logic (CSL) with cosine similarity gates

   ## Consequences

- CSL AND = cosine similarity, CSL OR = vector superposition, CSL NOT = orthogonal projection
- Replaces hard if/else with confidence-weighted sigmoid gates
- Gate thresholds are phi-harmonic: MINIMUM=0.500, LOW=0.691, MEDIUM=0.809, HIGH=0.882, CRITICAL=0.927
- 5x faster than LLM classification (0.1s vs 0.59s), 43% cheaper
- 51 provisional patents protect the CSL innovation
- Trade-off: Requires embedding everything into 384-dim space, but this is also a feature

   ---
   *© 2026 HeadySystems Inc. — 51 Provisional Patents*
