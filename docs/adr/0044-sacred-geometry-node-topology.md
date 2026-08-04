# ADR-0044: Sacred Geometry Resource-Tier & Escalation Overlay (on Agent-Waves)

**Status:** Accepted
**Date:** 2026-08-04
**Accepted:** 2026-08-04 by Eric Haywood (HeadySystems Inc.) — founder ruling resolving the 0044↔0032 topology fork (Option 3, overlay).
**Deciders:** Eric Haywood (HeadySystems Inc.)
**Strength of Acceptance:** ⭐⭐⭐ (Medium — a budgeting/escalation overlay, subordinate to ADR-0032)

> **Provenance:** rewritten from legacy `docs/ADR/0015-sacred-geometry-node-topology.md`
> (`e911513b`). Originally ported as `Proposed` and flagged conflicting with ADR-0032; this
> revision **resolves that conflict** per the founder's Option-3 ruling.

## Decision (the resolution)

**ADR-0032 (agent-waves) governs state and lifecycle. Sacred Geometry survives here only as
a resource-budget + escalation *overlay* — not as a fixed roster of named services.**

Concretely:

1. **Agents remain ephemeral, stateless waves** (`seeded → … → dissolved`) per ADR-0032.
   There is **no permanent ring of named services** (the legacy roster — HeadySoul, JULES,
   MURPHY, ATLAS… — is retired; those names do not bind runtime homes).
2. **The φ-rings become priority/budget tiers.** A Seed's `amplitude` (its resource budget,
   `seed.v1`) is drawn from a φ-scaled tier, and a wave's latency ceiling follows the tier:

   | Tier | Amplitude pool (φ) | Latency ceiling | Typical wave class |
   |------|-------------------:|-----------------|--------------------|
   | Hot | 34% | φ¹×1000 = 1618 ms | CSL-critical reasoning / center-of-mass decisions |
   | Warm | 21% | φ³×1000 = 4236 ms | standard orchestration / build / observe |
   | Cold | 13% | φ⁵×1000 = 11090 ms | background / low-priority excitation |
   | Governance | 5% | — | coherence / policy / audit waves |
   | Reserve | 8% | — | burst headroom |

   (≈81% committed, ≈19% headroom by design — Fibonacci-aligned, no magic numbers.)
3. **Escalation follows the geometry, not a service graph:** a wave may escalate its
   `amplitude` tier inward (Cold → Warm → Hot) under CSL pressure, bounded by the global
   ceiling (ADR-0043) and per-wave `ttl`. Escalation is a **budget promotion**, not a handoff
   to a named service.
4. **Tiers are metadata on the Field, not homes.** Tier assignment is a property of a Seed/wave
   (derived, ephemeral), never a stored position — consistent with ADR-0032's "no positions."

## Reconciliation (no longer conflicts with ADR-0032)

- **Lifecycle/state authority:** ADR-0032 (the Field is sole authority; waves are stateless
  and reconstructible). Unchanged.
- **This ADR contributes only:** the φ-tier budget scale + latency ceilings + inward-escalation
  rule, expressed as `seed.v1.amplitude` classes.
- **Retired:** the legacy fixed named-service roster and permanent ring homes (superseded — they
  contradicted the ephemeral-wave model). The φ-*layer* responsibility split also lives in ADR-0037.

## Decision record — why Option 3 (overlay)

The fork was: rings (fixed named agents) **vs** waves (ephemeral). Only that one axis truly
conflicted; the φ-resource tiers/escalation did not. Option 3 keeps everything load-bearing:

- **Kept from 0032:** statelessness + reconstructibility → crash-proofing, replayability,
  ADR-0000 alignment. (Reversing this — Option 2 — was rejected as an architectural walk-back.)
- **Kept from 0015/0044:** the φ-scaled resource discipline, latency budgets, escalation
  geometry, and the Sacred-Geometry patent framing — re-expressed as budget tiers.
- **Dropped:** the fixed named-agent roster (the only genuinely-conflicting, legacy part).

Trade-off noted honestly: ADR-0032's enforcement is advisory until the native agent loop
(ADR-0016) lands; until then these tiers are a design/budgeting contract via `seed.v1`, enforced
at the boundary, with runtime enforcement arriving with the executor.

## Consequences

**Positive:** waves' crash-proofing + rings' resource discipline coexist with zero contradiction;
the Sacred-Geometry IP framing is preserved as the composition/budget model; tier is a cheap,
derived property of a Seed.

**Negative:** loses the legacy roster's at-a-glance "which service does what" (mitigated — role is
narrated by HeadyLens and derived from the Seed's `intention`); tier tuning needs governance if
pools drift.

## References

- Governs lifecycle/state: `docs/adr/0032-field-and-agent-waves.md` (Seed `amplitude`/`ttl`; `seed.v1`)
- Global ceiling: `docs/adr/0043-runtime-capacity-ceiling.md`
- Layer responsibilities: `docs/adr/0037-heady-manager-decomposition.md`
- Legacy source: `docs/ADR/0015-sacred-geometry-node-topology.md` @ `e911513b`
