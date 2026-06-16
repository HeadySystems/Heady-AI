<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ Legacy Extraction Engine — Component Carve-Out System     ║
║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# The Extraction Engine — Carving Legacy Heady into the Rebuild

> **Status:** Draft for approval · **Date:** 2026-06-16 · **Owner:** Eric Anthony Haywood
> **Source corpus:** legacy stack at `/home/headyme/Heady` (372 top-level entries)
> **Target:** rebuild monorepo at `/home/headyme/Heady-AI`
> **Governed by:** `SOURCE_OF_TRUTH.md`, `REBUILD_PLAN_V2.md` (§2 method, §13 phases), ADRs 0000–0024,
> `AGENTS.md` hard rules.

This is **deep-research output applied**: the canonical migration literature (Strangler Fig, Branch by
Abstraction, Anti-Corruption Layer, Characterization Tests, `git filter-repo`, AST codemods) reduced to
the one mechanism Heady actually needs given its premise — and wired to the agents, gates, and ledgers
that already exist in this repository. No new autonomous entities are invented; the engine **orchestrates
tools and review agents that are already defined.**

---

## 0. What this document is (and is not)

The rebuild already has four artifacts. This is the fifth, and it is the **connective tissue** between
them — a repeatable engine, not a competing plan.

| Artifact | Answers | This doc's relationship |
|---|---|---|
| `LEGACY_STACK_COMPONENT_DISPOSITION.md` | **What** each legacy component is and its mark (✅/🔧/⏸/❌) | **Consumes** one disposition row as input. Never re-litigates a mark. |
| `STEPWISE_BUILD_SPEC.md` | **What/when** to build, in dependency order (`P.N` steps) | **Emits** a STEPWISE entry per extracted component. |
| `REBUILD_PLAN_V2.md` | **Which phase** and the migration *method* (§2) | **Inherits** the pre-launch port-and-verify premise. Never re-orders phases. |
| `facts.yaml` + `tooling/data-consistency` | The **golden record** + the fail-closed conformance gate | Used as the **post-merge precondition** every extracted component must clear. |

> **One-sentence definition.** The Extraction Engine takes a single disposition row
> (e.g. `BE-04 · shared/csl-engine-v2.js · 🔧 Adapt`) and deterministically produces: a conformant
> monorepo package + characterization tests + a durable ledger record + a `STEPWISE_BUILD_SPEC` entry +
> an HCP (Heady Change Proposal) where it touches a locked decision or patent zone.

It is **not** a re-inventory (the disposition is authoritative), **not** a phase plan (REBUILD_PLAN_V2
is), and **not** a live-traffic cutover (see §1).

---

## 1. Premise inheritance — why this is port-and-verify, not Strangler Fig

The migration literature converges on a kit built for **migrating live production traffic**: Strangler
Fig at the perimeter, Branch by Abstraction inside the code, Parallel Run + diffing for high-risk paths,
an Anti-Corruption Layer in front of the legacy service ([AWS][acl], [Microsoft][sf-azure],
[Fowler/Simran][simran]). `REBUILD_PLAN_V2.md` §2 establishes the founder-confirmed premise that
**collapses most of that kit**: Heady is pre-launch — *no live traffic to shadow, no production data to
migrate.* The engine inherits that premise verbatim and extends it to the carve-out context:

| Migration technique | Extraction Engine disposition | Why |
|---|---|---|
| Edge Worker / proxy in front of live origins (Strangler Fig perimeter) | **Skip** | No live origin to intercept. The edge router is built fresh in Phase 3. |
| Parallel Run + Scientist shadow-diff vs legacy | **Skip** | No production behavior to diff against. |
| Anti-Corruption Layer as a *runtime* facade to a live legacy service | **Skip the runtime ACL.** Keep the *concept* as a **build-time** boundary: port logic directly into a bounded-context module with a Zod-validated public API. | The ACL's value here is the clean interface, not isolating a running legacy system. |
| Branch by Abstraction | **Keep, reframed** as the *codemod seam* (§5): the abstraction is the new package's public API; the legacy impl is replaced behind it in one move, not gradually. | We control all call sites in a greenfield monorepo. |
| Characterization / golden-master tests | **Keep, bifurcated** (§6) | The single most valuable technique that survives — but it splits by disposition mark. |
| `git filter-repo` history import | **Keep, selectively** (§5) | Only for components whose history is worth preserving. |
| Feature flags + expand-migrate-contract | **Keep** | Cheap; pays off the moment there are users. |

> 🔴 **The one carve-out the premise does not cover — R-5.** "Port-and-verify, no data migration"
> assumes Neon is greenfield. Risk **R-5** records that Neon may already hold a live schema
> (`001_initial_schema.sql` marked *Applied 2026-03-07*). **Therefore: the engine hard-gates `DA-01`
> (canonical pgvector schema) extraction on R-5 verification.** If `\dt heady_*` on the live Neon
> endpoint returns rows, the data layer is **not** greenfield and reverts to full
> expand→migrate→contract (ADR-0007) instead of a clean port. This is the only place live-migration
> rigor re-enters.

---

## 2. Engine architecture — stages and the three real gates

The engine is a **deterministic pipeline** (one component at a time, or φ-batched — see §8), punctuated by
**gates**. The gates are not new "bees" — they are the **review agents already registered in this
environment**, invoked at fixed checkpoints. A gate returns a **CSL ternary verdict**
(`ALLOW` / `BLOCK` / `DEFER`), never a boolean.

```
                          ┌─────────────────── disposition row (BE-04, 🔧) ───────────────────┐
                          ▼                                                                     │
 ┌──────────┐   ┌──────────────────┐   ┌────────────┐   ┌──────────────────┐   ┌────────────┐ │
 │ S0 SELECT │──▶│ G1  PRE-IMPORT   │──▶│ S1 IMPORT  │──▶│ G2  PRE-PORT     │──▶│ S2 PORT/   │ │
 │ pick row  │   │  ▸ security-bee  │   │ filter-repo│   │  ▸ arbiter       │   │   CODEMOD  │ │
 │ from disp │   │  (R-1,R-2,R-7,   │   │ or copy +  │   │  (HS-051..062    │   │ ts-morph / │ │
 │           │   │   R-10 scrub)    │   │ scrub      │   │   patent lock)   │   │ jscodeshift│ │
 └──────────┘   └────────┬─────────┘   └────────────┘   └────────┬─────────┘   └─────┬──────┘ │
                  BLOCK ──┘ → quarantine                 BLOCK ───┘ → hold for HCP    │        │
                                                                                       ▼        │
 ┌────────────┐   ┌──────────────────┐   ┌────────────┐   ┌──────────────────┐   ┌──────────┐ │
 │ S5 LEDGER  │◀──│ G4 POST-MERGE    │◀──│ S4 LAND    │◀──│ G3 POST-PORT     │◀──│ S3 CHAR. │◀┘
 │ + STEPWISE │   │  ▸ consistency   │   │ flag-gated │   │  ▸ eval-gate     │   │  TESTS   │
 │ + HCP      │   │   gate (facts)   │   │ merge to   │   │  (build/test/    │   │ (§6)     │
 │            │   │   FAIL-CLOSED    │   │ rebuild    │   │   lint/type/AGENTS)│ │          │
 └────────────┘   └──────────────────┘   └────────────┘   └──────────────────┘   └──────────┘
```

### The three review gates map to existing agents

| Gate | Agent (already defined) | Position | Verdict gates on | Risk interlock |
|---|---|---|---|---|
| **G1 Pre-import** | `security-bee` | **Before** any legacy bytes enter the rebuild working tree | Committed secrets, fail-open auth, localhost, leaked keys | R-1, R-2, R-7, R-10 |
| **G2 Pre-port** | `arbiter` | **Before** modifying any file in a patent-lock zone | Claims at risk in HS-2026-051…062 → `ALLOW`/`BLOCK` | R-8 |
| **G3 Post-port** | `eval-gate` | **After** codemod, **before** merge | build · unit tests · lint · type-check · AGENTS.md hard rules | ESM, no-localhost, no-TODO, φ-constants, Zod, brand header |
| **G4 Post-merge** | `tooling/data-consistency` (the gate, not an agent) | **After** land, as the conformance precondition | Component matches `facts.yaml` golden record | Mirrors gate-then-embed: conformance is fail-closed |

> **Gate placement is load-bearing.** Secret + patent gates are **pre-import / pre-port** — you must not
> pull a leaked key into history or touch a patent file before clearance. The consistency gate is
> **post-merge** — a component can only be checked for golden-record conformance once it exists in the
> tree. Placing any gate on the wrong side of the import is the classic way these systems leak.

---

## 3. Routing by disposition mark — the engine's core logic

The disposition **mark is the routing key.** The engine does exactly one of four things:

| Mark | Path | Stages run | Tooling | Output |
|---|---|---|---|---|
| ✅ **Integrate** | History-preserving port | S0→G1→S1(`filter-repo`)→**header inject**→S3(golden-master)→G3→G4→S5 | `git filter-repo`, brand-header codemod | Package landed with full history; snapshot tests assert byte-equality |
| 🔧 **Adapt** | Codemod rewrite | S0→G1→S1→G2→**S2 codemod**→S3(contract tests)→G3→G4→S5 | `git filter-repo` *or* copy, then `ts-morph`/`jscodeshift` | Rewritten bounded-context package; tests assert the **public contract** |
| ⏸ **Defer** | Backlog, no extraction | S0 → write backlog row + **trigger condition** | — | A `STEPWISE` deferred entry with its unlock condition; engine stops |
| ❌ **Drop** | Provenance-only | S0 → **provenance tarball** → archive | `tar` to `_archive/provenance/` | Tarball for audit; **no code enters the rebuild** |

`✅` and `🔧` are the only paths that produce a package. `⏸` and `❌` terminate early — but are still
**recorded in the ledger** (§7), so the engine can prove every one of the ~100 meaningful components was
adjudicated, not silently dropped.

---

## 4. History decision — `filter-repo` vs copy-forward

Per `REBUILD_PLAN_V2` §2, history import is **kept selectively.** The decision is mechanical:

- **Preserve history** (`git filter-repo --path <legacy/subdir>` into a temp repo, then merge as a
  subtree) **when** the legacy commit log carries audit or attribution value — e.g. `heady-manager` (the
  named legacy core to migrate-then-archive, BE-01), the patent implementations (BZ-01, under `arbiter`),
  the canonical migrations lineage (DA-01). This is the [git-filter-repo subdirectory extraction][gfr]
  workflow: clone the monolith, filter to the subtree with its history, integrate into the monorepo.
- **Copy-forward (no history)** for everything else — the majority. Most legacy code is CJS sprawl being
  fundamentally rewritten; its line-level history dies in the codemod anyway. A single
  `Extracted-From:` trailer in the landing commit + the ledger `source_sha` preserves provenance more
  usefully than a filtered log of soon-to-be-deleted CJS.

> Either way, **G1 (`security-bee`) runs on the imported tree before it is staged.** `filter-repo` does
> not scrub secrets from the *content* of historical commits unless told to — so the secret purge
> (`--replace-text`, ADR-0008 / STEPWISE 0.4) is part of S1, not an afterthought.

---

## 5. The codemod seam — how 🔧 Adapt is mechanized

🔧 **Adapt is ~45 of the ~100 components** — the bulk of the work — and it is where Branch by Abstraction
actually lives in this system: the new package's public API is the abstraction; the codemod replaces the
legacy impl behind it in one transactional rewrite. Search-and-replace is rejected; transforms operate on
the **AST** so they are type-aware and format-preserving ([why codemods beat search-and-replace][tstv]).

**Tooling.** `ts-morph` for type-aware transforms (it reasons about types, not just syntax), `jscodeshift`
for structural transforms at scale (parallel by default, format-preserved via `recast`) — both are
2026-production-grade ([Codemod/ts-morph][codemod-tsm], [jscodeshift][jsc]). Each transform is a named,
tested codemod under `tooling/extraction-engine/codemods/`.

**The canonical transform catalog** (every one enforces an `AGENTS.md` rule, so G3 passes by construction):

| Codemod | From (legacy) | To (locked) | Enforces |
|---|---|---|---|
| `cjs-to-esm` | `require()` / `module.exports` | `import` / `export` | ESM-only |
| `path-rewrite` | `/home/headyme/Heady/...`, `../../shared/` | monorepo `@heady/*` specifiers | No broken/legacy paths (fixes BE-05) |
| `console-to-pino` | `console.log/error` | `logger.*` with `X-Heady-Trace-Id` | Zero `console.log` |
| `magic-to-phi` | literal timeouts / pool sizes / TTLs | `phiBackoff()`, `FIB[n]`, `PHI_*` from `phi-math` | No magic numbers |
| `store-rewrite` | Qdrant / Pinecone / Redis-as-authority / `vector(1536)` | pgvector authority + Vectorize cache, `vector(384)` | ADR-0003, embedding lock (fixes R-4, DA-02/07) |
| `egress-rewrite` | direct Gemini/Claude/GPT/Groq HTTPS calls | CF AI Gateway client | R-3 (single egress chokepoint) |
| `localhost-purge` | `localhost`, `127.0.0.1`, `:3310` literals | env-var URLs | Zero-localhost (fixes R-10) |
| `if-to-cslgate` | threshold `if/else` on scores | `cslGate(value, cosScore, tau)` | CSL-gate pattern |
| `brand-header` | (missing) | `HEADY™` header block | Header required (also runs on ✅ path) |
| `zod-boundary` | unvalidated handler inputs | Zod `.strict()` parse from `packages/contracts` | Zod at boundaries |

Codemods are **composable and idempotent** (re-running is a no-op), mirroring the embed-corpus ledger
discipline. A component's transform set is declared in its ledger row; the engine applies them in order,
then hands the result to S3.

---

## 6. Characterization tests — bifurcated by mark

This is the technique that survives the pre-launch collapse, and it is **not one-size-fits-all.**
Characterization / golden-master testing (Feathers) captures *actual* behavior to protect against
unintended change ([Wikipedia][char], [understandlegacycode][ulc]). But the rebuild **intentionally
changes internals** for 🔧 components — so byte-equality is the wrong assertion for the majority:

| Mark | Test class | Asserts | Rationale |
|---|---|---|---|
| ✅ **Integrate** (port-as-is) | **Golden master / snapshot equality** | New output ≡ legacy output, byte-for-byte, over a fixture corpus | The port is supposed to be behavior-preserving; equality is the correct guard. |
| 🔧 **Adapt** (rewritten) | **Behavioral contract tests** | New module honors the **public API / Zod shape** in `packages/contracts` — same inputs → same *contract-valid* outputs, internals free to differ | The codemod deliberately rewrites internals (CJS→ESM, store swap). Byte-equality would fail by design; the contract is the invariant. |

> Reframed from `REBUILD_PLAN_V2` §2: tests are authored from the **legacy code's intended behavior**, not
> from captured production traffic (there is none). For ✅, "intended behavior" = "current output." For
> 🔧, "intended behavior" = "the public contract we are committing to in `packages/contracts`."

Volatile values (timestamps, trace ids, UUIDs, embedding floats) are **masked** in both the golden master
and the candidate output before comparison — the standard golden-master hygiene that keeps the technique
practical.

---

## 7. The extraction ledger — authority for "extracted"

Mirroring the gate-then-embed pattern (`CLAUDE_MEMORY.md` §2: *the LEDGER, not the diff, is the
authority*), a durable, atomic ledger is the single source of truth for migration state. It lives at
`.data/extraction/ledger.json` and is the artifact the living dashboard and consistency engine read.

```jsonc
// .data/extraction/ledger.json — one record per disposition row
{
  "disposition_id": "BE-04",
  "source_path": "/home/headyme/Heady/shared/csl-engine-v2.js",
  "source_sha": "a1b2c3…",                 // legacy content hash at extraction time (provenance)
  "mark": "adapt",                          // integrate | adapt | defer | drop
  "target_pkg": "@heady/csl-engine",               // null for defer/drop
  "history_strategy": "copy-forward",       // filter-repo | copy-forward | none
  "codemods": ["cjs-to-esm","path-rewrite","if-to-cslgate","magic-to-phi","brand-header"],
  "gate_verdicts": {
    "security_bee": "ALLOW",                // G1
    "arbiter":      "ALLOW",                // G2 — note: HS-058 overlap (BZ-05/VSA) → BLOCK→HCP
    "eval_gate":    "ALLOW",                // G3
    "consistency":  "ALLOW"                 // G4 (post-merge, fail-closed)
  },
  "char_test_class": "contract",            // golden-master | contract
  "char_test_ref": "packages/csl-engine/test/contract.test.ts",
  "stepwise_entry": "1.3",
  "hcp_id": "HCP-2026-014",                 // present when a locked decision / patent zone is touched
  "flag": "heady.csl.v2",                   // expand-migrate-contract feature flag
  "state": "landed",                        // see §8 state machine
  "extracted_at": "2026-06-16T…Z"
}
```

A component is **"extracted" iff its ledger record reaches `landed` with all four gate verdicts `ALLOW`.**
Cold-start, re-extraction after a legacy change (`source_sha` advanced), and catch-up are all derivable
from the ledger — exactly as the embed-corpus ledger handles incremental embedding.

---

## 8. Component lifecycle — the state machine

```
 selected ──▶ import_blocked ──(secret/auth fix or drop)──▶ dropped
    │                                                          ▲
    ▼                                                          │
 imported ──▶ patent_held ──(HCP signed)──▶ porting           │
    │                                          │               │
    ▼                                          ▼               │
 porting ──▶ char_failed ──(fix)──▶ porting   tested           │
    │                                  │                       │
    ▼                                  ▼                       │
 tested ──▶ eval_failed ──(fix)──▶ porting    merged           │
    │                                  │                       │
    ▼                                  ▼                       │
 merged ──▶ consistency_failed ──(fix)──▶ porting   landed     │
                                            │                  │
 (defer path)  selected ──▶ deferred ───────┼──(trigger)──▶ selected
```

Backward edges are permitted only on gate failure (re-port). `deferred → selected` fires when the
deferred entry's **trigger condition** is met (e.g. "Phase 4 begins" for BE-18 verticals). `dropped` and
`landed` are terminal.

**Concurrency & pacing (φ-scaled, per `AGENTS.md`).** Extractions run in Fibonacci-sized batches — default
`FIB[5]=5` independent components per wave — with **no two components writing the same target package** in
a wave (the monorepo analog of "don't let agents collide on files"). Gate retries use `phiBackoff()`. The
living dashboard's heartbeat is `heartbeatMs = 29034` (φ⁷×1000), consistent with the MCP Console.

---

## 9. Tooling — `tooling/extraction-engine`

A new tool alongside the existing `tooling/{data-consistency,embed-corpus,skeleton-guard,skill-registry}`.
It is **orchestration only** — it shells out to the real agents and codemods; it embeds no business logic.

```
tooling/extraction-engine/
  src/
    extract.mjs            # entry: `node src/extract.mjs <disposition-id> [--dry-run|--batch|--json]`
    router.mjs             # mark → path (§3); pure, unit-tested
    ledger.mjs             # atomic read/write of .data/extraction/ledger.json (§7)
    gates/
      pre-import.mjs       # invokes security-bee; parses ALLOW/BLOCK/DEFER (G1)
      pre-port.mjs         # invokes arbiter on patent-lock zones (G2)
      post-port.mjs        # invokes eval-gate (G3)
      post-merge.mjs       # invokes tooling/data-consistency check() (G4)
    history.mjs            # filter-repo vs copy-forward (§4)
    emit.mjs               # writes STEPWISE entry + opens HCP when required
  codemods/                # §5 catalog — each a tested ts-morph/jscodeshift transform
  test/
```

**Fail-closed by construction**, mirroring the embed gate: if any gate returns `BLOCK`, the engine writes
the verdict to the ledger and **halts that component** — it never lands code past a `BLOCK`. A `DEFER`
verdict (e.g. `arbiter` needs founder sign-off) parks the component in `patent_held`/`deferred` with the
required HCP id, exactly as the consistency gate is a fail-closed precondition of embedding.

CLI surface (consistent with `heady-embed`):

```bash
node tooling/extraction-engine/src/extract.mjs BE-04            # extract one component
node tooling/extraction-engine/src/extract.mjs --batch P1       # all Phase-1 ✅/🔧 rows, φ-waved
node tooling/extraction-engine/src/extract.mjs BE-04 --dry-run  # plan + gate preview, no writes
node tooling/extraction-engine/src/extract.mjs --json           # ledger state for the dashboard
```

---

## 10. Worked example — `BE-04 shared/csl-engine-v2.js` → `@heady/csl-engine`

A 🔧 Adapt of the CSL differentiator (live dependency, imported everywhere), walked through every gate.

| Stage | Action | Result |
|---|---|---|
| **S0 Select** | Read disposition row `BE-04` (🔧 Adapt → `@heady/csl-engine`, `cslGate`). | Router picks the **Adapt** path. |
| **G1 Pre-import** | `security-bee` scans `shared/csl-engine-v2.js`. | `ALLOW` — pure ESM math, no secrets/localhost. Ledger `security_bee: ALLOW`. |
| **S1 Import** | History-worth? No (single file, being rewritten) → **copy-forward** with `Extracted-From:` trailer + `source_sha`. | File staged in working tree. |
| **G2 Pre-port** | `arbiter` checks patent zones. CSL touches **HS-058** (BZ-05 VSA→CSL bridge overlaps). | `BLOCK → DEFER`: opens **HCP-2026-014** declaring the patent-lock zone. Founder signs → `ALLOW`. |
| **S2 Port/codemod** | Apply `path-rewrite` (fix the legacy `../../shared/` that broke BE-05's dead copy), `if-to-cslgate`, `magic-to-phi`, `brand-header`. | Emits `packages/csl-engine/src/index.ts` exporting `cslGate`, bounded-context shape, Zod surface in `packages/contracts`. |
| **S3 Char. tests** | **Contract** class (it's a rewrite): assert `cslGate` honors the `packages/contracts` CSL shape — same `(value, cosScore, tau)` → same ternary verdict, internals free to differ. | `packages/csl-engine/test/contract.test.ts` green. |
| **G3 Post-port** | `eval-gate`: build, vitest, eslint, tsc, AGENTS.md rules. | `ALLOW` — ESM ✓, no console ✓, φ-constants ✓, header ✓, Zod ✓. |
| **S4 Land** | Merge behind flag `heady.csl.v2` (expand-migrate-contract); legacy `csl-engine.js` root copy (BE-05) marked for drop. | In tree. |
| **G4 Post-merge** | `tooling/data-consistency` checks `@heady/csl-engine` against `facts.yaml`. | `ALLOW` — conforms to golden record. |
| **S5 Emit** | Ledger → `landed`; write `STEPWISE` step `1.3`; HCP-2026-014 recorded. | Component proven extracted. |

The competing CSL copies (`csl-engine.js` root BE-05 — broken import, dead) never enter the engine: their
disposition is ❌ Drop → provenance tarball only. The engine has now **collapsed CSL's 3+ copies to one
authority** with a signed patent record and a passing contract test — the whole point of the carve-out.

---

## 11. Critical-risk interlocks — fail-closed, non-negotiable

The disposition's R-1…R-10 are not advisory; they are **wired into the gates** so the engine physically
cannot violate them. This is the org's zero-placeholder / fail-closed mandate expressed as machinery.

| Risk | Interlock | Gate / stage |
|---|---|---|
| R-1 live key committed | Secret scan + `filter-repo --replace-text` purge **before** stage | G1 + S1 |
| R-2 / R-7 fail-open auth/CORS | `security-bee` BLOCKs any ported auth/middleware that isn't fail-closed | G1 |
| R-3 AI-Gateway bypass | `egress-rewrite` codemod is mandatory on any component making model calls | S2 |
| R-4 embedding-dim drift | `store-rewrite` codemod; `vector(1536)` sources (DA-02) routed to ❌ Drop | S2 / router |
| **R-5 live Neon schema** | **DA-01 extraction hard-gated on `\dt heady_*` verification** (§1) | S0 precondition |
| R-8 patent IP | `arbiter` ALLOW/BLOCK on HS-051…062; bulk-delete forbidden | G2 |
| R-9 merge-conflict markers | `eval-gate` build fails on unresolved markers | G3 |
| R-10 localhost / Windows paths | `localhost-purge` codemod + `eval-gate` rule | S2 + G3 |

---

## 12. Outputs the engine produces

Per the disposition doc's stated terminus — *"each ✅/🔧 component becomes a `STEPWISE_BUILD_SPEC.md`
entry and an HCP where it touches a patent-lock zone or locked decision"* — every successful extraction
emits, atomically:

1. **A conformant package** under `packages/*` (or `apps/*`), passing G3 + G4.
2. **Characterization tests** (golden-master for ✅, contract for 🔧) committed alongside the code.
3. **A ledger record** at `landed` with four `ALLOW` verdicts (the authority for "done").
4. **A `STEPWISE_BUILD_SPEC.md` entry** (`P.N`) with Build / Depends / Details / Done / Ref.
5. **An HCP** when a patent zone (R-8) or locked decision (store, gateway, auth) is touched — carrying the
   Ed25519-signed approval receipt, φ-canary plan, and declared patent-lock zone (REBUILD_PLAN_V2 §10).

The engine's invariant: **no code lands without all four gates `ALLOW` and a ledger record** — the same
fail-closed contract that governs gate-then-embed, applied to migration.

---

## Sources

Migration & extraction methodology grounding (deep-research pass, 2026-06-16):

- [git-filter-repo subdirectory extraction with history][gfr] · Git Tower
- [Characterization / golden-master testing (Feathers)][char] · Wikipedia
- [Characterization vs approval vs regression tests][ulc] · understandlegacycode
- [Strangler Fig pattern][sf-azure] · Microsoft Learn / [Anti-Corruption Layer][acl] · AWS Prescriptive Guidance
- [Branch by Abstraction vs Strangler Fig vs Parallel Run — when to use which][simran]
- [Why codemods beat search-and-replace][tstv] · typescript.tv · [jscodeshift][jsc] · [ts-morph support][codemod-tsm]

[gfr]: https://www.git-tower.com/learn/git/faq/git-filter-repo
[char]: https://en.wikipedia.org/wiki/Characterization_test
[ulc]: https://understandlegacycode.com/blog/characterization-tests-or-approval-tests/
[sf-azure]: https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig
[acl]: https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/strangler-fig.html
[simran]: https://simranchawla.com/unlocking-legacy-systems-strangler-fig-branch-by-abstraction-and-parallel-run-explained/
[tstv]: https://typescript.tv/best-practices/why-codemods-beat-search-and-replace-every-time/
[jsc]: https://github.com/facebook/jscodeshift
[codemod-tsm]: https://codemod.com/blog/ts-morph-support

---

*∞ Sacred Geometry · Liquid Intelligence · Permanent Life ∞*
*© 2026 HeadySystems Inc. — Eric Haywood, Founder*
