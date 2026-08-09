# ADR-0000: Reject RAM-First / Latent-as-Truth

- **Status:** Accepted (2026-06-17, founder approval per ADR-0013)
- **Deciders:** Eric Anthony Haywood

## Context

Early Heady framing (the antigravity "RAM-ops" / "vector-space-as-truth" workflows) treated the in-memory
3D vector space as the *system of record* — files in `apps/`/`packages/` were "merely outward
projections" of latent state. Two independent deep-research passes and the liquid-latent-OS synthesis
converge against this: it inverts the durability hierarchy and makes recovery, audit, and consistency
intractable. The literature (DDIA) is explicit — **derived stores must be reconstructible from the
system of record**, not the other way around.

## Decision

1. **Each concern has one durable authority; the latent/vector space is always a *derived* store.**
   Repository files are authoritative for file/source content (ADR-0001) and are re-indexed through
   Merkle-tree hashing (ADR-0023). Postgres (Neon) is authoritative for durable runtime/domain records,
   whose derived projections are rebuilt through WAL-driven replay (ADR-0014). Numbered ADR-0000
   because it is logically prior to ADR-0001 — it fixes *what truth is* before *where truth lives*.
2. The "liquid latent OS" is an **experience layer on top of** the durable spine, never a replacement.
3. RAM-first / latent-as-truth language is retired from canonical docs; the V9 super prompt's RAM-ops
   posture is **superseded** here.

## Consequences

- (+) Recovery is always possible: any derived store can be dropped and rebuilt from its concern's
  authoritative source (ADR-0009, ADR-0014, ADR-0023).
- (+) Consistency and audit have an unambiguous source-specific anchor (ADR-0001 repository authority;
  ADR-0002 outbox and ADR-0006 idempotency for durable database writes).
- (−) The "everything is RAM" mental model is abandoned; some legacy workflow names become misnomers.
- Governs ADR-0001 (repository authority), ADR-0002 (backbone), ADR-0003 (retrieval), ADR-0014
  (database replication), and ADR-0023 (file projection trigger). See REBUILD_PLAN_V2 §1.

## Erratum (2026-08-09)

The original wording described Neon as the universal system of record and named a Postgres-only
Vectorize rebuild path. That was overbroad: it conflated file/source-content indexing with
database-to-derived-store projection. This correction records the already-ratified two-source
reconciliation from ADR-0014 and ADR-0023; it does not reopen the decision that latent state is never
authoritative.

ADR-0051 proposes a stronger universal-SSOT model in which Neon also holds canonical source bytes and
Git becomes a projection. That proposal does not take effect until its signed ratification and
source-ledger migration activation.
