# Heady™ Service Catalog v4.0.0

**Author:** Eric Haywood / HeadySystems Inc. — 51 Provisional Patents

---

## Core Services

### API Gateway (Port 3316)
- **Pool:** Hot (34% resources)
- **Dependencies:** All backend services, Consul, Redis
- **Health:** GET /health
- **Features:** Rate limiting (φ-bucketed), JWT validation, request routing, circuit breaker
- **Source:** services/api-gateway/

### Vector Memory Service (Port 3320)
- **Pool:** Hot
- **Dependencies:** PostgreSQL + pgvector, NATS
- **Health:** GET /health
- **Features:** 384D embedding storage, cosine search, HNSW indexing, 3D projection
- **Source:** services/vector-memory-service/

### CSL Engine Service (Port 3322)
- **Pool:** Hot
- **Dependencies:** None (stateless compute)
- **Health:** GET /health
- **Features:** AND (cosine), OR (superposition), NOT (orthogonal projection), IMPLY, XOR, CONSENSUS, GATE
- **Source:** services/csl-engine-service/

### Conductor Service (Port 3324)
- **Pool:** Hot
- **Dependencies:** All node services, NATS
- **Health:** GET /health
- **Features:** HCFullPipeline orchestration, task routing, node registry, pool scheduling
- **Source:** services/conductor-service/

### Search Service (Port 3326)
- **Pool:** Warm
- **Dependencies:** PostgreSQL, Vector Memory
- **Health:** GET /health
- **Features:** Hybrid BM25 + vector search, RRF fusion, reranking
- **Source:** services/search-service/

### Auth Session Server (Port 3338)
- **Pool:** Hot
- **Dependencies:** PostgreSQL, Redis
- **Health:** GET /health
- **Features:** OAuth 2.1 + OIDC, session management, httpOnly cookies, RBAC
- **Source:** services/auth-session-server/

### Notification Service (Port 3345)
- **Pool:** Warm
- **Dependencies:** NATS, external providers
- **Health:** GET /health
- **Features:** Email, SMS, push, webhook notifications with retry
- **Source:** services/notification-service/

### Analytics Service (Port 3352)
- **Pool:** Cold
- **Dependencies:** PostgreSQL, NATS
- **Health:** GET /health
- **Features:** Event tracking, metrics aggregation, dashboard data
- **Source:** services/analytics-service/

### Billing Service (Port 3353)
- **Pool:** Warm
- **Dependencies:** PostgreSQL, Stripe API
- **Health:** GET /health
- **Features:** Subscription management, usage metering, invoicing
- **Source:** services/billing-service/

### Scheduler Service (Port 3363)
- **Pool:** Cold
- **Dependencies:** PostgreSQL, NATS
- **Health:** GET /health
- **Features:** Cron scheduling, φ-interval tasks, pipeline triggers
- **Source:** services/scheduler-service/

### Migration Service (Port 3364)
- **Pool:** Cold
- **Dependencies:** PostgreSQL
- **Health:** GET /health
- **Features:** Schema versioning, rollback, seed data
- **Source:** services/migration-service/

### Asset Pipeline (Port 3365)
- **Pool:** Cold
- **Dependencies:** S3/R2, PostgreSQL
- **Health:** GET /health
- **Features:** File upload, image processing, CDN distribution
- **Source:** services/asset-pipeline/

---

## Infrastructure Services (Docker Compose)

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL + pgvector | 5432 | Primary database with vector extensions |
| PgBouncer | 6432 | Connection pooling (φ-sized pools) |
| Redis | 6379 | Sessions, rate limiting, cache |
| NATS | 4222 | Event streaming, pub/sub |
| Consul | 8500 | Service discovery, health checks |
| Envoy | 9901 | Service mesh proxy, load balancing |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3000 | Dashboards, alerting |

---

## GPU Layer (Colab Pro+ Runtimes)

| Runtime | Role | GPU | Capabilities |
|---------|------|-----|-------------|
| Alpha | Embedding Engine | T4 | 384D/1536D embedding, semantic search, vector ops |
| Beta | Inference Hub | V100 | LLM inference, CSL compute, MoE routing |
| Gamma | Training Forge | A100 | LoRA fine-tuning, RLHF, distillation, quantization |

---

© 2026 Eric Haywood / HeadySystems Inc.
