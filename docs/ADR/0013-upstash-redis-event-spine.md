# ADR-0013: Upstash Redis as EventSpine — Async Inter-Service Communication
**Date:** 2026-06-17 | **Status:** Accepted | **Author:** Eric Haywood

## Context

The Liquid Microservice Architecture (`configs/liquid-microservice-architecture.yaml`)
specifies an `EventSpine` as the async communication bus between Liquid Nodes.
The rebuild needed to choose between Kafka, Pub/Sub, Redis Streams, and an HTTP
event-dispatch pattern. All Liquid Nodes must implement `onEvent()`/`emitEvent()`.

Upstash Redis Streams was already present in the stack for caching (ADR-0003). Using
it as the EventSpine avoids introducing a second message broker.

## Decision

**Upstash Redis Streams** is the EventSpine for all async Liquid Node communication.
Synchronous request/response flows use direct HTTP (MCP or REST). Redis Streams handles:
- Pipeline stage completion events
- Agent spawn/retire lifecycle events
- Health and metrics flush events
- Cross-service coordination signals

Cache tier (L2) runs on the same Upstash instance with namespace isolation:
- Cache keys: `heady:cache:<domain>:<key>`
- Stream keys: `heady:stream:<service>:<event_type>`

Phi-scaled TTLs: L1 (Cloudflare KV) = 34s, L2 (Upstash) = 89s, L3 (Neon) = 233s.
Pub/sub for real-time bee coordination and pipeline stage events uses Redis Pub/Sub
channels alongside Streams.

## Consequences

### Positive
- Single vendor for both caching and eventing reduces operational surface
- Upstash serverless pricing scales to zero — no idle Redis instance cost
- Redis Streams provide durable, ordered, replayable event history with consumer groups
- φ-scaled TTLs keep cache invalidation consistent with system constants
- Edge-side (Cloudflare KV, L1) is already managed by the Workers platform

### Negative
- Redis Streams are not a full message broker — no DLQ, no exactly-once delivery guarantee
- Upstash free tier limits may constrain development environments under high event volume
- Mixing cache and event stream on one instance creates coupling (namespace discipline required)

## Alternatives Considered

- **Google Cloud Pub/Sub**: rejected — adds GCP dependency, more operational overhead than Upstash serverless
- **Kafka (Confluent/Upstash Kafka)**: considered — rejected for current scale; revisit at >10k events/sec
- **HTTP webhooks between services**: rejected — no replay capability, tight coupling, brittle under load
