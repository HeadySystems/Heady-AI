# ADR-003: Multi-Provider Embedding Router Architecture

## Status
Accepted

## Date
2025-12-01

## Context
The Heady platform generates approximately 384-dimensional embeddings for every document, query, agent state, and configuration element in the system. Embedding quality directly determines the accuracy of CSL routing, vector search relevance, semantic drift detection, and coherence monitoring. Relying on a single embedding provider creates a critical single point of failure — if the provider experiences downtime, raises prices, changes model behavior, or deprecates the model, the entire platform's intelligence layer is compromised.

## Decision
We implement a multi-provider embedding router that intelligently selects between Nomic, Jina, Cohere, Voyage, and local Ollama backends based on a multi-factor scoring system. The router uses phi-weighted fusion of three factors: quality score (weight 0.528), latency score (weight 0.326), and cost score (weight 0.146), derived from phiFusionWeights(3). Circuit breaker isolation prevents a failing provider from cascading failures to others, with phi-exponential backoff (1000ms, 1618ms, 2618ms, 4236ms) for recovery probing.

An LRU cache with phi-derived sizing (fib(20) = 6765 entries) deduplicates repeated embedding requests, reducing provider costs and latency for common queries. MRL (Matryoshka Representation Learning) dimensionality reduction is supported for compact storage scenarios where full 384-dimensional precision is unnecessary.

## Consequences

### Benefits
Provider redundancy eliminates single-point-of-failure risk for the embedding pipeline. The circuit breaker pattern with phi-backoff ensures graceful failover without thundering herd problems. Cost optimization through intelligent provider selection reduces embedding costs by routing bulk operations to cost-effective providers while preserving quality for latency-sensitive requests. The LRU cache eliminates redundant API calls for repeated content, reducing both cost and latency.

### Risks
Different embedding providers produce vectors in different geometric spaces. Switching providers mid-operation could produce inconsistent similarity scores. We mitigate this by normalizing all embeddings to unit vectors and maintaining provider-specific calibration matrices that align vector spaces. Provider scoring may not accurately reflect real-time conditions, leading to suboptimal routing. We mitigate this through continuous health monitoring and adaptive weight adjustment based on observed performance.

### Related ADRs
ADR-001 (CSL engine), ADR-002 (phi-math foundation), ADR-004 (circuit breaker resilience)
