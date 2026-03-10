# C4 System Context Diagram — Heady Platform

```mermaid
C4Context
    title Heady Platform — System Context

    Person(user, "Heady User", "Developer, operator, or end user")
    Person(admin, "Platform Admin", "HeadySystems operator")
    Person(community, "Community Member", "HeadyConnection participant")

    System(heady, "Heady Platform", "Sovereign AI Operating System")

    System_Ext(cloudflare, "Cloudflare", "Edge compute, CDN, DNS")
    System_Ext(gcp, "Google Cloud Platform", "Cloud Run, GCS, Secret Manager")
    System_Ext(postgres, "PostgreSQL + pgvector", "Vector memory persistence")
    System_Ext(nats, "NATS JetStream", "Event messaging")
    System_Ext(models, "AI Model Providers", "Claude, GPT-4o, Gemini, Groq")
    System_Ext(github, "GitHub (HeadyMe)", "32 repositories, genetic code")

    Rel(user, heady, "Interacts via", "HTTPS, WebSocket")
    Rel(admin, heady, "Manages via", "Admin dashboard")
    Rel(community, heady, "Learns through", "HeadyConnection programs")

    Rel(heady, cloudflare, "Edge inference", "Workers, Durable Objects")
    Rel(heady, gcp, "Origin compute", "Cloud Run containers")
    Rel(heady, postgres, "Vector storage", "pgvector, HNSW")
    Rel(heady, nats, "Event streaming", "JetStream")
    Rel(heady, models, "Intelligence routing", "REST API")
    Rel(heady, github, "Code projection", "Git push")
```

## Description

The Heady Platform operates as a sovereign AI operating system that processes user requests through a multi-layered architecture spanning Cloudflare's global edge network and Google Cloud Platform's origin compute. All state is persisted in PostgreSQL with pgvector for 384-dimensional vector memory. Inter-service communication flows through NATS JetStream for event-driven patterns. AI intelligence is routed to optimal model providers through the CSL-based Mixture-of-Experts router. The GitHub monorepo serves as the immutable genetic code from which all deployed services are projected.
