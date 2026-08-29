<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ Activity Record — the living state of the work            ║
║  Made with ❤️ by HeadySystems Inc.                                ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# Heady Activity Record

**Living document — a stable path that is always current.** Updated 2026-08-28.
Branch `checkpoint/rebuild-substrate-2026-07-23` @ `6909f642a6`.

> **Why this exists and is not a twelfth status surface.** Three record types, three jobs:
> `docs/handoff/HANDOFF-*.md` is agent→agent catch-up since a checkpoint (dated, immutable).
> `docs/activity/*` holds point-in-time run snapshots (dated, immutable). Neither answers
> *"what is being worked on right now, what needs me, what next"* — they are append-only
> history. **This file is the one mutable, human-facing record**, at a path that never
> changes. Agents update it in place; they do not add siblings.

---

## 🔴 Your queue — manual only

Ranked. Each has a full procedure because none of them can be done by an agent.

### M1 · Roll the Cloudflare **Global API Key** — the one thing still gating SEC-003

**Status 2026-08-28: rotation is INCOMPLETE, and the gap is specific.** SEC-003 steps 2
(blast radius) and 5 (edge-inventory gate) are done; step 3 (removing the 20 hijacked
workers) is written and staged in `scripts/sec-003-remove-hijack.sh` but deliberately
**not executed**, because deleting the hijack while a live credential survives just invites
a redeploy.

Two credentials in this checkout's `.env` are still live right now:

| Credential | State | Why it matters |
|---|---|---|
| **`CLOUDFLARE_API_KEY` (Global API Key)** + `CLOUDFLARE_EMAIL` | ⚠ **LIVE** — `/user` returns 200 for `eric@headyconnection.org` | **Prime suspect.** A Global API Key authenticates *as the user*, producing exactly the audit signature the attacker left: `actor.type: "user"`, the account email, no token id, `interface: ""`. It is account-wide with full permissions, **a password change does NOT revoke it**, and it does **not** appear on the API Tokens page. |
| `CLOUDFLARE_API_TOKEN` id `ae4f66e64bbd085e0e3886383ac443b4` | ⚠ **active**, HTTP 200 on `workers/scripts` | Scoped, and a scoped token would have shown a token actor in the log — so probably not the vector, but it predates rotation, so roll it too. |

**Do this:**

1. **Roll the Global API Key — this is the step that was missed.**
   → https://dash.cloudflare.com/profile/api-tokens → scroll past *API Tokens* to the
   **API Keys** section at the bottom → **Global API Key** → **Change**.
   *This section is separate from API Tokens and is why a password rotation felt complete.*
2. **Roll the scoped token** `ae4f66e64bbd085e0e3886383ac443b4` on the same page.
3. **Update both** in `.env` and in GCP Secret Manager →
   https://console.cloud.google.com/security/secret-manager?project=heady-ai
4. **Confirm the old ones are dead** — I will run this and paste the result:
   ```bash
   cd ~/Heady-AI && set -a && . ./.env && set +a
   curl -s -H "X-Auth-Email: $CLOUDFLARE_EMAIL" -H "X-Auth-Key: $CLOUDFLARE_API_KEY" \
     https://api.cloudflare.com/client/v4/user | head -c 120     # expect success:false on the OLD key
   curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     https://api.cloudflare.com/client/v4/user/tokens/verify | head -c 120
   ```
5. **Then tell me** and I run `scripts/sec-003-remove-hijack.sh` — all 20 routes and scripts,
   with verification per domain.

**Good news from step 2:** blast radius is smaller than feared. In 2026-07-05..09 that actor
performed 23 script updates/deploys and **nothing else** — zero DNS changes, zero token
creations, zero zone-setting or member changes. The IP appears zero times in the most recent
1,000 audit entries, so there is no recurrence. 20 remain hijacked; the other 3 were already
fixed and reconcile exactly.

---

### M2 · ~~Sign the ADR acceptance ceremony~~ ✅ DONE 2026-08-23

Signed: tags `adr-0053-accepted-dfdd2bc87` and `adr-0054-accepted-dfdd2bc87`; ADR-0054 is
`Status: Accepted (2026-08-23)`. The domain-canon work is no longer governance-pending, and
genesis STEP 1 (S0) is satisfied. Original procedure kept below for the next ceremony.

<details><summary>original procedure</summary>


**Why it matters:** three ADRs sit `Proposed`. ADR-0054 governs the domain-canon work
already merged, which its own text says "remains governance-pending until this ADR is
accepted." ADR-0053 is **STEP 1 of the approval-genesis runbook** — the first of five
remaining human steps before `packages/bees` (the entire HeadyBee/HeadySwarm runtime,
currently absent from the repo) can be built at all.

**Only you can do this.** The ceremony signs git tags with your OpenPGP key
(`1050B59E7296C46C26DDF95DA7D2108BB3C6101C`). gpg prompts for the passphrase — that prompt
is the human factor. ADR-0031 §2 reserves the founder signature to the founder; ADR-0052
§1–2 says an ADR status change is not authorizable through the agent channel; and
`docs/adr/README.md` records commit `91059537a4` being **voided** in `c48062fc61` for
asserting acceptance without a verifiable founder act.

1. **Read what you are signing.** ADR-0054 §Decision and §Consequences —
   `docs/adr/0054-domain-canon-carrier-closure.md`. It authorizes a bounded, one-time
   exception to the ADR immutability rule (removing `headytrade` from two *accepted*
   snapshots, at your direction on 2026-08-22). I re-pinned its content hash after that
   amendment, so the tamper-check will pass — **that re-pin is not a review.**
2. **Dry-run:** `bash scripts/adr-acceptance-ceremony.sh --check` — writes nothing.
3. **Sign:** type this in the session so the gpg prompt reaches you:
   `! bash scripts/adr-acceptance-ceremony.sh --sign`
   It signs, fail-closed verifies each tag against the key of record, rewrites each
   `Status:` bullet to `Accepted`, runs law-lint + governance-gate, and commits.
4. **Push:** `bash scripts/adr-acceptance-ceremony.sh --push`
5. Tell me, and I will update the `docs/adr/README.md` status paragraph and close out.

</details>

---

### M3 · Approval genesis — four human steps after M2

Runbook: `docs/runbooks/APPROVAL_GENESIS_FOUNDER_RUNBOOK.md`. Six of eleven steps were
completed 2026-08-22 (gcloud reauth, ARBITER key provisioned, migration chain proven on a
throwaway Neon branch, Artifact Registry image built, deployment manifest written). What
remains is not code:

| Step | What | Where |
|---|---|---|
| **S1** | Decide the founder-key IAM boundary | https://console.cloud.google.com/iam-admin/iam?project=heady-ai · service accounts: https://console.cloud.google.com/iam-admin/serviceaccounts?project=heady-ai |
| **S4** | Neon runtime login | https://console.neon.tech |
| **S8** | Gate report + security review + manifest + **a second signature** | runbook §STEP 8 |
| **S9** | The one-time genesis transaction | runbook §STEP 9 |

Only then does STEP 10 open HCP-0003 and the bee runtime. Read the runbook step bodies
before each — they carry the exact commands and the order-sensitivity.

---

### M4 · Three decisions I cannot make for you

| # | Decision | Consequence of deciding | Cost of not |
|---|---|---|---|
| **D1** | Brand architecture (`entity` / `tenant` / `revenue` / `layer`) for the 6 unratified domains — `headysystems.com`, `headybuddy.org`, `headyio.com`, `headyapi.com`, `headybot.com`, `headylens.com` | They join `src/config/domain-registry.js`; AD-5 closes | Registry stays a 10-of-16 subset. Low urgency, no breakage |
| **D2** | Which third-party OAuth providers are approved | Collapses **78 of 156** remaining hygiene findings in one call | The domain-hygiene report stays half noise, so people stop reading it |
| **D3** | `scripts/heady-mcp-http-headers.test.mjs` — restore the v1.1.0 helper it tests, or delete the test | Working tree goes clean | An orphaned failing test sits untracked forever |

---

## ⏸ Blocked on the above

| Work | Blocked by |
|---|---|
| Remove the 20 hijacked workers + routes | **M1** (revoke first, or it gets redone) |
| `docs/adr/README.md` status paragraph → 0054/0053 Accepted | **M2** |
| `packages/bees` / HeadyBee-HeadySwarm runtime (HCP-0003) | **M2 → M3** |
| `src/config/domain-registry.js` growing past 10 entries | **D1** |

---

## 🤖 Agent queue — no approval needed, say go

1. **Law 0 step 5** — close the CI blind spot permanently. Teach
   `tooling/enforcers/lib/rules.mjs` to skip comment-only matches and caller-IP comparisons
   (it currently flags `ip === '127.0.0.1'`, the *opposite* of dialling out, and flags the
   comments documenting the fixes); fix 4 real env fallbacks (`rate-limiter.js:10`,
   `redis-connection-pool.js:16`, `daw-mcp-bridge.js:30`, `vsa/swarm.py:217`); then extend
   `SCAN_DIRS` to `src/`. Fully specified in
   `docs/LAW0_LOOPBACK_TRIAGE_2026-08-22.md` §"Step 5 status".
2. **Edge-inventory reconciliation** — the gate that would have caught SEC-003 on day one:
   enumerate deployed Workers + zone routes, assert every script is one this repo produced
   and every origin it fetches is a Heady origin, fail closed otherwise. Same shape as the
   D1–D7 domain-carrier guards, one layer down. *This is the structural fix for "why wasn't
   that known".*
3. **Rotate the `.env` Cloudflare token into GCP Secret Manager** once M1 step 4 is done.

---

## ✅ Recently landed

| Commit | What |
|---|---|
| `6909f642a6` | Handoff bundle `3ff51666f5 → 536d39c8a1`, 9/9 gates |
| `536d39c8a1` | Re-pinned ADR-0054 hash after its founder-directed amendment |
| `944c55ee5c` | **LAW-0 42 → 0.** 24 Category A sites fixed, 6 dead Ollama paths deleted, 11 misleading banners corrected, 7 exempted with recorded reasons |
| `d547fceadb` | Scrubbed `headytrade` from both accepted ADR snapshots under a bounded ADR-0054 exception |
| `b7e8cbb21b` | Quarantined 19 dead domain configs; hygiene report 422 → 197 and made legible |
| `5c1bcf407b` | Made D6 able to fail (it was comparing the projection to itself); added D7 |
| `553b73fd25` | Closed the domain canon over all 5 carriers; D1–D7 guards; 16-node canon |
| `60ee5f58f6` | Retired `headytrade` for `headyfinance` |

Also found and verified **not** a problem, so it stops resurfacing: the `AIzaSy…` in
`apps/headyme-portal/src/services/firebase.js` is the Firebase **web config** — a public
client-side identifier beside `projectId`/`appId`/`authDomain`, not a secret. `secret-scan`
passes; the enforcer's own test uses that exact string as a fixture.

---

## Best next directions

1. **M1.** An active credential-interception proxy on 20 domains, including your admin
   surface, your vault brand, and a 501(c)(3) public portal, outranks everything else here.
2. **M2.** One command. Unblocks the merged domain work from governance-pending and opens
   the genesis chain.
3. **Agent queue #2** (edge-inventory gate). The reason SEC-003 ran 51 days unseen is that
   nothing reconciles deployed edge code against this repo. Everything else on this list is
   cleanup; this one changes what the system can know about itself.
4. **M3**, then **Law 0 step 5**, then **D2**, then **D1/D3**.
