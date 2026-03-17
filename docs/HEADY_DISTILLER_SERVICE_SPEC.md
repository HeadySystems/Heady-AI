# heady-distiller Service Specification v1.0

> **Node:** heady-distiller | **Port:** 3398 | **Transport:** streamable-http
> **Purpose:** Reverse-engineer successful execution traces into optimized, deterministic execution recipes
> **Based on:** DSPy GEPA (ICLR 2026 Oral), TextGrad (Nature 2024), Temporal.io Event History,
>              SWE-Gym trajectory filtering, Voyager skill synthesis, AgentRR record-and-replay
>
> © 2026 HeadySystems Inc. — Eric Haywood, Founder

---

## 1. Why This Service Exists

The Heady platform currently has the Buddy Deterministic Optimization Loop (§24 of the super prompt) which turns **errors into structural armor**. The heady-distiller is the inverse: it turns **successes into reusable navigation maps**. Every time the 22-stage HCFullPipeline completes successfully with a JUDGE score ≥ 0.85, the distiller captures the full execution trace and distills it into a tiered recipe that can accelerate or skip-ahead future similar requests.

The core insight, validated by multiple research teams in 2025-2026: recording the non-deterministic inputs (LLM responses, API results, timing) rather than re-executing them creates a deterministic replay oracle. And optimizing prompts from successful traces (via DSPy GEPA) outperforms reinforcement learning by +6% average while using 35× fewer rollouts.

---

## 2. Service Architecture

```
                    ┌─────────────────────────────────────────────────┐
                    │              heady-distiller :3398               │
                    │                                                  │
  Stage 20 ────────►│  Trace Capture  ──► Success Filter  ──► Router  │
  (RECEIPT)         │       │                    │               │     │
                    │       ▼                    ▼               ▼     │
                    │  Event Log          Quality Gate       Tier 1   │
                    │  (JSONL)           (JUDGE ≥ 0.85)     Tier 2   │
                    │                                        Tier 3   │
                    │       ▲                                  │      │
  Stage 03 ◄────────│  Recipe Retrieval ◄── Recipe Registry ◄─┘      │
  (CLASSIFY)        │  (AutoContext 2.5)    (Qdrant + JSON)          │
                    └─────────────────────────────────────────────────┘
```

### API Endpoints

```yaml
GET  /health
  → { status, recipes_distilled, avg_optimization_gain, cache_hit_rate }

POST /distill
  body: { trace_id, execution_log, judge_score, pipeline_variant }
  → { recipe_id, tier, sha256, optimization_estimate }
  # Called by Stage 20 RECEIPT after successful completion

POST /retrieve
  body: { intent_embedding: float[1536], task_class: string, min_tier: 1|2|3 }
  → { recipe_id, tier, confidence, fast_path_eligible: boolean, recipe_payload }
  # Called by AutoContext Pass 2.5 before every pipeline run

POST /replay
  body: { recipe_id, input_override: object }
  → Streams execution using recorded trace with optional input substitution
  # Called by Stage 12 EXECUTE when fast-path is approved

GET  /recipes/:id
  → Full recipe payload with metadata, quality metrics, and usage stats

POST /meta-distill
  body: { task_class: string }
  → Compresses accumulated recipes for a class into optimal composite
  # Triggered when recipe count > fib(9) = 34 for a task class

DELETE /recipes/:id
  → Soft-delete with TTL, recipe moves to archive partition
```

---

## 3. Trace Capture Format (Event Sourcing)

Every pipeline execution produces an append-only JSONL trace. Each line is one event in the execution timeline.

```jsonc
// Example trace events (one per line in the JSONL log)
{"ts": 1710576000000, "stage": "CHANNEL_ENTRY", "event": "stage_start", "meta": {"channel": "api", "user_id": "u_abc"}}
{"ts": 1710576001200, "stage": "RECON", "event": "scan_complete", "meta": {"files_scanned": 3447, "duration_ms": 1200}}
{"ts": 1710576003500, "stage": "CLASSIFY", "event": "csl_gate", "meta": {"intent_vector_sha": "a3f2...", "top_class": "CODE_GEN", "score": 0.87}}
{"ts": 1710576005000, "stage": "ORCHESTRATE", "event": "bee_dispatch", "meta": {"bee_type": "coder-bee", "bee_id": "b_123", "model": "claude-sonnet-4"}}
{"ts": 1710576005500, "stage": "ORCHESTRATE", "event": "llm_call", "meta": {"model": "claude-sonnet-4", "input_hash": "ff91...", "output_hash": "c4e2...", "tokens_in": 2340, "tokens_out": 890, "duration_ms": 3200}, "replay": {"input": "...", "output": "..."}}
{"ts": 1710576020000, "stage": "JUDGE", "event": "score", "meta": {"composite": 0.91, "correctness": 0.95, "safety": 1.0, "perf": 0.85, "quality": 0.88, "elegance": 0.82}}
{"ts": 1710576021000, "stage": "RECEIPT", "event": "signed", "meta": {"receipt_sha": "d4a1...", "pqc_sig": "ML-DSA..."}}
```

The critical field for deterministic replay is `replay` on `llm_call` events — it records the exact input and output of every LLM interaction. During replay, these recorded outputs are returned directly instead of making new LLM calls, following the TracedLLMClient / ReplayLLMClient pattern.

---

## 4. Three Distillation Tiers

### Tier 1 — Optimized Prompt (Lightest)

Uses DSPy's GEPA optimizer to refine the prompts that led to success. GEPA maintains a Pareto frontier of prompt candidates, samples proportionally to coverage, and uses LLM reflection to diagnose failure patterns and propose targeted updates. This tier doesn't record specific outputs — it improves the *instructions* that lead to good outputs.

```python
# Pseudocode for Tier 1 distillation
import dspy

class HeadyTask(dspy.Module):
    def __init__(self):
        self.classify = dspy.ChainOfThought("task_description -> intent_class, swarm_assignment")
        self.execute = dspy.ChainOfThought("intent, context -> solution")

    def forward(self, task_description, context):
        classification = self.classify(task_description=task_description)
        return self.execute(intent=classification.intent_class, context=context)

# Distill from successful traces
optimizer = dspy.GEPA(
    metric=heady_judge_metric,  # Wraps the JUDGE 5-dim rubric
    reflection_lm="anthropic/claude-sonnet-4",
    max_metric_calls=150
)
optimized_task = optimizer.compile(
    HeadyTask(),
    trainset=successful_traces,  # Filtered by JUDGE ≥ 0.85
    valset=held_out_traces
)

# Store optimized prompt
save_recipe(tier=1, prompt=optimized_task.dump_state(), task_class="CODE_GEN")
```

**Storage:** prompts/ directory in heady-production, versioned with SHA-256 hash.
**Retrieval:** Semantic search by intent embedding, applied when CSL score ≥ PSI_SQ (0.382).
**Cost:** ~150 LLM calls per optimization run (one-time, amortized over all future uses).

### Tier 2 — Pipeline Configuration (Medium)

Extracts abstract "tips" with explicit applicability conditions from execution traces, following the Trajectory-Informed Memory Generation pattern (arXiv:2603.10600). These aren't raw traces — they're generalized configuration insights.

```yaml
# Example Tier 2 recipe
recipe_id: "r2_code_gen_typescript_module"
task_class: "CODE_GEN"
applicability: "TypeScript module creation in heady-production/src/"
confidence: 0.89
config:
  pipeline_variant: "full"  # not "fast" — full 22 stages needed
  skip_stages: [8, 9]       # MONTE_CARLO and ARENA not needed for routine code-gen
  model_routing:
    classify: "groq/llama-3.3-70b"  # fast classification is sufficient
    execute: "anthropic/claude-sonnet-4"  # Sonnet for implementation
    review: "anthropic/claude-sonnet-4"   # same model for self-review
  bee_config:
    primary: "coder-bee"
    secondary: ["qa-bee", "security-bee"]
    parallel: true
  csl_thresholds:
    classify_gate: 0.72   # slightly above default — this class is well-defined
    execute_gate: 0.65    # standard
  autocontext:
    inject_patterns: ["src/utils/", "src/core/", "tsconfig.json"]
    exclude_patterns: ["src/sites/", "src/ui/"]
tips:
  - "Always check for existing utility functions in src/utils/ before creating new ones"
  - "Include .d.ts type declarations alongside .js files (project convention)"
  - "Run tsc --noEmit before committing — TypeScript errors block CI"
```

**Storage:** wisdom.json distiller section + Qdrant (type: "execution_recipe", tier: 2).
**Retrieval:** Semantic search with applicability condition matching.
**Selective deletion:** When a recipe's success rate drops below PSI_SQ (0.382) over 8+ uses, archive it.

### Tier 3 — Full Execution Recipe (Heaviest)

Complete deterministic replay package: exact prompt, exact configuration, exact DAG topology, recorded LLM outputs, and test assertions that validate the output.

```yaml
# Example Tier 3 recipe (metadata — full payload stored separately)
recipe_id: "r3_auth_flow_social_provider"
task_class: "CODE_GEN"
task_specific: "Add new OAuth social login provider"
judge_score: 0.93
sha256: "a3f29c1b..."
trace_id: "t_20260316_071500"
replay_compatible: true
recorded_llm_calls: 4      # exact responses stored for replay
total_tokens: 12340
duration_ms: 18500
dag:
  nodes: ["classify", "recon-auth", "generate-provider", "generate-test", "verify"]
  edges: [["classify","recon-auth"], ["recon-auth","generate-provider"], ["generate-provider","generate-test"], ["generate-test","verify"]]
  parallel_groups: [["generate-provider","generate-test"]]
test_assertions:
  - "file_exists: src/auth/providers/{provider_name}.js"
  - "file_exists: src/auth/providers/{provider_name}.test.js"
  - "tsc_passes: true"
  - "test_passes: vitest run src/auth/providers/{provider_name}.test.js"
  - "no_localhost: grep -r 'localhost' src/auth/providers/{provider_name}.js | wc -l == 0"
skill_md: |
  ---
  name: add-social-login-provider
  version: 1.0.0
  triggers: ["add oauth provider", "new social login", "integrate {provider} auth"]
  ---
  # Add Social Login Provider
  This skill adds a new OAuth social login provider to the Heady auth system.
  ## Steps
  1. Create provider config in src/auth/providers/
  2. Register in provider-registry.js
  3. Add to the 27-provider matrix in heady-manager
  4. Generate tests
  5. Verify no localhost contamination
```

**Storage:** distiller-registry.json + skill file in skills/ directory.
**Retrieval:** Exact match by task_specific hash, then semantic search fallback.
**Replay:** Stream recorded LLM outputs from trace, verify against test_assertions.

---

## 5. Recipe Routing Logic

When a new request enters the pipeline, AutoContext includes a distiller retrieval pass (Pass 2.5):

```javascript
// Pseudocode for recipe routing in AutoContext
async function distillerRetrievalPass(intentVector, taskDescription) {
  // Search recipe registry by semantic similarity
  const recipes = await qdrant.search('distiller_recipes', {
    vector: intentVector,
    score_threshold: PSI_SQ, // 0.382 — wide net
    limit: 5
  });

  if (!recipes.length) return { action: 'PROCEED_NORMAL' };

  const bestRecipe = recipes[0];

  // Tier 3: exact replay eligible
  if (bestRecipe.tier === 3 && bestRecipe.score >= PSI) {
    return {
      action: 'FAST_PATH',
      recipe: bestRecipe,
      skip_to: 'EXECUTE',
      confidence: bestRecipe.score
    };
  }

  // Tier 2: pipeline config optimization
  if (bestRecipe.tier === 2 && bestRecipe.score >= PSI_SQ) {
    return {
      action: 'OPTIMIZE_CONFIG',
      config: bestRecipe.config,
      tips: bestRecipe.tips
    };
  }

  // Tier 1: prompt enhancement
  if (bestRecipe.tier === 1) {
    return {
      action: 'INJECT_PROMPT',
      prompt_override: bestRecipe.prompt
    };
  }

  return { action: 'PROCEED_NORMAL' };
}
```

---

## 6. Meta-Distillation

When a task class accumulates more than fib(9) = 34 recipes, the meta-distiller compresses them into a single optimal composite recipe. This prevents unbounded recipe growth and surfaces the "consensus route" from many successful executions.

The meta-distillation process uses CSL CONSENSUS gate: `normalize(Σwᵢ · recipe_vectorᵢ)` where weights are JUDGE composite scores. The resulting composite recipe represents the centroid of successful execution strategies for that task class.

Selective deletion (from arXiv:2603.10600 findings): recipes with declining success rates are archived, not just accumulated. The system tracks `uses`, `successes`, `last_used`, and archives recipes where `success_rate < PSI_SQ` over the last 8+ uses.

---

## 7. Implementation Files to Create

```
src/distiller/
├── distiller-node.js          # Express/Hono service, port 3398, all API endpoints
├── trace-capture.js           # Event sourcing: JSONL append, SHA-256 chain
├── success-filter.js          # Quality gate: JUDGE ≥ 0.85, configurable thresholds
├── tier1-prompt-optimizer.js  # DSPy GEPA bridge (calls Python subprocess)
├── tier2-config-extractor.js  # Trajectory → abstract tips with applicability conditions
├── tier3-replay-recorder.js   # Full trace recording + DAG serialization + test generation
├── recipe-registry.js         # Qdrant + JSON storage, search, versioning, archival
├── recipe-router.js           # AutoContext Pass 2.5 integration
├── meta-distiller.js          # Recipe compression when count > 34
├── skill-synthesizer.js       # Voyager pattern: recipe → SKILL.md file
└── dspy-bridge.py             # Python subprocess for DSPy/TextGrad optimization

src/bees/
└── distiller-bee.js           # DistillerBee: spawns after RECEIPT, dispatches tier sub-bees
```

---

## 8. DistillerBee Specification

```javascript
// src/bees/distiller-bee.js
// Follows bee-template pattern from src/bees/bee-template.js

const DistillerBee = {
  type: 'distiller-bee',
  swarm: 'Overmind',  // Reports to Overmind swarm for orchestration
  trigger: 'RECEIPT_SIGNED',  // Fires after Stage 20
  
  preconditions: {
    judge_composite: { min: 0.85 },
    pipeline_variant: { not: 'fast' },  // Don't distill fast-path runs (circular)
    feature_flag: 'ENABLE_DISTILLER'
  },

  execute: async (trace) => {
    // Spawn 3 parallel sub-bees for each tier
    const [tier1, tier2, tier3] = await Promise.allSettled([
      spawnBee('tier1-prompt-optimizer-bee', trace),
      spawnBee('tier2-config-extractor-bee', trace),
      spawnBee('tier3-replay-recorder-bee', trace)
    ]);

    // Store results in recipe registry
    const recipes = [tier1, tier2, tier3]
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    await recipeRegistry.store(recipes);

    // Check if meta-distillation needed
    const classCount = await recipeRegistry.countByClass(trace.task_class);
    if (classCount > 34) {  // fib(9)
      await spawnBee('meta-distiller-bee', { task_class: trace.task_class });
    }

    return { recipes_created: recipes.length, task_class: trace.task_class };
  },

  // φ-scaled resource allocation
  timeout_ms: 4236 * 3,  // 3× default task timeout — distillation is heavier
  max_retries: 3,
  retry_delays: [1000, 1618, 2618]  // φ-scaled
};
```

---

## 9. Success Metrics

```yaml
Recipe Hit Rate:       "% of incoming requests that match a distilled recipe"
  target: ">30% within 30 days of deployment"

Fast-Path Rate:        "% of requests that use Tier 3 replay (skip most pipeline stages)"  
  target: ">10% for recurring task classes"

Optimization Gain:     "Reduction in tokens/latency/cost compared to undistilled execution"
  target: ">20% avg token reduction via Tier 1 prompt optimization"

Recipe Freshness:      "% of recipes validated against current tests within last 7 days"
  target: ">90%"

Meta-Distillation:     "# of task classes with compressed composite recipes"
  target: "All classes with >34 individual recipes"
```

---

## 10. Security Considerations

All recipe payloads are ML-DSA signed. Recorded LLM outputs in Tier 3 recipes are encrypted at rest (AES-256-GCM) since they may contain sensitive context. Recipe retrieval requires the same auth level as the original task. The replay endpoint validates that the caller has permission for the task class before streaming recorded outputs. Recipe deletion is soft-delete with audit trail — no permanent deletion without Eric's approval.

---

> **heady-distiller v1.0 — Where successes become reusable routes.**
> Every successful execution is a map. The distiller reads the map, optimizes the route, and shares it with every future traveler.
