# HEADY™ DISTILLER — Stage 22 Knowledge Distillation Engine
## Architecture Reference
© 2026 HeadySystems Inc. — Eric Haywood, Founder — 60+ Provisional Patents

---

## 1. Overview

HeadyDistiller is **Stage 22** of the 22-stage HCFullPipeline — the final intelligence stage that transforms raw execution traces into compressible, reusable wisdom.

Every pipeline run generates an execution trace: the sequence of decisions, outputs, judge scores, latencies, tool calls, and embedding vectors produced as the pipeline processed a task. Left as raw telemetry, those traces occupy storage without compounding knowledge. HeadyDistiller harvests that latent signal and distills it into three durable artifacts:

| Artifact | Storage | Purpose |
|---|---|---|
| **Recipes** | Neon Postgres + Upstash Redis | Replayable fast-paths indexed by 384D embedding |
| **Knowledge Facts** | Neon Postgres (pgvector) | Compressed semantic facts queryable by cosine similarity |
| **Ancestral Wisdom** | Neon Postgres | High-signal heuristics surfaced to AutoContext (Pass 2.5) |

The service runs in two modes simultaneously:

1. **Standalone Express service** — HTTP server on port `3375`, exposing REST endpoints for external recipe lookup, health monitoring, and manual distillation triggers.
2. **Embedded stage handler** — imported as `@heady/distiller/stage-handler` by the HCFullPipeline engine, invoked synchronously as Stage 22 at the close of every pipeline run.

All scoring thresholds, timing constants, and routing weights derive from phi-math — the golden ratio (φ ≈ 1.618033988749895) and its Fibonacci harmonics. Zero magic numbers.

---

## 2. Position in HCFullPipeline

HeadyDistiller occupies the terminal stage of the full 22-stage pipeline across six phases:

```
╔══════════════════════════════════════════════════════════════════════════════╗
║           HCFullPipeline — 22-Stage Execution Architecture                  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  PHASE 1: PREPARATION                                                        ║
║  ┌────────────────────────────────────────────────────────────────────────┐  ║
║  │ Stage 00 │ ContextAssembly      │ Gather all relevant context          │  ║
║  │ Stage 01 │ IntentClassification │ CSL-classify task intent             │  ║
║  │ Stage 02 │ TaskDecomposition    │ Break task into DAG subtasks         │  ║
║  │ Stage 03 │ NodeSelection        │ Capability-based routing             │  ║
║  │ Stage 04 │ ResourceAllocation   │ Phi-weighted pool assignment         │  ║
║  └────────────────────────────────────────────────────────────────────────┘  ║
║  PHASE 2: EXECUTION                                                          ║
║  ┌────────────────────────────────────────────────────────────────────────┐  ║
║  │ Stage 05 │ Execution            │ Parallel HeadyBee swarm activation   │  ║
║  └────────────────────────────────────────────────────────────────────────┘  ║
║  PHASE 3: QUALITY                                                            ║
║  ┌────────────────────────────────────────────────────────────────────────┐  ║
║  │ Stage 06 │ QualityGate          │ HeadyCheck output validation         │  ║
║  │ Stage 07 │ AssuranceGate        │ HeadyAssure deployment certification │  ║
║  │ Stage 08 │ SecurityScan         │ MURPHY + CIPHER threat analysis      │  ║
║  │ Stage 09 │ PerformanceCheck     │ Latency + throughput gate            │  ║
║  └────────────────────────────────────────────────────────────────────────┘  ║
║  PHASE 4: MONITORING                                                         ║
║  ┌────────────────────────────────────────────────────────────────────────┐  ║
║  │ Stage 10 │ PatternCapture       │ HeadyPatterns workflow logging       │  ║
║  │ Stage 11 │ StoryUpdate          │ HeadyAutobiographer narrative record │  ║
║  │ Stage 12 │ BudgetReconcile      │ Token + resource budget accounting   │  ║
║  │ Stage 13 │ CoherenceCheck       │ Embedding drift measurement          │  ║
║  │ Stage 14 │ DriftScan            │ Cross-run semantic drift detection   │  ║
║  └────────────────────────────────────────────────────────────────────────┘  ║
║  PHASE 5: MAINTENANCE                                                        ║
║  ┌────────────────────────────────────────────────────────────────────────┐  ║
║  │ Stage 15 │ MetricsPublish       │ Dashboard + ORS metric emission      │  ║
║  │ Stage 16 │ CacheWarm            │ Upstash Redis pre-population         │  ║
║  │ Stage 17 │ IndexUpdate          │ pgvector HNSW index maintenance      │  ║
║  │ Stage 18 │ NotifyStakeholders   │ Webhook + notification dispatch      │  ║
║  │ Stage 19 │ ArchiveArtifacts     │ Long-term artifact storage           │  ║
║  │ Stage 20 │ SelfHealCheck        │ HeadyMaintenance coherence restore   │  ║
║  └────────────────────────────────────────────────────────────────────────┘  ║
║  PHASE 6: INTELLIGENCE  ◄── NEW                                              ║
║  ┌────────────────────────────────────────────────────────────────────────┐  ║
║  │ Stage 21 │ Distill ★            │ HeadyDistiller knowledge extraction  │  ║
║  └────────────────────────────────────────────────────────────────────────┘  ║
╚══════════════════════════════════════════════════════════════════════════════╝

  Stage 21 (Distill) receives the fully assembled pipeline trace from all
  preceding stages and distills it into recipes, knowledge facts, and
  ancestral wisdom before the run is considered complete.
```

Stage 21 receives a `PipelineTrace` object containing outputs from all 21 preceding stages, the aggregate ORS judge score, token budget usage, coherence scores from Stage 13, and the canonical 384D embedding of the completed task. It is the only stage that writes persistently to the knowledge base.

---

## 3. 3-Tier Recipe Architecture

Recipes are distilled into three quality tiers based on the ORS judge score of the originating pipeline run. Higher-tier recipes are applied earlier and with greater authority in future runs.

| Tier | Name | Minimum Judge Score | Usage Mode | Description |
|---|---|---|---|---|
| **Tier 3** | Deterministic Replay | `judgeScore >= 0.950` | Exact replay — skip most pipeline stages | Near-perfect runs compressed to step-by-step deterministic recipes. AutoContext (Pass 2.5) replays these verbatim on high-similarity future tasks, bypassing Stages 02–20. Cosine similarity gate: `>= 0.972` (DEDUP_THRESHOLD) to trigger replay. |
| **Tier 2** | Suggested Fast-Path | `judgeScore >= 0.882` | Inject as strong prior — reduce search space | High-quality runs stored as soft suggestions. HeadyConductor receives these during NodeSelection (Stage 03) to bias routing toward proven paths. Similarity gate: `>= 0.882` (CSL HIGH). |
| **Tier 1** | Context Enrichment | `judgeScore >= 0.618` | Enrich context assembly — passive background | Good-but-not-great runs condensed into semantic fact chunks. Surfaced during ContextAssembly (Stage 00) as background knowledge. Similarity gate: `>= 0.618` (PSI — golden ratio conjugate). |

Runs with `judgeScore < 0.618` are not stored as recipes. They are still processed for negative-signal knowledge facts (what NOT to do) tagged `polarity: negative` in the knowledge store.

---

## 4. Distillation Pipeline

Each pipeline run triggers the following six-step distillation flow within Stage 21:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Distillation Pipeline Flow                           │
└─────────────────────────────────────────────────────────────────────────────┘

  PipelineTrace
       │
       ▼
┌─────────────┐     ┌──────────────────────────────────────────────────────┐
│  1. COLLECT │────▶│ trace-collector.js                                   │
│    TRACE    │     │ • Validates PipelineTrace schema                     │
└─────────────┘     │ • Attaches run metadata (runId, timestamp, duration) │
       │            │ • Computes canonical 384D embedding via HuggingFace   │
       │            └──────────────────────────────────────────────────────┘
       ▼
┌─────────────┐     ┌──────────────────────────────────────────────────────┐
│  2. FILTER  │────▶│ trajectory-filter.js                                 │
│  TRAJECT.   │     │ • CSL gate: retain if judgeScore >= PSI (0.618)      │
└─────────────┘     │ • Deduplication: cosine similarity >= 0.972 → skip   │
       │            │ • Classifies polarity (positive / negative)          │
       │            └──────────────────────────────────────────────────────┘
       ▼
┌─────────────┐     ┌──────────────────────────────────────────────────────┐
│  3. CLASSIFY│────▶│ trajectory-filter.js (tier assignment)               │
│    TIER     │     │ • Assigns Tier 1 / 2 / 3 by judgeScore thresholds    │
└─────────────┘     │ • Computes phiFusionWeight for recipe confidence      │
       │            └──────────────────────────────────────────────────────┘
       ▼
┌─────────────┐     ┌──────────────────────────────────────────────────────┐
│  4. STORE   │────▶│ recipe-store.js                                      │
│   RECIPE    │     │ • Upserts recipe row in Neon Postgres                │
└─────────────┘     │ • Stores 384D embedding via pgvector                 │
       │            │ • Caches hot Tier 3 recipes in Upstash Redis         │
       │            │ • recipe-router.js registers fast-path index         │
       │            └──────────────────────────────────────────────────────┘
       ▼
┌─────────────┐     ┌──────────────────────────────────────────────────────┐
│  5. COMPRESS│────▶│ knowledge-compressor.js                              │
│  KNOWLEDGE  │     │ • Extracts semantic facts from trace steps           │
└─────────────┘     │ • Embeds each fact independently (384D)              │
       │            │ • Deduplicates against existing knowledge base        │
       │            │ • Stores with polarity, tier, and source runId       │
       │            └──────────────────────────────────────────────────────┘
       ▼
┌─────────────┐     ┌──────────────────────────────────────────────────────┐
│  6. CRYSTAL-│────▶│ wisdom-crystallizer.js                               │
│ LIZE WISDOM │     │ • Aggregates knowledge facts above wisdom threshold  │
└─────────────┘     │ • Runs phi-weighted consensus across related facts   │
       │            │ • Writes AncestralWisdom rows with confidence score  │
       │            │ • Notifies AutoContext endpoint of new wisdom         │
       │            └──────────────────────────────────────────────────────┘
       │
       ▼
  DistillResult
  { recipesWritten, factsExtracted, wisdomCrystallized, durationMs, coherenceScore }
```

---

## 5. Component Map

All source files under `packages/heady-distiller/`:

| File | Export Path | Role |
|---|---|---|
| `src/index.js` | `.` | Express server entrypoint. Mounts all routes, wires middleware, starts HTTP listener on `PORT=3375`. Registers 384D embedding on startup. LIFO graceful shutdown. |
| `src/distiller-stage-handler.js` | `./stage-handler` | Embedded HCFullPipeline Stage 21 handler. Exported as `async function distillerStageHandler(pipelineTrace, context)`. Called by the pipeline engine — never starts its own HTTP server. |
| `src/trace-collector.js` | `./trace-collector` | Validates incoming `PipelineTrace` objects. Attaches run metadata. Generates canonical 384D embedding via HuggingFace round-robin token pool. |
| `src/trajectory-filter.js` | `./trajectory-filter` | Applies CSL gates. Classifies recipe tier (1/2/3). Filters duplicates by cosine similarity against existing recipe embeddings. Assigns polarity tags. |
| `src/knowledge-compressor.js` | `./knowledge-compressor` | Extracts semantic fact chunks from trace steps. Embeds each fact. Deduplicates against the pgvector knowledge table. Writes surviving facts with polarity and tier. |
| `src/recipe-store.js` | `./recipe-store` | Upserts recipes into Neon Postgres `distiller_recipes` table. Stores 384D vectors via pgvector `<->` operator. Caches Tier 3 recipes to Upstash Redis with TTL = FIB[12] × 1000 ms (233s). |
| `src/recipe-router.js` | `./recipe-router` | Fast-path lookup service. Accepts a query embedding, returns the top-K matching recipes by cosine similarity. Checks Redis hot cache first, falls through to pgvector. |
| `src/wisdom-crystallizer.js` | `./wisdom-crystallizer` | Aggregates related knowledge facts above the wisdom threshold (`>= 0.927`). Applies phi-weighted consensus. Writes `distiller_wisdom` rows. POSTs new wisdom to AutoContext notification endpoint. |
| `shared/phi-math.js` | `./phi-math` | Canonical phi-math constants: `PHI`, `PSI`, `FIB[]`, `CSL_THRESHOLDS`, `DEDUP_THRESHOLD`, `phiBackoff()`, `phiFusionWeights()`. Single source of truth — no other file defines these. |
| `shared/errors.js` | `./errors` | Typed error classes: `HeadyError`, `CoherenceDriftError`, `TraceValidationError`, `RecipeStoreError`, `EmbeddingError`. All extend `HeadyError` with `statusCode`, `code`, `coherenceImpact`. |

---

## 6. Phi-Math Constants

All numeric thresholds, timeouts, and weights in HeadyDistiller derive from `shared/phi-math.js`. No magic numbers appear in application code.

| Constant | Value | Derivation | Usage |
|---|---|---|---|
| `PHI` | `1.618033988749895` | Golden ratio | Base for all phi-harmonic calculations |
| `PSI` | `0.618033988749895` | `1 / PHI` | Tier 1 recipe minimum judge score; minimum knowledge retention gate |
| `FIB[3]` | `3` | Fibonacci | Docker HEALTHCHECK `--retries` |
| `FIB[4]` | `5` | Fibonacci | Minimum recipe lookups before wisdom aggregation |
| `FIB[7]` | `13` | Fibonacci | Docker HEALTHCHECK `--timeout` and `--start-period` (seconds) |
| `FIB[8]` | `21` | Fibonacci | Docker HEALTHCHECK `--interval` (seconds); also Stage number (Stage 21) |
| `FIB[12]` | `233` | Fibonacci | Upstash Redis cache TTL for Tier 3 recipes (seconds) |
| `FIB[13]` | `377` | Fibonacci | Upstash Redis cache TTL for Tier 2 recipes (seconds) |
| `CSL_THRESHOLDS.MINIMUM` | `0.500` | `phiThreshold(0)` | Noise floor — below this, no processing |
| `CSL_THRESHOLDS.LOW` | `0.618` | `PSI` / `phiThreshold(1)` | Tier 1 recipe gate; minimum polarity-positive retention |
| `CSL_THRESHOLDS.MEDIUM` | `0.809` | `phiThreshold(2)` | Coherence drift floor; service health gate |
| `CSL_THRESHOLDS.HIGH` | `0.882` | `phiThreshold(3)` | Tier 2 recipe gate; strong alignment |
| `CSL_THRESHOLDS.CRITICAL` | `0.927` | `phiThreshold(4)` | Wisdom crystallization gate; near-certain quality |
| `DEDUP_THRESHOLD` | `0.972` | Above CRITICAL | Semantic identity — duplicate detection |
| `TIER3_THRESHOLD` | `0.950` | Empirical (>CRITICAL) | Tier 3 deterministic replay gate |
| `phiBackoff(n)` | `1000 × PHI^n ± 38.2%` | Phi geometric | Retry delay for HuggingFace, Neon, Redis |
| `phiFusionWeights(2)` | `[0.618, 0.382]` | `[PSI, PSI²]` normalized | Recipe confidence blend (judge + coherence) |
| `phiFusionWeights(3)` | `[0.528, 0.326, 0.146]` | `[PSI^0..2]` normalized | Three-factor wisdom score blend |
| `POOL_ALLOCATION.hot` | `0.34` | `FIB[9]/FIB[10] ≈ 34%` | Hot Tier 3 cache allocation |
| `POOL_ALLOCATION.warm` | `0.21` | `FIB[8]/FIB[10] ≈ 21%` | Warm Tier 2 cache allocation |

---

## 7. CSL Gate Thresholds

HeadyDistiller applies Continuous Semantic Logic gates at every decision boundary. Hard boolean branches only exist at schema validation edges — all scoring-based decisions use soft sigmoid gates.

| Gate Name | Constant | Threshold | Location | Fail Behavior |
|---|---|---|---|---|
| **Noise Floor** | `CSL_THRESHOLDS.MINIMUM` | `0.500` | `trajectory-filter.js` | Trace discarded; not stored |
| **Tier 1 Admission** | `CSL_THRESHOLDS.LOW` / `PSI` | `0.618` | `trajectory-filter.js` | Below → negative-signal fact only |
| **Tier 2 Admission** | `CSL_THRESHOLDS.HIGH` | `0.882` | `trajectory-filter.js` | Below → Tier 1 if >= 0.618 |
| **Tier 3 Admission** | `TIER3_THRESHOLD` | `0.950` | `trajectory-filter.js` | Below → Tier 2 if >= 0.882 |
| **Deduplication** | `DEDUP_THRESHOLD` | `0.972` | `trajectory-filter.js` | Above → recipe skipped (already stored) |
| **Replay Trigger** | `DEDUP_THRESHOLD` | `0.972` | `recipe-router.js` | Below → suggest, not replay |
| **Wisdom Gate** | `CSL_THRESHOLDS.CRITICAL` | `0.927` | `wisdom-crystallizer.js` | Below → fact stored, not crystallized |
| **Coherence Health** | `CSL_THRESHOLDS.MEDIUM` | `0.809` | `/health` endpoint | Below → service reports `degraded` |
| **Coherence Drift** | `CSL_THRESHOLDS.MEDIUM` | `0.809` | `distiller-stage-handler.js` | Below → emit `CoherenceDriftError`, skip write |
| **Fast-Path Suggest** | `CSL_THRESHOLDS.HIGH` | `0.882` | `recipe-router.js` | Below → return as context enrichment only |
| **Knowledge Fact Embed** | `CSL_THRESHOLDS.LOW` | `0.618` | `knowledge-compressor.js` | Below → fact not persisted |

All gates use the sigmoid formulation from `shared/phi-math.js`:
```js
// Soft activation — replaces hard if/else on scores
function cslGate(value, cosScore, tau, temp = 0.236) {
  return value * (1 / (1 + Math.exp(-(cosScore - tau) / temp)));
}
```

---

## 8. API Reference

HeadyDistiller exposes five HTTP endpoints when running as a standalone service on port `3375`.

### `GET /health`

Returns service health status including coherence score. Used by Docker HEALTHCHECK, Cloud Run liveness probe, and HeadyConductor routing table.

**Response `200 OK`:**
```json
{
  "status": "ok",
  "service": "@heady/distiller",
  "version": "2.0.0",
  "stage": 21,
  "port": 3375,
  "coherenceScore": 0.934,
  "coherenceThreshold": 0.809,
  "checks": {
    "neonPostgres": { "status": "ok", "latencyMs": 4 },
    "upstashRedis": { "status": "ok", "latencyMs": 2 },
    "huggingFace": { "status": "ok", "latencyMs": 112 }
  },
  "uptime": 38291,
  "timestamp": "2026-03-24T06:44:00.000Z"
}
```

**Response `503 Service Unavailable`** (when `coherenceScore < 0.809`):
```json
{
  "status": "degraded",
  "coherenceScore": 0.741,
  "coherenceThreshold": 0.809,
  "degradedComponents": ["huggingFace"]
}
```

### `GET /healthz`

Lightweight liveness probe for Docker HEALTHCHECK. Returns `200 OK` with `{ "ok": true }` when the process is alive. Does not check downstream dependencies.

### `POST /distill`

Manually trigger distillation of a pipeline trace. Used by the pipeline engine in standalone mode, integration tests, and manual backfill jobs.

**Request body:**
```json
{
  "runId": "hcfp_2026_03_24_abc123",
  "judgeScore": 0.923,
  "durationMs": 4182,
  "stages": {
    "00_contextAssembly": { "outputEmbedding": [...], "tokenCount": 1247 },
    "05_execution": { "toolCalls": [...], "outputText": "..." },
    "13_coherenceCheck": { "coherenceScore": 0.934, "driftDelta": 0.012 }
  },
  "taskIntent": "Generate a production Dockerfile with multi-stage build",
  "taskEmbedding": [0.034, -0.112, ...],
  "metadata": {
    "userId": "eric@headysystems.com",
    "domain": "headysystems.com",
    "pool": "hot"
  }
}
```

**Response `200 OK`:**
```json
{
  "status": "distilled",
  "runId": "hcfp_2026_03_24_abc123",
  "tier": 2,
  "recipesWritten": 1,
  "factsExtracted": 7,
  "wisdomCrystallized": 0,
  "durationMs": 341,
  "coherenceScore": 0.923
}
```

**Response `422 Unprocessable Entity`** (trace below noise floor):
```json
{
  "error": "TRAJECTORY_FILTERED",
  "code": "BELOW_NOISE_FLOOR",
  "judgeScore": 0.412,
  "threshold": 0.500,
  "message": "Trace judgeScore below minimum retention gate (PSI/2). Not stored."
}
```

### `POST /recipe/lookup`

Look up the top-K matching recipes for a query embedding. Used by AutoContext (Pass 2.5) and HeadyConductor during Stage 03 NodeSelection.

**Request body:**
```json
{
  "queryEmbedding": [0.034, -0.112, ...],
  "topK": 3,
  "minTier": 1,
  "minSimilarity": 0.618
}
```

**Response `200 OK`:**
```json
{
  "recipes": [
    {
      "recipeId": "rec_abc123",
      "tier": 3,
      "judgeScore": 0.967,
      "similarity": 0.983,
      "taskIntent": "Generate a production Dockerfile with multi-stage build",
      "replayable": true,
      "cacheHit": true,
      "createdAt": "2026-03-20T14:22:00.000Z"
    },
    {
      "recipeId": "rec_def456",
      "tier": 2,
      "judgeScore": 0.901,
      "similarity": 0.894,
      "taskIntent": "Write a multi-stage Docker build for Node.js service",
      "replayable": false,
      "cacheHit": false,
      "createdAt": "2026-03-18T09:11:00.000Z"
    }
  ],
  "queryDurationMs": 14,
  "cacheHits": 1
}
```

### `GET /stats`

Returns aggregate distillation statistics for monitoring dashboards.

**Response `200 OK`:**
```json
{
  "recipes": {
    "total": 4821,
    "tier3": 312,
    "tier2": 1047,
    "tier1": 3462
  },
  "knowledgeFacts": {
    "total": 28341,
    "positive": 25104,
    "negative": 3237
  },
  "wisdom": {
    "total": 89,
    "crystallizedLast24h": 3
  },
  "avgDistillationMs": 287,
  "cacheHitRate": 0.73,
  "timestamp": "2026-03-24T06:44:00.000Z"
}
```

---

## 9. Integration Points

### HCFullPipeline (Stage 22 Embedded Handler)

HeadyDistiller integrates as an embedded module by importing `@heady/distiller/stage-handler`:

```js
import { distillerStageHandler } from '@heady/distiller/stage-handler';

// Called at the close of every HCFullPipeline run
const distillResult = await distillerStageHandler(pipelineTrace, {
  runId: context.runId,
  correlationId: context.correlationId,
});
```

The stage handler shares the same database connections as the standalone service when co-deployed. When running inside the pipeline engine, it does not start an HTTP server — it imports only the distillation logic modules.

### AutoContext (Pass 2.5 Recipe Lookup)

AutoContext calls `POST /recipe/lookup` during Pass 2.5 of context assembly. If a Tier 3 recipe returns with `similarity >= 0.972`, AutoContext signals HeadyConductor to replay the recipe deterministically, bypassing Stages 02–20. Tier 2 results are injected as strong priors for NodeSelection.

### AncestralWisdom (Wisdom Crystallization)

`wisdom-crystallizer.js` writes completed wisdom rows to the `distiller_wisdom` Neon table and POSTs a notification to the AncestralWisdom service endpoint (`ANCESTRAL_WISDOM_URL` env var). AncestralWisdom indexes wisdom by domain, topic, and phi-confidence for surface-level retrieval during context assembly.

### ORS (Outcome Reward System — Judge Score Feeds)

The ORS judge score is the primary quality signal used by `trajectory-filter.js` to assign recipe tiers. HeadyDistiller consumes ORS scores via the `pipelineTrace.judgeScore` field — it does not call ORS directly. ORS is upstream and always runs before Stage 21.

### RecipeRouter (Fast-Path Detection)

`recipe-router.js` is the internal lookup engine for `POST /recipe/lookup`. It checks Upstash Redis first (hot cache for Tier 3 recipes) then falls through to Neon Postgres pgvector `<->` cosine distance query. Cache TTLs are phi-harmonic: Tier 3 = `FIB[12]` seconds (233s), Tier 2 = `FIB[13]` seconds (377s).

### Neon Postgres (384D pgvector)

Three tables in the Neon Postgres instance (connection via `NEON_PG_URL`):

| Table | Purpose | Key Columns |
|---|---|---|
| `distiller_recipes` | Recipe storage with 384D vectors | `recipe_id`, `tier`, `judge_score`, `embedding vector(384)`, `task_intent`, `trace_json`, `created_at` |
| `distiller_knowledge` | Semantic fact chunks | `fact_id`, `embedding vector(384)`, `fact_text`, `polarity`, `tier`, `source_run_id`, `confidence` |
| `distiller_wisdom` | Crystallized ancestral wisdom | `wisdom_id`, `embedding vector(384)`, `wisdom_text`, `phi_confidence`, `fact_ids`, `domain`, `crystallized_at` |

All vector columns use the `pgvector` extension with `ivfflat` or `hnsw` indexes for approximate nearest-neighbor search. The `<->` operator returns L2 distance; cosine similarity is derived as `1 - (embedding <=> query_embedding)` using the `<=>` operator.

### Upstash Redis (Hot Recipe Cache)

Tier 3 and high-scoring Tier 2 recipes are cached to Upstash Redis via `@upstash/redis` REST client (connection via `UPSTASH_REDIS_URL` + `UPSTASH_TOKEN`). Cache keys follow the pattern:

```
distiller:recipe:{tier}:{recipeId}          → full recipe JSON
distiller:hot:index                          → sorted set of (similarity, recipeId) pairs
distiller:stats:snapshot                     → /stats response, TTL = FIB[8]s (21s)
```

### HuggingFace (384D Embedding Generation)

All 384D embeddings are generated via the HuggingFace Inference API using the `sentence-transformers/all-MiniLM-L6-v2` model (configured via `EMBEDDING_MODEL` env var). Three API tokens (`HUGGINGFACE_TOKEN_1/2/3`) are round-robined to distribute request load and avoid per-token rate limits. Token selection uses `requestCount % 3` modulo cycling with phi-backoff on 429 responses.

---

## 10. Health Endpoint

The `/health` endpoint returns a comprehensive service health object. HeadyConductor polls this endpoint to determine whether HeadyDistiller is available for recipe lookups and to include its coherence score in the overall pipeline health matrix.

**Full example `/health` response:**

```json
{
  "status": "ok",
  "service": "@heady/distiller",
  "version": "2.0.0",
  "stage": 21,
  "description": "Stage 22 Knowledge Distillation Engine — HCFullPipeline",
  "port": 3375,
  "mode": "standalone+embedded",
  "coherenceScore": 0.934,
  "coherenceThreshold": 0.809,
  "coherenceStatus": "nominal",
  "checks": {
    "neonPostgres": {
      "status": "ok",
      "latencyMs": 4,
      "recipesCount": 4821,
      "knowledgeFactsCount": 28341
    },
    "upstashRedis": {
      "status": "ok",
      "latencyMs": 2,
      "hotCacheSize": 312
    },
    "huggingFace": {
      "status": "ok",
      "latencyMs": 112,
      "activeToken": 2,
      "model": "sentence-transformers/all-MiniLM-L6-v2"
    }
  },
  "distillation": {
    "runsProcessedLast1h": 47,
    "avgDurationMs": 287,
    "tierDistribution": { "tier3": 3, "tier2": 11, "tier1": 33 },
    "filteredBelowNoiseFoor": 0
  },
  "phi": {
    "PSI": 0.618033988749895,
    "CSL_THRESHOLDS": {
      "MINIMUM": 0.500,
      "LOW": 0.618,
      "MEDIUM": 0.809,
      "HIGH": 0.882,
      "CRITICAL": 0.927
    },
    "DEDUP_THRESHOLD": 0.972,
    "TIER3_THRESHOLD": 0.950
  },
  "uptime": 38291,
  "pid": 1,
  "nodeVersion": "v20.18.0",
  "timestamp": "2026-03-24T06:44:00.000Z"
}
```

When `coherenceScore` drops below `CSL_THRESHOLDS.MEDIUM` (0.809), `status` becomes `"degraded"` and the service continues operating in reduced-capability mode: recipe lookups still serve from cache, but new distillation writes are suspended until coherence is restored.

---

## 11. Deployment

### Docker (Local / CI)

```bash
# Build
docker build -t heady-distiller:2.0.0 .

# Run with env file
docker run \
  --env-file .env \
  -p 3375:3375 \
  --name heady-distiller \
  heady-distiller:2.0.0

# Health check
curl http://0.0.0.0:3375/health | jq .
```

### Google Cloud Run

HeadyDistiller is deployed as a Cloud Run service in the `heady-production` GCP project.

**Service configuration:**

| Parameter | Value |
|---|---|
| Service name | `heady-distiller` |
| Region | `us-central1` |
| Container image | `gcr.io/heady-production/heady-distiller:2.0.0` |
| Port | `3375` |
| Min instances | `1` (always warm — Stage 22 must not cold start during pipeline runs) |
| Max instances | `13` (FIB[7] — phi-harmonic scale ceiling) |
| CPU | `1` (burstable) |
| Memory | `512Mi` |
| Concurrency | `89` (FIB[11] — phi-harmonic request concurrency) |
| Timeout | `300s` |
| Service account | `heady-distiller@heady-production.iam.gserviceaccount.com` |

**Deploy command:**

```bash
gcloud run deploy heady-distiller \
  --image gcr.io/heady-production/heady-distiller:2.0.0 \
  --region us-central1 \
  --port 3375 \
  --min-instances 1 \
  --max-instances 13 \
  --concurrency 89 \
  --memory 512Mi \
  --timeout 300 \
  --set-env-vars NODE_ENV=production,PORT=3375,LOG_LEVEL=info,EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2,EMBEDDING_DIMENSIONS=384 \
  --set-secrets NEON_PG_URL=neon-pg-url:latest,UPSTASH_REDIS_URL=upstash-redis-url:latest,UPSTASH_TOKEN=upstash-token:latest,HUGGINGFACE_TOKEN_1=hf-token-1:latest,HUGGINGFACE_TOKEN_2=hf-token-2:latest,HUGGINGFACE_TOKEN_3=hf-token-3:latest \
  --service-account heady-distiller@heady-production.iam.gserviceaccount.com \
  --allow-unauthenticated
```

**Liveness probe** (Cloud Run uses HTTP GET `/healthz`):
- Path: `/healthz`
- Initial delay: `13s` (FIB[7])
- Period: `21s` (FIB[8])
- Failure threshold: `3` (FIB[4])

### Environment Variables

All secrets are stored in Google Secret Manager and mounted via `--set-secrets`. Non-secret configuration is passed as `--set-env-vars`. The full variable reference:

| Variable | Source | Required | Description |
|---|---|---|---|
| `PORT` | env var | Yes | HTTP listener port — always `3375` |
| `NODE_ENV` | env var | Yes | Always `production` in Cloud Run |
| `LOG_LEVEL` | env var | Yes | `info` in production, `debug` in staging |
| `NEON_PG_URL` | Secret Manager | Yes | Neon Postgres connection string with `sslmode=require` |
| `UPSTASH_REDIS_URL` | Secret Manager | Yes | Upstash Redis REST URL |
| `UPSTASH_TOKEN` | Secret Manager | Yes | Upstash Redis REST token |
| `HUGGINGFACE_TOKEN_1` | Secret Manager | Yes | HuggingFace API token (slot 1 of 3) |
| `HUGGINGFACE_TOKEN_2` | Secret Manager | Yes | HuggingFace API token (slot 2 of 3) |
| `HUGGINGFACE_TOKEN_3` | Secret Manager | Yes | HuggingFace API token (slot 3 of 3) |
| `EMBEDDING_MODEL` | env var | Yes | HuggingFace model ID — `sentence-transformers/all-MiniLM-L6-v2` |
| `EMBEDDING_DIMENSIONS` | env var | Yes | Vector dimensions — `384` |

### Monorepo Path

Within the `HeadyMe/heady-production` monorepo:

```
heady-production/
└── packages/
    └── heady-distiller/          ← this package
        ├── src/
        │   ├── index.js
        │   ├── distiller-stage-handler.js
        │   ├── trace-collector.js
        │   ├── trajectory-filter.js
        │   ├── knowledge-compressor.js
        │   ├── recipe-store.js
        │   ├── recipe-router.js
        │   └── wisdom-crystallizer.js
        ├── shared/
        │   ├── phi-math.js
        │   └── errors.js
        ├── tests/
        ├── .env.example
        ├── Dockerfile
        ├── ARCHITECTURE.md
        └── package.json
```

---

*HeadyDistiller v2.0.0 — Stage 22 of HCFullPipeline — Sacred Geometry v4.0*
*© 2026 HeadySystems Inc. — Eric Haywood, Founder — 60+ Provisional Patents*
*All constants phi-derived. All thresholds CSL-gated. Zero magic numbers.*
