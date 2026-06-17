# ADR-0015: Sacred Geometry Node Topology as Canonical Orchestration Layout
**Date:** 2026-06-17 | **Status:** Accepted | **Author:** Eric Haywood

## Context

The rebuild needed a principled model for how agents, services, and infrastructure
components relate to each other. Ad-hoc service graphs produce unmaintainable
spaghetti topologies as the system grows past ~20 services. The Sacred Geometry
layout — concentric rings assigned by function — was implemented across the codebase
but never formally adopted as the canonical model in an ADR.

## Decision

The Sacred Geometry topology is the canonical layout for all Heady services and agents.
Services are placed in rings by function; ring assignment determines resource allocation,
latency expectations, and escalation paths.

| Ring | Services | Resource Pool | Max Latency |
|------|---------|---------------|------------|
| Center | HeadySoul (CSL Engine) | Hot 34% | φ¹×1000 = 1618ms |
| Inner | Brain, Conductor, Vinci | Hot 34% | φ¹×1000 = 1618ms |
| Middle | JULES, BUILDER, OBSERVER, MURPHY, ATLAS, PYTHIA | Warm 21% | φ³×1000 = 4236ms |
| Outer | BRIDGE, MUSE, SENTINEL, NOVA, JANITOR, SOPHIA, CIPHER, LENS | Cold 13% | φ⁵×1000 = 11090ms |
| Governance | HeadyCheck, HeadyAssure, HeadyAware, HeadyPatterns, HeadyMC, HeadyRisk | 5% | — |
| Reserve | Burst capacity | 8% | — |

Ring assignments are defined in `SPEC.md` and `configs/liquid-microservice-architecture.yaml`.
No service is added to the system without a ring assignment.

## Consequences

### Positive
- Topology is self-documenting: any engineer can immediately understand a service's role by its ring
- Resource allocations derive from ring assignment — no per-service tuning needed
- Escalation paths follow ring geometry: Inner → Center for critical decisions
- Sacred Geometry is a patent-relevant novel claim in Heady's IP portfolio
- Visual representations (topology maps) are directly generatable from ring assignments

### Negative
- Ring assignments can become contentious as services grow — governance process needed for reclassification
- Fibonacci resource percentages (34%+21%+13%+8%+5% = 81%) leave 19% unallocated by design (reserve headroom)
- New service types may not fit cleanly into existing ring semantics

## Alternatives Considered

- **Flat service mesh**: rejected — no principled resource allocation or escalation model
- **Kubernetes namespace-based grouping**: rejected — loses the geometric/semantic meaning
- **Domain-driven ring assignment**: considered as an overlay — may be added as a future enhancement
