# ADR-0044: Sacred Geometry Node Topology (Ring Layout)

**Status:** Proposed — ⚠️ **conflicts with Accepted ADR-0032; founder resolution required**
**Date:** 2026-08-04
**Deciders:** Eric Haywood (HeadySystems Inc.)
**Strength of Acceptance:** ⭐⭐ (Held — do not accept until the ADR-0032 conflict is resolved)

> **Provenance:** rewritten from legacy `docs/ADR/0015-sacred-geometry-node-topology.md`
> (`e911513b`), ported at founder direction.
>
> ⚠️ **ARCHITECTURAL CONFLICT — read first.** This ADR's fixed concentric-ring roster of
> named services **directly conflicts** with Accepted **`ADR-0032` (field & agent waves)**,
> which replaced fixed topology with *"one substrate, ephemeral localized cognition"* —
> ephemeral waves carrying per-wave `resource budget`/`ttl`, not a permanent ring of named
> agents (JULES/MURPHY/ATLAS…). It is recorded here for provenance and founder decision; it
> is **not** accepted, precisely because two Accepted ADRs cannot both govern topology.

## Context

Legacy needed a principled model for how agents/services/infra relate. The Sacred Geometry
layout — concentric rings assigned by function, ring → resource/latency/escalation — was
implemented but never formally adopted in an ADR.

## Decision (as recorded in legacy — held pending 0032 reconciliation)

Services placed in rings by function; ring assignment determines resource pool, latency
budget, and escalation path:

| Ring | Services | Pool | Max latency |
|------|----------|------|-------------|
| Center | HeadySoul (CSL Engine) | Hot 34% | φ¹×1000 = 1618ms |
| Inner | Brain, Conductor, Vinci | Hot 34% | φ¹×1000 = 1618ms |
| Middle | JULES, BUILDER, OBSERVER, MURPHY, ATLAS, PYTHIA | Warm 21% | φ³×1000 = 4236ms |
| Outer | BRIDGE, MUSE, SENTINEL, NOVA, JANITOR, SOPHIA, CIPHER, LENS | Cold 13% | φ⁵×1000 = 11090ms |
| Governance | HeadyCheck, HeadyAssure, HeadyAware, HeadyPatterns, HeadyMC, HeadyRisk | 5% | — |
| Reserve | Burst capacity | 8% | — |

## Reconciliation options (founder to choose)

1. **Reject / keep superseded (recommended):** `ADR-0032` governs; the surviving piece —
   the φ-**layer** responsibilities (Governance/Center/Inner/Ops) — already lives in
   `ADR-0037` (heady-manager decomposition). Mark this `Superseded by ADR-0032`.
2. **Re-adopt rings:** if fixed rings are wanted back, this must **explicitly supersede
   ADR-0032**, and the named legacy roster must be re-mapped to rebuild's actual services.
3. **Overlay:** keep waves (0032) as runtime; use rings only as a *documentation* metaphor
   (no runtime binding). Then this ADR is descriptive, not governing.

## Consequences (legacy, retained for record)

**Positive:** self-documenting topology; ring-derived resource allocation; geometric
escalation paths; patent-relevant Sacred Geometry claim; topology maps generatable from
ring assignments.

**Negative:** ring reclassification becomes contentious at scale; Fibonacci pool
percentages (34+21+13+8+5 = 81%) leave 19% reserve by design; new service types may not fit
existing ring semantics — **and, in rebuild, fixed rings contradict the agent-waves model.**

## References

- Legacy source: `docs/ADR/0015-sacred-geometry-node-topology.md` @ `e911513b`
- Conflicting Accepted ADR: `docs/adr/0032-field-and-agent-waves.md`
- Surviving layer metaphor: `docs/adr/0037-heady-manager-decomposition.md`
