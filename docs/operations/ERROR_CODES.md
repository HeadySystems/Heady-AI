# Heady™ Error Codes Reference

> All error codes follow the format `HEADY-{CATEGORY}-{NUMBER}`.
> Categories: AUTH, API, MEM, PIPE, AGENT, HEALTH, MCP, EDGE

## Authentication (AUTH)

| Code | HTTP | Description | Resolution |
|------|------|-------------|------------|
| `HEADY-AUTH-001` | 401 | Missing or invalid API key | Provide valid key via `Authorization: Bearer <key>` or `X-API-Key` header |
| `HEADY-AUTH-002` | 401 | Expired session token | Re-authenticate via OAuth or API key |
| `HEADY-AUTH-003` | 403 | Insufficient permissions | Check RBAC role assignments |
| `HEADY-AUTH-004` | 401 | Invalid OAuth state parameter | Restart OAuth flow — state/nonce mismatch detected |
| `HEADY-AUTH-005` | 429 | Rate limit exceeded | Wait for rate window reset (see `Retry-After` header) |
| `HEADY-AUTH-006` | 401 | Client certificate required (mTLS) | Provide valid client certificate signed by trusted CA |
| `HEADY-AUTH-007` | 403 | Client certificate not authorized | Certificate CN or issuer not in allowlist |

## API Gateway (API)

| Code | HTTP | Description | Resolution |
|------|------|-------------|------------|
| `HEADY-API-001` | 400 | Malformed request body | Ensure valid JSON with required fields |
| `HEADY-API-002` | 404 | Endpoint not found | Check API reference at `headyapi.com/docs` |
| `HEADY-API-003` | 405 | Method not allowed | Use correct HTTP method (GET/POST/PUT/DELETE) |
| `HEADY-API-004` | 413 | Request payload too large | Max payload: 1MB for API requests, 10MB for file uploads |
| `HEADY-API-005` | 500 | Internal server error | Report to support with `X-Request-ID` from response |
| `HEADY-API-006` | 502 | Upstream provider unavailable | Provider circuit breaker triggered — retry or use different model |
| `HEADY-API-007` | 503 | Service temporarily unavailable | Platform maintenance — check `status.headysystems.com` |
| `HEADY-API-008` | 504 | Request timeout | Reduce prompt length or use streaming endpoint |

## Vector Memory (MEM)

| Code | HTTP | Description | Resolution |
|------|------|-------------|------------|
| `HEADY-MEM-001` | 400 | Invalid embedding dimensions | Embeddings must be 1536 dimensions (OpenAI) or match configured model |
| `HEADY-MEM-002` | 404 | Memory entry not found | Verify memory ID and namespace |
| `HEADY-MEM-003` | 409 | Duplicate memory ID | Use unique ID or upsert endpoint |
| `HEADY-MEM-004` | 422 | Vector norm out of range | Embedding vector must be unit-normalized |
| `HEADY-MEM-005` | 507 | Memory storage limit reached | Upgrade plan or archive old memories |

## Pipeline (PIPE)

| Code | HTTP | Description | Resolution |
|------|------|-------------|------------|
| `HEADY-PIPE-001` | 400 | Invalid pipeline configuration | Check `hcfullpipeline.json` syntax |
| `HEADY-PIPE-002` | 409 | Pipeline stage conflict | Stage dependency not met — check DAG ordering |
| `HEADY-PIPE-003` | 408 | Stage timeout exceeded | Increase timeout or simplify task |
| `HEADY-PIPE-004` | 500 | Pipeline execution error | Check stage logs for root cause |
| `HEADY-PIPE-005` | 429 | Task queue full | Max queue depth reached — wait for completion |

## Agent Swarm (AGENT)

| Code | HTTP | Description | Resolution |
|------|------|-------------|------------|
| `HEADY-AGENT-001` | 404 | Agent type not found | Check bee template registry for valid types |
| `HEADY-AGENT-002` | 409 | Agent pool exhausted | All agents busy — wait or increase pool size |
| `HEADY-AGENT-003` | 500 | Agent execution error | Check agent logs; agent may need respawn |
| `HEADY-AGENT-004` | 408 | Agent response timeout | Task exceeded max execution time |

## Health Monitor (HEALTH)

| Code | HTTP | Description | Resolution |
|------|------|-------------|------------|
| `HEADY-HEALTH-001` | 503 | Critical health score (<50) | Check `/health/detailed` for failing subsystems |
| `HEADY-HEALTH-002` | 503 | Database unreachable | Verify PostgreSQL connection string and availability |
| `HEADY-HEALTH-003` | 503 | Redis unreachable | Verify Redis URL and network connectivity |
| `HEADY-HEALTH-004` | 200 | Degraded health (50-80) | Monitor — self-healing may resolve automatically |

## MCP Tools (MCP)

| Code | HTTP | Description | Resolution |
|------|------|-------------|------------|
| `HEADY-MCP-001` | 400 | Invalid JSON-RPC request | Ensure valid JSON-RPC 2.0 format |
| `HEADY-MCP-002` | 404 | Tool not found | Check tool registry at `/api/v2/mcp/tools` |
| `HEADY-MCP-003` | 403 | Tool execution denied | Tool requires elevated permissions |
| `HEADY-MCP-004` | 500 | Tool execution error | Check tool-specific error details in response |

## Edge Router (EDGE)

| Code | HTTP | Description | Resolution |
|------|------|-------------|------------|
| `HEADY-EDGE-001` | 421 | Unknown domain | Request domain not in Heady domain registry |
| `HEADY-EDGE-002` | 503 | Origin unreachable | Cloud Run origin returning errors — check logs |
| `HEADY-EDGE-003` | 429 | Edge rate limit | Per-domain rate limit exceeded at Cloudflare |
