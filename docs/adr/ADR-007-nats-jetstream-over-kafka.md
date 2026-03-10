   # ADR-007: NATS JetStream over Kafka

   **Status:** Accepted
   **Date:** 2026-01-15
   **Author:** Eric Haywood
   **Heady Systems Inc. — Sacred Geometry v4.0**

   ## Problem

   Which message broker for async service communication

   ## Decision

   NATS JetStream for lightweight, high-performance async messaging

   ## Consequences

- Domain-scoped subjects: heady.memory.*, heady.inference.*, heady.agents.*
- JetStream provides durable delivery with dead letter queues
- Dead letter policy: after phi^3 (4) retries, move to heady.dlq.*
- Lighter operational overhead than Kafka for our scale
- Max message size: 377KB (fib(14) * 1024)
- Dedup window: 21s (fib(8))
- Trade-off: Less ecosystem than Kafka, but simpler ops and lower resource usage

   ---
   *© 2026 HeadySystems Inc. — 51 Provisional Patents*
