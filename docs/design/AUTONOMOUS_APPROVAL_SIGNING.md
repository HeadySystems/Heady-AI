<!-- ╔══════════════════════════════════════════════════════════════════╗ -->
<!-- ║  HEADY™ Autonomous Approval Signing v1.0.0                     ║ -->
<!-- ║  Machine approval and one-time signing authorization design.    ║ -->
<!-- ║  Made with ❤️ by HeadySystems Inc.               ║ -->
<!-- ╚══════════════════════════════════════════════════════════════════╝ -->

# Autonomous approval signing

This system lets an autonomous workload obtain a cryptographically verifiable,
one-time authorization without waiting for a human on each operation. It does
not let an agent impersonate a founder or hold the approval service's private
key. Activation and future changes to this control plane remain subject to the
founder plus external-security-review requirements in ADR-0031.

## Trust boundaries

| Principal | Credential | Authority |
|---|---|---|
| `automation_requester` | Audience-bound Google workload identity | Request and consume its own bounded grant |
| `automation_guard` | Separate workload identity plus registered Ed25519/KMS key | Independently attest the exact request hashes |
| Approval receipt signer | Non-exportable Cloud KMS Ed25519 key | Sign every control-plane transition and final authorization |
| Founder and external reviewer | Existing human identities and keys | Change this policy, its implementation, or protected scopes |

Requester and guard identities must be different principals. Private keys stay
in KMS/Vault and are never returned to an agent process. The Git authorship key
is separate and cannot satisfy an approval evidence slot.

## Allowed lane

An autonomous request must be low risk, reversible, dry-run verified, bounded
to at most 21 declared resources, and shorter than the φ-derived grant window.
The only capabilities are:

- `source_authorship`
- `build_attestation`
- `maintenance_execution`

Approval-system, patent, auth, secret, infrastructure, deployment, policy, and
GitHub-control paths fail closed into their existing human-reviewed lanes.
Production deployment remains governed by `/api/deployment-protection`.

## Protocol

1. The requester calls `POST /api/autonomous-approvals` with exact subject,
   diff, and rollback-plan SHA-256 values plus the bounded resource scope.
2. The service derives the requester from workload identity, creates a pending
   `autonomous_operation`, and emits a KMS-signed `autonomous_requested`
   receipt to the `heady.approval.autonomous_requested` outbox topic.
3. The independent guard reads the request, evaluates policy and dry-run
   evidence, signs the canonical evidence envelope with its registered key,
   and calls `POST /api/approvals/{approvalId}/attest`.
4. OPA approves only an exact-hash `automation_attestation` from a different,
   active guard principal. A `BLOCK` verdict rejects the request.
5. The original requester calls `POST /api/autonomous-protection` with all
   pinned hashes and a unique execution nonce.
6. In one Neon transaction, the service replays the complete signed history,
   re-evaluates the active policy, records a unique grant claim, and emits a
   KMS-signed `authorized` event. A second consumption fails closed.
7. A signing broker or autonomous executor calls `verifyAutonomousGrant` with
   a receipt-signing key loaded from its trusted registry, then signs or
   executes only the exact `subjectSha256`. Embedded keys are never trust roots.

The KMS receipt signs the authorization event hash. That event binds the
requester principal, execution nonce through `operationSha256`, canonical
payload hash, diff hash, policy hash, expiry, capability, and subject hash.

## Provisioning and revocation

Principal creation is deliberately not exposed over HTTP. A governed database
procedure registers one `automation_requester`, one or more independent
`automation_guard` principals, and only public Ed25519 JWKs. Workload audience
and service-account bindings are configured outside the application through
Vault/GCP IAM. Revoking either the principal or key immediately invalidates new
attestations; policy replay also fails when evidence is no longer active.

The migration adds no default principal and grants no agent access to a private
key. This prevents deployment from silently enabling autonomy before identity,
IAM, key registration, and external security review are complete.
