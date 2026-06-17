# ADR-0020: Inter-Agent & Swarm Event Bus

- **Status:** Accepted (2026-06-15)
- **Deciders:** Eric Anthony Haywood

## Context

The system orchestrates 17 swarms and 197 HeadyBees (24 swarm-domain worker-config variants) that must communicate, pass state, and hand off tasks seamlessly. While `pgmq` handles scheduled outbox tasks, real-time agent stigmergy requires high-throughput, typed pub/sub.

## Decision

1. **NATS (`heady-event-bus`)** is the canonical inter-agent communication layer.
2. All agent actions and observations are published as typed events with wildcard routing (e.g., `agent.coder.*`).
3. Redis Pub/Sub is explicitly rejected for inter-agent routing due to lack of message persistence and weaker wildcard routing semantics compared to NATS.
4. `pgmq` remains the authority for durable, scheduled, database-transactional tasks.

## Consequences

- (+) Extremely lightweight, high-performance messaging layer.
- (+) Native support for hierarchical topics perfectly matches the swarm taxonomy.
- (−) Introduces NATS as an additional operational dependency alongside Redis and Postgres.

## Reconciliation (v2, 2026-06-15 — see R8)

**Scoped:** NATS/`heady-event-bus` is permitted as a **best-effort, in-flight** inter-agent/stigmergy
transport only. The **durable cross-boundary write path is the transactional outbox (`pgmq`) + Cloudflare
Queues** (ADR-0002) — NATS is **never** authoritative and never the write path. Redis Streams may also
carry best-effort task distribution. See `docs/compendium/07-transforms-midi-creative.md` §T8 and R8.
