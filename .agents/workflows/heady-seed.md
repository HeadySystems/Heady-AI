---
description: Plan and verify a fresh Heady workspace bootstrap while keeping secrets, persistence, and Neon writes human-gated
---

<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ Workspace Seed v2.0.0                                  ║
║  Plan-first bootstrap with explicit persistence and data gates. ║
║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# `/heady-seed`

Use for a fresh clone or a deliberately rebuilt execution environment. Default
to inspection and a bootstrap plan; do not install persistent hooks, start
background workers, mutate Neon, or expose secret values without the applicable
explicit authorization.

## Pipeline

1. Read `AGENTS.md`, accepted ADRs, and the canonical environment contract.
2. Verify Node, pnpm, Python/`uv`, workspace manifests, lockfiles, and required
   source directories without installing anything automatically.
3. Audit required environment-variable names through the governed secret
   resolver. Report presence only; never print values or treat `.env` as the
   production authority.
4. Validate migrations in plan mode. Neon remains the durable system of record;
   no baseline vectors or source data are inserted without a reviewed migration
   or explicit data-write grant.
5. Run local unit, build, policy, and readiness checks. Treat missing NATS,
   cloud identity, database access, or deployed health evidence as blockers to
   production readiness.
6. If the user separately approves persistent runtime setup, enumerate the exact
   worker, hook, service, scheduler, or configuration change and its rollback
   path before applying it.

## Success criteria

The local dependency graph and relevant tests pass, required secret names are
accounted for, planned migrations are checksummed, and every unperformed live or
persistent step is explicitly recorded. Local readiness is not deployed proof.
