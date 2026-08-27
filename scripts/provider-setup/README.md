# Provider Setup Scripts

Local CLI scripts for provisioning HeadyKey and HeadyVault across all cloud providers
for both the `legacy` (heady-ai) and `rebuild` (heady-rebuild) environments.

**Prerequisites:** Run on Parrot OS (or any Linux) with these CLIs authenticated:
`gcloud` · `wrangler` · `firebase-tools` · `neonctl` · `gh`

## Quick start

```bash
# Dry-run first — see the full plan with no changes
bash run-all.sh --dry-run

# Full setup from scratch
bash run-all.sh --yes

# Resume from a specific script after a failure
bash run-all.sh --from 03

# Run a single script
bash run-all.sh --only 06
```

## Script order and dependencies

| # | Script | Provider | Creates |
|---|--------|----------|---------|
| 00 | `00-preflight.sh` | All | Auth checks, env validation |
| 01 | `01-gcp-setup.sh` | GCP | `heady-rebuild` project, SA, WIF, Secret Manager stubs |
| 02 | `02-neon-setup.sh` | Neon | `heady-rebuild` project, pgvector, dev/legacy + dev/rebuild branches |
| 03 | `03-firebase-setup.sh` | Firebase | `heady-rebuild` project, web app, SDK config → Secret Manager |
| 04 | `04-cloudflare-setup.sh` | Cloudflare | KV namespaces (`--REBUILD` suffix), R2 buckets, Pages projects |
| 05 | `05-headykey-deploy.sh` | Cloudflare Pages | `headykey-legacy` + `headykey-rebuild` deployments |
| 06 | `06-headyvault-seed.sh` | GCP | Seeds all 15 secrets into both `heady-ai` + `heady-rebuild` |
| 07 | `07-wrangler-envs.sh` | Cloudflare / GCP | `wrangler-rebuild-env.toml`, `wrangler-legacy-env.toml`, Cloud Run `--set-secrets` flags |

## Output

All scripts write machine-readable JSON summaries to `scripts/provider-setup/output/`.
Logs per-script go to `scripts/provider-setup/output/logs/`.

## Environment variables

```bash
export GCP_LEGACY_PROJECT=heady-ai
export GCP_REBUILD_PROJECT=heady-rebuild
export GCP_REGION=us-central1
export GCP_BILLING_ACCOUNT=<your-billing-id>   # required for new project
export CF_ACCOUNT_ID=<your-cf-account-id>
```

## Security

The `output/` directory is gitignored — it contains `.env.legacy`, `.env.rebuild`,
and GCP service account keys. Never commit these.

φ = 1.618033988749895
Made with ❤️ by HeadySystems Inc.
