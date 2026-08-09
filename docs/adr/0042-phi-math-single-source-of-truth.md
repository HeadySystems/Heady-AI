# ADR-0042: φ-Math Single Source of Truth

- **Status:** Accepted (2026-03-10, legacy corpus) · Transferred to canonical corpus 2026-08-09
- **Deciders:** Eric Anthony Haywood

## Context

Software systems accumulate magic numbers — arbitrary values like `timeout: 5000`, `maxRetries: 3`,
`cacheSize: 100`, `threshold: 0.85`. Constants like 0.5, 0.7, 100, 500, 1000 appeared inconsistently
across Heady modules with no justification. These values have no mathematical basis, drift across
services, and create invisible coupling when different services use different arbitrary values for
the same concept. Heady requires a unified mathematical foundation that eliminates arbitrary numbers
entirely.

## Decision

All numeric constants derive from **φ (1.6180339887…)**, **ψ = 1/φ (0.6180339887…)**,
**ψ² (0.3819660113…)**, and the **Fibonacci sequence** [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144,
233, 377, 610, 987, …], imported from one canonical shared constants module. Every timeout, cache
size, threshold, retry count, pool size, weight, and interval in the platform is derived from φ-math.

Key derivations:

- **Timeouts:** φⁿ × 1000 ms (1618 ms, 2618 ms, 4236 ms, 6854 ms, …)
- **Cache sizes:** Fibonacci numbers (34, 55, 89, 144, 233, 377, 987)
- **Thresholds:** 1 − ψ^level × 0.5 → 0.500, 0.691, 0.809, 0.882, 0.927 (phiThreshold levels 0–4)
- **Rate limits:** Fibonacci-tiered (34 anonymous, 89 authenticated, 233 enterprise)
- **Backoff:** φ-exponential with ±ψ² jitter (`phiBackoff`), including circuit-breaker recovery timing
- **Feature rollout:** φ-scaled percentages (6.18%, 38.2%, 61.8%, 100%)
- **Weights and resource allocation:** φ-fusion weights and Fibonacci ratios

Compliance target: **100% — no magic numbers allowed.** New modules must import from the shared
φ-math module; constants are named, not raw (`FIB[9]`, not `34`).

## Consequences

- (+) Every constant is auditable and traceable to φ; module compliance can be verified
  programmatically.
- (+) Self-documenting: `FIB[9]` conveys "34, a Fibonacci number" instead of an unexplained literal.
- (+) φ-scaled intervals are mathematically harmonious and prevent thundering herd (unlike round
  numbers that synchronize retries).
- (+) Consistent across services: all services use the same shared φ-math package;
  Sacred Geometry orchestration framework is covered by HeadySystems provisional patents.
- (−) Learning curve: new developers must understand the φ-math foundation.
- (−) Slightly unusual values (`34 req/min` instead of `30 req/min`) may confuse external users.
- (−) Debugging requires knowing the ladder (`FIB[9]=34`) to interpret configs.
- Mitigations: comprehensive README/JSDoc on the φ-math package; developer onboarding covers the
  Sacred Geometry foundation; constants are always named.

## Reconciliation (2026-08-09 transfer)

- **The rebuild's actual carrier is `@heady/phi-math`** at
  `/home/headyme/Heady-AI/packages/phi-math` (entry `src/index.mjs`), exporting `PHI`, `PSI`, `PSI2`,
  `PSI3`, the Fibonacci ladder, threshold/band helpers, `GATE` (`HALT: ψ²`, `EXECUTE: ψ`), and
  `phiBackoffMs`/`phiBackoff`. The legacy sources named two earlier carriers —
  `shared/phi-math-v2.js` and `@heady/phi-math-foundation` — both retired; `@heady/phi-math` is the
  single source of truth. The rule prose in `AGENTS.md`/`CLAUDE.md` still says "`phi-constants.js`";
  that is naming drift for the same decision, and the real module is `@heady/phi-math`.
- **φ-backoff and circuit-breaker scaling are part of this decision's surface:** `phiBackoff()` is
  the canonical retry/backoff primitive (re-exported by `@heady/csl-engine` for consumers), per
  AGENTS.md engineering canon (φ-backoff retries, `FIB[n]` pool sizes, `PHI_7 × 1000` heartbeats).
- **Machine enforcement:** `/home/headyme/Heady-AI/tooling/enforcers/phi-timing.mjs` realizes the
  enforceable slice of Unbreakable Law 8 — no bare numeric millisecond literal as the delay of
  `setTimeout`/`setInterval` in `apps/`/`packages/` sources; timing must derive from
  `packages/phi-math`. Broader magic-number detection remains review-enforced (high false-positive
  rate).
- The two legacy sources were merged: the `adrs/001` record supplies the derivation domains and the
  100% compliance target; the `adr/ADR-002` record supplies the dated decision, the derivation
  tables, and the consequence/mitigation analysis. No substantive constraint was dropped.

## Provenance

- Sources: `/home/headyme/_archive/Heady/docs/adrs/001-phi-math-foundation.md` (Accepted, undated)
  and `/home/headyme/_archive/Heady/docs/adr/ADR-002-phi-scaled-constants.md` (Accepted 2026-03-10).
- Live carrier: `/home/headyme/Heady-AI/packages/phi-math/src/index.mjs` (`@heady/phi-math`).
- Live enforcement: `/home/headyme/Heady-AI/tooling/enforcers/phi-timing.mjs`.
- Transferred into the canonical corpus 2026-08-09; the originals remain in place in the archive.
