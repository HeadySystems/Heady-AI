<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  HEADY™ Runbook — 1ime1.com Admin Surface v1.0.0                  ║
<!-- ║  Human-gated checklist: make https://1ime1.com serve              ║
<!-- ║  apps/headyme-portal (Firebase Hosting, project heady-ai).        ║
<!-- ║  FILE: docs/runbooks/1IME1_ADMIN_SURFACE_RUNBOOK.md               ║
<!-- ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# 1ime1.com Admin Surface — Launch Runbook

**Goal:** https://1ime1.com serves the admin portal (`apps/headyme-portal`) at root.
**Approved by:** Founder ruling (domain canon: `facts.yaml` → `domains.1ime1`, role `admin-surface`, status `verified`).
**Deploy pipeline:** `.github/workflows/deploy-firebase-hosting.yml` (canonical, WIF auth) → Firebase Hosting, project `heady-ai`, default site (`apps/headyme-portal/firebase.json` + `.firebaserc`).

Every step below that touches Cloudflare or the Firebase console is **HUMAN-GATED** — the CI/agent-visible Cloudflare API token cannot manage zones (zones API returns `success:false`; verified 2026-07-04).

---

## 0. Observed state (2026-07-04 — read-only evidence, re-verify before starting)

| Check | Result |
|---|---|
| `dig NS 1ime1.com` | `vick.ns.cloudflare.com` / `sunny.ns.cloudflare.com` — same NS pair as headyme.com/headymcp.com → the zone **already exists on the Heady Cloudflare account** |
| `curl -I https://1ime1.com/` | `302` → `headyconnection.cloudflareaccess.com` — a **Cloudflare Access (Zero Trust) application already fronts 1ime1.com** |
| `curl https://www.1ime1.com/` | `200` (not Access-protected) |
| Firebase Hosting live content | `https://heady-ai.web.app/` → `200`, `<title>HeadyMe Portal</title>` |
| Cloudflare API token in `.env` | zone-management calls fail (`success:false`) — lacks zone scope |

Consequences:
- The runbook's "add zone" step is **already done**; what remains is DNS record changes, the Firebase custom-domain attach, and an explicit decision about the existing Access policy.
- Keeping Cloudflare Access in front of an **admin** surface is recommended; the trade-offs are in Step 3.

## 1. Gate A — Cloudflare token + zone confirmation (human)

1. Log in to `dash.cloudflare.com` (Heady account that hosts headyme.com et al.).
2. Confirm the `1ime1.com` zone is Active and note the current DNS records + which origin the root record points at today (expect a Cloudflare Tunnel or proxied record, given the Access 302).
3. Mint a **zone-scoped** API token (My Profile → API Tokens → Create Token):
   - Permissions: `Zone → Zone → Read`, `Zone → DNS → Edit`
   - Zone Resources: `Include → Specific zone → 1ime1.com`
4. Store it via the secrets CLI (GCP Secret Manager — never plaintext in `.env`):
   ```bash
   pnpm --filter @heady/secrets exec heady-secrets set cloudflare-1ime1-dns-token
   # paste token on stdin
   ```
5. Re-run the scope probe; it must now return `success:true`:
   ```bash
   curl -s -H "Authorization: Bearer $CF_1IME1_TOKEN" \
     "https://api.cloudflare.com/client/v4/zones?name=1ime1.com" | head -c 400
   ```

## 2. Gate B — Firebase Hosting custom-domain attach (human, console-only)

Firebase Hosting custom domains cannot be attached via the CLI — use the console.

1. Confirm the portal content is current: `firebase deploy` runs via `.github/workflows/deploy-firebase-hosting.yml`, or manually:
   ```bash
   cd apps/headyme-portal && pnpm exec vite build --mode production && \
     firebase deploy --only hosting --project heady-ai --non-interactive
   ```
2. Console: `https://console.firebase.google.com/project/heady-ai/hosting/sites` → default site → **Add custom domain** → `1ime1.com` (also add `www.1ime1.com` as a redirect to the apex when prompted).
3. Firebase shows an ownership **TXT** record, then serving **A** record(s). The console values are authoritative; expected shape:

   | Type | Name | Value | Cloudflare proxy state |
   |---|---|---|---|
   | TXT | `1ime1.com` | `hosting-site=heady-ai` (console shows exact token) | DNS only (grey cloud) |
   | A | `1ime1.com` | `199.36.158.100` (Firebase Hosting serving IP; console value wins) | **DNS only during provisioning** |

4. In the Cloudflare `1ime1.com` zone (Gate A token or dashboard): add/replace the records exactly as the console displays. **Set them to DNS-only (grey cloud) until the Firebase cert status reads `Active`** — Cloudflare's proxy breaks Firebase's ACME cert issuance.
5. Wait for the console to show Domain status `Connected`, cert `Active` (minutes to ~24 h).

## 3. Access policy decision (human — security ruling)

`1ime1.com` currently sits behind Cloudflare Access (`headyconnection` team). Choose one:

- **Option 1 — keep Access in front (recommended for an admin surface):** after the Firebase cert is `Active`, re-enable the orange-cloud proxy on the A record, set the zone SSL/TLS mode to `Full (strict)`, and keep/update the Access application for hostname `1ime1.com` (allow-list: founder + admin identities). Verify Firebase still serves correctly through the proxy after the switch.
- **Option 2 — Firebase-only (DNS-only stays):** delete the Access application for `1ime1.com`. The portal's own Firebase Auth gate is then the only login wall. Record the ruling in `facts.yaml` (`domains.1ime1.note`) either way.

## 4. Post-attach verification (agent-runnable)

```bash
# 1. Root serves the portal (200, not the Access 302):
curl -s -o /dev/null -w "%{http_code}\n" https://1ime1.com/            # expect 200 (Option 2) or 302→Access login→200 after SSO (Option 1)

# 2. Content is headyme-portal:
curl -s https://1ime1.com/ | grep -o "<title>[^<]*</title>"            # expect <title>HeadyMe Portal</title>

# 3. SPA rewrite works (firebase.json rewrites ** → /index.html):
curl -s -o /dev/null -w "%{http_code}\n" https://1ime1.com/admin/anywhere   # expect 200

# 4. Certificate chain:
curl -svI https://1ime1.com/ 2>&1 | grep -iE "issuer|subject:"         # DNS-only: Google Trust Services; proxied: Cloudflare

# 5. Hosting fingerprint (DNS-only path):
curl -sI https://1ime1.com/ | grep -iE "x-served-by|x-cache|strict-transport-security"
```

Then update `facts.yaml` → `domains.1ime1.dns_observed` with the new observation and re-run the coherence gate:
```bash
node tooling/coherence/src/coherence.mjs check
```

## 5. Later step — tasks.1ime1.com → Drupal task-manager

Registry slot: `configs/_domains/site-registry.yaml` → `id: 1ime1` (pm2 `site-1ime1`, port `9011`, dir `/home/headyme/sites/1ime1`).

1. Deploy Drupal 11 headless into the `site-1ime1` slot (container serving port 9011; enable JSON:API per the heady-drupal-headless-ops pattern).
2. Route the hostname through the existing Cloudflare Tunnel that carries the other 8 public domains: add a tunnel ingress rule mapping `tasks.1ime1.com` → the `site-1ime1` service on port 9011, then `cloudflared tunnel route dns <tunnel> tasks.1ime1.com`.
3. Extend the Cloudflare Access application (or create one) for `tasks.1ime1.com` — task manager is admin-only.
4. Verify:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://tasks.1ime1.com/jsonapi   # expect 200 (after Access SSO)
   ```
5. Add `tasks.1ime1.com` as a subdomain note under `facts.yaml` → `domains.1ime1` when live.

## 6. Rollback

1. Firebase console → Hosting → custom domains → remove `1ime1.com`.
2. Restore the prior Cloudflare DNS records captured in Step 1.2 (screenshot/export them before changing anything).
3. The Access application is independent of DNS — leave it in place so the surface stays locked during rollback.
