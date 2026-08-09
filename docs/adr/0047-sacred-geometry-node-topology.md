# ADR-0047: Sacred Geometry Node Topology

- **Status:** Accepted (2025-12-15, legacy corpus) · Transferred to canonical corpus 2026-08-09
- **Deciders:** Eric Anthony Haywood

## Context

The Heady platform orchestrates 30+ AI nodes across five conceptual rings. Agent coordination
requires a principled topology for node placement, resource allocation, and coherence measurement.
As the node count grows, the orchestration topology must provide efficient routing, fair resource
allocation, clear authority hierarchies, and aesthetically coherent UI representations.

## Decision

**Sacred Geometry is the organizing topology** for all node placement, resource allocation, authority
hierarchies, and UI composition. The topology uses concentric rings, with the golden ratio governing
inter-ring relationships and Fibonacci sequences governing resource allocation ratios.

Ring structure (legacy node roster as recorded at decision time):

| Layer | Role | Members (legacy roster) |
|---|---|---|
| Central Hub | Awareness, values — the origin point | HeadySoul |
| Inner Ring | Orchestration | HeadyBrains, HeadyConductor, HeadyVinci |
| Middle Ring | Execution | JULES, BUILDER, OBSERVER, MURPHY, ATLAS, PYTHIA |
| Outer Ring | Specialized capabilities | BRIDGE, MUSE, SENTINEL, NOVA, JANITOR, SOPHIA |
| Governance Shell | Quality and compliance | HeadyCheck, HeadyAssure, HeadyAware, HeadyPatterns |

Resource allocation follows Fibonacci ratios: **Hot 34% · Warm 21% · Cold 13% · Reserve 8% ·
Governance 5%**.

Operating rules:

1. Every component has a defined geometric position (ring + placement).
2. Coherence is measured via cosine similarity between position vectors.
3. Routing follows the shortest geometric path.
4. New nodes must be placed in the appropriate ring.

## Consequences

- (+) The concentric-ring topology naturally encodes authority relationships and communication
  patterns.
- (+) Fibonacci resource allocation provides a mathematically consistent distribution in the same
  number system as the φ-math foundation (ADR-0042).
- (−) The geometric topology may not perfectly map to all orchestration scenarios; necessary
  pragmatism is accepted while maintaining the topology as the default organizational principle.

## Reconciliation (2026-08-09 transfer)

- **This ADR is the missing root** that existing canonical references hang from: the layer
  assignments from this topology are consumed by **ADR-0033** (brand/domain ring layers) and
  **ADR-0037** (heady-manager decomposition module mapping), while canonical **ADR-0019** consumes it
  only as CSS design tokens ("raw Vanilla CSS with Sacred Geometry tokens"). Those consumers cited a
  topology whose foundational decision had never been transferred; this record closes that gap.
- **The ring/layer structure is the durable decision; the node roster is era-specific.** The legacy
  member names above are preserved faithfully as the roster at decision time; rebuild consumers bind
  to the layers (hub / inner / middle / outer / governance shell) and the allocation ratios, not to
  the legacy node names.
- **External-language guardrail (per ADR-0032's context):** all topology language is strictly
  architectural — geometric placement, authority encoding, and allocation ratios. It carries no
  consciousness, sentience, or mysticism claims, and must never be marketed as such.
- The two legacy sources were merged: the `adrs/005` record supplies the ring membership table and
  the four operating rules (position, cosine coherence, shortest-path routing, ring placement); the
  `adr/ADR-005` record supplies the date, the scale context (30+ nodes, five rings), the
  φ-governed inter-ring relationships, and the benefits/risks analysis including the accepted
  pragmatism clause. No substantive constraint was dropped.

## Provenance

- Sources: `/home/headyme/_archive/Heady/docs/adrs/005-sacred-geometry-topology.md` (Accepted,
  undated) and `/home/headyme/_archive/Heady/docs/adr/ADR-005-sacred-geometry-orchestration.md`
  (Accepted 2025-12-15).
- Canonical consumers: ADR-0019 (CSS design tokens only), ADR-0033 (brand/domain ring layers),
  ADR-0037 (heady-manager decomposition module mapping); external-language guardrail per ADR-0032.
- Transferred into the canonical corpus 2026-08-09; the originals remain in place in the archive.
