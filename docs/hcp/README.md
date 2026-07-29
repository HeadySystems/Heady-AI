# Heady Change Proposals (HCP)

The human-in-the-loop authority for changes **and deploys** (governance G6). *The agent proposes; the
human approves; the environment enforces.* An HCP is required for every deploy and every >5-file or
**patent-zone** change.

## Anatomy

Each HCP is one `.md` file (template: Nygard ADR + MADR 4.0 + Y-statement + Rust-RFC
Drawbacks/Unresolved + Oxide-RFD) that **embeds a machine-readable approval record** as a fenced
```json``` block (the Skeleton Guard reserves `docs/**` for `.md`, so the record lives inside the
proposal; the approval API persists the live copy to Neon
`heady_approval.approvals`/`heady_approval.events`).

The record drives `policies/approval.rego`:
- standard sensitive change: one verified founder decision;
- patent-locked change: founder decision plus ARBITER `ALLOW` on the exact diff, or an external human
  review when ARBITER escalates;
- state machine: `draft → pending → approved | rejected | expired | superseded`
- per-principal detached evidence signature plus an approval-API-minted **Ed25519 signed receipt**
  (ML-DSA-65 can be added in parallel per R3).

Enforcement is layered and any one layer blocks: CI (`opa eval --fail-defined`), runtime
(`opa-wasm`), GitHub Deployment Protection Rules, and CODEOWNERS on `/patent-locked/**`.

## Approval-system bootstrap

ADR-0031 was accepted by founder-signed tag on 2026-07-24 and authorizes implementation of the
approval API, Neon tables, typed solo-founder quorum, and single-use founder-controlled bootstrap.
Until the service completes genesis, no HCP may count a chat instruction, Git signature, duplicate
founder key, or agent identity as an approval receipt.

## How an approver acts

Approvers do **not** hand-edit the record. They act through the approval API
(`POST /api/approvals/:id/approve|reject`), which appends a signed event and recomputes state against
the Rego policy. A patent-locked HCP needs the typed founder-plus-ARBITER quorum, with external human
review when ARBITER escalates, before `status: approved`.

## Index

| HCP | Title | Status | Patent-locked | Blocks |
|-----|-------|--------|---------------|--------|
| [HCP-0001](HCP-0001-headykey-rotation-executor.md) | HeadyKey secret-rotation executor | draft | yes (HS-2026-051+) | U1: pin the exact claim id; needs 2 approvals |
| [HCP-0002](HCP-0002-kernel-csl-stage-gate.md) | Kernel CSL stage-transition gate (C1 / Step 4) | draft | yes (HS-058) | U1: pin the exact claim id; U2: tau source; U3: HALT disposition; needs 2 approvals |
| [HCP-0003](HCP-0003-bee-swarm-runtime.md) | Canonical HeadyBee and swarm runtime | draft | yes (HS-060; adjacent claims explicitly excluded) | Approval API bootstrap, diff hash, 2 signed approvals, and ARBITER ALLOW |

---
*© 2026 HeadySystems Inc. — Eric Haywood, Founder*
