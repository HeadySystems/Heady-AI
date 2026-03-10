# Heady Error Catalog — Sacred Genesis v4.0.0

## Document Information
- **Author**: Eric Haywood, HeadySystems Inc.
- **Version**: 4.0.0
- **Last Updated**: 2026-03-01

All error codes follow the pattern: `HEADY-{DOMAIN}-{NUMBER}`
Domains: AUTH, API, CSL, VEC, MCP, NET, DB, CFG, SEC, SYS, BEE, CON, MEM, DPL, GOV

## Authentication Errors (HEADY-AUTH-*)

| Code | HTTP | Message | Description | Resolution |
|------|------|---------|-------------|------------|
| HEADY-AUTH-001 | 401 | Session expired | httpOnly session cookie has expired | Re-authenticate to obtain a new session |
| HEADY-AUTH-002 | 401 | Invalid session | Session ID does not match any active session | Clear cookies and re-authenticate |
| HEADY-AUTH-003 | 403 | CSRF token mismatch | CSRF double-submit validation failed | Ensure CSRF token header matches cookie |
| HEADY-AUTH-004 | 403 | Insufficient permissions | Role lacks required permission | Request elevated role or contact admin |
| HEADY-AUTH-005 | 429 | Authentication rate limit | Too many auth attempts from this IP | Wait for rate limit window to reset |
| HEADY-AUTH-006 | 401 | Invalid credentials | Username or password incorrect | Verify credentials and retry |
| HEADY-AUTH-007 | 403 | Account locked | Account locked after excessive failures | Contact administrator for unlock |
| HEADY-AUTH-008 | 401 | Token revoked | API key or token has been revoked | Generate a new API key |

## API Errors (HEADY-API-*)

| Code | HTTP | Message | Description | Resolution |
|------|------|---------|-------------|------------|
| HEADY-API-001 | 400 | Invalid request body | Request JSON is malformed or missing required fields | Check request schema in API docs |
| HEADY-API-002 | 404 | Endpoint not found | The requested API endpoint does not exist | Check API reference for valid endpoints |
| HEADY-API-003 | 405 | Method not allowed | HTTP method not supported for this endpoint | Use the correct HTTP method |
| HEADY-API-004 | 413 | Payload too large | Request body exceeds maximum size | Reduce payload size or use chunked upload |
| HEADY-API-005 | 415 | Unsupported media type | Content-Type header not supported | Use application/json |
| HEADY-API-006 | 429 | Rate limit exceeded | Request rate exceeds allowed limit | Reduce request frequency or upgrade tier |
| HEADY-API-007 | 503 | Service unavailable | Backend service is temporarily unavailable | Retry with phi-exponential backoff |

## CSL Engine Errors (HEADY-CSL-*)

| Code | HTTP | Message | Description | Resolution |
|------|------|---------|-------------|------------|
| HEADY-CSL-001 | 400 | Invalid vector dimensions | Vector dimensions do not match expected 384D | Ensure vectors are 384-dimensional |
| HEADY-CSL-002 | 400 | Zero-magnitude vector | Cannot normalize a zero vector | Provide non-zero vectors |
| HEADY-CSL-003 | 422 | Gate threshold not met | CSL gate score below required threshold | Increase alignment or lower threshold level |
| HEADY-CSL-004 | 500 | Routing failure | CSL router could not find a matching node | Check route registration and gate vectors |
| HEADY-CSL-005 | 422 | Consensus failure | Insufficient agreement among agent votes | Increase vote count or lower consensus threshold |

## Vector Memory Errors (HEADY-VEC-*)

| Code | HTTP | Message | Description | Resolution |
|------|------|---------|-------------|------------|
| HEADY-VEC-001 | 400 | Invalid embedding format | Embedding is not a valid float array | Provide a JSON array of 384 float values |
| HEADY-VEC-002 | 404 | Vector not found | No vector exists with the given ID | Verify the vector ID |
| HEADY-VEC-003 | 409 | Duplicate vector ID | A vector with this ID already exists | Use a unique ID or update the existing vector |
| HEADY-VEC-004 | 507 | Storage capacity exceeded | Vector storage has reached maximum capacity | Archive old vectors or increase storage |
| HEADY-VEC-005 | 500 | Index search failure | HNSW index search encountered an error | Rebuild the vector index |
| HEADY-VEC-006 | 503 | Embedding provider unavailable | All embedding providers are unreachable | Wait for provider recovery |

## MCP Gateway Errors (HEADY-MCP-*)

| Code | HTTP | Message | Description | Resolution |
|------|------|---------|-------------|------------|
| HEADY-MCP-001 | 400 | Invalid tool request | Tool request does not match expected schema | Check tool capability manifest |
| HEADY-MCP-002 | 403 | Tool execution denied | CSL gate rejected the tool request | Verify request alignment with tool capability |
| HEADY-MCP-003 | 404 | Tool not found | Requested tool is not registered | Check available tools via discovery endpoint |
| HEADY-MCP-004 | 408 | Tool execution timeout | Tool did not complete within timeout | Retry or use a longer timeout |
| HEADY-MCP-005 | 503 | Sandbox allocation failed | Could not allocate WASM sandbox | Wait for sandbox pool to free resources |
| HEADY-MCP-006 | 507 | Sandbox memory exceeded | Tool exceeded sandbox memory limit | Optimize tool or increase memory allocation |

## Network Errors (HEADY-NET-*)

| Code | HTTP | Message | Description | Resolution |
|------|------|---------|-------------|------------|
| HEADY-NET-001 | 502 | Bad gateway | Upstream service returned invalid response | Check upstream service health |
| HEADY-NET-002 | 504 | Gateway timeout | Upstream service did not respond in time | Increase timeout or check upstream |
| HEADY-NET-003 | 503 | Circuit breaker open | Service circuit breaker is in OPEN state | Wait for phi-backoff recovery probe |
| HEADY-NET-004 | 503 | Bulkhead full | Maximum concurrent requests reached | Retry after backoff |
| HEADY-NET-005 | 503 | Connection pool exhausted | No available connections in pool | Wait for connections to return to pool |

## Database Errors (HEADY-DB-*)

| Code | HTTP | Message | Description | Resolution |
|------|------|---------|-------------|------------|
| HEADY-DB-001 | 503 | Connection failed | Cannot connect to PostgreSQL | Check DB host, PgBouncer, credentials |
| HEADY-DB-002 | 503 | Connection pool exhausted | All PgBouncer connections in use | Kill idle connections, check for leaks |
| HEADY-DB-003 | 500 | Query execution error | SQL query failed | Check query syntax and parameters |
| HEADY-DB-004 | 409 | Constraint violation | Database constraint prevents operation | Check unique, foreign key, check constraints |
| HEADY-DB-005 | 500 | Migration failed | Schema migration did not complete | Review migration script, restore backup |

## Configuration Errors (HEADY-CFG-*)

| Code | HTTP | Message | Description | Resolution |
|------|------|---------|-------------|------------|
| HEADY-CFG-001 | 500 | Missing environment variable | Required env var is not set | Set the variable in .env or deployment config |
| HEADY-CFG-002 | 409 | Schema incompatible | Schema version breaks backward compat | Use a compatible schema version |
| HEADY-CFG-003 | 404 | Feature flag not found | Referenced flag does not exist | Create the flag in the feature flags service |
| HEADY-CFG-004 | 500 | Invalid phi constant | A constant does not derive from phi/Fibonacci | Fix the constant using shared/phi-math.js |

## Security Errors (HEADY-SEC-*)

| Code | HTTP | Message | Description | Resolution |
|------|------|---------|-------------|------------|
| HEADY-SEC-001 | 403 | Origin not allowed | CORS origin check failed | Add origin to CORS allowlist |
| HEADY-SEC-002 | 403 | IP blocked | IP address is in denylist or geo-blocked | Use an allowed IP or contact admin |
| HEADY-SEC-003 | 403 | Certificate invalid | mTLS certificate validation failed | Update client certificate |
| HEADY-SEC-004 | 500 | Encryption failure | AES-256-GCM encryption failed | Check encryption key availability |

## System Errors (HEADY-SYS-*)

| Code | HTTP | Message | Description | Resolution |
|------|------|---------|-------------|------------|
| HEADY-SYS-001 | 500 | Internal server error | Unhandled error in service | Check structured logs for stack trace |
| HEADY-SYS-002 | 503 | Service starting | Service is in startup phase | Wait for startup probe to pass |
| HEADY-SYS-003 | 503 | Graceful shutdown | Service is shutting down | Wait for new instance to start |
| HEADY-SYS-004 | 500 | Memory exhaustion | Service exceeded memory limits | Restart service, investigate memory usage |

## Bee/Agent Errors (HEADY-BEE-*)

| Code | HTTP | Message | Description | Resolution |
|------|------|---------|-------------|------------|
| HEADY-BEE-001 | 500 | Bee spawn failed | Could not create bee worker | Check bee factory registry and resources |
| HEADY-BEE-002 | 404 | Bee not found | Requested bee type not in registry | Register the bee type |
| HEADY-BEE-003 | 503 | Swarm capacity exceeded | Maximum bee count reached | Scale bee pool or wait for bees to complete |
| HEADY-BEE-004 | 500 | Bee heartbeat failed | Bee missed heartbeat deadline | Check bee health, restart if necessary |

## Conductor Errors (HEADY-CON-*)

| Code | HTTP | Message | Description | Resolution |
|------|------|---------|-------------|------------|
| HEADY-CON-001 | 500 | Routing failure | Conductor cannot find route for task | Update routing table |
| HEADY-CON-002 | 500 | Pipeline stage failed | HCFullPipeline stage encountered error | Check specific stage and node health |
| HEADY-CON-003 | 503 | Pool exhausted | No resources available in target pool | Wait for pool capacity or scale |

## Governance Errors (HEADY-GOV-*)

| Code | HTTP | Message | Description | Resolution |
|------|------|---------|-------------|------------|
| HEADY-GOV-001 | 403 | Policy violation | Action violates governance policy | Review policy requirements |
| HEADY-GOV-002 | 403 | Approval required | Action requires governance approval | Submit approval request |
| HEADY-GOV-003 | 409 | Audit chain broken | Audit log integrity check failed | Investigate tampering, restore from backup |
