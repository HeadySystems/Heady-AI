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

### M1 · ~~SEC-003~~ ✅ **CONTAINED 2026-08-28**

Global API Key rolled by the founder; hijack removed and independently verified.
`scripts/sec-003-remove-hijack.sh --apply` deleted 20 apex routes then 20 scripts (account
61 → 41), leaving the clean `www.*` routes on `worker-heady-router` untouched. All 41
survivors were re-fetched and grepped: **zero contain `app2.holyburgje4.xyz`**. Affected
hostnames now return a default origin page, not the attacker. `check-edge.mjs`: clean.

**Three residuals moved to your queue as M5.** Full detail in
`docs/incidents/SEC-003-cloudflare-worker-hijack.md` §Remaining.

---

### M5 · SEC-003 residuals

1. ~~**Roll any API token predating 2026-07-06 that carries `API Tokens Write`.**~~ **Mostly
   done 2026-08-28.** They *are* enumerable — with the **Global API Key**
   (`X-Auth-Email` + `X-Auth-Key`), not an account-scoped token, and across **two** surfaces:
   `/user/tokens` and `/accounts/{id}/tokens`. `/user/tokens` also defaults to `per_page=20`
   while the account holds 25, which is why the first sweep looked complete and was not.

   Five carried `API Tokens Write`. **Four revoked**, chosen on `last_used_on` rather than
   guesswork:

   | Token | Name | Last used | Action |
   |---|---|---|---|
   | `ae1afddb…` | lingering-waterfall-ec0a | **never** | revoked |
   | `9334c680…` | Create Additional Tokens | 2026-02-21 | revoked |
   | `47ce6a6c…` | Create Additional Tokens | 2026-03-16 | revoked |
   | `034f0781…` | Heady_Cloudflare_API_Token | 2026-03-25 | revoked |
   | `a582a2a9…` | Create Additional Tokens | **2026-08-24** | **HELD — in active use** |

   Active tokens 29 → 25; token-minting credentials 5 → 1.

   **`a582a2a9d0fbc6b94fb76e8f70babeb3` is yours to close.** It was used four days ago, so
   something depends on it, and it predates the hijack. Identify the consumer, then **roll**
   it (new secret, same id) rather than revoking — revoking breaks whatever that is.

   **The remaining 19 were revoked 2026-08-28** once the permission gate was lifted: all 17
   Cloudflare tunnel tokens (evidence first — all 8 tunnels are `down`/`inactive` with **zero
   connections**, and 13 of the tokens had *never* been used, so nothing broke),
   `ed8599fbff6d…` **Heady Workers Route Write Token** (route write is the hijack primitive,
   idle 6 months) and `2fe12b800216…` **"Read all resources"** (misleadingly named — it held
   `Access: Apps Write` and `AI Gateway Write`, idle 6 months). 19 revoked, 0 failed.

   **Account surface: 29 active tokens → 6.** What remains:

   | Token | Issued | Last used | Keep because |
   |---|---|---|---|
   | `ae4f66e6…` heady-rebuild-scoped | 2026-07-23 | 2026-08-29 | post-hijack, correctly scoped, in active use |
   | `a582a2a9…` Create Additional Tokens | 2026-02-21 | 2026-08-24 | ⚠️ **the last token-minter — yours to roll** |
   | `51d7e448…` Edit zone DNS | 2026-02-17 | 2026-03-16 | DNS-write breakage is high-impact |
   | `9e110941…` Cache Purge | 2026-02-21 | 2026-02-21 | low privilege, may serve CI |
   | `26c0cf5a…` Pages Read | 2026-02-21 | 2026-02-21 | low privilege, may serve CI |
   | `fe014f83…` Zone Debug | 2026-02-21 | 2026-02-21 | low privilege, may serve CI |

   Four of the six predate the hijack and are idle; they were kept on purpose rather than
   swept, but each still wants a deliberate keep-or-retire call from you.
2. **Decide on 33 unprovenanced Workers.** The gate accepts them because they are *declared*,
   but this repo cannot prove it produced them — the same blind spot as SEC-003, narrower.
   Either provenance them to a source path or retire them. I can produce the list and a
   proposed disposition per script on request.
3. **Disclosure call.** Anyone who authenticated against those 20 hostnames between
   2026-07-06 and 2026-08-28 sent credentials to the attacker. `headyconnection.org` is a
   501(c)(3) public portal, so this is a compliance decision, not a technical one.

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
| **S1** | Decide the founder-key IAM boundary | **full procedure below** |
| **S4** | Neon runtime login | https://console.neon.tech |
| **S8** | Gate report + security review + manifest + **a second signature** | runbook §STEP 8 |
| **S9** | The one-time genesis transaction | runbook §STEP 9 |

#### S1 in full — the founder-key IAM boundary

**The decision, plainly.** `roles/cloudkms.signerVerifier` on the `founder-evidence` KMS key
is currently held by `user:eric@headyconnection.org` — *the identity this machine's agent
sessions authenticate as*. So today, an agent session on this box can sign founder evidence.
That is the same shape as every other finding this week: a control that is not a control if
an agent can reach it. S1 is the decision to move signing to an identity that only exists on
a device with no agent session.

**⚠️ Run every command yourself.** The runbook is explicit that an agent must not touch IAM
on your signing key, and the revoke will lock this session out of the key — which is the
point, and the proof it worked.

Resolved values (no placeholders): project `heady-ai` · keyring `heady-approval` ·
location `global` · key `founder-evidence`.

**0. Re-auth — gcloud is expired on this box.** I hit `Reauthentication failed. cannot
prompt during non-interactive execution` trying to read the policy:
```bash
gcloud auth login
```

**1. Read the current binding** before changing anything:
```bash
gcloud kms keys get-iam-policy founder-evidence \
  --keyring=heady-approval --location=global --project=heady-ai
```
Expect `user:eric@headyconnection.org` with `roles/cloudkms.signerVerifier`.

**2. Decide**, then run the matching branch.

*Branch A — move signing off the agent-reachable identity (what the runbook recommends):*
```bash
gcloud kms keys remove-iam-policy-binding founder-evidence \
  --keyring=heady-approval --location=global --project=heady-ai \
  --member=user:eric@headyconnection.org --role=roles/cloudkms.signerVerifier

gcloud kms keys add-iam-policy-binding founder-evidence \
  --keyring=heady-approval --location=global --project=heady-ai \
  --member=user:eric@headysystems.com --role=roles/cloudkms.signerVerifier
```
Do the `add` from the clean device, or at least confirm you can authenticate as
`eric@headysystems.com` there **before** the `remove` — otherwise you are locked out of your
own signing key with no path back except project-owner recovery.

*Branch B — accept the current boundary.* Legitimate for a solo founder, but then record it:
the ADR-0031 threat model assumes the signing identity is not agent-reachable, so accepting
B means amending that assumption in writing rather than leaving it implicitly violated.

**3. Verify the move took** — re-run the step 1 read. From *this* machine, Branch A should
now FAIL with a permission error on the key. That failure is the success signal.

**Console:** <https://console.cloud.google.com/security/kms/keyring/manage/global/heady-approval?project=heady-ai>

**Then tell me which branch**, and I will record it in the runbook and the incident-adjacent
governance notes, and move on to S4 (Neon runtime login).

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
2. ✅ **DONE 2026-08-28 — byte-pin sweep guard.** `tooling/byte-pins` registers every path
   whose bytes are bound elsewhere and exits 2 with the re-pin command.
   `node tooling/byte-pins/bin/byte-pins.mjs check --staged`. Replayed against the branding
   sweep it flags all three things that broke: `approval-policy`, `projection-sources`,
   `adr-ceremony`. **Not wired into a hook** — that needs your approval; say the word and
   I will add it to the pre-commit gate.
3. **Edge-inventory reconciliation** — the gate that would have caught SEC-003 on day one:
   enumerate deployed Workers + zone routes, assert every script is one this repo produced
   and every origin it fetches is a Heady origin, fail closed otherwise. Same shape as the
   D1–D7 domain-carrier guards, one layer down. *This is the structural fix for "why wasn't
   that known".*
4. **Rotate the `.env` Cloudflare token into GCP Secret Manager.**

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
