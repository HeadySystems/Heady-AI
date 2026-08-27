<!-- HEADY_BRAND:BEGIN
Heady™ ADR-0053 — Temporary Solo-Founder Approval Quorum
Made with ❤️ by HeadySystems Inc.
HEADY_BRAND:END -->

# ADR-0053: Temporary Solo-Founder Approval Quorum

- **Status:** Accepted (2026-08-23)
- **Acceptance:** Founder-signed tag `adr-0053-accepted-dfdd2bc87` (OpenPGP, EDDSA `1050B59E7296C46C26DDF95DA7D2108BB3C6101C` — the key of record; `git tag -v adr-0053-accepted-dfdd2bc87` returns Good signature)
- **Decider:** Eric Anthony Haywood (pending authenticated acceptance)
- **Supersedes if accepted:** ADR-0031 sections 1 and 4 only for the bounded temporary interval below
- **Security effect while Proposed:** none; ADR-0031 remains authoritative

## Context

ADR-0031 honestly rejects manufactured independence: two keys, aliases, or agent personas controlled
by one founder are one human principal. It also requires an external human security reviewer for
approval-system changes. HeadySystems currently has no second qualified human team member available
to occupy that evidence class, so the approval-system bootstrap and later protected migrations can
remain indefinitely queued even when the founder and an independently authenticated technical
attestor agree on an exact artifact.

The founder requested removal of the independent-human requirement until additional team members are
available. That request must be represented as a visible governance transition, not implemented by
mislabeling founder, AI, or service evidence as independent-human evidence.

## Decision proposed

If this ADR is validly accepted, activate a temporary `solo_founder` quorum mode with these rules:

1. An approval-system or protected-migration change requires one verified founder decision and one
   separately authenticated ARBITER `ALLOW`, both bound to the same canonical payload, exact diff,
   target, policy digest, nonce, and expiry.
2. No external-human evidence slot is required while temporary mode is active and ARBITER returns
   `ALLOW` without unresolved exclusions or conflicts.
3. ARBITER `ESCALATE` or `DENY`, failed signature verification, incomplete claim/path coverage,
   binding drift, or unavailable attestation fails closed. The founder cannot replace an ARBITER
   attestation, and an agent cannot issue either required decision.
4. The system records the actual evidence classes. It must never store a founder decision, AI review,
   or ARBITER attestation as an `external_human_review` or `external_security_review`.
5. The exception is prospective and non-retroactive. Existing commits, pull requests, migrations,
   and deployments require new evidence produced after activation and bound to their then-current
   bytes and targets.
6. The mode ends at the earliest of:
   - registration and activation of one qualified external security-reviewer principal not controlled
     by the founder;
   - addition of a second human team member authorized for security review; or
   - `2026-11-19T23:59:59Z`, the Fibonacci `FIB[11] = 89` day ceiling from proposal date.
7. Sunset is automatic and fail-closed. After sunset, ADR-0031's external-human requirements resume.
   Extension requires a new ADR and cannot be inferred from inactivity or staffing delay.

The temporary policy expression is conceptually:

```text
solo_approval_system_allow = temporary_mode_active
                             AND founder_approvals == 1
                             AND arbiter_allows >= 1
                             AND arbiter_escalations == 0
                             AND binding_is_current
```

## Activation boundary

This proposal does not change the active policy, approve PR 286, authorize migrations, or authorize
genesis. Because it changes the approval system's own quorum, it cannot activate itself through the
weaker quorum it proposes. Acceptance must satisfy the governance in force before activation and be
anchored by a founder-signed Git object over the exact amendment and implementation digests. Agents
may author and test the proposal; they may not create the founder signature, fabricate review
evidence, activate the policy, apply protected migrations, or execute genesis.

An activation record must bind:

- this ADR's exact commit and SHA-256;
- the policy source, compiled WASM, manifest, tests, and migration digests;
- the temporary-mode start and hard-expiry timestamps;
- the founder and ARBITER public-key fingerprints;
- the reviewer-principal census used by the sunset check; and
- rollback instructions that restore ADR-0031's evidence requirements.

## Consequences

- (+) The temporary model does not invent a second human identity.
- (+) Protected work can progress during a genuinely solo-founder interval if an independent
  technical attestor returns an exact-scope `ALLOW`.
- (+) Escalation and uncertainty remain fail-closed.
- (+) The exception expires deterministically and cannot become permanent through neglect.
- (−) ARBITER remains an operational dependency and is technical governance, not legal advice.
- (−) This proposal cannot resolve the current transition without satisfying the presently active
  governance rule; that non-circular activation cost is deliberate.

## Alternatives considered

- **Treat founder chat `ALLOW` as independent review.** Rejected because it changes the label, not
  the principal, and destroys attributable separation.
- **Let an AI reviewer occupy the human slot.** Rejected because service output is not human evidence.
- **Remove every second channel.** Rejected because a single credential compromise could then modify
  the verifier, quorum, and audit trail together.
- **Wait without a bounded proposal.** Rejected because it gives the founder no explicit, reviewable
  route for changing the operating model.

## Reconciliation

- ADR-0031 remains authoritative until this record is validly accepted and activated.
- ADR-0013 remains the founder identity and signing authority source.
- Patent-locked changes retain ARBITER claim/path review and fail closed on escalation.
- This record changes no stage-0 file, runtime policy, principal registry, or production resource
  while Proposed.

