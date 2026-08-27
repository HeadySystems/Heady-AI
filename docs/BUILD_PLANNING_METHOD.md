<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ Build-Planning Method — map once, slice straight through   ║
║  Made with ❤️ by HeadySystems Inc.                                ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# Build-Planning Method — functional-first-time by construction

> **Status:** Built + proven · **Date:** 2026-06-16 · **Owner:** Eric Anthony Haywood
> **Harness:** `tooling/build-plan` (`heady-plan`) · **Worked goal:** `tooling/build-plan/goals/portal-codeflow.json`

The question: *how do you build the fully-functional thing the first time* instead of shipping a simple
slice and bolting the rest on later? Answer: **separate plan-completeness from build-increments.** Map the
whole end goal once; then build dependency-ordered **vertical slices behind frozen seams.** Both halves are
required — either alone fails:

- **Simple-first alone** → the prototype gets bolted onto; shared interfaces rework later.
- **Map-everything alone** → nothing runs until the end; the map drifts.

## The method (5 rules)

1. **Map the end goal before the first slice** — contexts, **contracts (seams)**, entities, the dependency
   DAG, and acceptance criteria. Not "the simple version" — the *target*.
2. **Freeze the seams up front, fill behind them.** Define every public port for the end goal first; the
   simple impl and the full impl share it. Extending = a new impl behind the port, never a caller rewrite.
3. **Slice vertically, in topological order.** Each increment runs end-to-end for one capability. Never
   "all backend then all UI."
4. **Deferred = a designed, wired seam, not a surprise.** A node you won't build yet still gets its port
   frozen, so its dependents stay runnable.
5. **Pre-register every entity at plan time** → the coherence gate is green from the first commit.

## The harness — and the deterministic proof

`tooling/build-plan` takes one goal spec and emits **two** plans over the same DAG — `mapped`
(straight-through) and `iterative` (simple-first) — then compares them on objective metrics. Each plan is
hashed with a **canonical (sorted-key) SHA-256**, so *the same goal yields the same plan hash every run* —
the plan is replay-provable, not vibes. (`tooling/build-plan/test` asserts hash-stability across runs.)

```bash
node tooling/build-plan/src/plan.mjs tooling/build-plan/goals/portal-codeflow.json
```

### Result on our real portal/codeflow goal (reproducible)

| Metric | mapped | simple-first | winner |
|---|---|---|---|
| seam-rework (shared interfaces reworked) | **0** | 2 | mapped |
| dependency-order violations | **0** | 2 | mapped |
| slices runnable when built | **10** | 8 | mapped |
| deferred nodes wired behind a frozen seam | **1** | 0 | mapped |
| plan hash (stable across runs) | `10638b649391468d` | `01a4d7413f782772` | — |

**Verdict (machine-emitted): PROVEN** — mapped-straight-through is rework-free and green-by-construction;
simple-first incurs *deterministic* rework. Invariants held: `seamRework=0`, `orderViolations=0`,
`greenFromStart=true`, `mapped < iterative` on rework.

### Why this is grounded, not rigged

The 2 seam-reworks the simple-first plan incurs are **real ones we hit this session**:
- **`WritePort`** — `governed-edit` (local apply) and `prod-apply` (GitHub App, ADR-0016) bind the same
  seam. Built simple-first, `governed-edit`'s apply was written *without* the port → `prod-apply` becomes a
  rework (exactly the "deferred to prod" we reported). Mapped freezes `WritePort` first → `prod-apply` is
  just a second impl, **zero rework**.
- **`AuthPort`** — `auth` and `onboarding` share it; lazy definition reworks the first when the second lands.

## How a future "go" should run

1. Author/extend the goal spec (contexts, contracts, entities, capabilities+deps+seams, acceptance, mark
   deferred nodes).
2. `heady-plan <goal>` → take the **mapped** order + frozen-seam list + slice sequence.
3. Pre-register the entities (coherence stays green); freeze the seams as ports in `packages/contracts`.
4. Build the slices in order; each slice's "done" = its acceptance criterion. Deferred nodes ship as a
   wired port with a stub impl — never a surprise.

The decomposition DAG (`tooling/decomposition`), the coherence kernel (`tooling/coherence`,
pre-registration), and `packages/contracts` (seam freezing) are the existing parts this method wires into a
single front-loaded pass.

---
*∞ Sacred Geometry · Liquid Intelligence · Permanent Life ∞*
*Made with ❤️ by HeadySystems Inc.*
