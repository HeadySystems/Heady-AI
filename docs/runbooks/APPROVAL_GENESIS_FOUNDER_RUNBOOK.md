<!-- HEADY_BRAND:BEGIN
Heady™ Approval Genesis — Founder Runbook v1.0.0
Made with ❤️ by HeadySystems Inc.
HEADY_BRAND:END -->

# Approval Genesis — Founder Runbook

- **Status:** Operational runbook · created 2026-08-22
- **Purpose:** Everything only a human can do to make the approval control plane live, so HCP-0003
  (the `packages/bees` / HeadyBee-HeadySwarm runtime) can be submitted at all.
- **Authority:** `docs/adr/0031-solo-founder-approval-bootstrap.md` (Accepted, founder-signed tag
  `adr-0031-accepted-e064a8943`) · `docs/design/APPROVAL_SERVICE_BOOTSTRAP_SPEC.md` ·
  `apps/approval-api/README.md`
- **Blocked proposal:** `docs/hcp/HCP-0003-bee-swarm-runtime.md`

> **Bottom line.** The approval system is ~90% built and further along than HCP-0003's draft text
> says. What remains is not code — it is nine external actions on GCP, Neon, and Firebase, plus one
> signature. Nothing in `packages/bees` may be created until they are done. Three of them
> (**S0**, **S1**, **S2**) are open governance decisions rather than setup, and S0 is order-sensitive:
> it gets harder to make once genesis closes.

---

## 0. Copy-paste execution sequence (all real values, in order)

Every value below is live-verified, not a placeholder. Sections S0–S9 explain *why* each step exists;
this section is what you actually run. **Reason for each step is one line — skip a step only by
deciding to, not by missing it.**

### Environment — paste once per shell

```bash
cd /home/headyme/Heady-AI

export HEADY_PROJECT=heady-ai
export HEADY_REGION=us-east1                     # canonical per 93dbe68084
export HEADY_KEYRING=heady-approval
export HEADY_KMS_LOCATION=global                 # the keyring is global, NOT regional

export FOUNDER_KEY=projects/heady-ai/locations/global/keyRings/heady-approval/cryptoKeys/founder-evidence/cryptoKeyVersions/1
export RECEIPT_KEY=projects/heady-ai/locations/global/keyRings/heady-approval/cryptoKeys/receipt-signing/cryptoKeyVersions/1
export ARBITER_KEY=projects/heady-ai/locations/global/keyRings/heady-approval/cryptoKeys/arbiter-attestation/cryptoKeyVersions/1
```

Known-good fingerprints — anything else means you are on the wrong key version:

| Key | `publicJwkFingerprint` |
|---|---|
| `founder-evidence` v1 | `0f7753c16b03420af64a6415a746239d67a3e64a88c9177bca27c29b56a378ed` |
| `receipt-signing` v1 | `e9dfdcb1cd80f69a010e6e1b24daf0447a0074f72c7065d4f45bad7a8cbc64ba` |
| `arbiter-attestation` v1 | does not exist yet — created in S3 |

### STEP 0 — reauthenticate gcloud ✅ DONE 2026-08-22

`gcloud projects describe heady-ai` now returns `heady-ai  1003436179562`. Re-run the block below only
if a later step fails with *"Reauthentication failed. cannot prompt during non-interactive
execution."* — the session credential expires and no GCP step works until it is renewed
interactively.

In Claude Code, prefix with `!` so the output lands in the session:

```
! gcloud auth login
```

Then confirm you are on the intended account and project:

```bash
gcloud config set account eric@headyconnection.org --quiet   # or your ceremony identity, see S1
gcloud config set project heady-ai --quiet
gcloud projects describe heady-ai --format='value(projectId,projectNumber)'
```

Expected: one line, `heady-ai` plus the numeric project number. If this errors, stop — everything
after it will fail with the same message.

### STEP 1 — accept ADR-0053, or explicitly decide not to (S0)

Do this **before** genesis. After genesis, amending the quorum needs the external human reviewer that
ADR-0053 exists to waive.

PR **288** — <https://github.com/HeadySystems/Heady-AI/pull/288> — is **MERGED**
(2026-08-22T21:02:25Z, commit `52391ea71e`), so ADR-0053 is now on the checkpoint branch and reachable
from HEAD. Its file SHA-256 is unchanged at `dd2974ec…1523`. Status is still `Proposed` — merging the
PR published the text; it did not accept it.

**ADR-0052 was declined by the founder on 2026-08-22** to minimize governance friction and maximize
intelligent automation. It stays `Proposed` and is excluded from the ceremony. Consequence to hold
consciously: the anti-injection rule it would have codified is not in force, so the
`cloudflare-mass-hijack-2026-07-06` credential/tool vector has no governance-layer mitigation — an
injected instruction and a genuine one remain indistinguishable to a receiving agent. ADR-0031 §2 and
ADR-0013 still bar an agent from producing a founder signature, which is the one control that does
not depend on 0052.

```bash
# Read it first — this is the thing you are ratifying, 107 lines.
gh pr view 288 --repo HeadySystems/Heady-AI
sed -n '1,120p' /tmp/heady-solo-founder-governance-20260822/docs/adr/0053-temporary-solo-founder-approval-quorum.md
```

Bindings to record in the acceptance record (ADR-0053 §Activation boundary requires them):

| Field | Value |
|---|---|
| ADR-0053 authoring commit | `67218fe4ba450851171598bb652c5c110356c172` |
| ADR-0053 file SHA-256 | `dd2974ec7e94adcbadda2abe310988fba0f6d1d5c6de981af6c53ff6a38d1523` |
| Branch | `governance/solo-founder-quorum-amendment-20260822` |
| Hard expiry to record | `2026-11-19T23:59:59Z` (`FIB[11]` = 89 days) |
| Founder key fingerprint | `0f7753c16b03420af64a6415a746239d67a3e64a88c9177bca27c29b56a378ed` |
| ARBITER key fingerprint | pending S3 |

Your signing setup is already correct and needs no flags — `git config user.signingkey` is
`C3050E4C4D0C9162` (primary `727C4B1BABDA056BABA44095C3050E4C4D0C9162`), and gpg automatically signs
with its `[S]` subkey `A7D2108BB3C6101C`, fingerprint
`1050B59E7296C46C26DDF95DA7D2108BB3C6101C` — **the same key that signed
`adr-0031-accepted-e064a8943` and `adr-0051-accepted-53d3e63ca`**. `commit.gpgsign` is already `true`.

**The whole ceremony is now one command** — `scripts/adr-acceptance-ceremony.sh` signs ADR-0053 and
ADR-0054, verifies each tag against the key of record, and writes the acceptance bullets:

```bash
bash scripts/adr-acceptance-ceremony.sh --check    # read-only; already passes
bash scripts/adr-acceptance-ceremony.sh --sign     # gpg prompts twice — that prompt IS the control
bash scripts/adr-acceptance-ceremony.sh --push
```

⚠️ Before signing ADR-0054, read its amended §Decision. On 2026-08-22 (`d547fceadb`) it grew a
**bounded, founder-authorized exception to the ADR immutability rule** — the `headytrade` token was
removed from the ADR-0033 snapshot table and the frozen legacy `docs/ADR/0019` copy, so those two
accepted records are no longer byte-identical to their accepted-time state. The ADR states that cost
explicitly rather than hiding it, and the exception is scoped to that single token in those two files.
Its hash is re-pinned to `c89b96ba…10a1` in the ceremony script; signing attests to the amended text.

The manual equivalent, if you prefer to drive it yourself:

```bash
gh pr merge 288 --repo HeadySystems/Heady-AI --merge          # or --squash, your call
git fetch origin && git checkout checkpoint/rebuild-substrate-2026-07-23 && git pull --ff-only

ACCEPTED=$(git rev-parse HEAD)
git tag -s "adr-0053-accepted-$(git rev-parse --short=9 HEAD)" -m \
"Founder acceptance: ADR-0053 Temporary Solo-Founder Approval Quorum; \
accepted object $(git rev-parse --short=9 HEAD); \
ADR commit 67218fe4ba450851171598bb652c5c110356c172; \
ADR sha256 dd2974ec7e94adcbadda2abe310988fba0f6d1d5c6de981af6c53ff6a38d1523; \
temporary-mode hard expiry 2026-11-19T23:59:59Z"

git tag -v "adr-0053-accepted-$(git rev-parse --short=9 HEAD)"   # expect: Good signature, EDDSA key 1050B59E…101C
git push origin "adr-0053-accepted-$(git rev-parse --short=9 HEAD)"
```

Then flip the ADR's own `Status:` line from `Proposed` to `Accepted` with the tag name, the way
ADR-0031 records its acceptance — an unrecorded tag is not an acceptance anyone can find later.

**If you decide NOT to accept:** say so and the runbook's §5 table stands as written — but then
budget for recruiting an external security reviewer before any post-genesis approval-system change.

### STEP 2 — decide the founder-key IAM boundary (S1)

```bash
gcloud kms keys get-iam-policy founder-evidence \
  --keyring="$HEADY_KEYRING" --location="$HEADY_KMS_LOCATION" --project="$HEADY_PROJECT"
```

Currently returns `user:eric@headyconnection.org  roles/cloudkms.signerVerifier` — the identity this
machine's agent sessions hold. To move signing to a host with no agent session:

```bash
# Revoke from the agent-reachable identity
gcloud kms keys remove-iam-policy-binding founder-evidence \
  --keyring="$HEADY_KEYRING" --location="$HEADY_KMS_LOCATION" --project="$HEADY_PROJECT" \
  --member=user:eric@headyconnection.org --role=roles/cloudkms.signerVerifier

# Grant to the ceremony identity you will authenticate as on the clean device
gcloud kms keys add-iam-policy-binding founder-evidence \
  --keyring="$HEADY_KEYRING" --location="$HEADY_KMS_LOCATION" --project="$HEADY_PROJECT" \
  --member=user:eric@headysystems.com --role=roles/cloudkms.signerVerifier
```

⚠️ Run this yourself. An agent must not touch IAM on your signing key, and revoking the binding your
current shell depends on will lock this session out of the key — which is the point.

**Console:** <https://console.cloud.google.com/security/kms/keyring/manage/global/heady-approval?project=heady-ai>

### STEP 3 — ARBITER key and workload identity ✅ PROVISIONED 2026-08-22

Done, verified live:

| Resource | State |
|---|---|
| `arbiter-attestation` crypto key | created, `ASYMMETRIC_SIGN` / `EC_SIGN_ED25519` |
| version `1` | `ENABLED` |
| `heady-arbiter@heady-ai.iam.gserviceaccount.com` | created, enabled, **zero user-managed keys** |
| IAM on `arbiter-attestation` | exactly one binding — that SA, `roles/cloudkms.signerVerifier` |
| Public JWK | `configs/keys/approval/arbiter-attestation.public.jwk.json` |
| `publicJwkFingerprint` | `cc7151dd68a5bd20364c28753ad2689678b2646e9891c6705dc1bd3777c076b8` (recomputed from the committed file) |

`--arbiter-public-jwk` is now satisfiable. That was the input blocking `genesis:prepare` outright.

> ### ⚠️ ARBITER is provisioned but NOT yet independent — decide this before activating ADR-0053
>
> The SA's own IAM policy is empty (nobody holds `serviceAccountTokenCreator` on it directly), but
> project-level `roles/owner` carries `iam.serviceAccounts.getAccessToken`, and the owner list is:
>
> ```
> roles/owner  user:eric@headyconnection.org
> roles/owner  serviceAccount:firebase-adminsdk-fbsvc@heady-ai.iam.gserviceaccount.com
> ```
>
> So `eric@headyconnection.org` — **the identity this machine's agent sessions authenticate as, and the
> same identity that currently holds `signerVerifier` on `founder-evidence`** — can impersonate
> `heady-arbiter` and mint an ARBITER attestation. One principal, both evidence classes. That is the
> manufactured independence ADR-0031 §1 rejects, and ADR-0053's entire quorum rests on ARBITER being
> *separately authenticated*. Activating 0053 without fixing this makes the second channel decoration.
>
> **FOUNDER DECISION 2026-08-22 — owner-impersonation ACCEPTED as residual risk.** Option 2 below was
> chosen deliberately, not by omission. This paragraph is the activation record ADR-0053 requires.
>
> What was accepted, stated precisely so a later auditor sees the shape of the risk:
> `user:eric@headyconnection.org` holds project `roles/owner` and can therefore mint an ARBITER
> attestation by impersonating `heady-arbiter`, while also holding `signerVerifier` on
> `founder-evidence`. Under ADR-0053's `solo_founder` quorum — founder decision **plus** ARBITER
> `ALLOW` and no external human — a single compromised or coerced principal can consequently satisfy
> **both** required evidence classes for an approval-system or protected-migration change. The typed
> quorum still records the two classes truthfully (ADR-0053 §4 is not violated); what is reduced is the
> *independence* of the second one.
>
> Mitigations that remain in force and are worth not losing: the ARBITER key has exactly one IAM
> binding and zero user-managed keys; every attestation is bound to an exact diff/payload/policy hash
> with a nonce and a φ×5-minute expiry; escalation and binding drift fail closed; and the mode
> self-expires 2026-11-19T23:59:59Z, at which point ADR-0031's external-human requirement resumes
> automatically.
>
> Options not taken:
> 1. **Bind ARBITER to a workload, not a human** — run it as a named Cloud Run service or CI job via
>    Workload Identity Federation, keeping `roles/owner` off the ceremony identity. Still the correct
>    end state; revisit when a second human or a dedicated ARBITER runtime exists.
>
> Deliberately **not** changed by an agent: project-level owner bindings are yours.

> ### 🔴 Separate finding, worse than the above — an owner-level service account with 5 exported keys
>
> `firebase-adminsdk-fbsvc@heady-ai.iam.gserviceaccount.com` holds **`roles/owner` AND
> `roles/iam.serviceAccountTokenCreator`** at project level, and has **5 user-managed keys that never
> expire** (`validBeforeTime: 9999-12-31`), created 2026-03-15, 03-16, 03-19, and two on 2026-06-17.
>
> Any holder of any one of those five JSON files is project owner on `heady-ai`. That means they can
> impersonate `heady-arbiter`, grant themselves `signerVerifier` on `founder-evidence`, read every
> secret, and rewrite the approval service after genesis. This defeats the entire genesis trust model
> before it starts, and it intersects the open SEC-001 exposure (live GCP SA keys found in the
> dropzone) and the still-unexplained `cloudflare-mass-hijack-2026-07-06` credential vector.
>
> Recommended before genesis, in this order:
> 1. Inventory which of the five key IDs are in use and by what. 2. Rotate/replace those consumers with
> WIF or a least-privilege SA. 3. `gcloud iam service-accounts keys delete <KEY_ID>
> --iam-account=firebase-adminsdk-fbsvc@heady-ai.iam.gserviceaccount.com` for each. 4. Strip
> `roles/owner` and `roles/iam.serviceAccountTokenCreator` from that SA, leaving only the Firebase
> Admin scopes it actually needs.
>
> Key deletion is destructive and will break whatever authenticates with it — inventory first. Not
> performed by an agent.
>
> **Scope note:** the founder's 2026-08-22 acceptance of *owner-impersonation* covers the ARBITER
> independence question above. It does **not** cover this finding, which is a different and larger
> exposure: five exportable, never-expiring owner credentials are five copies of the whole trust root,
> held by whoever has the files, not by a principal you can name. This item remains OPEN.

The commands that produced the state above, for the record:

```bash
gcloud kms keys create arbiter-attestation \
  --keyring="$HEADY_KEYRING" --location="$HEADY_KMS_LOCATION" --project="$HEADY_PROJECT" \
  --purpose=asymmetric-signing --default-algorithm=ec-sign-ed25519

gcloud iam service-accounts create heady-arbiter \
  --display-name="HEADY ARBITER attestation workload" --project="$HEADY_PROJECT"

# Independence: the ARBITER key is signable ONLY by the ARBITER workload, never by your user account.
gcloud kms keys add-iam-policy-binding arbiter-attestation \
  --keyring="$HEADY_KEYRING" --location="$HEADY_KMS_LOCATION" --project="$HEADY_PROJECT" \
  --member=serviceAccount:heady-arbiter@heady-ai.iam.gserviceaccount.com \
  --role=roles/cloudkms.signerVerifier

# Verify: exactly one binding, to the service account, algorithm EC_SIGN_ED25519, state ENABLED
gcloud kms keys versions list --key=arbiter-attestation \
  --keyring="$HEADY_KEYRING" --location="$HEADY_KMS_LOCATION" --project="$HEADY_PROJECT" \
  --format='table(name,state,algorithm)'

# Export the public JWK and save it BARE (crv/kty/x only) where genesis:prepare expects it
pnpm --filter @heady/approval-api key:public --key-version "$ARBITER_KEY"
```

Take only the `publicJwk` object from that output into
`configs/keys/approval/arbiter-attestation.public.jwk.json`, then confirm the fingerprint matches what
the export printed:

```bash
node -e 'import("./packages/approvals/src/canonical.mjs").then(async m=>{const {readFileSync}=await import("node:fs");process.stdout.write(m.publicJwkFingerprint(JSON.parse(readFileSync("configs/keys/approval/arbiter-attestation.public.jwk.json","utf8")))+"\n")})'
```

### STEP 4 — Neon runtime login (S4)

The role `heady_approval_api` already exists in production; it needs a password and a **pooled** URL.

> ### ⚠️ The "reset the password" flow does NOT work for this role
> Verified 2026-08-22 against the live Neon API. `heady_approval_api` was created by migration `0004`
> with **no password at all**, so Neon refuses to set one this way:
> `422 ROLE_PASSWORD_NOT_AVAILABLE — cannot update password for role without password`. The
> connection-URI endpoint consequently returns a URI with an **empty** credential, which the runtime
> rejects. Use SQL as the owner instead:
> ```sql
> ALTER ROLE heady_approval_api WITH PASSWORD '<generated>' LOGIN;
> ```
> Generate with `openssl rand -base64 24`, run it through the **`neondb_owner`** direct connection, and
> put the result straight into Secret Manager — not into a file or a retained shell history. Neon
> project is `cool-wind-37254039` ("Heady", `azure-westus3`); production branch
> `br-hidden-union-aabqn03y`; the API key in Secret Manager as `NEON_SECRET` is valid.

1. ~~Neon console → **Roles** → reset the password for `heady_approval_api`.~~ Superseded by the
   `ALTER ROLE` above.
2. **Branches → Connect** → choose that role → copy the **Pooled** connection string. It must contain
   `-pooler` in the host and `?sslmode=require`. The runtime rejects a direct URL, a non-Neon host, a
   missing `sslmode`, and any owner-like login — `apps/approval-api/src/database.mjs:13-22,161`.
3. Store it as a **new** secret. Do **not** overwrite the existing root `DATABASE_URL`:

```bash
printf '%s' 'PASTE_POOLED_URL_HERE' | gcloud secrets create approval-runtime-database-url \
  --project="$HEADY_PROJECT" --replication-policy=automatic --data-file=-

gcloud secrets versions list approval-runtime-database-url --project="$HEADY_PROJECT"
```

**Console:** <https://console.cloud.google.com/security/secret-manager?project=heady-ai>

### STEP 5 — validate migrations on a throwaway Neon branch ✅ CHAIN PROVEN 2026-08-22

Run against a real copy-on-write branch of production, not simulated:

| | |
|---|---|
| COW branch | `br-small-mud-aa7m3mc1` — `genesis-s5-validation-20260822`, parent `br-hidden-union-aabqn03y` |
| Endpoint | `ep-bold-wave-aaw0ysw5` (direct and `-pooler` both resolved) |
| Plan | 9 applied, 3 pending — `0010`, `0011`, `0012` |
| **Apply** | ✅ all three clean — `applied:3 skipped:9 total:12` |

**The full 0001→0012 chain is proven to apply.** That retires the standing worry that the chain halts
at `0003`/`0004` on a bare branch: it does not halt on a COW branch of production, because the roles
and Data-API grants already exist there.

> **Not finished — the integration suite.** It needs `TEST_RUNTIME_DATABASE_URL`, which needs the
> STEP 4 `ALTER ROLE` password. An agent attempt to set one on the temp branch was blocked by the
> Claude Code permission classifier. **The COW branch was left alive on purpose** so you can finish in
> a minute instead of rebuilding it:
>
> ```bash
> # as neondb_owner on br-small-mud-aa7m3mc1:
> #   ALTER ROLE heady_approval_api WITH PASSWORD '<generated>' LOGIN;
> TEST_DATABASE_URL='<temp-direct-owner-uri>?sslmode=require' \
> TEST_RUNTIME_DATABASE_URL='<temp-pooled-runtime-uri>?sslmode=require' \
> pnpm --filter @heady/approvals test:integration      # un-skips the 4 skipped tests
> ```
>
> **Then delete it — it is a live billable branch:**
> ```bash
> curl -X DELETE -H "Authorization: Bearer $NEON_API_KEY" \
>   https://console.neon.tech/api/v2/projects/cool-wind-37254039/branches/br-small-mud-aa7m3mc1
> ```

The original manual sequence, for reference:

Production currently has 0001–0009 applied. `0010_autonomous_approval_grants.sql` is **part of the
approval control plane** and must land.

```bash
# Create a copy-on-write branch in the Neon console, take its DIRECT (non-pooler) owner URL.
DATABASE_URL='<temp-branch-DIRECT-owner-url>' pnpm db:migrate         # plan only — writes nothing
DATABASE_URL='<temp-branch-DIRECT-owner-url>' pnpm db:migrate:apply   # apply on the TEMP branch only

TEST_DATABASE_URL='<temp-branch-DIRECT-owner-url>' \
TEST_RUNTIME_DATABASE_URL='<temp-branch-POOLED-runtime-url>' \
pnpm --filter @heady/approvals test:integration
```

Expected: the plan lists `0010`, `0011`, `0012` pending; after apply, the integration suite's 4
currently-skipped tests run. **Delete the temp branch when done.**

### STEP 6 — Artifact Registry + immutable image ✅ BUILT 2026-08-22

| Item | Value |
|---|---|
| Artifact Registry repo | `heady`, DOCKER, `us-east1` (created 2026-08-22) |
| Build | `7a3fabfa-d2ed-4f11-af28-b6fa6e2caef0` · **SUCCESS** · 1m02s |
| Image | `us-east1-docker.pkg.dev/heady-ai/heady/approval-api` |
| Tag | `86c3730b088c26abbf60f733a200893eafa00962` |
| **Deployment digest** | `sha256:b18b8e41b867a19288d65d164712a5f8b961f5657f5a42c46bc19e66933d16af` |

That digest is `--deployment-artifact-digest`.

> **`--rollback-artifact-digest` has no honest value yet.** This is the *first* approval-api image that
> has ever built successfully — the only prior attempts, `e328fe38` (2026-08-22) and `c4cd2cad`
> (2026-07-29), both FAILED, so no previously-good image exists to roll back to. `genesis:prepare`
> validates the flag as an OCI digest but does not require it to differ from the deployment digest, so
> passing the same digest twice would satisfy the schema while asserting a rollback path that does not
> exist. Do one of these instead, deliberately:
> 1. **Build a second image and treat it as the rollback baseline** — cheap, and gives a genuinely
>    distinct digest to fall back to.
> 2. **Pass the deployment digest for both and state in the security review that first-deployment
>    rollback is "delete the Cloud Run service", not "deploy an earlier image"** — accurate, and
>    arguably the truthful description of a first deployment.
>
> Not decided by an agent: it changes what the founder's signature attests to.

The commands that produced the state above:

```bash
gcloud artifacts repositories create heady \
  --repository-format=docker --location="$HEADY_REGION" --project="$HEADY_PROJECT"

gcloud builds submit --config apps/approval-api/cloudbuild.yaml \
  --substitutions _IMAGE_TAG="$(git rev-parse HEAD)",_REGION="$HEADY_REGION" \
  --project="$HEADY_PROJECT"

# Record the DIGEST, never the tag
gcloud artifacts docker images list \
  "$HEADY_REGION-docker.pkg.dev/$HEADY_PROJECT/heady/approval-api" \
  --include-tags --project="$HEADY_PROJECT" --format='table(version,tags,createTime)'
```

Build a second image (previous good commit) so you have a rollback digest.

**Console:** <https://console.cloud.google.com/artifacts?project=heady-ai> ·
<https://console.cloud.google.com/cloud-build/builds?project=heady-ai>

### STEP 7 — deployment manifest ✅ WRITTEN 2026-08-22 (not deployed)

`deploy/approval-api.service.yaml` — a real `gcloud run services replace` manifest. Image pinned **by
digest**, service account `heady-approval-api`, `DATABASE_URL` from
`approval-runtime-database-url:latest`, ingress `internal-and-cloud-load-balancing` (the control plane
must not be an open front door even though the app authenticates its own callers), `maxScale: 21` =
fib(8).

| Field | Value |
|---|---|
| **`--deployment-manifest-sha256`** | `0dc1534ba2ff1c73affbf8d3c58ecf0ba13feebb6056bfa5143748cffe49218a` |

> **One value in it is a prediction, and the manifest hash binds it.**
> `APPROVAL_SERVICE_AUDIENCE` = `https://heady-approval-api-n5s7hbzdga-ue.a.run.app`, derived from this
> project's observed URL pattern (`heady-mcp-server-n5s7hbzdga-ue`, `heady-auth-n5s7hbzdga-uc`; `-ue` =
> us-east1). **Verify it against the deployed service before signing** — a wrong audience fails closed
> on every workload call, and fixing it after signing invalidates the manifest hash. Deploy once under
> a throwaway service name first if you want certainty before the hash is bound.

Org-policy note: the Organization Policy API is **disabled** on `heady-ai`, so
`iam.allowedPolicyMemberDomains` and `run.allowedIngress` could not be read. The manifest deliberately
does not rely on public ingress, which sidesteps the domain-restricted-sharing blocker rather than
hitting it at deploy time.

The original step, for reference:

Write the exact service definition to a file and hash it. Image **by digest**.

```yaml
# deploy/approval-api.service.yaml  (illustrative shape — image/SA are yours to fill)
image: us-east1-docker.pkg.dev/heady-ai/heady/approval-api@sha256:<DIGEST-FROM-STEP-6>
serviceAccount: heady-approval-api@heady-ai.iam.gserviceaccount.com
env:
  FIREBASE_PROJECT_ID: heady-ai
  APPROVAL_SERVICE_AUDIENCE: <the service's own canonical URL>
  APPROVAL_KMS_KEY_VERSION: projects/heady-ai/locations/global/keyRings/heady-approval/cryptoKeys/receipt-signing/cryptoKeyVersions/1
  PORT: "8080"
  LOG_LEVEL: info
secrets:
  DATABASE_URL: approval-runtime-database-url:latest
```

The runtime service account does not exist yet. The project currently has
`firebase-adminsdk-fbsvc`, `vertex-express`, `heady-gha-sa`, `1003436179562-compute`,
`heady-gateway-invoker`, `heady-nats-probe`, and `heady-nats-runtime` — **none** is appropriate
(reusing any of them would over-grant the approval runtime). Create a dedicated one:

```bash
gcloud iam service-accounts create heady-approval-api \
  --display-name="HEADY approval API runtime (least privilege)" --project="$HEADY_PROJECT"
export SA=heady-approval-api@heady-ai.iam.gserviceaccount.com
```

Then it gets **exactly** these and nothing more:

```bash
gcloud kms keys add-iam-policy-binding receipt-signing \
  --keyring="$HEADY_KEYRING" --location="$HEADY_KMS_LOCATION" --project="$HEADY_PROJECT" \
  --member="serviceAccount:$SA" --role=roles/cloudkms.signerVerifier

gcloud secrets add-iam-policy-binding approval-runtime-database-url \
  --project="$HEADY_PROJECT" --member="serviceAccount:$SA" \
  --role=roles/secretmanager.secretAccessor
```

No Neon owner credentials, no bootstrap-table write, no access to `founder-evidence` or
`arbiter-attestation`. Startup refuses owner-like credentials, so an over-granted deploy fails closed.

Confirm Firebase Auth is enabled for `heady-ai` with a verified-email provider for your founder
identity: <https://console.firebase.google.com/project/heady-ai/authentication/providers>

```bash
sha256sum deploy/approval-api.service.yaml     # → --deployment-manifest-sha256
```

### STEP 8 — gate report, security review, manifest, signature (S8)

`genesis:prepare` refuses a dirty tree, untracked files included.

```bash
git status --porcelain --untracked-files=all      # must print NOTHING
```

Governance report as real JSON (not piped turbo text):

```bash
REPORT="docs/reports/approval-genesis-governance-$(git rev-parse --short HEAD).json"
GATES=""
for gate in \
  "build:pnpm build" \
  "test:pnpm test" \
  "law-lint:node tooling/law-lint/src/law-lint.mjs" \
  "governance-gate:node tooling/governance-gate/src/governance-gate.mjs"
do
  name="${gate%%:*}"; cmd="${gate#*:}"
  out="$(eval "$cmd" 2>&1)"; code=$?
  GATES="$GATES$(jq -cn --arg n "$name" --arg c "$cmd" --argjson e "$code" --arg o "$out" \
    '{name:$n,command:$c,exitCode:$e,output:$o}'),"
done
jq -n --arg commit "$(git rev-parse HEAD)" --argjson gates "[${GATES%,}]" \
  '{schema:"heady.approval.governance-report.v1",commit:$commit,gates:$gates,allPassed:($gates|all(.exitCode==0))}' \
  > "$REPORT"
jq '.allPassed' "$REPORT"        # must be true
sha256sum "$REPORT"              # → --governance-report-sha256
```

Write your security review — it must cover the three files changed on 2026-08-22
(`packages/approvals/src/constants.mjs`, `packages/approvals/test/core.test.mjs`,
`apps/approval-api/README.md`) — then:

```bash
sha256sum docs/security/approval-genesis-security-review.md    # → --security-review-sha256

pnpm --filter @heady/approvals genesis:prepare \
  --deployment-manifest-sha256 <from STEP 7> \
  --deployment-artifact-digest sha256:<from STEP 6> \
  --rollback-artifact-digest sha256:<rollback from STEP 6> \
  --governance-report-sha256 <from above> \
  --security-review-sha256 <from above> \
  --founder-public-jwk configs/keys/approval/founder-evidence.public.jwk.json \
  --arbiter-public-jwk configs/keys/approval/arbiter-attestation.public.jwk.json \
  --receipt-signer-public-jwk configs/keys/approval/receipt-signing.public.jwk.json
```

Then sign the printed manifest hash **outside the agent runtime**, same shape as STEP 1's tag:

```bash
git tag -s "approval-genesis-$(git rev-parse --short=9 HEAD)" -m \
"Founder acceptance: approval genesis manifest <MANIFEST-SHA256>; implementation $(git rev-parse HEAD)"
git tag -v "approval-genesis-$(git rev-parse --short=9 HEAD)"
```

### STEP 9 — the one-time genesis transaction (S9)

By hand, through a governed **owner** session, in this order — see S9 for the full detail:

1. apply the migration chain to production with the **direct owner** URL;
2. deploy the exact image **digest**;
3. insert principals (founder, ARBITER, deployment-guard, automation-requester, automation-guard) and
   their public keys;
4. in **one** transaction: the single `approval.system_bootstrapped` event + its KMS receipt + the one
   permitted `heady_approval.bootstrap` row carrying the manifest hash and signed Git object ID;
5. replay the full event chain and verify;
6. drop the owner session; prove the API role can neither write `bootstrap` nor mint a second genesis.

Verify it took:

```bash
gcloud run services list --project="$HEADY_PROJECT" --format='table(metadata.name,status.url)' | grep approval
# then, against production: principals >= 5, bootstrap == 1, events == 1, receipts == 1
```

### STEP 10 — HCP-0003 and the bee runtime (§6)

Only now. Add `/packages/bees/` to `.github/CODEOWNERS`, author the exact **non-applied** G02 diff,
bind its `diff_hash`, `POST /api/approvals` with `patentLocked: true`, get the ARBITER `ALLOW`, sign
the founder decision through §5, take the final ARBITER review — then create the files.


---

## 1. Verified live state (2026-08-22)

Every row was measured, not inferred.

| Component | State | Evidence |
|---|---|---|
| ADR-0031 acceptance | ✅ **Accepted**, OpenPGP tag verifies | `git tag -v adr-0031-accepted-e064a8943` → *Good signature from HeadyMe <eric@headysystems.com>*, EDDSA key `1050B59E7296C46C26DDF95DA7D2108BB3C6101C` |
| `@heady/approvals` | ✅ built, **21 pass / 4 skipped** (skips = Neon integration) | `pnpm --filter @heady/approvals test` |
| `apps/approval-api` | ✅ built, **15 / 15 pass** | `pnpm --filter @heady/approval-api test` |
| `policies/approval.rego` + compiled WASM | ✅ present, recorded hashes recompute exactly | policy `heady.approval.v2`, OPA `1.18.2` |
| Neon `heady_approval` schema | ✅ **live in production** — all 9 tables exist | migration 0004 applied (9 of 12 migrations applied) |
| Neon role `heady_approval_api` | ✅ exists | `pg_roles` |
| Genesis state | ❌ **not run** — `principals`, `bootstrap`, `events`, `receipts` all **0 rows** | live count |
| Pending migrations | ⚠️ `0010`/`0011`/`0012` still pending **in production** — ✅ proven to apply on COW `br-small-mud-aa7m3mc1` | `pnpm db:migrate:apply` (temp branch) |
| KMS keyring `heady-approval` (global) | ✅ exists | `gcloud kms keyrings list --location=global` |
| KMS `founder-evidence` v1 | ✅ Ed25519, ENABLED | fingerprint `0f7753c1…78ed` |
| KMS `receipt-signing` v1 | ✅ Ed25519, ENABLED | fingerprint `e9dfdcb1…64ba` |
| KMS `arbiter-attestation` v1 | ✅ Ed25519, ENABLED (created 2026-08-22) | fingerprint `cc7151dd…76b8`; sole IAM binding = `heady-arbiter` SA |
| Artifact Registry repo `heady` (us-east1) | ✅ created 2026-08-22 | `gcloud artifacts repositories list` |
| approval-api image | ✅ built — `sha256:b18b8e41…16af` (build `7a3fabfa`, SUCCESS) | `gcloud artifacts docker images list` |
| Cloud Run `approval-api` | ❌ **not deployed** | `gcloud run services list` |
| Genesis manifest | ❌ cannot be produced yet — see §4 | `prepare-genesis-manifest.mjs` requires all 8 inputs |

**Consequence:** the genesis manifest — the artifact you sign — **cannot be built this session**,
because `--arbiter-public-jwk` has no key behind it and the image digests do not exist. Steps S1–S9
below are what change that.

---

## 2. Three findings to decide on before anything is deployed

### S0 — decide ADR-0053 *before* genesis, not after

A peer agent authored `docs/adr/0053-temporary-solo-founder-approval-quorum.md` on 2026-08-22, on
branch `governance/solo-founder-quorum-amendment-20260822` (worktree
`/tmp/heady-solo-founder-governance-20260822`, PR 288). Status **Proposed** — while Proposed it
changes nothing and ADR-0031 stays authoritative.

If accepted, it activates a temporary `solo_founder` mode: an approval-system or protected-migration
change needs **one founder decision plus one separately authenticated ARBITER `ALLOW`** and **no
external-human slot**, bound to the same payload/diff/policy/nonce/expiry. `ESCALATE`, `DENY`,
signature failure, incomplete claim coverage, or binding drift all fail closed. It sunsets
automatically at the earliest of a real external reviewer being registered, a second human joining,
or **2026-11-19T23:59:59Z** — exactly `FIB[11]` = 89 days from proposal, which checks out.

**Ordering matters, and this is the whole point of listing it as S0.** §5's evidence table below is
written under ADR-0031: approval-system changes cost you *founder + external human security review* —
a reviewer you do not currently have. Genesis itself is fine either way, because ADR-0031 §2's
one-time exception routes acceptance through a founder-signed stage-0 Git object rather than the
service. But **the moment genesis closes, amending the quorum becomes an approval-system change** and
therefore needs the very external reviewer ADR-0053 exists to waive. Accept it before genesis, or
accept that the waiver may be unreachable afterward.

Its own activation is deliberately non-circular: it cannot ratify itself through the weaker quorum it
proposes, so acceptance needs a founder-signed Git object over the exact amendment and implementation
digests — the same shape as `adr-0031-accepted-e064a8943`. An agent may author and test it; an agent
may not sign it, activate it, or infer acceptance.

Not a recommendation to accept — a sequencing constraint if you intend to.

### S1 — the founder signing key is reachable by the agent session (governance defect)

```
gcloud kms keys get-iam-policy founder-evidence --keyring=heady-approval --location=global
→ user:eric@headyconnection.org  roles/cloudkms.signerVerifier
```

`eric@headyconnection.org` is the identity this machine's `gcloud` session is authenticated as, and
`eric@headysystems.com` (the GPG identity that signed the ADR-0031 tag) is **also** in the local
credentialed-account list. ADR-0031 §2 states an AI agent "may not invoke the founder's signing
key" — right now the only thing enforcing that is the agent choosing not to. Switching accounts is
not a fix, because both are locally credentialed.

Pick one before genesis:

1. **Separate the ceremony host (recommended).** Revoke `signerVerifier` from any principal whose
   credentials sit on an agent-accessible machine; grant it only to an identity you authenticate as
   on a device with no agent session. Sign there, paste the detached signature back.
2. **Keep the binding, add a human factor.** Require reauthentication/2SV for the sign call and
   accept that the technical control is procedural, recording that in the ADR.

Either way the change is yours to make — an agent must not run
`gcloud kms keys set-iam-policy` on the founder's key.

**Console:** <https://console.cloud.google.com/security/kms/keyring/manage/global/heady-approval?project=heady-ai>

### S2 — ARBITER independence is not yet real

The typed patent quorum (ADR-0031 §1) is *founder decision* **plus** *independent ARBITER
attestation*. If the same human identity can sign both, the second channel is decoration. When you
create the ARBITER key (S3), grant `roles/cloudkms.signerVerifier` on it **only** to the ARBITER
workload service account — never to a user account you also sign founder evidence with.

---

## 3. The nine external steps

Ordered. Each says what it produces and which genesis input it feeds.

### S3 — create the ARBITER attestation key

```bash
gcloud kms keys create arbiter-attestation \
  --keyring=heady-approval --location=global --project=heady-ai \
  --purpose=asymmetric-signing --default-algorithm=ec-sign-ed25519

gcloud iam service-accounts create heady-arbiter \
  --display-name="HEADY ARBITER attestation workload" --project=heady-ai

gcloud kms keys add-iam-policy-binding arbiter-attestation \
  --keyring=heady-approval --location=global --project=heady-ai \
  --member=serviceAccount:heady-arbiter@heady-ai.iam.gserviceaccount.com \
  --role=roles/cloudkms.signerVerifier
```

Then export its public JWK (read-only, safe to run anywhere):

```bash
pnpm --filter @heady/approval-api key:public \
  --key-version projects/heady-ai/locations/global/keyRings/heady-approval/cryptoKeys/arbiter-attestation/cryptoKeyVersions/1
```

Save the `publicJwk` object **bare** (just `crv`/`kty`/`x`) to
`configs/keys/approval/arbiter-attestation.public.jwk.json`, matching the two files already there.

→ feeds `--arbiter-public-jwk`.
**Docs:** [KMS asymmetric signing](https://cloud.google.com/kms/docs/create-validate-signatures) ·
[Service accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=heady-ai)

### S4 — create the Neon least-privilege runtime login

The role `heady_approval_api` already exists; it needs a password and a **pooled** connection URL.

1. Open the [Neon console](https://console.neon.tech/) → your project → **Roles**, and set/reset the
   password for `heady_approval_api`.
2. Copy the **pooled** connection string (host contains `-pooler`), with `sslmode=require`. The
   runtime rejects a direct URL, a non-Neon host, a missing `sslmode`, and any owner-like login.
3. Store it as a **new** secret — do **not** overwrite the existing root `DATABASE_URL`:

```bash
printf '%s' '<pooled-url-for-heady_approval_api>' | \
  gcloud secrets create approval-runtime-database-url \
    --project=heady-ai --replication-policy=automatic --data-file=-
```

→ feeds S7's Cloud Run secret mapping.
**Docs:** [Neon roles](https://neon.com/docs/manage/roles) ·
[connection pooling](https://neon.com/docs/connect/connection-pooling) ·
[Secret Manager](https://console.cloud.google.com/security/secret-manager?project=heady-ai)

### S5 — validate the remaining migrations on a throwaway Neon branch

Production has 0001–0009. `0010_autonomous_approval_grants.sql` is **part of the approval control
plane**, not an optional extra: it creates `heady_approval.autonomous_grant_claims` (which
`packages/approvals/src/store.mjs` reads) plus the `guard_approval_insert` and
`validate_autonomous_event_binding` triggers. Deploying without it leaves those guards absent.

```bash
# 1. Create a copy-on-write branch in the Neon console, take its DIRECT url.
DATABASE_URL='<temp-branch-direct-url>' pnpm db:migrate            # plan only, writes nothing
DATABASE_URL='<temp-branch-direct-url>' pnpm db:migrate:apply      # apply on the temp branch ONLY

TEST_DATABASE_URL='<temp-branch-direct-owner-url>' \
TEST_RUNTIME_DATABASE_URL='<temp-branch-pooled-runtime-url>' \
pnpm --filter @heady/approvals test:integration                     # un-skips the 4 skipped tests
```

Inspect the append-only triggers and Data-API denial, then **delete the temp branch**. Apply to
production only at S8, through your own hands.

**Docs:** [Neon branching](https://neon.com/docs/manage/branches)

### S6 — build the immutable image

The `cloudbuild.yaml` pushes to `us-east1-docker.pkg.dev/heady-ai/heady/approval-api`, and the
`heady` repository does not exist yet:

```bash
gcloud artifacts repositories create heady \
  --repository-format=docker --location=us-east1 --project=heady-ai

gcloud builds submit --config apps/approval-api/cloudbuild.yaml \
  --substitutions _IMAGE_TAG="$(git rev-parse HEAD)" --project=heady-ai
```

Record the resulting **digest** (`sha256:…`), never the tag. Build a second time from the previous
good commit, or reuse an earlier digest, to have a rollback digest.

→ feeds `--deployment-artifact-digest` and `--rollback-artifact-digest`.
**Console:** [Cloud Build](https://console.cloud.google.com/cloud-build/builds?project=heady-ai) ·
[Artifact Registry](https://console.cloud.google.com/artifacts?project=heady-ai)

### S7 — prepare the deployment manifest (do not deploy yet)

Write the exact Cloud Run service definition you intend to apply — image **by digest**, the runtime
service account, and:

| Variable | Value |
|---|---|
| `FIREBASE_PROJECT_ID` | `heady-ai` |
| `APPROVAL_SERVICE_AUDIENCE` | the service's own canonical URL (the audience workload ID tokens must carry) |
| `APPROVAL_KMS_KEY_VERSION` | `projects/heady-ai/locations/global/keyRings/heady-approval/cryptoKeys/receipt-signing/cryptoKeyVersions/1` |
| `PORT` | `8080` |
| `LOG_LEVEL` | `info` |
| secret | `DATABASE_URL=approval-runtime-database-url:latest` (S4) |

The runtime service account needs exactly: `cloudkms.signerVerifier` + public-key read on
`receipt-signing`, `secretmanager.secretAccessor` on `approval-runtime-database-url`, and membership
in `heady_approval_api`. It must **not** hold Neon owner credentials, bootstrap-table write access,
or any access to `founder-evidence` / `arbiter-attestation`. Startup refuses owner-like credentials,
so an over-granted deploy fails closed rather than running hot.

Confirm Firebase Authentication is enabled for `heady-ai` with a verified-email provider for your
founder identity.

`sha256sum` the manifest file → feeds `--deployment-manifest-sha256`.
**Console:** [Cloud Run](https://console.cloud.google.com/run?project=heady-ai) ·
[Firebase Auth providers](https://console.firebase.google.com/project/heady-ai/authentication/providers) ·
**Docs:** [verifying ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens)

### S8 — content-address the gate reports, then build and sign the manifest

Commit everything first — the preparer refuses a dirty tree, untracked files included.

```bash
git status --porcelain --untracked-files=all      # must print nothing

# governance report — one JSON envelope, one key per gate, exit codes recorded.
# (Do not pipe `pnpm build`/`pnpm test` straight into a .json file: turbo emits
#  human text, and this artifact gets signed into the manifest and read by the
#  security reviewer.)
REPORT="docs/reports/approval-genesis-governance-$(git rev-parse --short HEAD).json"
GATES=""
for gate in \
  "build:pnpm build" \
  "test:pnpm test" \
  "law-lint:node tooling/law-lint/src/law-lint.mjs" \
  "governance-gate:node tooling/governance-gate/src/governance-gate.mjs"
do
  name="${gate%%:*}"; cmd="${gate#*:}"
  out="$(eval "$cmd" 2>&1)"; code=$?
  GATES="$GATES$(jq -cn --arg n "$name" --arg c "$cmd" --argjson e "$code" \
    --arg o "$out" '{name:$n,command:$c,exitCode:$e,output:$o}'),"
done
jq -n --arg commit "$(git rev-parse HEAD)" --argjson gates "[${GATES%,}]" \
  '{schema:"heady.approval.governance-report.v1",commit:$commit,gates:$gates,
    allPassed:($gates|all(.exitCode==0))}' > "$REPORT"
jq '.allPassed' "$REPORT"                                      # must be true
sha256sum "$REPORT"                                            # → --governance-report-sha256

# security review: your own written review of the approval-system diff, content-addressed
sha256sum docs/security/approval-genesis-security-review.md     # → --security-review-sha256

pnpm --filter @heady/approvals genesis:prepare \
  --deployment-manifest-sha256 <sha256 from S7> \
  --deployment-artifact-digest <sha256:… from S6> \
  --rollback-artifact-digest <sha256:… from S6> \
  --governance-report-sha256 <sha256> \
  --security-review-sha256 <sha256> \
  --founder-public-jwk configs/keys/approval/founder-evidence.public.jwk.json \
  --arbiter-public-jwk configs/keys/approval/arbiter-attestation.public.jwk.json \
  --receipt-signer-public-jwk configs/keys/approval/receipt-signing.public.jwk.json
```

It verifies the signed ADR tag against the pinned Git objects, recomputes the policy source/WASM
hashes, and prints the canonical manifest. It cannot write Neon, deploy, create principals, or sign
for you — by design.

Then, per ADR-0031 §2 step 2, **sign the manifest hash outside the agent runtime** — an annotated,
OpenPGP-signed Git tag over the implementation commit, the same shape as
`adr-0031-accepted-e064a8943`. That signed object ID goes into the genesis row.

### S9 — the one-time genesis transaction

In order, by hand, through a governed **owner** session (never the API role):

1. Apply the migration chain to the production branch using the **direct** owner URL.
2. Deploy the exact image **digest** from S6.
3. Insert the principals — founder, ARBITER, deployment-guard, automation-requester,
   automation-guard — and their public keys.
4. In **one** transaction: the single `approval.system_bootstrapped` event, its KMS receipt, and the
   one permitted `heady_approval.bootstrap` row carrying the manifest hash and signed Git object ID.
5. Replay the whole event chain and verify it.
6. Drop the owner session and prove the API role can neither write `bootstrap` nor mint a second
   genesis.

The genesis path is then permanently closed. There is no second one.

---

## 4. Genesis manifest inputs — what is already computed

Computed 2026-08-22 and verified against the recorded policy manifest. The four file hashes are
content-addressed — they hold until those exact files change, independent of which commit is checked
out (re-verified unchanged across `791be0e434` → `5886248b7d`, two unrelated domain-sweep commits that
landed mid-session and touched no approval path). `approvalSourceTreeSha256` is per-commit, so
recompute it at your final implementation commit — and note the pending `packages/approvals/` edits in
§7 will move it.

| Manifest field | Value | Source |
|---|---|---|
| `specificationSha256` | `5e1cb2255c5fc99932d8fcf1f27278180c8834dfb4b3a1c244bc7b74a8a1f3a1` | `docs/design/APPROVAL_SERVICE_BOOTSTRAP_SPEC.md` |
| `migrationSha256` | `9e4bff3c2b4ebe3cadd2c80c80cac05af3908648896d92f996db90841ec06eae` | `packages/db/migrations/0004_approval_control_plane.sql` |
| `policySourceSha256` | `a58695bb843e9b4b3ec918559c3a0499a06ee20e4ea4d4905fa8f7eb429238f6` | `policies/approval.rego` (recomputes exactly) |
| `policyWasmSha256` | `a9a0676522a174a6cf0d543db05de14b7271c80f36406607f62cd70f06f485ff` | `packages/approvals/policy/approval.wasm` (recomputes exactly) |
| `founderPublicKeyFingerprint` | `0f7753c16b03420af64a6415a746239d67a3e64a88c9177bca27c29b56a378ed` | `configs/keys/approval/founder-evidence.public.jwk.json` |
| `receiptSignerPublicKeyFingerprint` | `e9dfdcb1cd80f69a010e6e1b24daf0447a0074f72c7065d4f45bad7a8cbc64ba` | `configs/keys/approval/receipt-signing.public.jwk.json` |
| `approvalSourceTreeSha256` | recompute — changes with the implementation commit | `git ls-tree` over `apps/approval-api`, `packages/approvals`, migration 0004, `policies/approval.rego` |
| `arbiterPublicKeyFingerprint` | `cc7151dd68a5bd20364c28753ad2689678b2646e9891c6705dc1bd3777c076b8` | `configs/keys/approval/arbiter-attestation.public.jwk.json` |
| `deploymentManifestSha256` | `0dc1534ba2ff1c73affbf8d3c58ecf0ba13feebb6056bfa5143748cffe49218a` | `deploy/approval-api.service.yaml` |
| `deploymentArtifactDigest` | `sha256:b18b8e41b867a19288d65d164712a5f8b961f5657f5a42c46bc19e66933d16af` | build `7a3fabfa`, tag `86c3730b08` |
| `rollbackArtifactDigest` | **decision needed** — no prior good image exists, see STEP 6 | — |
| `governanceReportSha256` / `securityReviewSha256` | **pending S8** | — |

---

## 5. After genesis — the standing signing loop

This is the repeatable answer to *"give me the hash to approve this."* Once the service is live,
**every** change that needs your approval follows the same four moves, and step 2 is the only one
that is yours.

> **Run steps 1–3 on the ceremony host from S1.** The signed envelope carries an expiry of at most
> `EVIDENCE_CEREMONY_MAX_MS` = **485,410 ms ≈ 8.1 minutes** (φ × 5 min), so building the envelope on
> one machine and carrying it to another to sign burns that window. The builder needs no keys and no
> network — fetch `approval-view.json` wherever is convenient, carry **that** file to the ceremony
> host, and build there. An expired ceremony is refused and you start over with a fresh nonce.

```bash
# 0. an agent (or you) creates + submits the proposal; the service mints the ULID and freezes hashes
curl -H "Authorization: Bearer $ID_TOKEN" \
  https://<approval-api>/api/approvals/<APPROVAL_ID> > approval-view.json

# 1. build the exact envelope the service will reconstruct server-side
pnpm --filter @heady/approval-evidence envelope \
  --approval-state approval-view.json \
  --decision approve \
  --reason "<why you are approving this>" \
  --out evidence-envelope.json
#    → prints envelopeSha256 — THIS is "the signing hash" — and the ready decision request body

# 2. YOURS: sign it as the human founder, on the ceremony host from S1
pnpm --filter @heady/approval-api evidence:sign \
  --key-version projects/heady-ai/locations/global/keyRings/heady-approval/cryptoKeys/founder-evidence/cryptoKeyVersions/1 \
  --envelope evidence-envelope.json

# 3. POST the printed decision request body with that detached signature
curl -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H 'Content-Type: application/json' -d @decision.json \
  https://<approval-api>/api/approvals/<APPROVAL_ID>/approve
```

`tooling/approval-evidence` exists for exactly this and holds **no** key material. It refuses to
build evidence for an approval that is not `pending`, refuses a ceremony window wider than the
service's φ×5-minute allowance (≈8.1 min wall clock), refuses a service evidence class in the
human lane, and reproduces
the service's `action`/`detail` shape byte-for-byte — proven by an ephemeral-key
build→sign→verify round-trip in `tooling/approval-evidence/test/ceremony-roundtrip.test.mjs`
(11/11 passing) rather than by assertion.

The private key never leaves KMS. The API rebuilds the envelope independently and rejects a changed
action, hash, nonce, expiry, detail field, or key — so a mismatch fails closed instead of approving
something you did not read.

What each class of change costs you, from `policies/approval.rego`:

| Change class | Your evidence | Also required |
|---|---|---|
| Standard sensitive | founder decision | — |
| **Patent-locked** (e.g. `packages/bees/**` → HCP-0003) | founder decision | ARBITER `ALLOW` bound to the same diff hash |
| Approval system / stage 0 | founder decision | **external human** security review (not you) — becomes ARBITER `ALLOW` instead **if** ADR-0053 is accepted (S0) |
| Renovate patch-only | none | automated attestation, protected paths excluded |
| Autonomous lane | none | requester + independent guard, bounded and one-shot |

---

## 6. Then, and only then: HCP-0003 and the bee runtime

With the service live, `docs/hcp/HCP-0003-bee-swarm-runtime.md` unblocks in this order:

1. Author the **exact non-applied diff** for `packages/bees` (base bee, factory, registry, index,
   tests) from the reviewed `.data/decomposition/bundles/G02-bee-swarm-runtime.zip` sources, and bind
   its `diff_hash`. Nothing under `packages/bees/` is created on disk at this stage.
2. Add `/packages/bees/` to `.github/CODEOWNERS` — HCP-0003 names its absence as a blocker.
3. `POST /api/approvals` with `patentLocked: true`, the zone paths, and that diff hash → `draft`,
   then `submit` → `pending`. Change class resolves to `patent_locked` automatically because
   `packages/bees/` is a patent zone.
4. ARBITER reviews the exact diff and attests `ALLOW` (or `ESCALATE`, which then needs an external
   human) against `HS-2026-060` claims 1–3, 5, 7, 9.
5. You sign the founder decision through §5.
6. Final ARBITER review on the narrowed diff → then, and only then, the files are created.

The 2026-07-23 sign-and-continue instruction stays what the record already calls it:
`human-approval-intent-recorded`, intent evidence only. Step 5 is what replaces it.

---

## 7. Documentation drift found while verifying this

- **Fixed** `apps/approval-api/README.md` — the Neon sequence said the chain "ends with
  `0007_autonomous_approval_grants.sql`". `0007` is `heady_runtime_intelligence`; the approval control
  plane is `0004` **plus** `0010_autonomous_approval_grants.sql`, and the chain ends at `0012`. The
  step now names both approval migrations, says why `0010` is not optional, and notes `pnpm db:migrate`
  is plan-only.
- **Fixed** `apps/approval-api/README.md` — the documented `pnpm --filter … -- --key-version` form
  fails under pnpm 9.15.9, which forwards the bare `--` into `process.argv` and trips the CLI's
  strict tuple parse. Dropped from all three examples (`genesis:prepare`, `key:public`,
  `evidence:sign`), and the routine-evidence section now points at `tooling/approval-evidence` for
  building the envelope.

  > `apps/approval-api/` is also in `APPROVAL_SYSTEM_PREFIXES`, so **S8's security review covers this
  > README too.**
- **Fixed** (pre-genesis window) in `packages/approvals/src/constants.mjs` and
  `packages/approvals/test/core.test.mjs`: the same 0007→0010 renumber had left the stale filename in
  `APPROVAL_SYSTEM_PREFIXES`, so a change to the real migration classified as `standard_sensitive` —
  founder decision only, no external security review. The path is corrected and
  `isApprovalSystemPath()` now matches any `packages/db/migrations/NNNN_*approval*` file so a future
  renumber cannot silently downgrade it again; the new test walks every migration body and fails if
  one touches `heady_approval.*` without being name-matched. This had to land before genesis: after
  it, the same fix costs a full approval-system cycle including an external reviewer.

  > **Both files are inside `packages/approvals/` — the first entry in `APPROVAL_SYSTEM_PREFIXES`.**
  > ADR-0031 §2 permits an agent to author the implementation and puts the gate at acceptance, so
  > authoring this pre-genesis is in scope — but it means the **S8 security review must cover a
  > change made on 2026-08-22**, after you last read this code. Review those two files, not a
  > remembered version of them.

---

## 10. Projection manifests must be regenerated from a CLEAN checkout (2026-08-27)

`tooling/projection-engine` computes a source hash by walking the **filesystem**, not git. It does not
respect `.gitignore`, so a working checkout that has built the app produces a different hash than CI's
clean checkout:

| Tree | Files under `apps/headyme-portal` | `headyweb` `last_sync_hash` |
|---|---|---|
| Developer checkout (has `dist/`, `.turbo/`, `.env`) | 44 | `f7e96714…` |
| Clean checkout / CI | 43 | `0fe08a0a…` |

**Consequence:** regenerating projections from a normal working checkout produces manifests that
**can never go green in CI**, and the drift gate stays red on every branch. This happened during the
2026-08-27 brand-sweep cleanup and had to be redone.

**Procedure — always regenerate from a throwaway clean worktree:**

```bash
git worktree add --detach /tmp/heady-clean-projections <branch>
cd /tmp/heady-clean-projections
ln -s /home/headyme/Heady-AI/node_modules node_modules      # deps only, no build output
node tooling/projection-engine/bin/generate-manifests.mjs
node tooling/projection-engine/bin/check-drift.mjs          # must be drifted:[]
cp configs/projections/*.projection.json <repo>/configs/projections/
git worktree remove /tmp/heady-clean-projections
```

**Safety note, checked:** the manifests store only `last_sync_hash`, `last_sync_commit` and metadata —
**no file list and no file content** — so a polluted regeneration never leaked `.env` material into a
commit. It only produced an unreproducible hash.

**Open defect, not fixed here:** `collectSource()` should honour `.gitignore` (or take an explicit
allow-list) so the gate is environment-independent. Fixing it changes every recorded hash once, so it
is cheapest to do deliberately in its own change rather than as a side effect.

---

## 9. `policies/approval.rego` is byte-frozen until an OPA recompile (2026-08-27)

**Do not edit that file for cosmetic reasons — not even a comment.** Its bytes are bound in three
places at once:

- `packages/approvals/policy/manifest.json` pins `sourceSha256`
  `a58695bb843e9b4b3ec918559c3a0499a06ee20e4ea4d4905fa8f7eb429238f6`;
- `packages/approvals/bin/prepare-genesis-manifest.mjs` `assertHash()`es it and aborts genesis
  preparation on mismatch;
- the genesis review bundle (PR #261's `genesis-review-scope.json`) hashes it into the digest an
  external reviewer signs off on.

This already fired once. The 2026-08-27 branding sweep `f69ddccdcd` replaced one comment line —
`© 2026 HeadySystems Inc. — Eric Haywood, Founder` → `Made with ❤️ by HeadySystems Inc.` — across 44
files including this one. `pnpm --filter @heady/approvals build` then failed with
`TypeError: approval.rego source hash does not match the compiled policy manifest`, which meant the
approval package's build gate was red and `genesis:prepare` could not have run. Restored to the exact
reviewed bytes in the same-day fix.

**If you do want the new byline in the policy**, it takes an OPA `1.18.2` recompile in the *same*
commit — and OPA is not installed on this machine:

```bash
# install OPA 1.18.2 first: https://www.openpolicyagent.org/docs/latest/#running-opa
OPA_BIN=/absolute/path/to/opa pnpm --filter @heady/approvals policy:build
```

That regenerates `approval.wasm` and the manifest together. Note it produces a **new WASM artifact**,
so PR #261's review bundle and any signed genesis manifest must be re-hashed against it. Cheapest
before genesis; expensive after.

---

## 8. Two genesis-adjacent traps found in local stashes (2026-08-22)

Neither is applied; both are recorded so genesis is not surprised by them. Read-only inspection —
nothing was popped, dropped, or restored.

- **A stale `0004_approval_control_plane.sql` is parked in `stash@{2}`** (`agent-990-slice`,
  `codex-cleanup-agent-990-slice-2026-08-22`), as its *untracked* component. It hashes to
  `50d9f6c2a986545fd91e0bc78af604c5f0ee8685b9fe8fd89029b0cfe7a8bb89` — the **original** version from
  `439cb776a6` ("bootstrap governed approval control plane", 2026-07-29), superseded the same day by
  `5a19d0d761` ("make the 0001→0006 migration chain apply"), which produced the tracked
  `9e4bff3c…6eae` that §4 binds. Same 1013 lines, different bytes. `agent-990-slice` does not track
  `0004` at all (its migrations directory holds only `0001` and `0003`), so **popping that stash onto
  that branch resurrects the pre-fix migration** and would bind a `migrationSha256` that never passed
  the chain fix. If `agent-990-slice` ever needs `0004`, take it from the checkpoint branch.
- **A code fix for the `--` argument problem is sitting unapplied in `stash@{3}`**
  (`codex-safety-before-sync-2026-08-04`). It teaches
  `packages/approvals/bin/prepare-genesis-manifest.mjs` to strip a leading `--`:
  `process.argv[2] === "--" ? process.argv.slice(3) : process.argv.slice(2)`. §7 fixed this in the
  docs instead, by removing the `--` from the commands, so the runbook as written already works and
  this is belt-and-suspenders rather than a blocker. Deliberately **not** applied here: it edits a
  genesis-critical path inside `packages/approvals/` for something that is not a live bug, and that is
  a founder call, not an agent's. If you do want it, it is a pre-genesis-window change like the two in
  §7 — cheaper now than after.
