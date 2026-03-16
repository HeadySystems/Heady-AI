---
name: heady-deploy
description: Deploy Heady services — Cloud Run, Render, Docker, Cloudflare Workers, auto-deploy scheduler
---

# heady-deploy

Deploy Heady services across all targets — Cloud Run, Render, Docker, Cloudflare Workers.

## What to do

1. Read `configs/auto-deploy.yaml` for auto-deploy configuration
2. Read `render.yaml` for Render service definitions
3. Read `Dockerfile` and `docker-compose.yml` for container config
4. Check deployment targets:
   - **Cloud Run**: GCP project `project-28ed53d7-1d79-47e0-a50` (service account: `heady-gcloud`)
   - **Render**: Auto-detected from `render.yaml`
   - **Docker**: Local or remote via compose
   - **Cloudflare Workers**: Via Cloudflare API token
5. Use MCP tools: `heady_deploy_status`, `heady_deploy_run`, `heady_cloudrun_status`
6. For auto-deploy: `heady_deploy_start` / `heady_deploy_stop`

## Targets

| Target | Config | Method |
|--------|--------|--------|
| Cloud Run | GCP project config | `gcloud run deploy` |
| Render | `render.yaml` | Git push trigger |
| Docker | `Dockerfile`, `docker-compose.yml` | `docker compose up` |
| Cloudflare | Workers config | Wrangler CLI |

## Key files

- `configs/auto-deploy.yaml` — Auto-deploy scheduler config
- `render.yaml` — Render service definitions
- `Dockerfile` — Container build definition
- `docker-compose.yml` — Multi-service orchestration
- `heady-manager.js` — Main Express server (deploy target)
- `mcp-servers/heady-mcp-server.js` — MCP tools: `heady_deploy_*`, `heady_cloudrun_status`
