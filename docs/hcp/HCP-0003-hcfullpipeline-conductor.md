# HCP-0003 — HCFullPipeline Conductor (C3 / Step 4, patent-zone clearance)

> **Heady Change Proposal.** Template: Nygard ADR + MADR 4.0 + Y-statement + Rust-RFC
> (Drawbacks/Unresolved) + Oxide-RFD. Governs both the change and its deploy (G6). This proposal
> exists because re-embodying the **HCFullPipeline** — the deterministic, replayable orchestration
> state machine — as *running conductor code* re-embodies a patent-locked mechanism (the staged
> cognitive DAG with φ-backoff transitions and signed receipts) rather than a doc or a pure library.
> It is the C3 companion to HCP-0002 (the C1 stage-gate that fires *inside* this pipeline), and the
> orchestration spine of build Step 4 (HeadyManager + HeadyConductor). **The agent proposes; the human
> approves; the environment enforces.**

**Machine-readable approval record** (the canonical shape the OPA policy + approval API read; `id`,
`diff_hash`, and per-approver signatures are minted by `POST /api/approvals` on submission — `null`
while `draft`). Stored as a fenced block because the Skeleton Guard reserves `docs/**` for `.md`; the
approval API persists the live record to Neon `approvals`/`approval_events`.

```json
{
  "hcp": "HCP-0003",
  "title": "HCFullPipeline conductor",
  "id": null,
  "id_note": "ULID minted by POST /api/approvals on submission; null while draft.",
  "status": "draft",
  "status_states": ["draft", "pending", "approved", "rejected", "expired", "superseded"],
  "patent_locked_zone": true,
  "required_count": 2,
  "required_count_rule": "policies/approval.rego — required_count := 2 if patent_locked_zone else 1",
  "subject": {
    "type": "change",
    "concept_cluster": "C3 — HCFullPipeline (deterministic staged cognitive DAG + path variants)",
    "build_step": "Step 4 — Orchestration core (HeadyManager + HeadyConductor)",
    "authority": ["governance/directives/07-hcfullpipeline.md (v9.0, 22-stage canonical)", "docs/compendium/03-pipeline-and-nodes.md"],
    "zone_paths": [
      "packages/kernel/src/conductor.mjs (proposed)",
      "packages/kernel/src/stage-gate.mjs (consumed — HCP-0002)",
      "apps/heady-conductor/** (proposed CF Workflows host)"
    ],
    "patent_claims": ["HS-2026-051..062 estate — staged cognitive DAG embodiment (exact id pinned by founder — U1)"],
    "supersedes_note": "Rebuild canon is the 22-stage DAG (00–21, DISTILL added v9.0), NOT the legacy 21-stage linear list. This HCP builds the buildable reduction spine, not the full designed loop.",
    "diff_hash": null
  },
  "blocking_questions": [
    "U1: pin the exact HS-2026-0NN claim covering the staged-DAG conductor embodiment",
    "U2: durable substrate — CF Workflows (step.do / step.waitForEvent) vs. CF Queues+DO, per ADR-0002",
    "U3: APPROVE (stage 11) human-gate wiring — step.waitForEvent target (Linear approval? HeadyBuddy?)",
    "U4: which variant ships first — Fast (00-01-02-07-12-13-20) as the MVP spine vs. Full"
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
    { "at": "2026-06-17T13:00:00Z", "type": "drafted", "by": "heady-agent",
      "note": "C3/Step-4 concept-migration HCP. Proposes the HCFullPipeline conductor as a durable CF-Workflows-backed staged DAG consuming the HCP-0002 stage-gate. ARBITER G2 expected BLOCK→HCP on the staged-DAG claim surface." }
  ],
  "policy": "policies/approval.rego",
  "enforcement": ["CI: opa eval --fail-defined", "runtime: opa-wasm", "GitHub: Deployment Protection Rules + CODEOWNERS /patent-locked/**"],
  "gate": "No conductor code deployed until status=approved with 2 approvals and U1+U2 resolved."
}
```

## Context (Nygard)

The rebuild already declares the canonical pipeline in `governance/directives/07-hcfullpipeline.md` (v9.0):
**22 stages, 00–21**, whose execution order is a **data-dependency DAG** (a stage fires when its inputs
are ready — *not* by priority), backed by **durable Cloudflare Workflows** (each stage = `step.do`; each
human gate = `step.waitForEvent`). The directive is explicit that this supersedes the legacy 21-stage
linear count (stage 21 `DISTILL` was added in the v9.0 compendium scan) and that the legacy "12-stage"
and "no-queues, all-fire-at-once" framings are **rejected** (ADR-0002: the DAG is real, durable
queues/outbox are required, only externally-visible-state-mutating steps are checkpointed).

What exists today is the **directive (the spec)** plus its constituent pieces: `@heady/kernel` (boot/
lifecycle microkernel), the proposed `stage-gate.mjs` (HCP-0002, the CSL transition gate), `@heady/auto-context`
(the systemic CHANNEL_ENTRY enrichment, Stage 00), `@heady/task-ledger` (the outbox + state machine that
records pipeline progress), and `@heady/observability` (stage-duration metrics). What does **not** exist
is the **conductor that sequences them** — the running embodiment of the staged DAG.

Legacy reduction-to-practice for this mechanism lives in `governance/legacy/MASTER_DIRECTIVES.md`
(Directive 7, the 21-stage table with per-stage gates, φ-backoff transitions `1618→2618→4236ms`, seeded
PRNG for reproducibility, Ed25519-signed RECEIPT) and `governance/legacy/BUDDY_KERNEL.md` (the 9-stage
battle-sim that is the legacy conductor's inner loop). This HCP proposes re-embodying that mechanism — the
**deterministic, replayable, signed staged cognitive DAG** — as `packages/kernel/src/conductor.mjs` plus
a durable host `apps/heady-conductor/` on Cloudflare Workflows.

ARBITER (G2 pre-port) is expected to rule **BLOCK→HCP**: the staged cognitive DAG with φ-backoff
transitions, deterministic seeded sampling, CSL-gated stage entry, and signed trust receipts is Heady
patent claim-surface within the HS-2026-051..062 estate. The directive being committed as a *spec* does
not clear the *running embodiment* — the conductor code needs this HCP.

## Decision drivers (MADR)

- D1 — The conductor must implement the directive-07 **buildable reduction spine**
  (`CLASSIFY → TRIAGE → DECOMPOSE → (ARENA/JUDGE) → APPROVE → EXECUTE → VERIFY → RECEIPT → DISTILL`),
  running `SELF_*`/`EVOLUTION` as a **MAPE-K loop** (not inline per-request), per the directive's own
  "canonical reduction" section — *not* the full 22-stage loop on day one.
- D2 — **Determinism is load-bearing** (C6): seeded PRNG (seed 42), φ-backoff transitions, checkpoint only
  on externally-visible state mutation, replayable from the event log (`@heady/task-ledger` outbox).
- D3 — **Durable substrate, no custom LangGraph** (plan §4.1 HeadyConductor → "CF Workflows + Queues + DO;
  no custom orchestration"). Cloud-deployed only (no localhost), single CF AI Gateway egress (closes R-3).
- D4 — The conductor **consumes** `stage-gate.mjs` (HCP-0002) for CSL stage entry and `@heady/auto-context`
  for Stage 00 — it does not reimplement either; CSL-replaces-conditionals holds throughout.
- D5 — φ-only constants (`@heady/phi-math`): backoff ladder, SLA bands (<60s MEDIUM, <300s HIGH), the
  EVOLUTION ≤13% change magnitude, FIB-sized fragment budgets — never magic numbers.
- D6 — Stage 11 APPROVE is a real **human gate** (`step.waitForEvent`); progress is a `task_ledger` row, so
  the conductor and the Step-1 task tree are the same source of truth.

## Considered options (MADR)

1. **Durable CF-Workflows conductor implementing the reduction spine, consuming the HCP-0002 stage-gate (proposed).**
   `conductor.mjs` defines the DAG (stage → inputs → gate → outputs); `apps/heady-conductor` hosts it as a
   Cloudflare Workflow where each stage is `step.do` and APPROVE is `step.waitForEvent`. SELF_*/EVOLUTION run
   as an out-of-band MAPE-K loop. *Pros:* faithful to directive-07; durable + replayable for free; reuses
   cleared pieces; no new microservices. *Cons:* commits the staged-DAG claim surface to running code →
   2-approver clearance + CODEOWNERS; ties orchestration to CF Workflows runtime semantics.
2. **Custom in-process orchestrator (LangGraph-style) on Cloud Run.** Hand-rolled DAG executor in
   `@heady/kernel`. *Pros:* full control, no CF Workflows coupling. *Cons:* explicitly **rejected** by the
   plan (no custom LangGraph) and ADR-0002; we'd own durability, retry, and replay ourselves — high risk,
   re-derives a solved problem.
3. **Keep directive-07 as spec only; let each service self-sequence (status quo).** *Pros:* nothing new is
   patent-bound at the conductor layer. *Cons:* no single deterministic/replayable orchestration surface, no
   signed receipts, drift between services — fails D1, D2, D6 and leaves Step 4 unbuilt.

## Decision (Y-statement)

> In the context of building the rebuild's orchestration core (Step 4) so non-trivial tasks flow through a
> deterministic, replayable, auditable pipeline,
> facing the fact that the staged cognitive DAG is patent claim-surface (HS-2026-051..062 estate) even
> though directive-07 already specifies it,
> we propose **Option 1** — add `packages/kernel/src/conductor.mjs` (the DAG definition + transition rules)
> and `apps/heady-conductor/` (a durable Cloudflare Workflow host) implementing the directive-07 buildable
> reduction spine, consuming `stage-gate.mjs` (HCP-0002) and `@heady/auto-context` (Stage 00) and recording
> progress to `@heady/task-ledger`,
> to achieve a faithful, durable, signed re-embodiment of HCFullPipeline,
> accepting that no conductor code is deployed until this HCP reaches `approved` with **2 approvals** and
> U1 (claim id) + U2 (durable substrate) are resolved, with CODEOWNERS enforcement on the touched zone.

## Consequences / Drawbacks (Rust-RFC)

- (+) Step 4 gets a real orchestration spine: deterministic, replayable from the event log, signed RECEIPT
  per run — the C3 concept becomes running code aligned to directive-07.
- (+) Reuses every cleared piece (stage-gate, auto-context, task-ledger, observability, AI Gateway egress);
  introduces no new microservice and no custom orchestration framework.
- (+) Stage 11 APPROVE as `step.waitForEvent` makes the human-in-the-loop gate first-class and durable; the
  conductor and the Step-1 task tree share one source of truth.
- (−) Running orchestration code embodies a patent claim → CODEOWNERS on `/patent-locked/**` + signed
  approval receipts become load-bearing; future edits need re-clearance.
- (−) Couples orchestration to Cloudflare Workflows runtime semantics (step memoization, event waits, sub-
  request limits); a substrate change later is a non-trivial migration.
- (−) The MVP ships the *reduction spine*, not the full 22-stage loop — SELF_*/EVOLUTION/DISTILL land as a
  later MAPE-K increment, so "full HCFullPipeline" is explicitly deferred (U4).

## Unresolved questions (Rust-RFC)

- U1 — **Which exact HS-2026-0NN claim** covers the staged-DAG conductor embodiment (distinct from the C1
  stage-gate claim in HCP-0002)? Founder must pin it before approval.
- U2 — **Durable substrate:** CF Workflows (`step.do`/`step.waitForEvent`) as primary vs. CF Queues + Durable
  Objects, per ADR-0002. Affects checkpoint granularity and the APPROVE wait mechanism.
- U3 — **APPROVE wiring:** what does `step.waitForEvent` listen for at Stage 11 — a Linear approval state
  transition, a HeadyBuddy decision, or a signed human approval event on the bus?
- U4 — **First variant:** ship **Fast** (`00-01-02-07-12-13-20`) as the buildable MVP spine, or go straight
  to **Full**? (Arena/Learning variants follow once HeadyArena (C7) and the learning loop (C12) land.)

## Patent declaration

- **Zone:** HS-2026-051..062 estate — staged cognitive DAG orchestration embodiment.
- **Mechanism claimed:** a deterministic, replayable orchestration state machine sequencing reasoning
  stages as a data-dependency DAG, with CSL-gated stage entry, φ-backoff transition retries, seeded-PRNG
  reproducibility, durable checkpointing on externally-visible state mutation, and an Ed25519/ML-DSA-signed
  trust receipt per run.
- **Reduction to practice may be evidenced by:** legacy `governance/legacy/MASTER_DIRECTIVES.md` Directive 7
  (21-stage table, per-stage gates, φ-backoff ladder, seeded PRNG, signed RECEIPT) and
  `governance/legacy/BUDDY_KERNEL.md` (9-stage battle-sim inner loop); the rebuild's committed
  `governance/directives/07-hcfullpipeline.md` (v9.0, 22-stage DAG spec).
- **Clearance asked of the founder (Eric Haywood):** (a) confirm/pin the exact claim id (U1); (b) authorize
  re-embodying the staged-DAG conductor in `@heady/kernel` + `apps/heady-conductor` as approved internal
  use; (c) add CODEOWNERS on the conductor zone. Per `policies/approval.rego`: `required_count := 2`.

## φ-canary rollout plan (reviewable section, G6)

1. Land `conductor.mjs` as a pure DAG definition + transition-rule module behind a config flag
   (`heady.kernel.conductor`, default OFF); unit + contract tests assert deterministic stage ordering, the
   φ-backoff ladder, seeded-PRNG reproducibility, and that CSL stage entry delegates to `stage-gate.mjs`.
2. Deploy `apps/heady-conductor` to a **non-production** Cloudflare Workflow and run the **Fast** variant
   (`00-01-02-07-12-13-20`) end-to-end on a probe task — verify durable replay, the Stage 00 auto-context
   capsule, the Stage 11 `waitForEvent` human gate, and the signed Stage 20 RECEIPT.
3. φ-stepped enablement: Fast variant on low-consequence tasks → FIB-stepped fan-out to the Full spine →
   add SELF_*/EVOLUTION as the MAPE-K loop, with Sentry SLO watch on per-stage duration (<60s MEDIUM /
   <300s HIGH) and immediate flag-off rollback if stage-stall or HALT-verdict rate exceeds the φ-budget.

## Decision outcome

**Pending.** No conductor code is deployed under this HCP until `status: approved` with 2 approvals and
U1 (claim id) + U2 (substrate) resolved. Until then, directive-07 remains a committed spec, the constituent
packages (`@heady/kernel`, `stage-gate.mjs` pending HCP-0002, `@heady/auto-context`, `@heady/task-ledger`)
stand alone, and no staged-DAG orchestration runs.

<!-- HEADY_BRAND:BEGIN
  Heady™ Change Proposal HCP-0003 — HCFullPipeline Conductor (C3 / Step 4)
  © 2026 HeadySystems Inc. — Eric Haywood, Founder
HEADY_BRAND:END -->
