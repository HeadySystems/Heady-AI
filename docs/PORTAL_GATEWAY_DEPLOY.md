# Portal → API Gateway — deploy guide

`apps/heady-portal-gateway/` is the Cloudflare Worker that fronts the **private** codeflow Cloud Run
API for the browser portal. It is the only principal holding `run.invoker` on the Cloud Run service,
bridging Firebase user tokens (browser) → a Google identity token (Cloud Run) at the edge — so the
org policy never has to be relaxed. © 2026 HeadySystems.

```
browser (Firebase ID token)
   │  Authorization: Bearer <firebase-id-token>
   ▼
heady-portal-gateway (Worker)
   │  1. verify Firebase token (RS256 / JWKS, fail-closed → 401)
   │  2. mint Google identity token (SA JWT → id_token, target_audience = Cloud Run URL, cached ~55m)
   │  3. forward with Authorization: Bearer <google-id-token> + X-Heady-User
   ▼
heady-codeflow-api  (Cloud Run, --no-allow-unauthenticated, us-east1)
```

## One-time setup

1. **Dedicated minimal invoker SA** (least privilege — do NOT reuse an Owner SA). Run as an Owner
   identity (`gcloud auth login` as eric@headyconnection.org first):
   ```bash
   gcloud iam service-accounts create heady-gateway-invoker --project heady-ai \
     --display-name "Portal gateway → codeflow invoker"
   gcloud run services add-iam-policy-binding heady-codeflow-api --region us-east1 \
     --member "serviceAccount:heady-gateway-invoker@heady-ai.iam.gserviceaccount.com" \
     --role roles/run.invoker
   gcloud iam service-accounts keys create /tmp/gateway-invoker.json \
     --iam-account heady-gateway-invoker@heady-ai.iam.gserviceaccount.com
   ```

2. **Load the key as a Worker secret** (never committed), then delete the local copy:
   ```bash
   cd apps/heady-portal-gateway
   wrangler secret put GCP_SA_KEY < /tmp/gateway-invoker.json
   wrangler secret put INTERNAL_NODE_SECRET
   rm /tmp/gateway-invoker.json
   ```

3. **Deploy**:
   ```bash
   pnpm --filter @heady-ai/heady-portal-gateway deploy
   # → https://heady-portal-gateway.<account>.workers.dev
   ```

4. **Point the portal at the gateway** — set the API base in
   `apps/headyme-portal/src/services/heady-api.js` to the gateway URL (or `https://headyme.com/api`
   once the custom domain + route below are attached), then rebuild + `firebase deploy --only hosting`.

## Custom domain (headyme.com)

- **API path**: add a Worker route `headyme.com/api/*` → `heady-portal-gateway` (Cloudflare dashboard
  → Workers Routes, or a `routes` block in `wrangler.json` once the `headyme.com` zone is on this CF
  account — account id `8b1fa38f282c691423c6399247d53323`).
- **Site**: map `headyme.com` → Firebase Hosting (`heady-ai`): in the Firebase console add the custom
  domain, then add the TXT (verification) + A/AAAA (or CNAME) records Firebase provides, at the
  domain registrar / DNS for `headyme.com`. These DNS records are the one external step only you can do.

## Config (`apps/heady-portal-gateway/wrangler.json` vars)

| var | value |
|-----|-------|
| `FIREBASE_PROJECT_ID` | `heady-ai` |
| `CLOUD_RUN_URL` | `https://heady-codeflow-api-1003436179562.us-east1.run.app` |
| `ALLOWED_ORIGINS` | `https://heady-ai.web.app,https://headyme.com,https://www.headyme.com` |
| `GCP_SA_KEY` | **secret** — `wrangler secret put GCP_SA_KEY` |
| `INTERNAL_NODE_SECRET` | **secret** — synchronized from the governed GCP Secret Manager value; injected only for verified Firebase admins on privileged node routes |

Fail-closed: a request without a valid Firebase ID token gets `401` and never reaches Cloud Run.
Privileged node audit, task, dispatch, and heartbeat routes additionally require the Firebase custom
claim `admin: true`; the browser never receives the internal service credential.
The gateway needs a valid Cloudflare API token (the one in `.env` was invalid — mint a Workers-scoped
token, or run `wrangler login`).
