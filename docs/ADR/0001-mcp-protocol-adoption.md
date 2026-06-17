# ADR-0001: Adopt MCP as Unified Tool Gateway
**Date:** 2025-01-15 | **Status:** Accepted | **Author:** Eric Haywood

## Context

The Heady ecosystem had grown to 20+ services each exposing custom REST/WebSocket APIs.
This created a maintenance burden: each service required its own auth layer, documentation,
discovery mechanism, and client adapters. IDE integrations (Windsurf, Cursor, VS Code Copilot)
were impossible to wire without service-specific connectors.

## Decision

Adopt the Model Context Protocol (MCP) as the single unified tool gateway, routed through
HeadyManager. All services expose capabilities as MCP tools with bearer-token authentication.
HeadyMCP (headymcp.com) is the public edge surface for IDE and agent consumers.

## Consequences

### Positive
- Single auth and routing layer eliminates per-service auth logic
- IDE compatibility out-of-the-box (Windsurf, Cursor, VS Code, Claude Desktop)
- Standard tool discovery via `/.well-known/mcp.json` — no bespoke docs needed
- 47 tools unified under one protocol surface
- Cloudflare Durable Objects provide stateful session continuity for remote MCP sessions
- Aligns with the MCP 2026 roadmap (Tasks primitive, DPoP auth, Server Cards)

### Negative
- ~5–10ms latency overhead per tool call vs direct HTTP
- MCP spec was still evolving at decision time; breaking changes required upstream tracking
- Centralised gateway is a single point of failure if HeadyManager goes down

## Alternatives Considered

- **Direct REST per service**: rejected — unsustainable maintenance, no IDE compatibility
- **GraphQL federation**: rejected — no standard agent/IDE runtime support
- **gRPC**: rejected — browser incompatibility and no MCP-equivalent ecosystem

## Notes

HeadyMCP publicly presents as edge-native MCP, aligning Cloudflare Workers as ingress
rather than routing through the Cloud Run origin alone (see ADR-0002 topology).
