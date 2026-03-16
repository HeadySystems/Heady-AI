---
name: heady-status
description: Get system health, readiness, and ORS score across the Heady ecosystem
---

# heady-status

Check the health and readiness of the Heady platform.

## What to do

1. Run `node -e "const s = require('./mcp-servers/heady-mcp-server.js')"` to verify MCP server loads
2. Read `configs/app-readiness.yaml` for readiness probe definitions and ORS scoring
3. Check `packages/hc-readiness/` for the readiness checker module
4. Check `packages/hc-health/` for the health check module
5. Hit the `/api/health` endpoint on the running server if available
6. Report the overall system status including:
   - Project structure check (key dirs: configs, src, packages, apps)
   - Config file count and validation
   - Service catalog status from `configs/service-catalog.yaml`
   - Merge conflict detection in `heady-manager.js`
   - ORS (Operational Readiness Score) from readiness probes

## Key files

- `configs/app-readiness.yaml` — Readiness probes, ORS scoring
- `configs/service-catalog.yaml` — Service definitions and endpoints
- `packages/hc-readiness/` — Readiness checker module
- `packages/hc-health/` — Health check module
- `heady-manager.js` — Main server (check for merge conflicts)
- `mcp-servers/heady-mcp-server.js` — MCP tool: `heady_status`, `heady_health_ping`
