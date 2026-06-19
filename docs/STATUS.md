<!-- HEADY_BRAND:BEGIN -->
<!-- FILE: docs/STATUS.md · LAYER: governance · single living status surface -->
<!-- HEADY_BRAND:END -->

# Heady Platform — Living Status

> **Single source for current status.** This replaces the scattered one-off status,
> deployment, and "completion/perfection report" dumps that previously accumulated at
> the repo root (consolidated by the audit, see `docs/SYSTEM_AUDIT_AND_REMEDIATION_PLAN.md`).
> Generated finalization/deployment reports are no longer committed — they are local
> build outputs (now git-ignored). Keep this file current; do not re-add transient dumps.

## Sources of truth
- **Platform:** `HeadySystems/heady-ai` (v5.0.0) — see `docs/DEVELOPMENT_FLOW.md`
- **Live state:** auto-scanned in `HEADY_CONTEXT.md`; agent bootstrap in `docs/AGENT_CONTEXT_PACK.md`
- **Repo roles:** `docs/REPO_INVENTORY.md`

## Live deployment surface (2026-06-19 audit)
- **Cloudflare Workers:** 37 (see audit plan for duplicate/stale consolidation)
- **Vercel:** 1 project (`heady`, team `heady-ai`)
- **Sentry monitored projects:** 19

## How status is tracked now
- **Deploys:** observed via Cloudflare/Vercel/Cloud Run + Sentry, not committed text files.
- **Pipeline/health:** `api/pipeline/state`, `api/health-checks/snapshot` (see `CLAUDE.md`).
- **Checkpoints:** `docs/CHECKPOINT_PROTOCOL.md`.

## Retired status artifacts
The following transient dumps were removed in the audit cleanup (regenerated locally
where applicable, no longer tracked): `AUTO_DEPLOY_STATUS.md`,
`CLONE_REPOSITORIES_SUMMARY.md`, `DEEP_SCAN_REPORT.md`, `FINALIZATION-REPORT.md`,
`HCFP_INTEGRATION_SUMMARY.md`, `PERFECTION_ACHIEVEMENT_REPORT.md`,
`SANDBOX-DEPLOYMENT-STATUS.md`, `STATUS-DASHBOARD.md`, `SYNC_STATUS_REPORT.md`,
`deployment-complete.txt`, `deployment-status.md`, `deployment-status.txt`,
`failed_test_summary.txt`, `project-summary.md`.
