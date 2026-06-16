# HCP-0001 — HeadyKey Secret-Rotation Executor (patent-zone clearance)

> **Heady Change Proposal.** Template: Nygard ADR + MADR 4.0 + Y-statement + Rust-RFC
> (Drawbacks/Unresolved) + Oxide-RFD. Governs both the change and its deploy (G6). This proposal
> exists because the rotation *executor* sits in a patent-locked zone and may not be written until a
> founder approves it. **The agent proposes; the human approves; the environment enforces.**

**Machine-readable approval record** (the canonical shape the OPA policy + approval API read; the
`id`, `diff_hash`, and per-approver signatures are minted by `POST /api/approvals` on submission —
`null` while `draft`). Stored here as a fenced block because the Skeleton Guard reserves `docs/**` for
`.md`; the approval API persists the live record to Neon `approvals`/`approval_events`.

```json
{
  "hcp": "HCP-0001",
  "title": "HeadyKey secret-rotation executor",
  "id": null,
  "id_note": "ULID minted by POST /api/approvals on submission; null while draft.",
  "status": "draft",
  "status_states": ["draft", "pending", "approved", "rejected", "expired", "superseded"],
  "patent_locked_zone": true,
  "required_count": 2,
  "required_count_rule": "policies/approval.rego — required_count := 2 if patent_locked_zone else 1",
  "subject": {
    "type": "change+deploy",
    "zone_paths": ["packages/secrets/src/rotation-executor.mjs (proposed)", "packages/security-mesh/**"],
    "patent_claims": ["HS-2026-051..062 (G9; exact id pinned by founder — U1)"],
    "diff_hash": null
  },
  "blocking_questions": ["U1: pin HS-2026-0NN", "U2: overlap window", "U3: verifyRequest dual-secret"],
  "approvers": [],
  "approver_shape": {
    "principal": "identity id",
    "decision": "approve | reject",
    "at": "ISO-8601",
    "hmac_sha256": "per-approver MAC",
    "ed25519_signed_receipt": "detached, JWK-verifiable (G9; ML-DSA-65 added in parallel later)"
  },
  "events": [
    { "at": "2026-06-16T18:29:49Z", "type": "drafted", "by": "heady-agent",
      "note": "ARBITER element-3 BLOCK; HCP-0001 authored + record stubbed in approval-system shape." }
  ],
  "policy": "policies/approval.rego",
  "enforcement": ["CI: opa eval --fail-defined", "runtime: opa-wasm", "GitHub: Deployment Protection Rules + CODEOWNERS /patent-locked/**"],
  "gate": "No executor code until status=approved with 2 approvals and U1 resolved."
}
```

## Context (Nygard)

`@heady/secrets` (HeadyVault) resolves secrets fail-closed and a one-time `heady-secrets rotate`
seeds Secret Manager. The ARBITER-cleared planner (`planRotation`, `rotation-status`) reports which
secrets are **due** by FIB-derived `maxAgeDays`. What does not yet exist is the **executor** that
actually rotates the one cleanly-auto-rotatable secret (`INTERNAL_NODE_SECRET`, strategy `internal`)
with **zero downtime**: generate → write a new Secret Manager version → keep the prior version
enabled for a **dual-key overlap window** → disable it on the Fibonacci cadence.

ARBITER (2026-06-16) ruled this executor **BLOCK**: the *Fibonacci-cadence + dual-key-overlap +
zero-downtime rotation protocol* is Heady patent claim-surface (HS-2026-051+, the G9
crypto-governance band documented in `heady-pqc-security` → `src/security/secret-rotation.js`).
Relocating it into a non-patent package does not launder the claim. Writing it requires this HCP.

## Decision drivers (MADR)

- D1 — Secrets must rotate without a service-visible gap (Law: zero-downtime; G6 canary).
- D2 — Patent governance is non-bypassable, even by the founder's informal instruction (G6/G9).
- D3 — Only `INTERNAL_NODE_SECRET` is Heady-generated; the executor must not over-reach into
  provider keys (no rotation API) or `VAULT_PASSPHRASE` (encryption root — envelope-gated).
- D4 — The executor runs as HeadyKey under a dedicated SA with `secretVersionAdder` (granted by
  `heady-secrets grant`), never with human credentials.

## Considered options (MADR)

1. **Approve the dual-key-overlap executor inside the patent zone (proposed).**
   *Pros:* true zero-downtime auto-rotation; matches the documented Heady protocol; reuses the
   existing planner + IAM grant. *Cons:* commits patent claim-surface to running code; requires
   2-approver clearance and CODEOWNERS coverage on the zone.
2. **Generic single-version replace (no overlap).** Rotate by adding a version and immediately
   pointing `:latest` at it. *Pros:* almost certainly outside the claim (generic). *Cons:* a brief
   race where in-flight requests hold the old secret → not zero-downtime; violates D1.
3. **Stay manual / age-tracked only (status quo).** `rotation-status` flags due; a human runs
   `rotate`. *Pros:* nothing patent-bound; already shipped. *Cons:* not "auto"; defeats the goal.

## Decision (Y-statement)

> In the context of automating rotation of Heady-generated secrets with zero downtime,
> facing the fact that the dual-key-overlap protocol is patent claim-surface (HS-2026-051+),
> we propose **Option 1** — build the executor in `packages/secrets/src/rotation-executor.mjs`,
> scoped to `strategy: "internal"` secrets only,
> to achieve true zero-downtime auto-rotation under HeadyKey's dedicated SA,
> accepting that it may not be written until this HCP reaches `approved` with **2 approvals** and the
> exact HS-2026-0NN claim is pinned, with CODEOWNERS enforcement on the touched zone.

## Consequences / Drawbacks (Rust-RFC)

- (+) `INTERNAL_NODE_SECRET` rotates automatically on the FIB cadence with no service gap.
- (+) Provider/manual/root secrets remain explicitly out of scope — no silent over-reach.
- (−) Running code now embodies a patent claim → CODEOWNERS on `/patent-locked/**` + signed approval
  receipts become load-bearing; a future contributor cannot edit it without re-clearance.
- (−) Dual-key overlap means two valid `INTERNAL_NODE_SECRET` versions briefly coexist — verifiers
  must accept either during the window (a small, bounded widening of trust).

## Unresolved questions (Rust-RFC)

- U1 — **Which exact HS-2026-0NN claim** covers the rotation protocol? ARBITER could not resolve it
  from the repo (no per-ID catalog). **Founder must pin it before approval.**
- U2 — Overlap-window length: a FIB value (candidate `FIB[6]=8` days) vs. a shorter cutover. Must not
  exceed the rotation interval. (This value is itself patent-zone executor surface — set on approval.)
- U3 — Does `security-mesh.verifyRequest` need a dual-secret acceptance mode for the overlap, and does
  that change touch its patent-locked file (separate ARBITER pass if so)?

## Patent declaration

- **Zone:** HS-2026-051..062 (G9 cryptographic-governance band).
- **Mechanism claimed:** Fibonacci-interval + dual-key-overlap + zero-downtime secret rotation.
- **Clearance asked of the founder (Eric Haywood):** (a) confirm/pin the exact claim id; (b) authorize
  reimplementing it in `@heady/secrets` as approved internal use; (c) add CODEOWNERS on the executor
  path. Per `policies/approval.rego`: `required_count := 2` (patent_locked).

## φ-canary rollout plan (reviewable section, G6)

1. Land executor behind a config flag, default OFF; unit + integration tests with a fake Secret
   Manager (no live writes).
2. Dry-run against a **non-production** `INTERNAL_NODE_SECRET_CANARY` secret; verify overlap +
   disable + that `verifyRequest` accepts both versions during the window.
3. φ-stepped enablement: 1 service → FIB-stepped fan-out → full, with `rotation-status` + Sentry SLO
   watch and an immediate disable-rollback if any verify failure spikes.

## Decision outcome

**Pending.** No executor code is written under this HCP until `status: approved` with 2 approvals and
U1 (claim id) resolved. Until then, `INTERNAL_NODE_SECRET` is rotated through the governed manual
`heady-secrets rotate` path like every other secret.
