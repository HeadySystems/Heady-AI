# Architecture Decision Records

One numbered file per architectural decision, Nygard format (Title · Status · Context · Decision · Consequences). **Immutable once Accepted** — superseded by a new ADR, never edited in place. This log is the single authoritative record of *why* Heady is built the way it is.

The governing principle for all of these: **pick one source of truth per concern and derive everything else from it deterministically.** "Globally consistent" does not mean synchronous replicas — it means mechanical agreement between a source and its projections, with reconciliation when they diverge.

## Status

There are **31 Accepted ADRs**: `0000`–`0029` plus `0031`. `0000`–`0018` (the backbone:
RAM-first rejection, canonical-repo authority, architecture backbone, pgvector retrieval, durable
orchestration, agent governance, idempotency, DDL coordination, GDPR, PITR, rate limits, SLO, FinOps,
founder governance, CDC, embedding lock, agent loop, projections, model gateway) were ratified
**2026-06-17 by founder approval per ADR-0013** in a single batch review. `0019`–`0029` were Accepted
2026-06-15 and carry v2 Reconciliation sections. `0031` was Accepted 2026-07-24 by founder-signed tag.
Per-file `Status:` headers are authoritative.

Proposed records beyond the accepted canonical set:

- `0030` — Heady Understanding Engine.

`0032` — Field & Agent Waves — **Accepted 2026-08-04** (founder acceptance per the ADR-0031
ceremony; ratifies the Field / agent-waves cognition substrate). `0041`–`0044` were also
accepted 2026-08-04 (legacy→rebuild ADR reconciliation).

> ✅ **Numbering-collision resolved (2026-08-04):** the seven Accepted ADRs that lived in the
> UPPERCASE `docs/ADR/` directory under numbers `0019`–`0025` (colliding with the different
> decisions at those numbers here) have been **renumbered into this canonical set** as
> `0033`–`0039` — nine-domain brand architecture (`0033`), Drupal 11 headless CMS (`0034`),
> PQC mandate (`0035`), GCP region canonical lock (`0036`), heady-manager decomposition
> (`0037`), domain-registry canonical file (`0038`), content-gateway Worker (`0039`).
> Each carries a `Renumbered:` provenance header; `docs/ADR/INDEX.md` is now a redirect stub.
> See `docs/reports/sot-consistency-audit-2026-08-04.md` (F1).

> ✅ **Doc-drift resolved (2026-06-17):** the stale v1 ADR generation (`0001-canonical-repo`, `0002-strangler-fig-evolution`, `0003-source-of-truth-ledger`, `0004-consistency-model`, Accepted 2026-06-14) — superseded by the canonical `0001-canonical-repository-authority` / `0002-architecture-backbone` / `0003-retrieval-authority-pgvector` / `0004-durable-orchestration-center` — has been **archived to `docs/adr/superseded-v1/`** (content preserved, out of the canonical number-space). This directory indexes the canonical set only; `superseded-v1/` is quarantined from the coherence + data-consistency gates.
