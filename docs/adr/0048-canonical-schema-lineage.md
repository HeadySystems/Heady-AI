# ADR-0048: Canonical Schema Lineage & Migration Consolidation

- **Status:** Accepted (2026-06-14, heady-ai legacy generation) · Transferred to canonical corpus 2026-08-09
- **Context repo (at decision time):** HeadySystems/heady-ai (canonical monorepo per `facts.yaml`)

## Context

`migrations/` held **18 files with colliding numbers** — multiple `001_*`, `002_*`, `003_*` —
across 3–4 incompatible schema designs: a namespaced `heady_*` design, two different flat
`public` "initial schema" designs (both creating `users`/`sessions`/`audit_log` differently),
a flat auth schema, and a parallel `heady_memory_t1/t2` tier design. Several were not
idempotent. There was **no migration runner and no `schema_migrations` ledger** — schema was
applied ad hoc. This is master-data drift in the data layer itself (the defect `facts.yaml`
records as `service_count_conflict`, manifesting in schema).

## Decision

1. **Canonical lineage = the namespaced `heady_*` design**, renumbered forward-only as
   `migrations/0001_…0008_`. Chosen by evidence: the dependency-ordered later migrations
   (004–008) build on `heady_core`/`heady_identity`/`heady_audit`/`heady_swarm`/`heady_pipeline`
   and reference `heady_identity.tenants`; `0001_extensions_and_schemas.sql` creates exactly
   those 5 schemas, so the chain is self-contained.
2. **All conflicting/older designs quarantined** to `migrations/_superseded/` (git-mv, preserved).
3. **One migration mechanism**: a forward-only runner + `schema_migrations` ledger lives in the
   consistency package; nothing else applies schema (ADR-0003 in latent-core-dev, re-homed here).
4. `projection_tables` and `graph_rag_schema` are **real features**, not dead designs — port to
   the `heady_*` namespace and append as `0009_`, `0010_`.

## Consequences — MANDATORY before any apply

- **The flat "Aether" design (`001_initial_schema.sql`) is marked "Applied: 2026-03-07" and may
  be what is LIVE in Neon.** Do **not** run the canonical set blindly. First query the live DB
  (`SELECT schema_name FROM information_schema.schemata` + list tables) to determine which design
  is actually deployed. If the flat design is live, this is a deliberate data-convergence project,
  not a rename — use the runner's baseline mode to mark already-present state as applied.
- Once confirmed, the runner records `0001…0008` in `schema_migrations`; re-runs are no-ops.
- This ADR supersedes latent-core-dev/ADR-0001 (which wrongly picked latent-core-dev as canonical).

## Reconciliation (2026-08-09 transfer)

- Canonical **ADR-0007** (DDL coordination across logical replication) covers how schema changes
  are coordinated across the replication path, but not the migration-lineage consolidation this
  record mandates. The two are complementary, not overlapping.
- The consolidation has effectively been **realized in the rebuild**: `packages/db/migrations/`
  now carries a single live, forward-only numbered chain (`0001_init.sql` onward — eleven files as
  of 2026-08-09, ending at `0011_node_orchestration_integrity.sql`) with one runner and a ledger,
  and no colliding designs. The directory itself is the authoritative enumeration; the chain is
  actively growing, so this ADR deliberately does not freeze a file list.
- The operational hazard this ADR flagged **remains standing guidance**: the live Neon schema may
  diverge from the canonical lineage, so query the live database before applying the chain. A
  related live finding confirms it: the 0001→0006 chain halts on a **bare** Neon branch at
  `0003` (Data-API `authenticated` role) and `0004` (role-ALTER privilege) because of
  role/privilege environment preconditions that the production root satisfies. Chain-vs-prod-root
  verification at deploy time is therefore required, exactly in the spirit of this record's
  "query before applying" mandate.

## Provenance

- **Source:** `/home/headyme/_heady_skeleton_export/Heady-legacy/docs/adr/0001-canonical-schema-lineage.md`
- **Transferred:** 2026-08-09, into the canonical corpus at `docs/adr/` as ADR-0048.
- The original file remains in place in the legacy skeleton export; decision content is preserved
  verbatim apart from renumbering and the header/status normalization.
