# Heady™ Deployment Guide

## Promotion Pipeline

Code flows through 3 repos with gated promotions:

```
Testing (HeadyMe/Heady-pre-production-9f2f0642)
    ↓  ./scripts/promote.sh staging
Staging (HeadyMe/Heady-Staging)
    ↓  ./scripts/promote.sh production
Production (HeadyMe/heady-production)
```

### Promote to Staging

```bash
./scripts/promote.sh staging
```

Pre-flight checks: branch validation, clean working tree, syntax checks, pipeline JSON validation.

### Promote to Production

```bash
./scripts/promote.sh production
```

Extra gates: staging sync verification + interactive confirmation.

### Check Status

```bash
./scripts/promote.sh status
```

## Cloud Run Deployment

### Prerequisites

- Google Cloud SDK installed
- Project: `heady-systems` (or your project ID)
- Artifact Registry: `us-central1-docker.pkg.dev/heady-systems/heady`

### Deploy

```bash
# Build and push container
docker build -t us-central1-docker.pkg.dev/heady-systems/heady/core:latest .
docker push us-central1-docker.pkg.dev/heady-systems/heady/core:latest

# Deploy to Cloud Run
gcloud run deploy heady-core \
  --image us-central1-docker.pkg.dev/heady-systems/heady/core:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --memory 1Gi \
  --cpu 2 \
  --min-instances 1 \
  --max-instances 10
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `production` or `development` |
| `PORT` | No | Server port (default: 3301) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `OPENAI_API_KEY` | Yes | OpenAI API key for embeddings + chat |
| `ANTHROPIC_API_KEY` | Yes | Claude access |
| `GOOGLE_AI_API_KEY` | No | Gemini access |
| `FIREBASE_API_KEY` | Yes | Firebase auth |
| `HEADY_API_SECRET` | Yes | Internal API signing secret |
| `HEADY_CERT_DIR` | No | mTLS certificate directory |

## Domain Routing

All 16 Heady domains route through Cloudflare Workers to Cloud Run:

| Domain | Service |
|--------|---------|
| headyme.com | Main landing |
| headysystems.com | Corporate |
| headyapi.com | API gateway |
| headymcp.com | MCP tools |
| headybuddy.org | Companion |
| headyconnection.org | Nonprofit |
| headyio.com | Platform |
| heady-ai.com | AI portal |
| headybot.com | Bot interface |
| headyos.com | OS portal |
| headysense.com | Analytics |
| headyex.com | Exchange |
| headyfinance.com | Finance |
| headyconnection.com | Community |
| perfecttrader.com | Trading |
| headyai.me | Personal AI |
