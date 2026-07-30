---
description: Prepare and verify the founder-controlled ADR-0031 approval ceremony for the single-use production principal-seeding and genesis executor
---

<!--
HEADY™ Approval Genesis Ceremony Workflow v1.0.0
Content-addressed founder approval without agent signing or production execution.
© 2026 HeadySystems Inc. — Eric Haywood, Founder
-->

# Heady™ Approval Genesis Ceremony

**Command:** `/heady-approve-genesis`

Prepare and verify the ADR-0031 founder approval for the production principal-seeding and
single-use genesis executor. This command creates evidence and exact human-run commands; it never
invokes a founder or service signing key and never mutates production.

## Invocation

```text
/heady-approve-genesis \
  executor=/absolute/path/to/execute.sql \
  verifier=/absolute/path/to/verify.sql \
  security_review=/absolute/path/to/external-security-review.pdf \
  security_review_signature=/absolute/path/to/external-security-review.pdf.asc \
  deployment_manifest=/absolute/path/to/deployment-manifest.yaml \
  governance_report=/absolute/path/to/governance-report.json \
  deployment_digest=sha256:<64-hex> \
  rollback_digest=sha256:<64-hex> \
  founder_jwk=/absolute/path/to/founder-public.jwk.json \
  arbiter_jwk=/absolute/path/to/arbiter-public.jwk.json \
  receipt_jwk=/absolute/path/to/receipt-public.jwk.json
  founder_key_version=projects/<project>/locations/<location>/keyRings/<ring>/cryptoKeys/<key>/cryptoKeyVersions/<version>
```

Optional named inputs:

- `implementation_commit` defaults to the canonical remote checkpoint commit.
- `neon_project` defaults to `cool-wind-37254039`.
- `neon_branch` defaults to `br-hidden-union-aabqn03y`.
- `founder_gpg_fingerprint` defaults to
  `1050B59E7296C46C26DDF95DA7D2108BB3C6101C`.

If a required input is absent, stop after listing the missing names and the exact command needed to
resume. Never infer a digest, key path, review artifact, or production target.

## Permanent boundaries

1. Never invoke `git tag -s`, `gpg`, `genesis:sign`, Cloud KMS signing, or another founder/service
   signing operation.
2. Never apply a production migration, deploy Cloud Run, create a production database role, seed a
   principal, insert a bootstrap row, mint the genesis receipt, or execute the genesis bundle.
3. Never read, print, copy, or request private-key material or raw secret values.
4. Never treat chat approval, a second founder-controlled key, an agent, or ARBITER as the mandatory
   external human security review.
5. Never authorize HCP-0003, bee runtime work, or reuse of the bootstrap exception.
6. Fail closed on a dirty canonical worktree, changed hash, missing signature, noncanonical target,
   mutable image tag, or verification discrepancy.

## Phase 1 — Establish canonical context

1. Read:
   - `AGENTS.md`
   - `docs/adr/0031-solo-founder-approval-bootstrap.md`
   - `docs/design/APPROVAL_SERVICE_BOOTSTRAP_SPEC.md`
   - `apps/approval-api/README.md`
   - `packages/approvals/bin/prepare-genesis-manifest.mjs`
2. Fetch the canonical checkpoint branch without changing the user's worktree.
3. Resolve the implementation commit from
   `origin/checkpoint/rebuild-substrate-2026-07-23` unless explicitly supplied.
4. Verify `adr-0031-accepted-e064a8943` and its pinned commit, tag object, signer, and fingerprint.
5. Inspect production Neon read-only and confirm the supplied project and branch IDs. Do not run SQL
   that can write, lock application tables, create roles, or change endpoint state.

## Phase 2 — Validate the ceremony inputs

1. Require every supplied file to be absolute, readable, regular, and outside the repository
   worktree.
2. Verify the external review's detached signature against a public key owned by a human other than
   the founder. Record the reviewer identity and key fingerprint.
3. Validate:
   - both OCI digests match `sha256:[a-f0-9]{64}`;
   - deployment and rollback digests differ;
   - each JWK is public Ed25519 verification material without private fields;
   - the deployment manifest names the exact Neon target, digest-pinned image, rollback digest,
     runtime service account, receipt KMS key version, and single-use constraints;
   - the executor starts one explicit transaction, fails when bootstrap already exists, validates
     exact row counts and hashes before commit, and has no reusable bypass;
   - the verifier is read-only and checks the complete hash chain, public keys, receipt signature,
     singleton bootstrap row, disabled genesis path, and runtime-role denials.
4. Compute SHA-256 for the executor, verifier, security review, deployment manifest, governance
   report, and public JWK files without printing their contents.
5. Run repository governance, law, secret, coherence, projection, DB, approval-package, and approval
   API verification. Confirm the disposable-Neon integration evidence remains successful.

## Phase 3 — Emit the founder executor-approval ceremony

Construct, but do not execute, an annotated signed-tag command with:

- tag name `approval-genesis-executor-<first-12-executor-hash>`;
- implementation commit;
- executor and verifier SHA-256 values;
- external security-review SHA-256 and reviewer fingerprint;
- deployment and rollback OCI digests;
- Neon project and branch IDs;
- `maximum-executions: 1`;
- `hcp-0003-authorized: false`;
- `bee-runtime-authorized: false`; and
- the pinned founder GPG fingerprint.

Display the exact `git tag -s`, `git tag --verify`, and `git push origin refs/tags/...` commands in
one copyable block. Then stop and instruct the founder to run the block personally.

## Phase 4 — Verify the founder approval

Resume only after the founder reports that the tag is pushed.

1. Fetch the exact tag.
2. Verify the OpenPGP signature and founder fingerprint.
3. Parse the tag message and compare every bound value with the locally recomputed values.
4. Resolve and record the immutable tag object ID.
5. Require the deployment manifest to bind the executor hash, verifier hash, founder approval tag,
   tag object ID, review hash, production target, and single-use constraints.
6. If adding the tag object ID changes the deployment manifest, recompute its hash and require the
   final manifest to be reviewed before continuing.

## Phase 5 — Prepare the canonical genesis manifest

In a clean detached worktree at the approved implementation commit:

1. Run `pnpm --filter @heady/approvals genesis:prepare` with the verified deployment manifest,
   deployment and rollback digests, governance and security hashes, and public JWK paths.
2. Write output only to the founder-controlled ceremony directory outside the repository.
3. Extract `canonicalManifest` into `genesis-manifest.json`.
4. Recompute its SHA-256 and compare it with the preparer's `manifestSha256`.
5. Emit, but do not execute, the exact founder command:

   ```text
   pnpm --filter @heady/approval-api founder:terminal -- \
     --key-version <full-founder-kms-key-version>

   pnpm --filter @heady/approval-api genesis:sign -- \
     --key-version <full-founder-kms-key-version> \
     --manifest <absolute-genesis-manifest-path> \
     --confirm-manifest-sha256 <verified-manifest-sha256>
   ```

6. Require the full immutable KMS key-version name and the independently verified manifest hash as
   explicit arguments. Never select `latest`, infer a key version, or substitute the receipt or
   ARBITER key.
7. Stop for the founder to invoke the key personally from a founder-authenticated terminal.

## Phase 6 — Final handoff

After the founder signature is present:

1. Verify the KMS signature envelope, signer fingerprint, canonical manifest hash, signed executor
   tag, and all transitive bindings.
2. Produce a final stage-0 checklist with:
   - immutable implementation commit;
   - signed approval tag and tag object;
   - executor and verifier hashes;
   - deployment and rollback image URIs by digest;
   - governance and external-review hashes;
   - public-key fingerprints;
   - Neon target;
   - migration checksum;
   - exact audit and disablement acceptance criteria.
3. Report `READY FOR FOUNDER-CONTROLLED EXECUTION` only when every item passes.
4. End without production mutation. State explicitly that the founder must run the reviewed executor
   through the one-time owner session and that the agent may perform only read-only post-run
   verification.

## Success criteria

- Every authorization is cryptographically bound to exact content.
- External human review and founder approval remain distinct.
- The approval tag and canonical manifest verify against the pinned founder key.
- The executor remains single-use, target-specific, and incapable of authorizing HCP-0003.
- No signing key is invoked and no production resource is changed by this command.
