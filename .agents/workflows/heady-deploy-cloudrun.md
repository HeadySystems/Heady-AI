---
description: Deploy Heady Admin UI (or any site) to Google Cloud Run production
---

> Transferred 2026-08-09 from ~/.agents/workflows during the rebuild command consolidation.
> ⚠ Project/region references predate the canonical GCP lock (ADR-0036) — verify against current deploy state before running.

// turbo-all

## Prerequisites
- GCP Project: `gen-lang-client-0920560496`
- Account: `eric@headyconnection.org`
- Service Account: `headyio@gen-lang-client-0920560496.iam.gserviceaccount.com`
- gcloud CLI installed at: `~/google-cloud-sdk/bin/gcloud`

## Steps

1. Ensure gcloud PATH is set
```bash
export PATH="/home/headyme/google-cloud-sdk/bin:$PATH"
```

2. Check gcloud auth
```bash
gcloud auth list
```
If not authenticated, run:
```bash
gcloud auth login eric@headyconnection.org
```

3. Set project and region
```bash
gcloud config set project "${GCP_PROJECT_ID:-heady-rebuild}"
gcloud config set run/region us-east1
```

4. Ensure the target folder has a `Dockerfile` and `package.json`
   - Admin UI location: `/home/headyme/sites/admin-ui/`
   - Dockerfile should use `node:20-slim`, expose port `8080`
   - package.json should have `"start": "node server.js"`

5. Deploy to Cloud Run
```bash
gcloud run deploy heady-admin-ui \
  --source=/home/headyme/sites/admin-ui \
  --region=us-east1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=256Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --set-env-vars="API_TARGET=https://manager.headysystems.com" \
  --quiet
```

6. If IAM `allUsers` binding fails due to org policy, disable the invoker check:
```bash
gcloud run services update heady-admin-ui --region=us-east1 --no-invoker-iam-check --quiet
```

7. Verify deployment
```bash
curl -s -o /dev/null -w "HTTP %{http_code}" "$(gcloud run services describe heady-admin-ui --region=us-east1 --format='value(status.url)')"
```

## Cloud Run URLs
- Canonical: the service URL from `gcloud run services describe heady-admin-ui --region=us-east1 --format='value(status.url)'`
- Legacy (superseded — never a deploy target): `heady-admin-ui-609590223909.us-central1.run.app`

## Cloudflare DNS
To point `admin.headysystems.com` → Cloud Run:
- Type: CNAME
- Name: admin
- Target: the canonical service host from the describe command above (never the legacy `…us-central1.run.app` host)
- Proxy: ON (orange cloud)
- SSL: Full (Strict)

## API Keys (shared G AI Studio / gcloud / Colab)
- Heady Project key: Use env `GEMINI_API_KEY`
- Default Gemini key: Use env `GOOGLE_API_KEY`
- Service Account: `headyio@gen-lang-client-0920560496.iam.gserviceaccount.com`
