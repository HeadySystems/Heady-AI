# heady-distiller Service Specification v1.0

> **Node:** heady-distiller | **Port:** 3398 | **Transport:** streamable-http
> **Purpose:** Reverse-engineer successful execution traces into optimized, deterministic execution recipes
> **Research basis:** DSPy GEPA (ICLR 2026 Oral), TextGrad (Nature 2024), Temporal.io replay,
>                    SWE-Gym RFT, Voyager skill synthesis, AgentRR record-and-replay
>
> © 2026 HeadySystems Inc.

---

## 1. Core Concept

The Buddy Deterministic Optimization Loop turns errors into armor. The distiller turns successes into maps. Every time the 22-stage pipeline completes with JUDGE ≥ 0.85, the distiller captures the full trace and distills it into a tiered recipe that accelerates or skip-ahead future similar requests.

The key insight from the research: recording non-deterministic inputs (LLM responses, API results) — not re-executing them — creates a deterministic replay oracle. And optimizing prompts from successful traces (DSPy GEPA) outperforms RL by +6% average at 35× fewer rollouts (ICLR 2026).

---

## 2. API

```yaml
POST /distill
  body: { trace_id, execution_log, judge_score, pipeline_variant }
  → { recipe_id, tier, sha256, optimization_estimate }
  Called by: Stage 20 RECEIPT when JUDGE ≥ 0.85

POST /retrieve
  body: { intent_embedding: float[1536], task_class: string, min_tier: 1|2|3 }
  → { recipe_id, tier, confidence, fast_path_eligible, recipe_payload }
  Called by: AutoContext Pass 2.5

POST /replay
  body: { recipe_id, input_override: object }
  → Streams recorded execution trace with optional input substitution
  Called by: Stage 12 EXECUTE on fast-path approval

GET /recipes/:id → Full recipe with metadata, metrics, usage stats
POST /meta-distill { task_class } → Compress 34+ recipes into optimal composite
DELETE /recipes/:id → Soft-delete with audit trail
GET /health → { status, recipes_distilled, avg_optimization_gain, cache_hit_rate }
```

---

## 3. Trace Format (Event Sourcing)

Append-only JSONL per pipeline execution. SHA-256 hash chain for integrity.

```jsonc
{"ts": 1710576000, "stage": "CHANNEL_ENTRY", "event": "stage_start", "meta": {"channel": "api", "user_id": "u_abc"}}
{"ts": 1710576003, "stage": "CLASSIFY", "event": "csl_gate", "meta": {"top_class": "CODE_GEN", "score": 0.87}}
{"ts": 1710576005, "stage": "ORCHESTRATE", "event": "llm_call", "meta": {"model": "claude-sonnet-4", "tokens_in": 2340, "tokens_out": 890, "duration_ms": 3200}, "replay": {"input": "...", "output": "..."}}
{"ts": 1710576020, "stage": "JUDGE", "event": "score", "meta": {"composite": 0.91, "correctness": 0.95, "safety": 1.0}}
{"ts": 1710576021, "stage": "RECEIPT", "event": "signed", "meta": {"pqc_sig": "ML-DSA..."}}
```

The `replay` field on `llm_call` events stores exact I/O. During replay, recorded outputs are returned directly — no new LLM calls. This is the TracedLLMClient / ReplayLLMClient pattern.

---

## 4. Three Distillation Tiers

### Tier 1 — Optimized Prompt

DSPy GEPA optimizer refines the prompts that led to success. Maintains Pareto frontier of candidates, uses LLM reflection to diagnose failures and propose targeted updates.

Cost: ~150 LLM calls (one-time). Storage: prompts/ versioned with SHA-256. Retrieval: semantic search at τ=ψ².

### Tier 2 — Pipeline Configuration

Trajectory-to-abstract-tips extraction (arXiv:2603.10600). Generalized configs: which stages, which models, which bees, CSL thresholds, context patterns, and actionable tips.

Storage: wisdom.json + Qdrant (type: execution_recipe). Archive when success_rate < ψ² over 8+ uses (selective deletion is as important as selective addition).

### Tier 3 — Full Execution Recipe

Complete deterministic replay: prompt + config + DAG + recorded LLM outputs + test assertions. Auto-generates SKILL.md for the skills library.

Storage: distiller-registry.json + skills/ SKILL.md. Replay: stream recorded outputs, verify against assertions.

---

## 5. Recipe Routing (AutoContext Pass 2.5)

```
1. Search recipe registry by intent embedding (semantic similarity)
2. Tier 3 match ≥ ψ (0.618) → FAST_PATH: skip to EXECUTE with recorded trace
3. Tier 2 match ≥ ψ² (0.382) → OPTIMIZE_CONFIG: apply stage/model/bee config
4. Tier 1 match → INJECT_PROMPT: use optimized prompt for LLM calls
5. No match → PROCEED_NORMAL: full pipeline
```

---

## 6. Meta-Distillation

When a task class accumulates > fib(9) = 34 recipes, compress via CSL CONSENSUS: `normalize(Σwᵢ · recipe_vectorᵢ)` weighted by JUDGE scores. Produces the consensus route. Prevents unbounded recipe growth.

---

## 7. Implementation Files

```
src/distiller/
├── distiller-node.js           Express/Hono service, port 3398
├── trace-capture.js            JSONL append, SHA-256 chain
├── success-filter.js           Quality gate (JUDGE ≥ 0.85)
├── tier1-prompt-optimizer.js   DSPy GEPA bridge (Python subprocess)
├── tier2-config-extractor.js   Trajectory → abstract tips
├── tier3-replay-recorder.js    Full trace + DAG + test gen
├── recipe-registry.js          Qdrant + JSON, search, version, archive
├── recipe-router.js            AutoContext Pass 2.5 integration
├── meta-distiller.js           Recipe compression (34+ threshold)
├── skill-synthesizer.js        Recipe → SKILL.md (Voyager pattern)
└── dspy-bridge.py              Python subprocess for DSPy/TextGrad

src/bees/
└── distiller-bee.js            DistillerBee: after RECEIPT, 3 parallel tier sub-bees
```

---

## 8. DistillerBee

```yaml
type: distiller-bee
swarm: Overmind
trigger: RECEIPT_SIGNED
preconditions:
  judge_composite: { min: 0.85 }
  pipeline_variant: { not: fast }   # prevent circular distillation
  feature_flag: ENABLE_DISTILLER
execute:
  - Spawn 3 parallel sub-bees (tier1, tier2, tier3)
  - Store results in recipe registry
  - If task_class recipe_count > 34 → spawn meta-distiller-bee
timeout_ms: 12708    # 3 × TASK_TIMEOUT (φ² × 3)
retry_delays: [1000, 1618, 2618]
```

---

## 9. Success Metrics

```yaml
Recipe Hit Rate:       ">30% of requests match a recipe within 30 days"
Fast-Path Rate:        ">10% use Tier 3 replay for recurring classes"
Optimization Gain:     ">20% avg token reduction via Tier 1"
Recipe Freshness:      ">90% validated against current tests within 7 days"
Meta-Distillation:     "All classes with >34 recipes have composite"
```

---

## 10. Security

All recipes ML-DSA signed. Tier 3 recorded outputs encrypted at rest (AES-256-GCM). Replay requires same auth level as original task. Soft-delete only, audit trail on all mutations.
