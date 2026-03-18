# Heady Implementation Backlog

## P0
- Resolve README merge conflicts in all Heady-Main forks.
- Pick and document the canonical upstream repo.
- Route `/api/system/status`, `/api/supervisor/status`, `/api/brain/status`, `/api/registry`, `/api/pipeline/state`, and `/api/nodes` to real authenticated handlers.
- Rebuild `headymcp-core` as a real MCP server with published tool handlers.
- Publish `/.well-known/mcp.json` Server Card.
- Add task/session persistence for long-running MCP operations.

## P1
- Split Heady-Testing into an actual test harness repo.
- Add durable async transport for work dispatch and event propagation.
- Add metrics, drift, and audit endpoints.
- Publish explicit MCP tool manifest.
- Publish explicit node registry and bee registry.
- Add Cloud Run minimum instances and tagged releases.

## P2
- Add DPoP and Workload Identity Federation.
- Add semantic cache, vector resource surfacing, and graph RAG exposure through MCP.
- Add trigger/event workflow with signed webhooks.
- Expose Monte Carlo validation and governance checks through MCP.
- Populate HeadyEcosystem as the public architecture and dependency map.

## P3
- Reconcile 5-stage vs 9-stage pipeline documentation.
- Normalize repo boundaries for docs, runtime, tests, mobile, and archived Java mass.
- Audit `certs/` history and rotate any sensitive material.
- Expand the Hugging Face org with public models or at least public model cards and CLI docs.
