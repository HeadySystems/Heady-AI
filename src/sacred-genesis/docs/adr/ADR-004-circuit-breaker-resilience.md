# ADR-004: Circuit Breaker with Phi-Exponential Backoff

## Status
Accepted

## Date
2025-12-10

## Context
With 60+ microservices communicating through HTTP and event-based protocols, partial failures are inevitable. A single unresponsive service can cascade through dependency chains, creating widespread outages. The system needs a resilience pattern that prevents cascade failures while allowing rapid recovery when services restore health. Traditional fixed-interval retry strategies waste resources during extended outages and create thundering herd problems during recovery.

## Decision
We implement a circuit breaker pattern with three states (CLOSED, OPEN, HALF_OPEN) and phi-exponential backoff for recovery probing. The circuit breaker opens after fib(5) = 5 consecutive failures, enters HALF_OPEN state after a phi-backoff delay, and returns to CLOSED after fib(3) = 2 successful probe requests. Backoff timing follows the phi geometric series: 1000ms, 1618ms, 2618ms, 4236ms, 6854ms, 11090ms, with ±38.2% (psi-squared) jitter to prevent synchronized retry storms.

Bulkhead isolation limits concurrent requests per service to Fibonacci-derived maximums (fib(8) = 21 for Hot pool services, fib(7) = 13 for Warm, fib(6) = 8 for Cold), preventing a slow service from consuming all available connection capacity. The saga orchestrator coordinates multi-service transactions with compensating actions, ensuring that partial failures in multi-step workflows are rolled back cleanly.

## Consequences

### Benefits
Circuit breakers prevent cascade failures by fast-failing requests to known-unhealthy services. Phi-exponential backoff provides mathematically smooth recovery probing that avoids both premature retries and excessive delays. Jitter randomization at psi-squared (38.2%) prevents synchronized retry storms when multiple clients experience the same failure simultaneously. Bulkhead isolation ensures that failures in one service cannot exhaust resources needed by other services.

### Risks
Circuit breakers may prevent legitimate requests during transient network issues. The fib(5) failure threshold provides resilience against temporary glitches while still responding quickly to genuine outages. The HALF_OPEN probe mechanism validates recovery before fully reopening the circuit.

### Related ADRs
ADR-002 (phi-math foundation), ADR-003 (embedding router), ADR-006 (self-healing lifecycle)
