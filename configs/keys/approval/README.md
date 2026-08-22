# Approval control-plane public verification keys

Bare Ed25519 public JWKs, in the exact shape `publicJwkFingerprint()` and
`packages/approvals/bin/prepare-genesis-manifest.mjs --*-public-jwk` consume. Private key bytes never
leave Cloud KMS and are never committed.

| File | Role | KMS crypto-key-version | `publicJwkFingerprint` |
|---|---|---|---|
| `founder-evidence.public.jwk.json` | `founder_decision` | `projects/heady-ai/locations/global/keyRings/heady-approval/cryptoKeys/founder-evidence/cryptoKeyVersions/1` | `0f7753c16b03420af64a6415a746239d67a3e64a88c9177bca27c29b56a378ed` |
| `receipt-signing.public.jwk.json` | receipt signer | `projects/heady-ai/locations/global/keyRings/heady-approval/cryptoKeys/receipt-signing/cryptoKeyVersions/1` | `e9dfdcb1cd80f69a010e6e1b24daf0447a0074f72c7065d4f45bad7a8cbc64ba` |

Both are `EC_SIGN_ED25519`, version `1`, state `ENABLED`.

Regenerate (read-only; needs `cloudkms.cryptoKeyVersions.viewPublicKey`):

```bash
pnpm --filter @heady/approval-api key:public --key-version <crypto-key-version>
```

Rotation adds a new file and a new `heady_approval.principal_keys` / `receipt_signing_keys` row; old
public keys stay so historical evidence and receipts remain replayable.

`arbiter-attestation.public.jwk.json` is intentionally absent — that KMS key does not exist yet and
must be created under an identity independent of the founder's, or the typed patent quorum is one
person wearing two hats. See `docs/runbooks/APPROVAL_GENESIS_FOUNDER_RUNBOOK.md`.

## arbiter-attestation (added 2026-08-22)

| Field | Value |
|---|---|
| Key version | `projects/heady-ai/locations/global/keyRings/heady-approval/cryptoKeys/arbiter-attestation/cryptoKeyVersions/1` |
| Algorithm | `EC_SIGN_ED25519`, state `ENABLED` |
| `publicJwkFingerprint` | `cc7151dd68a5bd20364c28753ad2689678b2646e9891c6705dc1bd3777c076b8` |
| Signing principal | `heady-arbiter@heady-ai.iam.gserviceaccount.com` (sole `roles/cloudkms.signerVerifier` binding, zero user-managed keys) |

⚠️ Provisioned but not yet *independent*: project-level `roles/owner` can impersonate that service
account, and the owner list includes the identity that also signs founder evidence. See the ARBITER
independence warning in `docs/runbooks/APPROVAL_GENESIS_FOUNDER_RUNBOOK.md` STEP 3 before relying on
this key as a second evidence channel.
