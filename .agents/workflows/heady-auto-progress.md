---
description: Inventory and explain all discovered modifications, then let the user select exact bundles for governed commit, push, database migration, filesystem sync, and production deployment
---

<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ Auto Progress v1.0.0                                   ║
║  Whole-state inventory · user-selected promotion · live proof   ║
║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# `@heady-auto-progress` / `/heady-auto-progress`

Turn the current body of modifications into an evidence-backed selection menu.
The first invocation is always read-only: inventory and summarize first, then
stop so the user can choose what may be committed, pushed, synchronized,
migrated, or deployed.

This command does not treat a dirty tree as one change set, assume all work
belongs to the current agent, or infer that local readiness proves remote or
production state.

## Invocation

```text
/heady-auto-progress [--scope current|discovered] [--include-live-readonly]
```

`current` covers the current repository. `discovered` adds exact Git worktrees,
user-supplied repository roots, and repositories declared by canonical registry
data. It does not crawl the whole filesystem. Live database, cloud, and remote
filesystem reads require their normal access and report unavailable state
honestly.

## Phase A — catch up and inventory without mutation

1. Run `/heady-handoff-check`; read current repository instructions and accepted
   ADRs.
2. For every exact repository root, collect branch, HEAD, upstream divergence,
   staged and unstaged diffs, untracked paths, stashes, worktrees, remotes, tags,
   unpublished commits, submodules, and in-progress operations.
3. Read diffs sufficiently to explain intent and risk. Do not summarize by
   filename alone, expose secret values, stage files, update generated output,
   fetch, stash, reset, clean, or modify anything during inventory.
4. Discover database lanes from canonical configuration and migration history.
   Report target identifiers, migration IDs/checksums, schema drift, and access
   status without printing connection strings or row contents. Neon remains the
   durable system of record.
5. Discover deployment and filesystem-sync lanes only from canonical registries,
   manifests, configured remotes/connectors, and user-provided targets. Resolve
   each to an exact project, region, service, branch, bucket, mount, or path.
6. Distinguish checkout evidence from live evidence. An unauthenticated `401`, a
   health endpoint, generated `dist`, or a dry run alone is not end-to-end proof.

## Phase B — build selectable modification bundles

Group changes by coherent intent, ownership/provenance, dependency, and
destination. Never mix unrelated work merely because files share a repository.
Use stable IDs such as `B01`, `B02`, and include:

| Field | Required content |
|---|---|
| Bundle | Stable ID and short intent |
| Sources | Exact repositories, commits, files, migrations, or artifacts |
| Summary | What behavior or state changes, not only line counts |
| Provenance | Known author/session or `unknown`; never guess ownership |
| Dependencies | Other bundle IDs and ordering constraints |
| Risk | Reversibility, destructive effects, sensitive/protected paths |
| Validation | Passed, failed, skipped, stale, or not yet runnable |
| Destinations | Exact commit, remote branch, DB, service, or filesystem target |
| Readiness | `LOCAL_ONLY`, `REVIEW_NEEDED`, `READY_TO_COMMIT`, `BLOCKED`, or `LIVE_VERIFIED` |
| Rollback | Concrete rollback artifact and limits |

Identify generated files, caches, build products, secret-bearing material,
overlapping hunks, and changes already represented by another bundle. Default
those to excluded or blocked until intentionally selected.

## Phase C — present the selection receipt and stop

Return:

1. repository and external-target inventory;
2. bundle table with dependencies and validation evidence;
3. proposed commit boundaries and conventional commit messages;
4. exact push destinations and divergence state;
5. exact database, deployment, and filesystem promotion targets;
6. blockers, required reviewers, and missing live credentials;
7. a canonical `inventory_sha256` over the complete selection receipt.

Then stop and request a selection using this grammar:

```text
SELECT HEADY AUTO PROGRESS <inventory_sha256>
COMMIT: B01,B03
PUSH: B01->repo-id:remote/branch
DATABASE: B03->project/branch
DEPLOY: B01->project/region/service
FILESYNC: B03->connector:/exact/path
EXCLUDE: B02
```

Omitted lanes remain unapproved. `all`, `everything`, or a destination without
bundle IDs is not a valid selection. The user may select only a review or local
commit and leave push/deploy lanes empty.

## Phase D — revalidate the chosen scope

On the follow-up selection:

1. Recompute the inventory and reject a stale digest or changed dependency.
2. Expand every bundle into exact files/hunks, commit SHAs, migration checksums,
   artifact digests, remote refs, and target resource IDs.
3. Run relevant tests, added-line secret scanning, governance, policy, and
   deployment-readiness gates. Failed or skipped required gates block promotion.
4. If an action deletes, overwrites, truncates, drops, rewrites history, replaces
   remote state, or is otherwise destructive, route only those entries through
   `/heady-destructive-approve-all` and wait for its exact manifest approval.
5. Surface native human gates. Never fabricate founder, ARBITER, external-review,
   deployment-protection, IAM, or platform permission evidence.

## Phase E — promote only selected bundles

### Commit

- Stage only selected files or hunks; never use `git add -A` or absorb unrelated
  dirty work.
- Show and verify the staged diff before committing.
- Preserve unselected work, stashes, worktrees, and in-progress operations.

### Push

- Push the exact selected commit SHA to the exact selected remote and branch
  after checking current divergence.
- Never force-push unless a separately approved destructive manifest names the
  exact ref and before/after SHAs and branch protection permits it.

### Database

- Apply only selected, checksummed migrations to the exact Neon project/branch
  after a dry-run or temporary-branch verification and required review.
- Use transactional, reversible procedures where possible. Destructive DDL or
  data loss requires the destructive-manifest ceremony.

### Deployment

- Build from the selected commit and bind the resulting immutable artifact
  digest to the exact project, region, service, route, and configuration.
- Obtain deployment-protection approval and normal cloud permission prompts.
- Verify the deployed revision plus its authenticated protocol/API flow; report
  DNS, edge, origin, auth, and application failures separately.

### Filesystem synchronization

- Copy or remove only explicitly selected paths through a verified connector.
- Compare before/after hashes, preserve recoverable backups, and reject broad
  roots, unresolved variables, globs, or undeclared remote mounts.

## Completion receipt

Report three buckets: completed and verified; user decisions applied; remaining
human or external gates. Include exact commit SHAs, remote refs, migration
checksums, artifact digests, deployed revisions/routes, filesystem hashes, and
rollback locations. Never label a skipped lane as complete or production-live.
