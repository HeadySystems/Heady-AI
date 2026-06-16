# ADR-0000: Reject RAM-First / Latent-as-Truth

- **Status:** Proposed (2026-06-15)
- **Deciders:** Eric Anthony Haywood

## Context

Early Heady framing (the antigravity "RAM-ops" / "vector-space-as-truth" workflows) treated the in-memory
3D vector space as the *system of record* — files in `apps/`/`packages/` were "merely outward
projections" of latent state. Two independent deep-research passes and the liquid-latent-OS synthesis
converge against this: it inverts the durability hierarchy and makes recovery, audit, and consistency
intractable. The literature (DDIA) is explicit — **derived stores must be reconstructible from the
system of record**, not the other way around.

## Decision

1. **Postgres (Neon) is the system of record; the latent/vector space is a *derived* store** rebuildable
   from it (`rebuild:vectorize --from-postgres`). Numbered ADR-0000 because it is logically prior to
   ADR-0001 — it fixes *what truth is* before *where truth lives*.
2. The "liquid latent OS" is an **experience layer on top of** the durable spine, never a replacement.
3. RAM-first / latent-as-truth language is retired from canonical docs; the V9 super prompt's RAM-ops
   posture is **superseded** here.

## Consequences

- (+) Recovery is always possible: any derived store can be dropped and rebuilt from the SoR (ADR-0009).
- (+) Consistency and audit have one anchor (ADR-0002 outbox, ADR-0006 idempotency).
- (−) The "everything is RAM" mental model is abandoned; some legacy workflow names become misnomers.
- Governs ADR-0002 (backbone), ADR-0003 (retrieval), ADR-0014 (replication). See REBUILD_PLAN_V2 §1.
