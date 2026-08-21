<!-- HEADY_BRAND:BEGIN
Heady™ Neon Source Ledger Runbook
© 2026 HeadySystems Inc. — Eric Haywood, Founder
HEADY_BRAND:END -->

# Neon Source Ledger Runbook

## Current authority state

ADR-0051 is **Proposed**, so this implementation is not production authority yet. Git remains the
canonical engineering repository under ADR-0001 until the founder signs the ADR, migration `0012`
is validated and applied, the initial snapshot is verified, and release automation binds artifacts
to a Neon revision ID.

## Activation sequence

1. Create an isolated Neon branch from the production parent.
2. Run the standard migration planner, review migration `0012`, and apply it only to that branch.
3. Run the database migration tests and verify `pgcrypto`, `vector`, role grants, append-only triggers,
   compare-and-swap behavior, and point-in-time recovery coverage.
4. Run `pnpm --filter @heady/source-ledger-cli plan`. Review added, changed, and removed counts and
   the Merkle root; this command never writes source authority.
5. After signed activation approval, bootstrap with
   `pnpm --filter @heady/source-ledger-cli plan -- --apply --actor=<human-id> --message=<message>`.
6. Read the committed revision back and reconstruct it into a new empty directory with
   `pnpm --filter @heady/source-ledger-cli plan -- --materialize=<empty-path> --revision=<revision-id>`.
7. Compare every reconstructed file hash, file mode, symlink target, file count, and Merkle root to
   the bootstrap input. Record the evidence in the activation artifact.
8. Promote the migration and bootstrap through the governed deployment path. Only then update
   ADR-0051 to Accepted and change repository/release gates to reject Git-only revisions.

## Normal operation

The reconciler reads the named ref and entry hashes from Neon, hashes tracked and non-ignored local
files as raw bytes, and produces a plan. An approved apply transaction inserts missing blobs, creates
an immutable revision and parent edges, adds every revision entry, and advances the named ref through
an optimistic compare-and-swap function. Source embeddings refer to exact revision paths and use the
locked 384-dimensional embedding model. Redis, Vectorize, Git remotes, and worktrees are projections.

## Failure rules

- A compare-and-swap conflict means the plan is stale; discard it and reconcile again.
- A Git-only change is projection drift, never an authoritative commit after activation.
- Never materialize over a populated directory; the recovery command intentionally refuses it.
- If Neon is unavailable, preserve local work and defer authority advancement. Do not promote a
  fallback store.
- Restore drills must prove both database PITR and exact source materialization before success is
  declared.
