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
