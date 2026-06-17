# ADR-0004: Liquid Gateway — Fastest-Wins Provider Racing with Budget-Aware Failover
**Date:** 2025-06-01 | **Status:** Accepted | **Author:** Eric Haywood

## Context

HeadyAPI publicly describes liquid gateway behaviour as racing 4+ AI providers simultaneously
and auto-failing over. The rebuild needed to decide whether this racing logic lives at the
edge (Cloudflare Worker) or at the origin (Cloud Run), and how budget constraints interact
with live race outcomes.

Routing at origin adds ~20–40ms before any provider response begins. Routing at edge enables
immediate parallel dispatch with the closest network path to each provider's API.

## Decision

Provider racing runs at the **Cloudflare edge**. The gateway dispatches requests in parallel
to all eligible providers and returns the first successful response. Budget-aware scoring
occurs before dispatch: providers whose running cost exceeds their CSL-gated budget ceiling
are removed from the race pool.

Race pool selection order (by default affinity):
1. Claude (Anthropic) — Premium tier reasoning
2. GPT-4o (OpenAI) — General capability
3. Gemini (Google Vertex AI) — Multimodal / grounding
4. Groq — Ultra-low latency (fast tier)
5. Perplexity Sonar — Research / web-grounded tasks
6. Local (Ollama / Colab) — Cost-zero fallback

Failover: if the race winner returns an error, the next-fastest successful response is promoted.
Budget caps follow phi-tiered cost ceilings per Sacred Geometry resource pool tier.

## Consequences

### Positive
- Dramatically reduces P99 latency by eliminating single-provider serial retry chains
- Provider outages are transparent to consumers — failover is sub-second
- Budget caps prevent runaway spend on expensive providers during load spikes
- Edge-side racing means no Cloud Run CPU is consumed waiting for provider responses
- HeadyAPI's public positioning as a liquid gateway is backed by the actual runtime

### Negative
- Parallel dispatch multiplies token costs if multiple providers return usable responses (only first is used but all are billed for partial completions on some APIs)
- Provider-specific prompt formatting must be normalised at the edge before dispatch
- Cloudflare Worker CPU budget constrains how much pre-processing can occur before racing begins

## Alternatives Considered

- **Serial failover chain**: rejected — P99 latency unacceptable under provider degradation
- **Static primary provider**: rejected — no resilience, vendor lock-in
- **Origin-side routing**: rejected — adds unnecessary round-trip before dispatch
