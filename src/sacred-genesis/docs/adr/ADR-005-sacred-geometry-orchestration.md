# ADR-005: Sacred Geometry Orchestration Topology

## Status
Accepted

## Date
2025-12-15

## Context
The Heady platform orchestrates 30+ AI nodes across five conceptual rings (Central Hub, Inner Ring, Middle Ring, Outer Ring, Governance Shell). As the node count grows toward the 10,000-bee scale target, the orchestration topology must provide efficient routing, fair resource allocation, clear authority hierarchies, and aesthetically coherent UI representations. Traditional flat or tree-based orchestration topologies become unwieldy at scale and do not encode the natural relationships between node capabilities.

## Decision
We adopt Sacred Geometry as the organizing topology for all node placement, resource allocation, authority hierarchies, and UI composition. The topology uses concentric rings with the golden ratio governing inter-ring relationships, Fibonacci sequences for resource allocation ratios, and cosine similarity for coherence measurement between nodes.

HeadySoul occupies the central origin point as the awareness and values layer. The Inner Ring (HeadyBrains, HeadyConductor, HeadyVinci) handles orchestration, reasoning, and planning. The Middle Ring (JULES, BUILDER, OBSERVER, MURPHY, ATLAS, PYTHIA) handles execution. The Outer Ring (BRIDGE, MUSE, SENTINEL, NOVA, JANITOR, SOPHIA, CIPHER, LENS) provides specialized capabilities. The Governance Shell (HeadyCheck, HeadyAssure, HeadyAware, HeadyPatterns, HeadyMC, HeadyRisk) ensures quality, compliance, and risk management.

Resource allocation follows Fibonacci ratios: Hot pool 34%, Warm pool 21%, Cold pool 13%, Reserve 8%, Governance 5%. These ratios are derived from phiResourceWeights(5) and maintain phi-geometric proportionality regardless of total resource scaling.

## Consequences

### Benefits
The concentric ring topology naturally encodes authority relationships (inner rings have more system influence) and communication patterns (nodes communicate primarily within their ring and with adjacent rings). Fibonacci resource allocation provides mathematically optimal distribution that prevents both resource starvation and waste. The UI representation maps directly to the orchestration topology, creating visual coherence between what operators see and how the system actually behaves.

### Risks
The geometric topology may not perfectly map to all orchestration scenarios. Some cross-ring communication patterns may require shortcuts that break the clean ring structure. We accept this as necessary pragmatism while maintaining the topology as the default organizational principle.

### Related ADRs
ADR-002 (phi-math foundation), ADR-006 (self-healing lifecycle)
