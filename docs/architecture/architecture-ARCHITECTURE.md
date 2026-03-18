# Heady™ Architecture Guide v4.0.0
## Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents

## Overview

Heady is a **Liquid Latent Operating System** — software that lives in vector space.
Every component exists as an embedding in 384-dimensional space. Topology is dynamic.
Architecture is alive and self-healing.

## Five-Layer Architecture

### Layer 1: Edge (Cloudflare)
- **Workers**: Sub-50ms global inference, request routing, edge caching
- **KV**: Distributed key-value for hot config and session data
- **Durable Objects**: Persistent WebSocket connections for real-time streams
- **Pages**: Static asset hosting for all 9 Heady websites

### Layer 2: Gateway (Envoy + Consul + NATS)
- **Envoy Proxy**: L7 routing to all 67 microservices, TLS termination, circuit breaking
- **Consul**: Service discovery, health checking, config distribution
- **NATS JetStream**: Event backbone for inter-service communication
- **API Gateway** (port 3316): Central entry point with rate limiting, auth verification

### Layer 3: Execution (Cloud Run + Colab Pro+)
- **Cloud Run**: Containerized microservices with auto-scaling
- **Colab Pro+ Cluster**: 3 GPU runtimes for embedding, inference, and training
- **Model Router**: CSL-based routing across Claude, GPT-4o, Gemini, Groq

### Layer 4: Memory (PostgreSQL + pgvector + Redis)
- **PostgreSQL + pgvector**: 384D vector storage with HNSW index
- **Redis**: Hot cache layer with Fibonacci-sized TTLs
- **RAM-First**: Vector memory lives in RAM for zero-latency access
- **3D Projection**: Phi-spiral projection from 384D to navigable 3D space

### Layer 5: Observability (Structured JSON + Health Probes)
- **Structured JSON Logging**: Every service emits JSON logs with correlation IDs
- **Health Endpoints**: /health, /healthz, /readyz on every service
- **Metrics**: Request latency, error rates, pool utilization, coherence scores
- **Audit Trail**: Cryptographic hash chain for immutable audit logging

## Service Port Map

| Service | Port | Layer | Protocol |
|---------|------|-------|----------|
| api-gateway | 3316 | Gateway | HTTP/REST |
| vector-memory | 3320 | Memory | HTTP/REST |
| csl-engine | 3322 | Execution | HTTP/REST |
| conductor | 3324 | Execution | HTTP/REST |
| search-service | 3326 | Execution | HTTP/REST |
| auth-session-server | 3338 | Security | HTTP/REST |
| notification-service | 3345 | Communication | HTTP/REST |
| analytics-service | 3352 | Observability | HTTP/REST |
| billing-service | 3353 | Business | HTTP/REST |
| scheduler-service | 3363 | Execution | HTTP/REST |
| migration-service | 3364 | Infrastructure | HTTP/REST |
| asset-pipeline | 3365 | Execution | HTTP/REST |
| PostgreSQL | 5432 | Memory | PostgreSQL |
| Redis | 6379 | Memory | Redis |
| NATS | 4222 | Gateway | NATS |
| Consul | 8500 | Gateway | HTTP |
| Envoy | 8080 | Gateway | HTTP |
| PgBouncer | 6432 | Memory | PostgreSQL |

## Mathematical Foundation

Every numeric constant in the system is derived from φ (1.618...) or Fibonacci:

- **Spacing**: Fibonacci sequence [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144...]
- **Thresholds**: φ-harmonic levels (0.500, 0.691, 0.809, 0.882, 0.927)
- **Timing**: φ-backoff (1000ms, 1618ms, 2618ms, 4236ms...)
- **Pool Sizing**: Fibonacci (min: 2, max: 21, idle: 5)
- **Resource Allocation**: φ-geometric (Hot: 38.7%, Warm: 23.9%, Cold: 14.8%, Reserve: 9.2%, Gov: 5.7%)

## Cognitive Architecture

Seven parallel reasoning layers process every task:

1. **Wisdom (OWL)**: First principles, historical context, "why behind the why"
2. **Awareness (EAGLE)**: 360° situational awareness across all 17 swarms
3. **Creativity (DOLPHIN)**: Lateral thinking, elegant novel solutions
4. **Multiplicity (RABBIT)**: 5+ angles, variations, contingencies
5. **Thoroughness (ANT)**: Zero-skip guarantee, identical quality at scale
6. **Memory (ELEPHANT)**: Perfect recall across massive codebases
7. **Architecture (BEAVER)**: Methodical construction, tests alongside code

## Self-Healing Cycle

1. Monitor → Continuous cosine similarity between current and expected state
2. Detect → Semantic drift when coherence drops below 0.809 (CSL MEDIUM)
3. Alert → HeadySoul notified of coherence violation
4. Diagnose → HeadyAnalyze + HeadyPatterns identify root cause
5. Heal → HeadyMaintenance applies corrective action
6. Verify → HeadyCheck confirms restoration
7. Learn → HeadyPatterns records incident for future prevention
