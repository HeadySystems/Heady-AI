<!-- HEADY_BRAND:BEGIN
Heady™ Approval Service Bootstrap Specification v1.0.0
© 2026 HeadySystems Inc. — Eric Haywood, Founder
HEADY_BRAND:END -->

# Approval Service Bootstrap Specification

## Status and scope

**Status:** Accepted for implementation by the founder-signed ADR-0031 tag
`adr-0031-accepted-e064a8943`. This document does not authorize production deployment, execute the
one-time genesis procedure, or approve a downstream HCP.

The approval service is the authoritative control plane for HCP decisions, independent attestations,
policy evaluation, and signed receipts. Neon Postgres is its source of truth. HeadyLens, GitHub checks,
and UI views are derived projections and cannot mutate approval state.

## System boundaries

| Component | Responsibility | Must not do |
|---|---|---|
| `@heady/approvals` | Schemas, canonicalization, state machine, policy input, receipt verification | Hold private keys or perform HTTP authentication |
| Approval API | Authenticate principals, transact events, invoke policy, request receipt signatures | Trust client-claimed identities or apply code |
| Neon approval schema | Authoritative proposals, append-only events, receipts, principals | Expose tables through the Data API role |
| Policy evaluator | Return typed evidence requirements and allow/deny reasons | Mint receipts or mutate records |
| Receipt signer | Sign canonical receipt envelopes through HeadyVault | Decide policy or expose key material |
| ARBITER adapter | Submit exact-diff claim-scope attestations | Impersonate a human approver |
| GitHub protection adapter | Translate approved, unexpired records into deployment/check results | Override a denied or expired policy result |

`@heady/codeflow` may supply a validated, non-applied diff and its hash. Approval state remains owned
by `@heady/approvals`; codeflow cannot promote its local `approved` state into an HCP approval.

## Canonical data model

Internal primary keys are UUIDs, timestamps are `TIMESTAMPTZ`, and external approval identifiers are
ULIDs with unique constraints.

### `heady_approval.principals`

- internal UUID primary key;
- stable principal identifier and principal type: `human`, `service`, or `external_reviewer`;
- verified Firebase UID/email for humans or workload identity for services;
- allowed evidence classes;
- active/revoked timestamps and revocation reason;
- immutable identity fields and creation timestamp.

One human controlling multiple keys remains one principal.

### `heady_approval.principal_keys` and `heady_approval.receipt_signing_keys`

- multiple Ed25519 public-key versions per principal, each with a canonical fingerprint;
- a separate registry for KMS receipt-signing key versions;
- immutable key identity fields and irreversible revocation; and
- historical public keys retained so old evidence and receipts remain replayable.

### `heady_approval.approvals`

- internal UUID primary key and external ULID;
- HCP identifier, title, subject type, patent-lock flag, and exact zone paths;
- canonical payload SHA-256 and exact proposed diff SHA-256;
- state: `draft`, `pending`, `approved`, `rejected`, `expired`, or `superseded`;
- policy version/hash, required evidence classes, expiry, and superseding record;
- creator principal, trace ID, idempotency key, and standard timestamps.

The payload or diff hash cannot change after transition to `pending`. A changed diff creates a new
approval or superseding version.

### `heady_approval.events`

- append-only UUID primary key, approval UUID, and monotonically increasing sequence;
- event type, actor principal, evidence class, decision, reason, and canonical event hash;
- previous-event hash for tamper-evident chaining;
- trace ID, idempotency key, and event timestamp;
- actor evidence and policy result snapshots stored as validated JSON.

Database permissions deny `UPDATE` and `DELETE`. A trigger rejects mutation even for the API role.

### `heady_approval.receipts`

- append-only UUID primary key and approval event reference;
- canonical receipt payload and SHA-256;
- signing key identifier, algorithm, detached signature, and public JWK version;
- verification status and audit-replay timestamp.

Ed25519 is the current baseline established by the HCP reconciliation. ML-DSA can be added as a
parallel signature without invalidating the baseline receipt.

### `heady_approval.bootstrap`

Exactly one row is permitted. It records the ADR-0031 accepted commit/tag and pinned signer
fingerprint, canonical genesis manifest hash, migration checksum, deployment and rollback artifact
digests, founder principal, and bootstrap event.

### `heady_approval.outbox` and `heady_approval.audit_replays`

The outbox stores one immutable typed projection record per authoritative event; only retry timing,
attempt count, and terminal dispatch time can change. Audit-replay rows are append-only verification
snapshots and never replace the event chain as authority.

## State machine

```text
draft → pending → approved
                ↘ rejected
                ↘ expired
draft|pending|approved → superseded
```

Rules:

- only `draft` records may be submitted;
- submission requires a non-null payload hash and diff hash;
- evidence events append only while `pending`;
- rejection is terminal;
- expiry is computed from the canonical φ-derived approval lifetime;
- policy is re-evaluated transactionally after every valid evidence event;
- an approved record becomes unusable if its diff, policy hash, key status, or expiry no longer match;
- no endpoint provides bulk approval.

## Typed quorum policy

The initial policy version implements the accepted typed policy:

| Change class | Required evidence |
|---|---|
| Standard sensitive | One verified founder decision |
| Patent-locked | Founder decision plus ARBITER `ALLOW` bound to the same diff |
| Patent with ARBITER `ESCALATE` | Founder decision plus external human approval; escalation resolved |
| Approval-system/stage-0 after genesis | Founder decision plus external human security approval |
| Renovate patch-only | Separate narrow automation rule; never applies to patent, auth, policy, signer, or stage-0 paths |

Policy must reject:

- duplicate evidence from one principal;
- two keys belonging to one principal counted twice;
- client-supplied actor identity;
- missing or changed diff hashes;
- expired or revoked keys;
- ARBITER attestations without the exact claim list and reviewed path set;
- founder decisions submitted through a service credential;
- any attempt by the approval service to relax its own active policy.

## API contract

All request bodies use Zod validation. Mutations require an idempotency key and emit a trace ID.
Authenticated endpoints derive actor identity from verified credentials.

| Method and route | Purpose |
|---|---|
| `POST /api/approvals` | Create a draft from a canonical HCP payload |
| `POST /api/approvals/:id/submit` | Freeze hashes and transition to pending |
| `GET /api/approvals/:id` | Return state, evidence requirements, receipt verification, and history |
| `POST /api/approvals/:id/approve` | Record an authenticated human decision |
| `POST /api/approvals/:id/reject` | Record a terminal human rejection |
| `POST /api/approvals/:id/attest` | Record an authenticated ARBITER or reviewer attestation |
| `POST /api/approvals/:id/supersede` | Link a replacement proposal without mutating history |
| `POST /api/approvals/:id/verify` | Re-run receipt and policy verification without changing decision evidence |
| `GET /api/approvals/:id/receipts` | Return public verification material and redacted envelopes |
| `POST /api/deployment-protection` | Answer GitHub protection requests from approved, matching records |

Mutation responses include the approval ID, state, policy version/hash, missing evidence classes, event
sequence, receipt identifier, receipt verification state, and trace ID. They never return private key
material, raw bearer tokens, or unredacted authentication evidence.

## Authentication and signing

### Human founder

- Verify the Firebase ID token at the trusted boundary.
- Require verified email and a matching active founder principal.
- Require an explicit per-decision signing ceremony; a background session cannot approve silently.
- Bind the ceremony to approval ID, decision, payload hash, diff hash, policy hash, nonce, and expiry.

### ARBITER and external reviewers

- ARBITER authenticates as a separately registered workload identity.
- The attestation includes verdict, exact patent claims, reviewed paths, diff hash, rationale hash, and
  escalation state.
- External reviewers authenticate as human principals and cannot reuse the founder principal.

### Receipt signer

- Resolve signer access through HeadyVault and GCP-managed secret infrastructure.
- Keep keys unavailable to application logs, database rows, agents, and client processes.
- Rotate by adding a new public-key version; retain old public keys for historical verification.
- Fail closed when signing or public-key resolution is unavailable.

## Transaction and consistency requirements

One database transaction must:

1. lock the approval record;
2. enforce current state and idempotency;
3. append the next hash-chained event;
4. evaluate the pinned policy version;
5. update only the materialized approval state;
6. request and persist the signed receipt;
7. append a typed `heady.approval.*` outbox event for NATS/HeadyLens/GitHub projections.

If signing fails, the decision event is not committed. Derived projection failure does not roll back
the authoritative decision; the transactional outbox retries projection delivery with φ-backoff.

## Security threat model

| Threat | Required control |
|---|---|
| Agent self-approval | Human/service credential separation; actor derived server-side |
| Founder counted twice | Stable principal identity; uniqueness by evidence class and principal |
| Payload or diff swapping | Canonical hashes frozen at submit and checked at every use |
| Replay | Nonce, expiry, idempotency key, event sequence, and decision-specific signature |
| Database history rewrite | Append-only grants, mutation-rejecting trigger, hash chain, audit replay |
| Signer compromise | Managed key access, versioning, revocation, bounded service identity |
| Policy downgrade | Policy hash pinned into every event/receipt; stage-0 review for changes |
| ARBITER collusion or uncertainty | Separate identity, exact-diff evidence, mandatory human escalation |
| Approval after code changes | Deployment adapter compares live artifact/diff hash and denies mismatch |
| API outage | Fail closed; no manual HCP table edits or unsigned fallback |
| Data API exposure | No grants to `authenticated`; backend-only least-privilege role |

## Genesis manifest

The stage-0 manifest binds:

- ADR-0031 accepted Git object;
- this specification hash;
- complete approval-service source-tree hash;
- policy and schema migration hashes;
- deployment artifact digest;
- authorized founder and ARBITER public-key fingerprints;
- rollback artifact digest;
- governance and security gate outputs.

The bootstrap procedure is single-use and external to the agent runtime. The generated bootstrap event
is the first event verified by audit replay.

## Verification matrix

The implementation is not deployable until tests prove:

- every legal and illegal state transition;
- Zod rejection of malformed inputs;
- one principal cannot satisfy two evidence slots;
- service credentials cannot issue human decisions;
- founder credentials cannot issue ARBITER attestations;
- diff changes invalidate approval;
- expired and revoked keys fail;
- event mutation and deletion fail at the database layer;
- receipt signatures verify and tampering fails;
- idempotent retries produce one event and one receipt;
- concurrent decisions produce a monotonic sequence;
- signer failure rolls back the transaction;
- outbox projection retries do not duplicate authoritative events;
- Data API roles cannot read or write approval tables;
- GitHub protection denies mismatched artifacts;
- genesis can run once and only once.

Required repository gates are law-lint, governance, no-loopback, glass-box, secret-scan, Zod boundary,
φ-timing, coherence, database migration tests, API unit tests, and a temporary-Neon-branch migration
verification.

## Rollout

1. Founder reviews and explicitly accepts ADR-0031 through the external stage-0 process.
2. Build the package, API, policy, migration, tests, and audit replay as one bounded platform bet.
3. Generate and founder-sign the genesis manifest outside the agent runtime.
4. Verify the migration on a temporary Neon branch.
5. Merge and deploy through a human-controlled environment gate.
6. Run genesis once, verify audit replay, then permanently disable genesis.
7. Submit HCP-0003 with its exact non-applied diff.
8. Collect the typed patent quorum and request final ARBITER review.

No bee runtime implementation or production deployment is authorized by this specification.
