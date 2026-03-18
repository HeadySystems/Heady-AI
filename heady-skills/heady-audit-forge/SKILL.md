---
name: heady-audit-forge
description: Design and operate the Heady Audit Forge for comprehensive auditability, evidence generation, compliance reporting, and regulatory audit preparation. Use when building audit trail architectures, designing evidence collection and preservation systems, creating compliance report generators, implementing audit-ready logging for AI systems, planning regulatory audit workflows, or designing tamper-proof event records. Integrates with heady-traces for immutable event logging, heady-logs for centralized log aggregation, heady-metrics for audit KPIs, heady-sentinel for access audit, heady-observer for continuous audit monitoring, and heady-docs for audit documentation.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Audit Forge

Use this skill when you need to **design, build, or operate the Audit Forge** — Heady's comprehensive auditability system that generates, preserves, and presents evidence for regulatory compliance, internal governance, and external audit readiness.

## When to Use This Skill

- Building audit trail architectures for AI systems and agent operations
- Designing evidence collection, preservation, and chain-of-custody systems
- Creating compliance report generators for EU AI Act, ISO 42001, SOC 2
- Implementing audit-ready logging that meets regulatory evidence standards
- Planning regulatory audit workflows and preparation checklists
- Designing tamper-proof, cryptographically verifiable event records

## Platform Context

The Audit Forge operates as Heady's evidence and auditability layer:

- **heady-traces** — Immutable event log; the primary source of truth for all auditable events; append-only, cryptographically linked entries
- **heady-logs** — Centralized log aggregation; operational logs from all services, queryable and filterable
- **heady-metrics** — Audit KPIs; completeness of logging, evidence coverage, audit preparation scores
- **heady-sentinel** — Access audit; every authorization decision logged with context, policy reference, and outcome
- **heady-observer** — Continuous audit monitoring; detects logging gaps, evidence integrity issues, and compliance drift
- **heady-docs** — Audit documentation; policies, procedures, control descriptions, and audit playbooks
- **heady-vinci** — Audit intelligence; analyzes event patterns for anomalies, generates audit findings, recommends remediation
- **HeadyMemory** (`latent-core-dev`, pgvector) — Stores audit context, historical compliance state, and auditor notes
- **headymcp-core** (31 MCP tools) — Every MCP tool invocation is an auditable event
- **headybot-core** — Agent operations produce auditable event chains
- **HeadyWeb** — Audit dashboard surface for evidence review and report generation
- **Promotion Pipeline** (Testing → Staging → Main) — Pipeline events are auditable

## Instructions

### 1. Define the Audit Model

```yaml
audit_forge:
  event_model:
    structure:
      event_id: globally unique, cryptographically generated
      timestamp: UTC nanosecond precision, NTP-synchronized
      actor: who performed the action (user, agent, service, system)
      action: what was done (CRUD operation, policy decision, tool invocation)
      resource: what was acted upon (data, configuration, policy, agent)
      outcome: result (success, failure, partial, denied)
      context: surrounding state (session, request chain, policy version)
      evidence_hash: SHA-256 hash of event payload for tamper detection
      chain_link: hash of previous event (append-only linked chain)

    classification:
      critical: security events, access decisions, financial operations, policy overrides
      standard: normal operations, CRUD, tool invocations, agent actions
      diagnostic: debugging information, performance metrics, internal state
      retention: critical=7yr, standard=3yr, diagnostic=90d (configurable per regulation)

  evidence_types:
    decision_evidence: why a decision was made (policy applied, data considered, model used)
    access_evidence: who accessed what, when, from where, under which policy
    change_evidence: what changed, by whom, from what state to what state
    agent_evidence: agent actions, tool invocations, reasoning traces, outcomes
    model_evidence: which model produced which output, with which inputs and parameters
    data_evidence: data lineage, transformations applied, consent status

  integrity:
    append_only: events cannot be modified or deleted (immutable log)
    hash_chain: each event includes hash of previous event (tamper detection)
    replication: events replicated to multiple storage backends
    verification: periodic integrity verification by heady-observer
    attestation: cryptographic proof that log was not tampered with since timestamp T
```

### 2. Build the Evidence Collection Pipeline

```yaml
evidence_pipeline:
  collection_points:
    heady_sentinel:
      events: [auth_decision, policy_evaluation, access_grant, access_deny, policy_override]
      enrichment: policy version, actor trust score, risk classification

    headymcp_core:
      events: [tool_invocation, tool_result, tool_error, tool_timeout]
      enrichment: invoking agent, parent task, permission context

    headybot_core:
      events: [agent_spawn, task_assignment, task_completion, agent_termination, escalation]
      enrichment: agent trust level, habitat permissions, parent delegation chain

    heady_memory:
      events: [data_store, data_query, data_delete, data_export]
      enrichment: data classification, consent reference, access policy

    promotion_pipeline:
      events: [promotion_request, gate_check, gate_pass, gate_fail, deployment]
      enrichment: change description, approver, test results, governance check outcomes

    all_services:
      events: [configuration_change, error, health_status_change, dependency_failure]
      enrichment: service identity, environment, affected resources

  processing:
    1. Event emitted by source service
    2. heady-traces receives event, validates schema, assigns ID
    3. Evidence hash computed and chain link established
    4. Event classified by severity and retention tier
    5. Event enriched with contextual data (actor profile, policy state)
    6. Event stored in immutable append-only log
    7. Event indexed for search in heady-logs
    8. Audit metrics updated in heady-metrics
    9. heady-observer checks for anomalies or required alerts

  completeness:
    monitoring: heady-observer tracks evidence coverage per service, per event type
    gaps: missing evidence triggers alert (e.g., MCP tool invoked but no event logged)
    sla: 99.99% event capture rate (critical events), 99.9% (standard events)
    alerting: evidence gap alert within 5 minutes of detection
```

### 3. Design Audit Report Generation

```yaml
reporting:
  report_types:
    compliance_report:
      purpose: demonstrate compliance with specific regulation
      templates:
        eu_ai_act:
          sections: [system_registry, risk_classification, transparency_measures, human_oversight, data_governance, technical_documentation]
          evidence: auto-populated from heady-traces + heady-docs
          generation: heady-vinci assembles report from evidence, flags gaps
        iso_42001:
          sections: [aims_policy, risk_assessment, controls, performance_evaluation, improvement]
          evidence: auto-populated from governance atlas + audit trail
        soc_2:
          sections: [security, availability, processing_integrity, confidentiality, privacy]
          evidence: auto-populated from heady-sentinel + heady-observer + heady-traces

    incident_report:
      purpose: document security incidents, policy violations, or system failures
      content: timeline reconstruction from heady-traces, root cause analysis from heady-vinci, remediation actions
      generation: automated timeline + manual analysis sections

    periodic_audit:
      purpose: regular internal audit report
      cadence: monthly (operational), quarterly (comprehensive), annually (strategic)
      content: governance health, compliance scores, risk changes, notable events
      generation: fully automated by heady-vinci from heady-metrics + heady-traces

  generation_engine:
    method: heady-vinci assembles reports from structured evidence
    enrichment: heady-stories generates narrative explanations of technical evidence
    review: human review required before external submission
    versioning: all reports versioned and stored in heady-docs
    access: heady-sentinel enforces report access policies
```

### 4. Implement Audit Preparation Workflows

```yaml
audit_preparation:
  readiness_assessment:
    engine: heady-vinci
    checks:
      evidence_completeness: all required evidence types collected for audit scope
      documentation_currency: policies, procedures, and technical docs up to date
      control_effectiveness: governance controls tested and effective
      gap_identification: missing evidence, stale documentation, untested controls
    score: 0-100 audit readiness score with dimension breakdown

  pre_audit_workflow:
    1. Define audit scope (regulation, time period, systems in scope)
    2. heady-vinci runs readiness assessment
    3. Gap remediation: address identified gaps before audit
    4. Evidence package: auto-generated evidence bundle for auditor
    5. Access provisioning: heady-sentinel creates time-limited auditor access
    6. Walkthrough preparation: heady-stories generates system descriptions for auditors

  auditor_workspace:
    surface: HeadyWeb dedicated auditor portal
    features:
      - evidence_search: full-text and structured search across heady-traces
      - timeline_reconstruction: visual event timeline for any entity or system
      - policy_review: browse active policies with enforcement history
      - sampling: random sample generation for statistical audit testing
      - export: evidence export in standard formats (JSON, CSV, PDF)
    access: time-limited, scope-limited, fully logged in heady-traces

  post_audit:
    findings_tracking: auditor findings logged in HeadyMemory
    remediation_plans: each finding gets a remediation plan with deadline
    follow_up: heady-observer monitors remediation progress
    closure: findings closed when evidence of remediation verified
```

### 5. Build the Audit Dashboard

HeadyWeb interface for audit management:

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Audit Readiness** | heady-vinci | Readiness score by regulation, gap count, remediation progress |
| **Evidence Stream** | heady-traces | Real-time feed of auditable events, filterable by type/actor/system |
| **Coverage Map** | heady-observer | Evidence collection coverage per service and event type |
| **Integrity Status** | heady-observer | Hash chain verification status, last verified timestamp |
| **Report Library** | heady-docs | Generated reports, draft status, review assignments |
| **Finding Tracker** | HeadyMemory | Open audit findings, remediation status, deadlines |
| **Retention Monitor** | heady-metrics | Data retention compliance, upcoming purge schedules |

**Auditor view:**

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Evidence Search** | heady-traces + heady-logs | Full-text search with filters across all auditable events |
| **Timeline View** | heady-traces | Reconstructed event timeline for selected entities |
| **Sample Generator** | heady-traces | Random evidence sampling for statistical testing |
| **Export Center** | heady-traces | Export evidence bundles in standard audit formats |

## Output Format

When designing Audit Forge features, produce:

1. **Audit model** with event structure, classification, evidence types, and integrity mechanisms
2. **Evidence pipeline** with collection points, processing flow, and completeness monitoring
3. **Report generation** with templates, generation engine, and review workflow
4. **Audit preparation** with readiness assessment, pre-audit workflow, and auditor workspace
5. **Dashboard** specification with audit management and auditor views

## Tips

- **heady-traces is sacred** — the immutable event log is the foundation of all auditability; never compromise its append-only, hash-chained integrity
- **Evidence completeness is measurable** — heady-observer continuously monitors whether all required events are being captured; gaps are audit failures waiting to happen
- **Regulators want evidence, not promises** — the Audit Forge's job is to produce concrete, verifiable evidence that controls exist and work; design for evidence-first
- **EU AI Act requires technical documentation** — Article 11 mandates comprehensive documentation for high-risk AI systems; auto-generate from heady-docs + heady-traces
- **Auditor workspace is temporary** — time-limited, scope-limited access for external auditors; their every action is itself audited in heady-traces
- **Report generation saves months** — auto-generated compliance reports from structured evidence transform audit preparation from a months-long scramble to a button press
- **Chain of custody matters** — evidence must be provably untampered; the hash chain in heady-traces provides cryptographic proof of integrity
