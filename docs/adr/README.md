# Architecture Decision Records

One numbered file per architectural decision, Nygard format (Title · Status · Context · Decision · Consequences). **Immutable once Accepted** — superseded by a new ADR, never edited in place. This log is the single authoritative record of *why* Heady is built the way it is.

The governing principle for all of these: **pick one source of truth per concern and derive everything else from it deterministically.** "Globally consistent" does not mean synchronous replicas — it means mechanical agreement between a source and its projections, with reconciliation when they diverge.

## Status

Of **55 ADRs (`0000`–`0054`)**, `0000`–`0051` are **Accepted**; `0052` (instruction provenance
and channel authentication), `0053` (temporary solo-founder approval quorum), and `0054` (domain
canon carrier closure) are **Proposed**. All await authenticated acceptance and govern nothing
while Proposed. `0000`–`0018` (the backbone: RAM-first rejection, canonical-repo authority,
architecture backbone, pgvector retrieval, durable orchestration, agent governance, idempotency,
DDL coordination, GDPR, PITR, rate limits, SLO, FinOps, founder governance, CDC, embedding lock,
agent loop, projections, model gateway) were ratified **2026-06-17 by founder approval per
ADR-0013** in a single batch review. `0019`–`0029` were Accepted 2026-06-15 and carry v2
Reconciliation sections. `0030` and `0032` were Accepted 2026-08-04 by founder-signed tags;
`0031` was Accepted 2026-07-24 by founder-signed tag. Per-file `Status:` headers are authoritative.

> 🔁 **Legacy transfer (2026-08-09):** `0033`–`0050` were transferred into the canonical
> number-space from the surviving legacy corpora — the uppercase `docs/ADR/` set (its bodies
> `0019`–`0025` became `0033`–`0039`), the `_archive/Heady` ADR generations (`0040`, `0042`–`0044`,
> `0046`–`0047`), and the heady-ai legacy generation (`0048`–`0050`). Transferred records keep
> their original Accepted status and date; each carries a `Reconciliation (2026-08-09 transfer)`
> section aligning it with this corpus and a `Provenance` section naming its source. Two records
> — `0041` (HCFullPipeline 21-stage canon) and `0045` (structured logging: pino) — had no ratified
> legacy body: they were authored as **Proposed** (decisions already live and machine-enforced) and
> **ratified Accepted 2026-08-09 by the founder-signed tag `adr-0041-0045-accepted`** (OpenPGP,
> the ADR-0030/0031/0032-style ceremony — verify with `git tag -v`). The earlier ratification claim
> in commit `91059537a4` predated any verifiable founder act and was voided in `c48062fc61`; the
> signed tag is the acceptance of record — see the incident note and its resolution in the
> disposition map below.
> Full disposition map (including what was
> deliberately *not* transferred): [`docs/LEGACY_COMMAND_ADR_TRANSFER_2026-08-09.md`](../LEGACY_COMMAND_ADR_TRANSFER_2026-08-09.md).
> The legacy `docs/ADR/` corpus is banner-marked as transferred and frozen.

> 🗄️ **Universal SSOT proposal (2026-08-09):** ADR-0051 proposes moving canonical source bytes,
> revisions, refs, and Merkle roots into Neon. Until signed ratification and migration activation,
> ADR-0001 remains authoritative and Git remains the canonical engineering repository.

> ✅ **Doc-drift resolved (2026-06-17):** the stale v1 ADR generation (`0001-canonical-repo`, `0002-strangler-fig-evolution`, `0003-source-of-truth-ledger`, `0004-consistency-model`, Accepted 2026-06-14) — superseded by the canonical `0001-canonical-repository-authority` / `0002-architecture-backbone` / `0003-retrieval-authority-pgvector` / `0004-durable-orchestration-center` — has been **archived to `docs/adr/superseded-v1/`** (content preserved, out of the canonical number-space). This directory indexes the canonical set only; `superseded-v1/` is quarantined from the coherence + data-consistency gates.
