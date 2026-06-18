# HCP-0004 — HeadyBee Swarm + Resonance Routing (C4 / Step 7, patent-zone clearance)

> **Heady Change Proposal.** Template: Nygard ADR + MADR 4.0 + Y-statement + Rust-RFC
> (Drawbacks/Unresolved) + Oxide-RFD. Governs both the change and its deploy (G6). This proposal
> exists because creating `@heady/bees` re-embodies a patent-locked mechanism — **multi-resonance swarm
> routing with φ-scaled worker pools** (legacy Stages 5–6 BeeDispatch/SwarmRoute) — as *running worker
> code*. It is the C4 cluster (build Step 7 — memory + swarm) and supplies the workers the HCFullPipeline
> conductor (HCP-0003) dispatches to. **The agent proposes; the human approves; the environment enforces.**

**Machine-readable approval record** (canonical shape the OPA policy + approval API read; `id`,
`diff_hash`, signatures minted by `POST /api/approvals` on submission — `null` while `draft`). Fenced
because the Skeleton Guard reserves `docs/**` for `.md`; the API persists the live record to Neon.

```json
{
  "hcp": "HCP-0004",
  "title": "HeadyBee swarm + resonance routing",
  "id": null,
  "id_note": "ULID minted by POST /api/approvals on submission; null while draft.",
  "status": "draft",
  "status_states": ["draft", "pending", "approved", "rejected", "expired", "superseded"],
  "patent_locked_zone": true,
  "required_count": 2,
  "required_count_rule": "policies/approval.rego — required_count := 2 if patent_locked_zone else 1",
  "subject": {
    "type": "change",
    "concept_cluster": "C4 — HeadyBee swarm + 17-swarm matrix (resonance routing, φ pools, ≤ ceiling)",
    "build_step": "Step 7 — memory + swarm",
    "authority": ["governance/legacy/BUDDY_KERNEL.md §3 (Stages 5–6)", "governance/legacy/README.md (6765 guard / 10000 ceiling)", "governance/legacy/RECONCILIATION_DECISIONS.md (capacity)"],
    "zone_paths": [
      "packages/bees/** (proposed — does not yet exist)",
      "packages/csl-engine/** (consumed — resonance = cosine)",
      "packages/kernel/src/conductor.mjs (caller — HCP-0003)"
    ],
    "patent_claims": ["HS-2026-051..062 estate — multi-resonance swarm routing embodiment (exact id pinned by founder — U1)"],
    "diff_hash": null
  },
  "blocking_questions": [
    "U1: pin the exact HS-2026-0NN claim covering the resonance-routing swarm embodiment",
    "U2: dispatch transport — NATS vs. CF Queues (consistency with HCP-0003 substrate, ADR-0002)",
    "U3: runtime guard — enforce 6765 (Fibonacci, RECONCILIATION_DECISIONS) and keep 10000 roadmap-only?",
    "U4: bee execution surface — V8 isolates / Workers vs. Cloud Run tasks (fault-domain isolation)"
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
    { "at": "2026-06-17T21:30:00Z", "type": "drafted", "by": "heady-agent",
      "note": "C4/Step-7 concept-migration HCP. Proposes @heady/bees (new package) embodying BaseHeadyBee lifecycle + multi-resonance routing + φ pools. Workers the HCP-0003 conductor dispatches to. ARBITER G2 expected BLOCK→HCP on the resonance-routing claim surface." }
  ],
  "policy": "policies/approval.rego",
  "enforcement": ["CI: opa eval --fail-defined", "runtime: opa-wasm", "GitHub: Deployment Protection Rules + CODEOWNERS /patent-locked/**"],
  "gate": "No bee/swarm code created until status=approved with 2 approvals and U1+U2 resolved."
}
```

## Context (Nygard)

`packages/bees` **does not yet exist** in the rebuild (the plan marks it ⚠️ = to-be-created). The legacy
reduction-to-practice lives in `governance/legacy/BUDDY_KERNEL.md §3`: **Stage 5 BeeDispatch** routes a
task to domain worker bees by **multi-resonance scoring** (50% semantic resonance + 20% priority + 30%
memory relevance), creating a swarm when coordination is needed; **Stage 6 SwarmRoute** selects the swarm
config under **φ-scaled concurrency pools (Hot 34 / Warm 21 / Cold 13)**. Capacity is bounded by a
**Fibonacci runtime guard 6765** with a **10000 strategic ceiling** (`governance/legacy/README.md`,
`RECONCILIATION_DECISIONS.md` — the guard is enforced; 10000 stays roadmap language until capacity-tested).
"Resonance" is cosine similarity — i.e. the routing decision is itself CSL.

What exists in the rebuild to build on: `@heady/csl-engine` (cosine = the resonance metric),
`@heady/phi-math` (FIB[] → pool sizes 34/21/13 and the 6765 guard), and — pending HCP-0003 — the
conductor that will call BeeDispatch/SwarmRoute as pipeline stages. What does not exist is the
**`BaseHeadyBee` lifecycle + the resonance router + the pool manager** — this HCP proposes creating
`@heady/bees` to embody them.

ARBITER (G2 pre-port) is expected to rule **BLOCK→HCP**: multi-resonance swarm routing (weighted cosine
resonance + φ-scaled pool allocation + Fibonacci capacity guard, deciding which worker(s) execute a task)
is Heady patent claim-surface within the HS-2026-051..062 estate (the swarm-coordination pattern family).
Creating the package re-embodies the running mechanism and needs this HCP.

## Decision drivers (MADR)

- D1 — Bees are **workers the conductor dispatches to** (HCP-0003 Stages 5–6), not standalone microservices
  (the rebuild bans new microservices, plan note 06-G11). `@heady/bees` is a library + a runtime host.
- D2 — Routing is **CSL resonance, not `if/else`** — `resonanceScore = 0.5·cos(task, bee) + 0.2·priority +
  0.3·memoryRelevance`, dispatched to the highest-scoring bee(s); swarm = consensus superposition.
- D3 — φ-only sizing (`@heady/phi-math`): Hot 34 / Warm 21 / Cold 13 pools, **6765 Fibonacci runtime
  guard** enforced (10000 ceiling roadmap-only per RECONCILIATION_DECISIONS); never magic numbers.
- D4 — **Fault-domain isolation**: a bee failure must not cascade across pools; each bee runs in an
  isolated execution surface with a deterministic lifecycle (SPAWN → READY → RUN → REPORT → RETIRE).
- D5 — Dispatch transport is **durable** and consistent with the conductor substrate (ADR-0002): NATS or
  CF Queues, single CF AI Gateway egress for any model calls a bee makes (closes R-3).
- D6 — Determinism (C6): bee selection given the same `(task-vector, pool-state, seed)` is reproducible;
  dispatch decisions emit a replayable record to `@heady/task-ledger`.

## Considered options (MADR)

1. **Create `@heady/bees`: `BaseHeadyBee` lifecycle + resonance router + φ pool manager, dispatched by the conductor (proposed).**
   A `BaseHeadyBee` base class (deterministic lifecycle hooks), a `resonanceRouter` (weighted-cosine scoring
   over a bee registry, consuming `@heady/csl-engine`), and a `poolManager` (Hot/Warm/Cold φ pools + 6765
   guard). The conductor's Stage 5/6 call `route()` and `dispatch()`. *Pros:* faithful to legacy Stages 5–6;
   reuses CSL + phi-math; durable + replayable; fault-isolated. *Cons:* commits the resonance-routing claim
   surface to running code → 2-approver clearance + CODEOWNERS; new package surface to maintain.
2. **Flat round-robin / queue worker pool (no resonance).** Dispatch tasks to any free worker.
   *Pros:* almost certainly outside the claim (generic). *Cons:* discards the migrated C4 concept entirely,
   no semantic routing, no φ pools — fails D2/D3.
3. **Defer swarm; run all work inline in the conductor (status quo).** *Pros:* nothing new is patent-bound.
   *Cons:* no parallel worker fan-out, no domain specialization, conductor becomes a monolith — fails D1/D4
   and leaves Step 7 unbuilt.

## Decision (Y-statement)

> In the context of giving the HCFullPipeline conductor (HCP-0003) a fleet of domain workers to dispatch to
> at Stages 5–6,
> facing the fact that multi-resonance swarm routing with φ-scaled pools is patent claim-surface
> (HS-2026-051..062 estate),
> we propose **Option 1** — create `@heady/bees` with a deterministic `BaseHeadyBee` lifecycle, a CSL
> `resonanceRouter` (weighted-cosine scoring consuming `@heady/csl-engine`), and a φ `poolManager`
> (Hot 34 / Warm 21 / Cold 13, 6765 Fibonacci guard), dispatched durably and recording decisions to
> `@heady/task-ledger`,
> to achieve a faithful re-embodiment of legacy BeeDispatch/SwarmRoute,
> accepting that no bee/swarm code is created until this HCP reaches `approved` with **2 approvals** and
> U1 (claim id) + U2 (transport) resolved, with CODEOWNERS enforcement on `packages/bees/**`.

## Consequences / Drawbacks (Rust-RFC)

- (+) The conductor gains parallel, domain-specialized workers selected by CSL resonance — the C4 concept
  becomes running code faithful to Stages 5–6.
- (+) Reuses `@heady/csl-engine` (resonance) and `@heady/phi-math` (pools, 6765 guard); fault-isolated
  lifecycle prevents cascade failures; dispatch decisions are replayable via `@heady/task-ledger`.
- (+) φ-scaled pools + Fibonacci guard give predictable, capacity-bounded concurrency (no unbounded fan-out).
- (−) Running worker code embodies a patent claim → CODEOWNERS on `packages/bees/**` + signed approval
  receipts become load-bearing; future edits need re-clearance.
- (−) New package + runtime host to operate and observe (pool utilization, retire rates) — added ops surface.
- (−) Resonance weights (0.5/0.2/0.3) are a tuning surface; mis-set weights degrade routing quality and may
  themselves be a trade-secret payload (flag for U-review, do not hardcode publicly without sign-off).

## Unresolved questions (Rust-RFC)

- U1 — **Which exact HS-2026-0NN claim** covers the resonance-routing swarm embodiment? Founder must pin it.
- U2 — **Dispatch transport:** NATS vs. CF Queues — must match the HCP-0003 conductor substrate (ADR-0002).
- U3 — **Runtime guard:** enforce 6765 (Fibonacci) as the hard runtime cap and keep 10000 as roadmap-only,
  per RECONCILIATION_DECISIONS — confirm.
- U4 — **Bee execution surface:** V8 isolates / Cloudflare Workers (edge, fast spawn) vs. Cloud Run tasks
  (heavier, origin) — sets the fault-domain boundary and the cost profile.

## Patent declaration

- **Zone:** HS-2026-051..062 estate — multi-agent swarm coordination / resonance-routing embodiment.
- **Mechanism claimed:** routing a task to one or more worker agents by a weighted composite cosine-resonance
  score (semantic resonance + priority + memory relevance), allocating workers across φ-scaled concurrency
  pools under a Fibonacci capacity guard, forming a consensus-superposition swarm when coordination is
  required, with deterministic, replayable dispatch decisions.
- **Reduction to practice may be evidenced by:** legacy `governance/legacy/BUDDY_KERNEL.md §3` Stages 5–6
  (BeeDispatch multi-resonance scoring + SwarmRoute φ pools 34/21/13) and `governance/legacy/README.md` /
  `RECONCILIATION_DECISIONS.md` (6765 guard / 10000 ceiling).
- **Clearance asked of the founder (Eric Haywood):** (a) confirm/pin the exact claim id (U1); (b) authorize
  creating `@heady/bees` embodying the swarm-routing mechanism as approved internal use; (c) add CODEOWNERS
  on `packages/bees/**`; (d) rule whether the resonance weights are a trade-secret payload to keep private.
  Per `policies/approval.rego`: `required_count := 2`.

## φ-canary rollout plan (reviewable section, G6)

1. Create `@heady/bees` as pure logic behind a flag (`heady.bees.enabled`, default OFF): `BaseHeadyBee`
   lifecycle, `resonanceRouter`, `poolManager`. Unit + contract tests assert deterministic routing for fixed
   `(task, registry, seed)`, the φ pool sizes, and that the 6765 guard rejects over-allocation.
2. Shadow dispatch on a **non-production** conductor run: compute routing decisions and emit the dispatch
   record, but execute work inline (observe-only) — verify selections match expectations and pool accounting
   is correct under load.
3. φ-stepped enablement: real dispatch to 1 bee type → FIB-stepped fan-out across domain bees and the
   Hot/Warm/Cold pools, with Sentry SLO watch on bee-retire/error rates and pool saturation, immediate
   flag-off rollback if saturation or cascade-failure indicators exceed the φ-budget.

## Decision outcome

**Pending.** No bee/swarm code is created under this HCP until `status: approved` with 2 approvals and
U1 (claim id) + U2 (transport) resolved. Until then `packages/bees` stays absent, and the conductor
(HCP-0003) runs work inline without a swarm dispatch layer.

<!-- HEADY_BRAND:BEGIN
  Heady™ Change Proposal HCP-0004 — HeadyBee Swarm + Resonance Routing (C4 / Step 7)
  © 2026 HeadySystems Inc. — Eric Haywood, Founder
HEADY_BRAND:END -->
