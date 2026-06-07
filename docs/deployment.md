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
<!-- ║  FILE: docs/deployment.md                                                    ║
<!-- ║  LAYER: docs                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# Deployment Guide

## Local Development

```bash
git clone https://github.com/HeadyMe/Heady-8f71ffc8.git ~/Heady
cd ~/Heady
cp .env.example .env    # fill in API keys
npm install
npm run dev             # hot-reload on port 3301
```

## Container (Podman/Docker)

```bash
podman build -t heady:latest .
podman run -d \
  -p 3301:3301 \
  -v heady-data:/app/data \
  --env-file .env \
  heady:latest
```

## Cloudflare Pages (Frontend)

Automated via GitHub Actions on push to `main`.
Manual deploy:

```bash
cd frontend && npm run build
npx wrangler pages deploy dist --project-name=heady-dashboard
```

## Google Cloud Run (Backend)

Automated via GitHub Actions. Manual deploy:

```bash
gcloud run deploy heady-manager \
  --source . \
  --region us-central1 \
  --port 3301 \
  --allow-unauthenticated
```

## Cloudflare Workers (Edge Proxy)

```bash
cd workers/heady-edge
npx wrangler deploy
```

## Environment Variables

See `.env.example` for the complete list. Critical variables:

| Variable | Required | Description |
|---|---|---|
| ANTHROPIC_API_KEY | Yes | Claude API key |
| OPENAI_API_KEY | Yes | GPT/Codex API key |
| MCP_BEARER_TOKEN | Yes | MCP auth token |
| CF_API_TOKEN | For deploy | Cloudflare API token |
| GCP_PROJECT_ID | For deploy | Google Cloud project |
