---
name: heady-monetization-matrix
description: Design and operate the Heady Monetization Matrix for subscription tier design, usage-based pricing, marketplace revenue sharing, and growth-driven monetization across the Heady platform. Use when designing pricing tiers, building paywall logic, creating freemium-to-paid conversion flows, planning skill marketplace economics, implementing usage metering, or modeling LTV and churn. Integrates with headyapi-core for metering, heady-metrics for revenue analytics, heady-vinci for pricing optimization, and heady-montecarlo for financial modeling.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Monetization Matrix

Use this skill when you need to **design, build, or operate the Monetization Matrix** — Heady's system for pricing, packaging, and revenue generation across subscriptions, usage-based billing, marketplace commissions, and developer API access.

## When to Use This Skill

- Designing subscription tiers and feature gating for the Heady platform
- Building usage-based pricing for compute, storage, and API access
- Creating marketplace revenue sharing for skill creators and developers
- Implementing freemium-to-paid conversion flows and upgrade prompts
- Planning pricing experiments and A/B testing of monetization strategies
- Modeling customer lifetime value (LTV), churn, and revenue forecasts

## Platform Context

The Monetization Matrix operates across Heady's commercial infrastructure:

- **headyapi-core** — API Gateway; metering point for usage-based billing
- **heady-metrics** — tracks all billable events, subscription states, and revenue metrics
- **heady-vinci** — analyzes usage patterns for pricing optimization and churn prediction
- **heady-montecarlo** — runs probabilistic models for revenue forecasting and pricing scenarios
- **heady-observer** — monitors billing health, payment failures, and conversion funnel
- **heady-sentinel** — enforces feature gates, validates entitlements, manages payment secrets
- **heady-traces** — records every billing event for compliance and dispute resolution
- **HeadyWeb** — pricing page, billing dashboard, and upgrade flows
- **heady-buddy-portal** — Buddy-specific subscription management
- **headyconnection-core** — nonprofit pricing (free or subsidized) for HeadyConnection
- **HeadyMemory** (`latent-core-dev`, pgvector) — stores customer profiles and usage history
- **headymcp-core** (31 MCP tools) — features gated by plan tier

## Instructions

### 1. Define the Pricing Model

```yaml
pricing:
  tiers:
    free:
      price: $0/month
      target: individual explorers, students, nonprofits (HeadyConnection)
      includes:
        buddy: basic chat, 1 persona
        memory: 100MB HeadyMemory
        compute: 100 compute credits/month
        api: 1000 calls/day via headyapi-core
        agents: 1 concurrent agent
        tools: core MCP tools (10 of 31)
        voice: text-only (no Voice Vessel)
        avatar: 1 basic avatar template
      limitations: [no custom personas, no marketplace selling, community support only]

    pro:
      price: $19/month
      target: individual power users, freelancers
      includes:
        buddy: unlimited chat, 5 personas, Voice Vessel
        memory: 5GB HeadyMemory
        compute: 2000 compute credits/month
        api: 10000 calls/day
        agents: 5 concurrent agents
        tools: all 31 MCP tools
        voice: full Voice Vessel with 3 voice personas
        avatar: full Avatar Forge with 10 templates
      extras: [custom personas, marketplace buying, email support]

    team:
      price: $49/user/month
      target: small teams, startups
      includes:
        buddy: team Buddy with shared context
        memory: 25GB shared HeadyMemory
        compute: 10000 credits/month/user
        api: 100000 calls/day
        agents: 20 concurrent agents per team
        tools: all 31 MCP tools + team collaboration tools
        voice: team Voice Vessel
        avatar: team Avatar Forge with custom branding
      extras: [team workspace, shared memory, priority support, SSO]

    enterprise:
      price: custom
      target: large organizations
      includes:
        buddy: unlimited everything
        memory: unlimited HeadyMemory
        compute: unlimited
        api: custom rate limits
        agents: unlimited
        tools: all + custom MCP tool development
        voice: custom voice models
        avatar: custom brand avatars
      extras: [dedicated support, SLA, custom deployment, audit tools, SAML SSO]

  nonprofit:
    eligibility: verified 501(c)(3) or equivalent via HeadyConnection
    pricing: free tier expanded to pro-equivalent
    funding: subsidized by connection-fund from Treasury Nexus
    verification: annual re-verification required
```

### 2. Build the Feature Gating System

```yaml
feature_gates:
  enforcement: heady-sentinel checks entitlements per request

  gate_types:
    binary:
      description: feature is on or off based on plan
      example: Voice Vessel (off for free, on for pro+)
      check: heady-sentinel validates plan tier at request time

    metered:
      description: feature available up to plan limit
      example: compute credits (100 free, 2000 pro, 10000 team)
      check: heady-metrics tracks usage, heady-sentinel enforces limit
      overage: prompt upgrade or purchase additional credits

    tiered:
      description: feature quality varies by plan
      example: concurrent agents (1 free, 5 pro, 20 team)
      check: headyapi-core counts active resources against limit

  enforcement_flow:
    1. User action triggers feature check
    2. heady-sentinel queries plan tier + current usage from heady-metrics
    3. If within limits: allow action, increment usage counter
    4. If at limit: return upgrade prompt with contextual value message
    5. If over limit (grace): allow with warning, flag for billing
    6. All decisions logged in heady-traces

  upgrade_prompts:
    strategy: value-first (show what user gains, not what they're missing)
    timing: at natural friction points (hitting limit, discovering gated feature)
    personalization: heady-vinci customizes message based on user's usage pattern
    surface: in-context banner (not modal popup), dismissible
```

### 3. Design Usage-Based Billing

```yaml
usage_billing:
  metering:
    source: heady-metrics aggregates from all services
    granularity: per-request tagging with user_id + workspace_id
    events:
      compute: CPU seconds consumed per MCP tool invocation
      storage: GB-months of HeadyMemory usage (daily snapshot)
      api_calls: request count through headyapi-core
      voice_minutes: minutes of Voice Vessel usage
      image_generations: heady-imagine generation count
      agent_hours: total agent runtime across all habitats

  billing_cycle:
    period: monthly (aligned to subscription date)
    calculation:
      1. heady-metrics aggregates usage for billing period
      2. Compare against plan included amounts
      3. Calculate overage at per-unit overage rates
      4. Generate invoice with line-item breakdown
    payment: charge on file via payment processor

  overage_pricing:
    compute: $0.01 per credit beyond plan
    storage: $0.10 per GB-month beyond plan
    api_calls: $0.001 per call beyond plan
    voice_minutes: $0.02 per minute beyond plan

  cost_controls:
    spending_cap: user-configurable monthly maximum
    alerts: heady-observer notifies at 50%, 80%, 100% of cap
    hard_stop: option to stop all usage at cap (vs continue with overage)
```

### 4. Design Marketplace Revenue Sharing

```yaml
marketplace:
  participants:
    skill_creators: build and sell skills on heady-skill-bazaar
    plugin_developers: build and sell Buddy plugins
    template_authors: create and sell agent templates
    avatar_artists: create and sell avatar templates and accessories

  revenue_model:
    pricing: creator sets price (minimum $0.99, or free)
    commission: platform takes 20%, creator receives 80%
    settlement: monthly payout to creator
    minimum_payout: $10 (rolls over if below)

  creator_tools:
    analytics: heady-metrics provides sales, downloads, revenue dashboard
    pricing_suggestions: heady-vinci recommends pricing based on category benchmarks
    promotion: featured placement on marketplace (earned by quality + engagement)
    reviews: community reviews via HeadyConnection

  quality_gates:
    submission: creator submits skill/plugin/template
    automated_review: heady-sentinel scans for security issues
    quality_check: heady-critique evaluates quality and documentation
    approval: automated if passes all checks; manual review if flagged
    promotion: Testing → Staging → production marketplace
```

### 5. Build Conversion and Retention Analytics

```yaml
analytics:
  conversion_funnel:
    stages: [visit, signup, activation, engagement, conversion, retention]
    tracking: heady-metrics tracks each stage transition
    analysis: heady-vinci identifies friction points and drop-off reasons

  key_metrics:
    mrr: monthly recurring revenue (heady-metrics aggregation)
    arr: annual recurring revenue projection
    ltv: customer lifetime value (heady-montecarlo modeling)
    cac: customer acquisition cost
    churn_rate: monthly/annual by tier (heady-metrics)
    nrr: net revenue retention (expansion - contraction - churn)
    arpu: average revenue per user by tier

  churn_prediction:
    engine: heady-vinci analyzes usage patterns
    signals: [declining usage, support tickets, reduced logins, feature disengagement]
    action: proactive outreach via HeadyBuddy with personalized value messaging
    monitoring: heady-observer tracks predicted-at-risk users

  pricing_experiments:
    engine: heady-montecarlo simulates pricing scenarios
    methods: [A/B test pricing pages, cohort pricing, geographic pricing]
    guardrails: never show existing customer a higher price for current features
    analysis: heady-vinci evaluates experiment results

  forecasting:
    engine: heady-montecarlo
    models: [revenue projection, churn forecast, tier migration prediction]
    confidence: 90% confidence intervals on all forecasts
    frequency: weekly refresh, monthly deep analysis
```

### 6. Design the Monetization Dashboard

HeadyWeb interface for monetization management:

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Revenue Overview** | heady-metrics | MRR, ARR, growth rate, revenue by tier |
| **Conversion Funnel** | heady-metrics | Stage-by-stage conversion rates with trends |
| **Churn Analysis** | heady-vinci | Churn rate by tier, at-risk users, predicted churn |
| **Usage Metering** | heady-metrics | Usage vs limits by tier, overage revenue |
| **Marketplace** | heady-metrics | GMV, creator payouts, top-selling items |
| **Pricing Experiments** | heady-montecarlo | Active experiments, results, recommendations |
| **Forecast** | heady-montecarlo | Revenue projection with confidence intervals |

## Output Format

When designing Monetization Matrix features, produce:

1. **Pricing model** with tier definitions, feature gates, and nonprofit pricing
2. **Feature gating** with enforcement, metering, and upgrade prompt design
3. **Usage billing** with metering, overage pricing, and cost controls
4. **Marketplace economics** with revenue sharing, quality gates, and creator tools
5. **Analytics** with conversion funnel, churn prediction, and forecasting
6. **Dashboard** specification with revenue and growth data sources

## Tips

- **heady-sentinel enforces gates, heady-metrics meters usage** — entitlement checks must be fast (cached) and accurate (metered)
- **Upgrade prompts show value, not walls** — "Unlock Voice Vessel to talk with Buddy" beats "Your plan doesn't include this feature"
- **Nonprofit pricing is a strategic investment** — HeadyConnection subsidy builds community and drives organic growth
- **Usage metering must be per-request** — you can aggregate later, but you can't add granularity after the fact
- **heady-montecarlo models, heady-vinci recommends** — simulations explore scenarios; vinci interprets results and suggests actions
- **Never surprise users with charges** — spending caps, alerts at thresholds, and clear overage visibility prevent billing disputes
