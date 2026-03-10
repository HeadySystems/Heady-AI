# C4 Container Diagram — Heady Platform

```mermaid
C4Container
    title Heady Platform — Container View

    Person(user, "User")

    System_Boundary(edge, "Edge Layer (Cloudflare)") {
        Container(workers, "Cloudflare Workers", "JavaScript", "Sub-ms routing, classification, edge inference")
        Container(durable, "Durable Objects", "JavaScript", "Persistent agent state, WebSocket")
        Container(pages, "Cloudflare Pages", "Static", "Website frontends")
    }

    System_Boundary(gateway, "Gateway Layer") {
        Container(nginx, "Nginx", "Reverse Proxy", "Load balancing, rate limiting, WebSocket upgrade")
        Container(gw, "Heady Gateway", "Node.js :3340", "API routing, auth, CSL dispatch")
    }

    System_Boundary(core, "Core Services (Cloud Run)") {
        Container(soul, "HeadySoul", "Node.js :3310", "Awareness, values, coherence")
        Container(brains, "HeadyBrains", "Node.js :3311", "Context assembly")
        Container(conductor, "HeadyConductor", "Node.js :3312", "Task routing, orchestration")
        Container(vinci, "HeadyVinci", "Node.js :3313", "Session planning")
        Container(memory, "HeadyMemory", "Node.js :3314", "Vector CRUD")
        Container(embed, "HeadyEmbed", "Node.js :3315", "Embedding generation")
        Container(buddy, "HeadyBuddy", "Node.js :3316", "Companion interface")
        Container(manager, "HeadyManager", "Node.js :3317", "API/MCP server")
    }

    System_Boundary(infra, "Infrastructure") {
        ContainerDb(pg, "PostgreSQL", "pgvector", "Vector memory, events")
        Container(pgb, "PgBouncer", "Connection pool", "Fibonacci-sized pools")
        Container(nats, "NATS", "JetStream", "Event messaging")
        Container(prom, "Prometheus", "Monitoring", "Metrics collection")
        Container(graf, "Grafana", "Dashboards", "Visualization")
    }

    Rel(user, workers, "HTTPS")
    Rel(user, pages, "HTTPS")
    Rel(workers, nginx, "Origin fetch")
    Rel(nginx, gw, "Proxy")
    Rel(gw, soul, "Route")
    Rel(gw, conductor, "Route")
    Rel(gw, buddy, "Route")
    Rel(conductor, brains, "Context")
    Rel(conductor, vinci, "Plan")
    Rel(memory, pgb, "SQL")
    Rel(pgb, pg, "Pool")
    Rel(core, nats, "Events")
    Rel(prom, core, "Scrape")
```
