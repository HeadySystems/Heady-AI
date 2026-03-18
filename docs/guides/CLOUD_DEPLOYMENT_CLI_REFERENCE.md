# The 2025–2026 Cloud Deployment CLI Reference

> **Updated:** 2026-03-17 · **Platforms:** 11 · **Heady Monorepo Integration**

Every major deployment platform now ships a first-class CLI that follows a remarkably consistent pattern: install via npm/brew/curl, authenticate with a token or OAuth flow, define infrastructure in a declarative config file, and deploy with a single command. This guide covers the exact commands for **11 services** — from container orchestration on Cloud Run to model serving on HuggingFace — verified against official documentation through early 2026.

---

## Google Cloud Run

```bash
# Install & auth
curl https://sdk.cloud.google.com | bash
gcloud auth login
gcloud config set project PROJECT_ID

# Deploy from source (no Dockerfile — Buildpacks)
gcloud run deploy my-service \
  --source . --region us-central1 --allow-unauthenticated \
  --memory 512Mi --cpu 1 --min-instances 1 --max-instances 10 \
  --set-env-vars KEY1=VALUE1,KEY2=VALUE2

# Deploy from container image
gcloud run deploy my-service \
  --image us-central1-docker.pkg.dev/PROJECT_ID/REPO/IMAGE:TAG \
  --region us-central1 --allow-unauthenticated

# Canary traffic splitting
gcloud run deploy my-service --image IMAGE:v2 --region us-central1 --no-traffic
gcloud run services update-traffic my-service --region us-central1 \
  --to-revisions my-service-00001-abc=90,my-service-00002-def=10
gcloud run services update-traffic my-service --region us-central1 --to-latest

# Secrets from Secret Manager
# --set-secrets "DB_PASSWORD=db-password:latest"
# Declarative: gcloud run services describe my-service --format export > service.yaml
```

---

## Cloudflare Workers & Pages (Wrangler v4)

```bash
npm i -D wrangler@latest
npx wrangler login
# CI/CD: export CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ACCOUNT_ID=<id>

npx wrangler deploy                            # deploy Worker
npx wrangler deploy --env production           # named environment
npx wrangler dev                               # local dev (workerd)
npx wrangler secret put SECRET_NAME            # add secret
npx wrangler pages deploy ./dist --project-name=my-site  # Pages deploy
```

**wrangler.toml** bindings: KV (`[[kv_namespaces]]`), R2 (`[[r2_buckets]]`), DO (`[durable_objects]`). Wrangler v4 removed `publish` — use `deploy` only.

---

## Render (YAML Blueprints)

```yaml
# render.yaml
services:
  - type: web
    name: my-app
    runtime: node
    plan: starter
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: DATABASE_URL
        fromDatabase: { name: my-db, property: connectionString }
databases:
  - name: my-db
    plan: starter
    postgresMajorVersion: 16
```

```bash
brew install render && render login
render deploys create srv-xxxxx
curl https://api.render.com/deploy/srv-xxx?key=your_deploy_hook_key  # webhook deploy
```

---

## Vercel

```bash
npm i -g vercel && vercel login && vercel link
vercel           # preview deploy
vercel --prod    # production deploy
# CI/CD: vercel deploy --prod --token $VERCEL_TOKEN --yes
# Needs: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
```

---

## GitHub Actions — Reusable Workflows

```yaml
# Cloud Run (Workload Identity Federation — keyless)
- uses: google-github-actions/auth@v3
  with:
    workload_identity_provider: 'projects/123/locations/global/...'
    service_account: 'sa@project.iam.gserviceaccount.com'
- uses: google-github-actions/deploy-cloudrun@v3
  with: { service: my-app, region: us-central1, source: './' }

# Cloudflare
- uses: cloudflare/wrangler-action@v3
  with: { apiToken: '${{ secrets.CLOUDFLARE_API_TOKEN }}', command: 'deploy' }

# Turborepo monorepo (affected packages only)
- run: pnpm turbo run build --affected
```

---

## Firebase

```bash
npm install -g firebase-tools && firebase login
firebase deploy                          # deploy everything
firebase deploy --only hosting           # hosting only
firebase deploy --only functions:myFunc  # specific function
# CI/CD: GOOGLE_APPLICATION_CREDENTIALS (service account JSON)
# Note: firebase login:ci is DEPRECATED
```

---

## Neon Postgres (Database Branching)

```bash
npm i -g neonctl && neon auth
neon branches create --project-id proj-xxx --name feature/user-auth
neon branches list --project-id proj-xxx
neon branches schema-diff --project-id proj-xxx
neon connection-string --project-id proj-xxx --pooled  # PgBouncer for serverless
```

```typescript
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);
const [post] = await sql`SELECT * FROM posts WHERE id = ${postId}`;
```

---

## Upstash Redis (HTTP/REST)

```bash
npm install @upstash/redis
# UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN from console
```

```typescript
import { Redis } from "@upstash/redis";
const redis = Redis.fromEnv();
await redis.set("key", "value", { ex: 60 });
```

---

## HuggingFace (`hf` CLI)

```bash
curl -LsSf https://hf.co/cli/install.sh | bash
hf auth login
hf upload my-username/my-model . .
hf repos create my-space --repo-type space --space-sdk gradio
hf upload username/my-space ./local-dir . --repo-type=space
```

---

## Sentry (Debug ID Source Maps)

```bash
npm install -g @sentry/cli && sentry-cli login
VERSION=$(sentry-cli releases propose-version)
sentry-cli releases new "$VERSION"
sentry-cli releases set-commits "$VERSION" --auto
sentry-cli sourcemaps inject ./dist
sentry-cli sourcemaps upload ./dist
sentry-cli releases finalize "$VERSION"
sentry-cli deploys new --release "$VERSION" -e production
```

---

## Key Patterns (2025-2026)

1. **Declarative configs** — `wrangler.toml`, `render.yaml`, `firebase.json`, `vercel.json`, Knative `service.yaml`
2. **Keyless auth** — Workload Identity Federation (GCP), scoped API tokens (CF, Vercel, Render)
3. **Edge-native data over HTTP** — Neon serverless driver, Upstash REST API (no TCP needed)
4. **Breaking changes** — Wrangler v4 (`publish` removed), HF CLI (`huggingface-cli` → `hf`), Sentry Debug IDs, Turborepo `--affected`
