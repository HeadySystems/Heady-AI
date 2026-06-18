# HCP-0005 — Deterministic Replay + SHA-256 Drift + Auto-Reconfig (C6 / Step 4, patent-zone clearance)

> **Heady Change Proposal.** Template: Nygard ADR + MADR 4.0 + Y-statement + Rust-RFC
> (Drawbacks/Unresolved) + Oxide-RFD. Governs both the change and its deploy (G6). This proposal
> exists because re-embodying the **deterministic-replay + SHA-256 drift-detection + auto-reconfig**
> mechanism as *running kernel code* re-embodies a patent-locked control loop. It is the C6 cluster, the
> determinism substrate the conductor (HCP-0003), stage-gate (HCP-0002), and swarm (HCP-0004) all depend
> on, and it provides the Law-5 audit trail. **The agent proposes; the human approves; the environment
> enforces.**

**Machine-readable approval record** (canonical shape the OPA policy + approval API read; `id`,
`diff_hash`, signatures minted by `POST /api/approvals` on submission — `null` while `draft`). Fenced
because the Skeleton Guard reserves `docs/**` for `.md`; the API persists the live record to Neon.

```json
{
  "hcp": "HCP-0005",
  "title": "Deterministic replay + SHA-256 drift + auto-reconfig",
  "id": null,
  "id_note": "ULID minted by POST /api/approvals on submission; null while draft.",
  "status": "draft",
  "status_states": ["draft", "pending", "approved", "rejected", "expired", "superseded"],
  "patent_locked_zone": true,
  "required_count": 2,
  "required_count_rule": "policies/approval.rego — required_count := 2 if patent_locked_zone else 1",
  "subject": {
    "type": "change",
    "concept_cluster": "C6 — Deterministic replay + SHA-256 drift + auto-reconfig",
    "build_step": "Step 4 — Orchestration core (determinism substrate)",
    "authority": ["governance/legacy/BUDDY_KERNEL.md §Determinism + §Checkpoint Protocol (drift window = last 11 hashes; driftScore > psi^2 -> auto-reconfig)", "governance/legacy/UNBREAKABLE_LAWS.md (Law 5 audit; seeded PRNG)"],
    "zone_paths": [
      "packages/kernel/src/determinism.mjs (proposed)",
      "packages/task-ledger/** (consumed — replay event log + audit rows)",
      "packages/csl-engine/** (consumed — threshold tightening)"
    ],
    "patent_claims": ["HS-2026-051..062 estate — deterministic-replay/drift-detection control-loop embodiment (exact id pinned by founder — U1)"],
    "diff_hash": null
  },
  "blocking_questions": [
    "U1: pin the exact HS-2026-0NN claim covering the drift-detection + auto-reconfig control loop",
    "U2: drift window size — keep legacy 11, or set FIB-aligned (e.g. 13)?",
    "U3: auto-reconfig authority — fully autonomous (lock seed, tighten CSL by psi^2) vs. HCP-gated when it changes a patent-zone threshold",
    "U4: hash scope — hash the model output only, or the full (input-hash, params, output) tuple for replay-cache keys?"
  ],
  "approvers": [],
  "approver_shape": {
    "principal": "identity id",
    "decision": "approve | reject",
    "at": "ISO-8601",
    "hmac_sha256": "per-approver MAC",
    "ed25519_signed_receipt": "detached, JWK-verifiable (G9; ML-DSA-65 added in parallel later)"
  },
  "events": [
    { "at": "2026-06-17T21:45:00Z", "type": "drafted", "by": "heady-agent",
      "note": "C6/Step-4 concept-migration HCP. Proposes @heady/kernel determinism.mjs: seeded-PRNG replay, SHA-256 drift window, psi^2 auto-reconfig, feeding the Law-5 audit. Determinism substrate for HCP-0002/0003/0004. ARBITER G2 expected BLOCK->HCP." }
  ],
  "policy": "policies/approval.rego",
  "enforcement": ["CI: opa eval --fail-defined", "runtime: opa-wasm", "GitHub: Deployment Protection Rules + CODEOWNERS /patent-locked/**"],
  "gate": "No determinism/drift code wired into the kernel until status=approved with 2 approvals and U1+U3 resolved."
}
```

## Context (Nygard)

The legacy reduction-to-practice is explicit in `governance/legacy/BUDDY_KERNEL.md`: **Determinism** —
"same input hash → same output, always (temp=0, top_p=1, seed=42)"; **Auditable** — "SHA-256 hash every
output, immutable audit trail"; and the **Checkpoint Protocol** drift loop — after execution, SHA-256-hash
the output, compare against the **drift window (last 11 hashes)**, and if `driftScore > ψ² (0.382)` →
**auto-reconfig**: lock `temp=0, seed=42`, increase Monte Carlo iterations, and **tighten the CSL
threshold by ψ²**. `governance/legacy/UNBREAKABLE_LAWS.md` Law-5-adjacent: "deterministic seeded PRNG
ensures reproducible competition trails" (the audit law).

The rebuild has the pieces this consumes — `@heady/task-ledger` (the append-only event log that makes
replay possible + the audit rows), `@heady/csl-engine` (the threshold being tightened), `@heady/phi-math`
(`ψ² ≈ 0.382`, `seed`, FIB[]) — but **no determinism/drift module** exists. This HCP proposes
`packages/kernel/src/determinism.mjs`: the seeded-PRNG harness, the SHA-256 drift window, and the ψ²
auto-reconfig action, feeding the Law-5 audit trail.

This is the **substrate the other three HCPs lean on**: HCP-0002's stage-gate verdicts must be
reproducible; HCP-0003's conductor must replay from the event log; HCP-0004's bee dispatch must be
deterministic. C6 makes "same input → same output, and detect when it isn't" a first-class kernel service.

ARBITER (G2 pre-port) is expected to rule **BLOCK→HCP**: a control loop that hashes outputs, detects
semantic drift against a rolling window, and **autonomously reconfigures the system's own determinism and
CSL thresholds** is Heady patent claim-surface within the HS-2026-051..062 estate. The running embodiment
needs this HCP.

## Decision drivers (MADR)

- D1 — **Determinism is load-bearing across the platform** (C6 underpins C1/C3/C4): given the same
  `(input-hash, params, seed)` the output and every gate/route decision must reproduce exactly.
- D2 — **Replay from the event log, not from RAM** (ADR-0000 rejects RAM-as-truth): the replay cache keys
  off `@heady/task-ledger` rows; Neon is system-of-record.
- D3 — **Drift detection is a self-awareness layer**: SHA-256 the output, compare to the rolling window, and
  surface a drift score — the legacy "semantic drift detection as the self-awareness layer."
- D4 — **Auto-reconfig is bounded and auditable**: on `driftScore > ψ²` lock seed/temp + tighten CSL by ψ²,
  but every reconfig is a signed audit event (Law 5) — and if it would mutate a *patent-zone* threshold it
  must itself be gated (U3), never a silent self-modification.
- D5 — φ-only constants (`@heady/phi-math`): `ψ² = 0.382` drift threshold, `seed = 42`, MC-iteration φ
  scaling, FIB-aligned window — never magic numbers.

## Considered options (MADR)

1. **Add `@heady/kernel` determinism.mjs: seeded-PRNG replay + SHA-256 drift window + ψ² auto-reconfig, feeding the Law-5 audit (proposed).**
   A `replayHarness` (deterministic params + replay-cache lookup keyed on the input/param tuple), a
   `driftDetector` (SHA-256 hash → rolling window → drift score), and a bounded `autoReconfig` action that
   emits a signed audit event. *Pros:* faithful to legacy; reuses task-ledger/csl-engine/phi-math; gives
   every other HCP a reproducibility + audit guarantee. *Cons:* commits the drift/auto-reconfig claim
   surface to running code → 2-approver clearance + CODEOWNERS; an over-eager auto-reconfig could oscillate
   thresholds (needs U3 bounds + damping).
2. **Determinism by convention only (set temp=0/seed=42, no drift loop).** *Pros:* trivially outside the
   claim. *Cons:* no drift detection, no self-correction, no replay cache, no audit of reconfig — fails
   D3/D4 and discards the C6 concept.
3. **External monitoring tool watches outputs out-of-band (no kernel loop).** *Pros:* keeps the kernel
   claim-free. *Cons:* drift detection can't feed back into params/CSL thresholds atomically, no replay
   cache integration, weaker determinism guarantee — fails D1/D4.

## Decision (Y-statement)

> In the context of making the rebuild reproducible and self-aware of semantic drift across the stage-gate,
> conductor, and swarm,
> facing the fact that a hash-based drift-detection + autonomous-reconfig control loop is patent
> claim-surface (HS-2026-051..062 estate),
> we propose **Option 1** — add `packages/kernel/src/determinism.mjs` with a seeded-PRNG replay harness, a
> SHA-256 rolling-window drift detector, and a bounded ψ² auto-reconfig that emits a signed Law-5 audit
> event, consuming `@heady/task-ledger` (replay log) and `@heady/csl-engine` (threshold tightening),
> to achieve a platform-wide determinism + drift-self-awareness substrate,
> accepting that no determinism/drift code is wired into the kernel until this HCP reaches `approved` with
> **2 approvals** and U1 (claim id) + U3 (reconfig authority bounds) resolved, with CODEOWNERS enforcement.

## Consequences / Drawbacks (Rust-RFC)

- (+) Every other migrated mechanism inherits reproducibility: stage-gate verdicts, conductor runs, and bee
  dispatch all replay exactly from the event log.
- (+) Semantic drift is detected and surfaced as a self-awareness signal; bounded auto-reconfig tightens the
  system under drift instead of degrading silently.
- (+) Every reconfig is a signed, immutable Law-5 audit event → full traceability of any self-modification.
- (−) Running code embodies a patent claim → CODEOWNERS on the kernel determinism zone + signed approval
  receipts become load-bearing.
- (−) Auto-reconfig is a feedback loop on the system's own thresholds; without damping + U3 bounds it could
  oscillate (tighten → fewer EXECUTEs → different outputs → more drift). Must ship with a φ-damped, capped
  reconfig and a hard "never silently mutate a patent-zone threshold" rule.
- (−) Replay-cache + hash-window storage adds write volume to Neon/task-ledger (mitigated by FIB-windowing
  and hashing, not full-output, storage).

## Unresolved questions (Rust-RFC)

- U1 — **Which exact HS-2026-0NN claim** covers the drift-detection + auto-reconfig control loop? Founder
  must pin it.
- U2 — **Drift window size:** keep the legacy **11**, or move to a FIB-aligned **13**? (Window size changes
  sensitivity.)
- U3 — **Auto-reconfig authority:** fully autonomous (lock seed, tighten CSL by ψ²) for non-zone params, but
  **HCP-gated** when a reconfig would change a *patent-zone* threshold (e.g. a CSL gate band)? Confirm the
  boundary so the loop can't self-modify a locked mechanism.
- U4 — **Hash scope:** hash the model output only, or the full `(input-hash, params, output)` tuple as the
  replay-cache key? (Affects replay-cache hit semantics and storage.)

## Patent declaration

- **Zone:** HS-2026-051..062 estate — deterministic-replay / drift-detection / self-reconfiguring control loop.
- **Mechanism claimed:** a control loop that (a) executes under fixed deterministic parameters (seed,
  temp=0) with a replay cache keyed on the input/param tuple, (b) SHA-256-hashes each output and compares it
  against a rolling drift window, and (c) on a drift score exceeding a φ-derived threshold (ψ²) autonomously
  reconfigures determinism parameters and tightens CSL thresholds, emitting a signed immutable audit event.
- **Reduction to practice may be evidenced by:** legacy `governance/legacy/BUDDY_KERNEL.md` (§Determinism:
  seed 42 / temp 0; §Checkpoint Protocol: drift window last 11 hashes, `driftScore > ψ²` → auto-reconfig)
  and `governance/legacy/UNBREAKABLE_LAWS.md` (seeded-PRNG reproducible trails / audit law).
- **Clearance asked of the founder (Eric Haywood):** (a) confirm/pin the exact claim id (U1); (b) authorize
  the determinism/drift/auto-reconfig loop in `@heady/kernel` as approved internal use; (c) add CODEOWNERS on
  the kernel determinism zone; (d) set the auto-reconfig authority boundary (U3). Per `policies/approval.rego`:
  `required_count := 2`.

## φ-canary rollout plan (reviewable section, G6)

1. Land `determinism.mjs` behind a flag (`heady.kernel.determinism`, default OFF): `replayHarness`,
   `driftDetector`, and `autoReconfig` as pure functions. Unit + contract tests assert byte-identical replay
   for fixed `(input, params, seed)`, correct rolling-window drift scoring, and that `autoReconfig` is
   φ-damped, capped, and **refuses** to mutate a patent-zone threshold (emits an HCP-required event instead).
2. Shadow mode on a **non-production** conductor: compute drift scores and the *proposed* reconfig, emit the
   signed audit event, but **do not apply** the reconfig (observe-only) — verify drift detection fires
   correctly and replay-cache hits are sound.
3. φ-stepped enablement: enable replay-cache + drift detection (no auto-apply) → enable bounded auto-reconfig
   on non-zone params only → consider zone-param reconfig **only** behind a fresh HCP, with Sentry SLO watch
   on drift-rate and reconfig-frequency, and immediate flag-off rollback if reconfig oscillation is detected.

## Decision outcome

**Pending.** No determinism/drift code is wired into the kernel under this HCP until `status: approved` with
2 approvals and U1 (claim id) + U3 (reconfig authority) resolved. Until then the rebuild relies on
convention-level determinism (fixed seed/temp where set) with no drift loop and no replay cache, and the
stage-gate/conductor/swarm carry no platform-wide reproducibility guarantee.

<!-- HEADY_BRAND:BEGIN
  Heady™ Change Proposal HCP-0005 — Deterministic Replay + SHA-256 Drift + Auto-Reconfig (C6 / Step 4)
  © 2026 HeadySystems Inc. — Eric Haywood, Founder
HEADY_BRAND:END -->
