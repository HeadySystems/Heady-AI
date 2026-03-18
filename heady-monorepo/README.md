<!-- STATUS BANNER — do not remove -->
> [![Status: MIRROR](https://img.shields.io/badge/repo--status-MIRROR-blue)](https://github.com/HeadyAI/Heady)
> **This is a MIRROR** of the canonical source at [HeadyAI/Heady](https://github.com/HeadyAI/Heady). Do not open PRs here — contribute to the canonical repo.

# Heady™ AI Platform — Monorepo v3.1.0

> Autonomous multi-agent AI operating system with 20 specialized intelligence nodes,
> federated liquid routing, and post-quantum security.

**© 2026 Heady™Systems Inc. — PROPRIETARY AND CONFIDENTIAL**

---

## Architecture

```
heady-manager.js          ← Thin orchestrator shell (10 boot phases)
├── Phase 0: env-schema    ← Fail-fast environment validation
├── Phase 1: config-globals ← Event bus, MIDI bus, secrets manager
├── Phase 2: middleware-stack ← CORS, helmet, rate limiting, site renderer
├── Phase 3: auth-engine   ← HeadyAuth + OAuth 2.1 + RBAC
├── Phase 4: vector-stack  ← 3D vector memory + pipeline + federation
├── Phase 5: engine-wiring ← MC scheduler, pattern engine, auto-success
├── Phase 6: pipeline-wiring ← HCFP 12-stage pipeline + self-healing
├── Phase 7: service-registry ← 40+ services via try/require
├── Phase 8: inline-routes ← Health, pulse, CSL gates, telemetry
├── Phase 9: voice-relay   ← WebSocket voice transcription relay
└── Phase 10: server-boot  ← HTTP/HTTPS + WebSocket + listen
```

### Key Systems

| System | Description |
|--------|-------------|
| **Sacred Geometry** | Fibonacci resource allocation (34% Hot, 21% Warm, 13% Cold, 8% Reserve, 5% Governance) |
| **φ-Backoff** | Golden Ratio (φ=1.618) exponential backoff: 1s→1.6s→2.6s→4.2s→6.9s→11.1s→17.9s→29s |
| **3D Vector Memory** | 384D embeddings with PCA-lite 3D projection, 8-octant spatial sharding, 5 Fibonacci shards |
| **Graph RAG** | Entity-relationship edges alongside embeddings for multi-hop reasoning |
| **HCFullPipeline** | 12-stage: INTAKE→TRIAGE→MONTE_CARLO→ARENA→JUDGE→APPROVE→EXECUTE→VERIFY→RECEIPT |
| **Bee Factory** | 24 domains, 197 workers, `createBee()` + `spawnBee()` pattern |
| **Circuit Breaker** | CLOSED→OPEN→HALF_OPEN for 16 critical services |
| **LLM Router** | Multi-provider failover: Anthropic, OpenAI, Google, Groq, Perplexity, Local |
| **MCP Server** | JSON-RPC + SSE transport, 40+ tools |
| **Self-Healing** | Drift detection → diagnosis → heal → verify → learn cycle |

### Module Map (457 JS files across 30+ directories)

```
src/
├── core/          # heady-server, heady-yaml, heady-env
├── bootstrap/     # 11 boot phase modules
├── config/        # global, env-schema, domains, errors, index
├── resilience/    # circuit-breaker, exponential-backoff, pool, rate-limiter, cache, retry, auto-heal
├── memory/        # 11 vector memory modules
├── orchestration/ # 27 files: conductor, swarm, buddy, self-awareness
├── mcp/           # 11 files: MCP server, router, SSE transport, tool registry
├── auth/          # 12 files: OAuth 2.1, OIDC, RBAC, multi-provider
├── pipeline/      # pipeline-core, infra, pools
├── intelligence/  # 16 files: brains, soul, monte-carlo, deep-research
├── providers/     # llm-router, brain-providers, claude-sdk
├── bees/          # 62 files: bee-factory + 59 domain bees
├── routes/        # 56 REST route files
├── services/      # 76 service files
├── middleware/    # 11 middleware files
├── security/      # 10 security files (PQC, mTLS, handshake)
├── observability/ # 9 observability files
├── telemetry/     # 5 telemetry files
└── utils/         # logger, redis-pool
```

---

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- Docker & Docker Compose (for full stack)
- PostgreSQL 16+ with pgvector extension (or Neon Postgres)
- Redis 7+ (or Upstash Redis)

### Local Development

```bash
# 1. Clone and install
git clone https://github.com/HeadyMe/Heady-pre-production.git
cd heady-monorepo
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys and database URL

# 3. Start the server
npm run dev        # nodemon (auto-restart)
# or
npm start          # production mode
```

### Docker (Full Stack)

```bash
# Start full stack: heady-core + postgres + redis
docker-compose up -d

# Development mode (adds pgAdmin + Redis Commander)
docker-compose --profile development up -d

# Production mode (adds nginx)
docker-compose --profile production up -d

# View logs
docker-compose logs -f heady-core

# Stop
docker-compose down
```

### Database Setup

```bash
# Initialize PostgreSQL schema (pgvector required)
psql $DATABASE_URL -f db/schema.sql

# Or via Docker (schema runs automatically on first start)
docker-compose up postgres -d
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Critical | Neon/PostgreSQL connection string |
| `HEADY_API_KEY` | ✅ Critical | Internal API gateway auth |
| `ANTHROPIC_API_KEY` | ⭐ Recommended | Claude AI models |
| `OPENAI_API_KEY` | ⭐ Recommended | GPT-4o models |
| `GEMINI_API_KEY` | ⭐ Recommended | Google Gemini |
| `GROQ_API_KEY` | ⭐ Recommended | Fast inference |
| `PERPLEXITY_API_KEY` | ⭐ Recommended | Research/search |
| `UPSTASH_REDIS_REST_URL` | 💡 Optional | Redis cache |
| `HF_TOKEN` | 💡 Optional | Hugging Face embeddings |
| `STRIPE_SECRET_KEY` | 💡 Optional | Payments |
| `GITHUB_TOKEN` | 💡 Optional | GitHub integration |

See `.env.example` for the complete list.

---

## API Overview

### Health Endpoints

```
GET  /healthz           — Kubernetes liveness probe
GET  /api/health        — Basic health check
GET  /api/pulse         — Full system pulse (version, secrets, CF status)
GET  /health/live       — Detailed liveness (memory, uptime)
```

### Auth Endpoints

```
POST /api/auth/login    — Token-based login
GET  /api/auth/policy   — Current auth policy
GET  /api/services/groups — Service groups by tier
```

### Vector Memory

```
GET  /api/memory/search  — Semantic search
POST /api/memory/store   — Store a memory
GET  /api/memory/stats   — Memory statistics
GET  /api/vector/status  — Federation status
```

### Pipeline

```
POST /api/pipeline/run   — Submit pipeline task
GET  /api/pipeline/:id   — Get run status
GET  /api/pipeline/runs  — List recent runs
```

### Resilience

```
GET  /api/resilience/status  — All circuit breakers, caches, pools
GET  /api/resilience/breakers — Circuit breaker states
POST /api/resilience/reset   — Reset a specific breaker
```

### MCP (Model Context Protocol)

```
POST /mcp              — JSON-RPC 2.0 MCP calls
GET  /mcp/sse          — Server-Sent Events transport
GET  /mcp/tools        — List registered tools
```

### System

```
GET  /api/layer         — Active routing layer
POST /api/layer/switch  — Switch routing layer
GET  /api/telemetry/recent — Recent telemetry events
POST /api/csl/resonance — Cosine similarity gate
POST /api/csl/superposition — Vector blend gate
GET  /api/vault/stats   — Vector vault statistics
```

---

## Core Modules

### `src/core/heady-server.js`

Express factory with Sacred Geometry middleware hooks and HeadyWebSocket.

```js
const createApp = require('./src/core/heady-server');
const { HeadyWebSocket } = require('./src/core/heady-server');
const app = createApp();  // Express app with sacred timing + request IDs
const wss = new HeadyWebSocket.Server({ noServer: true });
```

### `src/core/heady-yaml.js`

YAML loader with `${ENV_VAR:default}` interpolation.

```js
const yaml = require('./src/core/heady-yaml');
const config = yaml.loadFile('./configs/remote-resources.yaml');
// ${HEADY_PORT:3301} → '3301' (from env or default)
```

### `src/core/heady-env.js`

Multi-file .env loader.

```js
require('./src/core/heady-env').loadEnv();
// Loads: .env → .env.development → .env.local
```

### `src/resilience/`

```js
const { getBreaker, withBackoff, getCache } = require('./src/resilience');

// Circuit breaker
const breaker = getBreaker('brain');
const result = await breaker.execute(() => callBrainAPI());

// φ-backoff
await withBackoff(() => riskyOperation(), { maxRetries: 5, baseMs: 1000 });

// Cache
const cache = getCache('conductor');
cache.set('key', value, 5000);  // 5s TTL
```

### `src/memory/`

```js
const vectorMemory = require('./src/memory/vector-memory');
vectorMemory.init();

// Store
await vectorMemory.store('Hello world', { source: 'chat', userId: 'u1' });

// Search
const results = await vectorMemory.search('greeting', 10, 0.3);

// Stats
const stats = vectorMemory.getStats();
```

---

## Sacred Geometry

All timing intervals, resource pools, and retry delays use Golden Ratio (φ = 1.618) scaling:

```
φ^1 ≈  1.6s   — Quick pulse
φ^2 ≈  2.6s   — Heartbeat
φ^3 ≈  4.2s   — Resource manager poll
φ^4 ≈  6.9s   — Auto-success cycle
φ^5 ≈ 11.1s   — Swarm heartbeat
φ^6 ≈ 17.9s   — Pattern analysis
φ^8 ≈ 46.9s   — Memory compaction
φ^10 ≈ 122.9s — Full audit
```

Resource pools follow Fibonacci ratios:
- **34%** Hot (high-frequency active)
- **21%** Warm (standby ready)
- **13%** Cold (idle/background)
- **8%**  Reserve (emergency)
- **5%**  Governance (platform overhead)

---

## Deployment

### Cloud Run (GCP)

```bash
# Build and push
gcloud builds submit --tag gcr.io/your-project/heady-systems:3.1.0

# Deploy
gcloud run deploy heady-core \
  --image gcr.io/your-project/heady-systems:3.1.0 \
  --platform managed \
  --region us-central1 \
  --port 3301 \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 1
```

### Cloudflare Pages + Tunnel

```bash
# Set up tunnel
cloudflared tunnel create heady
cloudflared tunnel route dns heady headyme.com

# Start tunnel
cloudflared tunnel run heady
```

---

## Port

**Default: 3301** (override with `PORT` or `HEADY_PORT` env var)

---

## License

UNLICENSED — © 2026 Heady™Systems Inc. All Rights Reserved.
Unauthorized copying, modification, or distribution is strictly prohibited.
