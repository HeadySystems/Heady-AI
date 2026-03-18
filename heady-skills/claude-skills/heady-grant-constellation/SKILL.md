---
name: heady-grant-constellation
description: Design and operate the Heady Grant Constellation for nonprofit grant discovery, matching, pipeline management, and compliance tracking. Use when building grant finders, matching orgs to funders, tracking application pipelines, generating narratives, or designing compliance workflows. Integrates with HeadyConnection community surfaces and the headyconnection-core collaborative workspace.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Grant Constellation

Use this skill when you need to **design, build, or operate the Grant Constellation** — Heady's system for discovering, matching, tracking, and managing grant opportunities for nonprofit organizations. Grounded in HeadyConnection's community and collaborative workspace surfaces.

## When to Use This Skill

- Designing grant discovery and matching algorithms
- Building application pipeline management from prospect to submission to award
- Generating grant narratives and proposal drafts from organizational data
- Tracking compliance and reporting for awarded grants
- Creating funder relationship maps and engagement strategies
- Planning the grant calendar with deadlines, renewals, and reporting windows

## Platform Context

The Grant Constellation is projected from the Heady Latent OS and runs across:

- **HeadyConnection** (`headyconnection-core`) — collaborative workspace where nonprofit teams coordinate grant strategy
- **HeadyMCP** (`headymcp-core`, 31 MCP tools) — orchestration layer for grant pipeline automation
- **HeadyMemory** (3D vector memory in `latent-core-dev`, pgvector + Antigravity) — stores funder profiles, past proposals, and outcome data for semantic recall
- **HeadyWeb** — browser-native dashboard for grant pipeline visualization
- **heady-observer / heady-metrics** — observability layer tracking pipeline health and deadline adherence

## Instructions

### 1. Define the Grant Constellation Model

```yaml
grant_constellation:
  organization:
    id: uuid
    name: org-name
    ein: tax-id
    mission: mission statement
    programs: [program areas]
    budget: annual operating budget
    geography: service regions
    demographics: populations served
    capacity: { staff: N, grant_writers: N }

  opportunities:
    - id: uuid
      funder: funder-name
      program: specific grant program
      amount_range: { min: 10000, max: 500000 }
      deadline: ISO-8601
      cycle: one-time | annual | rolling
      eligibility:
        org_types: [501c3, fiscal-sponsorship]
        budget_range: { min: 0, max: 5000000 }
        geography: [eligible regions]
        focus_areas: [matching program areas]
      match_score: 0.0-1.0
      status: prospect | researching | preparing | submitted | awarded | declined
      pipeline_stage: discovery | qualification | preparation | submission | decision

  relationships:
    - funder_id: uuid
      warmth: cold | warm | hot | partner
      contacts: [named contacts with roles]
      history: [past interactions and outcomes]
      last_contact: ISO-8601
      next_action: { type: string, due: ISO-8601 }
```

### 2. Build the Grant Matching Engine

Use HeadyMemory's 3D vector space to find semantic matches:

```
1. mcp_Heady_heady_memory(query="funder priorities: [org mission keywords]", limit=20, minScore=0.5)
2. Score each opportunity against organizational fit
3. Rank by composite match score
```

| Signal | Weight | Scoring Logic |
|--------|--------|--------------|
| Mission alignment | 0.30 | Semantic similarity via HeadyEmbed between org mission and funder priorities |
| Program area match | 0.25 | Overlap between org programs and grant focus areas |
| Budget fit | 0.15 | Org budget falls within funder's target range |
| Geographic match | 0.15 | Service area overlap with funder's geographic focus |
| Historical success | 0.10 | Past awards or positive interactions (from HeadyMemory) |
| Capacity fit | 0.05 | Grant size appropriate for org's management capacity |

### 3. Design the Application Pipeline

Track every grant through the HeadyConnection task board:

```
Discovery → Qualification → Preparation → Submission → Decision → [Award | Decline]
                                                                      ↓
                                                               Compliance & Reporting
```

**MCP tool integration at each stage:**

| Stage | MCP Tools Used | Outputs |
|-------|---------------|---------|
| Discovery | `heady_memory` (funder search), `heady_research` (web research) | Match report |
| Qualification | `heady_analyze` (eligibility check), `heady_memory` (past interactions) | Qualification memo |
| Preparation | `heady_coder` (document assembly), `heady_memory` (boilerplate recall) | Checklist + draft sections |
| Submission | `heady_critique` (proposal review), `heady_battle` (quality evaluation) | Final proposal |
| Decision | `heady_soul` (learn from outcome) | Lessons learned entry |
| Compliance | `heady_observer` (deadline monitoring), `heady_metrics` (reporting) | Compliance dashboard |

### 4. Build the Narrative Generator

Auto-generate proposal sections using HeadyMemory and HeadyCoder:

```
1. mcp_Heady_heady_memory(query="past successful narratives for [program area]")
2. mcp_Heady_heady_coder(prompt="generate [section] for [funder] using [org data + past narratives]")
3. mcp_Heady_heady_critique(code="{draft}", criteria="funder alignment, specificity, data quality")
```

| Section | Source Data | MCP Tools |
|---------|-----------|-----------|
| Organization Overview | Mission, history, programs | `heady_memory` + `heady_coder` |
| Statement of Need | Demographics, community data | `heady_research` + `heady_coder` |
| Program Description | Logic models, outcomes | `heady_memory` + `heady_coder` |
| Budget Narrative | Line-item budget | `heady_coder` with financial templates |
| Evaluation Plan | Metrics, methods | `heady_memory` (past eval plans) + `heady_coder` |

**Generation rules:**
- Match funder language and priorities (use `heady_memory` to recall funder-specific vocabulary)
- Include specific data points from the Impact Ledger
- Flag sections needing human review with `[REVIEW NEEDED]` markers
- Store successful narratives back to HeadyMemory with `heady_soul(action="learn")`

### 5. Design Compliance Tracking

Use heady-observer and heady-metrics for post-award monitoring:

```yaml
compliance_tracker:
  grant_id: uuid
  funder: funder-name
  award_amount: dollar amount
  period: { start: ISO-8601, end: ISO-8601 }

  reporting:
    - type: interim | final | financial | narrative
      due: ISO-8601
      status: upcoming | drafting | submitted | accepted
      heady_observer_alert: 30-day and 14-day warnings
      data_sources: [impact-ledger, financial-system]

  deliverables:
    - name: deliverable description
      due: ISO-8601
      status: not-started | in-progress | complete
      evidence: [documentation references]

  financial:
    budget: approved line items
    spent: actual expenditures via heady-metrics
    remaining: unspent balance
    variance_alert: trigger at 10% deviation

  alerts:
    - trigger: 30 days before report due → heady_observer fires
    - trigger: budget variance > 10% → heady_sentinel flags
    - trigger: 60 days before grant end → begin closeout ritual
```

### 6. Plan the Grant Calendar

Unified view across HeadyWeb:

- **Timeline view** — all grants on a single timeline with milestones
- **Deadline alerts** — routed via heady-observer at 90, 60, 30, 14, 7 days
- **Workload forecasting** — predict busy periods using heady-vinci pattern recognition
- **Renewal tracking** — flag grants approaching end-of-period
- **Funder engagement schedule** — planned touchpoints stored in HeadyMemory

### 7. Integrate with HeadyConnection

Grant work is collaborative — use HeadyConnection surfaces:

- **Team workspace** — shared grant pipeline visible to all authorized team members
- **Role-based access** — executive director, grant writer, program staff, finance each see relevant data
- **Collaborative editing** — proposal drafts in shared HeadyConnection workspace
- **Activity feed** — all grant pipeline changes logged and visible to team
- **Audit trail** — every action tracked via heady-traces for transparency

## Output Format

When designing Grant Constellation features, produce:

1. **Constellation model** with org profile and opportunity schemas
2. **Matching algorithm** with signals, weights, and MCP tool integration
3. **Pipeline stage definitions** with MCP tools at each stage
4. **Narrative generation** workflow using HeadyMemory and HeadyCoder
5. **Compliance tracking** schema with heady-observer alert triggers
6. **HeadyConnection integration** plan for collaborative grant work

## Tips

- **Match quality over quantity** — 5 high-match opportunities beat 50 low-match ones
- **HeadyMemory is your funder database** — store every funder interaction, preference, and past outcome
- **Use heady_soul to learn** — after every grant decision, feed the outcome back to improve future matching
- **heady-observer prevents missed deadlines** — configure alerts early and aggressively
- **Narratives improve with reuse** — the more past proposals in HeadyMemory, the better the generator performs
- **Auditability builds funder trust** — use heady-traces to demonstrate rigorous grant management
