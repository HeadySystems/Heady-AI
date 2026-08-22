<!-- HEADY_BRAND:BEGIN
Heady™ Approval Genesis — Founder Runbook v1.0.0
© 2026 HeadySystems Inc. — Eric Haywood, Founder
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
> signature. Nothing in `packages/bees` may be created until they are done. Two of the nine
> (**S1** and **S2**) are open governance defects, not just setup.

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
| Pending migrations | ⚠️ `0010_autonomous_approval_grants`, `0011`, `0012` **not applied** | `pnpm db:migrate` (plan-only) |
| KMS keyring `heady-approval` (global) | ✅ exists | `gcloud kms keyrings list --location=global` |
| KMS `founder-evidence` v1 | ✅ Ed25519, ENABLED | fingerprint `0f7753c1…78ed` |
| KMS `receipt-signing` v1 | ✅ Ed25519, ENABLED | fingerprint `e9dfdcb1…64ba` |
| KMS ARBITER key | ❌ **does not exist** | keyring holds only the two keys above |
| Artifact Registry repo `heady` (us-central1) | ❌ absent (only `gcr.io`, `cloud-run-source-deploy`) | `gcloud artifacts repositories list` |
| Cloud Run `approval-api` | ❌ **not deployed** | `gcloud run services list` |
| Genesis manifest | ❌ cannot be produced yet — see §4 | `prepare-genesis-manifest.mjs` requires all 8 inputs |

**Consequence:** the genesis manifest — the artifact you sign — **cannot be built this session**,
because `--arbiter-public-jwk` has no key behind it and the image digests do not exist. Steps S1–S9
below are what change that.

---

## 2. Two findings to decide on before anything is deployed

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

The `cloudbuild.yaml` pushes to `us-central1-docker.pkg.dev/heady-ai/heady/approval-api`, and the
`heady` repository does not exist yet:

```bash
gcloud artifacts repositories create heady \
  --repository-format=docker --location=us-central1 --project=heady-ai

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
| `arbiterPublicKeyFingerprint` | **pending S3** | key does not exist |
| `deploymentManifestSha256` | **pending S7** | — |
| `deploymentArtifactDigest` / `rollbackArtifactDigest` | **pending S6** | — |
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
| Approval system / stage 0 | founder decision | **external human** security review (not you) |
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
