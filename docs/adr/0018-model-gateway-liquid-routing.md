# ADR-0018: Model Gateway & Liquid Routing

- **Status:** Accepted (2026-06-17, founder approval per ADR-0013)
- **Deciders:** Eric Anthony Haywood

## Context

Heady calls many LLM/embedding providers. Without one chokepoint, cost, caching, rate-limits, failover,
and DLP are scattered and unenforceable, and business code couples to vendor model names. Source:
`heady-liquid-latent-os-stepwise.md` §3; detail in `docs/compendium/05-model-mesh.md`.

## Decision

1. **Single egress chokepoint: Cloudflare AI Gateway.** All provider traffic flows Liquid → OpenRouter →
   CF AI Gateway. It provides edge logging, SHA-256 exact-match caching, per-tenant/per-model budgets
   (ADR-0010/0012), mid-stream failover, and DLP. **Semantic caching is default-OFF, per-route opt-in**
   (poisoning risk); tool-call and personalized outputs are exact-match only.
2. **Model identity is a *route*, not a vendor.** App/agent code (ADR-0016) names route classes
   (`class=reason`, `class=longctx`, `class=cheap`, `class=embed`); the gateway resolves the provider.
3. **Liquid is the fast/cheap/private *edge* tier, not the smart tier.** Routing by a cheap edge
   classifier: intent→LFM2-350M, extract→LFM2-1.2B, voice→LFM2.5-Audio; speed→Groq; **frontier reasoning→
   Claude Opus/Sonnet**; long-context multimodal→Gemini; deep agentic→OpenAI o-series. Reserve frontier
   for explicit `class=reason`/`class=longctx`.
4. **`phi_circuit_breaker` lives in the gateway** (borrow LiteLLM priority/cooldowns, Portkey
   active-probe breaking, OpenRouter `:nitro`/`:floor`). Budget factor steers to cheaper providers as
   daily spend approaches the cap.
5. **Liquid licensing:** LFM Open License v1.0 — call it **"open weight," never "open source."**

## Consequences

- (+) One place for cost, caching, failover, DLP, budgets; zero vendor lock-in in business code.
- (+) Cheap edge models absorb classification/extraction; frontier reserved for what needs it.
- (−) The gateway is a critical path — needs its own SLO + failover-to-direct on gateway outage.
- See ADR-0010 (rate/budget), ADR-0012 (FinOps), ADR-0016 (agent harness consumes it).
