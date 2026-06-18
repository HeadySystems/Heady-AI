# ADR-0030: The Heady Understanding Engine (HUE)

- **Status:** Proposed (2026-06-18)
- **Deciders:** Eric Anthony Haywood
- **Design doc:** `docs/research/HEADY_UNDERSTANDING_ENGINE.md`

## Context

Heady retrieves (pgvector), routes (CSL), and acts (HCFP), but it has no explicit, repeatable protocol
for *understanding* a subject — a signal, a component, a concept, an external system. Understanding has
been implicit, which is the root class behind real defects this cycle (the patent count 60-vs-51 and the
HCFullPipeline 8-vs-21 drifts were **understanding failures, not data failures** — confident-wrong, never
abstaining). The organs for understanding already exist but are not run as one method: the Socratic
Execution Loop, HCFP stages 14–16 (SELF_AWARENESS / SELF_CRITIQUE / MISTAKE_ANALYSIS), `heady-hypothesis-
lab`, `heady-forensic-analyst`, the coherence System Map + ripple, CSL ternary truth, HeadyPerspective,
and `heady-distiller`.

## Decision

Adopt the **Heady Understanding Engine (HUE)** — a governed, reflexive comprehension protocol with a fixed
**9-lens schema** (the Heady Comprehension Schema): **Mechanism · Existence&Causality · Teleology ·
Relations · Effect(internal/external) · Blast-radius&Significance · Normativity · Agency · Evidence&
Confidence**. HUE runs the lenses over a subject and emits a structured, evidence-graded, **living
Understanding Artifact (UA)** with per-lens CSL confidence (TRUE/UNKNOWN/FALSE) and **explicit unknowns**.

Binding rule (the core directive): **Heady may act on what it understands at ≥ τ confidence and MUST
abstain (CSL ABSTAIN) on what it does not — and must always be able to say which, and why.**

HUE is **reflexive** ("a system that defines a system"): it runs on itself, measures whether each lens
produced *predictive* understanding (tracer-bee / coherence observe outcomes = surprise/error), and
EVOLUTION (HCFP-19) + DISTILL (HCFP-20) refine the lens-set. The 9-lens schema and the UA contract are
versioned and governed by this ADR.

## Consequences

- **Build:** the HUE orchestrator + UA contract (`@heady/contracts`) + a lens library (each lens a thin
  module over an existing organ) + the efficacy-scoring loop. Wire into HCFP 14–16; surface "Understand X"
  in HeadyBuddy/admin. Phased plan in the design doc §8.
- **Reuse, not reinvent:** coherence (relations/blast-radius), CSL (confidence), tracer-bee (mechanism),
  hypothesis-lab/forensic (causality), perspective (multi-angle), distiller (compression).
- **Risk:** analysis-paralysis, false confidence without the efficacy loop, compute cost — mitigated by
  Cynefin-scoped depth, the efficacy loop, and τ-thresholds.
- **Blast radius:** large-read / narrow-write — HUE reads broadly but writes only UAs + abstention
  signals; it changes how decisions are *justified*, not who authorizes them (humans/ARBITER still gate).

## Alternatives considered

- **Ad-hoc understanding (status quo)** — rejected: implicit, drift-prone, non-auditable; the source of
  the confident-wrong failures this cycle.
- **A static checklist** — rejected: cannot improve; HUE's efficacy loop makes the method self-correcting.
