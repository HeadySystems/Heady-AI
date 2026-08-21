---
name: heady-handoff
description: "Create, preview, inspect, and consume incremental Heady agent-handoff bundles backed by tooling/handoff and .data/handoff/checkpoint.json. Use when Codex needs to transfer work to another agent, close out a session, summarize changes since the last handoff, record verification evidence, inspect the latest HANDOFF document, or resume from an existing handoff. Preserve dirty work and distinguish read-only preview or ingestion from bundle creation, which writes docs/handoff and advances the checkpoint."
---

<!-- HEADY_BRAND:BEGIN
<!-- ╭───────────────────────────────────────────────────────────────╮
<!-- │  HEADY™ Heady Handoff v1.1.0                                │
<!-- │  Verified continuity between coding-agent sessions              │
<!-- │  © 2026 HeadySystems Inc. — Eric Haywood, Founder           │
<!-- ╰──────────────────────────────────────────────────────────────╯
<!-- HEADY_BRAND:END -->

# Heady Handoff

Use the repository's tested `@heady/handoff` engine to transfer evidence and open work between agents. Do not duplicate the engine or infer that a successful process exit means the repository is ready to ship.

## Select the operation

| User intent | Operation | Side effects |
|---|---|---|
| Create, finalize, close out, or hand off | Generate a full handoff | Writes `docs/handoff/HANDOFF-<timestamp>.md` and advances `.data/handoff/checkpoint.json` |
| Preview or show what would be handed off | Preview | Read-only with `--dry-run` |
| Resume, catch up, inspect, or consume | Ingest the latest bundle | Read-only; never generate a bundle or advance the checkpoint |
| Use a named baseline | Explicit range | Add `--since <git-ref>` after validating the ref |

Treat a direct request to create or finalize a handoff as authorization for the two documented file writes. Do not commit, push, stash, reset, clean, or modify other work unless the user separately asks.

## Establish evidence

1. Resolve the repository root with `git rev-parse --show-toplevel` and operate there.
2. Read the applicable `AGENTS.md` and any more-specific instructions.
3. Confirm that `tooling/handoff/src/handoff.mjs` exists. If it is absent, report that the canonical engine is unavailable; do not simulate checkpoint advancement.
4. Inspect the branch, HEAD, short status, current checkpoint, stashes, linked worktrees, and any merge, rebase, revert, or cherry-pick state. Preserve all unrelated and uncommitted work.
5. If Heady workspace, environment-audit, AutoContext, or governance tools are required by repository policy, invoke them when available. Report unavailable mandatory tooling separately from local evidence.
6. Never print secret values or broad environment dumps while collecting context.

The bundle generator records committed deltas and uncommitted paths, but not the full contents of dirty files, stashes, other worktrees, unpublished remote state, or every in-progress Git operation. Surface those limitations in the handoff result when they matter.

## Generate or preview

Use the canonical commands:

```bash
# Full verified handoff: writes the bundle and advances the checkpoint.
node tooling/handoff/src/handoff.mjs

# Read-only preview. Keep verification unless the user asks for a quick structural preview.
node tooling/handoff/src/handoff.mjs --dry-run

# Explicit baseline after validating that the ref exists and represents user intent.
node tooling/handoff/src/handoff.mjs --since <git-ref>

# Machine-readable result; combine with --dry-run for read-only use.
node tooling/handoff/src/handoff.mjs --json
```

Use `--no-verify` only when the user explicitly requests it or a required gate cannot run. Label the resulting handoff unverified.

Gate failures and gate-runner execution errors are distinct. The CLI retries transient process
exhaustion with φ-backoff and labels a persistent execution problem `ERROR`; never report it as a
repository gate failure. Verification uses the coherence kernel's read-only mode so preview and
generation do not rewrite generated registries.

Before using `--since`, resolve the ref and check its relationship to HEAD. Do not silently choose a different range. When no checkpoint exists, the engine uses a recent-history first-run baseline rather than the repository's complete history; state that limitation.

After generation:

1. Capture the generated bundle path and checkpoint before/after SHA.
2. Read the generated bundle, including every failed or skipped verification result and the open-work section.
3. Compare its claims with current `AGENTS.md`, accepted ADRs, and repository facts. Treat generated primers as explanatory text, not authority; flag stale legacy architecture language instead of repeating it as current truth.
4. Check that the output did not overwrite an existing bundle and that only the expected handoff artifacts changed because of this operation.
5. Do not call the handoff clean, verified, complete, or production-ready when gates are red or skipped, the checkout has relevant dirty state, or live/deployed evidence was not exercised.

## Ingest an existing handoff

1. Locate the newest `docs/handoff/HANDOFF-*.md` without modifying repository state.
2. Read its TL;DR, verification results, ordered context list, open threads, and checkpoint.
3. Compare the recorded checkpoint SHA with current HEAD.
   - If equal, classify the bundle as current.
   - If the checkpoint is an ancestor of HEAD, classify it as behind and inspect the commit gap.
   - If unrelated, missing, or invalid, classify it as divergent or unknown and investigate before acting.
4. Read all relevant files named in the bundle and inspect unclear commits in the gap.
5. Treat red gates as known debt, not as proof that every present failure predates the handoff.
6. Never run the writer merely because no bundle exists unless the user requested a baseline and accepts its documented writes.

## Report the outcome

Return a concise handoff receipt containing:

- operation performed and whether it was read-only;
- clickable path to the generated or consumed bundle;
- branch, HEAD, baseline, and checkpoint movement;
- verification pass, fail, and skipped status;
- dirty-tree, stash, worktree, and in-progress-operation caveats;
- the next agent's highest-priority open thread;
- any mandatory Heady tooling that was unavailable.

Keep observed facts separate from interpretation. A handoff transfers state; it does not grant approval, waive governance, prove a deployment, or authorize destructive Git operations.
