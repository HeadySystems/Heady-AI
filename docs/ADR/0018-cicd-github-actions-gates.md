# ADR-0018: CI/CD — GitHub Actions with Mandatory Coherence Gate, CodeQL, TruffleHog
**Date:** 2026-06-17 | **Status:** Accepted | **Author:** Eric Haywood

## Context

CUTOVER_CHECKLIST.md and MAIN_TO_REBUILD_MIGRATION_PLAN.md both reference required
CI status checks (`verify`, `scan`, `governance`) that must be green before any PR
merges to `rebuild`. PR #207 introduced the governance coherence gate and scoped
`dependabot.yml`. However no ADR formally defines what the CI pipeline is, what each
job does, or which failures are blocking vs informational.

The `rebuild` branch had zero branch protection at the time of the cutover plan —
meaning the CI design existed only in a checklist, not as a governed decision.

## Decision

The canonical CI pipeline for the `rebuild` (and future `main`) branch has three
**required blocking** checks:

| Job | Tool | Blocks merge? | Purpose |
|-----|------|--------------|---------|
| `verify` | Node.js test runner (native) | Yes | Unit + integration tests, CSL gate on coverage |
| `scan` | CodeQL (JavaScript) + TruffleHog | Yes | SAST vulnerability scan + secret detection |
| `governance` | coherence gate script (PR #207) | Yes | CSL coherence score ≥ 0.809 (MEDIUM) on PR diff |

Additional optional (non-blocking) jobs:
- `phi-lint`: checks for magic numbers not derived from `core/constants/phi.js`
- `sbom`: generates CycloneDX SBOM artifact on every merge to main
- `bundle-size`: tracks Cloudflare Worker bundle sizes against φ-scaled limits

Branch protection settings (applied before cutover flip):
- Required PR reviews: 1
- Require signed commits: yes
- Linear history: enforced
- Require conversation resolution before merge: yes
- Enforce for admins: yes

## Consequences

### Positive
- Closes the zero-protection gap on `rebuild` that existed at cutover planning time
- `governance` job enforces CSL coherence — prevents PRs that would degrade system coherence
- TruffleHog catches secrets committed to the repo (the heady-pqc-security layer covers runtime)
- Native Node.js test runner (no Jest/Vitest) keeps CI dependencies minimal and deterministic
- `main-protection-snapshot.json` (generated in Phase 0 of the cutover) provides rollback template

### Negative
- CodeQL scan adds ~3–5 minutes to CI runtime on the full monorepo
- Governance coherence gate requires the scoring script to be maintained as the codebase evolves
- TruffleHog can produce false positives on test fixtures containing example credentials

## Alternatives Considered

- **Jest for testing**: rejected — ESM compatibility issues; native Node.js test runner is sufficient
  and has zero additional dependencies (Law #2 alignment)
- **Snyk for SAST**: considered — CodeQL is free for GitHub repos and has better JS/TS deep analysis
- **No CI gate, rely on review**: rejected — the 777 Dependabot alert situation arose partly from
  absent automated enforcement
