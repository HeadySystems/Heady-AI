<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  HEADY™ ARCHITECTURE OVERVIEW                                     ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Liquid Architecture v9.0                   ║
<!-- ║  FILE: ARCHITECTURE.md · LAYER: root                             ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# Architecture Overview

A concise map of how the Heady™ Latent OS fits together. Authoritative detail
lives in `AGENTS.md`, `docs/adr/`, and the registries under `configs/`.

## Layers

```
                 ┌─────────────────────────────────────────────┐
  Clients / SSE  │  Vite SPAs · Vanilla Web Components · MCP    │
                 └───────────────┬─────────────────────────────┘
                                 │ HTTP/2 · SSE · MCP (streamable-http/sse)
                 ┌───────────────▼─────────────────────────────┐
  Manager        │  heady-manager.js — API gateway + MCP host   │
  (Cloud Run)    │  Latent Services: brain soul conductor hcfp… │
                 └───────────────┬─────────────────────────────┘
                                 │ NATS event bus · in-proc dispatch
     ┌───────────────────────────▼───────────────────────────┐
  Orchestration  │ conductor → agents → bees (dynamic blast)  │
                 │ swarm-intelligence · buddy-core/-watchdog  │
     └───────────────────────────┬───────────────────────────┘
                                 │
     ┌──────────────┬────────────┴───────────┬────────────────┐
  Memory (3-tier)   Resilience               Edge              Governance
  T0 Redis          circuit breakers /pools  Cloudflare Workers CSL engine/gate
  T1 Neon pgvector  φ-backoff · caches       edge daemon(9876)  ORS · directives
  T2 edge cache(384)                          projections        ARBITER · gates
```

## Core patterns

- **Latent Service pattern** — every service exports `{ start, stop, health, metrics }`.
- **CSL gates** — thresholds via `cslGate(value, cosScore, tau)`, not raw `if/else`.
  Levels: min .500 · low .691 · medium .809 · high .882 · critical .927.
- **φ-scaling** — retries `phiBackoff()`, pool sizes `FIB[n]` (hot 34 / warm 21 /
  cold 13), heartbeats `PHI_7 · 1000`. No magic numbers.
- **3-tier memory** — T0 Redis/KV (hot, TTL ≤60s) → T1 Neon pgvector (retrieval
  authority) → T2 edge cache (reconstructible, dim-locked `vector(384)`,
  `@cf/baai/bge-small-en-v1.5`, ADR-0015). Qdrant dropped (ADR-0003 R2).
- **Fallback chain** — every critical function has a fallback; no single point
  of failure. Circuit breaker: 5 failures → open, φ-backoff, probe after 30s.

## Component surfaces & their registries

| Surface | Runtime | Registry |
|---|---|---|
| Services | `heady-manager.js`, `src/routes/*` | `configs/service-catalog.yaml`, `heady-registry.json` |
| Nodes | `src/orchestration/*`, `src/edge/*` | `configs/liquid-os/node-registry.yaml` |
| Bees | `src/bees/*` (auto-discovered by `registry.js`) | `configs/liquid-os/bee-catalog.yaml` |
| Agents / personas | `src/agents/*`, `.agents/agents/*`, `.agents/personas/*` | `configs/liquid-os/agent-registry.yaml` |
| MCP tools | `src/heady-mcp-server.js` | `configs/mcp-tools.json`, `.well-known/mcp.json` |
| Workflows | `.github/workflows/*`, `.agents/workflows/*` | `configs/liquid-os/workflow-registry.yaml` |
| Contracts | OpenAPI 3.1 | `packages/contracts/openapi/heady.openapi.json` |
| Packages | Turborepo workspaces | `pnpm-workspace.yaml`, `turbo.json` |

## Deploy targets

- **Cloud Run** — Docker container, port 8080 (`Dockerfile`); φ-stepped canary.
- **Cloudflare Workers/Pages** — `cloudflare/*`, `apps/*` via wrangler.
- **Firebase Hosting** — `apps/headyme-portal`.
- **Projections** — event-driven sync to downstream mirrors
  (`src/services/projection-engine.js`); staleness budgets in `heady-registry.json`.

See `docs/adr/` (0000–0030) for the decisions behind each of these.

---

*∞ Sacred Geometry · Liquid Intelligence · Permanent Life ∞*
*© 2026 HeadySystems Inc. — Eric Haywood, Founder*
