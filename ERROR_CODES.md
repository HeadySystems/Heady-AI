# Heady™ Error Code Catalog

> Every error response across all services gets a unique code, HTTP status, description, and suggested fix.
> Format: `HEADY-{SERVICE}-{NNN}`

---

## Auth & Session (HEADY-AUTH)

| Code | HTTP | Description | Suggested Fix |
|------|------|-------------|---------------|
| HEADY-AUTH-001 | 401 | Token is required | Include `Authorization: Bearer <token>` header |
| HEADY-AUTH-002 | 401 | Token verification failed | Token is malformed or tampered — re-authenticate |
| HEADY-AUTH-003 | 401 | Session expired or revoked | Refresh token or re-login |
| HEADY-AUTH-004 | 401 | Invalid or expired refresh token | Re-authenticate from scratch |
| HEADY-AUTH-005 | 403 | Insufficient permissions | Current role lacks access — contact admin |
| HEADY-AUTH-006 | 400 | Invalid API key format | API keys must begin with `hdy_` prefix |
| HEADY-AUTH-007 | 401 | API key not found or expired | Regenerate API key from dashboard |
| HEADY-AUTH-008 | 400 | Invalid OAuth2 state (CSRF) | Restart OAuth2 flow |
| HEADY-AUTH-009 | 400 | OAuth2 code and state required | Include both `code` and `state` parameters |
| HEADY-AUTH-010 | 429 | Rate limit exceeded | Wait and retry — limits: 34/min anon, 89/min auth, 233/min enterprise |

## Brain & Inference (HEADY-BRAIN)

| Code | HTTP | Description | Suggested Fix |
|------|------|-------------|---------------|
| HEADY-BRAIN-001 | 503 | pgvector connection pool exhausted | Wait for connections to free — check PgBouncer status |
| HEADY-BRAIN-002 | 504 | Inference timeout | Model overloaded — retry with exponential backoff |
| HEADY-BRAIN-003 | 400 | Invalid prompt format | Ensure prompt is a non-empty string ≤ 32KB |
| HEADY-BRAIN-004 | 422 | Embedding dimension mismatch | Expected 384-dim vectors — check model output |
| HEADY-BRAIN-005 | 503 | Model gateway unavailable | All inference models down — check health dashboard |

## Security (HEADY-SECURITY)

| Code | HTTP | Description | Suggested Fix |
|------|------|-------------|---------------|
| HEADY-SECURITY-001 | 400 | Prompt injection detected | Input contains patterns violating content safety policy |
| HEADY-SECURITY-002 | 403 | CORS origin not allowed | Add your domain to the CORS allowlist |
| HEADY-SECURITY-003 | 403 | CSP violation | Script or resource blocked by Content Security Policy |
| HEADY-SECURITY-004 | 403 | WebSocket auth failed | Provide valid token on WS upgrade |
| HEADY-SECURITY-005 | 403 | WebSocket rate limit | Exceeded per-connection message rate |

## Guardrails (HEADY-GUARDRAIL)

| Code | HTTP | Description | Suggested Fix |
|------|------|-------------|---------------|
| HEADY-GUARDRAIL-001 | 403 | Operation blocked by autonomy guardrails | Operation is forbidden or confidence too low — requires human approval |
| HEADY-GUARDRAIL-002 | 403 | Unknown operation | Add operation to allowlist in `autonomy-guardrails.js` |

## Memory & Vector (HEADY-MEMORY)

| Code | HTTP | Description | Suggested Fix |
|------|------|-------------|---------------|
| HEADY-MEMORY-001 | 503 | Vector store unavailable | pgvector connection failed — check PostgreSQL health |
| HEADY-MEMORY-002 | 400 | Invalid embedding format | Must be array of 384 floats |
| HEADY-MEMORY-003 | 404 | Vector entry not found | The referenced vector ID does not exist |
| HEADY-MEMORY-004 | 507 | Vector store capacity exceeded | Index approaching capacity — purge old vectors |
| HEADY-MEMORY-005 | 504 | HNSW query timeout | Query too broad — add filters or reduce k |

## Agents & Orchestration (HEADY-AGENT)

| Code | HTTP | Description | Suggested Fix |
|------|------|-------------|---------------|
| HEADY-AGENT-001 | 503 | Agent spawn failed | Resource limits reached — reduce concurrent agents |
| HEADY-AGENT-002 | 504 | Saga step timeout | Step exceeded Fibonacci timeout (8s default) |
| HEADY-AGENT-003 | 500 | Saga compensation failed | Manual intervention required — check saga logs |
| HEADY-AGENT-004 | 400 | Invalid skill reference | Skill not found in registry |
| HEADY-AGENT-005 | 429 | Swarm coordination limit | Maximum concurrent swarms reached (34) |

## Event Bus (HEADY-BUS)

| Code | HTTP | Description | Suggested Fix |
|------|------|-------------|---------------|
| HEADY-BUS-001 | 503 | NATS connection failed | Check NATS server at configured URL |
| HEADY-BUS-002 | 504 | Message delivery timeout | Consumer not acknowledging — check consumer health |
| HEADY-BUS-003 | 500 | Dead letter queue overflow | DLQ messages accumulating — investigate failures |
| HEADY-BUS-004 | 400 | Invalid subject format | Subjects must match `heady.{domain}.{action}` |

## Web & Sites (HEADY-WEB)

| Code | HTTP | Description | Suggested Fix |
|------|------|-------------|---------------|
| HEADY-WEB-001 | 404 | Site not found in registry | Domain not configured in site-registry.json |
| HEADY-WEB-002 | 503 | Template rendering failed | Check site configuration for missing fields |
| HEADY-WEB-003 | 502 | Chat API unreachable | Brain service unavailable — check `/api/brain/chat` |

## Gateway & Routing (HEADY-GATEWAY)

| Code | HTTP | Description | Suggested Fix |
|------|------|-------------|---------------|
| HEADY-GATEWAY-001 | 502 | Upstream service unavailable | Target service is down — circuit breaker may be open |
| HEADY-GATEWAY-002 | 504 | Upstream timeout | Service unresponsive — check health and resource usage |
| HEADY-GATEWAY-003 | 429 | Global rate limit | Platform-wide rate limit reached — reduce request volume |
| HEADY-GATEWAY-004 | 400 | Invalid request routing | Unknown route or missing service selector |

---

*Total: 44 error codes across 8 service domains*
*Generated: 2026-03-09 · Heady™ Maximum Potential Pass*
