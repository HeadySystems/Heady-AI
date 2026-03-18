---
name: heady-impact-ledger-design
description: Design the Heady Impact Ledger for tracking nonprofit program outcomes and social impact with full auditability. Use when building outcome measurement frameworks, beneficiary tracking, impact dashboards, or funder-ready reports. Integrates with HeadyConnection for collaborative reporting, heady-metrics for quantitative tracking, and HeadyMemory for longitudinal outcome recall.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Impact Ledger Design

Use this skill when you need to **design, build, or operate the Impact Ledger** — Heady's system for tracking, measuring, and reporting the social outcomes and program impact of nonprofit organizations, with full auditability and narrative-readiness.

## When to Use This Skill

- Designing outcome measurement frameworks tied to program logic models
- Building beneficiary tracking with privacy-first data governance
- Creating impact dashboards for staff, board, and funders
- Generating funder-specific impact reports from a single data source
- Planning theory-of-change data models
- Designing longitudinal outcome tracking using HeadyMemory

## Platform Context

The Impact Ledger integrates across the Heady ecosystem:

- **heady-metrics** — quantitative outcome tracking and aggregation pipeline
- **HeadyMemory** (`latent-core-dev`, pgvector + Antigravity) — longitudinal storage of beneficiary journeys and outcome trends via 3D vector recall
- **HeadyConnection** (`headyconnection-core`) — collaborative workspace for team-based reporting
- **heady-traces** — audit trail for every data entry and report generation
- **heady-vinci** — pattern recognition for outcome prediction and trend analysis
- **heady-observer** — monitoring layer that alerts when indicators fall below targets
- **HeadyWeb** — browser-native impact dashboard

## Instructions

### 1. Define the Impact Ledger Schema

```yaml
impact_ledger:
  organization_id: uuid

  programs:
    - id: uuid
      name: program-name
      theory_of_change:
        inputs: [resources invested — stored in heady-metrics]
        activities: [what the program does — logged via MCP tools]
        outputs: [direct products — counted by heady-metrics]
        outcomes_short: [changes in 0-12 months — measured via assessments]
        outcomes_medium: [changes in 1-3 years — tracked in HeadyMemory]
        outcomes_long: [changes in 3+ years — longitudinal HeadyMemory queries]
        impact: [ultimate community-level change]

  beneficiaries:
    - id: uuid  # anonymized, never PII in vector store
      demographics:
        age_range: bracket
        geography: zip or region
        identifiers: [anonymized demographic tags]
      enrollment:
        program_id: uuid
        enrolled_at: ISO-8601
        status: active | completed | withdrawn
      services_received:
        - service_type: category
          date: ISO-8601
          units: quantity
          provider: staff-id
          logged_via: heady-traces
      outcomes:
        - indicator_id: uuid
          baseline: value at enrollment
          current: most recent measurement
          target: goal value
          measured_at: ISO-8601
          method: survey | assessment | observation | admin-data
          confidence: high | medium | low

  indicators:
    - id: uuid
      name: indicator-name
      type: count | percentage | score | binary | narrative
      collection_method: survey | assessment | observation | admin-data
      frequency: per-session | monthly | quarterly | annually
      disaggregation: [age, geography, program, gender, race]
      heady_metrics_key: metric identifier in heady-metrics pipeline
      alert_threshold: { below: value, action: notify-via-heady-observer }
```

### 2. Build the Theory-of-Change Data Pipeline

Map program logic to heady-metrics data points:

```
INPUTS (heady-metrics)    ACTIVITIES (heady-traces)    OUTPUTS (heady-metrics)    OUTCOMES (HeadyMemory)
──────────────────────    ────────────────────────     ──────────────────────     ─────────────────────
Budget: $500K spent       1,600 sessions delivered     200 students served        80% reading improvement
5 FTE staff time          150 parent workshops         48 weeks of programming    65% grade advancement
                          logged in heady-traces       completed                  stored in HeadyMemory
```

**Data flow:**
```
Service delivery → heady-traces (audit log)
                 → heady-metrics (aggregation)
                 → HeadyMemory (longitudinal storage)
                 → heady-vinci (pattern recognition)
                 → heady-observer (threshold monitoring)
```

### 3. Design Beneficiary Journey Tracking

Privacy-first approach aligned with HF research patterns:

```
Enrollment → Baseline Assessment → Service Delivery → Milestone → Outcome Measurement → Completion
                                                        ↑
                                                  Reassessment loop
```

**Privacy architecture:**
- PII stored only in encrypted local database — never in HeadyMemory vector store
- HeadyMemory stores anonymized outcome vectors for semantic trend analysis
- All access logged via heady-traces — every query, every export
- Role-based access: frontline staff see individual records; leadership sees aggregates only
- Export follows data minimization: only required fields for each report

**MCP integration for journey events:**
```
Enrollment:  mcp_Heady_heady_memory(query="similar beneficiary profiles") → inform service plan
Milestone:   mcp_Heady_heady_soul(content="milestone achieved", action="learn") → improve predictions
Completion:  mcp_Heady_heady_vinci(data="journey summary", action="learn") → feed outcome model
```

### 4. Create the Impact Dashboard

Real-time view on HeadyWeb, powered by heady-metrics:

| Panel | Data Source | Audience |
|-------|-----------|----------|
| **Program Overview** | heady-metrics (served, active, completion rate) | All staff |
| **Outcome Tracker** | HeadyMemory + heady-metrics (progress vs targets) | Program managers |
| **Equity Lens** | heady-metrics disaggregated by demographics | Leadership, board |
| **Funder Targets** | heady-metrics filtered by funder-specific indicators | Development team |
| **Trend Lines** | heady-vinci (quarter-over-quarter predictions) | Board, funders |
| **Alert Panel** | heady-observer (indicators below threshold) | Program managers |

**Dashboard features:**
- Filter by program, date range, demographic group, funder
- Drill down from aggregate to program level (never to individual on dashboard)
- Export any view as PDF/CSV via HeadyWeb
- Automated alerts from heady-observer when indicators fall below targets
- Trend predictions from heady-vinci overlaid on actual data

### 5. Build the Impact Report Generator

Generate funder-ready reports using MCP tools:

```
1. mcp_Heady_heady_memory(query="[funder name] reporting requirements and past reports")
2. Pull aggregated metrics from heady-metrics for reporting period
3. mcp_Heady_heady_coder(prompt="generate impact report for [funder] using [data + template]")
4. mcp_Heady_heady_critique(code="{report}", criteria="accuracy, completeness, funder alignment")
5. Store finalized report in HeadyMemory for future reference
```

**Report sections with data sources:**

| Section | Source | MCP Tool |
|---------|--------|----------|
| Executive Summary | Auto-generated from key metrics | heady_coder |
| Program Activities | heady-traces (aggregated logs) | heady_coder |
| Participant Demographics | heady-metrics (anonymized aggregates) | heady_coder |
| Outcomes and Impact | HeadyMemory + heady-metrics | heady_coder + heady_memory |
| Success Stories | Flagged narratives (with beneficiary consent) | heady_memory |
| Challenges | Program notes, heady-observer alerts | heady_coder |
| Financial Summary | Grant expenditure data | heady_metrics |
| Data Quality Notes | heady-traces (collection completeness) | heady_coder |

### 6. Design Longitudinal Impact Tracking

Use HeadyMemory's 3D vector space for multi-year tracking:

```
mcp_Heady_heady_memory(query="outcome trends for [program] over [time range]", minScore=0.4)
mcp_Heady_heady_vinci(data="{memory results}", action="recognize") → pattern identification
mcp_Heady_heady_vinci(data="{patterns}", action="predict", context="next quarter forecast")
```

- **Cohort tracking** — follow beneficiary groups through multi-year programs
- **Community indicators** — track neighborhood-level metrics stored in HeadyMemory
- **Contribution analysis** — estimate organizational contribution to community-level change
- **Outcome prediction** — use heady-vinci to forecast likely outcomes for new enrollees

## Output Format

When designing Impact Ledger features, produce:

1. **Ledger schema** with heady-metrics and HeadyMemory integration points
2. **Theory of change data pipeline** with MCP tool mapping
3. **Beneficiary journey** specification with privacy architecture
4. **Dashboard** wireframes with heady-metrics data sources
5. **Report generator** workflow with MCP tool chain
6. **Longitudinal tracking** methodology using HeadyMemory + heady-vinci

## Tips

- **Measure what matters, not what's easy** — outputs are easy to count; outcomes require intentional HeadyMemory design
- **Disaggregate everything** — heady-metrics supports multi-dimensional disaggregation; use it to surface equity gaps
- **One source of truth** — all reports pull from heady-metrics + HeadyMemory; never maintain parallel spreadsheets
- **Privacy is non-negotiable** — PII never enters vector storage; heady-traces logs every access
- **heady-vinci spots what humans miss** — pattern recognition on longitudinal data reveals trends that quarterly reports obscure
- **Design for frontline staff** — if the data entry path is harder than a spreadsheet, adoption will fail
