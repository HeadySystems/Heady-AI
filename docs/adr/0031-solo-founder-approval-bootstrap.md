<!-- HEADY_BRAND:BEGIN
Heady™ ADR-0031 — Solo-Founder Approval-System Bootstrap
© 2026 HeadySystems Inc. — Eric Haywood, Founder
HEADY_BRAND:END -->

# ADR-0031: Solo-Founder Approval-System Bootstrap

- **Status:** Accepted (2026-07-24)
- **Decider:** Eric Anthony Haywood
- **Acceptance:** Founder-signed tag `adr-0031-accepted-e064a8943`
- **Security review:** Required again on the complete implementation before genesis
- **Implementation spec:** `docs/design/APPROVAL_SERVICE_BOOTSTRAP_SPEC.md`

## Context

ADR-0005 requires human approval for sensitive agent-authored changes, ADR-0013 deliberately makes
founder attention the governance bottleneck, and ADR-0016 makes stage 0 external and permanently
agent-untouchable. The HCP design adds a stronger rule for patent-locked changes: the approval service
must bind the exact diff, persist append-only events in Neon, and issue verifiable signed receipts.

The approval service has not been built. `@heady/approvals`, `policies/approval.rego`, the authorized
principal registry, and the Neon approval tables are absent. Requiring that undeployed service to
approve its own first deployment creates a genesis loop. HCP-0003 also assumes two independent
approvers, while HeadySystems currently has one human engineer. Counting two keys, email aliases, or
agent personas controlled by the same person would manufacture independence rather than provide it.

The system needs one explicit genesis path and a durable solo-founder quorum that preserves human
accountability without pretending one founder is two humans.

## Decision

This ADR establishes the following model. The founder activated its implementation authority through
the stage-0 acceptance record below.

### 1. Replace untyped counts with a typed quorum

Approval policy evaluates evidence classes, not an undifferentiated number of signatures:

- **Founder decision:** exactly one affirmative decision from a verified human founder principal.
- **Independent technical attestation:** an `ALLOW` attestation from the separately authenticated
  ARBITER service, bound to the same proposal ID, canonical payload hash, and exact diff hash.
- **External human review:** required whenever ARBITER returns `ESCALATE`, cannot resolve claim
  exclusions, detects a conflict of interest, or the proposal changes the approval system itself
  after genesis.

Standard sensitive changes require the founder decision. Patent-locked changes require both the
founder decision and ARBITER attestation. An external human resolves a recorded ARBITER escalation
or may supplement an `ALLOW`; they do not silently replace a missing technical attestation. An agent
attestation is never described or stored as a human approval.

The policy expression is conceptually:

```text
standard_allow = founder_approvals >= 1
patent_allow   = founder_approvals >= 1
               AND (
                 (arbiter_allows >= 1 AND arbiter_escalations == 0)
                 OR
                 (arbiter_escalations >= 1 AND external_human_resolutions >= 1)
               )
```

Distinct keys owned by the same human remain one principal. Service identities cannot issue founder
decisions. The founder cannot issue ARBITER attestations.

### 2. Permit one narrowly scoped genesis exception

The exception authorizes only the first approval-system deployment. It cannot authorize HCP-0003,
other patent implementations, production feature deployment, or a later approval-service change.

The founder-controlled stage-0 process must:

1. Bind this ADR, the implementation specification, the complete approval-system diff, migration
   checksum, deployment manifest, and public verification keys into one canonical SHA-256 manifest.
2. Record explicit founder acceptance outside the agent runtime using a cryptographically signed Git
   commit or tag whose object ID is stored in the genesis manifest.
3. Require a clean security review and all repository governance gates.
4. Apply the Neon migration through the established temporary-branch migration workflow.
5. Deploy the approval API through a human-controlled environment gate.
6. Insert one immutable `approval.system_bootstrapped` event containing the manifest hash and signed
   Git object ID.
7. Disable the genesis path permanently after audit replay verifies the initial event and keys.

An AI agent may author the proposal and implementation PR. It may not accept this ADR, invoke the
founder's signing key, edit stage-0 protected files, add itself as a principal, or execute the
human-controlled deployment.

### 3. Preserve separation between decisions and receipt minting

Authentication proves who acted; policy determines whether the evidence is sufficient; the receipt
signer proves what the service recorded. These are separate responsibilities:

- Founder authentication uses a verified Firebase identity plus an explicit signing ceremony.
- ARBITER uses a separately registered service identity and signing key.
- The approval API canonicalizes the event, verifies actor evidence, evaluates policy, and mints the
  immutable receipt.
- Private signing material is resolved through HeadyVault and GCP-managed secret infrastructure; it
  is never committed, returned to clients, or made available to agents.

### 4. Keep approval-system governance stronger after genesis

After bootstrap, changes to the approval service, policy, signer registry, receipt verifier, stage-0
paths, or CODEOWNERS require:

- founder approval;
- external human security review;
- ARBITER attestation where patent scope is involved;
- an exact diff hash and rollback plan;
- successful audit replay before rollout completion.

The approval service cannot approve a change to its own verifier or quorum policy using only its
current automated policy result.

### 5. HCP-0003 remains blocked

This ADR does not approve HCP-0003. That proposal must be submitted after the approval service is
operational, bind a non-applied exact diff, receive the typed patent quorum, reach `approved`, and
return to ARBITER for final review before any `packages/bees` file is created.

## Consequences

- (+) A solo founder has an honest two-channel governance model without fake human identities.
- (+) Patent changes retain independent claim-scope review and fail closed on uncertainty.
- (+) The one-time bootstrap is explicit, content-addressed, auditable, and non-reusable.
- (+) Agents never gain access to founder or service signing keys.
- (−) The founder remains a throughput bottleneck by design.
- (−) Approval-system changes after genesis require an external human reviewer.
- (−) ARBITER attestation is technical governance, not legal advice; escalated patent questions still
  require qualified human review.

## Alternatives considered

- **Count two founder-controlled keys as two approvers.** Rejected because key diversity is not
  principal independence.
- **Allow the agent to sign for the founder.** Rejected because it transfers human accountability to
  the actor requesting approval.
- **Reduce patent changes to one untyped approval.** Rejected because it silently weakens the existing
  control.
- **Block all work until a second employee exists.** Rejected because a typed independent technical
  attestation provides a practical pre-employment governance path while preserving escalation.
- **Use Git signatures as ordinary HCP receipts.** Rejected. A signed Git object is permitted only as
  the one-time genesis anchor; routine approvals must use the approval API.

## Acceptance record

The founder accepted this ADR on 2026-07-24 through the annotated, OpenPGP-signed tag
`adr-0031-accepted-e064a8943`.

- accepted commit: `e064a8943b1dc4d9737f542d530e023fc8441282`;
- annotated tag object: `5b7226f218ff6b888b5aaee581ced89fa574e9ac`;
- signer: `HeadyMe <eric@headysystems.com>`;
- signing key fingerprint: `1050B59E7296C46C26DDF95DA7D2108BB3C6101C`; and
- scope: approval-system implementation and the one-time founder-controlled genesis procedure only.

The acceptance does not approve HCP-0003, authorize `packages/bees`, permit an agent to use founder or
service signing keys, modify stage-0 protected files, deploy the service, or execute genesis.
