# HEADY_BRAND

# Repository Status Registry

> Canonical status labels for all repositories across the Heady ecosystem.
> Last updated: 2026-03-18

---

## Status Tier Definitions

| Status | Badge | Meaning |
|--------|-------|---------|
| **CANONICAL** | `[CANONICAL]` | Source of truth. Actively developed and maintained. All contributions target this repo. |
| **MIRROR** | `[MIRROR]` | Synced copy of a canonical repo. Read-only. Do not open PRs here; changes flow from canonical automatically. |
| **STAGING** | `[STAGING]` | Pre-production testing environment. Used for integration validation before promotion to canonical/production. |
| **EXPERIMENTAL** | `[EXPERIMENTAL]` | Research or prototype work. Not production-ready. May be promoted or abandoned without notice. |
| **ARCHIVED** | `[ARCHIVED]` | No longer maintained. Preserved for historical reference only. Do not depend on or deploy from archived repos. |

---

## Promotion Pipeline

```
EXPERIMENTAL ──> STAGING ──> CANONICAL ──> MIRROR (production)
     │               │            │
     │               │            └─ Stable, reviewed, released
     │               └─ Integration tested, pre-release
     └─ Proof of concept, research spike

ARCHIVED ← (any status can be archived when deprecated)
```

**Flow summary:**

1. New ideas begin as **EXPERIMENTAL** repos or branches.
2. When ready for integration testing, they move to a **STAGING** environment.
3. After validation, code is merged into the **CANONICAL** source of truth.
4. Production deploy targets receive synced copies as **MIRROR** repos.
5. Repos that are sunset move to **ARCHIVED**.

---

## Repository Inventory by Organization

### HeadyAI (GitHub org: `HeadyAI`)

| Repository | Status | Notes |
|------------|--------|-------|
| HeadyAI/Heady | `[CANONICAL]` | Monorepo v4.1.0 — primary source of truth for the entire Heady platform |
| HeadyAI/Heady-Staging | `[STAGING]` | Pre-production staging for the monorepo |
| HeadyAI/.github | `[CANONICAL]` | Org-level config, profile, and shared workflows |

---

### HeadyMe (GitHub org: `HeadyMe`) — 78+ repos

#### Core Public Packages

| Repository | Status | Notes |
|------------|--------|-------|
| HeadyMe/headymcp-core | `[CANONICAL]` | Public MCP tools package |
| HeadyMe/headybuddy-core | `[CANONICAL]` | Public Buddy core package |
| HeadyMe/headyos-core | `[CANONICAL]` | Public OS core package |
| HeadyMe/headyconnection-core | `[CANONICAL]` | Public nonprofit core package |
| HeadyMe/headysystems | `[CANONICAL]` | Company website (headysystems.com) |

#### Templates

| Repository | Status | Notes |
|------------|--------|-------|
| HeadyMe/template-swarm-bee | `[CANONICAL]` | Swarm bee starter template |
| HeadyMe/template-mcp-server | `[CANONICAL]` | MCP server starter template |
| HeadyMe/template-heady-ui | `[CANONICAL]` | Heady UI component starter template |

#### Deployment and Mirrors

| Repository | Status | Notes |
|------------|--------|-------|
| HeadyMe/heady-production | `[MIRROR]` | Production deploy target — synced from canonical |
| HeadyMe/Heady-Main | `[MIRROR]` | Mirror of main branch for CI/CD pipelines |

#### Staging and Testing

| Repository | Status | Notes |
|------------|--------|-------|
| HeadyMe/Heady-Testing | `[STAGING]` | Integration and QA testing environment |
| HeadyMe/Heady-Staging | `[STAGING]` | Pre-production staging environment |

#### Experimental and Research

| Repository | Status | Notes |
|------------|--------|-------|
| HeadyMe/latent-core-dev | `[EXPERIMENTAL]` | Latent-space research and prototyping |

#### Other HeadyMe Repositories

| Repository | Status | Notes |
|------------|--------|-------|
| HeadyMe/headyapi-core | `[CANONICAL]` | API core package |
| HeadyMe/headybot-core | `[CANONICAL]` | Bot core package |
| HeadyMe/headyio-core | `[CANONICAL]` | IO core package |
| HeadyMe/headyme-core | `[CANONICAL]` | HeadyMe core package |
| HeadyMe/headyweb-core | `[CANONICAL]` | Web core package |
| HeadyMe/heady-skills | `[CANONICAL]` | Skill definitions and registry |
| HeadyMe/heady-bees | `[CANONICAL]` | Bee swarm agent definitions |
| HeadyMe/heady-prompts | `[CANONICAL]` | Prompt library |
| HeadyMe/heady-docs | `[CANONICAL]` | Documentation site source |
| HeadyMe/heady-cli | `[CANONICAL]` | CLI tooling |
| HeadyMe/heady-auth | `[CANONICAL]` | Authentication service |
| HeadyMe/heady-worker | `[CANONICAL]` | Cloudflare worker services |
| HeadyMe/heady-vector | `[CANONICAL]` | Vector store and embeddings |
| HeadyMe/heady-memory | `[CANONICAL]` | Memory subsystem |
| HeadyMe/heady-config | `[CANONICAL]` | Shared configuration |
| HeadyMe/heady-types | `[CANONICAL]` | Shared TypeScript types |
| HeadyMe/heady-sandbox | `[EXPERIMENTAL]` | General sandbox and experiments |
| HeadyMe/heady-playground | `[EXPERIMENTAL]` | Interactive playground for demos |
| HeadyMe/heady-research | `[EXPERIMENTAL]` | Research prototypes |
| HeadyMe/heady-lab | `[EXPERIMENTAL]` | Lab environment for spikes |
| HeadyMe/heady-archive-* | `[ARCHIVED]` | Legacy repos preserved for reference |

> **Note:** Repos not explicitly listed above that follow the `heady-*-core` naming pattern default to `[CANONICAL]`. Repos containing `sandbox`, `lab`, `playground`, `experiment`, `research`, `spike`, or `prototype` in the name default to `[EXPERIMENTAL]`. Repos with `archive` or `deprecated` in the name default to `[ARCHIVED]`.

---

### HeadySystems (GitHub org: `HeadySystems`)

| Repository | Status | Notes |
|------------|--------|-------|
| HeadySystems/HeadyEcosystem | `[CANONICAL]` | Ecosystem orchestration and configuration |
| HeadySystems/Heady-Main | `[MIRROR]` | Mirror of main branch |
| HeadySystems/Heady-Testing | `[STAGING]` | Integration testing environment |
| HeadySystems/Heady-Staging | `[STAGING]` | Pre-production staging environment |
| HeadySystems/sandbox | `[EXPERIMENTAL]` | Systems-level experimentation |

---

### HeadyConnection (GitHub org: `HeadyConnection`)

| Repository | Status | Notes |
|------------|--------|-------|
| HeadyConnection/headyconnection-site | `[CANONICAL]` | HeadyConnection nonprofit website |
| HeadyConnection/headyconnection-programs | `[CANONICAL]` | Program and grant management |
| HeadyConnection/headyconnection-docs | `[CANONICAL]` | Public documentation for HeadyConnection |
| HeadyConnection/.github | `[CANONICAL]` | Org-level config and profile |
| HeadyConnection/headyconnection-staging | `[STAGING]` | Pre-production staging |
| HeadyConnection/headyconnection-sandbox | `[EXPERIMENTAL]` | Nonprofit tech experiments |

---

## Applying Status Labels

Each repository **MUST** display its status banner in two places:

1. **Repository description** (GitHub Settings > About): Prefix with the status tag, e.g. `[CANONICAL] Heady monorepo — source of truth`
2. **README.md top badge**: Add a badge at the top of the README:

```markdown
<!-- For CANONICAL repos -->
![Status: Canonical](https://img.shields.io/badge/status-CANONICAL-brightgreen)

<!-- For MIRROR repos -->
![Status: Mirror](https://img.shields.io/badge/status-MIRROR-blue)

<!-- For STAGING repos -->
![Status: Staging](https://img.shields.io/badge/status-STAGING-yellow)

<!-- For EXPERIMENTAL repos -->
![Status: Experimental](https://img.shields.io/badge/status-EXPERIMENTAL-orange)

<!-- For ARCHIVED repos -->
![Status: Archived](https://img.shields.io/badge/status-ARCHIVED-lightgrey)
```

---

## Classification Rules for Unlisted Repos

When a repo is not explicitly listed above, apply these rules in order:

1. Name contains `archive`, `deprecated`, `legacy` → **ARCHIVED**
2. Name contains `staging` → **STAGING**
3. Name contains `testing`, `test`, `qa` → **STAGING**
4. Name contains `mirror`, `production`, `deploy` → **MIRROR**
5. Name contains `sandbox`, `lab`, `playground`, `experiment`, `research`, `spike`, `prototype`, `dev` → **EXPERIMENTAL**
6. Name contains `-core`, `template-` → **CANONICAL**
7. Default if none match → **EXPERIMENTAL** (conservative; promote explicitly when ready)
