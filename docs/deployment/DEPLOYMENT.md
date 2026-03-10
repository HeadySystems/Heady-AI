# Heady™ Deployment Guide v4.0.0
## Author: Eric Haywood / HeadySystems Inc.

## Prerequisites

- Docker + Docker Compose v2
- Node.js 20+ (for local development)
- PostgreSQL 16 with pgvector extension
- Redis 7+
- NATS 2.10+ with JetStream
- 3x Google Colab Pro+ memberships

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/HeadyMe/heady-pre-production.git
cd heady-pre-production

# 2. Copy environment template
cp .env.example .env
# Edit .env with your actual secrets (JWT keys, API keys, etc.)

# 3. Start all 67 services
docker-compose up -d

# 4. Verify health
curl http://localhost:3316/health

# 5. Access admin dashboard
open https://admin.headysystems.com
```

## Environment Variables

See `.env.example` for the complete list. Critical variables:

```
JWT_PRIVATE_KEY=       # RS256 private key for token signing
JWT_PUBLIC_KEY=        # RS256 public key for token verification
DB_PASSWORD=           # PostgreSQL password
REDIS_PASSWORD=        # Redis password
NATS_TOKEN=            # NATS authentication token
STRIPE_SECRET_KEY=     # Billing integration
COLAB_RUNTIME_1_URL=   # Colab Pro+ runtime 1 WebSocket URL
COLAB_RUNTIME_2_URL=   # Colab Pro+ runtime 2 WebSocket URL
COLAB_RUNTIME_3_URL=   # Colab Pro+ runtime 3 WebSocket URL
ALLOWED_ORIGINS=       # Comma-separated CORS origins
```

## Colab Pro+ Setup

HeadyOS uses 3 Colab Pro+ runtimes as the GPU compute layer:

1. **Runtime 1 — Embedding Worker**: Generates 384D embeddings using nomic-embed-text-v1.5
2. **Runtime 2 — Inference Worker**: Runs local model inference (Gemma, Llama)
3. **Runtime 3 — Training Worker**: Fine-tuning, LoRA adaptation, evaluation

Each runtime runs a Python notebook that connects back to the Colab Gateway
(colab-gateway service) via WebSocket JSON-RPC 2.0 bridge.

## Cloudflare Deployment

1. Deploy static sites to Cloudflare Pages (9 websites)
2. Deploy Workers for edge inference and routing
3. Configure KV namespaces for session and config data
4. Set up Durable Objects for WebSocket management

## GCP Cloud Run

1. Build and push Docker images to Artifact Registry
2. Deploy services to Cloud Run with env vars from Secret Manager
3. Configure VPC connector for private service communication
4. Set up Cloud SQL for managed PostgreSQL with pgvector

## Monitoring

- All services emit structured JSON logs to stdout/stderr
- Health endpoints: GET /health, /healthz, /readyz on every service
- Metrics: GET /metrics on api-gateway for aggregate stats
- Consul UI: http://consul:8500 for service health overview
