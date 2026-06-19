<!-- HEADY_BRAND:BEGIN -->
<!-- FILE: docs/DEVELOPMENT_FLOW.md · LAYER: governance · canonical dev-flow contract -->
<!-- HEADY_BRAND:END -->

# Heady Development Flow — Canonical Contract

> **Status:** AUTHORITATIVE. This document is the single source of truth for how
> development flows across Heady repositories. It **supersedes** the conflicting
> guidance in `docs/REPO_ROLES.md` and `docs/REPO_LANDSCAPE.md`, which are retained
> for history only and carry superseded banners.
>
> Every human and every AI agent (Claude Code, Heady Conductor, Supervisor agents,
> and any orchestrated subagent) MUST follow this flow. It is referenced from both
> `CLAUDE.md` and `HEADY.md` so it is discoverable from the canonical entry points.

---

## 1. Source of Truth

**`HeadySystems/heady-ai` is the canonical source of truth for the Heady platform.**

All production code, configuration, pipeline definitions, governance policies, and
documentation originate here. Changes made in any other repo or clone must be
reconciled back to `heady-ai/main`. When two documents disagree about topology or
process, **this document and `heady-ai` win.**

---

## 2. Repository Roles

| Repo | Tier | Role |
|------|------|------|
| `HeadySystems/heady-ai` | **source-of-truth** | Canonical platform. Features, fixes, releases are cut from here. Branch protection on `main`. |
| `HeadySystems/Heady-Staging` | **staging** | Integration/pre-production validation. Receives promotions from `heady-ai/main`; soak + CI before production. |
| `HeadySystems/Heady-Main` | **production mirror** | Production-tracking mirror of the platform. Receives promotions from staging only. |
| `HeadySystems/HeadyEcosystem` | **ecosystem** | Cross-cutting ecosystem orchestration and shared platform glue. |
| `HeadySystems/HeadyAutoContext` | **middleware** | AutoContext universal intelligence middleware; consumes `heady-ai` as upstream. |
| `HeadyAI/headyai` | **product surface** | Public static site (Intelligence Routing Hub). Consumes platform APIs; not a code fork. |
| `HeadyAI/headydocs` | **docs surface** | Published documentation site. Mirrors canonical docs from `heady-ai`. |
| `HeadyAI/Heady-Main`, `HeadyAI/Heady-Main-ddb9351d` | **mirror/review** | Mirrors / rebuild clones. Reconcile to `heady-ai/main`; archive when superseded. |

> Anything not listed here is treated as **review/archive/supersede** until explicitly
> promoted into this table.

---

## 3. Branching Model

Branch off the **source-of-truth `main`** (`heady-ai/main`) unless a task explicitly
scopes you to another repo.

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New capability | `feature/mcp-tool-router` |
| `fix/` | Bug fix | `fix/jwt-refresh-race` |
| `chore/` | Maintenance | `chore/dep-upgrades` |
| `docs/` | Documentation only | `docs/development-flow` |
| `release/` | Release prep | `release/5.1.0` |
| `hotfix/` | Emergency production fix | `hotfix/auth-bypass-cve` |
| `spike/` | Experiment (sandbox-bound, may be thrown away) | `spike/csl-gates-v2` |
| `claude/` | Autonomous agent work branch | `claude/artifact-creation-criteria-b8kmsf` |

- **Never commit directly to `main`** on any tier. Always branch → PR → review → merge.
- **Never push to a branch other than the one a task assigns** without explicit approval.

---

## 4. PR & Merge Flow

```
feature/fix/claude branch  →  PR to source-of-truth main (heady-ai)
        │                          │
        │                          ├─ CI must pass (lint, security scan, tests, module load)
        │                          ├─ 1 approving review (owner: eric@headyconnection.org)
        │                          └─ merge (squash for feature/fix, merge-commit for release)
        ▼
   promote to Heady-Staging  →  soak + integration CI
        ▼
   promote to Heady-Main (production)  →  deploy (Cloud Run / Cloudflare)
```

- PRs are opened **ready for review** (not draft) unless explicitly told otherwise.
- Commit messages follow **Conventional Commits** (`feat:`, `fix:`, `docs:`, `chore:`).
- A change is not "done" until it is merged to `heady-ai/main` and promoted per the
  Checkpoint Protocol (registry + docs + notebooks synced).

---

## 5. Promotion / Sync Between Repos

Promotion is **one-directional down the tiers** and reconciliation is **upward to
source of truth**:

```
source-of-truth (heady-ai/main)
        │  promote ▼                 ▲ reconcile (PR back)
   staging (Heady-Staging)           │
        │  promote ▼
   production (Heady-Main)
```

- Product/docs surfaces (`headyai`, `headydocs`) pull from `heady-ai/main` on release.
- Experiments live in `spike/` branches; successful spikes are PR'd back to
  `heady-ai/main`. Spike branches with no PR in 90 days are archived.
- Cross-repo fixes must land in `heady-ai` first, then propagate downstream — never
  the reverse.

---

## 6. Agent Obligations

Any AI agent operating in the ecosystem MUST, before making changes:

1. Identify which repo and tier it is in (`git remote -v`).
2. Branch per §3 off the correct base; respect any task-assigned branch.
3. Honor the **Stop Rule** and **ORS** thresholds (in `CLAUDE.md` / `HEADY.md`).
4. Open a ready-for-review PR to the correct base after pushing.
5. Apply the **Artifact Creation Criteria** — materialize durable deliverables as
   committed files, not inline chat.
6. Run the **Checkpoint Protocol** follow-through (sync registry, docs, notebooks).

This flow is part of the checkpoint state: if it drifts from reality, that is a
**defect** under the Standing Rule and must be corrected here first.
