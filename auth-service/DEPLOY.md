<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: auth-service/DEPLOY.md                                                    ║
<!-- ║  LAYER: root                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# HeadyAuth Deployment Guide

> **Public product:** HeadyKey (headykey.com)
> **Internal service name:** auth-service (HeadyAuth v5.0)
>
> This service is the backend for the HeadyKey public auth product.
> The internal service name `auth-service` / `heady-auth` is stable and unchanged.
> See also: `HeadySystems/Heady-Main: docs/auth-service-boundaries.md` for the
> full service boundary documentation between auth-service and auth-session-server.

## Prerequisites
- GCP project: `headyme-444017`
- Region: `us-central1`
- Docker registry: `us-central1-docker.pkg.dev/headyme-444017/heady-services`

## Step 1: Set Environment
```bash
export GCP_PROJECT=headyme-444017
export GCP_REGION=us-central1
export SERVICE_NAME=heady-auth
```

## Step 2: Generate JWT Secret (if not already in Secret Manager)
```bash
openssl rand -hex 64 | gcloud secrets create heady-jwt-secret \
  --project=$GCP_PROJECT --data-file=- --replication-policy=automatic
```

## Step 3: Build & Push Docker Image
```bash
cd auth-service
docker build -t $GCP_REGION-docker.pkg.dev/$GCP_PROJECT/heady-services/$SERVICE_NAME:5.0.0 .
docker push $GCP_REGION-docker.pkg.dev/$GCP_PROJECT/heady-services/$SERVICE_NAME:5.0.0
```

## Step 4: Deploy to Cloud Run
```bash
gcloud run deploy $SERVICE_NAME \
  --project=$GCP_PROJECT \
  --region=$GCP_REGION \
  --image=$GCP_REGION-docker.pkg.dev/$GCP_PROJECT/heady-services/$SERVICE_NAME:5.0.0 \
  --port=3309 \
  --set-env-vars="NODE_ENV=production,SERVICE_NAME=heady-auth" \
  --set-secrets="JWT_SECRET=heady-jwt-secret:latest,DATABASE_URL=neon-database-url:latest" \
  --allow-unauthenticated \
  --min-instances=1 \
  --max-instances=13 \
  --memory=256Mi \
  --cpu=0.25
```

## Step 5: Wire DNS
auth.headysystems.com should CNAME to the Cloud Run URL.
The Cloudflare zone for headysystems.com is: `d71262d0faa509f890fd5fea413c39bc`

## Step 6: Verify
```bash
curl https://auth.headysystems.com/health/live
curl https://auth.headysystems.com/health/ready
curl https://auth.headysystems.com/health/startup
```

## Step 7: Create Founder Account
```bash
curl -X POST https://auth.headysystems.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"eric@headyconnection.org","password":"<secure>","name":"Eric Haywood"}'
```

Then upgrade to admin via direct DB:
```sql
UPDATE users SET role = 'admin', onboarding_stage = 5 WHERE email = 'eric@headyconnection.org';
```

## Required GitHub Secrets

These secrets must be configured in the repository's GitHub Actions settings
before CI/CD auto-deploy will work:

| Secret | Purpose | Status |
|--------|---------|--------|
| `GCP_SA_KEY` | GCP Service Account key JSON (used by deploy-auth.yml) | Required — blocks deploy if missing |
| `GCP_PROJECT_ID` | GCP project ID (used by deploy-auth-server.yml) | Required — blocks deploy if missing |
| `NEON_DATABASE_URL` | Neon PostgreSQL connection string | Required for runtime |
| `SENTRY_DSN` | Sentry error tracking | Recommended |
| `SENTRY_AUTH_TOKEN` | Sentry source map uploads | Recommended |

## Runtime Secret Manager Checks

At startup, auth-service validates `JWT_SECRET`. If missing, it exits with
code 1 (see `src/index.js` `start()` function). `DATABASE_URL` is loaded
from GCP Secret Manager at deploy time via `--set-secrets` in the Cloud Run
deploy step.

| GCP Secret Name | Injected As | Purpose |
|----------------|-------------|---------|
| `heady-jwt-secret` | `JWT_SECRET` | JWT signing key (HS256) |
| `neon-database-url` | `DATABASE_URL` | PostgreSQL connection string |

If startup fails, check:
1. The Cloud Run service account has `roles/secretmanager.secretAccessor`
2. The secrets exist in project `headyme-444017`
3. The `:latest` version of each secret is enabled
4. `JWT_SECRET` is non-empty (the only hard startup gate in code)
