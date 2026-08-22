<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ ADR-0054                                                ║
║  Domain canon carrier closure and HeadyFinance succession       ║
║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# ADR-0054: Domain Canon Carrier Closure and HeadyFinance Succession

- **Status:** Proposed
- **Date:** 2026-08-22
- **Deciders:** Eric Haywood (HeadySystems Inc.)
- **Amends if accepted:** ADR-0033 and ADR-0038

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
  projections while the accepted-time ADR-0033 snapshot remains unchanged.
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

- Historical ADR evidence remains byte-stable and auditable.
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
