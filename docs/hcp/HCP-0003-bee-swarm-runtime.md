# HCP-0003 — Canonical HeadyBee and Swarm Runtime

> **Heady Change Proposal.** Governs the G02 transfer into the patent-designated
> `@heady/bees` runtime. The proposal is intentionally a draft: ARBITER returned
> `BLOCK` until the exact claim surface, file scope, and two signed approvals are
> recorded. No protected runtime code may be created from this proposal alone.

## Machine-readable approval record

```json
{
  "hcp": "HCP-0003",
  "title": "Canonical HeadyBee and swarm runtime",
  "id": null,
  "id_note": "ULID minted by POST /api/approvals on submission; null while draft.",
  "status": "draft",
  "status_states": ["draft", "pending", "approved", "rejected", "expired", "superseded"],
  "patent_locked_zone": true,
  "required_count": 2,
  "required_count_rule": "policies/approval.rego — required_count := 2 if patent_locked_zone else 1",
  "subject": {
    "type": "change",
    "concept_cluster": "G02 — Bee / Swarm Runtime & Orchestration",
    "build_step": "P2 — runtime transfer after G01 and G03",
    "zone_paths": [
      "packages/bees/package.json (proposed)",
      "packages/bees/src/base-bee.mjs (proposed)",
      "packages/bees/src/factory.mjs (proposed)",
      "packages/bees/src/registry.mjs (proposed)",
      "packages/bees/src/index.mjs (proposed)",
      "packages/bees/test/bees.test.mjs (proposed)"
    ],
    "excluded_paths": [
      "packages/csl-engine/**",
      "packages/security-mesh/**",
      "packages/orchestration/**",
      "patent-locked/**"
    ],
    "patent_claims": [
      "HS-2026-060 Claims 1-3, 5, 7, 9"
    ],
    "reviewed_but_excluded_claims": [
      "HS-2026-052 Claim 3 — no source-of-truth projection enforcement or remediation",
      "HS-2026-053 Claims 1, 7 — telemetry is operational-only and not proof-bearing inference telemetry",
      "HS-2026-058 Claims 2, 6 — no vector or CSL-weighted consensus",
      "HS-2026-059 Claims 1, 5-7 — no multi-agent vector consensus"
    ],
    "diff_hash": null
  },
  "blocking_questions": [],
  "resolved_questions": {
    "U1": "Use round(PHI^4 * 1000) through the canonical phi-math export; no literal timeout in runtime code.",
    "U2": "Runtime-created bees may not persist beyond one durable workflow execution. Retire is terminal; durable receipts remain separate.",
    "U3": "Generic DAG orchestration and all vector/CSL-weighted consensus remain outside this proposal and outside packages/bees.",
    "U4": "Lifecycle telemetry is operational-only. It may not encode proof-bearing inference decisions or consensus evidence."
  },
  "approvers": [],
  "approver_shape": {
    "principal": "identity id",
    "decision": "approve | reject",
    "at": "ISO-8601",
    "hmac_sha256": "per-approver MAC",
    "ed25519_signed_receipt": "detached, JWK-verifiable"
  },
  "events": [
    {
      "at": "2026-07-23T16:57:52Z",
      "type": "drafted",
      "by": "heady-autopilot",
      "note": "ARBITER BLOCK recorded. The founder's chat instruction expresses intent to proceed but is not represented as an approval because it is not an approval-API event or signed receipt."
    },
    {
      "at": "2026-07-23T17:04:03Z",
      "type": "human-approval-intent-recorded",
      "by": "eric@headysystems.com",
      "note": "The founder instructed autopilot to sign and continue. U1-U4 were resolved and the claim surface was narrowed. This event is intent evidence only: the required approval API, Neon approval tables, and signed-receipt minting path are not implemented, so it is not counted as an approver receipt."
    },
    {
      "at": "2026-07-23T17:06:32Z",
      "type": "arbiter-rereview-blocked",
      "by": "ARBITER",
      "note": "The narrowing plausibly limits the active surface to HS-2026-060 Claims 1-3, 5, 7, 9, but no implementation may begin without the exact non-applied diff, diff hash, approval-system bootstrap, CODEOWNERS coverage, two valid receipts from distinct authorized principals, approved status, and a final ARBITER review."
    }
  ],
  "policy": "policies/approval.rego",
  "enforcement": [
    "approval API signed receipts",
    "CODEOWNERS patent-zone review",
    "tooling/governance-gate",
    "ARBITER re-review of the narrowed diff"
  ],
  "gate": "Do not create or modify packages/bees until status=approved, two distinct signed approvals exist, a diff_hash is bound to the reviewed change, and ARBITER returns ALLOW on the narrowed diff."
}
```

## Context

The accepted decomposition manifest identifies G02 as the transfer authority for the missing
bee/swarm runtime. Its reviewed source bundle contains the strongest reusable parts:

- AG-03: the `BaseHeadyBee` lifecycle (`spawn → execute → report → retire`) with LIFO cleanup.
- AG-01: factory, registry, task decomposition, and health aggregation.
- AG-02: routing concepts only; Pinecone and Redis authority paths are explicitly dropped.

The rebuild already supplies the dependencies that transferred code must consume rather than
reimplement: `@heady/phi-math`, `@heady/resilience`, `@heady/events`, `@heady/logger`,
`@heady/db`, and `@heady/csl-engine`. The intended package is ESM-only and must run as bounded
Workflow/Queue work rather than a permanently resident process.

## ARBITER verdict

**BLOCK.** After U1–U4 were resolved, ARBITER found that the narrowed proposal plausibly limits the
active surface to HS-2026-060 Claims 1–3, 5, 7, and 9. The adjacent HS-052/053/058/059 surfaces are
excluded by design, but those exclusions cannot be confirmed until ARBITER can inspect an exact,
non-applied diff. The approval system, its Neon tables, a bound diff hash, signed receipts, and
`/packages/bees/` CODEOWNERS coverage do not yet exist.

The founder's instruction to sign is recorded as approval intent. It is not a signed receipt, and an
agent may not invoke the founder's private key or manufacture a second principal. The repository-
supported bootstrap is a founder-controlled stage-0 ADR and externally gated approval-system change;
the bee runtime remains downstream of that bootstrap.

## Decision drivers

- Preserve the G02 evidence trail while avoiding a bulk legacy extraction.
- Establish one canonical lifecycle and factory instead of extending the competing CommonJS factories.
- Keep Neon Postgres authoritative and caches reconstructible.
- Use existing typed events and structured telemetry for lifecycle observation.
- Keep generic DAG scheduling separate from vector/CSL consensus so each claim surface can be reviewed.
- Prohibit persistence, deployment, credentials, or destructive operations without governed adapters.

## Proposed decision

After approval, transfer only the lifecycle contract, bounded factory, capacity-limited registry, and
their tests into `@heady/bees`. The first implementation must not include vector consensus,
source-of-truth remediation, deployment actions, credential mutation, or a background daemon. Those
capabilities require separately reviewed adapters or proposals.

## Verification required before approval

1. Submit the resolved proposal through `POST /api/approvals`.
2. Bind the exact proposed change through `subject.diff_hash`.
3. Obtain two detached Ed25519-signed approval receipts from distinct authorized principals.
4. Re-run ARBITER against the exact proposed diff and record `ALLOW`.
5. Require lifecycle, cleanup-order, capacity, circuit-breaker, health, telemetry, and event-envelope tests.
6. Run law-lint, governance, no-loopback, secret-scan, zod-boundary, phi-timing, and coherence gates.

## Decision outcome

**Pending.** No protected bee/swarm runtime code is authorized by this draft.

<!-- HEADY_BRAND:BEGIN
  Heady™ Change Proposal HCP-0003 — Canonical HeadyBee and Swarm Runtime
  © 2026 HeadySystems Inc. — Eric Haywood, Founder
HEADY_BRAND:END -->
