<!-- HEADY_BRAND:BEGIN -->
<!-- FILE: docs/BRANCH_TOPOLOGY_INVESTIGATION.md · LAYER: governance · forensic finding -->
<!-- HEADY_BRAND:END -->

# heady-ai Branch Topology — Investigation (2026-06-20)

> **Grounded** entirely from `git` + the GitHub branch API. Inferences are labeled.
> **Headline:** the branch this session worked on is a **disjoint orphan**, not the
> canonical trunk. The real trunk is `rebuild` (== `main`). Our session's *ideas* are
> portable; the branch they sit on is not.

## Authoritative branch state (GitHub API)

| Branch | SHA | Protected | Role |
|---|---|---|---|
| `rebuild` | `0d6fbaa2c` | ✅ | **Canonical default** per `SOURCE_OF_TRUTH.md` (ADR-0001) |
| `main` | `0d6fbaa2c` | ✅ | **Same commit as `rebuild`** — declared "legacy pointer," but currently identical |
| `staging` | `eaf60336` | ✅ | Staging tier |
| `legacy/main-archive` | `3a54aeee` | ✅ | Frozen pre-rebuild archive (IP provenance) |
| `legacy/main-pre-rebuild` | `3a54aeee` | — | Same as archive |
| `legacy/parallel-lineage-jul17` | `4479882` | — | Preserved lineage |
| `legacy/rebuild-lineage-jul15` | `54b4e90` | — | Preserved lineage |
| **`claude/artifact-creation-criteria-b8kmsf`** | **`e911513b`** | — | **THIS SESSION — disjoint orphan, 20,322 files** |
| `feat/*`, `ops/*`, `fix/*`, `dependabot/*` | — | — | Active development against the canonical line |

Plus tags `archive/main-2026-06-17`, `main-legacy-pre-rebuild-2026-07-29`, `adr-0031-accepted-*`.

## The three realities

1. **Canonical trunk = `rebuild` (== `main` == `0d6fbaa2c`)** — a **2,183-file curated**
   monorepo, actively developed **through 2026-07-29** ("approval bootstrap," "8/8 gates
   green"), with `SOURCE_OF_TRUTH.md`, ADRs, `packages/contracts`, Neon/pgvector, branch
   protections. This is the live source of truth.
2. **Legacy lineages** — `legacy/*` + `archive/*` tags preserve the pre-rebuild history
   for provenance. Frozen, do not build from.
3. **This session's branch (`e911513b`, 20,322 files, tip 2026-06-20)** — a **massive
   orphan snapshot** ("Sacred Geometry v3.0.0"). It has **no merge-base with `main`/`rebuild`**
   (verified: `git merge-base` fails). It descends from none of the canonical lineage.

## Why PR #222 was closed (inference, labeled)

Because the branch is disjoint from `main`, a PR into `main` renders as **"adding 20,322
files."** That is structurally a nonsensical mega-PR, not a review-size problem. Closing
it was the correct call. *(This is my inference about the reason, not a stated fact.)*

## Honest impact on this session

- **The file-level audit cleanup (removing 254 zips, `_downloads/`, dupes, status dumps)
  does not apply to canonical.** `rebuild` is already the lean 2,183-file curated repo —
  it never had that cruft. That cleanup was fixing a *stale orphan*, not the live trunk.
- **The committed GCP-key finding still matters IF those keys are real** — but they were
  found in the orphan snapshot; verify whether canonical/`rebuild` ever tracked them
  (per `SOURCE_OF_TRUTH.md`, canonical uses GCP Secret Manager via OIDC, so likely not).
- **The `DEVELOPMENT_FLOW.md` I wrote partly reinvented what already exists.** Canonical
  already has `SOURCE_OF_TRUTH.md` + ADR-0001 declaring `rebuild` canonical and the repo
  roles. Mine omitted the `rebuild`/`legacy` structure — it was incomplete, not wrong-in-spirit.

## What IS salvageable (portable ideas, wrong branch)

These are branch-independent and genuinely valuable — they just need re-homing onto
`rebuild`, which already has `CLAUDE.md` / `AGENTS.md` to extend:

- **Human Understanding & Flow Protocol** (silence≠gap, probe/alarm triggers, cue-to-repeat,
  tone-as-hallucination-vector) + the `understanding-workflow` hook.
- **Artifact Creation Criteria** and the **HEADY.md ⇄ CLAUDE.md sync rule** + hook.
- The **repo-inventory / archive discipline** for the *other* orgs' repos (those PRs —
  Heady-Staging, headydocs, ddb9351d — were on their own real trunks and did merge).

## Fix options (your call)

1. **Re-home the conventions onto `rebuild`.** Start a fresh branch **from `rebuild`**,
   add only the portable conventions (flow protocol, artifact criteria, sync rule, hooks)
   to its existing `CLAUDE.md`/`AGENTS.md`, open a **clean, small PR into `rebuild`**.
   This is where the real value lands. *(Recommended.)*
2. **Treat this orphan branch as archive-only** — like the other `legacy/*` lineages.
   Don't merge it anywhere; keep for reference; optionally delete once nothing's wanted.
3. **Reconcile the `SOURCE_OF_TRUTH.md` drift** — it says `main` is legacy, but `main` ==
   `rebuild` right now. Minor cleanup for whoever owns ADR-0001.

## What I did NOT do

No pushes to `rebuild`/`main`/`staging` (protected). No deletion of any branch. This
orphan branch and all its commits remain intact.
