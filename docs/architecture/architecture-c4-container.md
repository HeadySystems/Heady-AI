# C4 Container Diagram — Heady™ Platform

## Container View

```mermaid
C4Container
    title Heady™ Container Diagram

    Person(user, "User")

    Container_Boundary(edge, "Edge Layer") {
        Container(cf_workers, "Cloudflare Workers", "JavaScript", "Domain routing, edge AI inference, rate limiting")
        Container(cdn, "CDN", "Cloudflare", "Static assets, SSL termination")
    }

    Container_Boundary(app, "Application Layer") {
        Container(gateway, "API Gateway", "Node.js/Express", "Request routing, auth middleware, CORS, security headers")
        Container(brain, "Brain API", "Node.js", "Chat completions, multi-model routing, streaming responses")
        Container(memory, "Memory Service", "Node.js", "Vector store/search, embedding pipeline, projection engine")
        Container(auth, "Auth Service", "Node.js", "OAuth (Google, GitHub), password, anonymous, session management")
        Container(orchestrator, "Agent Orchestrator", "Node.js", "HCFullPipeline, task dispatch, bee swarm coordination")
        Container(mcp, "MCP Gateway", "Node.js", "Model Context Protocol server, tool registry, JSON-RPC transport")
        Container(health, "Health Monitor", "Node.js", "φ-weighted composite scoring, Prometheus metrics, self-healing")
    }

    Container_Boundary(data, "Data Layer") {
        ContainerDb(postgres, "PostgreSQL + pgvector", "Cloud SQL", "Vector memory, user data, agent state")
        ContainerDb(redis, "Redis", "Managed Redis", "Session cache, rate limits, queue depth")
    }

    Container_Boundary(client, "Client Applications") {
        Container(web, "HeadyBuddy Web", "React", "Chat interface, memory explorer, agent dashboard")
        Container(chrome, "Chrome Extension", "Manifest V3", "Side panel, context menu, page analysis")
        Container(vscode, "VS Code Extension", "TypeScript", "MCP integration, inline suggestions, code review")
        Container(cli, "Heady CLI", "Node.js", "Terminal interface, pipeline management")
    }

    Rel(user, web, "Uses", "HTTPS")
    Rel(user, chrome, "Uses")
    Rel(user, vscode, "Uses")
    Rel(user, cli, "Uses")

    Rel(web, cf_workers, "API calls", "HTTPS")
    Rel(chrome, cf_workers, "API calls", "HTTPS")
    Rel(cli, gateway, "API calls", "HTTPS")

    Rel(cf_workers, gateway, "Routes", "HTTPS")
    Rel(gateway, brain, "Routes", "Internal")
    Rel(gateway, memory, "Routes", "Internal")
    Rel(gateway, auth, "Routes", "Internal")
    Rel(gateway, mcp, "Routes", "Internal")
    Rel(gateway, orchestrator, "Routes", "Internal")

    Rel(brain, postgres, "Reads/writes", "TCP")
    Rel(memory, postgres, "Vector ops", "TCP")
    Rel(auth, postgres, "User data", "TCP")
    Rel(orchestrator, redis, "Queue + state", "TCP")
    Rel(health, postgres, "Health checks", "TCP")
    Rel(health, redis, "Health checks", "TCP")
```

## Container Inventory

| Container | Technology | Port | Responsibility |
|-----------|-----------|------|---------------|
| **Cloudflare Workers** | JavaScript (V8) | 443 | Domain routing for 16 domains, edge AI inference, rate limiting, geo-routing |
| **API Gateway** | Node.js + Express | 3301 | Central request router, auth middleware, CORS, security headers, graceful shutdown |
| **Brain API** | Node.js | Internal | Multi-model routing (Claude, GPT-4o, Gemini, Groq), chat completions, streaming |
| **Memory Service** | Node.js | Internal | pgvector CRUD, embedding generation, semantic search, projection engine |
| **Auth Service** | Node.js | 3847 | OAuth2 (Google, GitHub), password auth, anonymous auth, session cookies |
| **Agent Orchestrator** | Node.js | Internal | 21-stage HCFullPipeline, bee swarm dispatch, task queue management |
| **MCP Gateway** | Node.js | Internal | Tool registry, JSON-RPC transport, SSE streaming, IDE bridge |
| **Health Monitor** | Node.js | Internal | φ-weighted composite scoring, Prometheus, K8s probes, self-healing |
| **PostgreSQL** | Cloud SQL 15 + pgvector | 5432 | Vector memory, application data, auth records |
| **Redis** | Managed Redis 7 | 6379 | Session cache, rate limit counters, queue state |

## Communication Patterns

1. **Edge → Origin**: Cloudflare Workers reverse-proxy to Cloud Run via HTTPS
2. **Internal routing**: Express sub-apps co-hosted in single Node.js process on Cloud Run
3. **Agent mesh**: mTLS 1.3 for inter-agent communication (when cert bundle present)
4. **WebSocket**: Voice relay via `wss://` upgrade on `/ws/voice/:sessionId`
5. **Event bus**: NATS JetStream for async event dispatch between services
