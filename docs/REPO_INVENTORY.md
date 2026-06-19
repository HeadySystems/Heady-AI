<!-- HEADY_BRAND:BEGIN -->
<!-- FILE: docs/REPO_INVENTORY.md · LAYER: governance · repo functionality assessment -->
<!-- HEADY_BRAND:END -->

# Heady Repo Inventory & Functionality Assessment

> Companion to `docs/DEVELOPMENT_FLOW.md`. Evidence-based status for every repo in
> scope, with a keep / verify / archive recommendation. Activity reflects the latest
> assessment (2026-06-19). "Archive" = make read-only; reversible on GitHub.

## Status table

| Repo | Tier | Files | Last activity | Status | Recommendation |
|------|------|------:|---------------|--------|----------------|
| `HeadySystems/heady-ai` | source-of-truth | 20,869 | 2026-06-19 | **Active** | **Keep** — canonical platform |
| `HeadySystems/Heady-Staging` | staging | 20,235 | 2026-06-19 | **Active** | **Keep** — integration/pre-prod |
| `HeadySystems/HeadyAutoContext` | middleware | 1,570 | 2026-06-07 | **Active** | **Keep** — AutoContext middleware, distinct component |
| `HeadyAI/headyai` | product surface | 10 | 2026-06-19 | **Active** | **Keep** — public Intelligence Routing Hub site |
| `HeadySystems/HeadyEcosystem` | ecosystem | 52 | 2026-03-21 | **Nascent** | **Keep** — real monorepo scaffold (API + web apps + Prisma + Drupal sync); distinct product, not a mirror |
| `HeadySystems/Heady-Main` | production mirror | 399 | 2026-03-29 | **Low activity** | **Keep, verify role** — confirm it backs a live deployment before any change |
| `HeadyAI/Heady-Main-ddb9351d` | mirror/duplicate | 15,820 | 2026-04-05 | **Redundant** | **Archive candidate** — hash-suffixed full duplicate of the platform; verify it is not wired to a separate live deploy first |
| `HeadyAI/headydocs` | docs surface | 1 (README only) | 2026-06-06 | **Empty shell** | **Archive or populate** — README claims a docs hub but contains no docs |

## Notes

- **Heady-Main duplication smell.** There are multiple `Heady-Main` variants across orgs
  (`HeadySystems/Heady-Main`, `HeadyAI/Heady-Main`, `HeadyAI/Heady-Main-ddb9351d`). Only
  one production mirror should exist downstream of staging per `DEVELOPMENT_FLOW.md`.
  Consolidate to a single production target; archive the rest once confirmed redundant.
- **headydocs vs. in-repo docs.** Canonical docs live in `heady-ai/docs/`. `headydocs`
  is either a future published mirror (then it must be populated from `heady-ai/docs`)
  or redundant (then archive). It cannot stay an empty shell claiming source-of-truth.

## Archive procedure (requires human action)

Archiving is **not** available through the current automation toolset (no
repo-update/archive API is exposed). To archive a repo:

1. Confirm it backs no live deployment (check Cloud Run / Cloudflare / Render targets).
2. Reconcile any unique commits back to `heady-ai/main` per the promotion flow.
3. GitHub → repo **Settings → Danger Zone → Archive this repository** (reversible).

Agents may apply a **soft-archive banner** (README notice + `ARCHIVED.md`) on request
to signal intent before the GitHub switch is flipped.

### Archived-repo agent stop-notice (standard)

Every soft-archived repo MUST carry an **agent-facing stop-notice** at the top of the
files agents boot from — `CLAUDE.md` and `AGENTS.md` (create them if absent) — stating:

> ⛔ ARCHIVED. The only legitimate reason to be here is to retrieve archived/historical
> information. Do not develop, build, deploy, or commit. Source of truth:
> `HeadySystems/heady-ai`. If your task is to create or change anything, you are in the
> wrong repo — stop and switch.

This guarantees an agent that lands in an archived repo is told to leave before it acts.
