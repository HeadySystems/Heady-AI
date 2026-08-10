<!-- HEADY_BRAND:BEGIN
Heady™ ADR-0051 — Neon Universal Source Ledger
© 2026 HeadySystems Inc. — Eric Haywood, Founder
HEADY_BRAND:END -->

# ADR-0051: Neon Universal Source Ledger

- **Status:** Accepted (2026-08-09)
- **Decider:** Eric Anthony Haywood
- **Acceptance:** Founder-signed tag `adr-0051-accepted-53d3e63ca` (OpenPGP, EDDSA `1050B59E7296C46C26DDF95DA7D2108BB3C6101C` — the key of record; `git tag -v` returns Good signature)
- **Migration:** `packages/db/migrations/0012_neon_universal_source_ledger.sql`
- **Activation gate:** the decision is ratified, but until the migration is applied and read-authority cuts over, **ADR-0001 remains authoritative and Git remains the canonical engineering repository** (see Decision §activation).

## Context

ADR-0000 correctly rejects RAM and latent space as truth, but ADR-0001 leaves source bytes and their
history authoritative in Git while Neon is authoritative for operational records. That split creates
two recovery roots, two authorization models, and ambiguity about whether a repository checkout or a
retrieval record wins during reconciliation.

The founder directed that Neon become the single system of truth for source content as well as runtime
data. pgvector remains the retrieval authority beside the canonical content, while Git and local
worktrees become signed, reproducible projections.

## Decision

1. Neon is the universal durable system of truth. Canonical source bytes, paths, immutable revisions,
   parent relationships, named refs, actors, and Merkle roots live in `heady_source`.
2. Source blobs and revisions are content-addressed and append-only. A named ref may advance only
   through a compare-and-swap database function that records an immutable event.
3. Git is a distribution, review, signature, and offline worktree projection. Git object IDs remain
   provenance evidence but do not override the Neon revision ledger.
4. Merkle hashing remains the authoritative change detector for file-level reconciliation. The prior
   Merkle root is read from Neon; local JSON is a disposable cache and cannot advance authority.
5. A source change commits canonical bytes and a revision to Neon before embeddings or downstream
   projections advance. Embeddings in Neon pgvector are derived from the canonical source revision.
6. Vectorize, Redis/KV, local worktrees, Git remotes, and RAM are reconstructible projections.
7. Bootstrap and recovery are explicit modes: initial Git history may be imported once with recorded
   provenance; thereafter a Git-only commit is uncommitted projection state until accepted by Neon.

## Consequences

- (+) One backup, audit, authorization, and recovery root covers operational and source truth.
- (+) Exact source bytes and retrieval vectors share transactional provenance.
- (+) Merkle drift becomes mechanically resolvable against a durable authority.
- (−) Offline edits remain possible, but cannot become canonical until Neon is reachable.
- (−) Git hosting is no longer sufficient disaster recovery; Neon PITR and export drills must include
  the source ledger.
- (−) Existing Git-first CI/CD must migrate to Neon-revision-bound release manifests.

## Supersession and reconciliation

Upon signed acceptance, this ADR supersedes ADR-0001 decision items 1 and 3 where they call the Git
monorepo canonical. It narrows ADR-0023: Merkle remains the file-change trigger, while the comparison
baseline and committed source snapshot live in Neon. It strengthens rather than reopens ADR-0000's
core rule that latent/vector state is never truth.
