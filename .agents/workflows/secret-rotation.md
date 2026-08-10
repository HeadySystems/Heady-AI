---
description: Secret rotation — rotate API keys, tokens, and credentials on schedule
---

> Transferred 2026-08-09 from /home/headyme/_archive/HeadyClone/Heady-pre-production-9f2f0642/.agents/workflows during the rebuild command consolidation.

# 🔐 Secret Rotation Workflow

> Run monthly or on-demand when a secret is compromised.

## Steps

1. **Audit current secrets** — Check `configs/governance/secrets-manifest.yaml` against environment

   ```bash
   node -e "
     const manifest = require('yaml').parse(require('fs').readFileSync('configs/governance/secrets-manifest.yaml','utf8'));
     manifest.secrets.forEach(s => {
       const val = process.env[s.envVar];
       console.log(s.id, val ? '✅ SET' : '❌ MISSING', s.expiryPolicy || 'no-expiry');
     });
   "
   ```

2. **Rotate expired secrets** — For each expired or compromised secret:
   - Generate new credential from provider dashboard
   - Update in GCP Secret Manager: `gcloud secrets versions add SECRET_NAME --data-file=-`
   - Update Cloud Run service: `gcloud run services update heady-manager --update-secrets=...`
   - Update Cloudflare Workers: `npx wrangler secret put SECRET_NAME`

3. **Verify rotation** — Restart service and check logs for auth failures

4. **Update manifest** — Record rotation timestamp in secrets-manifest.yaml

5. **Emit telemetry** — Log rotation event to self-awareness
