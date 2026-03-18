---
name: heady-treasury-nexus
description: Design and operate the Heady Treasury Nexus for platform finance, tokenomics modeling, revenue allocation, and cost governance across the Heady ecosystem. Use when designing token economies, modeling revenue flows, building cost attribution dashboards, managing platform treasury operations, or planning subscription and usage-based billing. Integrates with heady-metrics for financial telemetry, heady-observer for spend alerts, heady-sentinel for financial policy enforcement, and HeadyMemory for transaction history.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Treasury Nexus

Use this skill when you need to **design, model, or operate the Treasury Nexus** — Heady's financial control plane for managing platform economics, token flows, cost attribution, revenue allocation, and sustainable growth across the HeadyMe, HeadySystems, and HeadyConnection organizations.

## When to Use This Skill

- Designing tokenomics models for platform credits, compute tokens, or skill marketplace currency
- Building revenue allocation pipelines across subscription, usage, and marketplace channels
- Creating cost attribution dashboards for compute, storage, and API usage
- Implementing treasury governance with multi-signature approval and audit trails
- Planning billing integration for headyapi-core rate-limited API access
- Modeling financial sustainability for HeadyConnection nonprofit operations

## Platform Context

The Treasury Nexus operates across Heady's financial infrastructure:

- **headyapi-core** — API Gateway with rate limiting and auth; billing metered here
- **heady-metrics** — tracks compute usage, API calls, storage consumption, and cost per tenant
- **heady-observer** — monitors spend thresholds and triggers budget alerts
- **heady-sentinel** — enforces financial policies (spend limits, approval gates, fraud detection)
- **heady-traces** — records every financial transaction for audit and compliance
- **HeadyMemory** (`latent-core-dev`, pgvector) — stores transaction history and financial projections
- **heady-vinci** — forecasts revenue, predicts cost trends, identifies optimization opportunities
- **heady-montecarlo** — runs probabilistic financial simulations for planning
- **headymcp-core** (31 MCP tools) — orchestrates treasury operations
- **HeadyWeb** — treasury dashboard surface
- **HeadyConnection** (`headyconnection-core`) — nonprofit financial reporting and grant fund tracking
- **Promotion Pipeline** (Testing → Staging → Main) — financial policy gates at each promotion stage

## Instructions

### 1. Define the Treasury Model

```yaml
treasury:
  id: uuid
  org: HeadyMe | HeadySystems | HeadyConnection
  status: active | frozen | auditing

  accounts:
    - name: platform-revenue
      type: revenue
      sources: [subscriptions, usage-metered, marketplace-commissions, api-access]
      currency: USD
      balance: current balance
      reconciliation: daily via heady-traces

    - name: compute-pool
      type: cost-center
      consumers: [heady-production, headymcp-core, heady-vinci, heady-montecarlo]
      budget: monthly allocation
      burn_rate: heady-metrics current rate
      alert_threshold: 80% of budget

    - name: storage-pool
      type: cost-center
      consumers: [HeadyMemory pgvector, heady-logs, heady-traces, heady-stories]
      budget: monthly allocation

    - name: api-gateway
      type: cost-center
      consumers: [headyapi-core external calls, third-party model APIs]
      budget: monthly allocation

    - name: connection-fund
      type: restricted
      purpose: HeadyConnection nonprofit operations and grants
      sources: [donations, grant-allocated, platform-subsidy]
      restrictions: nonprofit compliance, grant terms
      reporting: quarterly impact reports

  tokens:
    compute_credits:
      unit: 1 credit = 1 minute of standard compute
      pricing: tiered by plan
      allocation: per-user monthly pool + burst capacity
      tracking: heady-metrics per-request attribution

    storage_units:
      unit: 1 unit = 1 GB-month of HeadyMemory
      pricing: included in plan + overage billing
      tracking: heady-metrics per-namespace measurement

    api_calls:
      unit: 1 call through headyapi-core
      pricing: tiered rate limits by plan
      tracking: headyapi-core request counter + heady-metrics aggregation
```

### 2. Build Revenue Allocation Pipeline

```yaml
revenue_pipeline:
  collection:
    subscriptions:
      source: Stripe/payment processor webhook
      frequency: monthly recurring
      tiers: [free, pro, team, enterprise]
      recording: heady-traces logs every payment event

    usage_metered:
      source: heady-metrics aggregated usage beyond plan limits
      frequency: daily calculation, monthly billing
      components: [compute overage, storage overage, API overage]

    marketplace:
      source: heady-skill-bazaar commissions (from Wave 2)
      rate: percentage of skill sale price
      settlement: monthly to skill creators minus platform commission

    api_access:
      source: headyapi-core external developer billing
      frequency: monthly based on metered usage
      tiers: [developer-free, startup, scale, enterprise]

  allocation:
    rules:
      - revenue * 0.40 → engineering (compute, infrastructure)
      - revenue * 0.20 → growth (marketing, partnerships)
      - revenue * 0.15 → platform-reserve (runway, contingency)
      - revenue * 0.10 → connection-fund (HeadyConnection nonprofit subsidy)
      - revenue * 0.10 → creator-pool (skill marketplace payouts)
      - revenue * 0.05 → innovation (R&D, experimental features)

    governance:
      approval: allocation changes require multi-sig from treasury admins
      audit: heady-traces records every allocation with rationale
      review: monthly review via heady-vinci trend analysis
```

### 3. Implement Cost Attribution

```yaml
cost_attribution:
  granularity: per-user, per-workspace, per-agent, per-request

  collection:
    compute:
      source: heady-metrics CPU/GPU seconds per request
      tagging: every MCP tool call tagged with user_id + workspace_id + agent_id
      aggregation: hourly rollup to heady-metrics, daily to HeadyMemory

    storage:
      source: heady-metrics namespace sizes in HeadyMemory (pgvector)
      tagging: per-namespace ownership
      measurement: daily snapshot

    api:
      source: headyapi-core request logs
      tagging: API key → user → workspace
      measurement: real-time counter + hourly rollup

    third_party:
      source: external model API costs (OpenAI, Anthropic, etc.)
      tagging: per-request model selection via heady-production routing
      measurement: per-request cost from provider billing

  reporting:
    user_level: "Your usage this month" dashboard on HeadyWeb
    workspace_level: team cost breakdown for team admins
    platform_level: treasury dashboard for platform admins
    prediction: heady-vinci forecasts next month spend based on trends
```

### 4. Design Financial Policy Gates

Enforced by heady-sentinel at system boundaries:

```yaml
financial_policies:
  spend_limits:
    - scope: per-user
      limit: plan-defined monthly ceiling
      action: throttle to free-tier rate when exceeded
      notification: heady-observer alerts user at 80%, 90%, 100%

    - scope: per-workspace
      limit: admin-configured team budget
      action: require admin approval for overage
      notification: admin alerted at threshold

    - scope: platform
      limit: monthly infrastructure budget
      action: heady-sentinel blocks new resource provisioning
      escalation: immediate alert to treasury admins

  approval_gates:
    - trigger: single transaction > $1000
      requirement: dual admin approval via heady-sentinel
      timeout: 24h auto-reject if not approved

    - trigger: allocation rule change
      requirement: treasury admin multi-sig
      audit: full diff logged in heady-traces

    - trigger: connection-fund disbursement
      requirement: nonprofit board approval + compliance check
      audit: grant-specific audit trail

  fraud_detection:
    engine: heady-sentinel + heady-vinci anomaly detection
    signals: [usage spikes, unusual API patterns, account creation velocity]
    action: flag for review, temporary freeze if high confidence
```

### 5. Build Financial Simulations

Powered by heady-montecarlo:

```yaml
simulations:
  revenue_forecast:
    engine: heady-montecarlo
    inputs: [current subscriber count, churn rate, growth rate, usage trends]
    outputs: [revenue projection with confidence intervals, breakeven timeline]
    frequency: weekly refresh

  cost_projection:
    engine: heady-montecarlo
    inputs: [compute trends, storage growth, API usage growth, third-party cost trends]
    outputs: [cost projection, budget risk assessment]
    frequency: weekly refresh

  pricing_optimization:
    engine: heady-vinci + heady-montecarlo
    inputs: [elasticity estimates, competitor pricing, feature usage by tier]
    outputs: [optimal tier pricing, feature bundling recommendations]
    frequency: quarterly analysis

  sustainability:
    engine: heady-montecarlo
    inputs: [revenue forecast, cost projection, reserve balance, growth targets]
    outputs: [runway months, sustainability score, recommended actions]
    frequency: monthly report
```

### 6. Design the Treasury Dashboard

HeadyWeb interface for financial governance:

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Revenue Overview** | heady-metrics + heady-traces | MRR, ARR, revenue by channel, trend |
| **Cost Breakdown** | heady-metrics | Spend by category (compute, storage, API, third-party) |
| **Token Economy** | heady-metrics | Credits consumed vs allocated, utilization rate |
| **Budget Health** | heady-observer | Per-pool budget vs actual, alert status |
| **Forecast** | heady-montecarlo | Revenue and cost projections with confidence bands |
| **Audit Trail** | heady-traces | Recent financial transactions and approvals |
| **Connection Fund** | HeadyConnection reporting | Nonprofit fund balance, grant allocations, impact metrics |

## Output Format

When designing Treasury Nexus features, produce:

1. **Treasury model** with accounts, token definitions, and org scope
2. **Revenue pipeline** with collection sources and allocation rules
3. **Cost attribution** with per-user/workspace/agent granularity
4. **Financial policies** with spend limits, approval gates, and fraud detection
5. **Simulation models** with heady-montecarlo configuration
6. **Dashboard** specification with financial data sources

## Tips

- **heady-metrics is the financial telemetry backbone** — every billable action must be tagged and metered here
- **heady-sentinel enforces, heady-observer alerts** — policy violations are blocked; threshold approaches are warned
- **Connection Fund is restricted** — nonprofit funds follow different governance rules; never co-mingle with platform revenue
- **Cost attribution must be per-request** — aggregate reporting is built from granular per-request tagging; you can't add granularity later
- **heady-montecarlo simulates, heady-vinci recommends** — simulations explore scenarios; vinci interprets and suggests actions
- **Promotion pipeline includes financial gates** — code changes that affect billing or pricing must pass financial policy review at Testing → Staging → Main
