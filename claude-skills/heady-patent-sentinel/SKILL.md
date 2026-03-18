---
name: heady-patent-sentinel
description: Design and operate the Heady Patent Sentinel for invention capture, prior art analysis, patentability assessment, and IP portfolio management. Use when building invention disclosure workflows, designing prior art search systems, creating patent landscape analysis, implementing patentability scoring, planning IP strategy for platform features, or managing patent prosecution pipelines. Integrates with heady-docs for patent documentation, heady-vinci for prior art analysis, HeadyMemory for invention history, heady-observer for IP monitoring, and heady-traces for prosecution audit trails.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Patent Sentinel

Use this skill when you need to **design, build, or operate the Patent Sentinel** — Heady's system for capturing inventions, analyzing patentability, managing prior art searches, and maintaining the platform's intellectual property portfolio.

## When to Use This Skill

- Building invention disclosure capture workflows
- Designing prior art search and analysis systems
- Creating patent landscape visualization and gap analysis
- Implementing patentability scoring and recommendation engines
- Planning IP strategy aligned with product roadmap
- Managing patent prosecution pipelines and deadlines

## Platform Context

The Patent Sentinel operates across Heady's IP infrastructure:

- **heady-docs** — Single source of truth for all patent documentation, architecture specs, API references, and prior art libraries
- **heady-vinci** — Analyzes inventions against prior art databases, scores patentability, identifies novel claims
- **HeadyMemory** (`latent-core-dev`, pgvector) — Stores invention disclosures, prior art embeddings, and patent relationship graphs as 3D vector data
- **heady-observer** — Monitors external patent filings, competitor activity, and IP landscape changes
- **heady-traces** — Immutable audit trail of invention dates, disclosure events, and prosecution milestones (critical for priority dates)
- **heady-sentinel** — Enforces IP access policies, gates disclosure visibility, manages confidentiality levels
- **heady-metrics** — Tracks portfolio size, filing rates, prosecution timelines, grant rates
- **heady-stories** — Generates patent claim drafts, technical descriptions, and invention narratives
- **heady-montecarlo** — Simulates patent portfolio value, litigation risk, and licensing revenue scenarios
- **headymcp-core** (31 MCP tools) — Backend capabilities powering patent operations
- **HeadyWeb** — Patent dashboard surface for portfolio management
- **headyconnection-core** — Community invention collaboration for nonprofit patent sharing

## Instructions

### 1. Define the Patent Model

```yaml
patent_sentinel:
  invention_types:
    - type: platform_feature
      source: product development (headybot-core, headybuddy-core, headymcp-core, etc.)
      capture: automated detection from commit messages, design docs, architecture decisions

    - type: algorithm
      source: heady-vinci, heady-patterns, heady-montecarlo model innovations
      capture: research team disclosure + automated novelty detection

    - type: system_architecture
      source: headysystems-core (Sacred Geometry), infrastructure innovations
      capture: architecture review triggers disclosure workflow

    - type: user_experience
      source: HeadyWeb, heady-mobile, heady-desktop, heady-chrome UX innovations
      capture: design review triggers disclosure workflow

  lifecycle:
    stages:
      ideation: invention identified, initial disclosure captured
      assessment: prior art search, patentability scoring
      decision: file / defer / trade-secret determination
      drafting: claims and specification preparation
      filing: provisional or non-provisional application submitted
      prosecution: examiner responses, amendments, appeals
      grant: patent issued, maintenance fee tracking
      enforcement: monitoring for infringement, licensing opportunities

  priority:
    method: heady-traces timestamps establish invention dates
    documentation: all conception and reduction-to-practice events logged immutably
    witness: automated corroboration via heady-traces event chain
```

### 2. Build the Invention Capture System

```yaml
invention_capture:
  sources:
    automated:
      - code_commits: heady-vinci scans commit messages and diffs for novelty signals
      - architecture_decisions: design doc changes in heady-docs trigger review
      - model_improvements: heady-patterns and heady-vinci performance jumps flagged
      - infrastructure_innovations: headysystems-core changes reviewed for patentable methods

    manual:
      - disclosure_form: inventors submit via HeadyWeb patent portal
      - buddy_capture: tell headybuddy-core about an invention in natural language
      - meeting_notes: extracted from collaboration sessions in headyconnection-core

  disclosure_workflow:
    1. Inventor describes invention (text, diagrams, code references)
    2. heady-vinci extracts key concepts and technical claims
    3. HeadyMemory stores disclosure with vector embedding for similarity search
    4. heady-traces logs disclosure timestamp (priority date evidence)
    5. Automated prior art preliminary search triggered
    6. Patent committee notified for assessment scheduling
    7. heady-sentinel enforces confidentiality until filing decision

  novelty_detection:
    engine: heady-vinci
    method:
      1. Embed invention description in HeadyMemory vector space
      2. Search against internal prior art corpus (previous disclosures, granted patents)
      3. Search against external patent databases (500M+ patent documents via API)
      4. Compute novelty score based on semantic distance from nearest prior art
      5. Flag potential conflicts and overlapping claims
      6. Generate novelty report with citations
```

### 3. Design Prior Art Analysis

```yaml
prior_art:
  databases:
    internal:
      - HeadyMemory invention corpus (all prior disclosures)
      - heady-docs architecture and design documentation
      - codebase history (git log analysis via headysystems-core)

    external:
      - patent_databases: USPTO, EPO, WIPO, JPO (500M+ documents)
      - academic: arXiv, IEEE, ACM, Semantic Scholar
      - standards: W3C, IETF, ISO published standards
      - open_source: GitHub, npm, PyPI published packages

  search_strategy:
    semantic: HeadyMemory vector similarity against prior art embeddings
    keyword: traditional patent classification (CPC/IPC) code search
    citation: forward/backward citation graph traversal
    inventor: search by known inventors in related fields

  analysis:
    engine: heady-vinci
    output:
      - relevance_ranked: prior art references ranked by similarity to claims
      - claim_mapping: each claim mapped against closest prior art
      - gap_analysis: identify claim elements NOT found in prior art (novel aspects)
      - risk_assessment: probability of examiner rejection per claim
      - recommendation: file / strengthen claims / defer / trade-secret

  landscape:
    visualization: HeadyWeb patent landscape map
    dimensions: [technology_area, filing_date, assignee, claim_scope]
    clustering: heady-patterns groups related patents into technology clusters
    whitespace: identifies unpatented areas where Heady innovations could file
```

### 4. Implement Patentability Scoring

```yaml
patentability_scoring:
  dimensions:
    novelty: { weight: 0.35, source: prior_art_analysis }
    non_obviousness: { weight: 0.30, source: heady-vinci combinatorial analysis }
    utility: { weight: 0.15, source: product_impact_assessment }
    enablement: { weight: 0.10, source: documentation_completeness }
    strategic_value: { weight: 0.10, source: portfolio_gap_analysis }

  scoring:
    range: 0.0 to 1.0
    thresholds:
      strong_file: score > 0.8 — recommend immediate filing
      likely_file: score 0.6-0.8 — recommend filing with claim strengthening
      marginal: score 0.4-0.6 — consider trade secret or defensive publication
      weak: score < 0.4 — defer, document as trade secret

  simulation:
    engine: heady-montecarlo
    scenarios:
      - prosecution_outcome: probability of grant given examiner rejection patterns
      - portfolio_value: expected licensing revenue over patent lifetime
      - litigation_risk: probability and cost of defending against challenges
      - competitive_impact: value of blocking competitors from technology area
```

### 5. Design Patent Prosecution Pipeline

```yaml
prosecution:
  tracking:
    storage: HeadyMemory prosecution namespace
    deadlines: automated deadline tracking with heady-observer alerts
    responses: examiner office actions logged in heady-traces
    amendments: claim changes tracked with full version history

  workflow:
    office_action_response:
      1. heady-observer detects office action deadline
      2. heady-vinci analyzes examiner objections and cited references
      3. heady-stories drafts response arguments and claim amendments
      4. Patent counsel reviews and approves (human-in-the-loop required)
      5. Response filed, heady-traces logs event
      6. Next deadline set in heady-observer

    continuation_strategy:
      method: heady-vinci recommends continuation, CIP, or divisional filings
      trigger: during prosecution or after grant based on portfolio gaps
      simulation: heady-montecarlo models portfolio value under different strategies

  maintenance:
    fee_tracking: heady-observer monitors maintenance fee deadlines
    renewal_decisions: heady-montecarlo evaluates cost vs. remaining value
    abandonment: low-value patents flagged for potential abandonment
    audit: heady-traces maintains complete prosecution history for compliance
```

### 6. Build the Patent Dashboard

HeadyWeb interface for IP management:

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Invention Pipeline** | HeadyMemory | Disclosures in progress, assessment queue, filing decisions |
| **Portfolio Overview** | heady-metrics | Total patents by status (pending, granted, expired), growth trend |
| **Prior Art Monitor** | heady-observer | New external filings in Heady's technology areas |
| **Prosecution Deadlines** | heady-observer | Upcoming office action responses and maintenance fees |
| **Patentability Scores** | heady-vinci | Recent disclosures with novelty and scoring breakdown |
| **Landscape Map** | heady-patterns | Technology area clustering with whitespace opportunities |
| **Portfolio Value** | heady-montecarlo | Simulated portfolio value and licensing revenue projections |

**Admin/Counsel view:**

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Filing Budget** | heady-metrics | Filing costs vs budget, cost per patent trend |
| **Examiner Analytics** | heady-vinci | Response success rates by examiner, art unit statistics |
| **Competitive Intelligence** | heady-observer | Competitor filing activity and technology overlap |
| **IP Strategy Alignment** | heady-docs | Patent coverage mapped against product roadmap features |

## Output Format

When designing Patent Sentinel features, produce:

1. **Patent model** with invention types, lifecycle stages, and priority documentation
2. **Capture system** with automated and manual disclosure workflows
3. **Prior art analysis** with search strategy, analysis pipeline, and landscape visualization
4. **Patentability scoring** with dimension weights, thresholds, and Monte Carlo simulations
5. **Prosecution pipeline** with deadline tracking, response workflow, and maintenance
6. **Dashboard** specification with inventor and counsel views

## Tips

- **heady-traces is your priority date proof** — every invention event must be immutably logged; this is legally critical for establishing invention dates
- **500M+ patent corpus via external APIs** — connect to USPTO, EPO, WIPO for comprehensive prior art; never rely solely on internal data
- **heady-vinci scores, humans decide** — patentability scoring is advisory; all filing decisions require patent counsel approval (human-in-the-loop)
- **Trade secrets are valid IP too** — not everything should be patented; some innovations are better protected as trade secrets (heady-sentinel enforces access)
- **Continuous capture beats batch disclosure** — automated novelty detection from commits and design docs catches inventions that inventors forget to disclose
- **Portfolio gaps are strategic opportunities** — landscape whitespace analysis reveals where Heady can file preemptively to strengthen competitive position
