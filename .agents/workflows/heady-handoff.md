---
description: Agent handoff — summarize + verify all work since the last run and emit one bundle that brings the next agent fully up to speed
---

> **OPTIMAL BUILD NOTICE:** This file targets the Heady-AI Latent OS (v2.0.0).
> - **Package Manager:** `pnpm` + `Turborepo`  · **Rule File:** Follow `AGENTS.md`
> - **Engine:** `tooling/handoff` (`@heady/handoff`)  · **State:** `.data/handoff/checkpoint.json`
> - **Output:** `docs/handoff/HANDOFF-<timestamp>.md`

// turbo-all

# Heady Handoff

Produce a complete, verified handoff so a **fresh agent is totally up to speed since the last time
this ran**. Incremental by design: it remembers where it left off (a checkpoint at the last HEAD) and
reports only what changed since — then advances the checkpoint.

## What it does

1. **Delta** — every commit and file (added / modified / deleted / renamed) since the stored
   checkpoint (`.data/handoff/checkpoint.json`); first run baselines from the recent history.
2. **Verify** — runs the structural gates and records pass/fail per gate:
   `law-lint` · `governance-gate` · the `tooling/enforcers` suite (no-loopback · glass-box ·
   secret-scan) · `coherence`. The handoff never fails on a red gate — it **reports** it.
3. **Bundle** — writes one agent-readable doc (`docs/handoff/HANDOFF-<ts>.md`) with: TL;DR,
   commits, files-by-status, the verification table, the ordered list of context to read
   (`AGENTS.md`, `CLAUDE_MEMORY.md`, the live `.data/awareness/context.json` snapshot, key docs),
   open threads (failing gates + uncommitted files), and the checkpoint move.
4. **Advance** — writes the new checkpoint so the next run is incremental.

## Run

```bash
# full handoff (writes the bundle + advances the checkpoint)
node tooling/handoff/src/handoff.mjs

# preview without writing or moving the checkpoint
node tooling/handoff/src/handoff.mjs --dry-run

# explicit range / machine-readable / skip verification
node tooling/handoff/src/handoff.mjs --since <git-ref>
node tooling/handoff/src/handoff.mjs --json
node tooling/handoff/src/handoff.mjs --no-verify
```

## Hand it off

Point the next agent at the generated `docs/handoff/HANDOFF-<ts>.md`. Section 5 lists, in order,
exactly which files and docs to read; sections 1–4 are the verified what-changed; section 6 is the
open work. That single file is the catch-up.

## When to use

- Before passing work to another agent or picking it up on another device.
- After a burst of autonomous work (e.g. `/heady-autopilot`), to snapshot + verify the result.
- On a cadence (nightly/weekly) as the running record of verified progress.
