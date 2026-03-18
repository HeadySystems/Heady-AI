---
name: heady-api-agora
description: Design and operate the Heady API Agora for public API design, developer portal, SDK generation, rate limiting, and developer ecosystem management. Use when designing public API endpoints, building developer documentation, creating SDK packages, implementing API versioning and deprecation, planning developer onboarding, or managing API marketplace features. Integrates with headyapi-core for API gateway, headyio-core for SDK, heady-docs for documentation, heady-sentinel for API auth, and heady-metrics for usage analytics.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady API Agora

Use this skill when you need to **design, build, or operate the API Agora** — Heady's public-facing API marketplace, developer portal, and SDK ecosystem that enables external developers to build on the Heady platform.

## When to Use This Skill

- Designing public API endpoints for the Heady platform
- Building the developer portal and documentation experience
- Creating SDK packages via headyio-core
- Implementing API versioning, deprecation, and migration strategies
- Planning rate limiting and usage-based billing for API consumers
- Managing the developer onboarding and API key lifecycle
- Designing API marketplace features for third-party integrations

## Platform Context

The API Agora operates across Heady's developer infrastructure:

- **headyapi-core** — API Gateway with rate limiting, auth, and intelligent routing; the single entry point for all external API calls
- **headyio-core** — Developer SDK and IO; official SDK for building on the Heady platform
- **heady-docs** — Documentation Hub; single source of truth for all API references, architecture docs, and guides
- **headydocs** — Production documentation site
- **heady-sentinel** — API key management, auth enforcement, and abuse detection
- **heady-metrics** — tracks API usage per key, per endpoint, per method; billing metering
- **heady-observer** — monitors API health, latency, error rates, and availability
- **heady-traces** — records every API call for debugging and audit
- **heady-logs** — centralized log aggregation for API request/response logs
- **headymcp-core** (31 MCP tools) — backend capabilities exposed through API endpoints
- **HeadyWeb** — developer portal surface and API dashboard
- **HeadyMemory** (`latent-core-dev`, pgvector) — stores developer profiles and API usage patterns
- **Promotion Pipeline** (Testing → Staging → Main) — API changes follow the standard promotion flow

## Instructions

### 1. Define the API Architecture

```yaml
api_agora:
  gateway: headyapi-core
  base_url: api.heady.io
  protocol: REST (primary) + GraphQL (query-heavy use cases) + WebSocket (real-time)

  api_surface:
    v1:
      status: stable
      endpoints:
        memory:
          - POST /v1/memory/store — store data in HeadyMemory
          - GET /v1/memory/query — semantic search in HeadyMemory
          - DELETE /v1/memory/forget — remove data from HeadyMemory
        agents:
          - POST /v1/agents/create — spawn an agent
          - GET /v1/agents/{id}/status — agent status and health
          - POST /v1/agents/{id}/task — assign task to agent
          - DELETE /v1/agents/{id} — terminate agent
        tools:
          - POST /v1/tools/invoke — invoke an MCP tool
          - GET /v1/tools/list — list available tools with schemas
        buddy:
          - POST /v1/buddy/chat — send message to HeadyBuddy
          - POST /v1/buddy/voice — send audio to Voice Vessel
          - GET /v1/buddy/context — get current conversation context
        analysis:
          - POST /v1/analyze — run analysis via heady-vinci
          - POST /v1/critique — run critique evaluation
          - POST /v1/battle — comparative evaluation

  versioning:
    strategy: URL path versioning (/v1/, /v2/)
    compatibility: minor versions backward compatible; major versions may break
    deprecation_policy:
      notice: 6 months before sunset
      migration_guide: published in heady-docs
      sunset: endpoint returns 410 Gone after sunset date
    header: X-Heady-API-Version for minor version selection

  rate_limiting:
    enforcement: headyapi-core per API key
    tiers:
      free: { requests_per_minute: 10, requests_per_day: 1000, burst: 20 }
      developer: { requests_per_minute: 60, requests_per_day: 10000, burst: 100 }
      startup: { requests_per_minute: 300, requests_per_day: 100000, burst: 500 }
      enterprise: { requests_per_minute: 1000, requests_per_day: unlimited, burst: 2000 }
    headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
    overage: HTTP 429 with Retry-After header
```

### 2. Build the Developer Portal

```yaml
developer_portal:
  surface: HeadyWeb + headydocs
  url: developers.heady.io

  sections:
    getting_started:
      - overview: what Heady APIs can do
      - quickstart: get first API call working in < 5 minutes
      - authentication: how to get and use API keys
      - sdks: links to headyio-core packages

    api_reference:
      source: heady-docs (auto-generated from API specs)
      format: OpenAPI 3.1 specification
      features: [interactive try-it, code examples in 5+ languages, response schemas]
      hosting: headydocs production site

    guides:
      - building_agents: create and manage agents via API
      - memory_operations: store and query HeadyMemory
      - voice_integration: integrate Voice Vessel
      - buddy_integration: embed HeadyBuddy in your app
      - webhooks: receive real-time events from Heady

    sdks:
      source: headyio-core
      languages: [JavaScript/TypeScript, Python, Go, Rust, Ruby]
      features: [typed clients, auto-retry, streaming support, webhook verification]
      distribution: npm, PyPI, Go modules, crates.io, RubyGems

    sandbox:
      environment: Heady-Testing org (separate from production)
      features: [test API keys, mock responses, request inspector]
      limits: reduced rate limits, no billing
      promotion: sandbox → production when developer is ready

  developer_dashboard:
    api_keys: create, rotate, revoke API keys
    usage: real-time usage charts per endpoint (heady-metrics)
    billing: current usage vs plan limits, upgrade options
    logs: recent API calls with request/response (heady-traces)
    webhooks: configure and test webhook endpoints
    health: API status page with uptime history (heady-observer)
```

### 3. Design API Authentication and Security

```yaml
api_security:
  authentication:
    api_key:
      format: "hdy_live_" prefix (production) + "hdy_test_" prefix (sandbox)
      delivery: X-Heady-API-Key header
      rotation: developer-initiated from dashboard
      revocation: immediate effect, heady-sentinel propagates globally

    oauth:
      flow: Authorization Code with PKCE (for user-context API calls)
      scopes: [memory:read, memory:write, agents:manage, buddy:chat, tools:invoke]
      tokens: JWT with RS256 signing, 1h expiry, refresh token for 30d

    webhooks:
      verification: HMAC-SHA256 signature in X-Heady-Signature header
      secret: per-webhook endpoint, managed in developer dashboard

  security:
    tls: TLS 1.3 minimum for all API traffic
    input_validation: headyapi-core validates all request bodies against OpenAPI schemas
    output_sanitization: no internal data leaked in API responses
    abuse_detection: heady-sentinel monitors for scraping, credential stuffing, injection attempts
    ip_allowlisting: optional per API key for enterprise customers
    cors: configurable per developer application

  rate_limiting_enforcement:
    layer_1: headyapi-core token bucket per API key (fast path)
    layer_2: heady-sentinel sliding window per IP (abuse prevention)
    layer_3: heady-observer global rate monitoring (platform protection)
```

### 4. Build SDK Generation Pipeline

```yaml
sdk_pipeline:
  source: OpenAPI 3.1 specification from heady-docs
  generation:
    tool: automated from spec + hand-crafted ergonomic wrappers
    languages:
      typescript:
        package: "@heady/sdk" via headyio-core
        features: [full TypeScript types, streaming, retry, tree-shakeable]
        distribution: npm

      python:
        package: "heady-sdk" via headyio-core
        features: [type hints, async support, streaming, auto-pagination]
        distribution: PyPI

      go:
        package: "github.com/HeadyMe/heady-go" via headyio-core
        features: [context support, streaming, retry with backoff]
        distribution: Go modules

  testing:
    integration: SDK tests run against Heady-Testing sandbox
    promotion: SDK release follows Testing → Staging → Main pipeline
    compatibility: SDK versions tested against all supported API versions

  documentation:
    inline: comprehensive code comments and docstrings
    examples: per-endpoint usage examples in every language
    hosting: heady-docs API reference with SDK code tabs
```

### 5. Design API Analytics and Monitoring

```yaml
api_analytics:
  developer_facing:
    dashboard: developer portal usage charts
    metrics: [requests, errors, latency_p50/p95/p99, top_endpoints, error_breakdown]
    exports: CSV/JSON export of usage data
    alerts: developer-configurable threshold alerts

  platform_facing:
    heady_metrics:
      - total_requests: per endpoint, per version, per developer
      - error_rate: 4xx and 5xx breakdown
      - latency: per endpoint percentile distribution
      - active_developers: daily/weekly/monthly active API key count
      - top_consumers: highest usage developers for capacity planning

    heady_observer:
      - availability: per endpoint uptime tracking
      - degradation: latency spike detection and alerting
      - dependency_health: backend service health affecting API
      - capacity: headroom before rate limits are insufficient

    heady_traces:
      - request_tracing: end-to-end trace from API call through MCP tools
      - error_debugging: full context for developer-reported issues
      - audit: compliance audit trail for all API access

  sla:
    uptime: 99.9% for stable endpoints
    latency: p95 < 500ms for synchronous endpoints
    measurement: heady-observer continuous monitoring
    reporting: monthly SLA report on status page
```

### 6. Build the API Agora Dashboard

HeadyWeb interface for API management:

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **API Health** | heady-observer | Per-endpoint uptime, latency, error rate |
| **Usage Overview** | heady-metrics | Request volume, top endpoints, active developers |
| **Developer Directory** | HeadyMemory | Registered developers, plan tiers, activity |
| **Rate Limit Status** | headyapi-core | Per-tier utilization, approaching-limit developers |
| **Version Dashboard** | heady-docs | Active API versions, deprecation timeline, migration progress |
| **SDK Releases** | headyio-core | Latest SDK versions per language, download counts |
| **Revenue** | heady-metrics | API billing revenue by tier, growth trends |

## Output Format

When designing API Agora features, produce:

1. **API architecture** with endpoint design, versioning, and rate limiting
2. **Developer portal** with documentation, sandbox, and onboarding flow
3. **Security model** with authentication, authorization, and abuse prevention
4. **SDK pipeline** with generation, testing, and distribution
5. **Analytics** with developer-facing and platform-facing metrics
6. **Dashboard** specification with API health and usage data

## Tips

- **headyapi-core is the single front door** — all external traffic enters through the API Gateway; never expose internal services directly
- **headyio-core is the SDK home** — every language SDK lives here; keep parity across languages
- **heady-docs is the source of truth** — API reference is auto-generated from OpenAPI specs; never let docs drift from implementation
- **Sandbox first** — developers start in Heady-Testing environment; this protects production and gives developers a safe playground
- **Versioning is a contract** — once an endpoint is stable, breaking changes require a new major version; deprecation policy protects developers
- **Rate limits are safety nets** — protect the platform without frustrating legitimate developers; always return helpful 429 responses with retry guidance
