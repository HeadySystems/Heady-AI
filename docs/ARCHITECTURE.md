# Heady™ Architecture Reference

> Version 3.2.2 — Codename: Aether
> © HeadySystems Inc.

---

## System Overview

Heady is a multi-agent AI operating system with 20 specialized intelligence nodes,
federated liquid routing, Sacred Geometry orchestration, and self-healing resilience.

```
┌─────────────────────────────────────────────────────────┐
│                    HEADY PLATFORM v3.2.2                │
├─────────────────┬───────────────────┬───────────────────┤
│   Cloud Run     │  Cloudflare Edge  │  HuggingFace      │
│   heady-manager │  heady-edge-proxy │  heady-ai          │
│   heady-mcp     │  heady-edge-node  │  heady-demo        │
├─────────────────┴───────────────────┴───────────────────┤
│                 SHARED FOUNDATION                       │
│   phi-math.js │ csl-engine.js │ sacred-geometry.js      │
├─────────────────────────────────────────────────────────┤
│                 ORCHESTRATION                           │
│   conductor.js │ bee-factory.js │ backpressure.js       │
├─────────────────────────────────────────────────────────┤
│                 RESILIENCE LAYER                        │
│   circuit-breaker.js │ exponential-backoff.js           │
│   bulkhead-isolation.js │ graceful-shutdown.js          │
├─────────────────────────────────────────────────────────┤
│                 MEMORY & CONTEXT                        │
│   vector-memory.js │ embedding-router.js                │
│   context-window-manager.js                             │
├─────────────────────────────────────────────────────────┤
│                 OBSERVABILITY                           │
│   structured-logger.js │ health-registry.js             │
│   coherence-monitor.js                                  │
├─────────────────────────────────────────────────────────┤
│              20 AI NODES (Cognitive Layer)              │
│   Arranged in Sacred Geometry ring topology:            │
│   Central: HeadySoul                                    │
│   Inner: HeadyBrains, HeadyConductor, HeadyVinci       │
│   Middle: JULES, BUILDER, ATLAS, NOVA, Lens, Story     │
│   Outer: Scientist, MC, Pattern, Critique, SASHA...    │
│   Governance: HeadyQA, HeadyCheck, HeadyRisk           │
└─────────────────────────────────────────────────────────┘
```

---

## Foundation Layer (shared/)

### phi-math.js — The "No Magic Numbers" Module

Every constant in the system derives from φ = (1+√5)/2 ≈ 1.618.

| Function | Purpose |
|---|---|
| `fib(n)` | Fibonacci number with memoization |
| `phiThreshold(level)` | CSL gate thresholds: MINIMUM→CRITICAL |
| `phiBackoff(attempt)` | φ-exponential retry delays with ψ² jitter |
| `phiFusionWeights(n)` | N-factor scoring weights summing to 1 |
| `poolAllocation(total)` | Fibonacci-ratio 5-pool resource split |
| `phiTokenBudgets(base)` | Tiered context window token budgets |
| `cslGate(value, cos)` | Sigmoid soft gate on cosine alignment |
| `pressureLevel(value)` | Map utilization → NOMINAL/ELEVATED/HIGH/CRITICAL |

### csl-engine.js — Continuous Semantic Logic

Geometric AI gates replacing discrete boolean logic. All operations work on
unit vectors in ℝ³⁸⁴.

| Gate | Formula | Interpretation |
|---|---|---|
| AND | cos(a,b) | Semantic alignment |
| OR | normalize(a+b) | Soft semantic union |
| NOT | a - proj_b(a) | Orthogonal negation |
| IMPLY | proj_b(a) | Component in direction of b |
| XOR | exclusive components | What's unique to each |
| CONSENSUS | Σ(wᵢ·vᵢ) normalized | Weighted agent agreement |
| GATE | value × σ((cos-τ)/T) | Soft sigmoid gating |

Also includes HDC/VSA operations (BIND, BUNDLE, PERMUTE) and
cosine-similarity MoE routing.

### sacred-geometry.js — Orchestration Topology

Defines the 5-ring node topology, coherence scoring, pool scheduling,
UI aesthetic constants (typography, spacing, colors, timing), and
bee worker limits — all derived from φ.

---

## Resilience Layer (src/resilience/)

### circuit-breaker.js

Three-state circuit breaker: CLOSED → OPEN → HALF_OPEN

- Phi-backoff between reset attempts (1s → 1.618s → 2.618s → ...)
- Google SRE adaptive throttling (K = φ multiplier)
- CSL-gated error rate threshold (trips at ψ ≈ 0.618 error rate)
- Fibonacci-sized sliding window (fib(9) = 34 seconds)

### exponential-backoff.js

- Pre-built retriers: `fast` (3×500ms), `standard` (5×1s), `patient` (8×2s), `persistent` (13×1s)
- AbortSignal support for cancellation
- Configurable retry predicates

### bulkhead-isolation.js

- Concurrency-limited execution pools (fib(8) = 21 default)
- Queued overflow with timeout (fib(13) = 233 queue depth)
- Phi-scaled pressure reporting (NOMINAL/ELEVATED/HIGH/CRITICAL)
- BulkheadRegistry for managing multiple named bulkheads

---

## Memory & Context (src/memory/, src/context/)

### vector-memory.js — RAM-First 384D Vector Memory

- Capacity: fib(20) = 6,765 entries in RAM
- Semantic search via cosine similarity (CSL AND gate)
- Phi-weighted eviction scoring (importance 0.486, recency 0.300, relevance 0.214)
- Semantic deduplication above CSL_THRESHOLDS.DEDUP (≈ 0.955)
- Optional pgvector persistence fallback

### embedding-router.js — Multi-Provider Routing

- Supports Nomic, Jina, Cohere, Voyage, OpenAI, local Ollama
- Circuit breaker per provider with failover
- LRU cache: fib(20) = 6,765 entries, 1-hour TTL
- Phi-weighted provider scoring: success rate (0.486) × latency (0.300) × cost (0.214)
- MRL truncation for dimensionality reduction

### context-window-manager.js — Tiered Context

| Tier | Budget | Purpose |
|---|---|---|
| working | 8,192 tokens | Immediate task context |
| session | ~21,450 tokens | Current conversation |
| memory | ~56,131 tokens | Long-term memory |
| artifacts | ~146,920 tokens | Documents and files |

- Automatic LLM compression when tier exceeds ψ (61.8%) utilization
- Context capsules for inter-agent transfer
- Phi-weighted eviction scoring

---

## Orchestration (src/orchestration/)

### conductor.js — Central Task Dispatch

Routes tasks to the best AI node using CSL cosine scoring against
node capability embeddings. Manages Hot/Warm/Cold pool scheduling.

- Concurrency: fib(9) = 34 parallel tasks
- Queue: fib(14) = 377 pending tasks
- CSL-based node selection (embed task description → cosine against capabilities)
- Automatic retry with phi-backoff

### bee-factory.js — Dynamic Worker Spawning

Ephemeral workers with lifecycle: spawn → init → execute → report → terminate

- Max concurrent: fib(8) = 21 bees
- Queue depth: fib(13) = 233 pending spawns
- Per-bee timeout: fib(9) × 1000 = 34 seconds
- Priority-sorted queue with type instance limits
- Registry capacity: fib(10) = 55 bee types

### backpressure.js — Overload Management

- Google SRE adaptive throttling (K = φ)
- Semantic deduplication via cosine similarity
- Phi-weighted priority scoring (criticality × urgency × recency)
- Criticality-based load shedding (drops low-priority items under HIGH/CRITICAL pressure)
- Upstream backpressure signal propagation

---

## Observability (src/observability/)

### structured-logger.js

- JSON structured logging for Cloud Run / GCP Cloud Logging
- Correlation IDs, trace context (OpenTelemetry compatible)
- Ring buffer: fib(17) = 1,597 entries in memory
- Child loggers with inherited context
- GCP severity mapping (TRACE→DEBUG, WARN→WARNING, FATAL→CRITICAL)

### health-registry.js

- K8s-compatible probes: liveness, readiness, startup
- Weighted health aggregation (critical components can veto)
- Express route handlers included
- Auto-check interval: φ³ × 1000 ≈ 4,236ms

### coherence-monitor.js

- Continuous drift detection across 20-node topology
- Drift/recovery event callbacks for self-healing integration
- Trend analysis (IMPROVING/STABLE/DECLINING)
- History: fib(10) = 55 snapshots

---

## Lifecycle (src/lifecycle/)

### graceful-shutdown.js

LIFO cleanup stack. Components register in boot order; shutdown
executes in reverse.

- Force-kill timeout: fib(9) × 1000 = 34 seconds
- Auto-registers SIGTERM, SIGINT, uncaughtException, unhandledRejection
- Per-handler timeout with critical flag
- Deterministic, auditable shutdown sequence

---

## Configuration (configs/)

Three consolidated YAML files replace 90+ scattered configs:

| File | Purpose |
|---|---|
| `system.yaml` | All runtime, resilience, memory, observability, security |
| `domains.yaml` | Complete domain routing, Cloud Run, Cloudflare, HuggingFace |
| `sacred-geometry.yaml` | Node topology, capabilities, UI aesthetics, coherence |

---

## Design Principles

1. **No Magic Numbers** — Every constant derives from φ
2. **CSL > Boolean** — Continuous gates replace if/else
3. **RAM-First Memory** — Vector memory in RAM, database is backup
4. **Zero Localhost** — Everything uses branded Heady domains
5. **Determinism** — Every action is reproducible and auditable
6. **Self-Healing** — Drift detection triggers automatic recovery
7. **Sacred Geometry** — Ring topology governs node placement and resource allocation

---

> ⚡ Made with 💜 Love by the HeadySystems™ & HeadyConnection™ Team
> Sacred Geometry :: Organic Systems :: Breathing Interfaces
