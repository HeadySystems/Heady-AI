# Heady System Compendium — Master Index

> **Status:** Living reference · **Date:** 2026-06-15 · **Owner:** Eric Anthony Haywood
> The exhaustive component-by-component reference for everything built (or to be built) into Heady.
> Each file documents its components with **What · Why · How · When · Where**, plus a **Disposition**
> (canonical/baseline vs deferred vs reconciled vs superseded) against `REBUILD_PLAN_V2.md` and the ADRs.
> This compendium *catalogs the full vision*; `REBUILD_PLAN_V2.md` *sequences what gets built when*.

## How to read this

Two source layers feed every entry:
- **The vision layer** — `HEADY_SUPER_PROMPT_v9.0.md` (scanned 2026-03-16), the 88KB Architectural
  Blueprint, the 136 `SKILL.md` packs, the `src/bees/` registry, and the dropzone reports. This is the
  *maximalist designed system*: 24 swarm domains / 197 bees, 22-stage pipeline, 21 nodes, 17 swarms.
- **The canonical layer** — `REBUILD_PLAN_V2.md` + ADRs 0001–0018. This is the *reduced, sequenced
  build*: one authority per concern, ≤1 net-new platform per phase, evidence-gated expansion.

Where they diverge, the canonical layer wins and the divergence is recorded in §Reconciliation
(`11-reconciliation.md`) and inline as **Disposition**.

## The one mental model

> **Bees, swarms, nodes, and the 24 port-ranged domains are a *design vocabulary*, not 197 daemons on
> 87 ports.** Canonically they are implemented as (a) **skills/handlers as data rows** in Postgres
> (`skills` table → handler modules), (b) **ephemeral worker invocations** (Cloudflare Workflow steps,
> Queue consumers, Colab tasks), and (c) **logical bounded-context boundaries** inside the Cloud Run
> modular monolith. A "bee" is a function the agent loop or pipeline invokes; a "swarm" is an
> orchestration topology over those functions. The φ-math, CSL gates, and stigmergy are real and
> implemented; the 197-process deployment is not — see `02-bees-and-swarms.md` §Runtime mapping.

## File map

| # | File | Covers | Status |
|---|---|---|---|
| 00 | `00-INDEX.md` | this index + reconciliation summary | ✅ |
| 01 | `01-laws-and-constants.md` | 4 Liquid laws · 10 constitutional laws · φ constants · CSL gates + threshold ladder · 7 archetypes · 11 personas | ✅ |
| 02 | `02-bees-and-swarms.md` | **every bee** (3 taxonomies reconciled) · **every swarm** (17 matrix + 24 domains) · BaseHeadyBee lifecycle · Bee Factory · stigmergy · runtime mapping | ✅ |
| 03 | `03-pipeline-and-nodes.md` | 22-stage HCFullPipeline · 21 nodes · Socratic loop · scan protocol · 6-layer boot · Monte-Carlo/Arena/Judge | ✅ |
| 04 | `04-memory-and-retrieval.md` | 3-tier memory · AutoContext 5-pass · CoALA/Letta/mem0/Zep · pgvector+Vectorize · embedding lock · HeadyFS 3D | ✅ |
| 05 | `05-model-mesh.md` | Liquid Gateway · CF AI Gateway chokepoint · 9-tier provider mesh · Multi-Model Council/Battle Arena · routing formula | ✅ |
| 06 | `06-governance.md` | **the full governance system**: laws enforcement · CSL gates · HCP approval + OPA/Rego · projection manifests · consistency engine · MCP security · PQC · agent bootstrap · permission graph/delegation vault · trust receipts | ✅ |
| 07 | `07-transforms-midi-creative.md` | **MIDI→RTP-MIDI(UDP)→event-bus→creative chain** · all transform pipelines (text↔vector↔code↔3D↔audio) · edge-diffusion · sonification | ✅ |
| 08 | `08-skills-catalog.md` | 10 Antigravity IDE skills · 136 SKILL.md packs (grouped) · Skill Foundry · heady-distiller recipe engine | ✅ |
| 09 | `09-infra-and-services.md` | 5 tiers · service registry · Colab GPU + Tailscale mesh · 7 compute providers · 8-layer security · design system · 9/11 sites | ✅ |
| 10 | `10-business-and-roadmap.md` | 990 Parser beachhead · PHI compliance · Reserve-Commit billing · Fibonacci pricing · credit programs · remediation matrix · 4 gates | ✅ |
| 11 | `11-reconciliation.md` | every V9↔v2 conflict + resolution (detail) | ✅ |

## Reconciliation summary (the conflicts that matter)

These are the points where the vision layer and the canonical layer disagree. Resolution rationale lives
in `11-reconciliation.md`; the headline call is here so no reader is misled.

| # | Topic | Vision layer (V9 / blueprint) | Canonical (v2 / ADR) | Resolution |
|---|---|---|---|---|
| R1 | **Frontend stack** | V9 Law 3: Drupal 11 + Twig + **Vanilla ES2024, no React/Vue/Vite ever** | Design-zip + Native Interface + v2: **React + Vite + assistant-ui** (+ vanilla web components) | **RESOLVED — dependency minimalism.** V9 Law 3 is **stale/non-binding.** Default to vanilla + Twig + web components (no build step) to minimize dependencies; use React/Vite **only when complexity earns it** (agent console, MCP console, portal). Decide per-surface: "does the complexity justify the dependency?" |
| R2 | **Vector stores** | 3-tier: Upstash + pgvector + **Qdrant** (+ Upstash Vector DiskANN) | pgvector authority + Vectorize derived cache; **Qdrant dropped** | Canonical (ADR-0003 amended). Pre-launch → free to drop unused Qdrant. |
| R3 | **Crypto** | V9 Law 4: **PQC everywhere, Ed25519 RETIRED** (ML-DSA/ML-KEM) | Approval system uses **Ed25519** signed receipts | PQC is **aspirational/Phase-4**; Ed25519 is the pragmatic baseline now. Dual-track; see `06-governance.md` §PQC. |
| R4 | **Scale of swarm** | 24 domains / **197 bees** / 10,000 concurrent / 87 ports / 4× Colab GPU | Modular monolith; bees = functions; single-agent-first | Vocabulary kept; **runtime reduced** to skills-as-data + Workflow/Queue invocations. |
| R5 | **Monorepo layout** | blueprint: `apps/ packages/ shared/ services/` | scaffold: `apps/ packages/ tooling/ configs/` | Keep scaffold's 4 dirs; `shared/`→`packages/`, `services/`→bounded contexts in the monolith. |
| R6 | **CSL thresholds** | blueprint ladder (DEDUP .972 … MIN .500) vs V9 ranges (PRIME .718/BOOST .618/RECALL .382) | both are φ-derived but differ | Adopt V9's `ψ`-anchored ranges as canonical gate cuts; blueprint ladder = privileged-action sub-gates. See `01-laws-and-constants.md`. |
| R7 | **Pipeline always-parallel** | V9 §0: "no queues, instantaneous dispatch, all fire at once" | v2: outbox + durable Workflows + idempotency | Data-dependency DAG is real; "no queues" is rejected — durable queues/outbox are required (ADR-0002). |

## Companion documents (not in this compendium)

`SOURCE_OF_TRUTH.md` · `OPTIMAL_REBUILD_PLAN.md` (v1) · `REBUILD_PLAN_V2.md` · `PROVIDER_AND_OSS_MASTER_PLAN.md` · `docs/adr/0001–0018`.
