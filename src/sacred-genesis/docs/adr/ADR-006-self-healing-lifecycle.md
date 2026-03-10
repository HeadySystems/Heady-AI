# ADR-006: Self-Healing Lifecycle with Semantic Drift Detection

## Status
Accepted

## Date
2026-01-05

## Context
A system with 60+ microservices and 30+ AI nodes will experience component failures, configuration drift, and behavioral changes over time. Manual monitoring and remediation cannot scale to the operational complexity of the Heady platform. The system needs automated detection of degradation and autonomous recovery capabilities that operate within clearly defined safety boundaries.

## Decision
We implement a seven-stage self-healing lifecycle: Monitor (continuous embedding comparison), Detect (semantic drift when cosine similarity drops below phiThreshold(2) = 0.809), Alert (HeadySoul notification), Diagnose (HeadyAnalyze + HeadyPatterns root cause analysis), Heal (HeadyMaintenance + HeadyMaid corrective action), Verify (HeadyCheck + HeadyAssure confirmation), and Learn (HeadyPatterns + HeadyMC incident recording).

Every component registers its embedding in vector memory on startup and implements a heartbeat function that periodically re-embeds and checks for drift. Health endpoints include coherence scores. Components support graceful degradation — when coherence drops, they reduce capability rather than crash.

All healing actions must pass through HeadyCheck before execution. All heals are logged as recovery experiments in HeadyMC (Monte Carlo). Recurring drift in the same component triggers architectural review by HeadySoul.

## Consequences

### Benefits
Automated detection catches degradation that humans would miss until users report problems. The seven-stage pipeline ensures systematic diagnosis before remediation, preventing well-intentioned fixes that create new problems. Monte Carlo simulation of healing strategies before application reduces the risk of corrective actions causing additional harm. The learning stage builds institutional memory that improves future detection and response.

### Risks
Automated healing could mask deeper architectural issues by repeatedly patching symptoms. We mitigate this through the recurring drift escalation mechanism — three healing cycles for the same component within a phi-derived window triggers architectural review. False positive drift detection could trigger unnecessary healing actions, reducing system stability. The phiThreshold(2) = 0.809 threshold provides sufficient sensitivity for genuine drift while filtering noise.

### Related ADRs
ADR-004 (circuit breaker), ADR-005 (Sacred Geometry topology)
