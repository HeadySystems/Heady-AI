# ADR-0045: 22-Stage HCFullPipeline — DISTILL as First-Class Terminal Stage

**Status:** Accepted
**Date:** 2026-08-04
**Deciders:** Eric Haywood (HeadySystems Inc.)
**Supersedes:** **ADR-0041** ("21-Stage HCFullPipeline as the Canonical Execution Model",
Accepted 2026-08-04 — itself a rewrite of the retired file-less `docs/ADR/0012`), and with it
the 21-stage canon previously carried operationally by `facts.yaml
hcfullpipeline.stage_count` and `HEADY_SUPER_PROMPT_v5 §6`.
**Note on same-day supersession:** ADR-0041 landed via the legacy→rebuild ADR reconciliation
(PR #271) hours before this ruling. The founder issued the 22-stage ruling *after* being shown
ADR-0041's core argument (`21 = fib(8)`, "20 stages rejected — breaks Fibonacci alignment"),
and overrode it deliberately: pipeline shape follows function, not Fibonacci membership.
ADR-0041's variant table (FAST/STANDARD/ARENA/LEARNING as subsets of one canonical
definition) and its single-canonical-module requirement survive unchanged — only the FULL
count moves 21 → 22.
**Strength of Acceptance:** ⭐⭐⭐⭐⭐ (Critical — pins the pipeline's canonical shape; the
coherence gate checks every "N-stage HCFullPipeline" prose claim against this number)

---

## Context

Two stage counts for HCFullPipeline have coexisted:

- **21** (order 0–20, CHANNEL_ENTRY → RECEIPT) — the prior canon, anchored to fib(8)=21 and
  ruled in the 2026-06 reconciliation, which classified the 22-count as an off-by-one that
  "appended DISTILL past the canonical terminal RECEIPT."
- **22** (order 0–21, CHANNEL_ENTRY → … → RECEIPT → DISTILL) — the shape actually shipped by
  the downstream production pipeline (`headyai/heady-production`
  `configs/hcfullpipeline.yaml` v8.0.0, terminal stage `distiller`).

The disagreement reduces to one question: is distillation — reverse-engineering a completed
run's trace into reusable SKILL.md recipes — a pipeline stage, or a post-terminal side
process? The prior canon said post-terminal. In practice the distiller is wired as an ordered
stage (order 21) in the production DAG, participates in the LEARNING profile, and its output
(recipes) is part of what a run *produces*, not an offline afterthought.

## Decision

1. **HCFullPipeline is canonically 22 stages**, order 0–21:
   `channel-entry → recon → intake → classify → triage → decompose → trial-and-error →
   orchestrate → monte-carlo → arena → judge → approve → execute → verify → self-awareness →
   self-critique → mistake-analysis → optimization-ops → continuous-search → evolution →
   receipt → distiller`.
2. **DISTILL (order 21) is the terminal stage.** RECEIPT (order 20) remains the terminal
   *accounting* stage — the run is committed and receipted at 20; stage 21 distills the
   completed trace into recipes. A run that receipts but fails distillation is a completed
   run with a logged distillation defect, not a failed run.
3. `facts.yaml hcfullpipeline.stage_count = 22` is the golden-record projection of this
   decision; the coherence scalar guard (`C-hcfp-stages`) enforces all prose against it.
4. Execution profiles (Fast/EXPRESS, FULL, ARENA, LEARNING) select stage subsets as before;
   only LEARNING and FULL include DISTILL by default.
5. The fib(8)=21 numerological anchor from the prior ruling is **consciously dropped** for
   the stage count: pipeline shape follows function, not Fibonacci membership. φ-scaling
   continues to govern timeouts, backoff, TTLs, and capacity ceilings (LAW-10 unchanged).

## Consequences

- Downstream repos already shipping the 22-stage DAG (`headyai/heady-production` v8.0.0) are
  conformant as-is; the reconciliation direction from the 2026-08-04 SoT audit §4 is
  **inverted** — the monorepo's prose moves up to 22 rather than production moving down.
- All living monorepo prose asserting "21-stage HCFullPipeline" is updated by this change;
  frozen legacy provenance (`governance/legacy/`), dated handoffs, and dated reports keep
  their historical wording (the coherence guard's allow-list already exempts
  superseded/was/legacy phrasing).
- The prior reconciliation entry ("Operational pipeline count is 21 stages…",
  `governance/legacy/RECONCILIATION_DECISIONS.md`) is superseded by this ADR and stays
  frozen in place as provenance.

φ = 1.618033988749895 — Fibonacci-scaled per LAW-10
© 2026 HeadySystems Inc. — Eric Haywood, Founder
