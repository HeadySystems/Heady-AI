<!-- HEADY_BRAND:BEGIN
Heady™ Approval API v1.1.0
© 2026 HeadySystems Inc. — Eric Haywood, Founder
HEADY_BRAND:END -->

# Approval API

The approval API is the standalone control plane accepted by ADR-0031. Neon Postgres is authoritative;
OPA/Rego decides typed quorum; Firebase verifies human identity; Google workload identity verifies
ARBITER, deployment guards, and separated automation workloads; Cloud KMS signs every persisted
receipt.

This directory is bootstrap implementation only. It does not deploy the service, seed a principal,
execute genesis, approve HCP-0003, or authorize bee runtime work.

## Runtime contract

The Cloud Run runtime requires these non-secret environment variables:

| Variable | Purpose |
|---|---|
| `FIREBASE_PROJECT_ID` | Firebase project whose revoked-aware ID tokens identify human principals |
| `APPROVAL_SERVICE_AUDIENCE` | Exact audience accepted for Google workload ID tokens |
| `APPROVAL_KMS_KEY_VERSION` | Full enabled Cloud KMS Ed25519 crypto-key-version resource name |
| `PORT` | Cloud Run listener port |
| `LOG_LEVEL` | Structured logging threshold |

`DATABASE_URL` is injected from GCP Secret Manager through `@heady/secrets`. It must be the
TLS-enforced **pooled** Neon connection string for the least-privilege runtime login. Migration jobs
use a separate **direct** Neon connection string and never reuse the web runtime pool.

The runtime identity needs only:

- Cloud KMS public-key read and asymmetric-sign permission on the receipt key version;
- Secret Manager access to the pooled `DATABASE_URL`; and
- connection membership in the `heady_approval_api` database role.

It must not have Neon owner credentials, principal-seeding rights, bootstrap-table write access, or
access to founder/ARBITER evidence keys. Startup also rejects database/schema ownership, membership
in privileged Postgres roles, registry mutation grants, and any history rewrite or truncate grant.

## Build without deployment

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @heady/approvals build
pnpm --filter @heady/approvals test
pnpm --filter @heady/approval-api test
gcloud builds submit --config apps/approval-api/cloudbuild.yaml \
  --substitutions _IMAGE_TAG="$(git rev-parse HEAD)"
```

The Cloud Build file only builds and records the image. A human-controlled environment gate must
deploy the resulting digest, never a mutable tag.

The normal package build loads the committed WASM and verifies its source, artifact, compiler, and
entrypoint bindings without requiring a compiler on CI. When `policies/approval.rego` intentionally
changes, install OPA `1.18.2` using the
[official OPA installation instructions](https://www.openpolicyagent.org/docs/latest/#running-opa)
and recompile explicitly:

```bash
OPA_BIN=/absolute/path/to/opa pnpm --filter @heady/approvals policy:build
```

The compiler command rejects any other OPA version and runs `opa check --strict` before writing the
artifact.

## Autonomous approval lane

The machine lane uses two different workload principals: an `automation_requester` creates a
short-lived bounded request, while an `automation_guard` signs the exact-hash attestation. An
approved request can be consumed once through `/api/autonomous-protection`, which returns the
canonical authorization event and its KMS-signed receipt. Executors must verify that receipt
against a trusted registry key with `verifyAutonomousGrant`; an embedded public key is never its own
trust root.

The lane is limited to low-risk, reversible, dry-run-verified authorship, build-attestation, and
maintenance capabilities. Approval-system, patent, auth, secrets, infrastructure, deployment,
policy, and GitHub-control paths remain human-gated. See
[`AUTONOMOUS_APPROVAL_SIGNING.md`](../../docs/design/AUTONOMOUS_APPROVAL_SIGNING.md) for the protocol,
roles, provisioning boundary, and revocation behavior.

## Neon validation sequence

1. Create a temporary copy-on-write branch in the
   [Neon console](https://console.neon.tech/) or through the
   [Neon branching API](https://neon.com/docs/manage/branches).
2. Give the migration job the branch’s direct connection URL as `DATABASE_URL`.
3. Run `pnpm db:migrate` first; confirm that the expected ordered migrations are pending and that
   the chain ends with `0007_autonomous_approval_grants.sql`.
4. Run `pnpm db:migrate:apply` only against the temporary branch.
5. Run the integration suite with the temporary owner URL only for fixture setup and the
   least-privilege runtime URL for every service operation:

   ```bash
   TEST_DATABASE_URL=<temporary-direct-owner-url> \
   TEST_RUNTIME_DATABASE_URL=<temporary-pooled-runtime-url> \
   pnpm --filter @heady/approvals test:integration
   ```

6. Inspect the schema, append-only triggers, Data API denial, and test output; then delete the
   temporary branch.
7. Repeat the migration through the human production gate only after the security review and
   canonical genesis manifest are signed.

Neon documents why pooled connections belong in concurrent runtimes and direct connections belong in
migration sessions in its
[connection pooling guide](https://neon.com/docs/connect/connection-pooling).

## One-time genesis boundary

After the implementation commit is clean, the image and rollback images have immutable digests, and
the governance/security reports are content-addressed, run:

```bash
pnpm --filter @heady/approvals genesis:prepare -- \
  --deployment-manifest-sha256 <64-hex-sha256> \
  --deployment-artifact-digest <immutable-image-digest> \
  --rollback-artifact-digest <immutable-rollback-image-digest> \
  --governance-report-sha256 <64-hex-sha256> \
  --security-review-sha256 <64-hex-sha256> \
  --founder-public-jwk <founder-public-jwk-file> \
  --arbiter-public-jwk <arbiter-public-jwk-file> \
  --receipt-signer-public-jwk <receipt-public-jwk-file>
```

The preparer verifies the signed ADR tag and exact accepted Git objects, requires a clean committed
tree, binds the source/migration/policy/deployment/gate/key hashes, and prints the canonical manifest.
It cannot write Neon, deploy Cloud Run, create principals, or sign for the founder.

The remaining human gate is intentionally external:

1. review and sign the canonical manifest;
2. apply the migration to the approved production Neon branch using the direct role;
3. deploy the exact image digest;
4. insert the founder, ARBITER, deployment-guard, automation-requester, automation-guard, and public
   keys through the governed owner session;
5. insert the single `system_bootstrapped` event, KMS receipt, and `bootstrap` row in one transaction;
6. replay the complete chain; and
7. remove the owner session and verify the API role cannot write `bootstrap` or mint a second genesis.

Cloud KMS’s [asymmetric signing guide](https://cloud.google.com/kms/docs/create-validate-signatures)
describes the Ed25519 operation used here. Firebase’s
[ID-token verification guide](https://firebase.google.com/docs/auth/admin/verify-id-tokens) describes
the revoked-aware human authentication boundary.

## How the solo founder signs routine evidence

The service never signs a founder decision on the founder’s behalf. Create a distinct Ed25519 KMS
key whose asymmetric-sign permission is granted only to the founder identity, then export its public
JWK for the one-time principal registration:

```bash
pnpm --filter @heady/approval-api key:public -- \
  --key-version <founder-evidence-kms-key-version>
```

For one approval, save the exact `heady.approval.evidence.v1` envelope built from the approval ID,
payload hash, diff hash, policy hash, action, fresh nonce, short expiry, and decision detail. While
authenticated locally as the founder—not as the approval API service account—run:

```bash
pnpm --filter @heady/approval-api evidence:sign -- \
  --key-version <founder-evidence-kms-key-version> \
  --envelope <canonical-evidence-envelope.json>
```

Copy only the returned detached signature into the matching approve/reject request. The private key
never leaves KMS. The API reconstructs the envelope independently and rejects a changed action,
hash, nonce, expiry, detail field, or key.
