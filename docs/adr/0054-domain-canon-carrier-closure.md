<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ ADR-0054                                                ║
║  Domain canon carrier closure and HeadyFinance succession       ║
║  Made with ❤️ by HeadySystems Inc.                             ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# ADR-0054: Domain Canon Carrier Closure and HeadyFinance Succession

- **Status:** Accepted (2026-08-23)
- **Acceptance:** Founder-signed tag `adr-0054-accepted-dfdd2bc87` (OpenPGP, EDDSA `1050B59E7296C46C26DDF95DA7D2108BB3C6101C` — the key of record; `git tag -v adr-0054-accepted-dfdd2bc87` returns Good signature)
- **Acceptance:** requires the ADR-0030/0031/0032-style ceremony (OpenPGP `git tag -s`, verifiable
  with `git tag -v`). An agent cannot perform this act, and a commit asserting acceptance without it
  is void — see the `91059537a4` → `c48062fc61` incident recorded in `docs/adr/README.md`.
- **Date:** 2026-08-22
- **Deciders:** Eric Haywood (HeadySystems Inc.)
- **Amends if accepted:** ADR-0033 and ADR-0038, and grants a bounded, one-time exception to the
  ADR immutability rule stated in `docs/adr/README.md` (see §Decision)

## Context

ADR-0033 preserves the nine-domain roster accepted on 2026-06-17, while its reconciliation makes
the `domains:` block in `facts.yaml` authoritative for the live roster. ADR-0038 requires a single
machine-readable domain canon and an architectural decision for domain additions, removals, or
business-identity changes. Those accepted records are immutable historical snapshots and must not
be rewritten in place.

The live implementation now needs to record three related changes:

1. `headyfinance.com` succeeds `headytrade.com` as the HeadySystems FinTech advisory brand. The
   product provides risk and signal guidance, defaults to paper mode, and does not execute trades
   or hold customer assets.
2. `headybot.com` and `headylens.com` were already carried by routing surfaces but were absent from
   the canonical roster.
3. Several legitimate domain projections existed without a machine-enforced relationship to the
   canon, allowing roster drift and stale Battle Arena specification dumps.

The implementation touches `facts.yaml`, `configs/domain-architecture.json`, generated domain and
Battle Arena projections, `src/config/domain-registry.js`, `src/config/global.js`, and the coherence
and data-consistency enforcement packages.

## Decision

If accepted:

- The live domain canon recognizes `headyfinance.com` as the successor to `headytrade.com`, with a
  distinct `headyfinance` tenant. References to the retired brand are removed from live code and
  projections.
- **Founder-authorized exception to the ADR immutability rule.** `docs/adr/README.md` states that an
  accepted ADR is "immutable once Accepted — superseded by a new ADR, never edited in place." On
  2026-08-22 the founder ruled that **no surface may carry the retired brand, historical snapshots
  included**, and directed that `headytrade` be removed from the ADR-0033 snapshot table and its
  registry excerpt, and from the frozen legacy `docs/ADR/0019` copy of the same record.
  - This exception is **bounded to the single token `headytrade` → `headyfinance`** in those two
    files. It is not a general licence to edit accepted ADRs, and no other accepted record is
    touched.
  - Nothing about the decision is lost: the succession itself is recorded in this ADR, in each
    amended file's pointer section, and in `facts.yaml` `domains.headyfinance.note`, which carries
    the founder reconciliation of 2026-07-29 that established the successor name.
  - The cost is stated plainly rather than hidden: those two records are no longer byte-identical to
    their accepted-time state, so the "historical ADR evidence remains byte-stable" property claimed
    under §Consequences holds for every accepted record **except** these two, by explicit founder
    ruling. A reader comparing against the 2026-06-17 accepted state should expect this one delta.
- The canon includes `headybot.com` and `headylens.com`. `headylens.com` the vision/OCR domain is
  distinct from the `@heady/headylens` observability package.
- Canon size and delivered-site count remain distinct measurements. The canon contains 16 records;
  the site delivery mesh contains 11 sites.
- Each legitimate projection declares a `sources:` carrier token in `facts.yaml`. A carrier may
  contain only domains present in the canon; it is not required to contain every canonical domain
  because the brand registry remains a separately ratified subset.
- `tooling/coherence/src/domain-guards.mjs` enforces D1 through D7: carrier orphans, bidirectional
  source accuracy, sourceless nodes, status agreement, generated-projection freshness, and Battle
  Arena dump freshness.
- `configs/_generated/domain-roster.json` is the timestamp-free derived roster for consumers. It is
  regenerated only after validation so stale committed output remains detectable.

This proposal has no retroactive acceptance effect. It becomes authoritative only through the
repository's canonical ADR acceptance ceremony; the signed implementation commits alone do not
rewrite or self-ratify accepted ADR history.

## Consequences

### Positive

- Historical ADR evidence remains byte-stable and auditable, with the single bounded exception
  the founder authorized in §Decision (the `headytrade` token in ADR-0033 and legacy ADR-0019).
- Live domain carriers become derived or mechanically checked instead of silently drifting.
- The HeadyFinance succession and two previously orphaned routing domains receive explicit review
  scope.
- Generated projections can fail closed when stale.

### Negative

- The live implementation remains governance-pending until this ADR is accepted.
- Domain additions require both canon metadata and carrier declarations.
- The separately ratified brand subset intentionally cannot be auto-expanded by a code generator.

## Verification

- `node tooling/coherence/src/coherence.mjs all`
- `node --test tooling/coherence/test/domain-guards.test.mjs`
- `pnpm --filter @heady/data-consistency test`
- `pnpm --filter @heady/arena-spec test`
- `pnpm facts:validate`

## Related Decisions

- ADR-0033: Nine-domain brand architecture
- ADR-0038: Canonical machine-readable domain registry file
- ADR-0053: Temporary solo-founder approval quorum proposal (reserved by PR #288)
