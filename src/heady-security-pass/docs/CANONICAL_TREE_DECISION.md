# Canonical tree decision

## Current conclusion
Treat the repository root at `/home/user/workspace/heady_repo` as the current canonical working tree for this continuation pass.

## Why
- The active git metadata lives at the repo root.
- The root contains the live `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `bin/`, `packages/`, `workers/`, `services/`, and `scripts/` surfaces that the current automation targets.
- The root includes the maintained shared package and current validation tests used in this pass.
- Mirrored directories such as `Heady-pre-production-9f2f0642-main`, `_archive`, `heady-monorepo`, and `heady-enterprise` appear to be snapshots, archival bundles, or derivative trees rather than the primary build entry point.

## Evidence of drift
- The root `package.json` is a modern pnpm/turbo workspace, while `Heady-pre-production-9f2f0642-main/package.json` reflects an older standalone runtime shape.
- Root workflow scripts referenced missing files until repaired in this pass, indicating the active build surface is the root rather than the mirrored subtree.
- Duplicate docker-compose, pnpm workspace, and documentation assets exist across mirrored directories, increasing the risk of inconsistent broad edits.

## Operating rule for next passes
- Apply direct fixes in the root tree first.
- Treat mirrored directories as evidence, migration material, or future archival targets until a formal reduction plan is executed.
- Do not perform mass find-and-replace across mirrored directories until the archival strategy is approved and tested.
