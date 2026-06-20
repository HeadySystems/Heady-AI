<!-- HEADY_BRAND:BEGIN -->
<!-- FILE: HEADY.md · LAYER: root · canonical agent-instructions for the Heady system -->
<!-- HEADY_BRAND:END -->

# HEADY.md — Heady-Native Agent Instructions

> **Purpose.** This is the canonical instruction file for the **Heady system itself**
> — the Conductor, Supervisor, and every orchestrated agent (`heady-orchestrator`,
> `heady-builder`, `heady-auditor`, `heady-researcher`, `heady-observer`,
> `heady-deployer`, `heady-liquid-brain`, and any worker spawned by them).
> Where `CLAUDE.md` instructs Claude Code specifically, **HEADY.md instructs all
> Heady agents.** The two files MUST carry the same governance (see §0 Sync Rule).

---

## 0. Sync Rule (permanent)

`HEADY.md` and `CLAUDE.md` are **bound documents**. Any change to a shared
convention — development flow, artifact criteria, stop rule, ORS thresholds,
checkpoint protocol, source-of-truth designation — MUST be applied to **both files
in the same change**, and verified at every checkpoint.

- A divergence between `HEADY.md` and `CLAUDE.md` on a shared convention is a
  **defect** under the Standing Rule and is repaired before other work proceeds.
- The Checkpoint Protocol (`docs/CHECKPOINT_PROTOCOL.md`) includes this parity check.
- New conventions added to one file are propagated to the other automatically as
  part of the same commit — never one without the other.

---

## 1. Source of Truth

**`HeadySystems/heady-ai` is the canonical source of truth for the Heady platform.**
All other repos reconcile to `heady-ai/main`. Full repo roles, tiers, branching,
PR/merge, and promotion rules are defined in the authoritative contract:

> **`docs/DEVELOPMENT_FLOW.md`** — read this before touching any repo.

Quick reference:
- Branch off `heady-ai/main`; never commit directly to `main`.
- Branch prefixes: `feature/ fix/ chore/ docs/ release/ hotfix/ spike/ claude/`.
- Flow: branch → ready-for-review PR → CI + 1 review → merge → promote to
  `Heady-Staging` → promote to `Heady-Main` (production).
- Reconcile cross-repo changes **up to source of truth first**, then promote down.

---

## 2. Artifact Creation Criteria

> **Standing bias: materialize durable work. Default to building the artifact, not pasting it inline.**

The common failure mode is *under-production* — leaving a real deliverable stranded
in chat when it should be written, committed, and registered. When in doubt, build it.

**Build & persist** (do not leave inline) when output is durable, reusable, or
iterated on — roughly **>15 lines / one screen**, will be edited/run/shared/
referenced again, or is a self-contained deliverable (component, config, doc, spec,
schema, diagram, notebook). Keep inline only explanations and short (<15-line)
throwaway snippets.

Applies to all three senses: **repo files** (primary), **chat-surface artifacts**
(promote out of the message body; use the `artifact-design` skill for UI), and
**build artifacts** (HCFullPipeline outputs — registered and observable, no orphans).

> **Decision rule:** substantial + self-contained + meant to be kept/reused → build
> and persist. Explanation or throwaway snippet → keep inline.

---

## 2a. Human Understanding & Flow Protocol

Target: **comfortable understanding _for the user_**, without breaking flow.

1. **Silence is ambiguous** — it may be working, flow, or a propagating thought-wave,
   not a gap. Do not interrupt with comfort-checks.
2. **Flow / thought-waves:** when the user has momentum, **add energy** — build on and
   extend the thought; don't gate or dam it.
3. **Explicit triggers are the only interrupts:** *probe* ("okay so / so… / wait / hold
   on / does that / so you're telling me / I'm confused") → deep grounded explanation;
   *alarm* ("what the fuck is going on / wtf / makes no sense") → **full stop**, ground-up
   diagnosis of where their model diverged from reality.
4. **Diagnose the root** (why the gap exists), to a comfortable level — depth = comfort,
   not exhaustiveness.
5. **Grounding / anti-hallucination (always, lightweight):** separate verified vs
   inferred vs guessed; flag possible error; never present a guess as fact.
6. **Name unknowables / immaterial details** so the user can let them go.
7. **Recommendations are droppable — not deleted.** In deep thought/flow the user will
   ignore them (normal, expected). Offer once, lightly, then drop it in the moment; don't
   nag. **Keep it and watch for a _cue_ to repeat it later** — resurface when relevant
   again (topic recurs, user exits flow, related blocker hit, or they ask). Cue-triggered
   resurfacing ≠ nagging (time-based, repeated, pressuring).

> Enforced by `.claude/hooks/understanding-workflow.sh`; bound to `CLAUDE.md` via §0.

## 3. Operating Discipline

- **Stop Rule:** Build aggressively when healthy; repair first when not. Do NOT keep
  building when significant errors exist in core infra, data integrity, or security.
- **ORS thresholds:** >85 full parallelism · 70–85 normal · 50–70 maintenance ·
  <50 recovery (repair only, escalate to owner).
- **Determinism:** same inputs + configs + versions → same plan graph and routing.
- **Checkpoint Protocol:** at every checkpoint, validate state, compare config
  hashes, re-evaluate health, sync registry/docs/notebooks, and verify HEADY.md ⇄
  CLAUDE.md parity (§0).
- **Security:** no hardcoded secrets, timing-safe key validation, least privilege,
  no `localhost` in code or config.

---

## 4. Agent Obligations (every Heady agent)

1. Identify repo + tier (`git remote -v`) before changing anything.
2. Branch per `docs/DEVELOPMENT_FLOW.md`; respect any task-assigned branch; never
   push elsewhere without explicit approval.
3. Honor the Stop Rule and ORS.
4. Materialize durable deliverables (§2); open a ready-for-review PR to the correct base.
5. Run Checkpoint Protocol follow-through and keep HEADY.md ⇄ CLAUDE.md in sync (§0).
