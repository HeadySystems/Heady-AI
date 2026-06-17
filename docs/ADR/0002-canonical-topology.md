# ADR-0002: Canonical Deployment Topology — Cloudflare Edge + Cloud Run Origin
**Date:** 2025-06-01 | **Status:** Accepted | **Author:** Eric Haywood

## Context

The rebuild required a definitive answer on where compute lives. Options ranged from
pure-origin (Cloud Run only), pure-edge (Cloudflare Workers only), to a hybrid split.
Edge-only is constrained by Cloudflare Workers CPU limits (~50ms CPU time) and cold
Durable Object state limits. Origin-only loses global latency benefits for AI routing.

HeadyMCP is publicly positioned as an edge-native MCP surface, requiring stateful
session support at the edge for IDE connections that must persist across requests.

## Decision

Adopt a strict two-tier topology:

| Tier | Platform | Responsibilities |
|------|----------|-----------------|
| Edge | Cloudflare Workers + Durable Objects | MCP ingress, provider racing, auth validation, Vectorize cache, rate limiting, SSE/WebSocket relay |
| Origin | Google Cloud Run (us-east1) | HCFullPipeline execution, LLM orchestration, Neon pgvector writes, heavy compute |

All ingress flows **edge → origin**. Origin never handles public traffic directly.

## Consequences

### Positive
- Sub-10ms routing decisions happen at the edge closest to the user
- Cloudflare Durable Objects provide stateful MCP sessions without origin round-trips
- Cloud Run handles burst auto-scaling for heavy AI workloads independently of edge
- GCP Project `gen-lang-client-0920560496` in `us-east1` is the canonical origin region
- Cloudflare account `8b1fa38f282c691423c6399247d53323` is the canonical edge tenant

### Negative
- Two deployment targets increase operational complexity
- Edge-to-origin latency (~20–40ms) is an irreducible floor for origin-bound requests
- Cloudflare Workers CPU budget constraints require offloading any operation > 50ms CPU

## Alternatives Considered

- **AWS Lambda@Edge + ECS**: rejected — vendor lock-in, higher cost, no Durable Objects equivalent
- **Cloudflare Workers only**: rejected — insufficient CPU budget for pipeline execution
- **Cloud Run only**: rejected — global latency unacceptable for real-time MCP/IDE flows
