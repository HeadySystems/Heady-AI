---
name: heady-cloud-forge
description: Design and operate the Heady Cloud Forge for cloud infrastructure provisioning, IaC generation, and multi-cloud lifecycle management. Use when generating Terraform or Pulumi configs, designing cloud architecture, managing environments across providers, or building infrastructure automation. Integrates with the Heady promotion pipeline (Heady-Testing, Heady-Staging, Heady-Main), headysystems-core Sacred Geometry architecture, and the heady-production Latent OS deployment layer.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Cloud Forge

Use this skill when you need to **design, provision, or manage cloud infrastructure** through the Cloud Forge — Heady's system for generating, validating, and deploying infrastructure-as-code with policy gates and health visibility, aligned with the Heady promotion pipeline.

## When to Use This Skill

- Generating infrastructure-as-code (Terraform, Pulumi, CloudFormation)
- Designing cloud architecture for Heady services or external projects
- Managing multi-cloud environments with cost optimization
- Building environment lifecycle automation aligned to Testing → Staging → Main promotion
- Creating infrastructure compliance policies with heady-sentinel
- Planning deployment targets for headysystems-production and headymcp-production Live Projections

## Platform Context

The Cloud Forge operates within Heady's established infrastructure:

- **Promotion pipeline**: `Heady-Testing` → `Heady-Staging` → `Heady-Main` (three-tier validation across HeadyMe, HeadySystems, HeadyConnection orgs)
- **headysystems-core** — Sacred Geometry architecture with self-healing infrastructure
- **heady-production** — enterprise Latent OS with autonomous AI orchestration
- **headymcp-core** (31 MCP tools) — orchestration layer for infrastructure automation
- **Live Projections** — `headysystems-production`, `headymcp-production`, `ableton-edge-production` are autonomous deployment targets
- **heady-sentinel** — security and compliance monitoring
- **heady-observer / heady-metrics / heady-logs** — observability stack
- **template-mcp-server** — MCP protocol server shell template for new services
- **template-heady-ui** — React micro-frontend with Module Federation template

## Instructions

### 1. Define the Infrastructure Blueprint

```yaml
infrastructure_blueprint:
  name: blueprint-name
  environment: testing | staging | production
  promotion_tier: Heady-Testing | Heady-Staging | Heady-Main
  provider: aws | gcp | azure | cloudflare | multi-cloud
  region: primary deployment region
  architecture: sacred-geometry  # follows headysystems-core patterns

  compute:
    - name: service-name
      type: container | serverless | vm | managed-service
      template: template-mcp-server | template-heady-ui | template-swarm-bee | custom
      runtime: node20 | python311 | go122 | custom
      scaling:
        min: 1
        max: 10
        metric: cpu | memory | requests | queue-depth
        target: 70%
        self_healing: true  # Sacred Geometry auto-recovery

  storage:
    - name: store-name
      type: object | block | database | cache | queue | vector
      engine: postgres | pgvector | redis | s3 | antigravity
      encryption: aes-256-gcm
      backup: { frequency: hourly, retention: 30d }

  networking:
    vpc: isolated per environment
    ingress: cloudflare-workers | api-gateway | cdn
    egress: nat-gateway | direct
    dns: { primary: cloudflare, records: auto-managed }
    tls: automated via Let's Encrypt or Cloudflare

  observability:
    metrics: heady-metrics
    logs: heady-logs
    traces: heady-traces
    alerts: heady-observer
    security: heady-sentinel
```

### 2. Generate IaC Aligned to Sacred Geometry

Infrastructure follows the headysystems-core Sacred Geometry patterns:

```
Sacred Geometry Module Structure:
├── core/           # Immutable foundation (VPC, IAM, secrets)
├── rings/          # Concentric service layers
│   ├── inner/      # Data layer (pgvector, Antigravity, Redis)
│   ├── middle/     # Application layer (MCP servers, API gateway)
│   └── outer/      # Edge layer (CDN, Cloudflare Workers, UI)
├── connectors/     # Cross-ring bridges (event bus, message queues)
└── observers/      # Observability layer (metrics, logs, traces, sentinel)
```

**IaC generation using MCP tools:**
```
1. mcp_Heady_heady_coder(prompt="generate Terraform module for [component] following Sacred Geometry")
2. mcp_Heady_heady_critique(code="{terraform}", criteria="security, Sacred Geometry compliance, cost")
3. mcp_Heady_heady_battle(action="evaluate", code="{terraform}", criteria="production-readiness")
```

### 3. Design the Environment Promotion Pipeline

Aligned to Heady's three-tier system:

```
Heady-Testing (HeadyValidator thorough testing)
    ↓ all checks pass
Heady-Staging (integration testing with full-functionality gates)
    ↓ staging validation complete
Heady-Main (production-ready, fully validated)
    ↓ promotion to Live Projections
headysystems-production / headymcp-production / ableton-edge-production
```

| Tier | Purpose | Policy Gates |
|------|---------|-------------|
| Testing | Unit tests, linting, security scan | heady-sentinel scan, test coverage > 80% |
| Staging | Integration tests, performance benchmarks | Full-functionality gates, load testing |
| Main | Production-ready artifact | heady-critique review, heady-battle evaluation |
| Live Projection | Autonomous deployment target | Health checks, canary validation |

**Promotion flow:**
```yaml
promotion:
  testing_to_staging:
    requires: [all_tests_pass, heady_sentinel_clear, coverage_threshold]
    automation: GitHub Actions → Heady-Staging mirror
  staging_to_main:
    requires: [integration_tests_pass, performance_benchmarks_met, manual_approval]
    automation: GitHub Actions → Heady-Main mirror across all three orgs
  main_to_production:
    requires: [heady_battle_score > 0.8, heady_critique_approved, canary_healthy]
    automation: Live Projection autonomous deployment
```

### 4. Implement Policy Gates via heady-sentinel

```yaml
infrastructure_policies:
  encryption:
    rule: all storage resources must have encryption_at_rest enabled
    enforcement: block creation of unencrypted resources
    scanner: heady-sentinel

  public_access:
    rule: no public endpoints unless explicitly approved
    enforcement: deny 0.0.0.0/0 ingress rules
    exception: Live Projection CDN endpoints

  tagging:
    rule: all resources require owner, environment, cost-center, sacred-geometry-ring tags
    enforcement: reject untagged resources

  iam:
    rule: least-privilege, no wildcard policies
    enforcement: heady-sentinel scans all IAM changes

  secrets:
    rule: no secrets in code, config, or environment variables
    enforcement: all secrets via managed store (SSM, Vault, Cloudflare secrets)

  observability:
    rule: all services must emit metrics to heady-metrics and logs to heady-logs
    enforcement: block deployment of unobservable services
```

### 5. Plan Cost Management

```yaml
cost_management:
  budget_by_environment:
    testing: alert at $500/month
    staging: alert at $1000/month
    production: alert at $5000/month
  optimization:
    - heady-observer monitors resource utilization
    - heady-vinci predicts cost trends from usage patterns
    - Auto-stop testing/staging outside business hours
    - Recommend reserved instances for stable production workloads
    - Lifecycle policies move cold data to cheaper storage tiers
  reporting:
    daily: heady-metrics cost by service, environment, ring
    weekly: heady-vinci trend analysis + optimization recommendations
    monthly: budget vs actual with forecast via HeadyWeb dashboard
```

### 6. Design Multi-Template Provisioning

Leverage Heady's existing templates for rapid service creation:

| Template | Use Case | Sacred Geometry Ring |
|----------|---------|---------------------|
| `template-mcp-server` | New MCP protocol server | Middle ring |
| `template-heady-ui` | React micro-frontend with Module Federation | Outer ring |
| `template-swarm-bee` | Swarm agent with Pub/Sub lifecycle | Middle ring |
| Custom | Database, cache, or infrastructure service | Inner ring |

**Template instantiation:**
```
1. Select template matching service type
2. Generate IaC for hosting the template in target environment
3. Wire observability (heady-metrics, heady-logs, heady-traces)
4. Configure heady-sentinel policies
5. Deploy to Heady-Testing tier
6. Promote through pipeline
```

## Output Format

When designing Cloud Forge features, produce:

1. **Infrastructure blueprint** with Sacred Geometry ring placement
2. **IaC output** generated via HeadyCoder with Sacred Geometry compliance
3. **Promotion pipeline** aligned to Testing → Staging → Main → Live Projection
4. **Policy gates** enforced by heady-sentinel
5. **Cost management** plan with heady-metrics and heady-vinci
6. **Template provisioning** workflow

## Tips

- **Sacred Geometry is the architecture** — every service belongs in a ring; don't create orphan infrastructure
- **Promote, never skip** — the Testing → Staging → Main pipeline exists for a reason; no direct-to-production
- **heady-sentinel is the gatekeeper** — policy violations block promotion; fix violations, don't bypass the gate
- **Live Projections are autonomous** — once promoted to Main, deployment targets handle their own updates
- **Templates accelerate** — use `template-mcp-server`, `template-heady-ui`, or `template-swarm-bee` for new services
- **Observability is mandatory** — an unobservable service is an invisible failure waiting to happen
