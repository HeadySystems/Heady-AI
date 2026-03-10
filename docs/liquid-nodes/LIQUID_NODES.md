# Heady™ Liquid Nodes Architecture v5.0.0

**Author:** Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
**The intelligence layer that makes Heady alive.**

---

## Overview

Liquid Nodes are the self-orchestrating intelligence components that operate in 3D vector space.
They form the "nervous system" of the Heady Latent OS.

## Node Catalog

| Node | Role | File |
|------|------|------|
| HeadyBee Factory | Dynamic agent worker creation (24 domains) | `src/orchestration/bee-factory.ts` |
| HeadySwarm Coordinator | Multi-agent consensus + parallel execution | `src/orchestration/swarm-coordinator.ts` |
| Task Decomposition | DAG construction + topological sort | `src/orchestration/task-decomposition.ts` |
| Semantic Backpressure | SRE throttling + dedup + circuit breaker | `src/orchestration/semantic-backpressure.ts` |
| Self-Healing Lifecycle | State machine + drift + quarantine + respawn | `src/orchestration/self-healing.ts` |
| HeadySoul Governance | 3 Unbreakable Laws + values arbiter | `src/orchestration/heady-soul.ts` |
| HeadyBrains | Context assembly + relevance scoring | `src/orchestration/heady-brains.ts` |
| HeadyAutobiographer | Event logging + narrative + pattern detection | `src/orchestration/heady-autobiographer.ts` |

## Data Flow

```
User Request
  → HeadyBrains (assemble context, score relevance)
  → HeadySoul (governance check — 3 Unbreakable Laws)
  → Task Decomposition (break into subtasks, build DAG)
  → Semantic Backpressure (admission control, dedup, throttle)
  → HeadySwarm (route to bees, execute in parallel)
  → HeadyBee Factory (create/spawn workers per domain)
  → [Execution across services + Colab runtimes]
  → Self-Healing (monitor, detect drift, quarantine, recover)
  → HeadyAutobiographer (record events, detect patterns)
  → Response
```

## HeadyBee Factory

- **24 domains** with default capabilities
- **Persistent bees** for always-on workers (HeadyConductor, HeadyMemory, etc.)
- **Ephemeral bees** spawned per-task, auto-terminated after completion
- **CSL-scored routing** — cosine similarity matching for task-to-bee assignment
- **Coherence tracking** — each bee maintains a coherence score, degraded on failure

## HeadySwarm Coordinator

- **Parallel execution** — max FIB[6]=8 concurrent tasks per batch
- **CSL CONSENSUS** — weighted centroid of result embeddings for multi-agent agreement
- **φ-fusion weights** — phiFusionWeights(N) for N-agent scoring
- **Timeout scaling** — hot: 34s, warm: 144s, cold: 610s (Fibonacci)

## Task Decomposition Engine

- **Max subtasks:** FIB[10] = 55
- **DAG with cycle detection** (DFS)
- **Topological sort** (Kahn's algorithm) into execution layers
- **CSL scoring** for swarm assignment (threshold: CSL_THRESHOLDS.LOW ≈ 0.691)
- **Complexity-to-duration mapping** (Fibonacci-scaled)

## Semantic Backpressure

- **SRE Adaptive Throttle:** P(reject) = max(0, (requests - K×accepts) / (requests+1))
- **K = √5 ≈ 2.236** (naturally derived from φ)
- **Semantic dedup:** cosine >= 0.927 (CSL_THRESHOLDS.CRITICAL)
- **Circuit breaker:** 5 failures → OPEN, 34s recovery, 3 half-open probes
- **Queue:** max depth FIB[13]=233, dedup cache FIB[17]=1597

## Self-Healing Lifecycle

```
healthy → suspect → quarantined → recovering → restored → healthy
                                              → dead (max recovery exceeded)
```

- **Drift threshold:** CSL_THRESHOLDS.MEDIUM ≈ 0.809
- **Quarantine threshold:** CSL_THRESHOLDS.LOW ≈ 0.691
- **Dead threshold:** CSL_THRESHOLDS.MINIMUM ≈ 0.500
- **Max recovery attempts:** FIB[5] = 5
- **φ-backoff** between recovery attempts
- **Attestation** required before restoration

## HeadySoul Governance (3 Unbreakable Laws)

1. **Structural Integrity:** Code compiles, type-safe, module boundaries respected
2. **Semantic Coherence:** Change embedding aligned with design intent (≥ 0.809)
3. **Mission Alignment:** Serves HeadyConnection values (community, equity, empowerment)

## HeadyBrains Context Assembly

- **Token budgets:** working=8192, session=21450, memory=56131, artifacts=146920
- **CSL-gated relevance** scoring for context selection
- **φ-weighted eviction:** importance(0.486) + recency(0.300) + relevance(0.214)
- **Context capsules** for inter-agent transfer

## HeadyAutobiographer

- **Timeline capacity:** FIB[17] = 1597 events
- **10 event categories:** task, decision, discovery, error, recovery, deployment, learning, milestone, collaboration, governance
- **Pattern detection** with φ-scaled strength accumulation
- **Narrative chapters** with auto-generated summaries

---

© 2026 Eric Haywood / HeadySystems Inc.
