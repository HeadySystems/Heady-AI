<!-- HEADY_BRAND:BEGIN -->
<!-- HEADY™ Studio · Sacred Geometry · © 2026 HeadySystems Inc. — Eric Haywood -->
<!-- HEADY_BRAND:END -->
# Heady Studio

A Claude-Code-style **MCP host**: log in, get your persistent memory, connect repos and MCP
servers, switch models, toggle Heady services, and run skills/workflows — all from one surface.

Heady Studio is intentionally a **thin host over MCP servers**. All capability lives behind MCP
servers — Heady's own ride the single multiplexed gateway at **`headymcp.com/mcp`**, and any external
server connects by its Streamable-HTTP **`/mcp`** endpoint. Because the app is a spec-compliant MCP
host (built on the official `@modelcontextprotocol/sdk`), every server's tools/resources show up
automatically — no UI rewrite to add a capability.

## Why this architecture

- **Heady services and external services are one abstraction.** "Toggle a Heady feature" and "connect
  an external MCP server" are the same operation on one registry — one toggle UI, one billing meter.
- **Functionality is guaranteed at the protocol layer.** Transport, capability discovery, and tool
  invocation are solved by the MCP standard; the UI is just a renderer.
- **Everything is data-driven.** Models, modes, effort tiers, execution modes, skills, workflows,
  Heady services, external MCP presets, and billing weights all come from
  [`@heady/studio-registry`](../../packages/studio-registry). Add a row → it appears in the UI.

## Features (v1 skeleton)

| Area | What's wired |
|------|--------------|
| Auth + memory | Firebase login; persistent memory via the gateway's `heady_memory_search` (Neon pgvector authority, fail-closed when unbound) |
| Repo connect | GitHub / Heady-ecosystem / local FS routed through `github-mcp` / `filesystem-mcp` |
| Model switcher | Opus 4.8 / Sonnet 4.6 / Haiku 4.5 / Fable 5 / Groq — from the manifest |
| Services panel | Heady services (permanent ones locked on) + external MCP toggles, billed accordingly |
| Skills / workflows | Selectable, mirror `/heady-*` |
| Effort | φ-scaled iteration budgets (minimal → max) |
| Modes | Understanding · Recommendation · Deep Research |
| Execution | Auto · Testing/Review · Sandbox |
| Composer | Auto-grows to 6 lines then scrolls; Send + Attach |
| Recommendation engine | Live suggestions (local instant + gateway `heady_recommend` reconcile) |
| Billing | Per-message credit meter that adjusts as features toggle |

## Run

```bash
cp .env.example .env            # set VITE_GATEWAY_URL (the deployed gateway origin)
pnpm --filter @heady-ai/heady-studio dev
pnpm --filter @heady-ai/heady-studio build
```

The gateway it talks to is [`apps/heady-mcp-gateway`](../heady-mcp-gateway) (Cloud Run).

## Extending

- **New model / skill / service / MCP preset:** add an entry in `@heady/studio-registry`. The topbar,
  Services panel, and billing meter pick it up with no component changes.
- **New Heady capability:** add one `registerTool(...)` in the gateway wired to its package.
- **New external server:** "+ Add by URL (…/mcp)" in the Services panel, or set its `*_URL` env.
