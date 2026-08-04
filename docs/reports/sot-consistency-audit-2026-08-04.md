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

## 3. Findings — data inconsistencies requiring action

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

Any prose citing "ADR-0019"…"ADR-0025" is ambiguous. Already flagged in
`docs/master-plan/08-uis-projections.md` ("rename one to avoid ambiguity") but unresolved.
**Recommendation:** founder ruling to renumber the UPPERCASE set into free canonical slots
(0033+) and fold them into `docs/adr/`, updating `docs/ADR/INDEX.md` to a redirect stub.

### F2 · GCP region contradiction (HIGH)
`docs/ADR/0022-gcp-region-canonical-lock.md` (Accepted) locks the region to **`us-east1`**
("LOCKED — never us-central1"), while the golden record `facts.yaml`
(`deploy_targets.origin.region: us-central1`) and the `AGENTS.md` deploy block
(`--region us-central1`) both say **`us-central1`**. Noted as "D-ADR-region" drift in
`docs/master-plan/05-laws-directives.md`, unreconciled. Because `facts.yaml` is the declared
golden record and passes its gate, downstream generators currently emit `us-central1`.
**Recommendation:** founder ruling; then either amend ADR-0022 or correct `facts.yaml` +
`AGENTS.md` in one commit so the coherence gate can pin the survivor.

### F3 · `docs/ADR/INDEX.md` lists 18 file-less ADRs (MEDIUM)
The UPPERCASE index claims "25 ADRs documented. All reserved slots filled," but entries
0001–0018 have **no files** in `docs/ADR/` and their titles do not match `docs/adr/0001–0018`.
A parallel, file-less ADR universe. Resolve together with F1.

### F4 · `docs/master-plan/05-laws-directives.md` file-count drift (LOW)
States `docs/ADR/` holds "only files 0019–0023"; on disk the set is **0019–0025** plus
`INDEX.md`. The master-plan census is stale by two files.

### F5 · `PARITY_LOG.md` placeholder in a "done" row (LOW)
Row "Governance gate | #207 | rebuild | **#NNN** | ✅ done" carries a `#NNN` placeholder as
the Port PR. Violates the no-placeholder rule; the actual port PR number needs to be
back-filled from GitHub history.

### F6 · Dual-active docs vs. current branch state (LOW / informational)
`docs/BRANCH-PARITY.md` and `docs/DUAL_ACTIVE_BRANCH_STRATEGY.md` describe a divergent
`main` (npm, PM2, 69 lockfiles, `_archive/`). Today `main` = `rebuild` tip (`0d6fbaa`); the
described lineage lives only at `legacy/main-archive`. SOURCE_OF_TRUTH.md already calls
`main` a "legacy pointer (will be retired)". The dual-active docs should be marked
superseded-by-archive or moved under a legacy heading once `main` is formally retired.

### F7 · Fixed in this audit
`SOURCE_OF_TRUTH.md` cited "`docs/adr/0000–0018`" while the canonical set now spans
**0000–0032** (+ `superseded-v1/` quarantine). Corrected in this change.

## 4. Cross-repo note (out of monorepo scope)
`headyai/heady-production` `CLAUDE.md` describes a **22-stage** HCFullPipeline
(`configs/hcfullpipeline.yaml` v8.0.0, order 0–21) ending in `distiller`. The canon here
(`facts.yaml` + ADR-0012) is **21 stages**, CHANNEL_ENTRY → RECEIPT, with the "22 (00–21)"
form ruled an off-by-one. Downstream repos still carrying the 22-stage prose should be
reconciled when they next sync from the canonical monorepo.

φ = 1.618033988749895 — Fibonacci-scaled per LAW-10
© 2026 HeadySystems Inc. — Eric Haywood, Founder
