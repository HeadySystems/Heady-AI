# ADR-0049: Similarity Detects and Routes; Transactions Commit

- **Status:** Accepted (2026-06-14, heady-ai legacy generation) · Transferred to canonical corpus 2026-08-09

## Context

A recurring proposal is to make Heady's vector/CSL substrate its own consistency
mechanism — "canonical truth = the highest-confidence vector," drift detection as a
similarity query. Analysis (and the embeddings literature) shows this is **half-right
and half-dangerous**: sentence embeddings provably cannot distinguish numeric or negation
contradictions — minimal negation pairs sit at high cosine similarity, and directly
opposing technical recommendations scored 0.7413 cosine in a controlled test. ANN indexes
(HNSW) are also probabilistic/non-deterministic, and embedding-model version changes
silently shift every vector. So the vector layer cannot be the authority for exact scalar
facts (patent count = 51, jurisdiction = Colorado, vector dim = 384), auth, or money.

## Decision

**Similarity DETECTS and ROUTES; transactions COMMIT.** A category split is the architectural invariant:

- **Transactional consistency (equality; "close" is failure):** exact scalar facts, auth,
  money, the canonical registry. Owned by Neon system-of-record + the append-only event log
  + outbox + UUID idempotency (`@heady-ai/consistency`, legacy ADR-0004). `facts.yaml` →
  `canonical_facts` is committed here; the CCE (`tooling/cce`) lints scalars hard.
- **Semantic consistency (convergence, not equality):** prose, knowledge, narrative. Owned by
  the vector/CSL layer — used for **detection and routing only**: drift/contradiction
  detection (cosine + cross-encoder NLI), semantic dedup/canonicalization, anomaly-flag on
  writes, semantic caching with CSL-gated tiers. These open reconciliation tickets or route
  requests; they never commit scalar truth.

## Consequences

- A "semantic CRDT" (merge-by-centroid/cosine) is **not** to be built as a CRDT: centroid
  averaging and cosine-selection are non-associative and non-idempotent, so they cannot form
  the join-semilattice CRDTs require (current research proves the negative). Use standard
  CRDTs or last-writer-wins + UUID idempotency on Neon for multi-device merge.
- Embedding-model version is part of every cache/consistency key; a model upgrade is a full
  re-embed event, never a silent change.
- The vector-native detection features are a **later stage built on top of** the transactional
  engine, not a replacement for it. Foundation first; detection second.

## Reconciliation (2026-08-09 transfer)

- Strongly consonant with canonical **ADR-0000** (Reject RAM-First / Latent-as-Truth) and
  **ADR-0025** (Strict Global Consistency and Non-Orphanage Governance), but this record states
  a **sharper invariant with measured evidence** that neither carries: the 0.7413-cosine finding
  between directly opposing technical recommendations, and the non-associative/non-idempotent
  centroid-merge argument that kills the "semantic CRDT" proposal on join-semilattice grounds.
- Cross-reference both: ADR-0000 forbids latent state as authority; ADR-0025 governs strict
  consistency of committed facts; **this ADR is the evidence-bearing root** for *why* vector
  similarity is confined to detect/route and never commits.

## Provenance

- **Source:** `/home/headyme/_heady_skeleton_export/Heady-legacy/docs/adr/0002-similarity-detects-transactions-commit.md`
- **Transferred:** 2026-08-09, into the canonical corpus at `docs/adr/` as ADR-0049.
- The original file remains in place in the legacy skeleton export; decision content preserved
  verbatim apart from renumbering, header/status normalization, and marking the internal
  ADR-0004 reference as a legacy-lineage reference.
