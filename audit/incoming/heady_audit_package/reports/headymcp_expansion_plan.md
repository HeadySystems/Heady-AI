# HeadyMCP Expansion Plan
**Date:** March 17, 2026  
**Author:** Heady Audit Subagent  
**Scope:** MCP-aligned expansion design grounded in public sources  
**Sources:** [headymcp.com](https://headymcp.com/), [github.com/HeadyMe/headymcp-core](https://github.com/HeadyMe/headymcp-core), [modelcontextprotocol.io/development/roadmap](https://modelcontextprotocol.io/development/roadmap), [blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/)

---

## Executive Summary

HeadyMCP currently operates as a JSON-RPC + SSE MCP server deployed on Cloudflare Workers, advertising 30–31 tools spanning chat, code, search, embed, and deploy categories. The **headymcp-core** repository reveals the public implementation is a thin Express.js web server — a static page shell with `site-config.json` and no MCP SDK integration — meaning the rich 30+ tool catalog described across [heady-docs](https://github.com/HeadyMe/heady-docs) lives in the broader Heady-Main monorepo rather than in the dedicated gateway repo.

The MCP project's [2026 roadmap](https://modelcontextprotocol.io/development/roadmap) (updated March 5, 2026) reorganizes around four priority areas: Transport Evolution, Agent Communication, Governance Maturation, and Enterprise Readiness. Each creates direct upgrade paths for HeadyMCP. This plan maps those paths to concrete new services, tools, workflows, agent roles, and infrastructure changes, then prioritizes them into an actionable implementation roadmap.

---

## 1. Current MCP Claims (Publicly Verified)

### 1.1 headymcp.com Marketing Claims

| Claim | Source | Verified? |
|---|---|---|
| HeadyMCP v3.2 · Orion Patch | [headymcp.com](https://headymcp.com/) | ✅ Marketing page |
| 30+ native MCP tools | [headymcp.com](https://headymcp.com/) | ⚠️ Catalog in docs, not in core repo |
| JSON-RPC + SSE native transport | [headymcp.com](https://headymcp.com/) | ✅ Matches MCP 2024 spec |
| Cloudflare Workers edge-native | [headymcp.com](https://headymcp.com/) | ✅ Site config references edge deployment |
| VS Code, Cursor, Windsurf IDE bridge | [headymcp.com](https://headymcp.com/) | ✅ Standard MCP client targets |
| Zero latency / sub-millisecond routing | [headymcp.com](https://headymcp.com/), [site-config.json](https://raw.githubusercontent.com/HeadyMe/headymcp-core/main/site-config.json) | ⚠️ Marketing claim, no benchmark |

### 1.2 GitHub headymcp-core Claims (Package.json + site-config.json)

From [package.json](https://raw.githubusercontent.com/HeadyMe/headymcp-core/main/package.json):
- Package name: `@heady/headymcp-core` v1.0.0
- Runtime: Node ≥20, single dependency: `express@^4.21.0`
- Author: `eric@headysystems.com` (HeadySystems Inc.)

From [site-config.json](https://raw.githubusercontent.com/HeadyMe/headymcp-core/main/site-config.json):
- "31 MCP Tools — Complete tool suite for AI orchestration"
- "Zero-Latency Dispatch — Sub-millisecond tool routing"
- "Autonomous Orchestration — Self-organizing AI node coordination"
- "Universal Connect — Bridges Claude, GPT, Gemini, and Groq"

### 1.3 heady-docs Service Catalog (Verified Authoritative List)

The [Heady Service Catalog](https://raw.githubusercontent.com/HeadyMe/heady-docs/main/sources/04-heady-service-catalog-and-capabilities.md) defines **30+ tools across 7 domains**:

| Domain | Tools |
|---|---|
| Chat & Conversation | HeadyBuddy, HeadyChat, HeadySoul |
| Developer Tools | HeadyCoder, HeadyCodex, HeadyCopilot, HeadyRefactor, HeadyAnalyze, HeadyPatterns |
| Research & Intelligence | HeadyResearch, HeadyRisks, HeadyLens |
| Memory & Knowledge | HeadyMemory, HeadyEmbed, HeadyVinci, HeadyDeepScan |
| Creative Services | HeadyDesign, HeadyCanvas, HeadyMedia |
| Operations & Deployment | HeadyDeploy, HeadyOps, HeadyHealth, HeadyMaid, HeadyMaintenance |
| Quality & Governance | HeadyBattle, HeadyAutoFlow, HeadyDoctor |

MCP endpoint referenced: `heady.headyme.com/sse` (cloud-hosted SSE endpoint). The [.mcp/config.example.json](https://raw.githubusercontent.com/HeadyMe/Heady-Main/main/.mcp/config.example.json) in the Heady-Main monorepo targets `http://localhost:3301/mcp/v1` with `streamable-http` transport and bearer auth — confirming the production deployment intends to move beyond SSE to Streamable HTTP.

---

## 2. Likely Current Capability Envelope

### 2.1 What Is Demonstrably Working

Based on cross-referencing [heady-docs comprehensive source](https://raw.githubusercontent.com/HeadyMe/heady-docs/main/sources/00-comprehensive-source.md), [Heady-Main repo](https://github.com/HeadyMe/Heady-Main), and [headysystems.com](https://headysystems.com/):

**Transport layer:**
- Legacy SSE two-endpoint transport (2024 MCP spec)
- Streamable HTTP target declared in `.mcp/config.example.json` (not yet fully deployed)
- Bearer token auth on internal config; no DPoP or WIF in public implementation

**Tool execution:**
- Express.js gateway routes JSON-RPC method calls
- Multi-provider routing to Claude, GPT, Gemini, Groq via [HeadyAPI liquid gateway](https://headyapi.com/) (races providers, fastest wins)
- Tools dispatch through `heady-manager.js` at port 3300 (Cloud Run) or 3301 (MCP)
- 9-stage HCFullPipeline: `ingest → plan → execute-major-phase → recover → finalize`

**Memory and storage:**
- Neon Postgres (PG 16 + pgvector): 5 tables, 19 indexes — verified active
- Pinecone distributed vector DB — verified active
- 384D embeddings (all-MiniLM-L6-v2) with 8-octant spatial indexing
- Redis (Upstash) for session/state cache (URL config gap noted in docs)

**Agent system:**
- BeeFactory ([agents/bee-factory.js](https://raw.githubusercontent.com/HeadyMe/Heady-Main/main/agents/bee-factory.js)) creates typed Bee workers: JULES (code-gen), OBSERVER (review), MURPHY (security), ATLAS (architecture), SOPHIA (research), MUSE (creative)
- HiveCoordinator manages task decomposition (max 21 subtasks, FIB[8]), parallel dispatch, CSL consensus
- A2A protocol uses JSON-RPC 2.0 with context capsules and phi-weighted priority routing
- A2UI protocol uses SSE for agent→UI streaming and WebSocket for bidirectional comms

**Security:**
- TruffleHog + CodeQL on every commit
- AES-256-GCM credential store on HeadyMe
- mTLS declared for inter-service communication
- SHA-256 audit trails
- No public evidence of DPoP, Workload Identity Federation, or `.well-known/mcp.json` Server Card

### 2.2 Detected Gaps (Current State vs. Claims)

| Gap | Evidence | Severity |
|---|---|---|
| headymcp-core repo has no MCP SDK | index.js is plain Express, no `@modelcontextprotocol/sdk` | High |
| SSE transport not Streamable HTTP | `.mcp/config.example.json` targets localhost:3301 but production endpoint is SSE | High |
| No `/.well-known/mcp.json` Server Card | Not found on headymcp.com or in any repo | High |
| No DPoP / WIF auth implementation | Bearer token only in public configs | Medium |
| No Tasks primitive (SEP-1686) | No task state machine, no retry/expiry logic in public code | Medium |
| Redis URL missing in docs | Upstash URL gap noted in api-keys-reference.md | Medium |
| Anthropic key had no credits | api-keys-reference.md notes Claude key valid but no credits | Low |
| headymcp-core has 0 stars, 0 forks, 2 commits | Not a production deployment target — informational site only | Low |

---

## 3. MCP 2026 Roadmap Alignment

The [official MCP roadmap](https://modelcontextprotocol.io/development/roadmap) (updated 2026-03-05) and [2026 roadmap blog post](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) establish four priority areas. Each maps directly to HeadyMCP expansion work:

### 3.1 Priority Area 1: Transport Evolution and Scalability

**MCP targets:**
- Stateless Streamable HTTP across multiple instances
- Scalable session handling (creation, resumption, migration)
- MCP Server Cards via `.well-known/mcp.json`

**HeadyMCP gap:** Current production endpoint is SSE; `.mcp/config.example.json` declares `streamable-http` intent but internal config still targets localhost. No Server Card exists.

**HeadyMCP action:** Implement stateless Cloudflare Workers transport with KV-backed sessions, expose Server Card, migrate from SSE endpoint.

### 3.2 Priority Area 2: Agent Communication (Tasks Primitive SEP-1686)

**MCP targets:**
- Retry semantics for transient task failures
- Expiry policies for result retention
- Operational issue triage from production deployments

**HeadyMCP gap:** No Tasks primitive in public implementation. The BeeFactory and HiveCoordinator have their own retry/timeout logic (phi-derived FIB constants), but it is not MCP-protocol-compatible.

**HeadyMCP action:** Wrap HeadyBee executions in SEP-1686 Tasks with phi-backoff retry and Fibonacci-tiered TTLs. Surface task state via standard `tasks/get` and `tasks/result` endpoints.

### 3.3 Priority Area 3: Governance Maturation

**MCP targets:**
- Contributor Ladder SEP
- WG delegation model
- Charter templates

**HeadyMCP action:** Register Heady as a gateway/proxy pattern contributor to the emerging Enterprise WG. File an `experimental-ext-heady-triggers` extension under SEP-2133 to capture Heady's event-driven patterns before a Triggers WG forms.

### 3.4 Priority Area 4: Enterprise Readiness

**MCP targets (forming Enterprise WG):**
- Audit trails and observability
- SSO-integrated auth (Cross-App Access), away from static secrets
- Gateway and proxy patterns
- Configuration portability

**HeadyMCP gap:** HeadyMCP is already positioned as a gateway/proxy, but auth is static bearer tokens. Audit trail exists (SHA-256 chains in gateway code) but is not MCP-spec-aligned.

**HeadyMCP action:** Lead the gateway/proxy pattern definition by contributing to the Enterprise WG. Implement DPoP (SEP-1932, RFC 9449) and Workload Identity Federation (SEP-1933) immediately — both are stable enough to build on now.

### 3.5 On the Horizon — Triggers and Streaming Results

**MCP Horizon items:**
- Triggers/webhooks with ordering guarantees
- Streamed result types (incremental output)
- Reference-based results (pull large payloads on demand)
- Skills primitive for composed capabilities
- Extensions ecosystem maturation

**HeadyMCP alignment:** Heady's Continuous Semantic Logic (CSL) architecture is inherently push-based. The A2A protocol already uses SSE event streaming for agent→UI communication. Heady is strongly positioned to pioneer the Triggers WG pattern by contributing its event bus design.

---

## 4. Specific New Services to Add

### 4.1 Core MCP Infrastructure Services

| Service | Description | MCP Alignment |
|---|---|---|
| `heady.tool_dispatch` | Unified JSON-RPC router with stateless Streamable HTTP, method routing via `X-MCP-Method` header | Transport Evolution (Priority 1) |
| `heady.server_card` | `/.well-known/mcp.json` endpoint with full capability manifest, auth methods, rate limits, task support | Server Card WG (Priority 1) |
| `heady.task_manager` | SEP-1686 Tasks wrapper for HeadyBee executions: phi-backoff retry, Fibonacci TTL expiry, `tasks/get` / `tasks/result` endpoints | Agent Communication (Priority 2) |
| `heady.audit_trail` | SOC 2-ready JSONL audit log with SHA-256 chain, MCP-aligned fields (tool, user, input_hash, output_hash, duration_ms) | Enterprise Readiness (Priority 4) |
| `heady.session_store` | KV-backed stateless session layer: session tokens as signed JWTs in Cloudflare KV, sliding TTL, no transport-side state | Transport Evolution (Priority 1) |

### 4.2 Authentication and Security Services

| Service | Description | MCP Alignment |
|---|---|---|
| `heady.dpop_auth` | DPoP proof-of-possession (RFC 9449 / SEP-1932): nonce rotation, proof age validation, token binding, middleware layer | Security & Auth (Horizon) |
| `heady.wif_auth` | Workload Identity Federation (SEP-1933): Cloud Run OIDC token exchange, eliminates static service account keys | Security & Auth (Horizon) |
| `heady.oauth_gateway` | Cross-App Access SSO: Heady-managed OAuth server issuing scoped tokens, replacing HEADY_API_KEY bearer tokens | Enterprise Readiness (Priority 4) |
| `heady.zero_trust_sandbox` | Capability bitmask ACL per tool, input validation (SSRF/SQLi/path traversal), output redaction (keys, PII), resource limits | Security baseline |

### 4.3 Agent and Swarm Services

| Service | Description | MCP Alignment |
|---|---|---|
| `heady.bee_registry` | Live registry of available Bee types, capabilities, current load, and health — queryable via MCP `resources/list` | Agent Communication |
| `heady.swarm_orchestrator` | Upgraded HiveCoordinator exposing swarm task status via Tasks primitive; supports fan-out with partial result streaming | Agent Communication + Horizon streaming |
| `heady.federation_manager` | Cross-account / cross-org Bee delegation using WIF, enabling enterprise tenants to run Bees under their own identity | Enterprise Readiness |
| `heady.conductor_mcp` | MCP-facing interface for the HCFullPipeline Conductor: accepts a composite task, decomposes it into a DAG, dispatches subtasks as Tasks primitives | Agent Communication |

### 4.4 Data and Memory Services

| Service | Description | MCP Alignment |
|---|---|---|
| `heady.vector_resource` | Expose Neon pgvector memory as MCP Resources with ETag-based caching and subscription streams (post-Horizon) | Transport/Streaming |
| `heady.graph_rag` | Graph RAG over Neon + pgvector: entity relationship traversal exposed as MCP tool `heady.memory_graph_query` | Memory extension |
| `heady.semantic_cache` | Cloudflare KV-backed semantic deduplication (cosine ≥ 0.972 DEDUP_THRESHOLD) returning cached tool results for near-duplicate calls | Performance |
| `heady.embed_pipeline` | Continuous embedding service: accepts raw text/code, chunks, embeds via HuggingFace MiniLM, stores in pgvector and Pinecone | Memory extension |

### 4.5 Observability Services

| Service | Description | MCP Alignment |
|---|---|---|
| `heady.health_mcp` | Meta-server health tool (`meta.health`): aggregates health from all upstream MCP servers, exposes as single tool response | Enterprise Readiness |
| `heady.telemetry_stream` | Neural Stream Telemetry (HS-053): structured JSON telemetry with circuit breaker state, drift scores, per-request traces | Enterprise observability |
| `heady.drift_detector` | 6-signal drift detection (headysystems.com claim) exposed as MCP resource: fires webhook events on threshold breach | Triggers (Horizon) |
| `heady.monte_carlo_gate` | Monte Carlo deploy validation gate: executes statistical simulation, blocks deployment if pass rate < FIB-derived threshold | Quality governance |

---

## 5. New Tools to Add (MCP Tool Definitions)

The following tools fill gaps between the current 30-tool catalog and MCP 2026 capabilities. Each is a new `tools/call` handler in the MCP server:

### 5.1 Transport and Protocol Tools

```
heady.server_card_refresh     — Force-regenerate and cache /.well-known/mcp.json
heady.session_inspect         — Inspect current session metadata (expiry, capabilities)
heady.capability_probe        — Optimistically probe a capability before full initialize
heady.transport_negotiate     — Detect and negotiate transport (SSE vs Streamable HTTP)
```

### 5.2 Task Lifecycle Tools

```
heady.task_submit             — Submit long-running task, returns task_id (_meta.task)
heady.task_poll               — Poll task state: submitted / working / input_required / completed / failed
heady.task_result             — Fetch terminal result from completed task
heady.task_cancel             — Cancel in-flight task
heady.task_retry              — Manually trigger phi-backoff retry on failed task
heady.task_health             — Return task manager health: active count, retry policy, expiry policy
```

### 5.3 Agent Coordination Tools

```
heady.bee_spawn               — Spawn a named Bee (JULES, OBSERVER, MURPHY, ATLAS, SOPHIA, MUSE)
heady.bee_status              — Get live status of a specific Bee instance
heady.swarm_run               — Launch a named swarm workflow with task decomposition
heady.swarm_status            — Get consensus state of an active swarm
heady.conductor_plan          — Submit a composite goal; receive decomposed DAG plan
heady.a2a_send                — Send an A2A context capsule to a named agent
heady.hive_health             — Return hive health: active bees, pool status, queue depth
```

### 5.4 Memory and Knowledge Tools

```
heady.memory_store            — Store a vectorized artifact in 3D pgvector space
heady.memory_recall           — Semantic recall by natural language query (cosine similarity)
heady.memory_graph            — Graph traversal from a seed entity in the knowledge graph
heady.embed_text              — Embed arbitrary text using MiniLM-L6-v2
heady.octant_locate           — Return the 3D octant zone for a given embedding
heady.deep_scan               — Full project mapping: build 3D understanding of a workspace
```

### 5.5 Security and Auth Tools

```
heady.dpop_verify             — Verify a DPoP proof against current nonce window
heady.scope_check             — Check if the current session token has a named scope
heady.secret_rotate           — Trigger credential rotation for a named service
heady.audit_verify_chain      — Verify SHA-256 integrity of audit log segment
heady.vulnerability_scan      — Invoke MURPHY security-audit Bee on a code target
```

### 5.6 Observability and Governance Tools

```
heady.system_pulse            — Return live system pulse: ORS, active nodes, pipeline state
heady.drift_score             — Return current 6-signal drift score across all layers
heady.soul_check              — Query HeadySoul governance: mission alignment score, last veto
heady.pipeline_run            — Trigger HCFullPipeline with named config
heady.pipeline_state          — Return current pipeline stage and checkpoint state
heady.monte_carlo_run         — Run Monte Carlo validation simulation; return pass rate
```

---

## 6. New Workflows to Add

### 6.1 Stateless Tool Dispatch Workflow

**Current:** Stateful SSE session — client connects, initializes, stays connected.

**New:** Stateless Streamable HTTP — each request carries `X-MCP-Method` and `X-MCP-Session` headers. Session state lives in Cloudflare KV with sliding TTL (FIB[11] = 89s refresh, FIB[16] = 987s max age). Load balancers route by header without JSON body parsing.

```
Client POST /mcp/v1
  Header: X-MCP-Method: tools/call
  Header: X-MCP-Session: <jwt>
  Body: { jsonrpc, method, params }
→ Cloudflare Worker validates session from KV
→ Routes to upstream handler by method
→ Returns response + refreshed session token in response headers
```

### 6.2 Long-Running Task Lifecycle Workflow

**Current:** Synchronous tool call — client waits for result. No support for tasks exceeding HTTP timeout.

**New:** SEP-1686 Tasks pattern integrated into HeadyBee execution:

```
1. heady.task_submit(toolName, params) → { taskId, _meta.task }
2. Notification: notifications/tasks/created (prevent polling race)
3. Client polls: heady.task_poll(taskId) → { state: "working" }
4. [Optional] input_required → client provides additional context
5. heady.task_result(taskId) → { state: "completed", result }
6. Phi-backoff retry on transient failure (PHI^attempt ±PSI² jitter)
7. Result TTL: FIB[13]s default (233s), FIB[9]s sensitive (34s), FIB[16]s max (987s)
```

**Applicable HeadyBee tasks:** HeadyResearch (5–30 min), HeadyBattle (competitive eval), HeadyDeepScan (full project mapping), HeadyAutoFlow (chained pipeline).

### 6.3 Multi-Agent Swarm Workflow (A2A + MCP Tasks)

**Current:** Internal pub/sub via HiveCoordinator, not exposed via MCP.

**New:** Swarm workflow surfaced as a composite MCP Task, with subtasks as child Tasks:

```
Client: heady.swarm_run("deep-research-swarm", { topic, depth })
→ HiveCoordinator.decompose() → up to 21 subtasks
→ Each subtask wrapped as Tasks primitive with parent_task_id
→ Parallel fan-out: SOPHIA (research), OBSERVER (analyze), ATLAS (document)
→ CSL consensus: cslConsensus(vectors, phi-weights) → merged result
→ Parent task transitions: working → completed
→ Client: heady.task_result(parentTaskId) → synthesized output
```

### 6.4 Server Card Discovery Workflow

**New:** Pre-connection capability discovery to eliminate cold-start overhead:

```
Client or registry GET https://headymcp.com/.well-known/mcp.json
→ Returns Server Card JSON:
  - server metadata (name, version, homepage, org)
  - protocol version (2026-03-01)
  - transports: [streamable-http], stateless: true
  - authentication: { methods: [oauth2, dpop], scopes: [...] }
  - primitives: { tools: { count: 55 }, tasks: { sep: SEP-1686 } }
  - rate_limits: { rpm: 233, burst: 55 }
→ Cache-Control: max-age=89, stale-while-revalidate=34
→ ETag for conditional GET (304 on no change)
```

### 6.5 DPoP-Protected Request Workflow

**New:** Bound-token auth for multi-tenant agent sessions:

```
1. Client generates EC key pair (P-256)
2. Client POSTs dpop+jwt proof: { htm, htu, jti, iat, nonce, ath }
3. HeadyDPoP middleware validates:
   - typ = dpop+jwt
   - Method + URL match
   - Proof age < PHI * FIB[7] * 1000ms ≈ 21s
   - Nonce in rolling window of 5 (FIB[5])
   - Token binding (ath = SHA-256(access_token))
4. On success: req.dpop.jwk attached for downstream authorization
5. Nonce rotated every ~55s (PHI² * FIB[8] * 1000ms)
```

### 6.6 Trigger / Event-Driven Notification Workflow

**New (experimental-ext-heady-triggers):** Push-based state change notifications:

```
1. Client registers webhook: POST /mcp/v1/triggers/register
   { event: "drift.threshold_breach", url: "https://...", secret: "..." }
2. Cloudflare Queue receives drift event from drift_detector
3. Worker verifies HMAC-SHA-256 signature, delivers to registered URL
4. Client reconciles context without holding SSE connection
5. Ordering guarantee: event IDs are monotonically increasing FIB-indexed
```

---

## 7. Agent Roles

### 7.1 Current Bee Catalog (Source: BeeFactory)

| Bee Name | Role | Key Capabilities | Pool | Timeout |
|---|---|---|---|---|
| JULES | Code generation | generate, refactor, inline-suggest | Hot | 34s (FIB[9]) |
| OBSERVER | Code review | analyze, lint, security-scan | Hot | 55s (FIB[10]) |
| MURPHY | Security audit | vuln-scan, threat-model, pentest-sim | Hot | 89s (FIB[11]) |
| ATLAS | Architecture | design, document, dependency-graph | Hot | 89s (FIB[11]) |
| SOPHIA | Research | web-search, paper-analysis, citation | Warm | 144s (FIB[12]) |
| MUSE | Creative | ideate, compose, visual-design | Warm | 89s (FIB[11]) |

### 7.2 New Agent Roles to Add

#### HERMES — Protocol Liaison Agent
**Role:** MCP protocol adaptation and transport management.  
**Capabilities:** session_manage, server_card_serve, transport_negotiate, dpop_validate, wif_exchange  
**Pool:** Hot (always running — handles every inbound request)  
**Timeout:** FIB[6] * 1000ms = 8s (fast protocol-level operations only)  
**Rationale:** Centralizes all MCP 2026 transport and auth concerns in one Bee rather than scattering across tool handlers.

#### KRONOS — Task Lifecycle Manager
**Role:** Long-running task orchestration with SEP-1686 compliance.  
**Capabilities:** task_create, task_state_advance, task_retry, task_expire, task_notify  
**Pool:** Hot  
**Timeout:** FIB[16] * 1000ms = 987s (max task keepAlive)  
**Rationale:** Wraps HeadyBee executions in the Tasks primitive, enabling call-now/fetch-later for all long-running work.

#### ARGUS — Audit and Observability Agent
**Role:** Tamper-evident audit logging, drift detection, telemetry.  
**Capabilities:** audit_log, chain_verify, drift_score, telemetry_emit, soc2_export  
**Pool:** Hot  
**Timeout:** FIB[8] * 1000ms = 21s  
**Rationale:** Enterprise readiness requires end-to-end observability. ARGUS satisfies MCP Priority 4 audit trail requirements and HeadySystems' 6-signal drift detection.

#### NEXUS — Federation and Multi-Tenant Manager
**Role:** Cross-tenant Bee delegation, WIF identity exchange, scope enforcement.  
**Capabilities:** tenant_provision, wif_token_exchange, scope_validate, rate_limit_enforce  
**Pool:** Warm  
**Timeout:** FIB[9] * 1000ms = 34s  
**Rationale:** Enterprise multi-tenancy requires workload-identity-backed isolation (SEP-1933). NEXUS manages tenant context separation.

#### HERALD — Trigger and Event Dispatcher
**Role:** Push-based event delivery, webhook dispatch, trigger registration.  
**Capabilities:** trigger_register, event_dispatch, ordering_guarantee, hmac_sign  
**Pool:** Warm  
**Timeout:** FIB[7] * 1000ms = 13s  
**Rationale:** Cloudflare Queues + HERALD enables the Triggers/Event-Driven pattern from the MCP Horizon section without polling.

#### PYTHIA (Upgrade) — Enhanced Prediction and Governance
**Role:** Monte Carlo validation, HeadySoul alignment scoring, ORS gating.  
**Current state:** Referenced in HeadyAcademy AI nodes (JULES, OBSERVER, BUILDER, ATLAS, PYTHIA).  
**Upgrade:** Expose PYTHIA outputs via MCP tools (`heady.monte_carlo_run`, `heady.soul_check`, `heady.pipeline_state`), making governance checks first-class MCP operations.

---

## 8. Node Architecture

### 8.1 Current Node Topology

| Node | Type | Role |
|---|---|---|
| Cloudflare Workers (multi-PoP) | Edge | DNS, CDN, SSE transport, HeadyMCP endpoint |
| Google Cloud Run (heady-manager) | Serverless | MCP bridge, background tasks, API gateway |
| Colab Node 0 (T4 16GB) | GPU Compute | Primary inference, model hosting |
| Colab Node 1 (T4 16GB) | GPU Compute | Embedding, vector operations |
| Colab Node 2 (A100 40GB) | GPU Compute | Heavy training, fine-tuning |
| Neon Postgres (pgvector) | Storage | Vector memory, authoritative data plane |
| Pinecone | Storage | Distributed vector DB |
| Cloudflare KV/D1 | Edge Storage | Session state, edge cache |
| Tailscale Mesh | Networking | Secure inter-node communication |

### 8.2 New Nodes to Add

#### Node: HeadyMCP Gateway (Cloudflare Workers — Stateless)
**Replaces:** Current SSE endpoint at `heady.headyme.com/sse`  
**Spec:**
- Stateless Streamable HTTP per MCP Priority 1
- Method routing via `X-MCP-Method` header (no JSON body parsing for routing)
- Session state stored in Cloudflare KV (sliding TTL)
- Serves `/.well-known/mcp.json` Server Card with ETag caching
- Rate limiting: 233 rpm global, 55 rpm burst (FIB[13], FIB[10])

**Why new node:** The current headymcp-core is a placeholder Express server. A production Cloudflare Worker with the MCP SDK is a distinct deployment artifact.

#### Node: HeadyTask Store (Cloudflare D1 + KV)
**Role:** Persistent task state for SEP-1686 Tasks lifecycle  
**Spec:**
- D1 SQL: task_id, state, toolName, params, result, error, createdAt, expiresAt, retryCount
- KV: fast state reads during polling, eviction at TTL
- Max concurrent tasks: FIB[10] = 55 per gateway instance
- Cleanup cron: purge expired tasks every FIB[9] = 34s

#### Node: HERMES Transport Worker
**Role:** Dedicated Cloudflare Worker handling protocol concerns (session, DPoP, Server Card)  
**Spec:**
- Validates sessions from KV before any tool dispatch
- Validates DPoP proofs with nonce rotation
- Exchanges WIF tokens for internal service calls
- Routes to KRONOS for task operations, to HeadyAPI for tool calls

#### Node: HERALD Event Bus (Cloudflare Queues)
**Role:** Async event dispatch for triggers  
**Spec:**
- Producer: drift_detector, pipeline events, task state transitions
- Consumer: HERALD Bee dispatches to registered webhooks
- HMAC-SHA-256 signing on every delivery
- Dead-letter queue for failed deliveries (FIB[5] = 5 retry attempts)

#### Node: ARGUS Telemetry Collector
**Role:** Structured JSON telemetry aggregation  
**Spec:**
- Receives telemetry from all Bees and tools
- Writes JSONL audit logs rotated at FIB[13] × 1MiB = 233 MiB
- Retains 89 days (FIB[11])
- Exports: NDJSON, CEF (ArcSight), syslog
- Tamper-evident SHA-256 chain

---

## 9. Transport, Auth, and Task Lifecycle Upgrades

### 9.1 Transport Upgrades

| Current | Target | Why |
|---|---|---|
| SSE two-endpoint (`/sse` GET + `/message` POST) | Stateless Streamable HTTP (single POST endpoint) | MCP Priority 1 — stateless horizontal scaling |
| Stateful session in transport layer | Session as KV-backed JWT, passed in `X-MCP-Session` header | Load balancer-transparent, scale-out safe |
| No capability discovery endpoint | `/.well-known/mcp.json` Server Card | Reduces cold-start latency, enables registry crawlers |
| JSON body parsed for routing | `X-MCP-Method` and `X-MCP-Tool` headers | Enables load balancer routing without body inspection |
| General SSE GET stream | Scoped subscription streams per resource type (post-Horizon) | Reduces connection overhead, enables ETag caching |

**Migration path:**
1. Deploy HERMES Worker with stateless Streamable HTTP handler
2. Keep SSE endpoint alive for backward compat (`/sse` → deprecation notice)
3. Update `.mcp/config.example.json` to point to new Worker URL
4. Ship Server Card at `/.well-known/mcp.json`
5. Deprecate SSE after 90 days

### 9.2 Auth Upgrades

| Current | Target | Why |
|---|---|---|
| Static HEADY_API_KEY bearer token | OAuth 2.0 with scoped tokens | Enterprise SSO requirement (MCP Priority 4) |
| No token binding | DPoP proof-of-possession (SEP-1932 / RFC 9449) | Prevents token theft in multi-tenant deployments |
| Static service account keys for Cloud Run | Workload Identity Federation (SEP-1933) | Eliminates key rotation burden, MCP Horizon |
| No scope enforcement | Scoped least-privilege tokens (MCP Horizon security) | Tool-level access control |

**Migration path:**
1. Add HeadyDPoP middleware to HERMES Worker (RFC 9449 is stable now)
2. Replace Cloud Run static keys with WIF OIDC token exchange
3. Issue HeadyOAuth scoped tokens: `tools:read`, `tools:execute`, `resources:read`, `tasks:manage`
4. Deprecate HEADY_API_KEY after OAuth rollout

### 9.3 Task Lifecycle Upgrades

**Current state:** BeeFactory has internal timeout/retry (phi-backoff), but not surfaced via MCP Tasks primitive. Tool calls are synchronous HTTP — no support for call-now/fetch-later.

**Target state (SEP-1686 compliant):**

```
State machine:
submitted → working → [input_required] → completed / failed / cancelled / unknown

Task ID: passed via _meta["modelcontextprotocol.io/task"]
Notifications: notifications/tasks/created on submit (prevent polling race)

Retry policy (phi-backoff, Heady standard):
  delay_ms = min(base_ms × PHI^attempt, max_ms) × (1 ± PSI² jitter)
  Max attempts: FIB[5] = 5
  Base delay: 1000ms

TTL tiers:
  Default keepAlive:   FIB[13] × 1000ms = 233s
  Sensitive keepAlive: FIB[9]  × 1000ms = 34s
  Max keepAlive:       FIB[16] × 1000ms = 987s

Poll interval (client-side guidance): PHI × 1000ms = 1618ms
Max concurrent tasks per gateway: FIB[10] = 55

Task endpoints:
  tasks/get      — poll state
  tasks/result   — fetch terminal result
  tasks/delete   — explicit cleanup
```

---

## 10. Prioritized Implementation Roadmap

### Tier 1 — Critical Foundations (Next 30 days)
*These unlock all subsequent tiers and close the most severe gaps.*

| Priority | Item | Effort | MCP Alignment | Gap Closed |
|---|---|---|---|---|
| 1 | Deploy headymcp-core with `@modelcontextprotocol/sdk` — real MCP server, not Express placeholder | Medium | All priorities | Core gap: no SDK |
| 2 | Implement stateless Cloudflare Workers transport (`X-MCP-Session`, `X-MCP-Method`) | Medium | Priority 1 (Transport) | SSE → Streamable HTTP |
| 3 | Ship `/.well-known/mcp.json` Server Card endpoint | Low | Priority 1 (Server Card WG) | No discovery endpoint |
| 4 | Implement SEP-1686 Tasks primitive: KRONOS manager, `tasks/get`, `tasks/result`, phi-backoff retry | High | Priority 2 (Agent Comm) | No Tasks support |
| 5 | Add DPoP middleware (RFC 9449) to HERMES Worker | Medium | Horizon (Security SEP-1932) | Static bearer only |

### Tier 2 — Enterprise Readiness (30–60 days)
*MCP Priority 4 items that unlock enterprise pilots and Series A narrative.*

| Priority | Item | Effort | MCP Alignment |
|---|---|---|---|
| 6 | ARGUS audit trail: SOC 2-ready JSONL, SHA-256 chain, 89-day retention | Medium | Priority 4 (Audit) |
| 7 | Replace Cloud Run static keys with Workload Identity Federation (SEP-1933) | Medium | Horizon (Security SEP-1933) |
| 8 | HeadyOAuth scoped token server: replace HEADY_API_KEY with `tools:execute` scopes | High | Priority 4 (Enterprise auth) |
| 9 | Multi-tenancy isolation: NEXUS Bee, per-tenant rate limits (233 rpm / FIB[13]), tenant-scoped pgvector partition | High | Priority 4 (Multi-tenancy) |
| 10 | `heady.health_mcp` meta-server tool: aggregate health from all upstream servers | Low | Priority 4 (Observability) |

### Tier 3 — Agent Communication Depth (60–90 days)
*Makes the Bee/Swarm architecture MCP-native.*

| Priority | Item | Effort | MCP Alignment |
|---|---|---|---|
| 11 | HERMES + KRONOS + ARGUS as named Bee roles — registered in bee_registry | Medium | Agent Communication |
| 12 | swarm_run → composite Task with child Tasks (parent_task_id linkage) | High | Agent Communication |
| 13 | A2A protocol upgrade: context capsule as `_meta` extensions in MCP messages | Medium | Agent Communication |
| 14 | Expose BeeFactory capabilities as MCP Resources (`resources/list`, `resources/read`) | Low | Resources primitive |
| 15 | HERALD Bee + Cloudflare Queues: trigger registration, webhook delivery, HMAC signing | Medium | Horizon (Triggers) |

### Tier 4 — Streaming and Extensions (90–120 days)
*Positions Heady ahead of the June 2026 MCP spec release.*

| Priority | Item | Effort | MCP Alignment |
|---|---|---|---|
| 16 | Streamed tool results: incremental NDJSON output for SOPHIA research tasks | Medium | Horizon (Result streaming) |
| 17 | Reference-based results: store large payloads in S3/R2, return reference URI | Low | Horizon (Reference results) |
| 18 | `experimental-ext-heady-triggers` extension under SEP-2133: formalize Heady's event-driven patterns | Medium | Extensions Ecosystem |
| 19 | Conformance test suite: verify HeadyMCP against MCP TypeScript SDK test vectors | Medium | Validation |
| 20 | Enterprise WG contribution: submit gateway/proxy pattern SEP with HeadyMCP as reference impl | High | Priority 4 / Governance |

### Tier 5 — Advanced Intelligence Layer (120+ days)
*Long-term differentiation.*

| Priority | Item | Effort | MCP Alignment |
|---|---|---|---|
| 21 | Graph RAG over pgvector: `heady.memory_graph_query` MCP tool | High | Memory extension |
| 22 | PYTHIA governance as MCP tool: `heady.soul_check`, `heady.monte_carlo_run`, ORS gating | Medium | Quality governance |
| 23 | VSA computing layer: expose hyperdimensional binding/bundling as MCP tool operations | High | Research / IP |
| 24 | HeadyBattle as MCP sampling: multi-model competition via MCP sampling primitive | Medium | Agent Communication |
| 25 | APEX trading intelligence: HeadyFinance tools exposed via MCP with audit trail enforcement | High | Enterprise vertical |

---

## 11. Coherence Assessment

The audit brief asks whether HeadyMCP is "wired coherently as a liquid, dynamic, parallel, async, distributed, intelligently orchestrated latent OS." The findings are:

| Dimension | Current State | Verdict |
|---|---|---|
| **Liquid** | HeadyAPI races 4+ providers; Cloudflare multi-PoP edge | ✅ Architecturally coherent, partially deployed |
| **Dynamic** | BeeFactory spawns typed workers on demand; HiveCoordinator decomposes tasks | ✅ Coherent in design; see gap below |
| **Parallel** | HCFullPipeline parallel fan-out; 3-node Colab GPU cluster; Tailscale mesh | ✅ Infrastructure supports it |
| **Async** | No MCP Tasks primitive yet — all tool calls synchronous HTTP | ⚠️ Gap: KRONOS + SEP-1686 needed |
| **Distributed** | Cloudflare KV + pgvector + Pinecone + Redis — multi-region capable | ✅ Storage architecture is distributed |
| **Intelligently orchestrated** | CSL gates, phi-math constants, VSA computing, HeadySoul governance | ✅ Unique approach — needs MCP exposure |
| **MCP-native** | headymcp-core is an Express placeholder; `.mcp/config.example.json` targets localhost | ⚠️ Critical gap — Tier 1 item |

**Primary disconnect:** The architectural vision (Heady-Main monorepo, BeeFactory, HiveCoordinator, CSL) is sophisticated and largely coherent. The MCP-facing layer (headymcp-core) is a stub. Closing this gap is the highest-priority action.

---

## 12. Sources

| Source | URL | Role in This Report |
|---|---|---|
| HeadyMCP homepage | [headymcp.com](https://headymcp.com/) | Marketing claims baseline |
| headymcp-core repo | [github.com/HeadyMe/headymcp-core](https://github.com/HeadyMe/headymcp-core) | Implementation audit |
| site-config.json | [raw GitHub](https://raw.githubusercontent.com/HeadyMe/headymcp-core/main/site-config.json) | Feature claims |
| package.json | [raw GitHub](https://raw.githubusercontent.com/HeadyMe/headymcp-core/main/package.json) | Dependency and runtime audit |
| MCP Official Roadmap | [modelcontextprotocol.io/development/roadmap](https://modelcontextprotocol.io/development/roadmap) | Priority areas, SEPs, WGs |
| MCP 2026 Roadmap Blog | [blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) | Roadmap narrative and rationale |
| Heady-docs comprehensive source | [github.com/HeadyMe/heady-docs](https://github.com/HeadyMe/heady-docs) | Service catalog, architecture, IP |
| Heady-docs service catalog | [sources/04-heady-service-catalog-and-capabilities.md](https://raw.githubusercontent.com/HeadyMe/heady-docs/main/sources/04-heady-service-catalog-and-capabilities.md) | Authoritative tool list |
| Heady-docs architecture | [sources/05-heady-architecture-and-patterns.md](https://raw.githubusercontent.com/HeadyMe/heady-docs/main/sources/05-heady-architecture-and-patterns.md) | Six-layer stack, patterns |
| Heady-docs executive overview | [sources/01-heady-executive-overview.md](https://raw.githubusercontent.com/HeadyMe/heady-docs/main/sources/01-heady-executive-overview.md) | Platform vision |
| Strategic value assessment | [strategic/value-assessment-2026-q1.md](https://raw.githubusercontent.com/HeadyMe/heady-docs/main/strategic/value-assessment-2026-q1.md) | $4.2M NAV, roadmap priorities |
| Heady-Main monorepo | [github.com/HeadyMe/Heady-Main](https://github.com/HeadyMe/Heady-Main) | Production implementation |
| .mcp/config.example.json | [raw GitHub](https://raw.githubusercontent.com/HeadyMe/Heady-Main/main/.mcp/config.example.json) | MCP transport config |
| agents/bee-factory.js | [raw GitHub](https://raw.githubusercontent.com/HeadyMe/Heady-Main/main/agents/bee-factory.js) | Bee catalog, phi constants |
| agents/hive-coordinator.js | [raw GitHub](https://raw.githubusercontent.com/HeadyMe/Heady-Main/main/agents/hive-coordinator.js) | Swarm coordination logic |
| heady-a2a-protocol/SKILL.md | [raw GitHub](https://raw.githubusercontent.com/HeadyMe/Heady-Main/main/heady-a2a-protocol/SKILL.md) | A2A message format, A2UI events |
| HeadyMe homepage | [headyme.com](https://headyme.com/) | AES-256 vault, multi-provider, Bee Swarm claims |
| HeadyAPI homepage | [headyapi.com](https://headyapi.com/) | Liquid Gateway, race routing claims |
| HeadySystems homepage | [headysystems.com](https://headysystems.com/) | 20 nodes, 9-stage pipeline, drift detection |
| heady-mcp-2026-alignment skill | Loaded from skills/ | SEP-1686, SEP-1932, SEP-1933 implementation patterns |
| heady-mcp-gateway-zero-trust skill | Loaded from skills/ | CSL routing, connection pool, sandbox patterns |
| heady-liquid-gateway skill | Loaded from skills/ | Liquid gateway routing design |

---

*HeadyMCP Expansion Plan v1.0 — March 17, 2026*  
*Produced for: eric@headyconnection.org*  
*© 2026 HeadySystems Inc. — Eric Haywood, Founder*
