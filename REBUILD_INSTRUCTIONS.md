# REBUILD_INSTRUCTIONS.md
# Heady™ Rebuild Stack — Canonical Reference for All Coding Agents and Engineers

<!--
  ╔══════════════════════════════════════════════════════════════════════════╗
  ║  THIS IS THE AUTHORITATIVE DOCUMENT FOR THE HEADY REBUILD ENVIRONMENT.  ║
  ║  Do NOT reference WINDSURF_INSTRUCTIONS.md for infrastructure config.   ║
  ║  That document describes the LEGACY stack and will mislead your agent.  ║
  ╚══════════════════════════════════════════════════════════════════════════╝
-->

> **Version:** 2.0.0 | **Date:** 2026-06-17 | **Author:** Eric Haywood
> **Replaces:** `WINDSURF_INSTRUCTIONS.md` for all infrastructure, database, and deployment config.
> **ADR references:** ADR-0002, ADR-0006, ADR-0007, ADR-0008, ADR-0009, ADR-0011, ADR-0016.

---

## ⚠️ CRITICAL — Legacy Document Warning

> **`WINDSURF_INSTRUCTIONS.md` describes the LEGACY stack.**
>
> Any config, connection string, project ID, region, or service reference in
> `WINDSURF_INSTRUCTIONS.md` is **obsolete for the rebuild**. That document is
> preserved as the authoritative reference for `legacy-main-archive` ONLY.
>
> If you are a coding agent, AI assistant, or engineer:
> - **DO NOT** use `Cloud SQL` — use **Neon Postgres**
> - **DO NOT** deploy to `us-central1` — deploy to **`us-east1`**
> - **DO NOT** use the legacy project ID `heady-prod-609590223909` for new infrastructure
> - **DO NOT** use 9-stage pipeline configs — the canonical pipeline has **21 stages (FULL)**
> - **DO NOT** use `require()` — all modules use **ESM `import`/`export`**
> - **DO NOT** store tokens in `localStorage` — use **httpOnly cookies only**

---

## 1. Identity & Environment

| Field | Value |
|-------|-------|
| Product | Heady™ Latent-Space Operating System |
| Company | HeadySystems Inc. (Colorado C-Corp, EIN 41-3412204) |
| Sister nonprofit | HeadyConnection Inc. (EIN 41-3508351, 501(c)(3) pending) |
| Founder | Eric Haywood, Fort Collins, CO |
| Primary repo | `github.com/headyai/heady-production` |
| Default branch | `main` (rebuild is the current main) |
| Legacy branch | `legacy-main-archive` (read-only) |

---

## 2. Infrastructure Stack — Rebuild Canonical

### 2.1 Database — Neon Postgres (NOT Cloud SQL)

| Field | Legacy (OBSOLETE) | **Rebuild (USE THIS)** |
|-------|------------------|----------------------|
| Engine | Cloud SQL PostgreSQL 16 | **Neon Postgres (serverless)** |
| Region | `us-central1` | **`us-east1`** |
| Project ID | `heady-prod-609590223909` | **Neon project — see Vault** |
| pgvector | Manual extension management | **First-class, pre-installed** |
| Branching | Not available | **Neon branches for migration testing** |
| Scale-to-zero | No (idle cost ~$25/mo) | **Yes — scales to zero** |
| Edge queries | Requires proxy | **Native HTTP driver for Workers** |

**Connection patterns:**

```js
// Cloud Run origin — standard Postgres URL
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);   // postgres://... (from Vault)

// Cloudflare Worker — HTTP driver (no TCP)
import { neon } from '@neondatabase/serverless';
import { Pool } from '@neondatabase/serverless';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
```

**Connection pool sizing (phi-scaled):**

```js
// core/constants/phi.js
export const DB_POOL = {
  hot:     34,   // fib(9)
  warm:    21,   // fib(8)
  cold:    13,   // fib(7)
  reserve:  8,   // fib(6)
};
```

**HNSW index parameters (pgvector):**

```sql
CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 21, ef_construction = 89);   -- fib(8), fib(11)
-- ef_search is set per query tier: CRITICAL=144, HIGH=89, WARM=55
```

**Migration workflow:** Always use Neon branches:

```bash
# Create a branch off production, run migrations, validate, merge
neon branches create --name migration/my-change --parent main
DATABASE_URL=$(neon connection-string migration/my-change) node scripts/migrate.js
# On success:
neon branches delete migration/my-change
```

---

### 2.2 Compute — GCP Cloud Run (us-east1)

| Field | Legacy (OBSOLETE) | **Rebuild (USE THIS)** |
|-------|------------------|----------------------|
| Region | `us-central1` | **`us-east1`** |
| Project | `heady-prod-609590223909` (legacy GCP) | **See Vault for rebuild project** |
| Runtime | Node.js 18 | **Node.js 22 LTS** |
| Framework | Express (`heady-manager.js`) | **Hono on Workers, Express on Cloud Run** |
| Port | 3301 | **3301 (unchanged)** |
| Min instances | 1 | **1 (Hot tier), 0 (Warm/Cold)** |
| Max instances | 13 fib(7) | **13 fib(7) — unchanged** |

**Service tiers (from `liquid-microservice-architecture.yaml`):**

```yaml
hot:   min_instances: 1, max_instances: 13   # fib(7)
warm:  min_instances: 0, max_instances: 8    # fib(6)
cold:  min_instances: 0, max_instances: 5    # fib(5)
```

**Cloud Run deploy command template:**

```bash
gcloud run deploy heady-SERVICE \
  --region us-east1 \
  --platform managed \
  --image gcr.io/PROJECT_ID/heady-SERVICE:TAG \
  --port 3301 \
  --min-instances 1 \
  --max-instances 13 \
  --set-env-vars NODE_ENV=production,HEADY_LOG_PRETTY=false \
  --no-allow-unauthenticated
```

---

### 2.3 Edge — Cloudflare Workers + Durable Objects

| Field | Value |
|-------|-------|
| Account ID | `8b1fa38f282c691423c6399247d53323` |
| Pages project | `heady-*` (per domain) |
| Workers runtime | Hono.js on Cloudflare Workers |
| Durable Objects | Stateful MCP session continuity |
| KV namespaces | L1 cache (TTL = 34s, fib(9)×1s) |
| R2 buckets | Static asset storage |
| AI Gateway | Unified provider routing (see ADR-0004) |
| Vectorize | Edge embedding cache (NOT source of truth — ADR-0003) |

**Edge-to-origin flow:**

```
User → Cloudflare Worker (auth, rate limit, provider race)
              ↓ (miss / pipeline execution)
         Cloud Run :3301 (HCFullPipeline, LLM orchestration)
              ↓
         Neon Postgres us-east1 (pgvector writes)
```

---

### 2.4 Caching — Upstash Redis

| Role | Details |
|------|---------|
| L2 Cache | TTL = 89s (fib(11)) |
| EventSpine | Redis Streams — async Liquid Node communication |
| Pub/Sub | Real-time bee coordination and pipeline events |
| Rate limiting | Sorted sets, sliding window |
| Session store | Backing store for httpOnly session tokens |

**Namespace conventions:**

```
heady:cache:<domain>:<key>       ← L2 cache entries
heady:stream:<service>:<event>   ← EventSpine streams
heady:session:<userId>           ← Session tokens
heady:rate:<ip>:<endpoint>       ← Rate limit windows
```

---

### 2.5 Auth — Firebase + httpOnly Cookies

| Field | Value |
|-------|-------|
| Provider | Firebase Auth (`auth.headysystems.com`) |
| Token storage | **httpOnly cookies ONLY — no localStorage** |
| Access token TTL | 21 minutes (fib(8)) |
| Refresh token TTL | 987 minutes (fib(16)) |
| OAuth providers | 27 (managed by Firebase) |
| Rate limits | Free=8 req/s, Pro=21 req/s, Enterprise=55 req/s (Fibonacci) |
| MCP auth | Bearer token in Authorization header (server-to-server only) |
| WebSocket auth | JWT validated at handshake only |

**Security requirements:**

```js
// ✅ CORRECT — timing-safe comparison
import { timingSafeEqual } from 'node:crypto';
const valid = timingSafeEqual(Buffer.from(a), Buffer.from(b));

// ❌ WRONG — string equality leaks timing info
const valid = tokenA === tokenB;   // DO NOT USE
```

**Open security items (must be resolved before GA):**

- [ ] `heady-manager.js:223` — replace string token comparison with `crypto.timingSafeEqual`
- [ ] `heady-manager.js:142` — remove CORS wildcard `*`, scope to allowed origins only
- [ ] Apply httpOnly, Secure, SameSite=Strict flags to all Set-Cookie responses

---

## 3. Runtime Standards

### 3.1 Module System — ESM Only

```js
// ✅ CORRECT — ESM
import { PHI, FIB } from './core/constants/phi.js';
export default function myModule() {}
export { helper };

// ❌ WRONG — CommonJS (legacy only)
const { PHI } = require('./phi-math.js');   // DO NOT USE
module.exports = { myModule };              // DO NOT USE
```

All files use `.js` extension. No `.ts` files execute at runtime. TypeScript is CI-only for type checking.

### 3.2 Constants — φ-Math, No Magic Numbers

**All** numerical constants derive from `core/constants/phi.js`:

```js
import { PHI, PSI, FIB, CSL, TIMING } from './core/constants/phi.js';

// ✅ CORRECT
setTimeout(handler, TIMING.FAST);          // φ³×1000 = 4236ms
const poolSize = FIB[9];                   // 34
if (score >= CSL.HIGH) { ... }             // 0.882

// ❌ WRONG — magic numbers
setTimeout(handler, 3000);                 // DO NOT USE
const poolSize = 100;                      // DO NOT USE
if (score >= 0.9) { ... }                  // DO NOT USE
```

### 3.3 Logging — Pino Only

```js
// ✅ CORRECT
import { obs } from './heady-observability.js';
obs.logger.info({ service: 'heady-brain', traceId }, 'Pipeline stage complete');

// ❌ WRONG
console.log('Pipeline stage complete');    // DO NOT USE
```

Log schema (every entry must include): `level`, `service`, `traceId`, `spanId`, `msg`, `timestamp`.

### 3.4 Deterministic Execution

```js
// All LLM calls in pipeline/orchestration paths
const response = await llm.complete({
  messages,
  temperature: 0,    // ← mandatory for determinism
  seed: 42,          // ← where provider supports it
});

// SHA-256 receipt for every output
import { createHash } from 'node:crypto';
const receipt = createHash('sha256').update(response.content).digest('hex');
```

---

## 4. Pipeline — 21-Stage HCFullPipeline

The canonical pipeline has **21 stages** (fib(8)). Do not use legacy 9-stage configs.

| Variant | Stages | fib() | Use Case |
|---------|--------|-------|---------|
| FAST | 8 | fib(6) | Low-latency tasks |
| STANDARD | 13 | fib(7) | Normal HCFP |
| **FULL** | **21** | **fib(8)** | **Canonical — complete analysis** |
| ARENA | 15 | — | Multi-model competition |
| LEARNING | 13 | fib(7) | Self-improvement loops |

Stage definitions live in `core/pipeline/stages.js` only.

Bootstrap the full system with one call:

```js
import { createSystem } from './core/index.js';
const system = await createSystem({ env: process.env });
```

---

## 5. Vector Memory

| Layer | Storage | TTL | Purpose |
|-------|---------|-----|---------|
| L1 | Cloudflare KV | 34s | Edge read cache |
| L2 | Upstash Redis | 89s | Hot working set |
| **L3 (source of truth)** | **Neon pgvector** | **persistent** | **All writes go here** |

**Embedding dimensions:** 384D (primary), 1536D (premium).
**DEDUP threshold:** PSI⁶ × 0.5 ≈ 0.972 — above this, embeddings are treated as duplicates.
**Write path:** `agent → Cloud Run → Neon pgvector`.
**Read path (hot):** `agent → Cloudflare Worker → Vectorize` (cache miss falls to Neon).

---

## 6. Sacred Geometry Node Topology

All services have a ring assignment. Resource allocation derives from ring.

| Ring | Resource Pool | Services |
|------|--------------|---------|
| Center | Hot 34% | HeadySoul (CSL Engine) |
| Inner | Hot 34% | Brain, Conductor, Vinci |
| Middle | Warm 21% | JULES, BUILDER, OBSERVER, MURPHY, ATLAS, PYTHIA |
| Outer | Cold 13% | BRIDGE, MUSE, SENTINEL, NOVA, JANITOR, SOPHIA, CIPHER, LENS |
| Governance | 5% | HeadyCheck, HeadyAssure, HeadyAware, HeadyPatterns |
| Reserve | 8% | Burst capacity |

New services must have a ring assignment before deployment (ADR-0015).

---

## 7. Domain Architecture (9 Sites)

| Domain | Type | Stack |
|--------|------|-------|
| headyme.com | Companion / Chat | Cloudflare Pages + Workers |
| headyai.com | Platform / API | Cloud Run + Cloudflare |
| headymcp.com | MCP Gateway | Cloudflare Workers (edge-native) |
| headyapi.com | Public API | Cloudflare + Cloud Run |
| headyweb.com | Micro-frontend portal | Cloudflare Pages |
| headyconnection.org | Nonprofit | Cloudflare Pages |
| headysystems.com | Corporate | Cloudflare Pages |
| headybuddy.com | Companion app | Cloudflare Workers |
| headycoin.com | Token economics | Cloudflare + Cloud Run |

---

## 8. CI/CD — Required Gates (ADR-0018)

All PRs to `main` require these three checks to pass:

| Check | Tool | Blocks merge? |
|-------|------|--------------|
| `verify` | Node.js native test runner | Yes |
| `scan` | CodeQL + TruffleHog | Yes |
| `governance` | CSL coherence gate | Yes |
| `adr-gate` | ADR Sentinel | Yes |

Branch protection settings: 1 required review, signed commits, linear history, enforce for admins.

---

## 9. Dual-Active Branch Strategy (ADR-0008)

Both `main` (rebuild) and `legacy-main-archive` remain functional and state-interchangeable.
Legacy is NOT retired until:

- [ ] All 21 HCFullPipeline stages validated equivalent between branches
- [ ] Vector memory import/export parity at DEDUP threshold (0.972)
- [ ] All 9 domains serving from rebuild without degradation
- [ ] 72-hour soak test at fib(20)=6765 capacity ceiling passes CSL CRITICAL (0.927)

---

## 10. Open Security Items (Priority Queue)

From `IMMEDIATE_ACTION_PLAN.md` — must be resolved before GA:

| Priority | Item | File | ADR |
|----------|------|------|-----|
| P0 | Timing-safe token comparison | `heady-manager.js:223` | ADR-0009 |
| P0 | Remove CORS wildcard | `heady-manager.js:142` | ADR-0009 |
| P1 | CodeQL + TruffleHog CI integration | `.github/workflows/` | ADR-0018 |
| P1 | httpOnly flags on all cookies | auth middleware | ADR-0009 |
| P2 | 777 Dependabot alerts — triage | `dependabot_alert_inventory.csv` | ADR-0018 |

---

## 11. ADR Registry

All architecture decisions are formally recorded in `docs/ADR/`.

- [ADR INDEX](docs/ADR/INDEX.md) — all 18 decisions with strength ratings
- [ADR TEMPLATE](docs/ADR/TEMPLATE.md) — use this for new decisions
- [ADR AUDIT REPORT](docs/ADR/ADR-AUDIT-REPORT.md) — gap analysis and scoring

**The ADR Sentinel CI workflow (`.github/workflows/adr-sentinel.yml`) will block any PR**
**that modifies monitored files without a corresponding ADR.**

---

## 12. Quick Reference — Environment Variables

```bash
# Database (Neon — NOT Cloud SQL)
DATABASE_URL=postgresql://...@ep-*.us-east1.aws.neon.tech/heady?sslmode=require

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=8b1fa38f282c691423c6399247d53323
CLOUDFLARE_API_TOKEN=<from Vault>

# Firebase Auth
FIREBASE_PROJECT_ID=<from Vault>
FIREBASE_SERVICE_ACCOUNT=<from Vault>

# Upstash Redis
UPSTASH_REDIS_REST_URL=<from Vault>
UPSTASH_REDIS_REST_TOKEN=<from Vault>

# AI Providers (priority order)
ANTHROPIC_API_KEY=<from Vault>
OPENAI_API_KEY=<from Vault>
GOOGLE_VERTEX_PROJECT=<from Vault>
GROQ_API_KEY=<from Vault>
PERPLEXITY_API_KEY=<from Vault>

# Runtime
NODE_ENV=production
HEADY_LOG_PRETTY=false
PORT=3301
```

---

_This document is maintained as the single source of truth for the rebuild environment.
All PRs that modify this file require a corresponding ADR update (enforced by ADR Sentinel)._
