# C4 Context Diagram — Heady™ Platform

## System Context

The Heady™ platform is a sovereign AI infrastructure system that provides multi-model AI routing, persistent vector memory, agent orchestration, and cross-device companion capabilities.

```mermaid
C4Context
    title Heady™ System Context Diagram

    Person(user, "Heady User", "Developer, power user, or enterprise customer")
    Person(admin, "Platform Admin", "HeadySystems operator")

    System(heady, "Heady™ Platform", "Sovereign AI infrastructure with Sacred Geometry architecture")

    System_Ext(openai, "OpenAI", "GPT-4o, embeddings")
    System_Ext(anthropic, "Anthropic", "Claude 3.5/4")
    System_Ext(google, "Google AI", "Gemini Pro/Flash")
    System_Ext(groq, "Groq", "Low-latency inference")
    System_Ext(perplexity, "Perplexity", "Sonar search + research")
    System_Ext(cloudflare, "Cloudflare", "Edge workers, CDN, DNS")
    System_Ext(gcloud, "Google Cloud", "Cloud Run, Cloud SQL")
    System_Ext(github, "GitHub", "Source control, CI/CD")
    System_Ext(firebase, "Firebase", "Auth, hosting")

    Rel(user, heady, "Uses", "HTTPS/WSS")
    Rel(admin, heady, "Manages", "Admin UI")
    Rel(heady, openai, "Routes AI requests", "HTTPS")
    Rel(heady, anthropic, "Routes AI requests", "HTTPS")
    Rel(heady, google, "Routes AI requests", "HTTPS")
    Rel(heady, groq, "Routes AI requests", "HTTPS")
    Rel(heady, perplexity, "Research queries", "HTTPS")
    Rel(heady, cloudflare, "Edge routing + CDN", "HTTPS")
    Rel(heady, gcloud, "Hosting + storage", "HTTPS")
    Rel(heady, github, "CI/CD + source", "HTTPS")
    Rel(heady, firebase, "Auth + hosting", "HTTPS")
```

## External Actors

| Actor | Description | Interaction |
|-------|-------------|-------------|
| **Heady User** | End user accessing the platform via web, Chrome extension, VS Code, desktop, or mobile | HTTPS + WebSocket |
| **Platform Admin** | HeadySystems team managing infrastructure and configuration | Admin UI + CLI |
| **AI Providers** | OpenAI, Anthropic, Google, Groq — multi-model routing targets | REST API |
| **Perplexity** | Deep research and web search with citations | REST API |
| **Cloudflare** | Edge compute, DNS, SSL termination, domain routing | Workers API |
| **Google Cloud** | Cloud Run (compute), Cloud SQL (PostgreSQL + pgvector) | GCP APIs |
| **GitHub** | Source control, CI/CD workflows, Copilot agents | REST + WebHook |
| **Firebase** | Authentication (OAuth, password, anonymous), static hosting | Firebase SDK |

## Key Boundaries

1. **Trust Boundary**: All external AI provider traffic is encrypted (TLS 1.3) and routed through the Heady gateway with circuit breakers and retry logic
2. **Data Boundary**: Vector memory (pgvector) never leaves the sovereign cloud — embeddings are generated server-side
3. **Auth Boundary**: OAuth tokens, API keys, and session cookies are scoped per-domain with `SameSite=Lax` and `HttpOnly` flags
