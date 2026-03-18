---
name: heady-governance-atlas
description: Design and operate the Heady Governance Atlas for AI governance frameworks, policy management, regulatory mapping, and organizational control planes. Use when building AI governance dashboards, designing policy lifecycle management, creating regulatory compliance mapping (EU AI Act, ISO 42001, NIST AI RMF), implementing risk classification for AI systems, planning governance control planes for agentic workflows, or designing governance-first development practices. Integrates with heady-sentinel for policy enforcement, heady-traces for governance audit trails, heady-observer for governance monitoring, heady-atlas for governance visualization, heady-metrics for governance KPIs, and headymcp-core for MCP governance.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Governance Atlas

Use this skill when you need to **design, build, or operate the Governance Atlas** — Heady's comprehensive AI governance framework that maps regulations, manages policies, classifies risks, and provides organizational control planes for responsible AI operations.

## When to Use This Skill

- Building AI governance dashboards and control planes
- Designing policy lifecycle management (create, approve, enforce, review, sunset)
- Creating regulatory compliance mapping (EU AI Act, ISO 42001, NIST AI RMF)
- Implementing risk classification for AI systems and agent operations
- Planning governance control planes for agentic workflows and MCP tool chains
- Designing governance-first development practices and review gates

## Platform Context

The Governance Atlas operates as the governance control plane across Heady:

- **heady-sentinel** — Policy enforcement engine; executes governance rules at runtime, gates actions based on policy, manages compliance boundaries
- **heady-traces** — Immutable governance audit trail; every policy decision, override, and violation logged with full context
- **heady-observer** — Governance health monitoring; detects policy drift, compliance gaps, and governance anomalies in real time
- **heady-atlas** — Governance visualization; maps policies to systems, regulations to controls, risks to mitigations
- **heady-metrics** — Governance KPIs; policy compliance rates, violation trends, audit completion, risk distribution
- **heady-vinci** — Governance intelligence; analyzes policy effectiveness, predicts compliance risks, recommends policy adjustments
- **headymcp-core** (31 MCP tools) — MCP governance; every tool invocation passes through governance checks
- **headybot-core** — Agent governance; autonomous agents operate within governance boundaries
- **heady-docs** — Governance documentation; policy library, regulatory mapping, compliance guides
- **HeadyMemory** (`latent-core-dev`, pgvector) — Stores governance state, policy versions, and compliance history
- **HeadyWeb** — Governance dashboard surface for policy management and compliance reporting
- **Promotion Pipeline** (Testing → Staging → Main) — Governance gates at every promotion stage

## Instructions

### 1. Define the Governance Framework

```yaml
governance_atlas:
  regulatory_landscape:
    eu_ai_act:
      status: enforcement begins August 2026
      penalties: up to EUR 35M or 7% global annual revenue
      key_requirements:
        - risk_classification: unacceptable / high / limited / minimal risk categories
        - transparency: users must know they're interacting with AI
        - documentation: technical documentation for high-risk systems
        - human_oversight: meaningful human control over high-risk AI decisions
        - data_governance: training data quality and bias management
      heady_mapping: each Heady AI system classified and documented

    iso_42001:
      scope: AI Management System standard
      requirements: [leadership commitment, risk assessment, AI policy, operational planning, performance evaluation]
      heady_mapping: AIMS integrated into headysystems-core operations

    nist_ai_rmf:
      scope: AI Risk Management Framework
      functions: [Govern, Map, Measure, Manage]
      heady_mapping: risk management integrated into development lifecycle

  risk_classification:
    unacceptable: systems that manipulate, exploit, or perform mass surveillance → prohibited
    high_risk:
      criteria: [safety-critical decisions, access to essential services, biometric processing]
      requirements: [conformity assessment, quality management, logging, human oversight, accuracy metrics]
      heady_examples: [agent autonomous financial decisions, identity verification, health recommendations]
    limited_risk:
      criteria: [chatbots, content generation, emotion recognition]
      requirements: [transparency obligations, user notification]
      heady_examples: [headybuddy-core interactions, heady-stories content, Voice Vessel]
    minimal_risk:
      criteria: [spam filters, search ranking, code suggestions]
      requirements: [voluntary codes of practice]
      heady_examples: [heady-vinci analysis, heady-patterns detection]

  governance_model:
    layers:
      regulatory: external regulations and standards (EU AI Act, ISO 42001, NIST AI RMF)
      organizational: Heady platform-wide policies (acceptable use, data governance, safety)
      operational: per-service and per-agent governance rules
      runtime: real-time enforcement by heady-sentinel at point of execution
```

### 2. Build the Policy Lifecycle

```yaml
policy_lifecycle:
  stages:
    draft:
      author: governance team or automated from regulatory change detection
      format: structured YAML policy document in heady-docs
      review: mandatory peer review before activation

    approval:
      approvers: defined per policy scope (platform-wide → executive, service-level → engineering lead)
      quorum: configurable approval requirements
      audit: approval decision logged in heady-traces with rationale

    enforcement:
      engine: heady-sentinel
      modes:
        enforce: policy violations blocked at runtime
        warn: violations allowed but logged and alerted
        audit: violations logged silently for analysis
        disabled: policy suspended (emergency override, logged)
      rollout: gradual enforcement (audit → warn → enforce) over configurable period

    monitoring:
      engine: heady-observer
      checks:
        - compliance_rate: percentage of actions compliant with policy
        - violation_trend: increasing/decreasing violation rates
        - effectiveness: does policy achieve its intended outcome
        - drift: are systems diverging from policy intent

    review:
      cadence: quarterly for all active policies, triggered by regulatory changes
      analysis: heady-vinci evaluates policy effectiveness against governance KPIs
      update: versioned policy updates through same draft → approval pipeline
      sunset: obsolete policies retired with migration guidance

  policy_types:
    access_control: who can do what under which conditions
    data_governance: how data is collected, processed, stored, shared
    agent_autonomy: what agents can do independently vs. requiring human approval
    content_safety: what content can be generated or displayed
    financial_limits: spending thresholds and approval requirements
    privacy: data subject rights, consent management, retention limits
    model_governance: model selection, evaluation, bias monitoring
```

### 3. Design the Governance Control Plane

```yaml
control_plane:
  description: centralized governance management surface for operators

  ai_system_registry:
    purpose: inventory of all AI systems with risk classification
    fields: [system_name, risk_level, purpose, data_inputs, decision_types, human_oversight_mechanism]
    source: auto-discovered from headymcp-core tool registry + headybot-core agent registry
    maintenance: continuous sync with deployment pipeline
    requirement: EU AI Act Article 6 — high-risk AI system registration

  policy_dashboard:
    view: all active policies with enforcement mode and compliance rate
    actions: [create_policy, edit_policy, change_enforcement_mode, schedule_review]
    alerting: heady-observer surfaces policies approaching violation thresholds

  risk_matrix:
    axes: [likelihood, impact]
    population: auto-populated from heady-vinci risk assessments
    drill_down: click risk to see affected systems, current mitigations, gap analysis
    simulation: heady-montecarlo models risk scenarios under policy changes

  audit_center:
    source: heady-traces governance event stream
    views:
      - policy_decisions: every allow/deny decision with context
      - overrides: manual overrides with justification and approver
      - violations: policy violations with severity, response, and resolution
      - compliance_reports: generated reports for external auditors

  agent_governance:
    mcp_tool_policies: per-tool governance rules (which agents can invoke which tools under what conditions)
    autonomy_levels:
      supervised: every action requires human approval
      guided: routine actions auto-approved, novel actions flagged
      autonomous: agent operates independently within policy boundaries
      emergency: agent autonomy suspended, all actions require approval
    escalation: agent self-reports when it encounters governance uncertainty
```

### 4. Implement Governance Gates in Development

```yaml
governance_gates:
  development:
    pre_commit: code changes affecting AI behavior flagged for governance review
    pr_review: governance checklist auto-generated for AI-related PRs
    design_review: new AI features require governance impact assessment before development

  promotion_pipeline:
    testing:
      gate: automated governance compliance check
      checks: [risk_classification_current, policy_coverage, bias_metrics, safety_tests]
      enforcement: block promotion if critical governance checks fail

    staging:
      gate: governance team review for high-risk changes
      checks: [human_oversight_mechanism_tested, documentation_complete, audit_trail_verified]
      enforcement: manual approval required for high-risk AI changes

    production:
      gate: final governance sign-off
      checks: [regulatory_compliance_confirmed, incident_response_plan_updated]
      enforcement: platform-wide policies enforced by heady-sentinel at runtime

  continuous_monitoring:
    post_deployment: heady-observer monitors governance health of deployed systems
    regression: governance metrics compared against pre-deployment baselines
    alerting: degradation in governance KPIs triggers automatic review
```

### 5. Build the Governance Dashboard

HeadyWeb interface for governance management:

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Compliance Scorecard** | heady-metrics | Overall compliance rate, per-regulation breakdown, trend |
| **AI System Registry** | HeadyMemory | All AI systems with risk classification and documentation status |
| **Policy Library** | heady-docs | Active policies, enforcement modes, review schedule |
| **Risk Matrix** | heady-vinci | Risk heatmap with likelihood × impact, mitigation coverage |
| **Violation Feed** | heady-sentinel | Recent policy violations with severity, response, resolution |
| **Audit Trail** | heady-traces | Searchable governance event history for auditors |
| **Regulatory Calendar** | heady-observer | Upcoming regulatory deadlines and required actions |
| **Agent Autonomy Map** | headybot-core | Agent autonomy levels, governance boundaries, escalation counts |

**Executive view:**

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Governance Health** | heady-metrics | Platform-wide governance score, trend, comparison to targets |
| **Regulatory Exposure** | heady-vinci | Estimated regulatory risk and penalty exposure |
| **Audit Readiness** | heady-traces | Completeness of documentation and evidence for next audit |

## Output Format

When designing Governance Atlas features, produce:

1. **Governance framework** with regulatory mapping, risk classification, and governance layers
2. **Policy lifecycle** with stages, enforcement modes, and policy types
3. **Control plane** with AI system registry, policy dashboard, and agent governance
4. **Development gates** with governance checks at every pipeline stage
5. **Dashboard** specification with compliance, risk, and audit views

## Tips

- **EU AI Act is real and imminent** — enforcement begins August 2026 with penalties up to EUR 35M or 7% of global revenue; design governance for compliance from day one
- **heady-sentinel enforces, Governance Atlas manages** — the atlas is the brain (policy management, risk mapping); sentinel is the muscle (runtime enforcement)
- **AI system registry is foundational** — you cannot govern what you haven't inventoried; auto-discovery from headymcp-core and headybot-core ensures completeness
- **Governance gates in the promotion pipeline** — governance is not afterthought; it's built into Testing → Staging → Main flow as first-class gates
- **Agent governance is the frontier** — as agents gain autonomy, governance must scale; autonomy levels (supervised → autonomous) provide graduated control
- **Audit trail is your evidence** — heady-traces provides the immutable record regulators and auditors need; every governance decision must be traceable
- **MCP governance matters** — every tool invocation through headymcp-core is a governance decision; which agents can invoke which tools under which conditions must be policy-controlled
