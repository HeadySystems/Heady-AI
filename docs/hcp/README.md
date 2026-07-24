# Heady Change Proposals (HCP)

The human-in-the-loop authority for changes **and deploys** (governance G6). *The agent proposes; the
human approves; the environment enforces.* An HCP is required for every deploy and every >5-file or
**patent-zone** change.

## Anatomy

Each HCP is one `.md` file (template: Nygard ADR + MADR 4.0 + Y-statement + Rust-RFC
Drawbacks/Unresolved + Oxide-RFD) that **embeds a machine-readable approval record** as a fenced
```json``` block (the Skeleton Guard reserves `docs/**` for `.md`, so the record lives inside the
proposal; the approval API persists the live copy to Neon `approvals`/`approval_events`).

The record drives `policies/approval.rego`:
- `required_count := 2 if patent_locked_zone else 1`
- state machine: `draft → pending → approved | rejected | expired | superseded`
- per-approver **HMAC-SHA256** + detached **Ed25519 signed_receipt** (minted by the approval API,
  not authored by hand; ML-DSA-65 added in parallel per R3).

Enforcement is layered and any one layer blocks: CI (`opa eval --fail-defined`), runtime
(`opa-wasm`), GitHub Deployment Protection Rules, and CODEOWNERS on `/patent-locked/**`.

## Approval-system bootstrap

The approval API and its Neon tables are not yet implemented. Proposed ADR-0031 and
`docs/design/APPROVAL_SERVICE_BOOTSTRAP_SPEC.md` define a single-use, founder-controlled stage-0
bootstrap and a typed solo-founder quorum. They are not active policy: no HCP may count a chat
instruction, Git signature, duplicate founder key, or agent identity as an approval receipt.

## How an approver acts

Approvers do **not** hand-edit the record. They act through the approval API
(`POST /api/approvals/:id/approve|reject`), which appends a signed event and recomputes state against
the Rego policy. A patent-locked HCP needs 2 distinct approvers before `status: approved`.

## Index

| HCP | Title | Status | Patent-locked | Blocks |
|-----|-------|--------|---------------|--------|
| [HCP-0001](HCP-0001-headykey-rotation-executor.md) | HeadyKey secret-rotation executor | draft | yes (HS-2026-051+) | U1: pin the exact claim id; needs 2 approvals |
| [HCP-0002](HCP-0002-kernel-csl-stage-gate.md) | Kernel CSL stage-transition gate (C1 / Step 4) | draft | yes (HS-058) | U1: pin the exact claim id; U2: tau source; U3: HALT disposition; needs 2 approvals |
| [HCP-0003](HCP-0003-bee-swarm-runtime.md) | Canonical HeadyBee and swarm runtime | draft | yes (HS-060; adjacent claims explicitly excluded) | Approval API bootstrap, diff hash, 2 signed approvals, and ARBITER ALLOW |

---
*© 2026 HeadySystems Inc. — Eric Haywood, Founder*
