<!-- HEADY_BRAND:BEGIN
Heady™ Worker Authentication Deployment Receipt
© 2026 HeadySystems Inc. — Eric Haywood, Founder
HEADY_BRAND:END -->

# Worker authentication and deployment receipt

Date: 2026-08-21T21:41:10Z

## Changes

- `worker-ai-gateway` now requires `Authorization: Bearer <HEADY_API_KEY>`, uses the declared `AI_ROUTING_RULES`, `AI_COST_TRACKER`, and `WORKERS_AI` bindings, and records usage in the cost-tracking KV namespace.
- `worker-mcp-telemetry` now rejects unknown CORS origins, disallows query-string credentials, and requires `HEADY_TELEMETRY_TOKEN` through `Authorization` or `X-Heady-Token`.
- `heady-edge-node` now protects MCP and API routes with `HEADY_API_KEY` and uses the locked `@cf/baai/bge-small-en-v1.5` 384-dimensional embedding model.

## Secrets

The existing Heady API credential was provisioned as Cloudflare Worker secrets. Values are intentionally excluded from this receipt:

- `worker-ai-gateway`: `HEADY_API_KEY`
- `worker-mcp-telemetry`: `HEADY_TELEMETRY_TOKEN`
- `heady-edge-node`: `HEADY_API_KEY`

## Deployments

| Worker | Version | workers.dev endpoint |
|---|---|---|
| `worker-ai-gateway` | `b944ef32-7492-456e-a784-5ea8f642ff74` | `https://worker-ai-gateway.emailheadyconnection.workers.dev` |
| `worker-mcp-telemetry` | `0216b3ca-9b71-49f8-ab5c-68b0fac875ca` | `https://worker-mcp-telemetry.emailheadyconnection.workers.dev` |
| `heady-edge-node` | `4885b7e9-a2ec-4f63-b407-e559bb893e5a` | `https://heady-edge-node.emailheadyconnection.workers.dev` |

## Smoke evidence

| Probe | Result |
|---|---:|
| Gateway unauthenticated | 401 |
| Gateway authenticated | 200 |
| Telemetry health | 200 |
| Telemetry unauthenticated | 401 |
| Telemetry authenticated | 200 |
| Edge health | 200 |
| Edge MCP unauthenticated | 401 |
| Edge MCP authenticated | 200 |

Local syntax checks, `git diff --check`, and Wrangler dry-runs passed before deployment.
