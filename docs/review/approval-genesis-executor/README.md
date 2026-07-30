<!-- HEADY_BRAND:BEGIN
Heady™ Single-Use Genesis Executor External Review Bundle v1.0.0
© 2026 HeadySystems Inc. — Eric Haywood, Founder
HEADY_BRAND:END -->

# Single-use genesis executor and verifier

## Review status

This directory describes a proposal for external human review. Authoring and testing the proposal
does not authorize or execute it. The executor is not a deployment tool and cannot apply migration
`0004`, deploy an image, authorize HCP-0003, create bee runtime code, export a private key, or make a
second bootstrap transaction.

The pinned target is:

- Neon project `cool-wind-37254039`;
- branch `production` (`br-hidden-union-aabqn03y`); and
- database `neondb`.

The executable review scope is declared in
`apps/approval-api/genesis-review-scope.json`. Its canonical digest includes the executor, verifier,
cryptographic helpers, approval policy source and WASM, migration, ADR/specification, package lock,
and this runbook. A human must compare and explicitly confirm that digest at invocation time.

## Security properties to review

The executor:

1. requires the identity-checked founder terminal, a revoked-aware Firebase founder token, and
   rejects service-account credential overrides;
2. validates the founder-signed canonical manifest without invoking the founder key;
3. verifies the accepted ADR tag, clean implementation commit, source tree, migration, policy,
   deployment manifest, governance report, security review, and three distinct public-key
   fingerprints;
4. uses the read-only Neon API to prove the direct connection hostname belongs to the one pinned
   production read-write compute;
5. requires migration `0004` with its signed checksum and an entirely empty approval schema;
6. seeds only the founder, ARBITER, deployment guard, two evidence public keys, and one distinct
   receipt-signing public key;
7. creates one draft `HCP-0031` approval, one `system_bootstrapped` event, one KMS-signed receipt,
   one outbox row, one immutable bootstrap singleton, and one successful replay snapshot in one
   serializable transaction; and
8. rolls back the transaction if any constraint, KMS signature, receipt binding, or replay fails.

The verifier opens the owner connection in a PostgreSQL `READ ONLY` transaction, independently
checks every binding and replays the policy/event/receipt chain, then uses the pooled runtime URL to
prove the runtime identity is least privilege and cannot mutate the bootstrap or registries.

Post-commit database deletion is deliberately absent. The approval history is append-only. A failed
transaction rolls back automatically; a successful genesis is immutable. The separately recorded
rollback artifact digest governs application rollback without erasing the genesis record.

## Required human-supplied artifacts

All JSON inputs must contain public or review material only. Private keys, database passwords, bearer
tokens, and API keys must not appear in files or command arguments.

- Canonical `genesis-manifest.json`.
- Founder-generated `genesis-manifest.signature.json`.
- `genesis-principal-seed.json` matching this strict shape:

```json
{
  "schema": "heady.approval.genesis.principals.v1",
  "firebaseProjectId": "heady-ai",
  "founder": {
    "stableIdentifier": "founder-eric-haywood",
    "firebaseUid": "the verified Firebase UID",
    "verifiedEmail": "eric@headyconnection.org",
    "publicJwk": {
      "kty": "OKP",
      "crv": "Ed25519",
      "x": "the 43-character public x coordinate"
    }
  },
  "arbiter": {
    "stableIdentifier": "arbiter-workload",
    "workloadIdentity": "the exact deployed ARBITER workload subject",
    "publicJwk": {
      "kty": "OKP",
      "crv": "Ed25519",
      "x": "the 43-character public x coordinate"
    }
  },
  "deploymentGuard": {
    "stableIdentifier": "github-deployment-guard",
    "workloadIdentity": "the exact deployed guard workload subject"
  }
}
```

- The exact deployment manifest, governance report, and external security-review report whose
  SHA-256 values are in the signed manifest.
- A direct one-time owner URL in `HEADY_GENESIS_DATABASE_URL`.
- The separate pooled least-privilege URL in `HEADY_APPROVAL_RUNTIME_DATABASE_URL`.
- A read-only-capable Neon API key in `NEON_API_KEY`.
- The full, immutable receipt KMS crypto-key-version name in `HEADY_RECEIPT_KEY_VERSION`.
- The pinned `FIREBASE_PROJECT_ID=heady-ai` and the public Firebase Web API key in
  `FIREBASE_WEB_API_KEY`. The founder terminal obtains and revoked-aware verifies a short-lived ID
  token; it does not print or persist the token.

Resolve secrets through the approved secret manager into the ephemeral process environment. Do not
source a repository `.env` file for this ceremony.

## External review and authorization

From a clean detached worktree at the implementation commit, the reviewer may compute the proposal
digest without connecting to Neon or invoking KMS:

```bash
pnpm --filter @heady/approval-api genesis:bundle:hash \
  > "$HEADY_STAGE0_DIR/genesis-review-bundle.json"
```

Review every path in the emitted record and independently recompute its file hashes. The human
authorization must name the emitted `bundleSha256`, the canonical manifest SHA-256, the pinned Neon
project/branch/database, and the deployment and rollback digests. A text containing `<hash>` or any
other placeholder is not authorization.

## One-time founder invocation

Only after the external review and explicit exact-hash authorization, open the founder terminal and
inject the database, Neon, and receipt-key values through the approved secret manager. Configure the
public Firebase client values, then open the terminal:

```bash
export FIREBASE_PROJECT_ID="heady-ai"
export FIREBASE_WEB_API_KEY="<public Web API key from Firebase Project Settings>"

pnpm --filter @heady/approval-api founder:terminal -- \
  --key-version "$HEADY_FOUNDER_KEY_VERSION" \
  --firebase-email "eric@headyconnection.org"
```

The public Web API key is listed under
[Firebase project settings for `heady-ai`](https://console.firebase.google.com/project/heady-ai/settings/general/).
If password sign-in is used, confirm the Email/Password provider is already enabled in
[Firebase Authentication](https://console.firebase.google.com/project/heady-ai/authentication/providers);
do not create a second founder account.

The terminal prompts for the Firebase password with terminal echo disabled, requests a fresh ID
token over HTTPS, and immediately calls Firebase Admin `verifyIdToken(token, true)`. It opens the
shell only when the token is unrevoked, recently authenticated, issued by `heady-ai`, email-verified,
and one of the two founder aliases. The executor then additionally requires the token UID and email
to equal the externally reviewed principal seed.

If the founder account uses a non-password provider, obtain a force-refreshed ID token from the
already authenticated Firebase client and inject `HEADY_FOUNDER_ID_TOKEN` into the founder terminal
through the approved secret manager. The same revoked-aware, project, freshness, UID, and email
checks still run; a custom token or Firebase CLI token is not accepted as an ID token.

Inside the resulting ephemeral shell, the proposed executor command is:

```bash
HEADY_EXECUTION_RESULT_TMP="$(mktemp "$HEADY_STAGE0_DIR/genesis-execution-result.XXXXXX")"
pnpm --filter @heady/approval-api genesis:execute -- \
  --manifest "$HEADY_STAGE0_DIR/genesis-manifest.json" \
  --manifest-signature "$HEADY_STAGE0_DIR/genesis-manifest.signature.json" \
  --principal-seed "$HEADY_STAGE0_DIR/genesis-principal-seed.json" \
  --deployment-manifest "$HEADY_STAGE0_DIR/deployment-manifest.json" \
  --governance-report "$HEADY_STAGE0_DIR/governance-report.json" \
  --security-review "$HEADY_STAGE0_DIR/security-review.json" \
  --confirm-target "cool-wind-37254039/br-hidden-union-aabqn03y/neondb" \
  --confirm-manifest-sha256 "$HEADY_GENESIS_MANIFEST_SHA256" \
  --confirm-bundle-sha256 "$HEADY_GENESIS_BUNDLE_SHA256" \
  > "$HEADY_EXECUTION_RESULT_TMP" &&
mv "$HEADY_EXECUTION_RESULT_TMP" "$HEADY_STAGE0_DIR/genesis-execution-result.json"
```

This command is intentionally not part of CI, deployment startup, a shell profile, a git hook, or an
agent workflow.

## Independent read-only verification

After the executor returns exactly one result, leave the owner URL available only long enough for
the external reviewer to run:

```bash
HEADY_VERIFICATION_RESULT_TMP="$(mktemp "$HEADY_STAGE0_DIR/genesis-verification-result.XXXXXX")"
pnpm --filter @heady/approval-api genesis:verify -- \
  --manifest "$HEADY_STAGE0_DIR/genesis-manifest.json" \
  --manifest-signature "$HEADY_STAGE0_DIR/genesis-manifest.signature.json" \
  --principal-seed "$HEADY_STAGE0_DIR/genesis-principal-seed.json" \
  --deployment-manifest "$HEADY_STAGE0_DIR/deployment-manifest.json" \
  --governance-report "$HEADY_STAGE0_DIR/governance-report.json" \
  --security-review "$HEADY_STAGE0_DIR/security-review.json" \
  --confirm-target "cool-wind-37254039/br-hidden-union-aabqn03y/neondb" \
  --confirm-manifest-sha256 "$HEADY_GENESIS_MANIFEST_SHA256" \
  --confirm-bundle-sha256 "$HEADY_GENESIS_BUNDLE_SHA256" \
  > "$HEADY_VERIFICATION_RESULT_TMP" &&
mv "$HEADY_VERIFICATION_RESULT_TMP" "$HEADY_STAGE0_DIR/genesis-verification-report.json"
```

The reviewer must require `auditReplayValid: true`, `runtimeLeastPrivilege: true`,
`bootstrapCount: 1`, and matching manifest, event, receipt, report, and review-bundle hashes. Then
revoke or discard the one-time owner credential, keep only the pooled runtime secret, and retain all
canonical artifacts in the founder-controlled audit archive.

Neon documents the project/branch/compute relationship and API endpoint metadata in its
[compute management guide](https://neon.com/docs/manage/endpoints/), and recommends direct
connections for migrations with pooled connections for concurrent runtimes in its
[connection pooling guide](https://neon.com/docs/connect/connection-pooling).
