# Tailscale Mesh Networking on Colab Pro+ for Distributed GPU Inference

**Generated:** 2026-03-15 | **Source:** Technical architecture document

---

## Summary

Tailscale runs on Google Colab in userspace networking mode, connecting ephemeral GPU runtimes into a WireGuard mesh for distributed inference. 4 Colab GPU workers serve as primary compute behind a Cloud Run orchestrator with automatic failover to API providers when nodes cycle.

## Key Architecture Components

### Tailscale Setup on Colab
- **Mode:** userspace networking (`--tun=userspace-networking`) — Colab lacks `CAP_NET_ADMIN`
- **Transport:** SOCKS5 proxy at `localhost:1055`
- **Auth:** Ephemeral + reusable + pre-approved + tagged `tag:colab` keys
- **State:** In-memory (`--state=mem:`) — auto-deregisters on exit
- **DNS:** MagicDNS hostnames (`colab-gpu-{id}.your-tailnet.ts.net`)
- **Performance:** 5–50ms direct, +20–50ms via DERP relay

### Redis Coordination Layer (Upstash)
- **Worker registry:** Hash keys with 60s TTL, heartbeat every 10s, 30s soft timeout
- **Task queue:** Redis Streams with consumer groups + XAUTOCLAIM (60s idle reclaim)
- **Circuit breakers:** tenacity retry (inner) + circuitbreaker (outer, 5 failures → 60s open)
- **Leader election:** SET NX + 10s TTL, renewal every 3s via Lua script

### GPU Availability (Colab Pro+ $49.99/mo, 500 CU)

| GPU | VRAM | Cost/hr | Hours/500CU |
|-----|------|---------|-------------|
| T4 | 15 GB | $0.12 | ~420h |
| L4 | 22.5 GB | $0.17 | ~292h |
| A100 40GB | 40 GB | $0.54 | ~93h |
| A100 80GB | 80 GB | $0.75 | ~66h |
| H100 | 80 GB | TBD | Limited |

### Request Flow
```
User → Cloudflare Worker (WAF, rate limit, JWT, cache)
  → Cloud Run Orchestrator (Tailscale userspace, min-instances=1)
    → Redis: check worker registry, least-loaded alive worker
      → Tailscale mesh → Colab GPU Worker (vLLM/FastAPI)
        → Qdrant Cloud (vector retrieval)
        → Response back
```

### Latency Budget: 150–250ms (excluding inference)

### Fallback Chain (LiteLLM)
1. GPU workers (order=1)
2. Anthropic Claude (order=2)
3. OpenAI GPT-4o (order=3)
4. Groq (order=4)

### Reference Projects
- **Petals** (~10K★): BitTorrent-style LLM inference across volunteer GPUs
- **exo** (~20K★): P2P AI clusters with coordinator-only mode
- **GPUStack** (~3K★): Production GPU cluster manager

### Critical Constraints
- Colab sessions die after 3–10 hours despite 24h advertised limit
- No multi-GPU support per notebook
- Cloud Run HTTP POST >840 bytes may hang with userspace networking (issue #9894)
- Auth keys expire after 90 days max

---

*Source: Heady Liquid Nodes Architecture — Tailscale + Colab Pro+ Integration*
