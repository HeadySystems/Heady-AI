# Source of Truth

> **Status:** Approved · **Date:** 2026-06-17
> Canonical authority declaration for the Heady ecosystem. See ADR-0001.
> **Updated 2026-06-17:** `rebuild` is now the default branch. `main` archived as `legacy/main-archive`.

## Canonical branch

| Branch | Status |
|---|---|
| **`rebuild`** | **Default + canonical — all new work targets here** |
| `legacy/main-archive` | Frozen · locked · preserved for IP provenance (sha: 3a54aeee) |
| `main` | Legacy pointer (will be retired after verification period) |

## Canonical repositories

| Role | Repository | Status |
|---|---|---|
| **Canonical engineering monorepo** | `HeadySystems/heady-ai` (`rebuild` branch) | **Authoritative** |
| **Canonical docs / strategy / IP hub** | `HeadyMe/heady-docs` | Authoritative (read-only catalog) |
| Legacy core | `HeadyMe/Heady-pre-production-9f2f0642` | Migrate `heady-manager` logic, then archive |
| `HeadySystems/main`, `HeadySystems/Heady`, `ai-workflow-engine` | — | **Archived** (do not build from) |
| `*-core` satellites (headyme, headymcp, headysystems, …) | thin projection shells | **Fold into monorepo** or label projection-only |

Releases, provenance, contract generation, and CI run **only** from the canonical monorepo, `rebuild` branch.

## Single authorities

| Concern | Authority |
|---|---|
| System of record | Neon PostgreSQL (ADR-0002) |
| Retrieval / vectors | Neon pgvector (ADR-0003) — not Vectorize, not Qdrant |
| Cross-boundary writes | Transactional outbox only (ADR-0002) |
| Contract surface | `packages/contracts` (OpenAPI → Kubb → types/Zod/`mcp-tools.json`) |
| Durable orchestration | Cloudflare Workflows + Queues + Durable Objects (ADR-0004) |
| Secrets | GCP Secret Manager via keyless OIDC (ADR-0008) |
| Identity | Firebase Auth |

## GitHub org consolidation

Collapse 4 orgs → 1 (`HeadySystems`) as the first migration step, before code consolidation.

## Action items

- [x] Approve this declaration + ADR-0001.
- [x] Flip default branch to `rebuild` (2026-06-17).
- [x] Archive `main` as `legacy/main-archive` (locked, tag: `archive/main-2026-06-17`).
- [x] Branch protections on `rebuild`: CI gate + coherence gate required.
- [ ] Add CI check: release/provenance only from canonical repo.
- [ ] Archive the repos marked Archived; add projection manifests only for satellites that survive.

## Canonical planning documents

- `docs/REBUILD_PLAN_V2.md` — current rebuild plan (supersedes `OPTIMAL_REBUILD_PLAN.md` v1).
- `docs/STEPWISE_BUILD_SPEC.md` — every component as an ordered build step (Build/Depends/Details/Done/Ref).
- `docs/BUILD_NARRATIVE.md` — the story of how the build should go (read before accepting ADRs).
- `docs/PROVIDER_AND_OSS_MASTER_PLAN.md` — provider & open-source utilization.
- `docs/compendium/` — exhaustive component-by-component reference (bees, swarms, governance, transforms, …).
- `docs/adr/0000–0039` — architecture decisions (0000 + 0014–0018 added, 0003/0005 amended in v2 reconciliation; 0019–0032 added post-v2; 0033–0039 renumbered in from the retired `docs/ADR/` directory on 2026-08-04, resolving the numbering collision — see `docs/reports/sot-consistency-audit-2026-08-04.md`).
- `docs/ENV_SEPARATION.md` — legacy vs rebuild provider namespacing spec.

φ = 1.618033988749895 — Fibonacci-scaled per LAW-10
© 2026 HeadySystems Inc. — Eric Haywood, Founder
