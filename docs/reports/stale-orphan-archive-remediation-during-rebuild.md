# Stale, Orphaned & Archive-Bound Files and Repos — Remediation During the Rebuild

- **Status:** Research report — for founder review
- **Date:** 2026-07-22
- **Author:** Claude Code (grounded in live repo inspection of `/home/headyme/Heady-AI` on branch `feat/service-registry`)
- **Scope:** How to deal with dead/duplicate/oversized files, git-history bloat, and the multi-branch "repo" sprawl **while the port-and-verify rebuild is in flight** — without destroying anything the rebuild still needs to extract from.

---

## 1. Thesis (read this first)

**During a rebuild the old tree is not garbage — it is the extraction/reference source** (`docs/LEGACY_EXTRACTION_SYSTEM.md` literally consumes one disposition row at a time and ports it). So the correct default is **reversible quarantine, not deletion**, and the *only* irreversible act — git history rewrite — turns out to be **unnecessary on the clean trunk and inappropriate on the archived legacy branch.** Everything sequences under that.

Three facts, verified live, collapse most of the perceived risk:

1. **The clean line is already clean.** The 1 GB of `.git` bloat and the leaked-secret blobs are reachable from `main` **only** — **0 commits from `HEAD`**. You do not need `git filter-repo` on the trunk.
2. **`main` is not a divergent history to reconcile — it is a bot-flooded fossil with no shared ancestor.** `git merge-base main feat/service-registry` **exits non-zero — there is no common ancestor.** The active line's *entire* history is **85 commits**; `main` is a separate, ~8,568-commit lineage of which 3,399 unique commits are `HeadyAutoCommit` and whose tip is wall-to-wall `HCFP-AUTO:` auto-commits. The rebuild is a genuine greenfield/orphan history — which is exactly why "clean rebuild vs. legacy main" holds. Governance already ordered `main` archived as `legacy/main-archive` (`SOURCE_OF_TRUTH.md`, `ADR-0001`). This is a **decision to execute, not a merge to perform.**
3. **The machinery already exists — it is just not wired.** `ADR-0025` mandates an anti-orphan CI gate; `tooling/skeleton-guard/{audit-orphans,verify-placement,skeleton.json}` implements it; the disposition scheme (✅🔧⏸❌) and the 14-group extraction manifest exist. But the gate appears in **zero** `.github/workflows/` files. The primary recommendation is **activate what you built**, not build new.

The single genuinely urgent item is a **P0 secret hazard**, not housekeeping (see §2, row A2 and §5).

---

## 2. Ground truth — what is actually stale/orphaned/bloated

Every row below was measured, not inferred. Paths are relative to `/home/headyme/Heady-AI`.

### A. Working-tree pollution (this checkout; independent of branch)

| ID | What | Size / count | Git status | Reality |
|----|------|-------------|-----------|---------|
| **A1** | `core.[0-9]*` crash dumps in repo root | **21 GB, 22 files** (largest `core.1239569` = 5.9 GB) | `.gitignore`d (`core.[0-9]*`) — never committed | Pure disk hog. Dominates the 24 GB working tree. Slows every `find`/scan/backup/`audit-orphans` walk. Regenerable = worthless. **Delete-safe.** |
| **A2** | `.env.bak`, `.env.bak.predburl` | 2 files, plaintext | `.gitignore`d (`*.bak`) | **P0 SECRET HAZARD.** Plaintext credential backups on disk. Given SEC-001 (live keys committed then redacted at f26a490), treat as live-until-rotated. Not "archive" — **rotate + shred.** |
| **A3** | Runtime audit state: `data/` (24 MB — `auto-success-audit.json` 5.4 MB, `code-governance-audit.jsonl`), `.data/` (22 MB — awareness/build-plan/coherence/decomposition/handoff) | 46 MB | mixed | Regenerable runtime tier data, not source. Should be **externalized / gitignored**, not archived. |
| **A4** | `hc_pipeline.log`, `.turbo/` (6.4 MB), `tmp/`, `scratch/` | — | `.gitignore`d | Build/log ephemera. Delete-safe; cleaned by `scripts/eradication-protocol.js` (`--dry-run` capable). |

### B. Tracked orphan junk (in the clean trunk — these are real commits)

| ID | What | Count | Reality |
|----|------|-------|---------|
| **B1** | `.agents/personas/SKILL (1).md` … `SKILL (20).md` | **20 files** | Browser-download duplicates (`(N)` suffix) committed verbatim. Classic orphan cruft. Verify none are referenced, then drop. |
| **B2** | Root scratch/test files: `battle-synthesis-report.json`, `scratch_measure_drift.js`, `test-linear.js`, `test_pattern_gap.js` | **4 files, all TRACKED** | Loose at repo root — exactly what `verify-placement.mjs` HALTs on (`rootFiles` allow-list). One-off scratch that got committed. Move to `tests/` or drop. |

> **Heuristic caveat (important):** name-based scanning has false positives. A `*_v[0-9]`/`FINAL`/`_v2` sweep also flags `docs/REBUILD_PLAN_V2.md` and `.agents/context/HEADY_SUPER_PROMPT_v5.md` — both **canonical**. Orphan detection must be **reachability + provenance based** (is it imported / placed under a recognized tree / named in a disposition row?), which is precisely why `verify-placement.mjs` and `knip` exist. Never delete on filename alone.

### C. Git history bloat + leaked secrets — **legacy `main` only**

| Blob (in history) | Size | Reachable from `HEAD` | Reachable from |
|---|---|---|---|
| `infrastructure/infrastructure/db_data/ib_logfile0` (committed InnoDB data dir) | 96 MB | **0 commits** | `refs/heads/main` |
| `in/heady_bounded_security_pass.zip` (+ extracted copies) | ~60 MB ×4 | **0 commits** | not on active line |
| `hc_pipeline.log` (many versions, pre-gitignore) | 31 MB × **510 commits** | **0 commits** | not on active line |
| `.env` / `*.env.hybrid` secret files | — | — | **3 commits in history** |

`.git` = **1,009 MB**. All of it is legacy-main lineage. The audit report confirms: *"legacy `main` carries 777 Dependabot alerts driven by 69 orphaned lockfiles + archive sprawl; `rebuild` is clean."* **Implication: do not rewrite the trunk (nothing to fix); the bloat and leaked blobs are an attribute of the branch you are already going to fossilize.**

### D. Branch / "repo" topology (the real multi-line problem)

- One monorepo. **No `.gitmodules`, one worktree.** The "repos" question is really **branches + the org-consolidation plan**, not submodules.
- `main` — tip 2026-06-17, bot-flooded (author split of its unique commits: `HeadyAutoCommit` 3399, Eric 3215, `HeadyMe` 750, dependabot 493, `Your Name` 139 [misconfigured identity], `HeadyAutoSync[bot]` 10). **No common ancestor with the active line.** → governed destination: `legacy/main-archive`.
- `rebuild` — the **canonical engineering trunk** per `SOURCE_OF_TRUTH.md`; local copy is **behind origin/rebuild by 14**.
- `feat/service-registry` — **active** (checked out). Its **entire** history is only **85 commits**, disjoint from `main` (no common ancestor); ahead of origin by 1.
- `fix/ci-green-verify` (ahead 3), `feat/session-guard` — feature branches to land or prune.
- `HeadySystems_v13` (13k+ files), `_downloads`, `dropzone`, `_archive` are already marked **EXCLUDE — archival cruft, must not be reintroduced** in `docs/reports/gap-matrix.md`.

### E. Load-bearing, NOT debt (do not touch in cleanup)

- `docs/patents/` — **79 files, 29 MB** (PDF/`.docx`/zip). This is the crown-jewel IP (51 filed provisionals). It is the *bulk* of the 31 MB `docs/` tree but it is **not orphan and not bloat**. Relocation to LFS/artifact store is **ARBITER-gated** (`CLAUDE.md` §I.8) and **out of scope** for rebuild cleanup. Preserve in place.

---

## 3. What already exists — build on it, don't reinvent

| Asset | Path | State | Use in remediation |
|---|---|---|---|
| **Non-orphanage mandate** | `docs/adr/0025-strict-global-consistency-and-non-orphanage-governance.md` (Accepted) | Policy exists; **NOT in CI** | The spec for the guardrail. Defines orphan on 3 axes: unplaced *file*, unused *export*, disconnected *data artifact*. |
| **Orphan auditor** | `tooling/skeleton-guard/audit-orphans.mjs` + `verify-placement.mjs` + `skeleton.json` | Built, runs as `pnpm --filter @heady/skeleton-guard audit`; **absent from all `.github/workflows/`** | Reachability/placement gate. Exits non-zero on HALT → CI-ready. **Wire it (§7).** |
| **Disposition scheme** | `docs/LEGACY_STACK_COMPONENT_DISPOSITION.md` (for founder approval) | 372→~100 components triaged | The 4-way vocabulary: ✅ Integrate · 🔧 Adapt · ⏸ Defer · ❌ Drop. Reuse verbatim. |
| **Extraction engine** | `docs/LEGACY_EXTRACTION_SYSTEM.md` | Draft | Consumes one disposition row → conformant package + characterization tests + ledger record. **This is why "archive-not-delete" matters.** |
| **Transfer manifest** | `tooling/decomposition/manifest.json` + `docs/master-plan/09-legacy-transfer.md` | 14 groups / 150 components | **G99 = "Dropped — Provenance Manifest Only," 41 components → `_archive/provenance` (tarball ref).** Has `global_excludes` (core dumps, logs, `_archive/*`) + fail-closed `blocked_secret_paths`. |
| **Pruner** | `scripts/eradication-protocol.js` ("The Pruner", `--dry-run`) | Built | Wipes ephemeral workspace, prunes stale pgvector/edge cache. Use for A1/A3/A4. |
| **Frozen provenance** | `governance/legacy/` (7 files, read-only) | Populated | The pattern to copy for `_archive/provenance`: freeze verbatim, authority lives elsewhere. |
| **Anti-sprawl law** | `docs/REBUILD_PLAN_V2.md` §11 | Canonical | *"One org, one monorepo… CI rejects new top-level directories without an ADR. **Archive-not-delete (preserves redirects).**"* + a "Do not create" list. |
| **Repo authority** | `SOURCE_OF_TRUTH.md`, `docs/adr/0001-canonical-repository-authority.md` | Approved | Trunk = `rebuild`; collapse 4 orgs → 1; **archive legacy repos after cutover**; fold satellites into monorepo. |

**Gaps to close:** (1) the ADR-0025 gate is not in CI; (2) `_archive/provenance/` is named everywhere but **does not exist yet** (`_archive/` holds a single file); (3) `main` is not yet fossilized; (4) `docs/MAIN_TO_REBUILD_MIGRATION_PLAN.md` and `docs/SUPPLY_CHAIN_TRIAGE_REPORT.md` are referenced by the audit but **absent**.

---

## 4. The recommended method

Five principles, then the concrete disposition of §2's findings.

**P1 — Classify by reachability + provenance, never by filename.** A candidate is an orphan iff: it is not placed under a `skeleton.json`-recognized tree (`verify-placement` HALT), **or** it is an unused export (`knip`), **or** it is a data artifact with no publisher+consumer (ADR-0025 axis 3). Filename is a hint, not a verdict.

**P2 — Stay high on the reversibility ladder while the rebuild is live.**

```
reversible ────────────────────────────────────────────► irreversible
 1. gitignore + delete    2. git mv → _archive    3. tag/branch     4. history
    working-tree file        (preserves history)      snapshot          rewrite
    (recoverable via git)                              (legacy/*)      (filter-repo)
```

During the rebuild, operate at **rungs 1–3**. Rung 4 is reserved for **after parity is proven** and, per §2C, **is not needed on the trunk at all**.

**P3 — Every candidate gets one of the four dispositions** (✅🔧⏸❌) recorded in a ledger row. Do not re-litigate a mark once set (the extraction engine depends on this).

**P4 — Archive-not-delete for anything the rebuild might extract.** If a legacy component is 🔧/⏸, it must remain reachable (in-tree `_archive/provenance` tarball or a `legacy/*` git ref) until its rebuild counterpart passes characterization tests. Only ❌ **Drop** items with proven zero extraction value get pruned.

**P5 — Secret hazards leave the cleanup track entirely.** `.env.bak*` and the history secret blobs are **rotate-first**, and for the fossilized branch, credential rotation — *not* history rewrite — is the complete fix (you don't rewrite an archive; you neutralize the secret).

### Disposition of the live findings

| Finding | Disposition | Ladder rung | Action | Gate / owner |
|---|---|---|---|---|
| A1 core dumps (21 GB) | ❌ Drop | 1 | Delete `core.[0-9]*` from working tree | **Destructive — founder confirm** (irreversible on disk, but zero value) |
| A2 `.env.bak*` | ❌ Drop + **rotate** | 1 | Rotate any live creds, then `shred`/secure-delete | **security-bee / SEC-001** |
| A3 `data/`,`.data/` | 🔧 Adapt | 1 | Confirm gitignored; move audit sinks to external store | data owner |
| A4 logs/`.turbo`/`tmp`/`scratch` | ❌ Drop | 1 | `scripts/eradication-protocol.js --dry-run` then run | ops |
| B1 `SKILL (N).md` ×20 | ❌ Drop | 2→1 | `knip`/grep confirm unreferenced → `git rm` | skeleton-guard |
| B2 4 root scratch files | 🔧 Adapt / ❌ Drop | 2 | `git mv` real tests → `tests/`; drop the rest | verify-placement |
| C main history bloat | ⏸ Defer | 3 | Fossilize on `legacy/main-archive`; **do not rewrite** | §5 |
| C leaked secret blobs | **rotate** | n/a | Rotate creds (audit says rotation is the only complete fix for the fossil) | security-bee |
| D stale branches | mixed | 3 | Land or tag-and-prune (§5) | release |
| E `docs/patents/` | ✅ Keep | — | Leave in place; LFS move is ARBITER-gated, out of scope | ARBITER |

---

## 5. Repos & branches — the "repo" answer

There is **no multi-repo problem inside this checkout** (one monorepo, no submodules). The sprawl is (a) **branches** and (b) the **documented-but-unexecuted 4-org→1 consolidation**. Recommended moves, all already sanctioned by governance:

1. **Fossilize `main` as `legacy/main-archive`** (`git branch legacy/main-archive main`, then retire `main` as the default). This *is* the plan in `SOURCE_OF_TRUTH.md`/`ADR-0001`. **Do not attempt to merge or reconcile it** — there is no common ancestor; it is bot-noise + leaked blobs.
2. **Rotate the credentials** that ever touched `main` history (the `.env.hybrid`/`.env` blobs). The fossil intentionally preserves history for traceability, so rotation — not rewrite — closes the exposure.
3. **Reclaim the 1 GB locally without any rewrite.** The bloat is held only by `refs/heads/main` here (there is no local `origin/main` remote-tracking ref) **plus reflogs and packed objects**. So: drop `refs/heads/main`, then `git reflog expire --expire=now --all`, then `git gc --prune=now`. Note the blobs still live on the remote `origin` until `main` is repointed/removed there, and any other clone that has fetched `main` will keep them until it does the same.
4. **Make `rebuild` the trunk in fact:** it is canonical per SOURCE_OF_TRUTH but the local copy is **behind origin by 14** — sync it. Decide the path for `feat/service-registry` (85-commit orphan history, ahead of origin by 1): land it onto `rebuild`, don't let it become a third long-lived line.
5. **Prune feature branches** after landing: `fix/ci-green-verify` (ahead 3), `feat/session-guard`. Tag anything worth keeping as `archive/<name>-2026-07` before deleting the ref.
6. **Execute the org 4→1 collapse and satellite fold-in** (ADR-0001) as its own tracked workstream; archive satellite repos after their content is folded, keeping a projection manifest only for survivors.

---

## 6. Sequenced plan (gated, mapped to REBUILD phases)

**Phase 0 — Containment (P0, do now):**
- Rotate `.env.bak*` creds + any `main`-history secrets; secure-delete the `.bak` files. *(security-bee)*
- Delete the 21 GB core dumps after founder confirm. *(reclaims ~87% of the working tree)*
- Fossilize `main` → `legacy/main-archive`; sync local `rebuild` (−14); drop `refs/heads/main` + `reflog expire` + `gc --prune=now` to reclaim the 1 GB.

**Phase 1 — Activate the guardrail (P0):**
- Wire `audit-orphans` + `verify-placement` + `knip` + `dependency-cruiser` into `ci.yml` / `heady-consolidated-ci.yml` and pre-commit, per ADR-0025. Fail-closed. This alone stops B1/B2-class orphans from recurring.

**Phase 2 — Quarantine sweep (P1):**
- Run `audit-orphans --json` for the authoritative orphan list; `git rm` confirmed-dead (SKILL dupes), `git mv` misplaced-but-real into recognized trees.
- Create `_archive/provenance/` and populate G99 (41 dropped components) as frozen tarballs + a manifest row each — the pattern `governance/legacy/` already models.

**Phase 3 — Continuous (P1/P2):**
- Let `scripts/eradication-protocol.js` run pre-projection to keep ephemera at zero.
- Author the two absent docs the audit expects (`MAIN_TO_REBUILD_MIGRATION_PLAN.md`, `SUPPLY_CHAIN_TRIAGE_REPORT.md`) so the migration is fully specified.

**Rung 4 (history rewrite): not scheduled.** The trunk is clean; the fossil is handled by rotation. Only revisit if a future audit finds a secret blob *reachable from `rebuild`*.

---

## 7. Guardrails to prevent recurrence

- **Wire ADR-0025 into CI** (the one high-leverage fix): placement + dead-export + data-connectivity gates, build-blocking, on every run and pre-commit. Everything in §2B is what a running gate would have blocked at commit time.
- **Stop the bot-commit flooding.** `HeadyAutoCommit`/`HCFP-AUTO` produced thousands of `hc_pipeline.log`/`resource-events.jsonl` churn commits on `main`. Point auto-committers at gitignored runtime paths only, or an out-of-tree state store; fix the `Your Name` (139-commit) git identity. **(This is not academic: an autonomous writer wiped an uncommitted copy of this very report mid-authoring — untracked deliverables are not durable here; see `session-guard`.)**
- **`.gitignore` is already good** (`core.[0-9]*`, `*.bak`, `*.log`, `/tmp/`, `*.tmp` all present) — keep it; the failures were *pre-existing* tracked files, not ignore gaps.
- **Enforce anti-sprawl** (REBUILD_PLAN_V2 §11): CI rejects new top-level dirs without an ADR; no new `lib/`/`utils/`/`helpers/`/`common/`.
- **Archive-not-delete** stays the default for all legacy-derived content until its rebuild counterpart passes characterization tests.

---

## 8. Explicit "do NOT" list

- ❌ Do **not** run `git filter-repo`/BFG on the trunk — it is clean (bloat is 0 commits from `HEAD`).
- ❌ Do **not** bulk-delete `docs/patents/**` or any `⚠️ PATENT LOCK` file — ARBITER-gated.
- ❌ Do **not** delete legacy components before their extraction/parity is proven — they are the rebuild's source material.
- ❌ Do **not** try to merge/reconcile `main` into the active line — no common ancestor; archive it.
- ❌ Do **not** treat `.env.bak*` as "archive later" — it is a live-until-rotated secret.
- ❌ Do **not** execute the destructive steps in §6 Phase 0 (core-dump delete, ref drop, `gc --prune`) without founder confirmation, per org policy on irreversible actions.

---

### Appendix — verification commands used

```
du -ch core.*                                   # 21G / 22 files
git check-ignore core.* .env.bak                # confirmed ignored
git ls-files | grep 'SKILL ([0-9]'              # 20 tracked dupes
git rev-list --count feat/service-registry      # 85  (entire active history)
git merge-base main feat/service-registry; echo $?   # exit=1 → NO common ancestor
git log --format='%an' feat/service-registry..main | sort | uniq -c   # HeadyAutoCommit 3399
git log --oneline HEAD -- infrastructure/infrastructure/db_data/ib_logfile0   # 0 → not on trunk
git rev-list --objects --all | git cat-file --batch-check ... | sort -rn      # 1GB .git, blobs on main only
grep -rniE 'orphan|skeleton-guard|0025' .github/workflows/                    # EMPTY → gate not wired
```
