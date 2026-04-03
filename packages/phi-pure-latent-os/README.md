# φ-Pure Latent OS — Production Implementation

**© 2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL.**

Production-grade implementation across 15 technology domains for the Heady sovereign AI platform. Every constant derives from φ (golden ratio). Zero magic numbers. Zero stubs.

## Architecture

```
phi-pure-latent-os/
├── shared/              # φ-math foundation, logger, health checks
├── mcp-server/          # MCP Streamable HTTP (2025-11-25 spec)
├── cloudflare-edge/     # Worker + DO rate limiter + R2 + Queues + Firebase JWT
├── redis-streams/       # XAUTOCLAIM consumer + DLQ + Fibonacci backoff
├── neon-pgvector/       # Hybrid search (HNSW + RRF) + migrations
├── pinecone-ops/        # Batch ops + pgvector↔Pinecone sync
├── observability/       # Sentry v8 (native OTel) + tracing + metrics
├── vertex-ai/           # @google/genai migration (replaces deprecated SDK)
├── runtime/             # PM2 ecosystem + Pino config
├── vector-ops/          # Arithmetic + temporal decay + UMAP
├── security/            # CSP nonce injection middleware
├── drupal-sdc/          # Drupal 11 Single Directory Component
├── colab-bridge/        # Python MCP bridge for Colab GPU
└── ci/                  # pnpm catalogs + Turborepo + GitHub Actions
```

## Technology Domains

| # | Domain | Module | Key Pattern |
|---|--------|--------|-------------|
| 1 | MCP Server | `mcp-server/` | Streamable HTTP, Tool annotations, outputSchema, Tasks primitive, OAuth 2.1 |
| 2 | Cloudflare Edge | `cloudflare-edge/` | DO rate limiter, R2, Queues+DLQ, Firebase JWT at edge, Workers AI |
| 3 | Redis Streams | `redis-streams/` | XAUTOCLAIM two-phase (antirez), DLQ after 8 attempts, Fibonacci backoff |
| 4 | Neon pgvector | `neon-pgvector/` | HNSW (m=24, ef=128), RRF hybrid search, -pooler endpoint |
| 5 | Pinecone | `pinecone-ops/` | Batch upsert/query/delete, bidirectional sync |
| 6 | Sentry v8 | `observability/` | Native OTel (no @sentry/opentelemetry), PII scrubbing |
| 7 | OpenTelemetry | `observability/` | Custom spans, Fibonacci histogram buckets, baggage propagation |
| 8 | CI/CD | `ci/` | pnpm catalogs, Turborepo --affected, dorny/paths-filter |
| 9 | Vertex AI | `vertex-ai/` | @google/genai (not deprecated @google-cloud/vertexai), circuit breaker |
| 10 | PM2 Runtime | `runtime/` | Cluster mode, Fibonacci timeouts, GCP-compatible logging |
| 11 | Vector Ops | `vector-ops/` | Arithmetic, temporal decay (0.618×sim + 0.382×recency), UMAP |
| 12 | Drupal SDC | `drupal-sdc/` | Single Directory Component, Sacred Geometry spacing |
| 13 | CSP | `security/` | Nonce injection, full CSP header, Report-To |
| 14 | Colab Bridge | `colab-bridge/` | Python FastAPI, GPU detection, batch embedding |

## φ-Math Constants

All constants derive from the golden ratio (φ ≈ 1.618):

- **CSL Thresholds**: CRITICAL=0.927, HIGH=0.882, MEDIUM=0.809, LOW=0.691, MINIMUM=0.500
- **Fibonacci Sequence**: 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987
- **Pool Allocation**: Hot=34%, Warm=21%, Cold=13%, Reserve=8%, Governance=5%
- **Backoff**: φ-exponential (1s → 1.618s → 2.618s → 4.236s) with ±38.2% jitter
- **Dedup Threshold**: 0.972 (semantic identity)

## Quick Start

```bash
# Install dependencies
pnpm install

# Run database migration
pnpm migrate

# Start development
pnpm dev:mcp        # MCP server
pnpm dev:worker     # Redis consumer

# Production via PM2
pnpm start

# Deploy Cloudflare Worker
pnpm deploy:edge
```

## Environment Variables

See `.env.example` for all required configuration. Zero localhost references — all URLs come from environment.

## SDK Versions (pinned in pnpm catalogs)

| Package | Version | Notes |
|---------|---------|-------|
| `@modelcontextprotocol/sdk` | ^1.27.1 | Streamable HTTP transport |
| `@google/genai` | ^1.0.0 | Replaces deprecated `@google-cloud/vertexai` |
| `@sentry/node` | ^8.52.0 | Native OpenTelemetry |
| `ioredis` | ^5.6.0 | Redis Streams + XAUTOCLAIM |
| `@pinecone-database/pinecone` | ^4.1.0 | Batch operations |
| `@neondatabase/serverless` | ^1.0.0 | Neon pooler driver |
| `pino` | ^9.6.0 | GCP-compatible structured logging |
| `zod` | ^3.24.0 | Schema validation |

## HeadySystems Domains (CORS whitelist)

headyme.com · headysystems.com · headyconnection.org · headybuddy.org · headymcp.com · headyio.com · headybot.com · headyapi.com · heady-ai.com
