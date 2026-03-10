# Runbook: Public Domain Health Verification

## Overview

Heady operates across multiple public domains fronted by Cloudflare. This runbook documents how to verify public reachability and respond to origin connectivity failures (e.g., Cloudflare 522 errors).

## Monitored Domains

| Domain | Role |
|--------|------|
| headyme.com | Primary consumer portal |
| headysystems.com | Platform marketing + docs |
| headyos.com | HeadyOS landing |
| headyconnection.org | Community / nonprofit portal |
| headyconnection.com | Community alias |
| headyfinance.com | Finance vertical |
| headyex.com | Exchange / marketplace |
| admin.headysystems.com | Admin dashboard |

## Known Issue: Cloudflare 522 Timeouts

### Observed

A bounded audit (March 2026) found all listed domains returning Cloudflare 522 errors from the audit environment. This means:

- Cloudflare can reach its own edge, but the **origin server** did not respond within Cloudflare's timeout window.
- The DNS records point to Cloudflare, so the domains are configured, but the upstream Cloud Run / Compute Engine / origin is either:
  - Not running
  - Not accepting connections on the expected port
  - Firewalled or VPC-misconfigured
  - Returning errors before Cloudflare can relay a response

### What a 522 Does NOT Mean

- It does not mean DNS is unconfigured (DNS resolved successfully to Cloudflare).
- It does not mean the domain is expired or unowned.
- It does not necessarily mean application code is broken — the origin may simply not be deployed or started.

## Triage Steps

1. **Verify origin is running**: Check Cloud Run service status for each domain's backend.
   ```bash
   gcloud run services list --project=heady-production --region=us-central1
   ```

2. **Check Cloudflare DNS**: Confirm A/AAAA/CNAME records point to the correct origin IPs or Cloud Run URLs.

3. **Check Cloudflare SSL mode**: Should be "Full (strict)" if the origin has a valid cert, or "Full" if using a Cloudflare Origin CA cert.

4. **Test origin directly** (bypass Cloudflare):
   ```bash
   curl -v --resolve headyme.com:443:<ORIGIN_IP> https://headyme.com/health
   ```

5. **Check Cloud Run logs** for startup failures or crash loops.

6. **Check firewall / VPC**: Ensure the origin accepts inbound HTTPS from Cloudflare IP ranges.

## Recovery

- If the origin is not deployed: redeploy using `scripts/deploy-cloud-run.sh`.
- If the origin is crashing: check logs, fix the issue, redeploy.
- If a firewall is blocking: add Cloudflare IP ranges to the allowlist (see https://www.cloudflare.com/ips/).
- If SSL mode mismatch: update Cloudflare SSL settings to match the origin certificate type.

## Automation

The smoke suite (`scripts/smoke-test.mjs`) can verify public endpoints once `SMOKE_BASE_URL` or `HEADY_PUBLIC_BASE_URL` is set. Until the 522 condition is resolved, smoke results should be treated as environment reachability blockers, not application regressions.
