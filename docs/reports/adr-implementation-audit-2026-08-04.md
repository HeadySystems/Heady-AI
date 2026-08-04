<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  HEADY™ · adr-implementation-audit-2026-08-04.md                   ║
<!-- ║  Per-ADR implementation status + optimality assessment.            ║
<!-- ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END -->

# HEADY™ ADR Implementation Audit — all 46 decisions

**Date:** 2026-08-04 · **Scope:** `HeadySystems/heady-ai` @ `rebuild` · **Set:** `docs/adr/0000`–`0045`

## Method & epistemic status

Each ADR was read for its **mandated artifact** (a module, config key, CI job, or migration),
then that artifact was probed on disk and, where a gate exists, the gate was run. Statuses below
are **verified from tool output**, not inferred from prose. Where an ADR mandates only a policy
with no code surface, it is marked as such rather than counted as "implemented."

The distinction that matters most here is **built vs. gated**. Heady's own governing principle
is "pick one source of truth per concern and derive everything else from it deterministically."
By that standard a decision is only *optimally* implemented when a machine prevents its
violation — otherwise it decays to prose. That is the lens applied in the Optimality column.

| Status | Meaning | Count |
|---|---|---|
| ✅ **Implemented + gated** | artifact exists **and** a gate fails on violation | **15** |
| 🟢 **Built, ungated** | artifact exists; no automated enforcement | **6** |
| 🟡 **Partial** | core landed, a mandated piece missing | **14** |
| ⬜ **Declared, not built** | accepted; no implementing artifact | **5** |
| 📄 **Policy/process** | no code artifact expected | **5** |
| ⛔ **Superseded** | replaced by a later ADR | **1** |

---

## Cohort A — Backbone (`0000`–`0018`, ratified 2026-06-17 per ADR-0013)

| ADR | Decision (summary) | Status | How / evidence | Optimality |
|---|---|---|---|---|
| 0000 | Reject RAM-first / latent-as-truth; durable store is truth | 📄 | Honored structurally by 0003 + `packages/db` | Sound — a rejection needs no artifact; 0003 carries it |
| 0001 | Canonical repo = this monorepo, `rebuild` branch | ✅ | `SOURCE_OF_TRUTH.md`; `origin/HEAD → rebuild` verified | Optimal |
| 0002 | Architecture backbone (SoR + outbox) | ✅ | Both cited paths exist; outbox in `packages/consistency-bus` | Optimal |
| 0003 | Retrieval authority = Neon pgvector (not Vectorize/Qdrant) | ✅ | `packages/embedding`, `packages/memory-stream`, `vector(384)` in 3 migrations; `facts.v1` const-locks it | **Best-in-set** — value, code, and gate agree |
| 0004 | Durable orchestration = CF Workflows + Queues + DO | 🟡 | `packages/kernel`, `apps/heady-portal-gateway` | DO deferred to Phase 2+ — deferral is documented, acceptable |
| 0005 | Agent governance + coder-agent blast radius | ✅ | `packages/admin-guard`, `tooling/governance-gate`, `packages/approvals` | Optimal — gate runs in CI (`arbiter-gate.yml`) |
| 0006 | Idempotency-key schema | 🟢 | Referenced in migrations `0001_init`, `0004_approval_control_plane` | Schema-level only; no test asserts replay-safety |
| 0007 | DDL coordination across logical replication | 🟡 | Cited path exists; largely a runbook | Process-bound; fine while single-writer |
| 0008 | Data retention & GDPR posture | 📄 | Policy; retention windows not yet in migrations | **Gap risk** — a retention policy with no scheduled deleter is aspirational |
| 0009 | PITR / DR drill schedule | 📄 | Schedule doc; drills are manual | Acceptable pre-launch; needs a calendar owner |
| 0010 | Rate-limit & token budgets | 🟡 | `packages/resilience` exists | Budgets not const-locked in `facts.yaml` — driftable |
| 0011 | SLO-based on-call | 📄 | Policy only (solo founder) | Correctly scoped to headcount |
| 0012 | FinOps caps + daily spend reporting | 📄 | Policy; legacy `finops-budget-router.js` in `src/` | Reporting loop not wired in rebuild — cost blindness risk |
| 0013 | Founder-bottleneck governance | ✅ | `packages/approvals` + `apps/approval-api` + migration `0004` | Optimal — became executable via 0031 |
| 0014 | Logical replication / WAL CDC | 🟡 | Scoped by coherence `LAW11` to DB→derived-store only | **Elegant** — the gate encodes the *scope boundary*, not just the choice |
| 0015 | Embedding-model lock (`bge-small-en-v1.5`, 384) | ✅ | `facts.v1` const-locks model + dim; embedder fails closed on wrong dim | **Best-in-set** |
| 0016 | Native agent loop + rustc-style Stage-0 bootstrap | ✅ | `configs/stage0-untouchables.json` + coherence `STAGE0-*` | Strong. 3 of 16 roles still `present:false` (below) |
| 0017 | Projections engine & lifecycle | ✅ | `tooling/projection-engine` + `projection-drift.yml` cron | Optimal — drift detected on a schedule |
| 0018 | Model gateway & liquid routing | ⬜ | `packages/liquid-gateway` **absent** | Honestly tracked as Stage-0 `present:false`; the egress chokepoint is the single most load-bearing unbuilt item |

## Cohort B — v2 reconciliation (`0019`–`0029`)

| ADR | Decision (summary) | Status | How / evidence | Optimality |
|---|---|---|---|---|
| 0019 | Vite SPA + vanilla Web Components; React only for complex canvas | ✅ | `customElements.define` in 3+ `apps/headyme-portal` components; **no `react` dep in any `apps/*/package.json`** | Optimal — the constraint is observably held |
| 0020 | Inter-agent event bus = NATS | 🟡 | `packages/events` deps = `{@heady/shared}` — **no `nats` dependency** | **Weakest link.** `facts.yaml event_bus: nats` reads as locked; reality is outbox-first with NATS unbuilt. Golden record overstates the world |
| 0021 | Agent code execution sandbox | ⬜ | `packages/sandbox` absent | Accepted 2026-06-15, nothing built in 14 months of repo time |
| 0022 | Real-time state/UI sync = SSE + HTTP/2 (not WebSockets) | 🟡 | `facts.yaml ui_sync: sse-http2`; SSE in console summary route | Value locked; no gate rejects a WebSocket reintroduction |
| 0023 | Vector projection trigger = Merkle file hashing (never CDC) | ✅ | `packages/embedding` Merkle planner + coherence `LAW11` asserts zero CDC machinery in the file-index path | **Best-in-set** — gate proves a *negative* |
| 0024 | Embedding pipeline / instantaneous-acquisition ruleset | ✅ | `tooling/embed-corpus` + cited path present | Optimal |
| 0025 | Strict global consistency + non-orphanage governance | ✅ | `packages/consistency-bus`, `tooling/data-consistency`, `tooling/skeleton-guard` | Optimal — anti-orphan gate in CI |
| 0026 | MCP Console (admin UI) architecture | 🟢 | `ConsoleHoneycomb.js` + `console-logic.mjs` in `headyme-portal` | `apps/mcp-dashboard` is a README-only stub — two console surfaces, one real |
| 0027 | Task ledger + outbox-driven sync (Linear/Sentry) | ✅ | `packages/task-ledger` + migration | Optimal |
| 0028 | Cross-domain SSO partitioned-cookie governance | 🟡 | `packages/security-mesh` exists | CHIPS/partitioned specifics unverified; no test asserts the cookie attributes |
| 0029 | WASM WebContainer in-browser sandbox | ⬜ | absent (same gap as 0021) | 0021 and 0029 are the same unbuilt capability accepted twice |

## Cohort C — Later decisions (`0030`–`0032`)

| ADR | Decision (summary) | Status | How / evidence | Optimality |
|---|---|---|---|---|
| 0030 | Heady Understanding Engine (HUE) | 🟡 | **Proposed**, not Accepted; `packages/perspective` + `packages/narrative` exist | Code exists ahead of acceptance — inverted order, worth ratifying or trimming |
| 0031 | Solo-founder approval bootstrap | ✅ | `packages/approvals`, `apps/approval-api`, migration `0004`, live-verified on a Neon branch | **Best-in-set** — turned governance into a control plane |
| 0032 | The Field & agent-waves (one substrate, ephemeral localized agents) | 🟢 | `packages/perspective/src/{assign,roles,perspective-level}.mjs` | Accepted 2026-08-04; no gate binds wave semantics to code yet |

## Cohort D — Renumbered from the retired `docs/ADR/` (`0033`–`0039`)

*(These are the seven decisions moved out of the UPPERCASE directory on 2026-08-04 to resolve the
number collision — audit F1 in `sot-consistency-audit-2026-08-04.md`.)*

| ADR | Decision (summary) | Status | How / evidence | Optimality |
|---|---|---|---|---|
| 0033 | Nine-domain brand architecture (nonprofit/commercial split) | 🟡 | `src/config/domain-registry.js` + `facts.yaml` — but **facts carries 15 domains, not 9** | **Title is now false.** "Nine-domain" survived while the registry grew to 15; needs renaming or a re-ruling |
| 0034 | Drupal 11 as headless CMS | ⬜ | `apps/cms/` contains **only a `Dockerfile`** | Accepted with a skeleton; blocks 0039 |
| 0035 | PQC mandate (ML-DSA-65 / ML-KEM-768 hybrid) | 🟢 | `src/security/pqc.js`, `scripts/pqc-scanner.js` (26 rule refs), `PQC-COMPLIANCE-BRIEF.md` | Strong scanner; Phase-2 `liboqs` swap still pending, hybrid mode is the interim |
| 0036 | GCP project + region canonical lock (`heady-ai`, `us-east1`) | 🟡 | Region + project now in `facts.yaml` (this session) — but mandated **`src/config/gcp.js` is ABSENT** and the mandated **`region-lock-scan` CI job is ABSENT from `adr-sentinel.yml`** | **Most self-defeating ADR in the set** — it was written *specifically* to stop region drift via CI, and that CI never shipped. The drift it predicted then happened in `facts.yaml` |
| 0037 | `heady-manager.js` decomposition mandate | 🟢 | `apps/heady-manager/src/` = 8 ESM modules (`app`, `console`, `events`, `intelligence`, `tasks`, …) | Decomposition real; 3 of 6 ADR-cited module paths use pre-rebuild names — ADR text is stale, code is right |
| 0038 | `src/config/domain-registry.js` as canonical domain file | 🟡 | Registry exists and is consumed by `cors.js`/`auth.js` — but mandated **`scripts/validate-domain-registry.js` is ABSENT** | Same pattern as 0036: canonical file without its validator |
| 0039 | Content-gateway Cloudflare Worker contract | 🟡 | `cloudflare/worker-ai-gateway` exists; a *content* gateway does not | Correctly blocked on 0034 (Drupal); dependency is documented |

## Cohort E — Legacy→rebuild reconciliation (`0040`–`0045`)

| ADR | Decision (summary) | Status | How / evidence | Optimality |
|---|---|---|---|---|
| 0040 | Causal-inference engine (`@heady/causal-inference`) | 🟢 | `packages/causal-inference/src/index.mjs`; **8/8 tests pass**; delegates φ-banding to `@heady/csl-engine` | Clean port; patent boundary annotated for ARBITER |
| 0041 | 21-stage HCFullPipeline as canonical | ⛔ | **Superseded by 0045** (same day) | See finding 3 below |
| 0042 | Deterministic LLM execution (temp-0 + SHA-256 proof) | 🟡 | Policy accepted; **`tooling/eval-gate` ABSENT** (Stage-0 `fidelity-gate: present:false`) | Determinism claim is unverifiable until the eval harness exists |
| 0043 | Runtime capacity ceiling fib(20)=6765 enforced | 🟡 | `6765` appears **only as a member of the `FIB` array** in `packages/phi-math` — no ceiling check found | The ADR says "**enforced**"; nothing enforces it. Word choice overstates reality |
| 0044 | Sacred-geometry resource-tier & escalation overlay | ⬜ | No tier/escalation code in `packages/perspective` | Accepted 2026-08-04 as an overlay on 0032; not yet built |
| 0045 | 22-stage HCFullPipeline, DISTILL first-class terminal | ✅ | `facts.yaml stage_count: 22`, `facts-schema.mjs const: 22`, coherence `C-hcfp-stages` scalar guard, `heady-production` v8.0.0 DAG synced | Optimal — value, schema, gate, and downstream repo all agree |

---

## Findings

### 1. The dominant failure mode is "canonical file without its validator" (HIGH)
Three ADRs mandate an enforcement artifact that was never built, while the thing being governed
*was*: **0036** (`src/config/gcp.js` + `region-lock-scan` CI job), **0038**
(`scripts/validate-domain-registry.js`), **0043** (a ceiling check for 6765). ADR-0036 is the
sharp case — it was authored to prevent region drift by CI, that CI never landed, and region
drift then occurred in the golden record exactly as predicted (audit finding F2, fixed today).
**A decision whose enforcement half is skipped predicts its own violation.**

### 2. `facts.yaml` overstates two facts relative to code (MEDIUM)
- `event_bus: nats` — `@heady/events` has **no `nats` dependency**; the real path is outbox-first
  (0020). A reader of the golden record would believe NATS is live.
- ADR-0043's "enforced" ceiling isn't enforced.

Both are *the golden record claiming more than the world*, which is the one failure the coherence
gate cannot catch (it checks prose against `facts.yaml`, not `facts.yaml` against reality).

### 3. Two same-day, mutually contradictory Accepted ADRs (HIGH — process)
**0041** (21-stage) and **0045** (22-stage) were both accepted 2026-08-04 hours apart, by the same
founder, through two different channels. 0045 now supersedes 0041 with the reasoning recorded. The
underlying process risk stands: canon is being authored in parallel by agents that cannot see each
other's rulings. **0040 also collided by number** with a `0040-causal-inference-engine` landing at
the same time — the exact defect class the F1 audit had just eliminated.

### 4. Accepted-but-unbuilt cluster, and one duplicate (MEDIUM)
**0018** (liquid gateway — the egress chokepoint), **0021** + **0029** (the *same* WASM sandbox
capability accepted twice), **0034** (Drupal, skeleton only), **0044** (tier overlay). 0018 and
0042 are honestly tracked in the Stage-0 manifest as `present:false`; 0021/0029/0034/0044 are not
tracked anywhere as debt.

### 5. Stale ADR text where the code moved on (LOW)
**0033** still says "Nine-Domain" while the registry carries 15. **0037** cites three module paths
that predate the rebuild layout. Neither is a defect in the *decision* — only in its description.

### 6. Code ahead of acceptance (LOW)
**0030** (HUE) is still `Proposed` while `packages/perspective` and `packages/narrative` ship.
Either ratify it or mark the packages exploratory.

## Recommended next actions, in priority order

1. **Build the three missing validators** — `region-lock-scan` in `adr-sentinel.yml`,
   `scripts/validate-domain-registry.js`, and a real ceiling assertion. Highest ratio of
   drift-prevented to effort, and it closes the class that already bit us once.
2. **Reconcile `facts.yaml` to reality** for `event_bus` (scope NATS as best-effort/planned) and
   amend 0043's "enforced" wording — or make it true.
3. **Add a reality-direction check** to the coherence gate: assert that named dependencies in
   `facts.yaml` actually appear in the corresponding `package.json`. This catches finding 2's whole
   class, which no current gate can see.
4. **Register the untracked debt** (0021/0029 dedup, 0034, 0044) in the Stage-0 manifest or an
   equivalent ledger, so "accepted but unbuilt" is visible rather than implied.
5. **Serialize canon authorship** — require ADR-number allocation through one gate so parallel
   agents cannot mint colliding or contradictory decisions (findings 3).
6. Rename or re-rule **0033** ("nine-domain" → the actual count) and refresh 0037's path list.

φ = 1.618033988749895 — Fibonacci-scaled per LAW-10
© 2026 HeadySystems Inc. — Eric Haywood, Founder
