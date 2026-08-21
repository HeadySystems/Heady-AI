---
description: "MANDATORY — Heady architecture hard rules. Zero tolerance for localhost, tunnels, or local-only patterns. Everything is cloud-deployed. Read this BEFORE making ANY infrastructure or proxy changes."
---

> Transferred 2026-08-09 from ~/.agents/workflows during the rebuild command consolidation.
> ⚠ Service URLs and the Cloudflare account ID below predate the canonical GCP lock (ADR-0036) — verify against current deploy state before running.

# No-Local Enforcement

## HARD RULES

1. **NEVER** use `localhost:*` to serve any Heady site or API
2. **REJECT** legacy tunnel mechanisms such as ngrok and localtunnel; use governed cloud ingress
3. **NEVER** point buddy widgets or API calls to localhost
4. **ALWAYS** deploy to Cloud Run (`gcloud run deploy`) or Cloudflare Workers

## Before ANY action, verify

```bash
# 1. Read HEADY_CONTEXT.md for current live URLs
head -40 /home/headyme/Heady/HEADY_CONTEXT.md # <!-- legacy path; no rebuild equivalent yet -->

# 2. Check that your code doesn't reference localhost
grep -rn "localhost" --include="*.js" --include="*.ts" --include="*.html" /home/headyme/Heady/services/heady-web/sites/ | grep -v node_modules # <!-- legacy path; no rebuild equivalent yet -->
```

## Live URLs Reference

| Service | URL |
|---------|-----|
| Onboarding | `https://heady-onboarding-609590223909.us-east1.run.app` |
| IDE | `https://heady-ide-bf4q4zywhq-ue.a.run.app` |
| Brain/Chat | `https://heady-onboarding-609590223909.us-east1.run.app/api/brain/chat` |

## Deploy Commands

```bash
# Cloud Run
gcloud run deploy SERVICE --source . --region us-east1 --allow-unauthenticated --quiet

# Cloudflare Worker (ES module)
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/8b1fa38f282c691423c6399247d53323/workers/scripts/WORKER" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -F "metadata=@metadata.json;type=application/json" \
  -F "worker.js=@worker.js;type=application/javascript+module"
```
