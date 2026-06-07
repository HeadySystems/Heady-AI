<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: docs/mcp-protocol.md                                                    ║
<!-- ║  LAYER: docs                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# HeadyMCP Protocol Guide

## Overview

HeadyMCP provides a Model Context Protocol (MCP) gateway that unifies 30+ tools
across the Heady ecosystem. Any MCP-compatible IDE (VS Code, Cursor, Windsurf)
can connect to Heady.

## Transport

- **JSON-RPC 2.0** over HTTP for request/response
- **Server-Sent Events (SSE)** for streaming

## Authentication

All requests require a Bearer token:

```
Authorization: Bearer <MCP_BEARER_TOKEN>
```

## Tool Discovery

```json
// Request
{ "jsonrpc": "2.0", "method": "tools/list", "id": 1 }

// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": [
    { "name": "heady_chat", "description": "Send a message to HeadyBrain", "inputSchema": {...} },
    { "name": "heady_code", "description": "Generate or review code", "inputSchema": {...} },
    ...
  ]
}
```

## Tool Invocation

```json
// Request
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "heady_chat",
    "arguments": { "message": "Explain the architecture" }
  },
  "id": 2
}
```

## Available Tools

| Tool | Description |
|---|---|
| heady_chat | Chat with HeadyBrain |
| heady_code | Generate/review code |
| heady_search | Web research |
| heady_memory_store | Store in vector memory |
| heady_memory_query | Query vector memory |
| heady_deploy | Deploy to cloud |
| heady_embed | Generate embeddings |
| heady_arena | A/B competition |

## IDE Configuration

### Cursor / VS Code

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "heady": {
      "url": "https://headymcp.com/api/mcp/sse",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```
