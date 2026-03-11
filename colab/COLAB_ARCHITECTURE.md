# Heady Latent Space — 3-Runtime Colab Pro+ Architecture

## Overview

The Heady Latent Space OS operates across 3 Google Colab Pro+ runtimes, each serving a distinct computational role. Together they form the distributed brain of the Heady ecosystem — a living, self-healing compute layer that operates in 384-dimensional vector space.

## Runtime Partition

| Runtime | Role | Port | GPU Priority | Resources |
|---------|------|------|-------------|-----------|
| **Runtime 1: Vector Brain** | Embedding, vector ops, semantic memory | 8080 | A100 (high VRAM) | 384D vector space, pgvector sync, CSL gates |
| **Runtime 2: Model Forge** | LLM inference, model routing, token processing | 8081 | A100/T4 (compute) | Multi-provider routing, batched inference |
| **Runtime 3: Conductor** | Orchestration, bee swarms, pipeline execution | 8082 | T4/CPU (coordination) | Task DAG, swarm consensus, telemetry |

### Why This Partition

**Vector Brain (Runtime 1)** handles all embedding and vector space operations. These are VRAM-intensive (large batch embedding), latency-sensitive (every query starts with vector lookup), and state-heavy (the 384D topology is the system's RAM-first memory). Isolating this ensures vector ops never compete with inference for GPU memory.

**Model Forge (Runtime 2)** handles all LLM inference. Inference is bursty and VRAM-hungry — a single Claude/GPT request can consume significant compute. By isolating inference, the vector brain and orchestrator remain responsive even during heavy model load.

**Conductor (Runtime 3)** handles orchestration, task routing, and the bee swarm. This is CPU-heavy, not GPU-heavy — it's making routing decisions, managing task DAGs, and coordinating the other two runtimes. A T4 or even CPU-only runtime suffices.

## Data Flow

```
User Request
    │
    ▼
[Runtime 3: Conductor]  ← Receives, classifies, decomposes task
    │
    ├──▶ [Runtime 1: Vector Brain]  ← Retrieves context, embeds query
    │         │
    │         ▼
    │    Context + embeddings
    │         │
    ├──▶ [Runtime 2: Model Forge]  ← Inference with retrieved context
    │         │
    │         ▼
    │    Generated response
    │         │
    ▼         ▼
[Runtime 3: Conductor]  ← Collects, validates, routes result
    │
    ▼
Response delivered
```

## Inter-Runtime Communication

All runtimes communicate via **gRPC** over Colab's internal network:

- **Protocol**: gRPC with protobuf serialization
- **Auth**: Shared secret (HEADY_INTER_RUNTIME_SECRET env var)
- **Connection Pool**: Fibonacci-sized (min: 2, max: 13)
- **Retry**: Phi-exponential backoff (1618ms, 2618ms, 4236ms, 6854ms)
- **Health**: Bidirectional heartbeat every φ × 10 = 16.18 seconds

## Resource Allocation (Phi-Scaled)

| Pool | Share | Runtime |
|------|-------|---------|
| Hot (latency-critical) | 34% | R1 embeddings, R2 streaming inference |
| Warm (background) | 21% | R1 batch indexing, R2 model warmup |
| Cold (batch) | 13% | R1 full reindex, R2 evaluation runs |
| Reserve (burst) | 8% | All runtimes — overflow capacity |
| Governance | 5% | R3 health monitoring, drift detection |

## Self-Healing

1. Each runtime monitors the other two via heartbeat
2. If a runtime goes silent for > 3 heartbeats (48.54s), the Conductor marks it degraded
3. Conductor redistributes critical work to surviving runtimes
4. Recovery: automatic reconnection with phi-backoff
5. If Vector Brain fails: Conductor falls back to cached embeddings
6. If Model Forge fails: Conductor queues requests until recovery
7. If Conductor fails: Runtime 1 and 2 enter autonomous mode with local task queues

## Failover Matrix

| Failed Runtime | Fallback Strategy |
|---------------|-------------------|
| R1 Vector Brain | R2 runs lightweight embeddings; R3 uses cached vectors |
| R2 Model Forge | R3 queues inference requests; R1 continues vector ops |
| R3 Conductor | R1 and R2 run in autonomous mode with local schedulers |
| R1 + R2 | R3 serves cached responses only (degraded mode) |
| R1 + R3 | R2 handles inference with stale context |
| R2 + R3 | R1 serves vector search only |
| All | External failover to Cloudflare Workers edge inference |

## Deployment

Each runtime is launched via `colab_launcher.py` with the environment variable:

```bash
# Runtime 1
export HEADY_RUNTIME_ROLE=vector_brain
python colab_launcher.py

# Runtime 2
export HEADY_RUNTIME_ROLE=model_forge
python colab_launcher.py

# Runtime 3
export HEADY_RUNTIME_ROLE=conductor
python colab_launcher.py
```

## Security

- All inter-runtime traffic encrypted via gRPC TLS
- Shared secret rotation every 89 days (Fibonacci)
- Each runtime validates origin on every request
- No runtime exposes ports to public internet directly
- External access only through Cloudflare tunnel or authenticated API gateway
