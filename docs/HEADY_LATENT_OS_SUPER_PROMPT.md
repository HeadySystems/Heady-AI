# HEADY™ LATENT OS SUPER PROMPT — The Perfect Liquid Dynamic Parallel Distributed Microservice Architecture

> **Purpose:** Drop this entire prompt into any AI coding agent session. It instructs the agent to audit, add, modify, extend, and perfect every layer of Heady as a fully realized latent operating system. Open-ended. No ceiling. Ship everything that's missing. Fix everything that's broken. Build everything that should exist.

---

## PRIME DIRECTIVE

You are operating inside the **Heady™ Latent OS monorepo** — a φ-scaled, patent-protected, enterprise-grade AI operating system built by Eric Haywood. Your mission is **total architectural perfection**. Every service must be real, running, tested, and connected. Every pattern must be implemented — not described, not planned, not stubbed — actually implemented and functional.

**Heady is not a demo. Heady is not a prototype. Heady is a production latent operating system.**

Scan the entire codebase. Identify every gap between what Heady claims to be and what the code actually does. Close every gap. Add every missing service. Wire every disconnected endpoint. Fill every empty handler. Replace every placeholder. Ship production code.

---

## WHAT HEADY IS — THE ARCHITECTURE YOU MUST REALIZE

### The 6-Layer Stack (every layer must be fully implemented)

```
┌─────────────────────────────────────────┐
│  L6: EDGE — Cloudflare Workers/Pages    │  Request entry, TLS termination, 
│      WAF, geo-routing, edge caching     │  domain routing, DDoS protection
├─────────────────────────────────────────┤
│  L5: GATEWAY — Express + CSL Gates      │  Auth, rate limiting, CORS, session
│      phi-scaled rate limits, JWT/cookie  │  binding, request normalization
├─────────────────────────────────────────┤
│  L4: ORCHESTRATION — 17-Swarm Matrix    │  Task decomposition, swarm selection,
│      BeeFactory, SkillRouter, Pipeline   │  parallel dispatch, consensus merge
├─────────────────────────────────────────┤
│  L3: INTELLIGENCE — Model Council        │  Multi-model inference, CSL scoring,
│      embeddings, NLP, vector search      │  semantic routing, knowledge graphs
├─────────────────────────────────────────┤
│  L2: MEMORY — 3-Tier (Hot/Warm/Cold)    │  Redis (hot), pgvector (warm), 
│      VectorMemory, cosine similarity     │  archival cold storage, embeddings
├─────────────────────────────────────────┤
│  L1: RESILIENCE — Health Attestation    │  Circuit breakers, quarantine, 
│      HealthAttestor, auto-remediation    │  self-healing, graceful degradation
└─────────────────────────────────────────┘
```

**Every box above must have real, working code behind it.** If it doesn't — build it.

---

## THE LATENT SERVICE PATTERN

Every service in Heady follows the **Latent Service Pattern** — always-on, self-registering, health-reporting background processes. If a service doesn't follow this pattern, refactor it until it does.

```javascript
class ExampleService {
  constructor(config = {}) {
    this.name = 'example-service';
    this.status = 'dormant';
    this._interval = null;
  }

  async start() {
    this.status = 'active';
    this._interval = setInterval(() => this._tick(), phiMs(PHI_TIMING.CYCLE));
    logger.info({ service: this.name }, 'Service started');
    return this;
  }

  async stop() {
    this.status = 'dormant';
    if (this._interval) clearInterval(this._interval);
    logger.info({ service: this.name }, 'Service stopped');
  }

  health() {
    return { name: this.name, status: this.status, uptime: process.uptime() };
  }

  metrics() {
    return { /* service-specific telemetry */ };
  }

  async _tick() {
    // Core service loop — φ-scaled interval
  }
}
```

**Rules:**
- Every service exports a singleton instance
- Every service has `start()`, `stop()`, `health()`, `metrics()`
- Every service registers with the ServiceRegistry on boot
- Every service reports health to HealthAttestor
- Every service uses structured logging via `pino` — zero `console.log`
- Every service handles graceful shutdown on SIGTERM/SIGINT
- Every interval is φ-derived via `phiMs()` or Fibonacci-based

---

## THE 17-SWARM MATRIX — Must Be Fully Operational

Each swarm is a specialized parallel processing unit. Every swarm must have:
- A real implementation in `src/orchestration/swarms/` or `src/bees/`
- A registered factory method in BeeFactory
- A routing rule in SkillRouter
- Health reporting via HealthAttestor
- Tests in `tests/`

| # | Swarm | Role | Status Check |
|---|-------|------|-------------|
| 1 | **ResearchSwarm** | Deep research, web scraping, knowledge synthesis | Must call real APIs |
| 2 | **CodeSwarm** | Code generation, refactoring, linting | Must produce real diffs |
| 3 | **AnalysisSwarm** | Data analysis, pattern detection, anomaly finding | Must process real data |
| 4 | **SecuritySwarm** | Vulnerability scanning, OWASP checks, pen testing | Must audit real endpoints |
| 5 | **InfraSwarm** | Cloud deployment, DNS, CI/CD, health checks | Must touch real infra |
| 6 | **DocsSwarm** | Documentation generation, API specs, changelogs | Must produce real docs |
| 7 | **TestSwarm** | Test generation, coverage analysis, regression detection | Must write real tests |
| 8 | **PerformanceSwarm** | Load testing, latency profiling, optimization | Must measure real metrics |
| 9 | **DataSwarm** | ETL, migration, schema management, vector indexing | Must move real data |
| 10 | **MonitorSwarm** | Observability, alerting, dashboards, log analysis | Must watch real services |
| 11 | **ComplianceSwarm** | License auditing, GDPR, SOC2, patent compliance | Must scan real code |
| 12 | **UXSwarm** | UI generation, A/B testing, accessibility audits | Must render real pages |
| 13 | **IntegrationSwarm** | API wiring, webhook management, event bus | Must connect real services |
| 14 | **MLSwarm** | Model training, fine-tuning, evaluation | Must train real models |
| 15 | **CommunicationSwarm** | Email, notifications, Slack/Discord, websocket | Must send real messages |
| 16 | **StrategySwarm** | Business logic, pricing, roadmap, prioritization | Must output real decisions |
| 17 | **EmergencySwarm** | Incident response, rollback, circuit breaking | Must act on real failures |

**If any swarm is stubbed, mocked, or empty — implement it for real.**

---

## CONTINUOUS SEMANTIC LOGIC (CSL) — The Decision Engine

CSL is Heady's core decision-making framework. Every gate, every threshold, every routing decision flows through CSL. Ensure these are fully implemented:

```javascript
// CSL Gate Types — all must exist and function
cslGate(score, threshold, weight)        // Binary pass/fail with φ-weighted confidence
cslBlend(scores, weights)                 // Multi-signal fusion
cslTernary(score, high, low)              // Resonant / Neutral / Repellent
cslAdaptiveTemperature(context)           // Dynamic creativity scaling
cslRiskGate(features)                     // Multi-feature risk assessment
cslConsensus(modelOutputs)                // Multi-model agreement scoring
```

**Rules:**
- Zero magic numbers — every threshold derived from `PHI`, `PSI`, `FIB[]`, or `CSL_THRESHOLDS`
- All gates must be importable from `src/shared/phi-math.js` or `src/core/semantic-logic.js`
- Every gate must have unit tests in `tests/`
- Every service that makes a decision must route through a CSL gate

---

## MEMORY ARCHITECTURE — 3-Tier Must Be Wired

```
HOT  (Redis)     → Session state, rate limit counters, cache, real-time pubsub
WARM (pgvector)  → Embeddings, vector search, knowledge base, conversation history
COLD (archival)  → Long-term storage, audit logs, model training data
```

**Must exist and function:**
- `src/memory/hot-store.js` — Redis wrapper with phi-scaled TTLs
- `src/memory/warm-store.js` — pgvector operations (upsert, search, cosine similarity)
- `src/memory/cold-store.js` — Archival operations (compress, store, retrieve)
- `src/memory/memory-router.js` — Routes data to correct tier based on access patterns
- `src/memory/vector-memory.js` — High-level VectorMemory class with embed → store → recall cycle
- Automatic tier migration: hot → warm after TTL, warm → cold after age threshold

---

## THE HCFullPipeline — 12-Stage Execution Engine

The HCFullPipeline is Heady's deterministic execution backbone. All 12 stages must be implemented:

```
Stage  1: INTAKE         — Parse request, validate schema, assign priority
Stage  2: CONTEXT        — Load relevant memory, embeddings, conversation history
Stage  3: ROUTING        — CSL gate selection → pick swarm(s) and skill(s)
Stage  4: DECOMPOSITION  — Break task into parallel sub-tasks
Stage  5: DISPATCH       — Fan-out to selected swarms/bees
Stage  6: EXECUTION      — Parallel processing across swarm workers
Stage  7: CONSENSUS      — Merge swarm results, resolve conflicts via Model Council
Stage  8: VALIDATION     — CSL quality gate on output
Stage  9: ENRICHMENT     — Add metadata, citations, confidence scores
Stage 10: MEMORY_WRITE   — Store results in appropriate memory tier
Stage 11: RESPONSE       — Format and return to caller
Stage 12: TELEMETRY      — Log metrics, update dashboards, trigger learning
```

**If any stage is a stub or no-op — implement it for real.**

---

## MICROSERVICE CATALOG — Every Service Must Exist

Audit `src/services/` and ensure each of these services has a real, functional implementation:

| Service | Path | Must Do |
|---------|------|---------|
| API Gateway | `src/services/gateway/` | Route requests, auth check, rate limit |
| Domain Router | `src/services/domain-router/` | Route by hostname to correct handler |
| Auth Session | `src/services/auth-session/` | JWT + httpOnly cookie, session rotation |
| Bee Factory | `src/bees/bee-factory.js` | Spawn ephemeral workers by swarm type |
| Skill Router | `src/orchestration/skill-router.js` | Route tasks to appropriate skill handlers |
| Health Attestor | `src/resilience/health-attestor.js` | CSL-scored health + broadcast |
| Circuit Breaker | `src/resilience/circuit-breaker.js` | Open/half-open/closed with φ-backoff |
| Vector Memory | `src/memory/vector-memory.js` | Embed, store, recall, cosine search |
| Spatial Embedder | `src/services/spatial-embedder.js` | 3D vector coordinates from content |
| Continuous Embedder | `src/services/continuous-embedder.js` | Background embedding of new content |
| Auto-Success Engine | `src/engines/auto-success-engine.js` | Autonomous build monitoring + remediation |
| Budget Tracker | `src/services/budget-tracker.js` | Token/cost tracking per request |
| Event Bus | `src/services/event-bus.js` | Pub/sub for inter-service communication |
| Conductor | `src/orchestration/conductor.js` | Top-level orchestration coordinator |
| Monte Carlo Planner | `src/services/monte-carlo.js` | MCTS for decision optimization |
| Deep Research | `src/services/deep-research.js` | Multi-source research with citations |
| Notification Service | `src/services/notification.js` | WebSocket + push notifications |
| Cache Store | `src/services/cache-store.js` | Multi-layer caching with eviction |
| Billing Service | `src/services/billing.js` | Usage metering, invoicing |
| Search Service | `src/services/search-service.js` | Full-text + vector hybrid search |

**If any service is missing, empty, or a skeleton — build the real thing.**

---

## EDGE + WORKERS — Cloudflare Layer Must Be Complete

```
workers/
├── mcp-transport/     → MCP protocol handling at the edge
├── auth-gateway/      → OAuth + session validation at edge
├── domain-router/     → Route requests by hostname
├── rate-limiter/      → φ-scaled Fibonacci rate limiting
├── cache-worker/      → Edge caching with KV storage
└── analytics/         → Request logging to Analytics Engine
```

Each worker must:
- Handle OPTIONS preflight for CORS
- Set security headers (CSP, HSTS, X-Frame-Options)
- Route to correct Cloud Run backend
- Have a health check endpoint at `/_health`

---

## TESTING — Every Path Covered

The testing strategy must achieve:
- **Unit tests** for every exported function
- **Integration tests** for every service interaction
- **Contract tests** for every API endpoint schema
- **Resilience tests** for every circuit breaker / retry path
- **CSL gate tests** verifying all thresholds produce correct decisions
- **Memory tier tests** verifying hot→warm→cold migration
- **Swarm tests** verifying each swarm can execute its role

**Framework:** Vitest (not Jest, not node:test, not raw assert)
**Command:** `npx vitest run`
**Target:** Zero failures. Zero skips. 100% of paths exercised.

---

## WHAT TO SCAN AND FIX

Run these passes continuously until zero issues remain:

```bash
# 1. Swallowed errors
grep -rn "catch\s*{}" src/ --include="*.js"
grep -rn "\.catch(() => {})" src/ --include="*.js"

# 2. Localhost violations 
grep -rn "localhost\|127\.0\.0\.1" src/ --include="*.js" | grep -v test | grep -v node_modules

# 3. Console.log in production
grep -rn "console\.\(log\|warn\|error\|debug\)" src/ --include="*.js" | grep -v test

# 4. TODO/FIXME/HACK markers
grep -rn "TODO\|FIXME\|HACK\|XXX\|STUB" src/ --include="*.js"

# 5. Magic numbers (non-φ-derived constants)
# Any raw number > 1 that isn't PHI, PSI, or FIB[] derived

# 6. Missing exports
# Any file in src/ that doesn't module.exports something

# 7. Empty functions
grep -rn "function.*{}" src/ --include="*.js"
grep -rn "() => {}" src/ --include="*.js"

# 8. Dead imports
# Any require() or import that's never used

# 9. Missing health endpoints
# Every service in src/services/ must export a health() method

# 10. Disconnected services
# Every registered service must be wired into the boot sequence
```

---

## BOOT SEQUENCE — Everything Must Start

The boot sequence in `src/bootstrap/` must:

1. Load environment configuration (validate with Zod)
2. Connect to PostgreSQL + pgvector
3. Connect to Redis
4. Initialize VectorMemory
5. Start all Latent Services (HealthAttestor, ContinuousEmbedder, AutoSuccessEngine, etc.)
6. Register all services with ServiceRegistry
7. Mount all Express routes
8. Start the API server on `PORT`
9. Begin health attestation broadcasts
10. Log structured boot summary with timing

**If any step is missing or stubbed — implement it.**

---

## DEPLOYMENT — Cloud Run + Cloudflare

```
Production Architecture:
  Cloudflare DNS → Cloudflare Workers (edge) → Cloud Run (compute)
                                              ↕
                                        Cloud SQL (pgvector)
                                              ↕
                                        Memorystore (Redis)
```

- Every service must deploy to Cloud Run via `Dockerfile` or `cloudbuild.yaml`
- Every site must deploy to Cloudflare Pages
- Every worker must deploy via `wrangler`
- Zero hardcoded URLs — all endpoints from environment variables

---

## φ-MATH — THE MATHEMATICAL FOUNDATION

Every numeric constant in Heady must trace back to the golden ratio:

```javascript
const PHI = 1.618033988749895;
const PSI = 1 / PHI;  // 0.618...
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

// Timeouts
const TIMEOUT = FIB[8] * 1000;           // 21 seconds
const CYCLE = Math.round(PHI * 18000);   // ~29,124ms

// Rate limits  
const ANON_LIMIT = FIB[9];               // 55 per window
const AUTH_LIMIT = FIB[11];              // 144 per window
const ENTERPRISE_LIMIT = FIB[12];        // 233 per window

// Thresholds
const CSL_THRESHOLDS = {
  LOW: PSI * 0.5,        // 0.309
  MEDIUM: PSI,           // 0.618
  HIGH: PHI * 0.5,       // 0.809
  CRITICAL: PSI + 0.3,   // 0.918
};
```

**If you find a raw number like `5000`, `10`, `0.75`, `30000` — replace it with its φ-derived equivalent.**

---

## OPEN-ENDED MANDATE

This prompt has no ceiling. Beyond the specifics above, you are authorized and instructed to:

- **Add any service** that a production latent OS should have but doesn't yet
- **Add any middleware** that improves security, observability, or performance
- **Add any test** that covers an uncovered path
- **Add any documentation** that explains how something works
- **Refactor any code** that doesn't follow the Latent Service Pattern
- **Wire any disconnected component** to the rest of the system
- **Optimize any bottleneck** you discover during analysis
- **Implement any TODO** you find in the codebase
- **Replace any mock** with a real implementation
- **Add any monitoring** that increases observability
- **Build any missing API endpoint** that the architecture implies should exist
- **Create any dashboard** that would help operators understand system state
- **Implement any pattern** from the patent portfolio that exists in claims but not in code

**The goal: when you're done, someone should be able to clone the repo, run `npm start`, and have a fully operational AI operating system humming with all 17 swarms, all 12 pipeline stages, all 3 memory tiers, all CSL gates, all health attestors, all edge workers — everything real, everything connected, everything φ-scaled.**

---

## BEHAVIORAL CONTRACT

- **Do NOT ask permission** — if it's obvious, just do it
- **Do NOT create placeholders** — build real implementations or don't touch it
- **Do NOT use localhost** — every URL comes from env vars
- **Do NOT use console.log** — use `pino` structured logger
- **Do NOT use magic numbers** — derive from φ, ψ, or Fibonacci
- **Do NOT leave empty catch blocks** — log structured errors
- **Do NOT write CJS in ESM files** — pick one, be consistent (ESM preferred)
- **Do NOT skip tests** — every new code gets vitest tests
- **Report results, not questions** — tell me what you fixed, not what you're thinking about fixing

---

**© 2026 HeadySystems Inc. — Eric Haywood — 51 Provisional Patents — All Rights Reserved**

**END OF SUPER PROMPT — Build the perfect system. Leave nothing unfinished.**
