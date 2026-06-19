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
