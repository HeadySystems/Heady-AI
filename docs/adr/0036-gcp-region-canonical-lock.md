# ADR-0036: GCP Project + Region Canonical Lock — us-east1

**Renumbered:** ADR-0022 → ADR-0036 (2026-08-04) — resolves the `docs/ADR/`↔`docs/adr/` numbering collision (audit F1, `docs/reports/sot-consistency-audit-2026-08-04.md`)  
**Status:** Accepted  
**Date:** 2026-06-17  
**Deciders:** Eric Haywood (HeadySystems Inc.)  
**Strength of Acceptance:** ⭐⭐⭐⭐⭐ (Critical — prevents infrastructure drift into legacy GCP project and wrong region; directly addresses WINDSURF_INSTRUCTIONS.md divergence)

---

## Context

A critical divergence exists between legacy documentation and the active rebuild:

| Property | Legacy (DO NOT USE) | Canonical Rebuild |
|---|---|---|
| GCP Project | `heady-prod-609590223909` | `heady-rebuild` (or successor) |
| Region | `us-central1` | `us-east1` |
| Database | Cloud SQL (Postgres 14) | Neon Postgres (serverless, `us-east1`) |
| Pipeline | 9-stage | 21-stage (ADR-0012) |

The legacy project `heady-prod-609590223909` in `us-central1` was used during the initial production phase. It contains Cloud SQL instances, Cloud Run services, and Cloud Storage buckets that are **not compatible** with the rebuild architecture (ADR-0016, ADR-0012).

Incidents have occurred where:
1. CI/CD pipelines resolved the wrong GCP project from environment variables and deployed to `us-central1`.
2. A developer referenced `heady-prod-609590223909` in a Terraform plan, which would have provisioned Cloud SQL alongside Neon.
3. WINDSURF_INSTRUCTIONS.md — the legacy IDE configuration file — still contains `us-central1` and `heady-prod-609590223909` references, causing AI coding assistants to generate infrastructure targeting the wrong environment.

This ADR formally locks the canonical GCP project and region, provides machine-readable constants, and mandates CI enforcement.

---

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
| `sql.googleapis.com` (Cloud SQL API) | Replaced by Neon (ADR-0016) |
| `CLOUDSQL_INSTANCE` env var | Replaced by `DATABASE_URL` pointing to Neon |

Exception: `LEGACY` block in `src/config/gcp.js` and data-migration scripts under `scripts/migrate/` may reference the legacy project for read-only access during migration windows only.

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
      | grep -v "LEGACY\|# DO NOT USE\|ADR-0036" || true)
    if [ -n "$FOUND" ]; then
      echo "❌ Legacy region/project references found:"
      echo "$FOUND"
      exit 1
    fi
    echo "✅ No legacy region/project references"
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

---

## Consequences

### Positive
- Eliminates the most common source of accidental legacy deploys.
- Machine-readable constants in `src/config/gcp.js` give AI coding assistants (Windsurf, Claude, Copilot) a clear anchor.
- CI enforcement catches region/project drift in every PR.
- Same-region Cloud Run + Neon eliminates cross-region DB egress cost.
- Aligns REBUILD_INSTRUCTIONS.md, ADR-0016, and this ADR into a consistent anti-drift wall.

### Negative
- Legacy migration scripts must be carefully exempted from the CI scan (the `--exclude-dir=scripts/migrate` escape hatch).
- Any genuine need for a second region (disaster recovery) requires a new ADR to override this lock.

### Neutral
- This ADR does not mandate Terraform or any specific IaC tool — it mandates the target values, not the deployment method.

---

## REBUILD_INSTRUCTIONS.md Update Required

Add to `REBUILD_INSTRUCTIONS.md` under `## DO NOT` section:

```
DO NOT use GCP project heady-prod-609590223909 — legacy project, read-only migration access only
DO NOT deploy to us-central1 — canonical region is us-east1 (ADR-0036)
DO NOT set CLOUDSQL_INSTANCE env var — use DATABASE_URL pointing to Neon (ADR-0016)
```

---

## Related ADRs

- ADR-0016: Neon replaces Cloud SQL (Neon in us-east1)
- ADR-0018: CI/CD GitHub Actions gates (ADR Sentinel enforcement)
- ADR-0012: 21-stage pipeline canonical
- REBUILD_INSTRUCTIONS.md: explicit legacy warnings
