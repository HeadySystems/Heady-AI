<!-- HEADY_BRAND:BEGIN
Heady™ Edge Inventory Gate v1.0.0
Made with ❤️ by HeadySystems Inc.
HEADY_BRAND:END -->

# @heady/edge-inventory

**SEC-003 remediation step 5.** The domain canon (`tooling/coherence` D1–D7) reconciles which domains
are *declared* across carriers. It says nothing about what *code is deployed* at those domains — which
is how a fully reconciled canon coexisted with 20 hijacked edges for 51 days.

This gate closes that layer: it enumerates deployed Cloudflare Worker scripts and asserts every one is
accounted for by `configs/edge-inventory.json`.

```bash
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… node tooling/edge-inventory/bin/check-edge.mjs
node tooling/edge-inventory/bin/check-edge.mjs --json     # machine-readable
```

Exit `0` clean · `2` failed. **A missing credential exits 2, not 0** — "cannot check" must never read
as "checked and clean".

## Inventory states

| Status | Meaning | Gate |
|---|---|---|
| `active` | a wrangler config in this repo produces it | pass |
| `unprovenanced` | deployed, but no repo config produces it; acknowledged triage backlog | pass, counted |
| `quarantined` | known-hostile, pending deletion | **fail** |
| *(absent)* | nothing in the repo accounts for it | **fail** |

Absence fails by construction: silence is not approval.

## Current state (seeded 2026-08-27 from live enumeration)

61 deployed scripts — **8 active · 33 unprovenanced · 20 quarantined**. The 20 are the SEC-003
reverse-proxy deployment, all sharing etag `f6f727d4d623…`, all modified 2026-07-06T19:13–19:15Z and
unchanged since.

**Do not delete the quarantined scripts before SEC-003 step 1** (Cloudflare credential rotation).
Deleting first is reversible by the attacker in minutes.

The 33 `unprovenanced` entries are a real finding, not a rubber stamp: a third of the account's edge
code has no source in this repository. Each needs its source identified, then a move to `active` or
deletion.
