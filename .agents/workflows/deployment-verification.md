---
description: Post-deployment verification — smoke tests all endpoints after any deploy
---

> **OPTIMAL BUILD NOTICE:** This file has been auto-migrated for the Heady-AI Latent OS (v2.0.0).
> - **Package Manager:** Use `pnpm` and `Turborepo`
> - **Frontend:** Vite SPAs + Vanilla Web Components (React only for complex canvas)
> - **Event Bus:** NATS (`heady-event-bus`)
> - **Sandbox:** WASM WebContainers
> - **UI Sync:** Server-Sent Events (SSE) + HTTP/2
> - **Vector Trigger:** Merkle-Tree File Hashing
> - **Rule File:** Follow `AGENTS.md`

# ✅ Deployment Verification Workflow

> Run immediately after any deployment to Cloud Run or Cloudflare.

## Steps

1. **Wait for propagation** (30s for Cloudflare, 60s for Cloud Run)

2. **Smoke test all domains**

   ```bash
   for d in headyme.com headysystems.com headyconnection.org headymcp.com headyio.com headybuddy.org headybot.com headyos.com headyapi.com; do
     STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$d/")
     EDGE=$(curl -sI "https://$d/" | grep -i x-heady)
     echo "$d: HTTP $STATUS | $EDGE"
   done
   ```

3. **Verify API endpoints**
   - `GET /api/health` → 200
   - `GET /api/brain/status` → 200
   - `GET /api/registry` → 200

4. **Verify auth gate** — Each site should show auth overlay on first visit (no session)

5. **Check nav** — All 9 domains linked in every site's navigation

6. **Report** — Log results as telemetry event via self-awareness
