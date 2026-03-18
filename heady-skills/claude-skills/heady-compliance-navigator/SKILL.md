---
name: heady-compliance-navigator
description: Design and operate the Heady Compliance Navigator for regulatory compliance automation, AI inventory management, risk assessment workflows, technical control implementation, and continuous compliance monitoring. Use when building compliance automation pipelines, designing AI system inventories, creating risk assessment frameworks, implementing technical controls for AI regulations, planning compliance roadmaps (EU AI Act, ISO 42001, NIST AI RMF, SOC 2), or designing continuous compliance monitoring. Integrates with heady-sentinel for control enforcement, heady-traces for compliance evidence, heady-observer for continuous monitoring, heady-governance-atlas for policy management, heady-audit-forge for audit readiness, heady-vinci for compliance intelligence, and heady-docs for compliance documentation.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Compliance Navigator

Use this skill when you need to **design, build, or operate the Compliance Navigator** — Heady's automated compliance system that guides the platform through regulatory requirements via structured inventories, risk assessments, technical controls, and continuous monitoring.

## When to Use This Skill

- Building compliance automation pipelines for AI regulations
- Designing AI system inventory and classification workflows
- Creating risk assessment frameworks with quantified risk scoring
- Implementing technical controls that satisfy regulatory requirements
- Planning compliance roadmaps with phased rollout
- Designing continuous compliance monitoring and gap detection

## Platform Context

The Compliance Navigator works alongside Governance Atlas and Audit Forge:

- **heady-sentinel** — Control enforcement; implements technical controls at runtime (access restrictions, content filters, rate limits, approval gates)
- **heady-traces** — Compliance evidence; immutable record of control operations, policy decisions, and compliance events
- **heady-observer** — Continuous compliance monitoring; detects control failures, coverage gaps, and drift from compliant state
- **heady-governance-atlas** — Policy management; provides the governance framework that Compliance Navigator implements
- **heady-audit-forge** — Audit readiness; Compliance Navigator feeds evidence to the audit system
- **heady-vinci** — Compliance intelligence; analyzes regulatory text, maps requirements to controls, predicts compliance gaps
- **heady-docs** — Compliance documentation; stores control descriptions, risk assessments, and compliance procedures
- **HeadyMemory** (`latent-core-dev`, pgvector) — Stores compliance state, assessment history, and regulatory mappings
- **heady-metrics** — Compliance KPIs; control effectiveness, coverage rates, assessment completion, gap closure velocity
- **headymcp-core** (31 MCP tools) — MCP tools are controlled resources requiring compliance classification
- **headybot-core** — Agents are AI systems requiring compliance classification
- **HeadyWeb** — Compliance dashboard for status tracking and reporting
- **heady-montecarlo** — Simulates compliance risk under different control configurations

## Instructions

### 1. Define the Compliance Model

```yaml
compliance_navigator:
  compliance_roadmap:
    phase_1_inventory:
      objective: discover and classify all AI systems
      duration: 4-6 weeks
      output: complete AI system inventory with risk classification

    phase_2_risk_assessment:
      objective: assess risk for each AI system against applicable regulations
      duration: 4-6 weeks
      output: risk assessment reports with quantified scores per system

    phase_3_controls:
      objective: implement technical and organizational controls for identified risks
      duration: 8-12 weeks
      output: controls mapped to risks, implemented, and verified

    phase_4_monitoring:
      objective: continuous compliance monitoring and gap detection
      duration: ongoing
      output: real-time compliance dashboard, automated gap alerts

  regulatory_scope:
    eu_ai_act:
      applicability: all AI systems deployed in or affecting EU residents
      deadline: August 2026 enforcement
      penalties: up to EUR 35M or 7% global annual revenue
      key_articles: [Art.6 risk classification, Art.9 risk management, Art.11 technical documentation, Art.13 transparency, Art.14 human oversight, Art.15 accuracy]

    iso_42001:
      applicability: voluntary AI management system certification
      benefit: demonstrates mature AI governance to customers and regulators
      key_clauses: [4 context, 5 leadership, 6 planning, 7 support, 8 operations, 9 evaluation, 10 improvement]

    nist_ai_rmf:
      applicability: recommended for US operations
      functions: [Govern, Map, Measure, Manage]
      benefit: structured risk management aligned with federal guidelines

    soc_2:
      applicability: customer trust and enterprise sales
      criteria: [security, availability, processing_integrity, confidentiality, privacy]
      benefit: audited controls demonstrate operational trustworthiness
```

### 2. Build the AI System Inventory

```yaml
inventory:
  discovery:
    automated:
      - headymcp_core_scan: enumerate all 31 MCP tools with AI capabilities
      - headybot_core_scan: enumerate all registered agent types and their capabilities
      - model_registry_scan: identify all AI/ML models in use across services
      - api_scan: identify AI-powered endpoints in headyapi-core
    manual:
      - team_survey: engineering teams declare AI components in their services
      - design_review: new features flagged during design review if AI-powered

  classification_per_system:
    fields:
      system_name: unique identifier
      description: what the system does
      ai_components: which models, algorithms, or AI techniques are used
      data_inputs: what data the system processes (with sensitivity classification)
      decision_types: what decisions the system makes or influences
      affected_parties: who is affected by the system's outputs
      human_oversight: how humans supervise or override the system
      risk_level: unacceptable / high / limited / minimal (per EU AI Act Art.6)
      applicable_regulations: which regulations apply to this system
      owner: responsible team and individual
      documentation_status: completeness of technical documentation

  storage: HeadyMemory compliance-inventory namespace
  maintenance: heady-observer triggers re-classification when system changes detected
  completeness: heady-metrics tracks inventory coverage vs. discovered AI components
```

### 3. Design Risk Assessment Framework

```yaml
risk_assessment:
  methodology:
    per_system:
      1. Identify hazards: what could go wrong with this AI system
      2. Assess likelihood: probability of each hazard (1-5 scale)
      3. Assess impact: severity if hazard materializes (1-5 scale)
      4. Calculate risk score: likelihood × impact (1-25)
      5. Map to risk level: low (1-5), medium (6-10), high (11-15), critical (16-25)
      6. Identify existing controls: what mitigations are already in place
      7. Calculate residual risk: risk after controls applied
      8. Recommend additional controls for unacceptable residual risk

  hazard_categories:
    safety: physical or psychological harm to users
    discrimination: biased outcomes across protected groups
    privacy: unauthorized data processing or exposure
    transparency: users unaware they're interacting with AI
    accountability: inability to explain or audit AI decisions
    security: adversarial manipulation of AI systems
    reliability: inconsistent or incorrect AI outputs
    autonomy: AI acting beyond authorized scope

  automation:
    engine: heady-vinci
    method:
      1. heady-vinci analyzes system description and data flows
      2. Auto-generates hazard list from system characteristics
      3. Estimates likelihood and impact from historical patterns
      4. Maps existing heady-sentinel controls to identified hazards
      5. Highlights gaps requiring new controls
      6. Human review required for all assessments (heady-vinci advisory only)

  simulation:
    engine: heady-montecarlo
    scenarios: model risk exposure under different control configurations
    optimization: find minimum control set that reduces all risks below threshold
    cost_benefit: estimate implementation cost vs. risk reduction value

  cadence:
    initial: full assessment during Phase 2
    triggered: re-assessment when system changes, new regulations, or incidents
    periodic: annual comprehensive re-assessment for all high-risk systems
    storage: assessment versions in HeadyMemory with full history in heady-traces
```

### 4. Implement Technical Controls

```yaml
controls:
  control_catalog:
    transparency:
      ai_disclosure: notify users when interacting with AI (EU AI Act Art.13)
      implementation: heady-sentinel injects disclosure in all AI-powered surfaces
      evidence: heady-traces logs disclosure delivery per user interaction

    human_oversight:
      approval_gates: high-risk AI decisions require human approval before execution
      implementation: heady-sentinel gates based on decision risk classification
      override: humans can override any AI decision with logged justification
      evidence: heady-traces logs all approval decisions and overrides

    bias_monitoring:
      fairness_metrics: monitor AI outputs for discriminatory patterns
      implementation: heady-observer tracks output distribution across protected groups
      alerting: statistical deviation from fairness baseline triggers review
      evidence: heady-metrics stores fairness metrics over time

    data_governance:
      consent_management: track and enforce data subject consent per processing purpose
      implementation: heady-sentinel enforces consent gates before data processing
      data_minimization: limit data collection to declared purposes
      retention: automatic data deletion per declared retention periods
      evidence: heady-traces logs all consent decisions and data lifecycle events

    accuracy_monitoring:
      performance_tracking: monitor AI system accuracy and reliability over time
      implementation: heady-observer tracks accuracy metrics per AI system
      drift_detection: alert when accuracy degrades below threshold
      evidence: heady-metrics stores accuracy trends for compliance reporting

    security_controls:
      adversarial_protection: detect and mitigate adversarial inputs to AI systems
      implementation: heady-sentinel input validation and anomaly detection
      access_control: role-based access to AI system configuration and training data
      evidence: heady-traces logs all security events

  control_mapping:
    method: each control mapped to regulations it satisfies
    format:
      control_id: unique identifier
      description: what the control does
      regulations: [EU AI Act Art.X, ISO 42001 Clause Y, NIST AI RMF Z]
      implementation: how it's implemented in Heady infrastructure
      effectiveness_metric: how we measure the control works
      evidence_source: where compliance evidence is generated
    storage: heady-docs control catalog + HeadyMemory for queryable mapping

  deployment:
    rollout: gradual per Governance Atlas enforcement modes (audit → warn → enforce)
    testing: controls verified in Testing environment before Staging promotion
    validation: heady-observer confirms control effectiveness after deployment
```

### 5. Design Continuous Monitoring

```yaml
continuous_monitoring:
  engine: heady-observer

  monitors:
    control_effectiveness:
      what: are implemented controls actually working
      method: heady-observer tests controls periodically (synthetic probes)
      alerting: control failure triggers immediate escalation
      metric: control pass rate per regulation

    coverage_completeness:
      what: are all AI systems covered by required controls
      method: compare inventory against control mapping
      alerting: new AI system without controls triggers classification workflow
      metric: percentage of systems with complete control coverage

    regulatory_changes:
      what: have regulations changed since last assessment
      method: heady-observer monitors regulatory feeds and legal updates
      alerting: new or amended regulation triggers impact assessment
      metric: days since last regulatory update review

    incident_response:
      what: have compliance incidents occurred
      method: heady-sentinel violation events analyzed in real time
      alerting: compliance incident triggers investigation workflow
      metric: mean time to detect, mean time to resolve compliance incidents

    drift_detection:
      what: are systems drifting from compliant configuration
      method: compare current state against baseline compliant configuration
      alerting: configuration drift beyond threshold triggers remediation
      metric: drift score per system

  reporting:
    real_time: HeadyWeb compliance dashboard with live status
    periodic: monthly compliance summary auto-generated by heady-vinci
    on_demand: compliance status report for any regulation or system
    evidence_feed: continuous evidence generation for heady-audit-forge
```

### 6. Build the Compliance Dashboard

HeadyWeb interface for compliance management:

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Compliance Score** | heady-metrics | Overall compliance rate by regulation, trend over time |
| **AI System Inventory** | HeadyMemory | All AI systems with risk level and control status |
| **Risk Heatmap** | heady-vinci | Risk matrix with residual risk after controls |
| **Control Status** | heady-sentinel | Active controls, effectiveness rates, recent failures |
| **Gap Tracker** | heady-observer | Open compliance gaps with severity and remediation timeline |
| **Regulatory Calendar** | heady-observer | Upcoming deadlines, regulatory changes, assessment due dates |
| **Roadmap Progress** | heady-metrics | Phase completion across the 4-phase compliance roadmap |

**Executive view:**

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Regulatory Exposure** | heady-montecarlo | Estimated penalty risk under current compliance state |
| **Investment vs Risk** | heady-montecarlo | Cost of compliance controls vs. risk reduction |
| **Audit Readiness** | heady-audit-forge | Ready-to-audit score per regulation |

## Output Format

When designing Compliance Navigator features, produce:

1. **Compliance model** with roadmap phases, regulatory scope, and timeline
2. **AI system inventory** with discovery methods, classification fields, and maintenance
3. **Risk assessment** with methodology, hazard categories, automation, and simulation
4. **Technical controls** with catalog, regulation mapping, and deployment strategy
5. **Continuous monitoring** with monitors, alerting, and reporting
6. **Dashboard** specification with compliance status and executive views

## Tips

- **Inventory first, always** — you cannot be compliant with systems you don't know about; automated discovery from headymcp-core and headybot-core ensures completeness
- **EU AI Act penalties are existential** — up to EUR 35M or 7% revenue; treat compliance as a business-critical requirement, not a checkbox
- **Controls must produce evidence** — a control that works but generates no evidence is useless for audit; every control must feed heady-traces
- **Compliance Navigator implements, Governance Atlas governs, Audit Forge proves** — these three systems form a complete governance stack; Navigator does the operational work
- **heady-vinci advises, humans decide** — risk assessments and control recommendations are AI-generated but human-reviewed; regulatory responsibility stays with people
- **Continuous monitoring prevents surprises** — compliance drift detected in real time is a minor fix; drift discovered during audit is a major incident
- **Phase the roadmap** — inventory → risk assessment → controls → monitoring; each phase builds on the previous; don't skip ahead
