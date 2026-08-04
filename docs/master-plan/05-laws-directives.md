<!-- HEADY_BRAND:BEGIN
  HEADY™ · docs/master-plan/05-laws-directives.md
  Master Incorporation Plan — Domain 05: Unbreakable Laws, Directives & Governance
  ∞ Sacred Geometry · Liquid Intelligence ∞
  © 2026 HeadySystems Inc. — Eric Haywood, Founder
HEADY_BRAND:END -->

# Domain 05 — Unbreakable Laws, Directives & Governance

> **Scope.** The constitutional law set, the operational directive set, every ADR (across **two**
> colliding ADR directories), and the governance/enforcement tooling that is supposed to make the laws
> *unbreakable* rather than aspirational.
>
> **Ground-truth note.** `docs/LAW_TRANSFER_AUDIT.md` (dated 2026-06-16) describes an earlier disk state
> ("honor-system; `tooling/law-lint` owns Laws 0–2"). **Disk has moved on (06-17):** the canonical law
> set was reconciled into `governance/CONSTITUTION.md`, the legacy sources were transferred verbatim into
> `governance/legacy/`, the Law→enforcer map now lives in `governance/enforcement/law-enforcers.yaml`,
> `tooling/enforcers/` now owns Laws 0/1/2, and `tooling/law-lint` was narrowed to ESM + brand only.
> This document treats **disk as ground truth** and flags the audit's superseded claims inline.

---

## (a) The Unbreakable Laws

There are **three distinct law families** on disk. They must not be collapsed — they sit at different
altitudes and have different enforcement realities.

### Family 1 — The 4 Liquid Architecture Laws (the substrate)

Source: `governance/CONSTITUTION.md` Part A + `docs/compendium/01-laws-and-constants.md §L1`.
Machine map: `governance/enforcement/law-enforcers.yaml → architecture_laws`.

| # | Law | Principle | Rebuild enforcement | Status |
|---|---|---|---|---|
| L-A1 | **Liquidity** | Routing by CSL cosine, not hardcoded if/else; redundancy, zero SPOF | none (design invariant; ADR-0004 / ADR-0018 embody it) | **manual** |
| L-A2 | **φ-Scaled Proportionality** | Every constant derives from φ/Fibonacci; one source `@heady/phi-math` | `tooling/coherence` φ-constant / scalar guard (CI `scan`) | **partial** |
| L-A3 | **Sovereignty** | Heady owns compute/keys/data; secrets via GCP SM keyless OIDC; reject RAM-first (ADR-0000) | none mechanical (Law 0 enforcer covers the localhost slice only) | **manual** |
| L-A4 | **Zero Placeholders** | Deployable artifacts only; no stubs/TODO/FIXME/HACK | `tooling/enforcers/glass-box.mjs` (CI `governance`, fail-closed) | **enforced** |

### Family 2 — The 8 + 1 / 10 Constitutional "Unbreakable" Laws (the constitution)

Authoritative source: **`governance/CONSTITUTION.md` Part B** (canonical reconciliation of the legacy
8+1 `UNBREAKABLE_LAWS`, the BUDDY_KERNEL "Liquid Latent" laws, and the V9 Constitutional Laws).
Machine map: **`governance/enforcement/law-enforcers.yaml`** (`schema: heady.governance.enforcers.v1`,
`generated_from: governance/CONSTITUTION.md`). Disposition keys: `enforced` = fail-closed CI gate ·
`partial` = advisory/incomplete signal · `manual`/process = human/prose only.

| Law | Name (per CONSTITUTION) | Rebuild enforcer | CI job | Disposition |
|---|---|---|---|---|
| **Law 0** | NO LOCALHOST (cross-env purity) | `tooling/enforcers/no-localhost.mjs` | `governance` | **enforced** (red) |
| **Law 1** | NO PLACEHOLDERS / completeness | `tooling/enforcers/glass-box.mjs` (placeholder scan rides glass-box) | `governance` | **enforced** (red) — *CONSTITUTION hedges "partially enforced; placeholder scan planned Phase 2"; law-enforcers.yaml asserts `enforced`* |
| **Law 2** | NO SILENT FAILURES / Glass-Box | `tooling/enforcers/glass-box.mjs` | `governance` | **enforced** (red) |
| **Law 3** | THOROUGHNESS / solutions-not-workarounds | code-review + ADR requirement (`api-extractor`, Phase 2) | — | **process-enforced** ⚠ *see drift D-3* |
| **Law 4** | CONTEXT MAXIMIZATION (pre-action scan) | `tooling/enforcers/autocontext.mjs` + `@heady/auto-context` `wrapGateway` runtime | `governance` | **enforced** (CI + runtime) |
| **Law 5** | DETERMINISM (temp 0, top_p 1, seed 42, SHA-256 signed) | `tooling/coherence` (advisory); model-adapter test planned Phase 3 | `scan` | **partial** (amber) |
| **Law 6** | SCALE WITH INTEGRITY (10,000 ceiling / 6765 runtime guard) | `tooling/coherence`; `packages/bees` guard planned Phase 3 | `scan` | **partial** (amber) |
| **Law 7** | AUTO-SUCCESS ENGINE INTEGRITY (φ⁷ = 29,034 ms cycle) | `health-registry` (no CI gate) | none | **manual** (amber) |
| **Law 8** | ARENA MODE + NO SHIP WITHOUT TESTS (4-Layer Fortress) | vitest + eslint + tsc (CI `verify`); coverage gate Phase 2 | `verify` | **enforced** (red) — *CONSTITUTION says "partially enforced"; coverage gate still missing* |
| **Law +9** | ASAP EXECUTION (safety > speed wins ties) | human-review / pipeline SLA metrics | none | **manual** (amber) |

**Coverage claim vs reality.** `law-enforcers.yaml → coverage` asserts `total=10, enforced=6
(0,1,2,3,4,8), partial=2 (5,6), manual=2 (7,9)`. **Do not parrot "6 enforced" uncritically** — see
drift **D-3**: the YAML counts **LAW-3 as fail-closed** by relabelling it (name "Thoroughness" but a
*context-maximization* statement bound to `autocontext.mjs`), whereas **CONSTITUTION.md's** Law 3
(thoroughness/root-cause) is only *process-enforced* and its Law 4 is the context-max law. The two
sources disagree on which law the autocontext gate enforces. Honest count of laws with a true
fail-closed gate: **Laws 0, 2, 4, 8** mechanically blocked today (+ ALAW-4); **Law 1** depends on
whether the placeholder scan is actually live in glass-box (CONSTITUTION says planned).

### Family 3 — The 3 Unbreakable Laws of Code Mutation

Source: **`.agents/skills/heady-maximum-potential/SKILL.md` only** (`### 3 Unbreakable Laws`, also synced
to `.claude/skills/`). **No `CONSTITUTION.md` entry, no `law-enforcers.yaml` row, no enforcer.**

| # | Law | Meaning | Status |
|---|---|---|---|
| 1 | **Structural Integrity** | Compiles, passes type checks, respects module boundaries | **skill-only, unenforced** |
| 2 | **Semantic Coherence** | Change's embedding stays within tolerance of intended design (cosine drift < 0.809) | **skill-only, unenforced** |
| 3 | **Mission Alignment** | Serves HeadyConnection's mission (community, equity, empowerment) | **skill-only, unenforced** |

These are the "GitHub-monorepo-as-genetic-code" mutation-validation triad. They live entirely in skill
prose, are never referenced by CONSTITUTION/law-enforcers/coherence, and have no gate.

---

## (b) The Directives — legacy 10 Master Directives → disposition

**Legacy origin (`~/Heady`).** The legacy estate framed governance as **"8 unbreakable laws + 10 master
directives"** (per `~/Heady/.agents/context/HEADY_SUPER_PROMPT_v5.md` footer). The legacy
`.windsurfrules` carried a *different, conflicting* "8 Unbreakable Laws" list (THOROUGHNESS,
SOLUTIONS-NOT-WORKAROUNDS, CONTEXT-MAX, IMPLEMENTATION-COMPLETENESS, CROSS-ENV-PURITY, 10K-BEE-SCALE,
AUTO-SUCCESS-INTEGRITY, ARENA-MODE) and asserts a **stale patent count of "60+"** (canonical is 51 —
HS-2026-001..051) — both the law numbering and the count drifted from the reconciled set. (This is a
documented drift example, not an assertion; see AD-3.)

**Transfer status: DONE.** The legacy `MASTER_DIRECTIVES.md`, `UNBREAKABLE_LAWS.md`,
`SYSTEM_PRIME_DIRECTIVE.md`, `BUDDY_KERNEL.md`, `LAW-09-ASAP-EXECUTION.md`, `RECONCILIATION_DECISIONS.md`
were transferred verbatim into **`governance/legacy/`** (frozen for provenance), reconciled into
`governance/CONSTITUTION.md` + `governance/PRIME_DIRECTIVE.md`, and re-authored as the **10 numbered
directives in `governance/directives/`** (10 files confirmed).

| # | Master Directive (legacy) | Rebuild file (`governance/directives/`) | Disposition |
|---|---|---|---|
| 1 | Omnipresent Contextual Awareness (mandatory pre-action scan) | `01-contextual-awareness.md` | **active** — backs Law 3/4 (`autocontext.mjs`) |
| 2 | Instant App Generation (Silversertile Orchestrator) | `02-instant-app-generation.md` | active — backs Law 1 |
| 3 | Zero-Trust Auto-Sanitization (input hostile until validated) | `03-zero-trust-sanitization.md` | active — backs Law 0 |
| 4 | Low-Latency Deterministic Orchestration | `04-deterministic-orchestration.md` | active — backs Law 5 |
| 5 | Graceful Lifecycle Management (no zombies/leaks) | `05-graceful-lifecycle.md` | active |
| 6 | Empathic Masking & Persona Fidelity | `06-empathic-masking.md` | active |
| 7 | HCFullPipeline — 22-Stage Cognitive State Machine (ADR-0040; was 21-Stage) | `07-hcfullpipeline.md` | active — backs Law 7 |
| 8 | Continuous Learning & Pattern Evolution | `08-continuous-learning.md` | active |
| 9 | Multi-Model Council — Competitive AI Routing | `09-multi-model-council.md` | active — backs Law 8 |
| 10 | Sacred Geometry Orchestration — φ-Scaled Everything | `10-sacred-geometry.md` | active — backs Law 6 / ALAW-2 |

**⚠ Skill-claim verification (task asked).** `heady-maximum-potential/SKILL.md` lists **8 "System
Building Directives"** (Completeness-Over-Speed, Solutions-Only, Context-Maximization, Zero-Localhost,
Scale-Ready, Self-Documenting, Structured-Observability, Security-by-Default) — this is a **different,
divergent list** from the canonical 10 Master Directives. The skill does **not** carry the canonical set;
it is an independent paraphrase. Drift **D-5**.

---

## (c) Complete ADR table

> **⚠ COLLISION — two ADR directories with divergent numbering. Both claim authority; this document
> flags, it does not resolve (per task).**
>
> ✅ **Resolved 2026-08-04** (post-census): the UPPERCASE `docs/ADR/0019–0025` files were renumbered
> into the canonical set as `docs/adr/0033–0039` with provenance headers; `docs/ADR/INDEX.md` is now
> a redirect stub. The census tables below are preserved as the pre-resolution snapshot.
> See `docs/reports/sot-consistency-audit-2026-08-04.md` (F1/F3).
>
> - `docs/adr/` (lowercase) — files **0000–0029** + `README.md` + `superseded-v1/`. README declares the
>   canonical set `0000`–`0029`, all Accepted.
> - `docs/ADR/` (UPPERCASE) — **only files 0019–0023 exist on disk** + `INDEX.md`. The INDEX *lists*
>   0001–0023 with titles, but **0001–0018 have NO files** in `docs/ADR/` — a file-less parallel
>   numbering universe.
> - **Hard collision on 0019–0023:** the same number names a *different decision* in each dir
>   (e.g. lowercase 0019 = "Frontend & UI Framework Selection"; UPPERCASE 0019 = "Nine-Domain Brand
>   Architecture"). On a case-insensitive filesystem these paths would also literally collide.

### `docs/adr/` — canonical set (lowercase), all **Accepted**

| # | Title | Status | Dir |
|---|---|---|---|
| 0000 | Reject RAM-First / Latent-as-Truth | Accepted | `adr` |
| 0001 | Canonical Repository Authority | Accepted | `adr` |
| 0002 | Architecture Backbone | Accepted | `adr` |
| 0003 | Retrieval Authority — pgvector | Accepted | `adr` |
| 0004 | Durable Orchestration Center | Accepted | `adr` |
| 0005 | Agent Governance — Blast Radius | Accepted | `adr` |
| 0006 | Idempotency Key Schema | Accepted | `adr` |
| 0007 | DDL Coordination — Logical Replication | Accepted | `adr` |
| 0008 | Data Retention — GDPR | Accepted | `adr` |
| 0009 | PITR / DR Drill Schedule | Accepted | `adr` |
| 0010 | Rate Limits / Token Budgets | Accepted | `adr` |
| 0011 | SLO-Based On-Call | Accepted | `adr` |
| 0012 | FinOps Spend Reporting | Accepted | `adr` |
| 0013 | Founder-Bottleneck Governance | Accepted | `adr` |
| 0014 | Logical Replication / CDC | Accepted | `adr` |
| 0015 | Embedding Model Lock (`@cf/baai/bge-small-en-v1.5`, 384) | Accepted | `adr` |
| 0016 | Native Agent Loop Bootstrap | Accepted | `adr` |
| 0017 | Projections Engine | Accepted | `adr` |
| 0018 | Model Gateway — Liquid Routing | Accepted | `adr` |
| 0019 | Frontend & UI Framework Selection | Accepted | `adr` ⚠ collides w/ ADR-0019 |
| 0020 | Inter-Agent Event Bus | Accepted | `adr` ⚠ collides w/ ADR-0020 |
| 0021 | Agent Execution Sandbox | Accepted | `adr` ⚠ collides w/ ADR-0021 |
| 0022 | Real-Time State Sync | Accepted | `adr` ⚠ collides w/ ADR-0022 |
| 0023 | Vector Projection Trigger | Accepted | `adr` ⚠ collides w/ ADR-0023 |
| 0024 | Embedding Pipeline — Instantaneous Acquisition | Accepted | `adr` |
| 0025 | Strict Global Consistency & Non-Orphanage Governance | Accepted | `adr` |
| 0026 | MCP Console UI Architecture | Accepted | `adr` |
| 0027 | Task Ledger — Outbox Sync | Accepted | `adr` |
| 0028 | Cross-Domain SSO Cookie Governance | Accepted | `adr` |
| 0029 | WASM WebContainer Sandbox | Accepted | `adr` |

### `docs/ADR/` — UPPERCASE INDEX universe

| # | Title (per INDEX.md) | Status | Dir / file reality |
|---|---|---|---|
| 0001 | Adopt MCP as Unified Tool Gateway | Accepted | `ADR` — **NO FILE** (index-only) |
| 0002 | Cloudflare Edge + Cloud Run Origin | Accepted | `ADR` — **NO FILE** |
| 0003 | pgvector SoT + Vectorize Edge Cache | Accepted | `ADR` — **NO FILE** |
| 0004 | Liquid Gateway — Provider Racing at Edge | Accepted | `ADR` — **NO FILE** |
| 0005 | Runtime Ceiling fib(20)=6765 | Accepted | `ADR` — **NO FILE** |
| 0006 | φ-Math Single Source of Truth | Accepted | `ADR` — **NO FILE** |
| 0007 | CSL Replaces Boolean Gates | Accepted | `ADR` — **NO FILE** |
| 0008 | Dual-Active Legacy + Rebuild Strategy | Accepted | `ADR` — **NO FILE** |
| 0009 | Firebase Auth + httpOnly Cookies Only | Accepted | `ADR` — **NO FILE** |
| 0010 | Core Module Consolidation | Accepted | `ADR` — **NO FILE** |
| 0011 | Node.js ESM Only | Accepted | `ADR` — **NO FILE** |
| 0012 | 21-Stage HCFullPipeline as Canonical | Accepted (superseded by ADR-0040 → 22-stage) | `ADR` — **NO FILE** |
| 0013 | Upstash Redis EventSpine | Accepted | `ADR` — **NO FILE** |
| 0014 | Deterministic LLM Execution (temp 0 / seed 42) | Accepted | `ADR` — **NO FILE** |
| 0015 | Sacred Geometry Node Topology | Accepted | `ADR` — **NO FILE** |
| 0016 | Neon Postgres Replaces Cloud SQL | Accepted | `ADR` — **NO FILE** |
| 0017 | Structured Logging — Pino Only | Accepted | `ADR` — **NO FILE** |
| 0018 | CI/CD — GitHub Actions + Coherence Gate | Accepted | `ADR` — **NO FILE** |
| 0019 | Nine-Domain Brand Architecture | Accepted | `ADR` ⚠ collides | file present |
| 0020 | Drupal 11 as Headless CMS | Accepted | `ADR` ⚠ collides | file present |
| 0021 | Post-Quantum Cryptography Mandate (ML-DSA/ML-KEM) | Accepted | `ADR` ⚠ collides | file present |
| 0022 | GCP Project + Region Canonical Lock — us-east1 | Accepted | `ADR` ⚠ collides | file present |
| 0023 | heady-manager.js Decomposition Mandate | Accepted | `ADR` ⚠ collides | file present |

> ⚠ **Note D-ADR-region:** `docs/ADR/0022` locks GCP region to **us-east1**, while `AGENTS.md` deploy
> blocks + `facts.yaml` use **us-central1**. Region drift between the UPPERCASE ADR set and the golden
> record.
>
> ✅ **Resolved 2026-08-04:** `facts.yaml` corrected to `us-east1` (matches the live service and
> ADR-0036, ex `ADR/0022`); the `AGENTS.md` deploy block is annotated legacy-only.

### `docs/adr/superseded-v1/` — quarantined (out of canonical number-space)

| # | Title | Status | Dir |
|---|---|---|---|
| 0001 | Canonical repo = latent-core-dev | Superseded (→ 0001-canonical-repository-authority) | `adr/superseded-v1` |
| 0002 | Evolve by Strangler Fig, not greenfield | Superseded (→ 0002-architecture-backbone) | `adr/superseded-v1` |
| 0003 | Source-of-truth ledger (one place per fact) | Superseded (→ 0003-retrieval-authority-pgvector) | `adr/superseded-v1` |
| 0004 | Append-only log is truth; latent is derived | Superseded (→ 0004-durable-orchestration-center) | `adr/superseded-v1` |

**Total ADRs on disk:** 30 canonical (`adr/0000–0029`) + 5 files (`ADR/0019–0023`) + 4 superseded
(`adr/superseded-v1`) = **39 files**; plus 18 file-less index entries in `docs/ADR/INDEX.md`
(0001–0018).

---

## (d) Governance / Enforcement Tooling

### tooling/enforcers
- **Category:** Law enforcer (CI `governance` job) · **Status:** live, fail-closed · **Confidence:** high
- **What:** The canonical Law gate. Four scanners: `no-localhost.mjs` (Law 0), `glass-box.mjs`
  (Laws 1 & 2 — unstructured logging, swallowed failures, placeholder/stub shortcuts; `implements:
  LAW-0,1,2,ALAW-4`), `autocontext.mjs` (Laws 3/4 — fails any reasoning call in an anchor-less file),
  `secret-scan.mjs`. Shared regex set in `lib/rules.mjs`. Per-line waiver `// heady-allow:<rule>`.
- **Legacy:** the legacy "environment enforces" thesis (`.windsurfrules` + Anti-Shortcut protocol).
- **Rebuild:** owns Laws 0/1/2 outright (took them over from `law-lint`, eliminating the policy fork).
- **Parts:** `glass-box.mjs`, `no-localhost.mjs`, `secret-scan.mjs`, `autocontext.mjs`, `lib/`, `test/`.
- **OSS:** none (bespoke regex scanners). **Transfer:** N/A (rebuild-native).
- **Incorporation steps:** wire all four into the CI `governance` job; add the placeholder-scan block to
  `glass-box` to fully satisfy Law 1 (CONSTITUTION marks it "planned Phase 2").
- **⚠ Drift+decisions:** `LAW_TRANSFER_AUDIT.md` (06-16) predates this consolidation and still credits
  `law-lint` with Laws 0–2 — **stale**.

### tooling/law-lint
- **Category:** Law enforcer (CI `law-check`) · **Status:** live, fail-closed · **Confidence:** high
- **What (v2.0.0):** narrowed to the two `AGENTS.md` rules NOT owned by `tooling/enforcers`:
  **#1 ESM-only** (no CommonJS `require()`) and **#6 HEADY_BRAND header** on authored code files. Header
  comment explicitly states it "no longer duplicates" Laws 0/1/2 (no policy fork).
- **Legacy:** mirrors the agent-hook regex rules into CI so humans + git + PRs are bound, not just the
  Claude agent.
- **Rebuild:** scope `apps|packages|tooling|configs`; exempts tests/docs/templates/generated bundles.
- **Parts:** `src/law-lint.mjs`, `test/`. **OSS:** none. **Transfer:** N/A.
- **Incorporation steps:** keep CI `law-check` green; do not re-add Law-0/1/2 rules (owned elsewhere).
- **⚠ Drift:** audit describes the *old* broad law-lint — superseded.

### tooling/governance-gate
- **Category:** Governance gate (CI `governance`, exit 1) · **Status:** live, fail-closed · **Confidence:** high
- **What:** two mechanical invariants — (1) **patent-coverage**: every file carrying a `⚠️ PATENT` /
  `PATENT LOCK` / `patent_locked_zone` marker (zones HS-2026-051..062) MUST match a `.github/CODEOWNERS`
  rule or CI fails; (2) **workflow-sync**: `.agents/workflows` must equal `.claude/commands` (26↔26 clean).
- **Legacy:** none direct (rebuild closure of the audit's "workflow→command sync ungated" + "patent zones
  unguarded" gaps).
- **Rebuild:** self-exempts its own source; coverage scope `packages|tooling|apps|configs`.
- **Parts:** `src/governance-gate.mjs`, `test/`. **OSS:** none. **Transfer:** N/A.
- **Incorporation steps:** CODEOWNERS patch is founder-approved + ARBITER-routed; still needs GitHub
  **branch-protection requiring code-owner review** for the human gate to actually block merges.
- **⚠ Drift+decisions:** CODEOWNERS routes *required human review* but does **not** auto-invoke ARBITER
  and does not by itself block merge — open decision: make ARBITER/eval-gate **required checks**.

### tooling/coherence (incl. scalar-guard)
- **Category:** Consistency/contradiction gate (CI `scan`, exit 2) · **Status:** live, fail-closed · **Confidence:** high
- **What:** the **only** always-on data/stack invariant gate. Derives a System Map from ground-truth
  artifacts, gates on **contradiction** (not incompleteness), computes blast-radius. **Scalar-guard**
  cross-checks load-bearing canonical scalars (patent count, pipeline stages, dims, Qdrant-dropped,
  pgvector-authority, ADR-uniqueness, superseded-banner) in prose/skills against `facts.yaml`.
- **Legacy:** realizes `heady-knowledge-cartographer` as a build-time gate; found the legacy patent-count
  + `@heady/csl` drift.
- **Rebuild:** `SCALAR_SCOPE = CANON + .agents`, where
  `CANON = [docs, packages, tooling, configs, AGENTS.md, SOURCE_OF_TRUTH.md, CLAUDE.md, CLAUDE_MEMORY.md]`.
- **Parts:** `src/coherence.mjs`, `README.md`. **OSS:** none. **Transfer:** N/A.
- **Incorporation steps:** add a **law** dimension so a law violation fails closed like a stack-invariant
  one (audit recommendation, not yet done); **add `governance/` to `CANON`** (see D-1).
- **⚠ Drift+decisions:** **D-1 — `governance/` is OUTSIDE `CANON`/`SCALAR_SCOPE`.** The "60+ Provisional
  Patents" line in `governance/CONSTITUTION.md` + `governance/legacy/MASTER_DIRECTIVES.md` is therefore
  **invisible to the scalar-guard** while `facts.yaml` = **51**. The very file that is meant to be the
  canonical reconciliation carries the exact patent-count drift the guard exists to catch.

### tooling/heady-derive (`@heady/derive`)
- **Category:** Single-source injection engine · **Status:** new (06-17), live · **Confidence:** medium-high
- **What:** keeps `<!--heady:inject KEY-->` managed regions across all files consistent with the golden
  record (`facts.yaml` / `lexicon.yaml`). `canon.mjs` builds the flat dot-key map from the single sources
  of truth via `@heady/config` (never hardcodes); `derive.mjs check|write`.
- **Legacy:** none (rebuild-native; operationalizes "derive everything from one source").
- **Rebuild:** `AGENTS.md` already uses it (`<!--heady:inject facts.company.patents_provisional-->51`).
- **Parts:** `src/canon.mjs`, `src/derive.mjs`, `test/`. **OSS:** none. **Transfer:** N/A.
- **Incorporation steps:** convert the static "60+ patents" strings in `governance/*` into
  `heady:inject facts.company.patents_provisional` managed regions — this is the clean fix for D-1.
- **⚠ Drift:** governance docs do not yet use inject regions, so they drift freely.

### .claude/hooks/heady-rules.mjs (PreToolUse)
- **Category:** Agent-only rule hook · **Status:** live · **Confidence:** high
- **What:** PreToolUse gate on Edit/Write/MultiEdit/NotebookEdit; BLOCKS (exit 2) on no-console-log,
  esm-only, no-placeholders (TODO/FIXME/HACK), no-localhost in added text within authored source trees.
- **Legacy:** mirrors `.windsurfrules` into a mechanical agent gate.
- **Rebuild:** **binds only this Claude agent** — bypassed by humans, git, CI (which is why CI mirrors
  exist in `enforcers`/`law-lint`). **OSS:** none. **Transfer:** N/A.
- **Incorporation steps:** keep mirrored by CI gates (already done). **⚠ Drift:** agent-only scope.

### .claude/hooks/skeleton-guard-hook.mjs (+ tooling/skeleton-guard)
- **Category:** File-placement gate · **Status:** live (PreToolUse) · **Confidence:** high
- **What:** blocks writes to unrecognized scaffold locations; runs `verifyPlacement()` from
  `tooling/skeleton-guard/verify-placement.mjs` against `skeleton.json` (HALT=exit 2 / CAUTIOUS|EXECUTE=0).
- **Legacy:** none direct (rebuild anti-sprawl enforcement).
- **Rebuild:** agent-only binding (same caveat as heady-rules). **OSS:** none. **Transfer:** N/A.
- **Incorporation steps:** mirror into CI for non-agent writers. **⚠ Drift:** agent-only.

### governance/enforcement/law-enforcers.yaml (the binding map)
- **Category:** Law→enforcer→CI-job source of truth · **Status:** live · **Confidence:** high
- **What:** `schema: heady.governance.enforcers.v1`, `generated_from: governance/CONSTITUTION.md`. One
  row per Law (0–9) + `architecture_laws` (ALAW-1..4) + a `coverage` summary. Read by `tooling/coherence`
  & CI. "A law without a green/amber/red disposition here is NOT considered enforced."
- **⚠ Drift+decisions:** **D-3 — LAW-3/LAW-4 mismatch vs CONSTITUTION.md** (YAML's LAW-3 is named
  "Thoroughness" but carries a context-max statement bound to `autocontext.mjs`; CONSTITUTION's Law 3 is
  thoroughness/root-cause, process-only, and Law 4 is context-max). The `coverage.enforced=6` count
  depends on this relabel. Reconcile the names before treating the count as authoritative.

### governance/CONSTITUTION.md + PRIME_DIRECTIVE.md + directives/ (the charter)
- **Category:** Constitutional charter · **Status:** authored, reconciled (06-16) · **Confidence:** high
- **What:** CONSTITUTION = canonical reconciliation of 3 legacy law sets; PRIME_DIRECTIVE = boot identity
  (supersedes legacy `SYSTEM_PRIME_DIRECTIVE.md`, corrects the stale "12-stage/all-MiniLM" to 21-stage /
  bge-384); `directives/01–10` = the 10 Master Directives.
- **Legacy:** frozen originals under `governance/legacy/` (UNBREAKABLE_LAWS, MASTER_DIRECTIVES,
  BUDDY_KERNEL, SYSTEM_PRIME_DIRECTIVE, LAW-09-ASAP-EXECUTION, RECONCILIATION_DECISIONS).
- **⚠ Drift+decisions:** **D-2 — CONSTITUTION.md footer still says "60+ Provisional Patents"** (= 51 per
  golden record); same in `MASTER_DIRECTIVES.md`. Combined with D-1 (governance outside scalar-guard
  scope), this drift is **unguarded**.

---

## Flags — laws/decisions present in legacy/spec but NOT yet enforced in rebuild

- **D-1 (high):** `governance/` is outside `tooling/coherence` `CANON`/`SCALAR_SCOPE` → governance docs'
  scalars drift unchecked.
- **D-2 (high):** "60+ Provisional Patents" persists in `CONSTITUTION.md` + `MASTER_DIRECTIVES.md` vs
  canonical **51** — drift inside the reconciliation file itself.
- **D-3 (med):** LAW-3/LAW-4 name↔statement mismatch between `law-enforcers.yaml` and `CONSTITUTION.md`;
  inflates the `enforced=6` count.
- **D-4 (high):** **two ADR directories** (`docs/adr` vs `docs/ADR`) with divergent numbering; hard
  collision on **0019–0023** (different decisions per dir); `docs/ADR/INDEX.md` documents a file-less
  0001–0018 parallel set. Both README and INDEX claim authority — ✅ **resolved 2026-08-04**:
  `docs/ADR/0019–0025` renumbered to canonical `docs/adr/0033–0039`; INDEX = redirect stub.
- **D-4b (med):** `docs/ADR/0022` locks region **us-east1** vs golden-record **us-central1** —
  ✅ **resolved 2026-08-04**: facts.yaml corrected to `us-east1` (ADR-0036).
- **D-5 (med):** `heady-maximum-potential` skill carries an 8-item "System Building Directives" list that
  diverges from the canonical 10 Master Directives, and a 3-item code-mutation law set with no enforcer.
- **Honor-system laws (no fail-closed gate):** Law 5 (determinism), Law 6 (scale-guard), Law 7
  (auto-success), Law +9 (ASAP); ALAW-1 (Liquidity), ALAW-3 (Sovereignty beyond localhost); the entire
  legacy **behavioral constitution** (Vehicle B) and the **3 code-mutation laws** (Family 3).
- **Auto-invocation gap:** ARBITER / eval-gate / security-bee are never auto-fired by hook or CI;
  CODEOWNERS routes human review only and needs branch-protection to block merges.

---

*∞ Sacred Geometry · Liquid Intelligence · Permanent Life ∞*
*© 2026 HeadySystems Inc. — Eric Haywood, Founder*
