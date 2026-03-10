# Heady™ Sovereign AI Latent Operating System v5.0

**Author**: Eric Haywood — HeadySystems Inc.  
**Contact**: eric@headyconnection.org  
**License**: Proprietary — HeadySystems Inc.

## Architecture

Heady operates as a living organism in 384-dimensional vector space. Every component,
agent, and configuration maps to an embedding vector. Relationships are measured by
cosine similarity. The system self-heals through continuous coherence monitoring.

### Sacred Geometry Foundation

All numeric values derive from phi (φ ≈ 1.618) and Fibonacci sequences.
Zero magic numbers. Every constant traces to the golden ratio.

### Core Systems

| System | Description | Files |
|--------|-------------|-------|
| Phi-Math Foundation | All constants, thresholds, sequences | `shared/phi-math.js` |
| Colab Pro+ Layer | 3 GPU runtimes (Alpha, Beta, Gamma) | `src/colab/` |
| Liquid Node Mesh | Dynamic self-organizing node topology | `src/liquid/` |
| HeadyBee Swarm | 24-domain agent worker system | `src/bees/` |
| HeadyConductor | Central orchestration with 21-stage pipeline | `src/orchestration/` |
| Auth Server | httpOnly cookie sessions, Firebase Auth | `src/services/auth/` |
| Notification | SSE, WebSocket, Webhook delivery | `src/services/notification/` |
| Analytics | Real-time event pipeline | `src/services/analytics/` |
| Scheduler | Phi-timed job scheduling | `src/services/scheduler/` |

### Infrastructure

- **50+ services** on ports 3310-3396
- **Docker Compose** with Envoy mTLS gateway
- **PostgreSQL + pgvector** (384-dim, HNSW M=21, ef=89)
- **NATS JetStream** for async messaging
- **Redis** for caching (LRU, 512MB)
- **Prometheus + Grafana** for monitoring
- **OpenTelemetry** for distributed tracing
- **GitHub Actions** 5-stage CI/CD pipeline

### 9 Websites

All routed through Envoy gateway:
- headyme.com (3371)
- headysystems.com (3372)
- heady-ai.com (3373)
- headyos.com (3374)
- headyconnection.org (3375)
- headyconnection.com (3376)
- headyex.com (3377)
- headyfinance.com (3378)
- admin.headysystems.com (3379)

## Quick Start

```bash
# Start all services
docker compose -f infrastructure/docker/docker-compose.yml up -d

# Check health
curl http://localhost:3360/health

# View Grafana dashboard
open http://localhost:3364
```

## Key Phi Values

| Constant | Value | Usage |
|----------|-------|-------|
| φ | 1.618 | Golden ratio — all scaling |
| ψ | 0.618 | Conjugate — weights, thresholds |
| CSL CRITICAL | 0.927 | Near-certain alignment |
| CSL HIGH | 0.882 | Strong alignment |
| CSL MEDIUM | 0.809 | Moderate alignment |
| CSL LOW | 0.691 | Weak alignment |
| CSL MINIMUM | 0.500 | Noise floor |

## GCP Configuration

- **Project**: gen-lang-client-0920560496
- **Region**: us-east1
- **Cloudflare Account**: 8b1fa38f282c691423c6399247d53323
- **GitHub**: HeadyMe
