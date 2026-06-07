<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: docs/api/api-api-reference.md                                                    ║
<!-- ║  LAYER: docs                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# Heady API Reference — Quick Reference

## Author
Eric Haywood / HeadySystems Inc. — 51 Provisional Patents

## Infrastructure Services

### Envoy Proxy (3310)
All external traffic enters through Envoy.

### Consul (8500)
- `GET /v1/health/service/:name` — Service health
- `GET /v1/catalog/services` — All registered services

## Authentication

### auth-session-server (3338)
- `POST /api/auth/login` — Login with email/password
- `GET /api/auth/validate` — Validate session cookie
- `POST /api/auth/refresh` — Refresh token rotation
- `POST /api/auth/logout` — Revoke session
- `POST /api/auth/authorize` — Check authorization
- `GET /api/oauth/authorize` — OAuth2 PKCE authorize
- `POST /api/oauth/token` — OAuth2 PKCE token exchange

## Intelligence Layer

### heady-brain (3311), heady-brains (3312), heady-infer (3313)
Core AI processing endpoints

### ai-router (3314)
- `POST /api/route` — Route request to optimal AI provider

### search-service (3326)
- `POST /api/search` — Hybrid BM25+vector search
- `GET /api/search/autocomplete?q=prefix` — Autocomplete suggestions
- `POST /api/search/index` — Index a document

### heady-embed (3321)
- `POST /api/embed` — Generate embeddings

### heady-memory (3322)
- `POST /api/memory/store` — Store vector memory
- `POST /api/memory/search` — Search vector memory

## Orchestration

### heady-conductor (3319)
- `POST /api/route` — Route task to optimal node
- `GET /api/pipeline/status` — Pipeline status

### scheduler-service (3363)
- `POST /api/jobs` — Schedule a new job
- `GET /api/jobs` — List jobs
- `GET /api/jobs/:id` — Get job details
- `GET /api/jobs/dead-letter` — Dead letter queue

## Data & Analytics

### analytics-service (3352)
- `POST /api/analytics/events` — Ingest event
- `POST /api/analytics/events/batch` — Batch ingest
- `POST /api/analytics/metrics` — Record metric point
- `GET /api/analytics/aggregate?name=X&window=5m` — Aggregate metrics
- `GET /api/analytics/coherence` — System coherence scores

### billing-service (3353)
- `GET /api/billing/plans` — Pricing plans
- `POST /api/billing/usage` — Record usage
- `GET /api/billing/usage/summary?userId=X` — Usage summary
- `GET /api/billing/credits?userId=X` — Credit balance
- `POST /api/billing/credits/add` — Add credits
- `GET /api/billing/audit?userId=X` — Billing audit trail
- `POST /api/billing/webhook` — Stripe webhook

## Notifications

### notification-service (3345)
- `POST /api/notifications/send` — Send notification
- `POST /api/notifications/batch` — Batch send
- `POST /api/notifications/digest/flush` — Flush digest

## GPU Compute

### colab-gateway (3360)
- `POST /api/workload/submit` — Submit GPU workload
- `GET /api/runtimes` — List Colab runtimes
- `POST /api/runtimes/heartbeat` — Runtime heartbeat
- `GET /api/queue/status` — Queue depths

## Asset Management

### asset-pipeline (3365)
- `POST /api/assets` — Upload asset
- `GET /api/assets` — List assets
- `GET /api/assets/:id` — Get asset details
- `POST /api/assets/process` — Process asset
- `GET /api/cache/policies` — Cache policies

### migration-service (3364)
- `POST /api/migrations` — Register migration
- `POST /api/migrations/plan` — Plan migration
- `POST /api/migrations/execute` — Execute migration
- `GET /api/migrations/status` — Migration status
- `GET /api/migrations/audit` — Migration audit log
