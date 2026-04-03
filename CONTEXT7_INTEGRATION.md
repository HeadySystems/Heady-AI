# Context7 MCP Integration — Deployment Guide

**© 2026 HeadySystems Inc. — Eric Haywood, Founder**

Context7 provides real-time, version-specific library documentation to Heady's coding agents via the Model Context Protocol (MCP). This integration gives every bee in the swarm access to current API docs, code examples, and framework references — eliminating stale documentation hallucinations.

---

## Architecture Overview

```
Sacred Geometry Topology:
  Center(HeadySoul) → Inner(Conductor, Brains, Vinci, AutoSuccess)
    → Middle(JULES, BUILDER, OBSERVER, MURPHY, ATLAS, PYTHIA)
    → Outer(★BRIDGE/Context7★, MUSE, SENTINEL, NOVA, JANITOR, SOPHIA, CIPHER, LENS)
    → Governance(Check, Assure, Aware, Patterns, MC, Risks)

Request Flow:
  Task Description → Pipeline Stage 1 (Context Assembly)
    → extractLibraryNames() → resolveLibrary() via Context7
    → Pipeline Stage 4 (Execution)
    → queryDocs() → inject into code generation context
    → Generated code uses current, accurate API docs
```

| Component | File | Purpose |
|-----------|------|---------|
| Context7Adapter | `src/mcp/context7-adapter.js` | HTTP transport, circuit breaker, LRU cache |
| Context7Bee | `src/bees/context7-bee.js` | HeadyBee for swarm integration |
| Registration | `src/mcp/context7-registration.js` | MCPRouter wiring + enrichCodeContext |
| Pipeline Hook | `src/pipeline/context7-hook.js` | HCFullPipeline stages 1 & 4 |
| Express Service | `HeadySystems_v13/services/context7-mcp/server.js` | Port 3371 REST API |
| Config | `configs/context7.yaml` | Config-oracle pattern |
| Tests | `tests/context7/test-context7-integration.js` | 55 tests (FIB[9]) |

---

## Prerequisites

- Node.js >= 20.0.0
- Context7 Pro plan (https://context7.com)
- Docker (for containerized deployment)

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CONTEXT7_API_KEY` | Yes | Your Context7 Pro API key |
| `CONTEXT7_PORT` | No | Service port (default: 3371) |
| `LOG_LEVEL` | No | Logging level (default: info) |
| `NODE_ENV` | No | Environment (default: production) |

### Getting Your API Key

1. Visit https://context7.com/dashboard
2. Sign in with your Context7 Pro account
3. Navigate to **Settings → API Keys**
4. Click **Generate New Key**
5. Copy the key and set it as `CONTEXT7_API_KEY` in your environment

```bash
# Add to .env or your secret manager
export CONTEXT7_API_KEY="your-api-key-here"
```

---

## File Placement in the Monorepo

Copy each file to its matching path in the Heady monorepo:

```bash
# Core modules
cp src/mcp/context7-adapter.js        $HEADY_REPO/src/mcp/context7-adapter.js
cp src/mcp/context7-registration.js    $HEADY_REPO/src/mcp/context7-registration.js
cp src/bees/context7-bee.js            $HEADY_REPO/src/bees/context7-bee.js
cp src/pipeline/context7-hook.js       $HEADY_REPO/src/pipeline/context7-hook.js

# Configuration
cp configs/context7.yaml               $HEADY_REPO/configs/context7.yaml

# v13 Service
cp -r HeadySystems_v13/services/context7-mcp/ $HEADY_REPO/HeadySystems_v13/services/context7-mcp/

# Tests
cp -r tests/context7/                  $HEADY_REPO/tests/context7/

# MCP config update (merge with existing)
# Review .mcp.json and merge the context7 entry into your existing .mcp.json

# Registry patch
cp 12-heady-registry-context7-patch.json $HEADY_REPO/12-heady-registry-context7-patch.json
```

---

## Docker Build & Run

```bash
cd HeadySystems_v13/services/context7-mcp

# Build
docker build -t heady/context7-mcp:1.0.0 .

# Run
docker run -d \
  --name context7-mcp \
  -p 3371:3371 \
  -e CONTEXT7_API_KEY="${CONTEXT7_API_KEY}" \
  -e NODE_ENV=production \
  --restart unless-stopped \
  heady/context7-mcp:1.0.0
```

### Docker Compose (add to existing compose file)

```yaml
context7-mcp:
  build: ./HeadySystems_v13/services/context7-mcp
  ports:
    - "3371:3371"
  environment:
    - CONTEXT7_API_KEY=${CONTEXT7_API_KEY}
    - NODE_ENV=production
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3371/health"]
    interval: 55s      # FIB[9]
    timeout: 34s       # FIB[8]
    start_period: 13s  # FIB[7]
    retries: 8         # FIB[6]
```

---

## Health Check Verification

After deployment, verify the service is healthy:

```bash
# Check health endpoint
curl -s http://localhost:3371/health | jq .

# Expected response:
# {
#   "service": "context7-mcp",
#   "version": "1.0.0",
#   "status": "healthy",
#   "coherence": 0.882,
#   "phi_compliance": true,
#   "sacred_geometry": { "layer": "Outer", "node": "BRIDGE", "pool": "Warm" },
#   "context7": { "status": "connected", "endpoint": "https://mcp.context7.com/mcp" },
#   "caches": { "libraries": {...}, "docs": {...} },
#   "circuit_breaker": { "state": "closed", "failures": 0 }
# }

# Test library resolution
curl -s -X POST http://localhost:3371/resolve \
  -H 'Content-Type: application/json' \
  -d '{"libraryName": "express"}' | jq .

# Test doc query
curl -s -X POST http://localhost:3371/query \
  -H 'Content-Type: application/json' \
  -d '{"libraryId": "/lib/express/latest", "tokens": 377}' | jq .

# Test enrichment
curl -s -X POST http://localhost:3371/enrich \
  -H 'Content-Type: application/json' \
  -d '{"taskDescription": "Build an Express API with cors and helmet middleware"}' | jq .

# Check stats
curl -s http://localhost:3371/stats | jq .
```

---

## Running Tests

```bash
# From the monorepo root
node tests/context7/test-context7-integration.js

# Expected output: 55 passed, 0 failed (55 total)
# Target: ≥ 55 tests (FIB[9])
# Phi compliance: VERIFIED
```

---

## How CSL Routing Directs Doc-Lookup Intents to Context7

The MCPRouter uses Continuous Semantic Logic to route requests. When Context7 is registered:

1. **`registerContext7(router)`** calls `router.registerServer('context7', {...})` with capabilities like `documentation`, `library-reference`, `api-docs`, etc.

2. The router builds a **composite semantic vector** for Context7 via `CSL.consensus_superposition()` from the capability keywords.

3. When a task arrives, the router computes `multi_resonance` between the task vector and all registered server vectors.

4. If the resonance with Context7's vector passes the `soft_gate` (threshold: CSL_GATES.MEDIUM = 0.809) and `risk_gate`, the task routes to Context7.

5. Tasks involving documentation lookup, API reference, or library examples will naturally resonate with Context7's capability vector and route automatically — no explicit rules needed.

```javascript
// In your startup code:
const { registerContext7 } = require('./src/mcp/context7-registration');
const router = require('./src/mcp/mcp-router');

registerContext7(router);
// Context7 is now discoverable via CSL semantic routing
```

---

## How the Pipeline Hook Enriches Code Generation Tasks

The `context7PipelineHook` integrates with HCFullPipeline at two stages:

### Stage 1 — Context Assembly
- Scans the task description for library references (import/require patterns)
- Pre-resolves each library name to a Context7 ID via `resolveLibrary()`
- Caches resolved IDs for use in Stage 4
- CSL-gated: only triggers when `resonance >= 0.809` (MEDIUM gate)

### Stage 4 — Execution
- If the task involves code generation (detected by keywords: generate, create, build, implement, etc.)
- Queries Context7 for documentation of each pre-resolved library
- Scores relevance of each doc chunk via CSL `soft_gate`
- Injects enriched docs into `pipelineContext.executionContext.context7Docs`
- Enforces token budget: max 98,700 tokens (FIB[15] * 100) per pipeline run

```javascript
// Wire into HCFullPipeline:
const { context7PipelineHook } = require('./src/pipeline/context7-hook');

pipeline.use(context7PipelineHook);
// Now every code generation task automatically gets current library docs
```

---

## How to Use Context7Bee Directly from Swarm Code

The Context7Bee follows the standard BaseHeadyBee lifecycle:

```javascript
const { Context7Bee } = require('./src/bees/context7-bee');

// 1. Create the bee
const bee = new Context7Bee({
  apiKey: process.env.CONTEXT7_API_KEY,
  // tier defaults to 'high', or override
});

// 2. Spawn — register with BeeRegistry
await bee.spawn(registry);

// 3. Initialize — start heartbeat
await bee.initialize();

// 4. Execute — resolve a library
const resolveResult = await bee.execute({
  taskType: 'resolve',
  libraryName: 'next.js',
});
// => { taskType: 'resolve', libraryName: 'next.js', result: { libraryId: '...' } }

// 5. Execute — query documentation
const queryResult = await bee.execute({
  taskType: 'query',
  libraryId: resolveResult.result.libraryId,
  maxTokens: 377,  // FIB[13] — default
});
// => { taskType: 'query', libraryId: '...', tokens: 377, result: { content: '...' } }

// 6. Report metrics to OBSERVER
await bee.report(observerClient);

// 7. Retire gracefully (55s drain period)
await bee.retire(registry);
```

### CSL Intent Gating

Context7Bee will automatically decline tasks where the intent vector doesn't resonate with its capability vector:

```javascript
// If you provide an intentVector, the bee checks resonance first
const result = await bee.execute({
  taskType: 'resolve',
  libraryName: 'express',
  intentVector: taskEmbedding,  // 384D vector
});

// If resonance < 0.809 (MEDIUM), returns { declined: true, resonance: 0.xxx }
// This lets the swarm route documentation tasks to Context7Bee and other tasks elsewhere
```

---

## Phi-Math Constants Reference

All configuration values derive from the golden ratio:

| Constant | Value | Derivation |
|----------|-------|------------|
| PHI | 1.618033988749895 | Golden Ratio |
| PSI | 0.618033988749895 | 1/PHI |
| Library cache max | 89 | FIB[10] |
| Library cache TTL | 377,000ms | FIB[14] * 1000 |
| Doc cache max | 21 | FIB[8] |
| Doc cache TTL | 233,000ms | FIB[12] * 1000 |
| Circuit breaker max failures | 8 | FIB[6] |
| Circuit breaker reset | 55,000ms | FIB[9] * 1000 |
| Half-open max attempts | 3 | FIB[4] |
| Backoff base | 800ms | FIB[6] * 100 |
| Backoff max | 8,900ms | FIB[10] * 100 |
| Max tokens per run | 98,700 | FIB[15] * 100 |
| Max tokens per lib | 14,400 | FIB[11] * 100 |
| Max libraries per task | 13 | FIB[7] |
| Enrichment threshold | 0.809 | CSL_GATES.MEDIUM |
| Service port | 3371 | Next in sequence |
| Heartbeat interval | 55,000ms | FIB[9] * 1000 |
| Retire drain | 55,000ms | FIB[9] * 1000 |

---

## Troubleshooting

### Circuit Breaker Open
If health shows `circuit_breaker.state: "open"`:
- Check `CONTEXT7_API_KEY` is valid and not expired
- Verify https://mcp.context7.com/mcp is reachable
- Wait for automatic reset (55 seconds) or restart the service

### Low Coherence Score
If `coherence < 0.809`:
- High error rate or latency from Context7 API
- Check network connectivity and API key validity
- Review `/stats` for latency percentiles

### Cache Not Warming
If `caches.libraries.size: 0` after multiple requests:
- Ensure requests are hitting the service (check `/stats`)
- Library cache TTL is ~6.28 minutes; doc cache is ~3.88 minutes
- Verify Context7 API returns valid responses

---

*HeadySystems Inc. — Sacred Geometry v4.0 — Phi Compliance Verified*
