# ADR-0004 — Append-only log is truth; latent space is a derived projection

**Status:** Accepted (2026-06-14)

## Context
Heady's vision is a "liquid latent OS" where all projections from latent space are realtime, globally-consistent representations of the system. Taken literally — *latent state is the source of truth, files/DBs/APIs are shadows of it* — this is the cause of the drift it tries to prevent. Embeddings are **lossy, non-invertible, and model-version-dependent**: you cannot reconstruct exact state from a vector, and a model swap silently rewrites every vector. If latent space is authoritative, no projection can ever be *proven* correct and "realtime representation" degrades to "realtime guess."

We want the liquid *experience* (fast, vector-native, the feel of a living system) on a foundation where consistency is a checkable predicate, not a hope.

## Decision
**One append-only, ordered event log is the only source of truth.** Everything else — including latent space — is a deterministic projection of it.

1. **Truth = the log.** Every state change is an event with a monotonic offset (Postgres logical replication is the initial substrate; the outbox pattern guarantees a business write and its event commit atomically).
2. **Latent space = `f(log) → vectors`**, a pure function maintained by a streaming projector consuming the log tail. "Liquid" = the projector never stops; latent tracks the log within milliseconds. Because it is a pure function of the log, `rebuild --from-log` reproduces it exactly. If you cannot rebuild it from the log, it is hidden truth and it will drift.
3. **Realtime + consistent = offset stamping.** Every projection (UI, `-core` repos, the "3D vector memory", API responses, edge caches) carries the log offset it reflects. Global consistency becomes the predicate `projection.offset >= required.offset` — read-your-writes/causal at the edge, strict at the core.
4. **The embedding model version is itself a logged event.** Pinned `model_id` + `dims`. A model swap is an event that forces re-projection, so latent space can never silently drift under a provider change.
5. **Layers, each a projection of the one below, each offset-stamped:** in-RAM / Vectorize edge cache (fastest, eventually consistent) → pgvector (strong) → log (truth). A nightly reconciliation job compares content hashes and re-enqueues drift; alert if drift > 0.1%.

### Per-concern consistency (PACELC, written down to end debate)
| Concern | Store | Model |
|---|---|---|
| identity / billing / auth | Postgres single primary | strict serializable |
| session / conversation | Durable Object per session | single-writer linearizable |
| vector retrieval | pgvector (truth) → Vectorize (derived) | strong / eventual + offset-stamped |
| cache | Redis, TTL ≤ 60s | best-effort, never authoritative |

## Consequences
- "All projections are realtime representations of the system" is now precise and testable: projections are realtime materializations of one ordered log; the fidelity gate (ADR-0007) goes red when offsets/hashes diverge.
- No business code writes to Vectorize/Redis directly — it writes to the log; projections follow.
- The φ-scaling / CSL-gate / 150-line-file invariants from the Genesis Guide are retained as **lint-enforced conventions**, not load-bearing architecture: keep the 150-line cap (forces modularity) and φ-derived backoff jitter; do not let "no magic numbers" forbid a sensibly chosen constant.
