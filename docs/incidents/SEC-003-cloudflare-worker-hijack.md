<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ SEC-003 — Cloudflare Worker reverse-proxy hijack          ║
║  Made with ❤️ by HeadySystems Inc.                                ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# SEC-003 — 20 Cloudflare Workers reverse-proxy to an attacker origin

- **Status:** 🔴 **OPEN — ACTIVE**, verified live 2026-08-26
- **Severity:** Critical — credential and session interception on 20 production domains
- **Onset:** 2026-07-06T19:10–19:15Z · **Duration:** 51 days and counting
- **Verified by:** direct read-only Cloudflare API enumeration (scripts, zone routes, audit log)

## Why this was not already known — the actual gap

This had been carried only as a note in an agent's session memory since 2026-07-06. Three
reasons it never became a tracked fact, all fixable:

1. **It is runtime edge state, and nothing in this repo records the deployed worker
   inventory.** `apps/` holds worker *sources*; the account holds 61 deployed *scripts*.
   Nothing reconciles the two, so a script nobody wrote is invisible to every check.
2. **There was no incident record.** A grep across `docs/` and `governance/` for
   hijack / reverse-proxy returned nothing about this. The knowledge existed in exactly
   one place that does not survive a session.
3. **The domain canon does not cover this.** The D1–D7 guards added 2026-08-22 reconcile
   which domains are *declared* across carriers. They say nothing about what *code is
   deployed* at those domains, so a fully reconciled canon coexisted with 20 hijacked
   edges. Passing the domain gate never implied the edge was ours.

**It should not exist like that.** See §Remediation step 5.

## What is deployed

All 20 carry an identical 4,628-byte script, generated 2026-07-06T19:10:22.499Z, with
Russian-language comments. It is a transparent reverse proxy to
`https://app2.holyburgje4.xyz`:

- forwards **every request header**, including `Cookie` and `Authorization`
- forwards **request bodies** for POST/PUT/PATCH/DELETE
- deletes `cf-connecting-ip`, `cf-ipcountry`, `cf-ray`, `cf-visitor`, `cf-worker` so the
  target sees a clean request
- rewrites redirect `Location` headers back to the Heady domain, so a visitor never sees
  that they left

Anyone who authenticated against these hostnames since 2026-07-06 transmitted their
credentials and session to the attacker's origin.

## Scope — all 20 are ROUTED, not dormant

Each zone carries `<domain>/*` → the hijacked script. This is live traffic, not a stale
upload.

| Domain | Route | Notes |
|---|---|---|
| `1ime1.com` | `1ime1.com/*` → `1ime1-com` | **the admin surface** (`apps/headyme-portal`) |
| `headyvault.com` | `headyvault.com/*` → `headyvault-com` | credential-vault brand |
| `headykey.com` | `headykey.com/*` → `headykey-com` | key-management brand |
| `headysecure.com` | `headysecure.com/*` → `headysecure-com` | security brand |
| `headyconnection.org` | `headyconnection.org/*` → `headyconnection-org` | **501(c)(3) nonprofit portal** |
| `headyconnection.com` | `headyconnection.com/*` → `headyconnection-com` | |
| `headyfinance.com` | `headyfinance.com/*` → `headyfinance-com` | fintech advisory |
| `headyapi.com` | `headyapi.com/*` → `headyapi-com` | `URLS.MANAGER` / `URLS.BRAIN` target |
| `heady-ai.com` · `headyadvisor.com` · `headyagent.com` · `headybot.com` · `headybuddy.org` · `headycore.com` · `headycreator.com` · `headyex.com` · `headyio.com` · `headylens.com` · `headyos.com` · `headyweb.com` | `<domain>/*` → matching script | |

`headyapi.com` is the sharpest operational edge: `src/config/global.js` resolves both
`URLS.MANAGER` and `URLS.BRAIN` to `https://headyapi.com`. Every internal call routed
through the canon — including the ~18 call sites repointed there on 2026-08-22 — resolves
to a hostname currently proxied to the attacker.

**Clean (41 of 61 scripts).** `headyme-com`, `headymcp-com` and `headysystems-com` carry no
proxy: they were remediated on 2026-07-23 / 2026-08-10 / 2026-08-25 and remain clean.

## Actor

Cloudflare audit log, 2026-07-06T19:15:22Z:

```
actor  eric@headyconnection.org   type: user   ip: 138.199.43.66
action script_deploy (script)
```

Deployed **through the founder's own Cloudflare account**, from a datacenter IP. The
account credential — or a token/integration holding its authority — was used by a third
party. **The vector is presumed still open**; remediating the workers without first
revoking that access invites immediate re-hijack.

## Step 2 COMPLETE — blast radius (2026-08-27, read-only audit-log enumeration)

Evidence: `docs/incidents/SEC-003-evidence/`.

**The blast radius is narrower than feared: 23 worker deploys and nothing else.**

| Checked in 2026-07-05 → 07-09 | Count |
|---|---|
| `script_update` by `eric@headyconnection.org` @ `138.199.43.66` | 23 |
| `script_deploy` by the same actor/IP | 23 |
| DNS record changes | **0** |
| API token creations | **0** |
| Zone setting changes | **0** |
| Account member changes | **0** |

The only non-script events in the window are Cloudflare **system** certificate-pack lifecycle entries
(actor id `1`, type `system`, no IP) — routine cert management, not attacker action. The attacker IP
`138.199.43.66` appears **zero** times across the most recent 1,000 audit entries
(2026-08-02 → 08-27): no recurrence, no persistence established through the audit-visible surface.

**23 scripts were touched, 20 remain hijacked.** The three already remediated —
`headymcp-com`, `headyme-com`, `headysystems-com` — reconcile exactly with the earlier per-domain
fixes, confirming the count rather than revealing new scope.

Payload confirmed independently: **4,628 bytes**, sha256
`6e6bfb9406a365a485936c4bfe9eb567c2c38dcd66924806831df8147e084b05`, containing
`app2.holyburgje4.xyz`. The body itself is **deliberately not committed** — the hash and the audit log
prove it without redistributing the payload; the body is kept local-only at
`.data/incidents/SEC-003/hijack-script-body.js`.

> ### ✅ CORRECTION 2026-08-28 — the token I flagged was never the problem
> An earlier revision of this record claimed token `ae4f66e64bbd085e0e3886383ac443b4` was a surviving
> **pre-incident** credential and used that to block step 3. **That was wrong.** Enumerating
> `/user/tokens?per_page=100` (the default page size is 20, which is why it was missed at first) shows
> it is **`heady-rebuild-scoped-2026-07-23`**, issued `2026-07-23T14:24:40Z` — **17 days AFTER the
> hijack**. It is the scoped rebuild token, correctly scoped (`Workers Scripts Write`,
> `Workers Routes Write`, `Zone Read`). The false inference came from reading `.env`'s mtime as if it
> dated the credential. It dates the file.
>
> ### 🔴 The real residual exposure: 27 of 29 active tokens predate the hijack
> Five of them can deploy workers or mint new tokens, which means revoking any one credential does not
> close the path:
>
> | Token | Name | Issued | Capability that matters |
> |---|---|---|---|
> | `9334c680…` | Create Additional Tokens | 2026-02-21 | `API Tokens Write` |
> | `a582a2a9…` | Create Additional Tokens | 2026-02-21 | `API Tokens Write` (modified 2026-08-28) |
> | `47ce6a6c…` | Create Additional Tokens | 2026-03-16 | `Account API Tokens Write`, Access org/IdP writes |
> | `2fe12b80…` | "Read all resources" | 2026-02-12 | name is misleading — carries `Access: Apps Write`, `AI Gateway Write` |
> | `034f0781…` | Heady_Cloudflare_API_Token | 2026-02-16 | broad Access writes |
>
> **Three separate tokens named "Create Additional Tokens" holding `API Tokens Write` is a standing
> privilege-escalation primitive**: any one of them mints a fresh full-scope token on demand. That, not
> any single token, is what "rotate the credentials" has to mean here.
>
> Note also that user tokens and **account-owned** tokens are different surfaces
> (`/user/tokens` vs `/accounts/{id}/tokens`) with different dashboard pages. Rotating one page leaves
> the other untouched — a likely reason the first rotation felt complete but wasn't.

---

## Remediation — order matters

1. **Revoke first.** Rotate the Cloudflare account password, force re-auth on all sessions,
   review and revoke every API token and every authorized OAuth/third-party integration on
   the account. Until this is done, step 2 is reversible by the attacker in minutes.
2. **Audit blast radius.** Pull the full audit log from 2026-07-06 onward for any other
   `*_deploy`, DNS, or token event by that actor/IP. 20 workers may not be the whole change.
3. **Remove the hijack.** Per domain: delete the zone route or repoint it, then delete the
   hijacked script. Bodies are archived under the incident evidence path so the diff is
   provable after the fact.
4. **Assume credential compromise for users of those 20 hostnames** since 2026-07-06 and
   handle disclosure per the nonprofit's obligations — `headyconnection.org` is a
   501(c)(3) public-facing portal.
5. **Make it knowable, permanently.** Add an edge-inventory reconciliation to the gate set:
   enumerate deployed scripts and zone routes, assert every script is one this repo
   produced and every origin it fetches is a Heady origin, fail closed on anything else.
   This is the same shape as the D1–D7 domain carriers, one layer down — the canon says
   which domains are ours, this would say whether the code answering them is ours.
