---
description: Produce an evidence-backed workflow activity snapshot and checkpoint pack without mutating runtime or handoff state
---

<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ Workflow Activity Evidence v2.0.0                       ║
║  Safe repository, workflow, and verification state reporting.   ║
║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# Heady Workflow Activity Tree

Create a dated activity document under `docs/activity/` and a matching evidence
pack under `docs/checkpoint/<timestamp>/`. Base every claim on current local
evidence and distinguish repository state from live service state.

## Evidence sequence

1. Inspect Git branch, HEAD, status, stashes, worktrees, in-progress operations,
   and the current handoff checkpoint without changing them.
2. Inventory `.agents/workflows/*.md`, `.claude/commands/*.md`, and
   `.agents/skills/*/SKILL.md`; verify source/projection synchronization.
3. Run the skill/workflow validator and proportionate local gates.
4. Use `node tooling/handoff/src/handoff.mjs --dry-run --json` when a delta
   preview is useful. Do not run the handoff writer unless the user explicitly
   requested checkpoint advancement.
5. Record every workflow's purpose, benefit, risk, prerequisites, and current
   confidence. Mark referenced but unavailable engines and routes as unavailable.

## Safety boundary

Do not execute `src/hc_activity_tree.js`: its historical dry-run path can invoke
the handoff writer and advance checkpoint state, and its static subsystem counts
are not live telemetry. Do not deploy, delete, rotate secrets, prune worktrees,
or accept governance artifacts while producing an activity report.

## Completion contract

Link the activity document to its checkpoint pack and handoff evidence. Include
verification commands, exit results, dirty-state limitations, and prioritized
next actions. Never convert a skipped or unevaluable check into a pass.
