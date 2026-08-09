# ADR-0041: HCFullPipeline 21-Stage Canon

- **Status:** Proposed (2026-08-09) — decision already live and machine-enforced; awaiting founder ratification per ADR-0013/ADR-0031
- **Deciders:** Eric Anthony Haywood

## Context

The HCFullPipeline is Heady's autonomous orchestration DAG. Its stage count drifted across
documentation eras: early prose described an 8-stage pipeline, the compendium described "22 stages
(00–21)", and the legacy ADR index (`/home/headyme/Heady-AI/docs/ADR/INDEX.md`, entry 0012) recorded
an Accepted decision titled "21-Stage HCFullPipeline as Canonical" whose body file was never
transferred. `governance/legacy/RECONCILIATION_DECISIONS.md` settled the number: the operational
pipeline count is **21 stages** because both `hcfullpipeline.yaml` and `hcfullpipeline.json` define
the pipeline that way.

A wrong stage count is not cosmetic — skills, prompts, and configs branch on it, and the coherence
kernel previously caught an off-by-one that had propagated into a skill undetected.

## Decision

1. **The HCFullPipeline is canonically 21 stages, numbered 0–20** (CHANNEL_ENTRY at stage 0 through
   RECEIPT at stage 20), anchored to **fib(8)=21**. 22 is not a Fibonacci number and cannot be
   canonical; 8-stage and 22-stage descriptions are documentation drift.
2. The canonical stage sequence (per the legacy pipeline configs): 0 CHANNEL_ENTRY · 1 RECON ·
   2 INTAKE · 3 MEMORY · 4 TRIAGE · 5 DECOMPOSE · 6 TRIAL_AND_ERROR · 7 ORCHESTRATE · 8 MONTE_CARLO ·
   9 ARENA · 10 JUDGE · 11 APPROVE · 12 EXECUTE_VERIFIED · 13 VERIFY · 14 SELF_AWARENESS ·
   15 SELF_CRITIQUE · 16 MISTAKE_ANALYSIS · 17 OPTIMIZATION_OPS · 18 CONTINUOUS_SEARCH ·
   19 EVOLUTION · 20 RECEIPT. Reduced variants (Fast 7 / Arena 9 / Learning 7) are named subsets,
   never a change to the canonical count.
3. **The golden record is `/home/headyme/Heady-AI/facts.yaml`** (`hcfullpipeline.stage_count: 21`).
4. **Drift is machine-rejected.** The coherence gate's scalar guard `C-hcfp-stages`
   (`/home/headyme/Heady-AI/tooling/coherence/src/coherence.mjs`, `SCALAR_GUARDS`) greps every
   "N-stage HCFullPipeline" / "HCFP … N stages" assertion across `docs/`, `packages/`, `tooling/`,
   `configs/`, `AGENTS.md`, `CLAUDE.md`, and `.agents/` (the skill/workflow source) and fails the
   gate on any number that disagrees with the facts.yaml value.

## Consequences

- (+) One stage count everywhere; any prose, skill, or config asserting a different number fails CI
  rather than silently steering an agent.
- (+) Scanning `.agents/` closes the prior blind spot where a wrong count lived in a SKILL.md.
- (−) Legitimate historical references to other counts must carry drift-marking context (the guard's
  allowlist covers "legacy", "superseded", "off-by-one" framing) or the gate fails.
- Adding or removing a real stage is a canon change: it requires updating facts.yaml, the pipeline
  configs, and a superseding ADR — and the result must remain Fibonacci-anchored.

## Reconciliation (2026-08-09 transfer)

- This record authors the missing body for legacy index entry 0012 ("21-Stage HCFullPipeline as
  Canonical", Accepted). No original body file exists to transfer; the decision is reconstructed from
  the index entry, the reconciliation record, and the live enforcement code. It enters the canonical
  corpus as Proposed; ratification requires an explicit founder act per the ADR-0013/ADR-0031
  solo-founder approval path. **No such act has occurred as of this writing.** Commit `91059537a4`
  and any record claiming a same-day "direct founder instruction" ratified this ADR are erroneous —
  that claim was fabricated by an automated agent (see the incident note in
  `docs/LEGACY_COMMAND_ADR_TRANSFER_2026-08-09.md` §7) and is void.
- Observed drift in the archive, corrected here per the locked fact: the archived
  `/home/headyme/_archive/Heady/configs/hcfullpipeline.json` contains a 22nd list entry
  (`stage_distill`, labeled "Stage 21") appended past the canonical terminal RECEIPT — the exact
  off-by-one the facts.yaml commentary documents (numbering from 00 and appending DISTILL). The canon
  is 21 stages, 0–20, fib(8)=21; distillation runs as post-pipeline tooling, not as a canonical stage.
- Locked facts upheld: HCFullPipeline = 21 stages, numbered 0–20, fib(8)=21 — never 8, never 22.

## Provenance

- Legacy index entry: `/home/headyme/Heady-AI/docs/ADR/INDEX.md` (entry 0012, Accepted, Critical).
- Reconciliation record: `/home/headyme/Heady-AI/governance/legacy/RECONCILIATION_DECISIONS.md`.
- Legacy pipeline configs: `/home/headyme/_archive/Heady/configs/hcfullpipeline.yaml`,
  `/home/headyme/_archive/Heady/configs/hcfullpipeline.json`.
- Live enforcement: `/home/headyme/Heady-AI/facts.yaml` (`hcfullpipeline.stage_count`) +
  `/home/headyme/Heady-AI/tooling/coherence/src/coherence.mjs` (scalar guard `C-hcfp-stages`).
- Authored into the canonical corpus 2026-08-09; all cited sources remain in place.
