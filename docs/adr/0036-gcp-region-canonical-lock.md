# ADR-0036: GCP Project + Region Canonical Lock — us-east1

- **Status:** Accepted (2026-06-17, legacy corpus docs/ADR) · Transferred to canonical corpus 2026-08-09
- **Deciders:** Eric Haywood (HeadySystems Inc.)
- **Strength of Acceptance:** Critical — prevents infrastructure drift into legacy GCP project and wrong region; directly addresses WINDSURF_INSTRUCTIONS.md divergence

## Context

A critical divergence exists between legacy documentation and the active rebuild:

| Property | Legacy (DO NOT USE) | Canonical Rebuild |
|---|---|---|
| GCP Project | `heady-prod-609590223909` | `heady-rebuild` (or successor) |
| Region | `us-central1` | `us-east1` |
| Database | Cloud SQL (Postgres 14) | Neon Postgres (serverless, `us-east1`) |
| Pipeline | 9-stage | 21-stage (legacy ADR-0012) |

The legacy project `heady-prod-609590223909` in `us-central1` was used during the initial production phase. It contains Cloud SQL instances, Cloud Run services, and Cloud Storage buckets that are **not compatible** with the rebuild architecture (legacy ADR-0016, ADR-0012).

Incidents have occurred where:

1. CI/CD pipelines resolved the wrong GCP project from environment variables and deployed to `us-central1`.
2. A developer referenced `heady-prod-609590223909` in a Terraform plan, which would have provisioned Cloud SQL alongside Neon.
3. WINDSURF_INSTRUCTIONS.md — the legacy IDE configuration file — still contained `us-central1` and `heady-prod-609590223909` references, causing AI coding assistants to generate infrastructure targeting the wrong environment.

This ADR formally locks the canonical GCP project and region, provides machine-readable constants, and mandates CI enforcement.

## Decision

### Canonical GCP Constants

```js
// src/config/gcp.js  (ESM, phi-scaled)
export const GCP = {
  PROJECT_ID:  process.env.GCP_PROJECT_ID ?? 'heady-rebuild',
  REGION:      'us-east1',         // LOCKED — never us-central1
  ZONE:        'us-east1-b',       // Primary zone
  RUN_SERVICE: 'heady-origin',     // Cloud Run service name

  // LEGACY — READ ONLY — DO NOT USE FOR ANY NEW INFRA
  LEGACY: {
    PROJECT_ID: 'heady-prod-609590223909',
    REGION:     'us-central1',
    NOTE:       'Legacy project — read access only for data migration. Zero new deploys.',
  },
};
```

### Hard Prohibitions

The following are **absolutely prohibited** in any file under `src/`, `infra/`, `.github/`, or `scripts/`:

| Prohibited String | Why |
|---|---|
| `us-central1` (as a deployment target) | Legacy region — higher latency to Cloudflare edge PoPs, higher egress cost |
| `heady-prod-609590223909` (as a deploy target) | Legacy project — contains Cloud SQL, incompatible with Neon-first architecture |
| `sql.googleapis.com` (Cloud SQL API) | Replaced by Neon (legacy ADR-0016) |
| `CLOUDSQL_INSTANCE` env var | Replaced by `DATABASE_URL` pointing to Neon |

Exception: the `LEGACY` block in `src/config/gcp.js` and data-migration scripts under `scripts/migrate/` may reference the legacy project for read-only access during migration windows only.

### Why us-east1

1. **Cloudflare edge latency:** Cloudflare's `EWR` (Newark) and `IAD` (Ashburn) PoPs route to `us-east1` Cloud Run with <5ms origin latency vs ~15ms from `us-central1`.
2. **Neon co-location:** Neon Postgres primary is provisioned in `us-east1` — same-region Cloud Run eliminates cross-region DB egress ($0.08/GB saved).
3. **Firebase Auth regional affinity:** Firebase project configured for `us-east1` data residency.
4. **Regulatory alignment:** US-east data centers satisfy US-only data residency requirements for HeadyConnection grant compliance.

### CI Enforcement

The ADR Sentinel workflow (`.github/workflows/adr-sentinel.yml`) MUST include a `region-lock-scan` job that:

```yaml
- name: Scan for legacy region/project references
  run: |
    FOUND=$(grep -rn "us-central1\|heady-prod-609590223909\|CLOUDSQL_INSTANCE" \
      src/ infra/ .github/ scripts/ \
      --include="*.js" --include="*.yml" --include="*.yaml" --include="*.tf" \
      --exclude-dir="scripts/migrate" \
      | grep -v "LEGACY\|# DO NOT USE\|ADR-0022" || true)
    if [ -n "$FOUND" ]; then
      echo "Legacy region/project references found:"
      echo "$FOUND"
      exit 1
    fi
    echo "No legacy region/project references"
```

### Environment Variables

All deployments MUST set:

```
GCP_PROJECT_ID=heady-rebuild
GCP_REGION=us-east1
# Never set CLOUDSQL_INSTANCE — use DATABASE_URL for Neon
DATABASE_URL=postgresql://...@ep-xxx.us-east1.aws.neon.tech/heady?sslmode=require
```

These are validated at startup by `src/config/env-validator.js` which rejects any startup where `GCP_REGION !== 'us-east1'` or `CLOUDSQL_INSTANCE` is set.

## Consequences

### Positive

- Eliminates the most common source of accidental legacy deploys.
- Machine-readable constants in `src/config/gcp.js` give AI coding assistants (Windsurf, Claude, Copilot) a clear anchor.
- CI enforcement catches region/project drift in every PR.
- Same-region Cloud Run + Neon eliminates cross-region DB egress cost.
- Aligns REBUILD_INSTRUCTIONS.md, legacy ADR-0016, and this ADR into a consistent anti-drift wall.

### Negative

- Legacy migration scripts must be carefully exempted from the CI scan (the `--exclude-dir=scripts/migrate` escape hatch).
- Any genuine need for a second region (disaster recovery) requires a new ADR to override this lock.

### Neutral

- This ADR does not mandate Terraform or any specific IaC tool — it mandates the target values, not the deployment method.

## REBUILD_INSTRUCTIONS.md Update Required (as accepted)

The source mandated adding to `REBUILD_INSTRUCTIONS.md` under its `## DO NOT` section:

```
DO NOT use GCP project heady-prod-609590223909 — legacy project, read-only migration access only
DO NOT deploy to us-central1 — canonical region is us-east1 (region canonical lock)
DO NOT set CLOUDSQL_INSTANCE env var — use DATABASE_URL pointing to Neon
```

## Related ADRs

- Legacy ADR-0016: Neon replaces Cloud SQL (Neon in us-east1)
- Legacy ADR-0018: CI/CD GitHub Actions gates (ADR Sentinel enforcement)
- Legacy ADR-0012: 21-stage pipeline canonical
- ADR-0033: Nine-domain brand architecture (deployment-target rule 3)
- REBUILD_INSTRUCTIONS.md (legacy): explicit legacy warnings

## Reconciliation (2026-08-09 transfer)

- **Invariant carried forward:** ONE canonical GCP project + region (`us-east1`), with legacy projects prohibited as deploy targets. That single-project/single-region lock — not any particular project name — is the durable decision.
- **Project name requires re-verification.** The concrete project name in the source (`heady-rebuild`) must be re-verified against the current deploy state before being treated as operative: the rebuild deploys via keyless Workload Identity Federation under the HeadySystems org, and the operative project ID is whatever that WIF binding targets. Do not copy `heady-rebuild` into new infrastructure without confirming it against the live deploy configuration.
- **Drift-incident history preserved as evidence.** The incident record — including AI-assistant instruction poisoning via the stale legacy `WINDSURF_INSTRUCTIONS.md` (assistants generating infra against the wrong project/region because a stale instruction file said so) — is preserved above as the motivating evidence for the lock. It is a standing example of why machine-readable canonical constants beat prose documentation.
- **Pipeline stage count confirmed.** The Context table's "21-stage" pipeline matches the locked fact (HCFullPipeline = 21 stages, 0–20, fib(8)=21); no correction needed.
- **Enforcement point:** the `adr-sentinel.yml` region-lock-scan was legacy-repo CI; in the rebuild the equivalent gate is the governance gate (`/home/headyme/Heady-AI/tooling/governance-gate`), where the prohibited-string scan carries forward as policy.

## Provenance

- **Source:** `/home/headyme/Heady-AI/docs/ADR/0022-gcp-region-canonical-lock.md` (legacy docs/ADR/0022)
- **Transferred:** 2026-08-09 into the canonical corpus as ADR-0036.
- The legacy file remains in place as a historical artifact; this canonical file is the operative record.
