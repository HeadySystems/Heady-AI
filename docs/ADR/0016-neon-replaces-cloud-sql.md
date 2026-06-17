# ADR-0016: Neon Postgres Replaces Cloud SQL as Primary Database
**Date:** 2026-06-17 | **Status:** Accepted | **Author:** Eric Haywood

## Context

WINDSURF_INSTRUCTIONS.md (v3.2.0, March 2026) documents the legacy architecture as:
`Cloud SQL PostgreSQL 16 + pgvector, us-central1, heady-prod-609590223909`. The rebuild
canonically references Neon Postgres throughout every modern config, SPEC.md, and the
`heady-neon-optimizer` skill. These are two different databases, incompatible operational
models, and different regions (`us-central1` legacy vs `us-east1` rebuild).

This divergence is the most dangerous undocumented decision in the codebase — code
targeting Cloud SQL will silently fail when deployed against Neon, and vice versa.

## Decision

**Neon Postgres** is the canonical database for the rebuild and all new services.
Cloud SQL is legacy-only, preserved in `legacy-main-archive` but not forward-supported.

Rationale for Neon:
- Serverless branching — Neon branches enable zero-risk migration testing against production
  data clones (Cloud SQL has no equivalent)
- Scale-to-zero — no idle instance cost; Cloud SQL minimum is ~$25/month per instance
- pgvector HNSW is first-class in Neon without extension management overhead
- Neon's HTTP driver enables edge-side queries from Cloudflare Workers (Cloud SQL cannot
  be queried from Workers without a proxy)
- Connection pooling via Neon serverless driver replaces the need for pgBouncer

Region: Neon project targets `us-east1` (consistent with Cloud Run canonical region, ADR-0002).
Legacy Cloud SQL was in `us-central1` — the region change is intentional.

Connection pool: phi-scaled — Hot=34, Warm=21, Cold=13, Reserve=8 connections.

## Consequences

### Positive
- Branch-based migration testing eliminates the "test against prod schema" problem permanently
- Edge-queryable via Neon's HTTP driver without a proxy layer
- Scale-to-zero eliminates idle DB costs in development and staging environments
- Same pgvector feature set as Cloud SQL with simpler operational model
- `heady-migration-engine` skill's Neon branching workflow becomes the standard migration path

### Negative
- WINDSURF_INSTRUCTIONS.md references Cloud SQL env vars (`DATABASE_URL postgresql://...Cloud SQL`) —
  any agent or engineer reading that doc will configure the wrong database
- Connection string format differs: Neon uses serverless HTTP driver for Workers, standard
  Postgres URL for Cloud Run — two connection patterns must be maintained
- Neon is a newer vendor than Google Cloud SQL — longer operational history not available

## Migration Note

Any Cloud Run service still referencing `heady-prod-609590223909` Cloud SQL must be
updated to Neon connection strings before it can run against the rebuild schema.
WINDSURF_INSTRUCTIONS.md is a legacy document — do not update it; create a new
`REBUILD_INSTRUCTIONS.md` for the canonical rebuild stack.

## Alternatives Considered

- **Keep Cloud SQL**: rejected — no branch testing, no edge queryability, higher idle cost
- **Supabase**: rejected — Firebase Auth + GCP integration tighter with Neon
- **PlanetScale**: rejected — MySQL, not Postgres; pgvector not available
- **AlloyDB**: rejected — GCP-only, no scale-to-zero, higher cost
