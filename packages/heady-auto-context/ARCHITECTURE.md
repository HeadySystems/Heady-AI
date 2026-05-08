# HeadyAutoContext — Architecture Reference

**© 2026 HeadySystems Inc. — Eric Haywood, Founder**

## 3-Pass Pre-Action Context Enrichment Engine (Patentable)

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PASS 1: SCAN (Background)                │
│  Interval: fib(8) × 1000 = 21,000ms                        │
│  • Workspace file hash scan (Merkle tree delta detection)   │
│  • Active session state from T0 Redis (Upstash)             │
│  • Recent vector memory from T1 pgvector (Neon)             │
│  • CSL relevance scoring against current task domain        │
│  Output: pass1State → ContextFusionEngine                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                PASS 2: ENRICH (Per-Request)                  │
│  Trigger: autoContextMiddleware on every HTTP request        │
│  • Embed incoming text (384-dim, all-MiniLM-L6-v2)          │
│  • Vector search: top-K=21 from pgvector (CSL ≥ 0.618)     │
│  • Merge Pass 1 scan + request-specific vectors             │
│  • Phi-weighted fusion: scan × ψ² + request × ψ             │
│  Output: req.headyContext (attached to every request)        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              PASS 3: DEEPEN (Pre-Execution)                  │
│  Trigger: composite CSL score ≥ CORE (0.718)                │
│  • Pull prior decisions for task domain                     │
│  • Load anti-regression guards from T1                      │
│  • CSL gate: only inject if combined ≥ 0.718                │
│  Output: Final context capsule for execution                │
└─────────────────────────────────────────────────────────────┘
```

### CSL Gate Thresholds

| Gate    | Threshold | Behavior                            |
|---------|-----------|-------------------------------------|
| VOID    | < 0.382   | Filtered out completely             |
| RECALL  | ≥ 0.382   | Available via explicit search only  |
| INCLUDE | ≥ 0.618   | Added to response context (Pass 2)  |
| CORE    | ≥ 0.718   | Injected into active context (Pass 3)|
| INJECT  | ≥ 0.786   | Auto-injected without query         |

### Fibonacci Constants

| Parameter         | Value  | Fibonacci |
|-------------------|--------|-----------|
| Scan interval     | 21,000ms | fib(8)×1000 |
| Vector dimension  | 384    | — |
| Search top-K      | 21     | fib(8) |
| Batch size        | 13     | fib(7) |
| HNSW m            | 21     | fib(8) |
| HNSW ef           | 89     | fib(11) |
| Pool min          | 2      | fib(3) |
| Pool max          | 13     | fib(7) |
| Cache size        | 987    | fib(16) |
| Max retries       | 5      | fib(5) |

### Phi-Weighted Fusion

```
fused_score = scan_similarity × ψ² + request_similarity × ψ
            = scan_similarity × 0.382 + request_similarity × 0.618
```

### Service Endpoints

| Endpoint              | Method | Purpose                       |
|-----------------------|--------|-------------------------------|
| /health               | GET    | Full health + vector count    |
| /healthz              | GET    | K8s liveness probe            |
| /readiness            | GET    | K8s readiness probe           |
| /context/query        | POST   | Primary enrichment (Pass 2/3) |
| /context/index        | POST   | Index single entry            |
| /context/index-batch  | POST   | Batch index (max 13)          |
| /context/stats        | GET    | Diagnostics + Pass 1 state    |
| /context/force-scan   | POST   | Manual Pass 1 trigger         |
| /context/clear-cache  | POST   | Clear embedding cache         |

### File Map

```
heady-auto-context/
├── shared/
│   ├── phi-math.js              — φ/Fibonacci constants + CSL gates
│   ├── structured-logger.js     — JSON structured logging
│   ├── errors.js                — Typed error classes
│   └── auto-context-middleware.js — Mandatory middleware for all services
├── src/
│   ├── config.js                — Environment config with Fibonacci defaults
│   ├── embedding-client.js      — HuggingFace API + LRU cache + round-robin
│   ├── context-fusion-engine.js — 3-pass fusion engine (core)
│   ├── background-scanner.js    — Pass 1 background scanner
│   ├── vector-store.js          — pgvector on Neon PostgreSQL + HNSW
│   └── index.js                 — Express server entry point
├── package.json
├── Dockerfile
├── .env.example
└── ARCHITECTURE.md
```

### HCFullPipeline Integration

| Stage | AutoContext Pass |
|-------|-----------------|
| 0 — Channel Entry | Pass 1 (background) |
| 1 — INTAKE | Pass 2 (per-request) |
| 2 — DECOMPOSE | Pass 2 |
| 3 — PLAN | Pass 3 (deep) |
| 4 — RESOURCE_ALLOC | Pass 2 |
| 5 — CONTEXT_LOAD | **Pass 3 (PRIMARY INJECTION)** |
| 6 — EXECUTE | Consumed |
| 7 — VALIDATE | Index (write) |
| 8 — SYNTHESIZE | Pass 2 |
| 9 — REVIEW | Pass 2 |
| 10 — COMMIT | Pass 2 |
| 11 — DEPLOY | Pass 2 |
| 12 — LEARN | Index (write) |

### Patentable Innovation Claims

1. **Multi-Pass Pre-Action Context Enrichment** — 3 temporal passes (background, per-request, pre-execution)
2. **Phi-Weighted Fusion** — Golden ratio-derived weights (ψ²=0.382, ψ=0.618)
3. **CSL-Gated Injection** — Phi-harmonic threshold series (VOID/RECALL/INCLUDE/CORE/INJECT)
4. **Fibonacci-Timed Background Scanning** — fib(8)×1000ms interval with phi-backoff
5. **Mandatory Middleware Pattern** — Universal context propagation at Express middleware level
6. **Anti-Regression Guards** — CORE-threshold prior decision search prevents decision cycling
