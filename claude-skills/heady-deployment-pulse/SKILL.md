---
name: heady-deployment-pulse
description: Design and operate the Heady Deployment Pulse for real-time deployment monitoring, release health tracking, and automated rollback across the Heady promotion pipeline. Use when building deployment visibility, designing canary or blue-green releases, creating health checks, planning rollback strategies, or tracking DORA metrics. Integrates with heady-observer, heady-metrics, heady-sentinel, and the Testing-Staging-Main promotion flow.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Deployment Pulse

Use this skill when you need to **monitor, manage, or automate deployments** across the Heady promotion pipeline — from Heady-Testing through Heady-Staging to Heady-Main and Live Projections.

## When to Use This Skill

- Building deployment visibility across the three-tier promotion pipeline
- Designing canary, blue-green, or rolling release strategies for Live Projections
- Creating automated health checks and rollback triggers using heady-observer
- Monitoring DORA metrics (deploy frequency, lead time, failure rate, MTTR)
- Planning release coordination across Heady's multi-org repo mirrors
- Designing the deployment dashboard on HeadyWeb

## Platform Context

Deployment Pulse monitors the full Heady release lifecycle:

- **Promotion pipeline**: `Heady-Testing` → `Heady-Staging` → `Heady-Main` (mirrored across HeadyMe, HeadySystems, HeadyConnection orgs)
- **Live Projections**: `headysystems-production`, `headymcp-production`, `ableton-edge-production` — autonomous deployment targets
- **heady-observer** — real-time health monitoring and alert triggers
- **heady-metrics** — quantitative deployment and service health data
- **heady-sentinel** — security gate that blocks promotion of vulnerable code
- **heady-traces** — deployment audit trail with full provenance
- **heady-logs** — centralized log aggregation for post-deploy analysis
- **headymcp-core** (31 MCP tools) — orchestrates deployment automation
- **headybot-core** — autonomous bot framework for swarm-based deployment validation

## Instructions

### 1. Define the Deployment Model

```yaml
deployment:
  id: uuid
  service: service-name
  version: semver or commit SHA
  source_repo: HeadyMe/[repo] | HeadySystems/[repo] | HeadyConnection/[repo]
  tier: testing | staging | main | live-projection
  target: Heady-Testing | Heady-Staging | Heady-Main | headysystems-production | headymcp-production
  strategy: direct | rolling | canary | blue-green
  initiated_by: user-id | github-actions | heady-maestro
  initiated_at: ISO-8601
  status: pending | promoting | validating | healthy | degraded | rolled-back | failed

  gates:
    - name: heady-sentinel-scan
      status: passed | failed | pending
      required_for: testing → staging
    - name: integration-tests
      status: passed | failed | pending
      required_for: staging → main
    - name: heady-battle-evaluation
      status: passed | failed | pending
      score: 0.0-1.0
      required_for: main → live-projection
    - name: canary-health
      status: passed | failed | pending
      required_for: live-projection traffic ramp

  rollback:
    available: true | false
    previous_version: version to roll back to
    auto_trigger_conditions: [defined below]
    executed_at: ISO-8601 | null
```

### 2. Design the Multi-Tier Promotion Flow

```
Developer push → Heady-Testing (auto-deploy)
                       ↓ gates pass
                 Heady-Staging (auto-deploy, integration test)
                       ↓ gates pass
                 Heady-Main (manual approval for first deploy, auto after)
                       ↓ mirror to all three orgs
                 HeadyMe/Heady-Main + HeadySystems/Heady-Main + HeadyConnection/Heady-Main
                       ↓ canary deployment
                 Live Projections (headysystems-production, headymcp-production, etc.)
```

**Tier-specific strategies:**

| Tier | Deploy Strategy | Validation | Rollback |
|------|----------------|-----------|----------|
| Testing | Direct replace | Unit tests + heady-sentinel scan | Auto on test failure |
| Staging | Direct replace | Integration tests + performance benchmarks | Auto on gate failure |
| Main | Rolling update | heady-battle evaluation + heady-critique review | Manual trigger |
| Live Projection | Canary (5% → 25% → 50% → 100%) | heady-observer health checks | Auto on health degradation |

### 3. Build Health Check Framework

Layered checks powered by heady-observer and heady-metrics:

```yaml
health_checks:
  readiness:
    type: http
    endpoint: /health
    expected: 200
    timeout_ms: 5000
    check_interval: 10s
    source: heady-observer

  smoke_tests:
    type: synthetic
    scenarios:
      - "API responds to core endpoints"
      - "MCP tools respond within SLA"
      - "Module Federation UI loads"
    run_after: deploy-complete
    source: headybot-core swarm validation

  metric_checks:
    - name: error_rate
      source: heady-metrics
      query: "error_rate_5m for [service]"
      threshold: "< 1%"
      evaluation_window: 5m

    - name: p99_latency
      source: heady-metrics
      query: "latency_p99_5m for [service]"
      threshold: "< 3s"
      evaluation_window: 5m

    - name: throughput
      source: heady-metrics
      query: "requests_per_second for [service]"
      threshold: "> 80% of pre-deploy baseline"
      evaluation_window: 10m

  dependency_checks:
    - name: pgvector_connectivity
      target: latent-core-dev database
      source: heady-observer
    - name: mcp_tool_availability
      target: headymcp-core 31 tools
      source: heady-observer
```

### 4. Implement Automated Rollback

```yaml
rollback_triggers:
  - condition: error_rate > 2% for 3 consecutive minutes
    action: immediate rollback
    notification: heady-observer → page on-call + notify deployer

  - condition: p99_latency > 5s for 5 consecutive minutes
    action: pause canary, alert deployer
    escalation: auto-rollback if unresolved in 10 minutes

  - condition: heady-sentinel detects vulnerability in deployed code
    action: immediate rollback + block re-promotion until fixed

  - condition: Live Projection health check fails 3 consecutive times
    action: route 100% traffic to previous version
    notification: heady-observer → all stakeholders

rollback_procedure:
  1. Halt traffic to new version (heady-maestro orchestrates)
  2. Route 100% to previous version
  3. Verify previous version healthy via heady-observer
  4. Log rollback in heady-traces with full context
  5. Create incident in HeadyConnection workspace
  6. Preserve failed version artifacts for debugging
  7. mcp_Heady_heady_soul(content="rollback context", action="learn")
```

### 5. Track DORA Metrics

```yaml
dora_metrics:
  deployment_frequency:
    definition: deploys to production (Live Projections) per day
    source: heady-metrics counting promotion events to Main
    target: daily+

  lead_time:
    definition: commit timestamp to production deployment
    source: heady-traces (commit → Testing → Staging → Main → Live Projection)
    target: "< 2 hours"

  change_failure_rate:
    definition: "% of deployments causing rollback or incident"
    source: heady-metrics rollback events / total deployments
    target: "< 5%"

  mttr:
    definition: mean time from failure detection to resolution
    source: heady-observer alert timestamp to heady-traces resolution timestamp
    target: "< 30 minutes"
```

### 6. Design the Deployment Dashboard on HeadyWeb

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Pipeline View** | heady-traces | Current position of each release in Testing → Staging → Main → Live |
| **Active Deploys** | heady-observer | Live Projection canary progress with health indicators |
| **Gate Status** | heady-sentinel + test results | Pass/fail status of each promotion gate |
| **DORA Metrics** | heady-metrics | Four key metrics with trend lines |
| **Recent Rollbacks** | heady-traces | Rollback history with root cause links |
| **Org Mirror Status** | GitHub API | Sync status across HeadyMe, HeadySystems, HeadyConnection |

## Output Format

When designing Deployment Pulse features, produce:

1. **Deployment model** aligned to multi-tier promotion pipeline
2. **Promotion flow** with gates at each tier transition
3. **Health check framework** using heady-observer and heady-metrics
4. **Rollback triggers** and automated procedures
5. **DORA metrics** tracking with targets
6. **Dashboard** design with data sources per panel

## Tips

- **The pipeline is the product** — Testing → Staging → Main → Live Projection is how Heady ships; respect every tier
- **Canary at the Live Projection layer** — the final tier gets the most cautious rollout strategy
- **heady-sentinel blocks, not warns** — a security vulnerability stops promotion; no exceptions
- **Mirror sync is critical** — all three orgs (HeadyMe, HeadySystems, HeadyConnection) must stay in sync
- **heady-soul learns from rollbacks** — feed every failure back into the learning layer to improve future deployments
- **DORA metrics drive improvement** — measure lead time and failure rate together; speed without stability is chaos
