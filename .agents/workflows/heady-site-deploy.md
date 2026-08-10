---
description: Deploy any Heady web property to Cloud Run + Cloudflare
---

> Transferred 2026-08-09 from ~/.agents/workflows during the rebuild command consolidation.
> ⚠ Project/region references (`heady-main-project`, `us-east1`) and the domain/service table predate the canonical GCP lock (ADR-0036) — verify against current deploy state before running.

# Heady Site Deployment

// turbo-all

Unified deployment workflow for any of the 24 Heady web properties. Covers Cloud Run, Cloudflare Workers, and Cloudflare Pages.

## Step 1: Identify the Site

Look up the site in `~/Heady-AI/configs/_domains/site-registry.yaml` or the `heady-registry.json`:

| Domain | Platform | Service Name |
|--------|----------|--------------|
| headysystems.com | Cloudflare Pages | headysystems-com |
| headyio.com | Cloud Run | heady-main |
| api.headysystems.com | Cloud Run | heady-api |
| brain.headysystems.com | Cloud Run | heady-brain |
| manager.headysystems.com | Cloud Run | heady-manager |
| registry.headysystems.com | Cloudflare Workers | heady-registry |
| heady-ai.com | Cloudflare Workers | heady-ai-proxy |
| admin.headysystems.com | Cloud Run | heady-admin |

> For a complete listing, check `00-HEADY-MASTER-CONTEXT.md` Section 4.

## Step 2: Deploy to Platform

### Cloud Run

```bash
# Standard Cloud Run deployment
gcloud run deploy SERVICE_NAME \
  --source . \
  --region us-east1 \
  --project heady-main-project \
  --allow-unauthenticated \
  --port 3300 \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 3
```

### Cloudflare Workers

```bash
# Deploy a Cloudflare Worker
cd ~/Heady/workers/WORKER_DIR # <!-- legacy path; no rebuild equivalent yet -->
npx wrangler deploy
```

### Cloudflare Pages

```bash
# Deploy to Cloudflare Pages
cd ~/Heady/sites/SITE_DIR # <!-- legacy path; no rebuild equivalent yet -->
npm run build
npx wrangler pages deploy ./dist --project-name=PROJECT_NAME
```

## Step 3: Configure DNS (if first deploy)

```bash
# Add CNAME record in Cloudflare DNS panel or via API:
# For Cloud Run services:
# CNAME subdomain.headysystems.com → SERVICE_NAME-HASH.a.run.app
# For Workers:
# CNAME subdomain.headysystems.com → WORKER_NAME.ACCOUNT.workers.dev
```

## Step 4: Verify Deployment

```bash
# Check HTTP status
curl -s -o /dev/null -w "%{http_code}" https://DOMAIN.headysystems.com
# Check response body
curl -s https://DOMAIN.headysystems.com | head -20
# For Cloud Run, check revision
gcloud run revisions list --service SERVICE_NAME --region us-east1 --project heady-main-project --limit 3
```

## Step 5: Rollback (if needed)

```bash
# Cloud Run rollback to previous revision
gcloud run services update-traffic SERVICE_NAME \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region us-east1 \
  --project heady-main-project

# Cloudflare Workers rollback
npx wrangler rollback --name WORKER_NAME
```

## Rules

- Always verify HTTPS after deployment — no HTTP-only deployments
- Use `--allow-unauthenticated` for public-facing services; use IAM for internal APIs
- Standard region is `us-east1` for Cloud Run
- GCP project ID is `heady-main-project` — confirm before deploying
- Never deploy to `localhost` or `onrender.com` — see `/heady-no-local`
