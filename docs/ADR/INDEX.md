# Heady Rebuild — ADR Index

> **⚠ LEGACY CORPUS — TRANSFERRED 2026-08-09.** This uppercase `docs/ADR/` corpus predates the
> canonical lowercase corpus at [`docs/adr/`](../adr/README.md) and is retained as a historical
> artifact only. Every decision below has been dispositioned into the canonical number-space:
>
> | Legacy # | Disposition |
> |---|---|
> | 0001 MCP adoption | Covered by canonical `0002` + `0026` |
> | 0002 Edge+Origin topology | Covered by canonical `0002` + `0004` |
> | 0003 pgvector + Vectorize | Covered by canonical `0003` |
> | 0004 Liquid Gateway racing | Covered by canonical `0018` |
> | 0005 Capacity ceiling fib(20) | **Transferred → canonical `0040`** |
> | 0006 φ-Math SoT | **Transferred → canonical `0042`** |
> | 0007 CSL over Boolean | **Transferred → canonical `0043`** |
> | 0008 Dual-active strategy | Body lost; not transferred (nearest relative: `superseded-v1/0002-strangler-fig`) |
> | 0009 Firebase + httpOnly | Covered by canonical `0028` |
> | 0010 Module consolidation | Covered by canonical `0001` + `0002` |
> | 0011 ESM only | **Transferred → canonical `0044`** |
> | 0012 21-stage HCFP | **Authored → canonical `0041`** (body was lost; rebuilt from RECONCILIATION_DECISIONS) |
> | 0013 Upstash EventSpine | Superseded — contradicted by canonical `0003` (Upstash = best-effort cache) + `0020` (pgmq durable path) |
> | 0014 Deterministic execution | **Transferred → canonical `0046`** |
> | 0015 Sacred Geometry topology | **Transferred → canonical `0047`** |
> | 0016 Neon over Cloud SQL | Covered by canonical `0002` |
> | 0017 Pino logging | **Authored → canonical `0045`** (resolves this corpus's Pino-vs-custom-logger self-conflict) |
> | 0018 CI/CD + coherence gate | Body lost; substance covered by canonical `0025` + REBUILD_PLAN_V2 §11 (10/11 laws machine-enforced) |
> | 0019–0025 (bodies below) | **Transferred → canonical `0033`–`0039`** with Reconciliation sections |
>
> Full disposition record: [`docs/LEGACY_COMMAND_ADR_TRANSFER_2026-08-09.md`](../LEGACY_COMMAND_ADR_TRANSFER_2026-08-09.md).
> Do not add new entries here — the canonical corpus is the only live number-space.

| # | Title | Status | Strength |
|---|-------|--------|---------|
| [0001](0001-mcp-protocol-adoption.md) | Adopt MCP as Unified Tool Gateway | Accepted | ⭐⭐⭐⭐⭐ Critical |
| [0002](0002-canonical-topology.md) | Cloudflare Edge + Cloud Run Origin | Accepted | ⭐⭐⭐⭐⭐ Critical |
| [0003](0003-hybrid-vector-memory.md) | pgvector Source of Truth + Vectorize Edge Cache | Accepted | ⭐⭐⭐⭐⭐ Critical |
| [0004](0004-liquid-gateway-provider-racing.md) | Liquid Gateway — Provider Racing at Edge | Accepted | ⭐⭐⭐⭐⭐ Critical |
| [0005](0005-capacity-ceiling.md) | Runtime Ceiling fib(20)=6765 | Accepted | ⭐⭐⭐⭐ High |
| [0006](0006-phi-math-single-source-of-truth.md) | φ-Math Single Source of Truth | Accepted | ⭐⭐⭐⭐⭐ Critical |
| [0007](0007-csl-replaces-boolean-gates.md) | CSL Replaces Boolean Gates | Accepted | ⭐⭐⭐⭐⭐ Critical |
| [0008](0008-dual-active-legacy-rebuild.md) | Dual-Active Legacy + Rebuild Strategy | Accepted | ⭐⭐⭐⭐⭐ Critical |
| [0009](0009-auth-firebase-httponly-cookies.md) | Firebase Auth + httpOnly Cookies Only | Accepted | ⭐⭐⭐⭐⭐ Critical |
| [0010](0010-core-module-consolidation.md) | Core Module Consolidation | Accepted | ⭐⭐⭐⭐ High |
| [0011](0011-nodejs-esm-only.md) | Node.js ESM Only | Accepted | ⭐⭐⭐⭐ High |
| [0012](0012-21-stage-pipeline-canonical.md) | 21-Stage HCFullPipeline as Canonical | Accepted | ⭐⭐⭐⭐⭐ Critical |
| [0013](0013-upstash-redis-event-spine.md) | Upstash Redis EventSpine | Accepted | ⭐⭐⭐⭐ High |
| [0014](0014-determinism-temperature-zero-seed-42.md) | Deterministic LLM Execution | Accepted | ⭐⭐⭐⭐ High |
| [0015](0015-sacred-geometry-node-topology.md) | Sacred Geometry Node Topology | Accepted | ⭐⭐⭐⭐⭐ Critical |
| [0016](0016-neon-replaces-cloud-sql.md) | Neon Postgres Replaces Cloud SQL | Accepted | ⭐⭐⭐⭐⭐ Critical |
| [0017](0017-structured-logging-pino.md) | Structured Logging — Pino Only | Accepted | ⭐⭐⭐⭐ High |
| [0018](0018-cicd-github-actions-gates.md) | CI/CD — GitHub Actions + Coherence Gate | Accepted | ⭐⭐⭐⭐⭐ Critical |
| [0019](0019-nine-domain-brand-architecture.md) | Nine-Domain Brand Architecture — Nonprofit/Commercial Split | Accepted | ⭐⭐⭐⭐⭐ Critical |
| [0020](0020-drupal-11-headless-cms.md) | Drupal 11 as Headless CMS | Accepted | ⭐⭐⭐⭐ High |
| [0021](0021-post-quantum-cryptography-mandate.md) | Post-Quantum Cryptography Mandate — ML-DSA/ML-KEM Hybrid | Accepted | ⭐⭐⭐⭐⭐ Critical |
| [0022](0022-gcp-region-canonical-lock.md) | GCP Project + Region Canonical Lock — us-east1 | Accepted | ⭐⭐⭐⭐⭐ Critical |
| [0023](0023-heady-manager-decomposition.md) | heady-manager.js Decomposition Mandate | Accepted | ⭐⭐⭐⭐⭐ Critical |
| [0024](0024-domain-registry-canonical-file.md) | src/config/domain-registry.js Canonical Domain File | Accepted | ⭐⭐⭐⭐⭐ Critical |
| [0025](0025-content-gateway-cloudflare-worker.md) | Content-Gateway Cloudflare Worker Contract | Accepted | ⭐⭐⭐⭐ High |

Generated: 2026-06-17 | Updated: 2026-06-17 | Author: Eric Haywood

> 25 ADRs documented. All reserved slots filled. Full coverage from MCP adoption through content delivery.
> Next recommended: ADR-0026 (workers/content-gateway deployment spec), ADR-0027 (heady-manager Phase 2 route extraction)
