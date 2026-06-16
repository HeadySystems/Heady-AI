# 05 — The Model Mesh (Liquid Gateway, providers, council)

> How Heady talks to every LLM/embedding provider through one governed chokepoint. **What · Why · How ·
> When · Where · Disposition.** Canonical spec: ADR-0018.

---

## MM1. The single egress chokepoint — Cloudflare AI Gateway

**What.** Every LLM/embedding call routes Liquid → OpenRouter → **Cloudflare AI Gateway** before reaching
a provider. **Why.** One place for caching, cost, rate-limits, failover, DLP; business code never couples
to a vendor model name. **How.** Edge logging, SHA-256 **exact-match** caching (TTL 3600s), per-tenant/
per-model budgets, mid-stream provider failover, DLP; rate limit 987 RPM (fib(16)). **Semantic caching
default-OFF, per-route opt-in** (poisoning risk); tool-call/personalized outputs exact-match only. If the
gateway itself fails → direct provider calls (bypass cache). **When.** Phase 3. **Where.** ADR-0018,
RouterBee (domain 19). **Disposition:** baseline.

## MM2. Liquid routing — model identity is a *route, not a vendor*

**What.** App/agent code names **route classes** (`class=reason`, `class=longctx`, `class=cheap`,
`class=embed`, `class=voice`); the gateway resolves the provider. **Why.** Swap providers without touching
code; reserve expensive models for what needs them. **How — strategic stance:** **Liquid is the
fast/cheap/private *edge* tier, not the smart tier.** A cheap edge classifier routes:

| Need | Route → model |
|---|---|
| intent/classify | LFM2-350M |
| summarize/extract | LFM2-1.2B-Extract |
| cheap tool-calls | LFM2-1.2B-Tool |
| real-time voice | LFM2.5-Audio-1.5B |
| speed on large open models | **Groq** (llama-3.3-70b) |
| frontier reasoning (math/code/long planning) | **Claude Opus/Sonnet** |
| long-context multimodal | **Gemini Pro** |
| deep agentic | **OpenAI o-series / GPT-5** |
| edge embedding | **Cloudflare Workers AI** (`@cf/bge-small-en-v1.5`, 384-D) |
| cost-free distilled | local distilled models on Colab GPU |

**Routing formula:** `phi_weight × csl × (1/latency_ms) × budget_factor`, where
`budget_factor = σ(−5 × (daily_spend/budget − 0.8))` — steers to cheaper providers as spend approaches
the cap without hard-cutting until exhausted. **Liquid licensing:** LFM Open License v1.0 — **"open
weight," never "open source."** Access: OpenRouter (cloud first line), self-hosted vLLM/SGLang on Cloud
Run GPU, WebGPU+ONNX in a Worker (client-side privacy), LEAP Edge SDK (mobile). Normalize LFM2's Pythonic
tool-call tokens (`<|tool_call_start|>`) to OpenAI `tool_calls[]`. **Disposition:** baseline (ADR-0018).

## MM3. The 9-tier provider mesh

tier_1 Anthropic (reasoning/code/orchestration) · tier_2 Groq (low-latency classify) · tier_3 OpenAI
GPT-4o (fallback) · tier_4 OpenAI embeddings (1536-D) · tier_5 Perplexity Sonar Pro (web-grounded
research) · tier_6 HuggingFace (fine-tune on Colab) · tier_7 Google Gemini (edge via Vertex) · tier_8
Cloudflare Workers AI (edge embed/classify) · tier_9 local distilled (cost-free). **Org-segmented keys:**
HeadySystems / HeadyAI / HeadyConnection / personal. **Gateway behaviors borrowed:** LiteLLM (priority
order, weighted shuffle, Redis cooldowns, fallbacks), Portkey (real circuit-breaking on P99 + error rate
with active probes), OpenRouter (`:nitro`/`:floor`, `cost_quality_tradeoff`). **Disposition:** baseline;
provider list = `PROVIDER_AND_OSS_MASTER_PLAN.md`.

## MM4. Multi-Model Council / Battle Arena

**What.** For high-stakes decisions, multiple models compete and cross-critique. **How.** stage_1 query →
Claude/GPT-4o/Gemini/Groq in parallel; stage_2 anonymous cross-critique on the 5-dim rubric (correctness
.34 / safety .21 / perf .21 / quality .13 / elegance .11); stage_3 chairman aggregation with weighted
consensus; **Byzantine quorum N≥3f+1**. **Token economics:** 85% of queries handled single-model at
confidence >0.85 (the council is the exception, not the default). **When.** Pipeline stages 09/10 for
high-stakes; eval judge model **never the same family as the agent under test**. **Where.**
`heady-battle-arena`, `heady-multi-model`, BrainBee. **Disposition:** baseline for high-stakes; single-
model fast-path by default (cost — ADR-0012).

## MM5. `phi_circuit_breaker` (lives in the gateway)

Per-PR/per-day cost ceilings, P99 latency + error-rate breaking with active recovery probes, budget-
factor steering, and (for the coder loop) the additional trips in `06-G8`. **Disposition:** baseline; the
gateway is a critical path → needs its own SLO + failover-to-direct (ADR-0011).

**Disposition rollup:** the model mesh is canonical and largely uncontested — V9, the liquid-latent-OS
report, and v2 all converge on AI-Gateway-as-chokepoint + Liquid-as-edge-tier + frontier-on-demand. The
only discipline added is budget-aware routing (ADR-0010/0012) and semantic-cache-default-off.
