# HCP-0002 — Kernel CSL Stage-Transition Gate (C1 / Step 4, patent-zone clearance)

> **Heady Change Proposal.** Template: Nygard ADR + MADR 4.0 + Y-statement + Rust-RFC
> (Drawbacks/Unresolved) + Oxide-RFD. Governs both the change and its deploy (G6). This proposal
> exists because wiring the extracted `cslGate` into the **kernel's runtime stage-transition decision
> flow** re-embodies a patent-locked mechanism (Continuous Semantic Logic, HS-058 band) as *running
> orchestration code*, not just a pure library. It is the first of the legacy→rebuild **concept-migration**
> HCPs (cluster C1, build Step 4). **The agent proposes; the human approves; the environment enforces.**

**Machine-readable approval record** (the canonical shape the OPA policy + approval API read; the
`id`, `diff_hash`, and per-approver signatures are minted by `POST /api/approvals` on submission —
`null` while `draft`). Stored here as a fenced block because the Skeleton Guard reserves `docs/**` for
`.md`; the approval API persists the live record to Neon `approvals`/`approval_events`.

```json
{
  "hcp": "HCP-0002",
  "title": "Kernel CSL stage-transition gate",
  "id": null,
  "id_note": "ULID minted by POST /api/approvals on submission; null while draft.",
  "status": "draft",
  "status_states": ["draft", "pending", "approved", "rejected", "expired", "superseded"],
  "patent_locked_zone": true,
  "required_count": 2,
  "required_count_rule": "policies/approval.rego — required_count := 2 if patent_locked_zone else 1",
  "subject": {
    "type": "change",
    "concept_cluster": "C1 — Continuous Semantic Logic",
    "build_step": "Step 4 — Orchestration core (HeadyManager + HeadyConductor)",
    "zone_paths": [
      "packages/kernel/src/stage-gate.mjs (proposed)",
      "packages/csl-engine/** (consumed, not modified)"
    ],
    "patent_claims": ["HS-058 (VSA→CSL bridge band); HS-2026-051..062 estate (exact id pinned by founder — U1)"],
    "diff_hash": null
  },
  "blocking_questions": [
    "U1: pin the exact HS-2026-0NN claim covering the runtime stage-gate embodiment",
    "U2: tau source — fixed φ-derived GATE vs. per-stage tau table",
    "U3: HALT-verdict disposition — hard stop vs. CAUTIOUS-with-escalation"
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
    { "at": "2026-06-17T11:10:00Z", "type": "drafted", "by": "heady-agent",
      "note": "First C1/Step-4 concept-migration HCP. cslGate exists as a pure lib (HCP-2026-014 carve-out); this proposes its runtime kernel embodiment as a stage-transition gate. ARBITER G2 expected BLOCK→HCP on HS-058 surface." }
  ],
  "policy": "policies/approval.rego",
  "enforcement": ["CI: opa eval --fail-defined", "runtime: opa-wasm", "GitHub: Deployment Protection Rules + CODEOWNERS /patent-locked/**"],
  "gate": "No stage-gate code wired into the conductor until status=approved with 2 approvals and U1 resolved."
}
```

## Context (Nygard)

`@heady/csl-engine` already exists as a **pure, IO-free library** (carved out under the HS-058 precedent,
HCP-2026-014): `cosineSimilarity` (the CSL truth value τ), the geometric gates
`cslAND / cslOR / cslNOT / cslIMPLY / cslCONSENSUS`, and the ternary `cslGate(value, cosScore, tau)`
returning `"EXECUTE" | "CAUTIOUS" | "HALT"` with φ-derived bands (`GATE.HALT = ψ² ≈ 0.382`,
`GATE.EXECUTE = ψ ≈ 0.618`, from `@heady/phi-math`). Those functions are unit-testable and patent-safe
*as math*.

`@heady/kernel` today is a pure **boot/lifecycle** microkernel: `defineService`, topological `boot()`,
aggregate `health()` / `metrics()`, reverse-order `shutdown()`. It makes **no semantic decisions** — it
only orders services by `deps`.

What does not yet exist in the rebuild is the **decision layer** the legacy system embodied: in
`governance/legacy/BUDDY_KERNEL.md` the **9-stage battle-sim** routes every task through an explicit
`CSLGate` stage (Stage 2: `SimPreflight → CSLGate → BattleRace → MCSampling → BeeDispatch → SwarmRoute
→ ResultCapture → DriftCheck → AuditLog`), and the legacy `core/heady-manager-kernel.js` (BE-02) made
its stage-transition decisions through `cslGate` + `phiBackoff` rather than `if/else`. This HCP proposes
re-embodying *that runtime mechanism* — **CSL as the orchestration decision gate between conductor
stages** — in the rebuild as `packages/kernel/src/stage-gate.mjs`.

ARBITER (G2 pre-port) is expected to rule this **BLOCK**: the mechanism *"use the cosine-similarity τ of a
stage's output embedding against its goal embedding, banded by φ-derived thresholds, as the conditional
that gates whether orchestration proceeds, pauses, or halts"* is Heady patent claim-surface (HS-058 band,
the VSA→CSL bridge documented in `docs/LEGACY_EXTRACTION_SYSTEM.md` §G2). Relocating the decision into a
non-patent package does not launder the claim — the *runtime embodiment* needs this HCP even though the
*pure math* was already cleared for the library.

## Decision drivers (MADR)

- D1 — The rebuild's conductor (Step 4, CF Workflows + Queues + DO) must make stage-transition decisions
  the Heady way: **CSL gating, not `if/else`** (Constitution; legacy MASTER_DIRECTIVES "CSL-replaces-conditionals").
- D2 — Patent governance is non-bypassable, even by the founder's informal instruction (G6/G9). The pure
  library being cleared does **not** auto-clear the running embodiment.
- D3 — The gate must consume `@heady/csl-engine` **without modifying it** (the library stays a pure,
  contract-tested authority; the kernel adds orchestration semantics around it).
- D4 — Determinism is load-bearing (C6): given the same `(value-vector, goal-vector, tau)` the verdict
  must be reproducible and emit a replayable, auditable record (Law 5 audit; feeds DriftCheck).
- D5 — φ-only constants: thresholds derive from `GATE` / `CSL_THRESHOLDS` (`@heady/phi-math`), never magic numbers.

## Considered options (MADR)

1. **Approve a kernel CSL stage-gate that wraps `cslGate` as the conductor's transition conditional (proposed).**
   A pure decision function `stageGate({ outputVec, goalVec, tau }) → { verdict, score, receipt }` plus a
   thin conductor hook that pauses/halts/proceeds on the verdict and writes a signed decision receipt.
   *Pros:* embodies the legacy `CSLGate` mechanism faithfully; reuses the cleared library; deterministic +
   auditable; no `if/else` business logic. *Cons:* commits CSL claim-surface to **running orchestration
   code** → 2-approver clearance + CODEOWNERS on the touched zone; couples conductor behavior to a
   patent-locked path.
2. **Plain threshold check in the conductor (no CSL).** Compare a scalar score to a fixed number with `if`.
   *Pros:* almost certainly outside the claim (generic). *Cons:* violates D1 (not the Heady decision model),
   reintroduces magic numbers (violates D5), and discards the migrated concept entirely — defeats C1.
3. **Keep `cslGate` library-only; call it ad-hoc inside services (status quo).** Each service imports the
   library and decides for itself. *Pros:* nothing new is patent-bound at the kernel layer. *Cons:* no
   single auditable decision surface, no deterministic replay record, drift between services — fails D4 and
   the Step-4 "deterministic topological sort + checkpoint per stage" goal.

## Decision (Y-statement)

> In the context of giving the rebuild's HeadyConductor a Heady-native stage-transition decision layer,
> facing the fact that CSL-as-orchestration-gate is patent claim-surface (HS-058 band) even though the pure
> `cslGate` math was already cleared for `@heady/csl-engine`,
> we propose **Option 1** — add `packages/kernel/src/stage-gate.mjs`, a deterministic
> `stageGate({ outputVec, goalVec, tau })` that consumes (never modifies) `@heady/csl-engine` and returns a
> banded `EXECUTE | CAUTIOUS | HALT` verdict plus a replayable signed decision receipt,
> to achieve faithful re-embodiment of the legacy 9-stage `CSLGate` mechanism under the conductor,
> accepting that it may not be wired into the conductor until this HCP reaches `approved` with **2 approvals**
> and the exact HS-2026-0NN claim is pinned, with CODEOWNERS enforcement on the touched zone.

## Consequences / Drawbacks (Rust-RFC)

- (+) The conductor decides stage transitions by CSL τ banded on φ thresholds — the migrated C1 concept
  becomes running code, not a doc.
- (+) Every gate decision emits a deterministic, replayable receipt → feeds C6 drift-check and the Law 5 audit
  log; identical inputs reproduce identical verdicts.
- (+) `@heady/csl-engine` stays a pure, contract-tested authority; the kernel adds orchestration semantics
  without touching the cleared library.
- (−) Running orchestration code now embodies a patent claim → CODEOWNERS on `/patent-locked/**` + signed
  approval receipts become load-bearing; a future contributor cannot edit `stage-gate.mjs` without re-clearance.
- (−) Conductor behavior is now coupled to a patent-locked decision path; a HALT verdict can stall a pipeline
  run, so the HALT disposition (U3) must be defined before approval to avoid silent deadlock.

## Unresolved questions (Rust-RFC)

- U1 — **Which exact HS-2026-0NN claim** covers the *runtime stage-gate embodiment* (as distinct from the
  HS-058 VSA→CSL library carve-out already recorded in HCP-2026-014)? ARBITER cannot resolve it from the repo
  (no per-ID catalog). **Founder must pin it before approval.**
- U2 — **tau source:** a single φ-derived `GATE` band for all stages, vs. a **per-stage tau table** (some
  stages stricter). A per-stage table is itself patent-zone gate surface — set its shape on approval.
- U3 — **HALT disposition:** does a `HALT` verdict hard-stop the run, or downgrade to `CAUTIOUS` with an
  escalation to the Multi-Model Council (C7, HeadyArena) / a human approver? This changes whether the gate can
  deadlock a pipeline and must be fixed before wiring.

## Patent declaration

- **Zone:** HS-058 (VSA→CSL bridge band) within the HS-2026-051..062 estate.
- **Mechanism claimed:** using the cosine-similarity τ of a stage's output embedding against its goal
  embedding, banded by φ-derived thresholds (`GATE.HALT = ψ²`, `GATE.EXECUTE = ψ`), as the deterministic
  conditional that gates orchestration stage transitions (EXECUTE / CAUTIOUS / HALT), with a replayable signed
  decision receipt.
- **Reduction to practice may be evidenced by:** legacy `governance/legacy/BUDDY_KERNEL.md` (9-stage
  battle-sim `CSLGate` stage + CSL truth table) and the legacy `core/heady-manager-kernel.js` (BE-02)
  `cslGate`+`phiBackoff` decision surface; the rebuild's cleared pure library `packages/csl-engine/src/index.mjs`.
- **Clearance asked of the founder (Eric Haywood):** (a) confirm/pin the exact claim id (U1); (b) authorize
  re-embodying the CSL stage-gate mechanism in `@heady/kernel` as approved internal use; (c) add CODEOWNERS on
  `packages/kernel/src/stage-gate.mjs`. Per `policies/approval.rego`: `required_count := 2` (patent_locked).

## φ-canary rollout plan (reviewable section, G6)

1. Land `stage-gate.mjs` as a pure function behind a config flag (`heady.kernel.csl_stage_gate`, default OFF);
   unit + contract tests assert determinism and the `EXECUTE | CAUTIOUS | HALT` banding against fixtures (no
   conductor wiring yet).
2. Shadow-run inside the conductor on a **non-production** pipeline: compute the verdict and emit the decision
   receipt, but do **not** act on it (observe-only) — verify the verdicts match expectations and the audit
   receipts are reproducible across replays.
3. φ-stepped enablement: enforce the verdict on 1 stage → FIB-stepped fan-out across the 21 HCFullPipeline
   stages → full, with Sentry SLO watch on stage-stall rate and an immediate flag-off rollback if HALT verdicts
   spike beyond the φ-derived budget.

## Decision outcome

**Pending.** No stage-gate code is wired into the conductor under this HCP until `status: approved` with 2
approvals and U1 (claim id) resolved. Until then, the conductor (Step 4) proceeds stage-to-stage on its plain
topological order without a CSL transition gate, and `@heady/csl-engine` remains available only as a pure
library callable by individual services.

<!-- HEADY_BRAND:BEGIN
  Heady™ Change Proposal HCP-0002 — Kernel CSL Stage-Transition Gate (C1 / Step 4)
  © 2026 HeadySystems Inc. — Eric Haywood, Founder
HEADY_BRAND:END -->
