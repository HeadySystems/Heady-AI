# ADR-0050: The Consistency Spine — CQRS + CDC, Not Event Sourcing

- **Status:** Accepted (2026-06-14, heady-ai legacy generation) · Transferred to canonical corpus 2026-08-09
- **Note (original):** names the architecture so every future agent reads the same one. Supersedes
  the framing of latent-core-dev/ADR-0004 and re-homes it to the canonical repo.

## Context

Heady needs global data consistency without the operational tax of full event sourcing.
The repeated failure mode was treating an in-memory/latent representation as truth.

## Decision — the spine, in one vocabulary

**CQRS with CDC-driven projections.** Postgres rows are **mutable and authoritative**; a
projector maintains derived read models from change data. This is *not* event sourcing — we
do not rebuild current state by replaying domain events; we read authoritative rows and
project them. (Young: CQRS does not require event sourcing; full ES carries a tax we don't need.)

Reasoning chain (cite in any future ADR): Kreps "log as unifying abstraction" → Kleppmann
"database inside out" / *DDIA* Derived Data (every derived store must be reconstructible from
the system of record) → Kreps Kappa (single replayable source; reprocessing = replay) →
Young/Fowler CQRS → Richardson transactional outbox + transaction-log tailing.

- **System of record:** Neon Postgres — `heady_consistency.event_log` (append-only episodic
  spine) + authoritative business/`facts` rows. Derived stores (`vector_memories`, Redis, KV)
  are **rebuildable by replay** from it (`rebuild --from-log`). If it can't be rebuilt, it's
  hidden truth and forbidden.
- **Projection transport — staged:** v1 = the transactional `outbox` + pull-based `Projector`
  (shipped). Optimal target = WAL **logical replication (`pgoutput`)** consumed by a small
  Node `pg-logical-replication` worker — no Kafka/Debezium at this scale. WAL-CDC is gated on
  `wal_level=logical` (Neon-irreversible — its own ADR) + a heartbeated slot on the direct endpoint.
- **Efficiency:** change-significance filtering — skip re-embedding when `content_hash` is
  unchanged (implemented in the vector-memory projector).

## The fidelity gate = four named sub-patterns (not one magic term)

1. **Contract verification** — Pact, on the OpenAPI surface.
2. **Schema-evolution checks** — Buf / schema registry, on projections.
3. **Drift detection** — Postgres↔Vectorize parity (count-at-quiescence, PK-sample `content_hash` audit, retrieval canary). Implemented by `reconcile()` / `verify()`.
4. **Replay parity** — Kappa: `rebuild:vectorize --from-postgres` reproduces the index.

## PACELC, validated (corrected)

| Concern | Store | Model |
|---|---|---|
| identity / billing / auth | Postgres single primary | **serializable via SSI; effectively strict-serializable on a single primary** (NOT formally linearizable — Jepsen). Never write "strict serializable" unqualified. |
| conversation/session | Durable Object per session | single-writer linearizable (actor model) |
| vector retrieval | Vectorize (derived) | bounded-staleness eventual |
| streams | outbox/queue | at-least-once + idempotent consumers |
| cache | Redis/KV | bounded-staleness, explicit TTL, never authoritative |

## Consequences

- The phrase "RAM-first / latent-as-truth" is forbidden in code and docs (see ADR-0000 intent).
- Combine with the similarity/transaction split (legacy ADR-0002, now ADR-0049): similarity
  detects/routes; this transactional spine commits.
- Vectorize dimension is immutable at create-time → the 384-dim commitment; model migrations
  dual-write to a new index (see `facts.yaml` embedding_model_watch).

## Reconciliation (2026-08-09 transfer)

- The **mechanics** here are covered by the canonical corpus: **ADR-0014** (logical replication
  and WAL-driven CDC, including the `pgoutput` consumer, direct-endpoint slot, heartbeat, and
  change-significance filtering), **ADR-0017** (projections engine and lifecycle), and
  **ADR-0025** (strict global consistency governance).
- What this transfer preserves that those records lack:
  1. the explicit **"CQRS + CDC, NOT event sourcing"** framing — the named rejection of full
     event sourcing and its operational tax, with the Kreps→Kleppmann→Kappa→Young/Fowler→
     Richardson reasoning chain;
  2. the **four-part fidelity gate** as named sub-patterns — Pact contract verification, Buf
     schema-evolution checks, Postgres↔Vectorize drift detection, and Kappa replay parity;
  3. the **corrected PACELC table per store**, including the Jepsen-informed prohibition on
     writing "strict serializable" unqualified for the Postgres primary.
- Lineage: this record explicitly **superseded latent-core-dev/ADR-0004** in its own generation.
  A superseded cousin also exists in the legacy corpus — the legacy "009-cqrs-event-sourcing"
  ADR chose full event sourcing; that choice is **rejected by this record** and must not be
  cited as authority.

## Provenance

- **Source:** `/home/headyme/_heady_skeleton_export/Heady-legacy/docs/adr/0003-consistency-spine.md`
- **Transferred:** 2026-08-09, into the canonical corpus at `docs/adr/` as ADR-0050.
- The original file remains in place in the legacy skeleton export; decision content, fidelity
  gate, and PACELC table preserved verbatim apart from renumbering, header/status normalization,
  and updating the internal ADR-0002 cross-reference to its transferred number (ADR-0049).
