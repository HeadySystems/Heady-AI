# Heady's liquid architecture: a self-healing AI platform across 10 services

**Heady can run as a globally distributed, self-improving AI platform for roughly $600–750/month by strategically layering Cloudflare's edge, GCP/Azure cloud compute, Upstash's serverless data tier, Neon Postgres for persistent memory, and four Colab Pro+ GPU runtimes as a continuous learning engine.** The architecture achieves resilience through a "liquidity layer" where every critical function has a fallback provider, every state is checkpointed, and every model improves via a DSPy/LoRA optimization loop running on a dedicated GPU. Below is the complete blueprint — service by service — with specific configurations, code patterns, and cost estimates that make every dollar count.

---

## 1. Upstash Redis: the sub-millisecond nervous system

Upstash Redis serves as Heady's **T0 working memory** — the fastest tier where ephemeral state lives and dies within minutes. Its serverless, HTTP-based access pattern means zero connection management from Cloudflare Workers or any edge function.

**Key namespace structure** for multi-tenant operations follows a strict hierarchy:

```
tenant:{id}:session:{sid}          → Hash (TTL: 30 min sliding)
tenant:{id}:job:{jid}:status       → String (TTL: 48 hrs)
tenant:{id}:cache:llm:{hash}       → String (TTL: 1–24 hrs)
tenant:{id}:pipeline:tasks         → Stream (MAXLEN ~100K)
tenant:{id}:quota:api              → Rate limiter (auto-TTL)
heady:worker:{wid}:heartbeat       → String (TTL: 30 sec SETEX)
heady:swarm:{name}:roster          → Set (no TTL, managed)
```

Always place the tenant ID first so `SCAN tenant:acme:*` enables tenant-scoped operations. Use `{tenant_id}` hash tags for Redis Cluster key co-location.

**Redis Streams power the 22-stage pipeline.** Each stage consumes from a stream via `XREADGROUP` with consumer groups, processes its task, then `XACK`s completion and `XADD`s to the next stage's stream. Dead worker recovery runs every 30 seconds via `XAUTOCLAIM` with a 5-minute idle threshold — any message stuck in a dead worker's pending entry list gets reclaimed automatically. After 3 failed deliveries (tracked via `XPENDING`), messages route to a dead-letter stream for manual inspection.

**Upstash QStash** ($1 per 100K messages) handles HTTP-based task dispatch for cross-service orchestration. Rather than maintaining persistent connections, QStash pushes messages to your Cloud Run or Cloudflare Worker endpoints with automatic retries, dead letter queues, and CRON scheduling. Retries are free and don't count toward message quotas.

**Upstash Workflow** extends QStash into durable execution. Each workflow step's result persists, so if a serverless function times out mid-execution, the next invocation replays from the last checkpoint. The critical `context.call()` method offloads HTTP calls to QStash itself — your compute pays zero while waiting for external APIs.

**The Workflow Agents API** is where orchestration gets intelligent. Define agents with `context.agents.agent({ model, name, maxSteps, tools, background })`, then create tasks via `context.agents.task({ agents: [researcher, writer], prompt })`. A manager LLM automatically decides which agents to invoke. Flow control prevents API rate limit breaches: `flowControl: { key: "openai", ratePerSecond: 10, parallelism: 5 }`.

**Upstash Vector** (DiskANN-based, not HNSW) provides edge-native vector search up to **1,536 dimensions** at $0.40 per 100K queries. Namespaces isolate tenant data within one index. Use this for lightweight RAG at the edge; reserve pgvector in Neon for heavier analytical queries.

**Rate limiting** via `@upstash/ratelimit` runs in three modes — fixed window, sliding window, and token bucket. For LLM token metering, use the token bucket with custom `rate` parameter: `ratelimit.limit(userId, { rate: tokenCount })`. The sliding window algorithm is recommended for API rate limiting as it smooths burst traffic.

---

## 2. Neon Postgres: the T1 persistent memory with vector intelligence

Neon is Heady's durable memory — conversations, execution traces, pipeline states, and high-dimensional embeddings all live here. Its **copy-on-write branching** means you can create an instant staging database from production in under a second, regardless of data size, with zero storage duplication until writes diverge.

**Optimal pgvector HNSW parameters for 1536D embeddings** scale with data volume:

| Scale | `m` | `ef_construction` | `ef_search` | Index memory |
|-------|-----|-------------------|-------------|-------------|
| 10K vectors | 16 | 64 | 40 | ~100 MB |
| 100K vectors | 16 | 128 | 100 | ~1 GB |
| 1M vectors | 24 | 200 | 200 | ~15–18 GB |

Always use `vector_cosine_ops` for normalized embeddings (OpenAI, Cohere). Build indexes *after* bulk loading data, and set `maintenance_work_mem` to at least `N × 1536 × 4 × 2` bytes during creation. Consider `halfvec` (float16) for 50% storage reduction with negligible recall loss.

**The schema** centers on seven core tables — `user_profiles`, `conversations`, `messages`, `execution_traces`, `pipeline_states`, `recipe_registry`, and `audit_logs` — each with appropriate pgvector columns. Execution traces follow OpenTelemetry's span model with `trace_id` and `parent_span_id` for distributed tracing reconstruction. The recipe registry supports both full-text search (GIN index on `tsvector`) and semantic search (HNSW on description embeddings) for hybrid retrieval.

**From Cloudflare Workers**, use **Hyperdrive** (free with Workers Paid) for connection pooling rather than the Neon serverless driver directly. Hyperdrive maintains warm connection pools near Neon's region, eliminating ~7 TCP/TLS round-trips per connection. Use the native `pg` driver with `env.HYPERDRIVE.connectionString` — not `@neondatabase/serverless`. For one-shot queries from non-Cloudflare edges, the Neon serverless driver's HTTP mode provides the lowest latency.

**Neon autoscaling** on the Launch plan ($0.14/CU-hour) lets compute scale between 0.25 and 16 CU. Scale-to-zero suspends idle computes after a configurable timeout, making dev/staging branches essentially free. For Heady's moderate production load, **a 0.5–2 CU autoscaling range costs roughly $25–55/month**.

The **Neon MCP Server** enables AI-driven database management directly from coding assistants — safe migrations via temporary branches, schema comparison, and performance tuning through `pg_stat_statements` analysis.

---

## 3. Cloudflare: the global edge with stateful AI agents

Cloudflare Business ($200/month) plus Workers Paid ($5/month) forms Heady's global edge layer. This combination provides **10 million Worker requests/month**, Durable Objects, Queues, R2, Vectorize, AI Gateway, and Browser Rendering.

**The Cloudflare Agents SDK** is the centerpiece for user-facing AI. Each user gets a Durable Object-backed agent instance with built-in SQLite storage, WebSocket connections, and scheduled tasks. The `AIChatAgent` class handles streaming AI chat with automatic message persistence and resumable streams. Agents hibernate when idle (zero cost) and wake on demand — the WebSocket Hibernation API eliminates billing for idle connections. This is ideal for Heady's per-user agent instances.

**AI Gateway** (free, unlimited) serves as the unified proxy for *all* LLM calls across OpenAI, Anthropic, Google, Azure, HuggingFace, and Workers AI. Change your base URL to `https://gateway.ai.cloudflare.com/v1/{account}/{gateway}/{provider}` and gain response caching (up to 90% latency reduction for repeated queries), automatic fallback across providers, per-user rate limiting, and cost analytics across every provider from a single dashboard.

**Workers AI** provides edge inference with a free daily allocation of **10,000 neurons**. Key models include Llama 3.3-70B ($0.29/$2.25 per M tokens), Qwen3-30B ($0.05/$0.34), and BGE-M3 embeddings ($0.012/M tokens). Use Workers AI for lightweight tasks — classification, routing, embedding generation — while routing complex reasoning through AI Gateway to Gemini or GPT.

**R2's zero-egress pricing** ($0.015/GB storage, $0 egress) makes it the default blob store for model artifacts, training data, and logs. A 100GB model registry costs roughly $1.50/month with unlimited downloads across all GPU runtimes.

**Cloudflare Queues** (1M operations/month included) handle task distribution with push-based or pull-based consumers, configurable retries, and dead letter queues. **Vectorize** supports up to 1,536 dimensions with IVF+PQ compression, ideal for supplementary edge-side RAG alongside pgvector.

**Estimated Cloudflare total: $235–305/month** at moderate scale, including the Business domain plan, Workers compute, Durable Objects, R2, and Workers AI inference.

---

## 4. Google Cloud: the $250 compute backbone

GCP provides Heady's primary serverless compute and Gemini model access. The optimal allocation prioritizes **Cloud Run** and **Gemini Flash-Lite** as the highest-value services.

**Cloud Run configuration**: One always-on instance (1 vCPU, 2 GiB, `min-instances=1`) eliminates cold starts for **~$75/month**. Set concurrency to 80–250 for API routing, 10–50 for AI inference orchestration. Secondary services scale to zero with acceptable 2–5 second cold starts. At 10K requests/day averaging 500ms each, request-based compute costs roughly $4.20/month — well within the free tier of 2M requests.

**Gemini 2.5 Flash-Lite** ($0.10/$0.40 per M tokens) is the cost-optimal default model for Heady's high-volume workloads. Flash ($0.30/$2.50) handles complex reasoning. The **Model Optimizer** provides automatic routing between Flash-Lite, Flash, and Pro based on query complexity — configure with `feature_selection_preference: "BALANCED"` for optimal cost-quality tradeoff. The **batch API** offers 50% savings for non-real-time tasks, and **context caching** saves 75%+ on repeated system prompts.

**Firebase services are entirely free** and high-value: Cloud Messaging for push notifications (unlimited), Remote Config for feature flags (instant, no-deploy changes), and Crashlytics + Analytics for client monitoring. All work on Firebase's free Spark plan.

**BigQuery** (1 TB queries + 10 GB storage free) stores execution traces, cost analytics, and model performance data. **Pub/Sub** (10 GiB/month free) handles event-driven messaging between GCP services. **Secret Manager** (~$1.50/month for 20 secrets) replaces all `.env` files with native Cloud Run integration.

**Budget breakdown**: ~$155–245/month, with $250 credit lasting **4–8 weeks** depending on Gemini token consumption. During development, credits stretch to 2–3 months.

---

## 5. Azure: GPT models and free-tier infrastructure

Azure's $200 credit complements GCP by providing exclusive GPT model access and a permanently free Cosmos DB instance.

**Azure OpenAI Service** is the sole enterprise-grade path to GPT models with data privacy guarantees — your data never trains OpenAI's models. **GPT-5-nano** ($0.05/$0.40 per M tokens) matches Gemini Flash-Lite pricing for classification and routing. **GPT-4.1-mini** ($0.40/$1.60) handles mid-complexity tasks. Use Azure for GPT workloads and GCP for Gemini — never duplicate model providers across clouds.

**Azure Cosmos DB free tier** is permanent (not a trial): **1,000 RU/s + 25 GB storage**, supporting ~1,000 reads/second or ~200 writes/second. Use it for global state distribution — agent configurations, feature flags, and session state that needs multi-region access. The free tier includes turnkey global distribution.

**Azure Container Apps** mirrors Cloud Run's free tier (180K vCPU-seconds/month) and adds serverless GPU support (T4, A100) with scale-to-zero — a strong backup compute option or dedicated inference endpoint. **Azure Key Vault** costs effectively $0 at development scale.

Skip Azure AI Search ($73+/month minimum) — pgvector on Neon provides comparable hybrid search capabilities at a fraction of the cost.

**Budget without AI Search: ~$55–90/month**, with $200 credit lasting **2–3 months**. With GPT-5-nano as the primary Azure model, costs can drop to ~$20–30/month for 6–8 months of runway.

The **Azure vs GCP decision framework** is straightforward: Azure for GPT models and Cosmos DB free tier; GCP for Gemini, Cloud Run primary compute, and Firebase services; Cloudflare for everything at the edge.

---

## 6. HuggingFace: the model registry and open-source backbone

HuggingFace serves three roles: model registry for custom fine-tuned models, free inference for development, and the SmolAgents framework for lightweight agent patterns.

**Three HF tokens enable round-robin rate limit distribution.** Each token is tied to a separate account with independent rate limits and inference credits. Rotate tokens across requests: `tokens[requestCount % 3]`. PRO subscriptions ($9/month each) provide 20× inference credits per account.

**HuggingFace Hub** stores all custom model versions with git-based versioning and semantic tags. After each LoRA fine-tuning run on Colab, push adapters with `model.push_to_hub("heady/lora-adapter-v3")` and pull specific versions in deployment with `revision="v3.0"`.

**SmolAgents** (~1,000 lines of core code) provides the lightest agent framework available. `CodeAgent` writes actions as Python code rather than JSON tool calls, requiring ~30% fewer LLM steps. It's model-agnostic (works with any provider via LiteLLM), supports MCP tools, and runs in sandboxed environments. Use it for orchestration tasks that don't need the full weight of Upstash Workflow Agents.

**Text Generation Inference (TGI) v3** claims **3× more tokens processed than vLLM** and 13× faster on long prompts with prefix caching. Deploy on Azure Container Apps with serverless GPUs for production inference, or on Colab for development.

**Optimum** handles model optimization: **AWQ** quantization for fastest inference speed, **GPTQ** for best accuracy preservation, and **bitsandbytes** 4-bit for quick prototyping. Quantize *before* fine-tuning for better results.

**GitHub Models** provides free GPT-4o and GPT-4.1 inference during development using your GitHub PAT — excellent for testing pipelines without burning cloud credits.

---

## 7. GitHub CI/CD: monorepo efficiency across 84 repos

With 84 repos across three orgs, CI/CD efficiency is critical. The combination of **Turborepo filtering + remote caching + reusable workflows** reduces build times by 10×.

**The core CI pattern** uses `turbo run build test --filter='...[origin/main...HEAD]'` to execute tasks only for packages changed since main, including dependents. This transforms a 45-task full build into 4–8 affected tasks per PR. Remote caching via Vercel (or `felixmosh/turborepo-gh-artifacts` for GitHub-native caching) ensures any build artifact computed by one developer or CI run is reused by all others.

**GitHub Actions minutes**: Three orgs on free tier provide **6,000 minutes/month** total (2,000 per org). With Turbo filtering and remote caching, typical monorepo CI runs complete in 3–5 minutes per PR, supporting roughly 40–60 PRs/day within budget.

**A single GitHub App** (not PATs) should be installed across all three orgs. It provides org-owned authentication independent of individual users, short-lived tokens (1-hour default), fine-grained per-repo permissions, and higher rate limits (5,000–15,000 requests/hour scaling with org size). Use `actions/create-github-app-token` in workflows.

**Dependabot** with grouped updates keeps dependencies current. Group all patch/minor production dependencies into one PR and all dev dependencies into another. Auto-merge non-major updates with the `dependabot/fetch-metadata` action. For complex pnpm monorepo lockfile handling, consider **Renovate** as a more robust alternative.

**GitHub Packages** serves as the private npm registry for shared internal packages (`@heady/shared`, `@heady/types`). Configure `.npmrc` with `@heady:registry=https://npm.pkg.github.com` across all repos. Storage: 500 MB free on Free plan, 2 GB on Pro.

---

## 8. Sentry: observability across 21 distributed nodes

Sentry Business ($80/month base) provides the observability foundation with unlimited projects, SSO, anomaly detection, and unlimited dashboards.

**Project structure**: Create one Sentry project per service/microservice, organized under Sentry teams that mirror the three GitHub orgs (HeadyMe, HeadySystems, HeadyAI). Use environments (`dev`, `staging`, `production`) per project rather than separate projects per environment. All Sentry plans include **unlimited projects** — no cost penalty for creating 84+.

**Distributed tracing** across the 21-node pipeline requires only `Sentry.init({ dsn, tracesSampleRate: 0.1 })` in each Node.js service. Sentry's Node.js SDK v8+ includes **built-in OpenTelemetry support** — it automatically creates spans, propagates `sentry-trace` and `baggage` headers across HTTP calls, and renders correlated traces in a single waterfall view. You can simultaneously export spans to both Sentry and a secondary backend (Grafana, Jaeger) via `SentrySpanProcessor`.

**Sentry Crons** monitors the 29,034ms heartbeat cycle. Use the interval schedule type (not crontab, which has 1-minute minimum granularity) with `failureIssueThreshold: 3` to alert only after three consecutive misses, preventing noise from transient network blips.

**Sentry Seer AI** ($20/month add-on) achieves **94.5% accuracy** in automated root cause analysis across distributed systems. It analyzes stack traces, spans, commits, and profiling data to identify root causes and can automatically generate fix PRs pushed to GitHub. For a complex distributed AI platform, this is exceptionally high-value.

**Continuous profiling** with `@sentry/profiling-node` uses V8's CpuProfiler at 100Hz to identify bottlenecks in pipeline stages without manual instrumentation. Set `profileSessionSampleRate: 0.1` in production.

**Cost optimization**: Use `beforeSend` to drop non-actionable errors (30–60% volume reduction), set `replaysOnErrorSampleRate: 1.0` with `replaysSessionSampleRate: 0.1` to capture replays only on errors, and purchase reserved volume for 20% savings over pay-as-you-go. **Estimated total: $100–200/month** for moderate usage.

---

## 9. Four Colab Pro+ runtimes: the GPU training cluster

The 2,000 monthly compute units across four Colab Pro+ memberships ($200/month total) form Heady's dedicated GPU cluster for training, inference, and self-improvement.

**Optimal GPU allocation and CU budget**:

| Runtime | GPU | CU/hr | Budget | Hours/mo | Role |
|---------|-----|-------|--------|----------|------|
| **Alpha** | A100 40GB | ~5.4 | 500 CU | ~93 hrs | LoRA/QLoRA fine-tuning |
| **Beta** | T4 | ~1.2 | 200 CU | ~168 hrs | Embedding generation, index rebuilds |
| **Gamma** | L4 | ~1.7 | 800 CU | ~468 hrs | vLLM/TGI inference serving |
| **Delta** | T4/CPU | ~1.2/0.07 | 200 CU | ~168+ hrs | DSPy optimization, benchmarking |
| **Buffer** | — | — | 300 CU | — | Overflow for spikes |

The A100's 40 GB VRAM trains 7B models with QLoRA at **13× the speed of T4**. Using Unsloth, a full epoch over 10K examples completes in 1–2 hours. The L4's 22.5 GB VRAM comfortably serves AWQ-quantized 7B models via vLLM at 30–50 tokens/second.

**Tailscale mesh networking** connects all four runtimes via WireGuard VPN. Each notebook runs `tailscale up --authkey=tskey-auth-XXXXX --hostname=runtime-alpha` to join the mesh. Inter-runtime latency is ~50–100ms through DERP relays (Colab VMs sit behind NAT). Services are addressable by hostname: `http://runtime-gamma:8000/v1`.

**Exposing runtimes to Cloud Run/Workers** uses Cloudflare Tunnels (`cloudflared tunnel --url http://localhost:8000`) for zero-config public endpoints, or ngrok for stable custom domains. For production reliability, a small persistent VPS on the Tailscale mesh acts as a stable relay between ephemeral Colab sessions and cloud services.

**Session resilience**: Colab Pro+ supports 24-hour continuous execution with background mode. Checkpoint every 500 training steps to Google Drive and HuggingFace Hub simultaneously. Design all processes as resumable — load the latest checkpoint on session start.

---

## 10. Runtime Delta: how Heady gets genuinely smarter over time

This is the system's most important capability. Runtime Delta runs a **MAPE-K self-improvement loop** (Monitor → Analyze → Plan → Execute → Knowledge) that continuously optimizes prompts, fine-tunes weights, and improves embeddings.

**The weekly improvement cycle:**

- **Days 1–5 (Monitor)**: Log all production interactions with quality signals — user feedback, task success/failure, response latency, token efficiency. Store execution traces in Neon's `execution_traces` table with input embeddings.

- **Day 5 (Analyze)**: Score traces using an LLM-as-Judge (Gemini Flash evaluating Heady's outputs) or reward model. Filter for top-performing traces (score > threshold). Identify failure patterns and knowledge gaps via clustering on trace embeddings.

- **Day 6 (Execute — Prompt Optimization)**: Run **DSPy MIPROv2** or **GEPA** on Runtime Delta. DSPy's optimizers use Bayesian optimization over instructions and few-shot demonstrations, requiring 30+ examples (300+ ideal). This is primarily API-call-bound, not GPU-bound — a CPU instance at 0.07 CU/hour suffices. Cost: ~$5–50 in API calls per optimization run.

- **Day 6 (Execute — Weight Optimization)**: QLoRA fine-tune on Runtime Alpha (A100) using filtered traces formatted as instruction-following data. With Unsloth + TRL's `SFTTrainer`, 10K training examples complete in ~1–2 hours at ~5.4 CU/hour. Push the new LoRA adapter to HuggingFace Hub.

- **Day 7 (Execute — Embedding Refinement)**: Fine-tune the embedding model on Runtime Beta (T4) using Sentence Transformers v3 with `MultipleNegativesRankingLoss`. Collect `(query, successfully_retrieved_context)` pairs from production. Training completes in under 10 minutes and costs <$0.10.

- **Day 7 (Evaluate → Deploy)**: Run automated benchmarks comparing old vs. new model versions. Use `lm-evaluation-harness` for standard benchmarks plus custom task-specific test sets (50–200 examples per task). **Deploy only if the new version beats the old on the benchmark suite.** Version everything on HF Hub for instant rollback.

**DPO over PPO for preference alignment**: Direct Preference Optimization folds reinforcement learning into a single supervised step without an explicit reward model. It requires less GPU memory (~1× vs ~2× for PPO) and is better suited to Colab's constraints. Use TRL's `DPOTrainer` with `LoraConfig(r=16, lora_alpha=16)`.

**Knowledge distillation** trains smaller, faster models from larger model outputs. Generate a synthetic dataset by running GPT-4/Gemini Pro on domain-specific prompts, then QLoRA fine-tune a 7B model (Qwen 2.5 or Llama) on these outputs. For production use, distill exclusively from open-source teacher models (not GPT-4, due to TOS restrictions).

---

## 11. The unified liquid architecture: wiring everything together

### Data flow for a typical user request

```
User → Cloudflare WAF/DDoS → CF Worker (Agents SDK)
  → Upstash Redis (session check, rate limit)
  → AI Gateway (route to optimal LLM)
  → Cloud Run (pipeline orchestration)
  → Upstash QStash (durable task dispatch)
  → Redis Stream → Colab Runtime Gamma (vLLM inference)
  → Neon Postgres (store conversation, trace)
  → CF Worker → User (streaming response via WebSocket)
```

### The liquidity layer: resilience when components fail

Every critical function has a designated failover:

- **LLM inference**: AI Gateway auto-falls back from Gemini → GPT → Workers AI → Colab vLLM
- **Vector search**: Cloudflare Vectorize (edge) → pgvector/Neon (primary) → Upstash Vector (backup)
- **Task queues**: Upstash Redis Streams (primary) → Cloudflare Queues (fallback) → QStash (durable)
- **Compute**: Cloud Run (primary) → Azure Container Apps (backup) → Cloudflare Workers (edge)
- **Secrets**: GCP Secret Manager (primary) → Azure Key Vault (backup) → Cloudflare Worker env vars (emergency)
- **State**: Redis (T0 ephemeral) → Neon (T1 persistent) → Cosmos DB (T2 global) → R2 (T3 archive)
- **GPU**: Colab runtimes (primary) → HF Inference Endpoints (backup) → Workers AI (degraded edge mode)

The system detects component failure via Sentry Crons (heartbeat monitoring) and Upstash Redis heartbeats (`SETEX` with 30-second TTL). When a worker misses 3 consecutive heartbeats, `XAUTOCLAIM` redistributes its pending tasks. When a Colab runtime disconnects, the Tailscale mesh detects it within seconds, and the orchestrator routes inference to HuggingFace Inference Endpoints or Workers AI as a degraded fallback.

### Monthly cost budget

| Service | Monthly cost |
|---------|-------------|
| Cloudflare Business + Workers Paid | $205 base + ~$50 variable |
| GCP Cloud Run + Gemini + services | $155–245 (from $250 credit) |
| Azure OpenAI + free-tier services | $55–90 (from $200 credit) |
| 4× Colab Pro+ | $200 (4 × $49.99) |
| Neon Postgres (Launch plan) | $25–55 |
| Upstash Redis + QStash + Vector | $15–40 |
| Sentry Business + Seer | $100–120 |
| HuggingFace (PRO × 1 account) | $9 |
| **Total** | **$600–750/month** |

The GCP and Azure credits provide 2–3 months of runway before those services begin billing. After credits expire, optimize by shifting more inference to Workers AI and Gemini Flash-Lite, using batch APIs for non-real-time tasks, and aggressively caching via AI Gateway.

### Security posture

Secrets live exclusively in GCP Secret Manager and Azure Key Vault — never in `.env` files or code. Inter-service communication uses mTLS where supported (Cloud Run ↔ Cloud Run, Cloudflare ↔ origin). The Cloudflare Business WAF provides 100 custom rules plus ML-based Attack Score Lite for zero-day SQLi/XSS detection. For PQC readiness, implement ML-DSA-65 signatures on critical API payloads — the algorithm is standardized (FIPS 204) and Node.js 22 supports it via the `crypto` module with appropriate libraries.

### Monitoring stack

Sentry handles errors, performance traces, and profiling. OpenTelemetry spans flow from every Node.js service through Sentry's built-in OTel processor, with optional dual-export to Grafana Cloud's free tier (50 GB logs, 10K metrics) for dashboarding. Sentry Crons monitors the 29,034ms heartbeat. Firebase Analytics tracks user behavior. BigQuery stores long-term execution traces for trend analysis. The Sentry Seer AI agent automatically classifies errors and generates fix PRs — closing the loop between observability and code improvement.

## Conclusion: the flywheel that makes it work

The architecture's defining quality isn't any single service — it's the feedback loop. Production interactions generate execution traces stored in Neon. Runtime Delta scores these traces, optimizes prompts via DSPy, fine-tunes weights via QLoRA, and improves embeddings via domain-specific training. New model versions deploy only after beating benchmarks, with instant rollback via HuggingFace Hub versioning. This creates a genuine flywheel: **more usage → better training data → smarter models → better user experience → more usage**.

Three design decisions make the economics work. First, Cloudflare AI Gateway's response caching eliminates redundant LLM calls — identical queries hit cache instead of billing tokens. Second, Gemini Flash-Lite at $0.10 per million input tokens makes high-volume AI affordable. Third, Colab Pro+'s 2,000 monthly compute units provide A100-class GPU access at $0.10/CU — roughly 10× cheaper than on-demand cloud GPUs.

The system runs 24/7 by design: Cloud Run and Cloudflare Workers never sleep (min-instances=1), Redis Streams queue tasks during GPU runtime transitions, and the liquidity layer ensures every function has a fallback. When Colab sessions cycle, state recovery takes under 60 seconds from the last checkpoint. The liquid architecture isn't about preventing failure — it's about making failure invisible to users while the system quietly heals, learns, and improves.
