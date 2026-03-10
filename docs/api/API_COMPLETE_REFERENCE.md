# Heady™ Complete API Reference v4.0.0
## Author: Eric Haywood / HeadySystems Inc.

## Base URL

All API calls go through the API Gateway at port 3316.
Production: `https://api.headysystems.com`

## Authentication

All authenticated endpoints require:
```
Authorization: Bearer <jwt_token>
```

Tokens are RS256-signed JWTs with httpOnly cookie refresh mechanism.

---

## Auth API (`/api/auth`)

### POST /api/auth/login
Login with credentials.
```json
{ "email": "user@example.com", "password": "..." }
```
Response: Sets httpOnly cookie with refresh token, returns access token.

### POST /api/auth/register
Register new account with PKCE flow.

### POST /api/auth/refresh
Refresh access token using httpOnly cookie.

### POST /api/auth/logout
Revoke session and clear cookies.

---

## Vector Memory API (`/api/memory`)

### POST /api/memory/vectors
Store a new vector.
```json
{
  "content": "Heady uses Sacred Geometry",
  "embedding": [0.1, 0.2, ...],  // 384 dimensions
  "metadata": { "source": "docs", "type": "concept" },
  "namespace": "default"
}
```

### POST /api/memory/vectors/search
Similarity search.
```json
{
  "vector": [0.1, 0.2, ...],
  "topK": 21,
  "threshold": 0.691,
  "filter": { "type": "concept" },
  "includeMetadata": true
}
```

### GET /api/memory/stats
Vector memory statistics.

### GET /api/memory/drift/:namespace
Semantic drift detection for a namespace.

---

## CSL Engine API (`/api/csl`)

### POST /api/csl/execute
Execute a CSL operation.
```json
{
  "operation": "AND",
  "vectors": [[0.1, ...], [0.2, ...]],
  "threshold": 0.809,
  "temperature": 0.236
}
```
Operations: AND, OR, NOT, IMPLY, XOR, CONSENSUS, GATE

### POST /api/csl/classify
Intent classification via cosine similarity.
```json
{
  "input": [0.1, ...],
  "categories": [
    { "name": "code", "vector": [0.1, ...] },
    { "name": "research", "vector": [0.2, ...] }
  ],
  "topK": 3
}
```

### POST /api/csl/route
Route a task to optimal nodes.
```json
{
  "taskEmbedding": [0.1, ...],
  "nodeCapabilities": [
    { "name": "HeadyCoder", "vector": [0.1, ...] }
  ]
}
```

---

## Conductor API (`/api/conductor`)

### POST /api/conductor/pipeline/execute
Execute HCFullPipeline.
```json
{
  "intent": "Generate a REST API for user management",
  "domain": "code_generation",
  "context": { "language": "typescript", "framework": "express" }
}
```

### GET /api/conductor/pipeline/:taskId
Get pipeline execution status.

### GET /api/conductor/metrics
Orchestrator metrics and pool utilization.

---

## Search API (`/api/search`)
### POST /api/search — Hybrid BM25 + vector search with RRF

## Notifications API (`/api/notifications`)
### POST /api/notifications/send — Multi-channel notification dispatch

## Analytics API (`/api/analytics`)
### POST /api/analytics/events — Ingest analytics events
### GET /api/analytics/metrics — Aggregated metrics

## Billing API (`/api/billing`)
### GET /api/billing/usage — Current usage and credits
### POST /api/billing/subscribe — Subscribe to a phi-tier plan

## Scheduler API (`/api/scheduler`)
### POST /api/scheduler/jobs — Create scheduled job
### GET /api/scheduler/jobs/:id — Job status

## Asset Pipeline API (`/api/assets`)
### POST /api/assets/upload — Upload and process file
### GET /api/assets/:id — Retrieve processed asset

---

## Error Format

All errors follow the HeadyError schema:
```json
{
  "error": "HeadyError",
  "code": "HEADY-1001",
  "message": "Invalid credentials",
  "statusCode": 401,
  "category": "AUTH",
  "details": {},
  "timestamp": "2026-03-10T20:00:00.000Z"
}
```

Error code ranges:
- 1000-1099: Authentication
- 2000-2099: Vector Memory
- 2100-2199: CSL Engine
- 3000-3099: Pipeline/Orchestration
- 4000-4099: Service Communication
- 5000-5099: Infrastructure
- 6000-6099: Security
- 7000-7099: Data Integrity
- 8000-8099: GPU Operations
- 9000-9099: Billing
