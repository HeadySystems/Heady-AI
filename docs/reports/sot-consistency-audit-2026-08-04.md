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
<!-- ║  HEADY™ · sot-consistency-audit-2026-08-04.md                      ║
<!-- ║  SoT document audit: branch canon, legacy integrity, drift.       ║
<!-- ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END -->

# HEADY™ Source-of-Truth Consistency Audit
**Date:** 2026-08-04 · **Scope:** `HeadySystems/heady-ai` @ `rebuild` (`0d6fbaa`) · **Type:** SoT document verification

---

## 1. Branch Canon Verification — ✅ PASS

| Claim (SOURCE_OF_TRUTH.md) | Observed | Verdict |
|---|---|---|
| `rebuild` is the default branch | `origin/HEAD` → `refs/heads/rebuild` | ✅ holds |
| `legacy/main-archive` frozen at `3a54aeee` | `refs/heads/legacy/main-archive` = `3a54aeee8932…` | ✅ exact match |
| Archive tag `archive/main-2026-06-17` | `refs/tags/archive/main-2026-06-17` = `3a54aeee` | ✅ present |
| `main` retained as legacy pointer | `main` = `0d6fbaa` (tracks `rebuild` tip) | ✅ present, non-divergent |

Legacy lineage fully intact on the remote — five preserved branches:
`legacy/main-archive`, `legacy/main-pre-rebuild` (both `3a54aeee`),
`legacy/parallel-lineage-jul17`, `legacy/rebuild-lineage-jul15`,
`legacy/sacred-geometry-orphan-2026-06`.

## 2. Automated Gates — ✅ PASS

| Gate | Command | Result |
|---|---|---|
| Golden record schema | `pnpm facts:validate` | ✅ `facts.yaml conforms to facts.v1, rules: all-passed` |
| Coherence gate | `pnpm consistency:verify` | ✅ 0 contradictions · 12 `info`-tier incompletes (all pre-tracked debt: 3 STAGE0-pending, 2 LAW-advisory, 2 resolved LAW-defects, 4 TEST-missing-app, 1 FED-clean) |

## 3. Findings — data inconsistencies (remediated 2026-08-04 unless noted)

### F1 · ADR number collision: `docs/ADR/` vs `docs/adr/` (HIGH)
Seven ADR numbers (0019–0025) resolve to **two different Accepted decisions** depending on directory case:

| # | `docs/adr/` (canonical set, 0000–0032) | `docs/ADR/` (UPPERCASE set) |
|---|---|---|
| 0019 | frontend-framework-selection | nine-domain-brand-architecture |
| 0020 | inter-agent-event-bus | drupal-11-headless-cms |
| 0021 | agent-execution-sandbox | post-quantum-cryptography-mandate |
| 0022 | real-time-state-sync | gcp-region-canonical-lock |
| 0023 | vector-projection-trigger | heady-manager-decomposition |
| 0024 | embedding-pipeline-instantaneous-acquisition | domain-registry-canonical-file |
| 0025 | strict-global-consistency-and-non-orphanage-governance | content-gateway-cloudflare-worker |

Any prose citing "ADR-0019"…"ADR-0025" was ambiguous. Already flagged in
`docs/master-plan/08-uis-projections.md` ("rename one to avoid ambiguity") but unresolved.
**✅ Resolved (founder-approved):** the UPPERCASE set is renumbered into the canonical slots
**`docs/adr/0033–0039`** with `Renumbered:` provenance headers and rewritten cross-references;
`docs/ADR/INDEX.md` is now a redirect stub with the old→new map. References in living code and
docs (`src/middleware/*`, `src/security/pqc.js`, `src/config/domain-registry.js`,
`scripts/pqc-*`, `docs/PQC-COMPLIANCE-BRIEF.md`, master-plan) retargeted; Stage-0-locked files
needed no change (they cite only the lowercase set); historical handoffs/dated reports left
untouched.

### F2 · GCP region contradiction (HIGH)
`docs/ADR/0022-gcp-region-canonical-lock.md` (Accepted) locks the region to **`us-east1`**
("LOCKED — never us-central1"), while the golden record `facts.yaml`
(`deploy_targets.origin.region: us-central1`) and the `AGENTS.md` deploy block
(`--region us-central1`) both say **`us-central1`**. Noted as "D-ADR-region" drift in
`docs/master-plan/05-laws-directives.md`, unreconciled — and the master-plan's deeper census
(D1/AD-4) rules that the **live Cloud Run service (project `heady-ai`) runs in `us-east1`**,
making `facts.yaml` the stale side; the `us-central1` endpoints in `src/` belong to the
deprecated legacy project `609590223909`.
**✅ Resolved (founder-approved, per master-plan AD-4):** `facts.yaml
deploy_targets.origin.region` corrected to **`us-east1`** (ADR-0036, ex `ADR/0022`); the
`AGENTS.md` deploy block is annotated as legacy-manager-only; master-plan D1/AD-4 marked
resolved. Legacy runtime URLs in `src/` are untouched (they intentionally reference the
read-only legacy service).

### F3 · `docs/ADR/INDEX.md` lists 18 file-less ADRs (MEDIUM)
The UPPERCASE index claims "25 ADRs documented. All reserved slots filled," but entries
0001–0018 have **no files** in `docs/ADR/` and their titles do not match `docs/adr/0001–0018`.
A parallel, file-less ADR universe. **✅ Resolved with F1:** the INDEX is now a redirect stub;
its file-less 0001–0018 entries are noted as historical, with `docs/adr/README.md`
authoritative.

### F4 · `docs/master-plan/05-laws-directives.md` file-count drift (LOW)
States `docs/ADR/` holds "only files 0019–0023"; on disk the set is **0019–0025** plus
`INDEX.md`. The master-plan census was stale by two files. **✅ Resolved:** census sections
carry post-census resolution banners (the snapshot itself is preserved).

### F5 · `PARITY_LOG.md` placeholder in a "done" row (LOW)
Row "Governance gate | #207 | rebuild | **#NNN** | ✅ done" carries a `#NNN` placeholder as
the Port PR. Violates the no-placeholder rule. **✅ Resolved:** GitHub history shows PR #207
merged **directly into `rebuild`** — no separate port PR ever existed; the row now says so
explicitly.

### F6 · Dual-active docs vs. current branch state (LOW / informational)
`docs/BRANCH-PARITY.md` and `docs/DUAL_ACTIVE_BRANCH_STRATEGY.md` describe a divergent
`main` (npm, PM2, 69 lockfiles, `_archive/`). Today `main` = `rebuild` tip (`0d6fbaa`); the
described lineage lives only at `legacy/main-archive`. SOURCE_OF_TRUTH.md already calls
`main` a "legacy pointer (will be retired)". **✅ Resolved:** both docs now open with a
current-state banner deferring to `SOURCE_OF_TRUTH.md` for branch canon and pointing at
`legacy/main-archive` for the described divergence.

### F7 · Fixed in this audit
`SOURCE_OF_TRUTH.md` cited "`docs/adr/0000–0018`" while the canonical set had grown to
**0000–0032** (+ `superseded-v1/` quarantine) — and, after the F1 renumber, now spans
**0000–0039**. Corrected in this change.

## 4. Cross-repo note (out of monorepo scope)
`headyai/heady-production` `CLAUDE.md` describes a **22-stage** HCFullPipeline
(`configs/hcfullpipeline.yaml` v8.0.0, order 0–21) ending in `distiller`. At audit time the
canon here was **21 stages** (CHANNEL_ENTRY → RECEIPT), with the "22 (00–21)" form ruled an
off-by-one.

> ✅ **Superseded (2026-08-04, same day):** founder re-ruled the stage count to **22** —
> DISTILL is a first-class terminal stage (order 21) — via **ADR-0045**, which inverted this
> section's reconciliation direction: the monorepo's prose moved up to 22, and
> `heady-production`'s shipped 22-stage DAG is conformant as-is.

φ = 1.618033988749895 — Fibonacci-scaled per LAW-10
© 2026 HeadySystems Inc. — Eric Haywood, Founder
