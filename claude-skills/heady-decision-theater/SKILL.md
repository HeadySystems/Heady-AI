---
name: heady-decision-theater
description: Design and operate the Heady Decision Theater for structured decision support, scenario simulation, multi-criteria analysis, and collaborative deliberation. Use when building decision frameworks for complex choices, designing scenario modeling and what-if analysis tools, creating multi-criteria decision analysis (MCDA) systems, implementing collaborative deliberation workflows, planning probabilistic outcome simulation, or designing decision audit trails. Integrates with heady-montecarlo for probabilistic simulation, heady-vinci for analysis and synthesis, heady-battle for comparative evaluation, heady-critique for devil's advocate analysis, HeadyMemory for decision history, heady-traces for decision audit trails, and headyconnection-core for collaborative deliberation.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Decision Theater

Use this skill when you need to **design, build, or operate the Decision Theater** — Heady's structured decision support system that helps individuals and teams make better decisions through scenario simulation, multi-criteria analysis, and collaborative deliberation.

## When to Use This Skill

- Building decision frameworks for complex, high-stakes choices
- Designing scenario modeling and what-if analysis tools
- Creating multi-criteria decision analysis (MCDA) systems
- Implementing collaborative deliberation workflows for team decisions
- Planning probabilistic outcome simulation for decision options
- Designing decision audit trails for accountability and learning

## Platform Context

The Decision Theater orchestrates across Heady's intelligence infrastructure:

- **heady-montecarlo** — Probabilistic simulation engine; models decision outcomes under uncertainty with configurable parameters and distributions
- **heady-vinci** — Analysis and synthesis; evaluates options against criteria, identifies hidden trade-offs, generates decision briefs
- **heady-battle** — Comparative evaluation; structures head-to-head comparison of decision options across dimensions
- **heady-critique** — Devil's advocate analysis; challenges assumptions, identifies blind spots, stress-tests reasoning
- **HeadyMemory** (`latent-core-dev`, pgvector) — Stores decision context, criteria, options, analyses, and outcomes as 3D vector embeddings; enables learning from past decisions
- **heady-traces** — Decision audit trail; immutable record of decision process, rationale, and outcomes for accountability and retrospective learning
- **heady-patterns** — Identifies decision-making patterns, biases, and historical outcome distributions
- **heady-stories** — Generates decision narratives, scenario descriptions, and stakeholder communications
- **heady-metrics** — Tracks decision quality metrics: time to decision, outcome accuracy, stakeholder satisfaction
- **heady-observer** — Monitors decision deadlines, triggers escalation for stale decisions
- **headyconnection-core** — Collaborative deliberation for team and community decisions (nonprofit)
- **headybuddy-core** — AI Companion facilitates personal decision-making through structured conversation
- **HeadyWeb** — Decision Theater interface for visualization and collaboration

## Instructions

### 1. Define the Decision Model

```yaml
decision_theater:
  decision_types:
    personal:
      scope: individual choices (career, financial, life)
      facilitator: headybuddy-core guides through decision framework
      deliberation: individual reflection with AI support

    team:
      scope: organizational choices (strategy, product, resource allocation)
      facilitator: decision coordinator (human) with AI support
      deliberation: collaborative via headyconnection-core or synchronous meeting

    technical:
      scope: engineering choices (architecture, technology, design patterns)
      facilitator: heady-vinci provides technical analysis
      deliberation: design review with structured comparison

    strategic:
      scope: high-stakes, long-horizon choices (market entry, partnerships, M&A)
      facilitator: decision committee with comprehensive AI analysis
      deliberation: multi-round with simulation and stress-testing

  decision_model:
    structure:
      decision_id: unique identifier
      question: clearly stated decision question (what are we deciding)
      context: background information and constraints
      criteria: weighted evaluation dimensions
      options: alternatives being considered
      analysis: per-option evaluation against criteria
      simulation: probabilistic outcome modeling
      deliberation: discussion, challenges, and perspectives
      decision: chosen option with rationale
      outcome_tracking: what actually happened (retrospective)

    storage: HeadyMemory decision-theater namespace
    audit: complete decision process logged in heady-traces
```

### 2. Build the Decision Framework Engine

```yaml
framework:
  structured_process:
    phase_1_frame:
      objective: clearly define the decision
      actions:
        1. State the decision question precisely
        2. Identify decision-maker(s) and stakeholders
        3. Set deadline and urgency level
        4. Define success criteria (what would a good outcome look like)
        5. Identify constraints and non-negotiables
      output: decision brief stored in HeadyMemory

    phase_2_explore:
      objective: generate and understand options
      actions:
        1. Brainstorm options (human + heady-vinci divergent thinking)
        2. Research each option (heady-vinci analysis)
        3. Identify criteria for evaluation (stakeholder input)
        4. Weight criteria by importance (pairwise comparison method)
        5. Map dependencies and prerequisites per option
      output: option set with weighted criteria matrix

    phase_3_analyze:
      objective: evaluate options rigorously
      actions:
        1. Score each option against each criterion (heady-vinci + human judgment)
        2. Run Monte Carlo simulations per option (heady-montecarlo)
        3. Compare options head-to-head (heady-battle)
        4. Stress-test leading options (heady-critique devil's advocate)
        5. Identify reversibility and switching costs per option
      output: analysis report with scores, simulations, and stress-test results

    phase_4_deliberate:
      objective: discuss, debate, and refine
      actions:
        1. Present analysis to decision-makers
        2. Structured discussion of trade-offs
        3. Surface disagreements and resolve or acknowledge
        4. Check for cognitive biases (heady-critique bias detection)
        5. Final option ranking with confidence levels
      output: deliberation record with perspectives captured

    phase_5_decide:
      objective: make and commit to the decision
      actions:
        1. Decision-maker selects option with stated rationale
        2. Document what would change the decision (reversibility triggers)
        3. Define implementation next steps
        4. Communicate decision to stakeholders (heady-stories generates narrative)
        5. Set outcome tracking milestones
      output: decision record in heady-traces (immutable)

    phase_6_retrospect:
      objective: learn from outcomes
      trigger: outcome milestones reached or decision anniversary
      actions:
        1. Compare actual outcomes against predictions
        2. Identify what the decision process got right and wrong
        3. Update decision-making patterns in HeadyMemory
        4. Feed learnings into future decision frameworks
      output: retrospective report linked to original decision
```

### 3. Design Multi-Criteria Analysis

```yaml
mcda:
  criteria_elicitation:
    method: structured interview via headybuddy-core or facilitator
    techniques:
      swing_weights: rank criteria by how much a swing from worst to best matters
      pairwise_comparison: compare criteria in pairs to derive weights (AHP method)
      direct_rating: assign 0-100 importance scores to each criterion

  scoring:
    methods:
      quantitative: measurable criteria scored on defined scales (cost, time, revenue)
      qualitative: subjective criteria scored via structured rubrics (culture fit, user experience)
      hybrid: heady-vinci converts qualitative assessments to normalized scores

    normalization: all scores normalized to 0-1 range for aggregation
    aggregation: weighted sum of normalized scores per option
    sensitivity: vary criterion weights ±20% to test ranking robustness

  visualization:
    radar_chart: options overlaid on criteria radar for pattern comparison
    sensitivity_tornado: which criteria most affect the ranking
    trade_off_scatter: plot options on key trade-off dimensions (e.g., cost vs. quality)
    ranking_table: final scores with breakdown by criterion
```

### 4. Implement Scenario Simulation

```yaml
simulation:
  engine: heady-montecarlo

  scenario_types:
    base_case: expected outcomes with central estimates
    optimistic: favorable conditions across key variables
    pessimistic: unfavorable conditions across key variables
    stress_test: extreme but plausible adverse scenarios
    custom: user-defined parameter combinations

  configuration:
    variables: key uncertain factors affecting outcomes (market growth, cost overruns, adoption rate, etc.)
    distributions: each variable assigned a probability distribution (normal, triangular, uniform, custom)
    correlations: dependencies between variables modeled explicitly
    iterations: 10,000 simulations per scenario (configurable)

  output:
    probability_distributions: outcome distribution per option
    confidence_intervals: 50th, 80th, 95th percentile outcomes
    risk_metrics: probability of loss, expected shortfall, maximum drawdown
    comparison: side-by-side option outcome distributions
    sensitivity: which variables most affect outcomes (tornado chart)

  stress_testing:
    engine: heady-critique
    method:
      1. Identify critical assumptions in the decision
      2. Generate scenarios where each assumption fails
      3. Model cascading failures (what breaks when X fails)
      4. Identify robustness: which options survive stress tests best
    output: stress test report with vulnerability map
```

### 5. Design Collaborative Deliberation

```yaml
deliberation:
  modes:
    asynchronous:
      platform: headyconnection-core discussion threads
      features:
        - Structured argument threads (pro/con per option)
        - Anonymous initial voting to prevent anchoring
        - heady-vinci synthesizes discussion themes
        - Deadline-driven convergence

    synchronous:
      platform: live session via HeadyWeb or video call
      features:
        - Shared decision theater view with real-time analysis
        - Round-robin perspective sharing (equitable voice)
        - Live Monte Carlo simulation adjustments
        - Real-time voting and sentiment tracking

    ai_facilitated:
      engine: headybuddy-core (personal) or heady-vinci (team)
      techniques:
        pre_mortem: "Imagine this option failed — why?"
        red_team: heady-critique argues against the leading option
        perspective_taking: "How would [stakeholder X] view this option?"
        bias_check: flag potential anchoring, sunk cost, confirmation bias

  consensus_tools:
    dot_voting: allocate limited votes across options
    fist_of_five: 1-5 confidence voting per option
    gradient_of_agreement: 6-point scale from "endorse" to "block"
    disagree_and_commit: acknowledge disagreement while committing to decision
```

### 6. Build the Decision Dashboard

HeadyWeb interface for decision management:

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Active Decisions** | HeadyMemory | Decisions in progress with phase, deadline, participants |
| **Decision Framework** | HeadyMemory | Current decision through structured phases with status |
| **Criteria Matrix** | heady-vinci | Weighted criteria with per-option scores, sensitivity |
| **Simulation Results** | heady-montecarlo | Outcome distributions, confidence intervals, comparison |
| **Battle View** | heady-battle | Head-to-head option comparison across dimensions |
| **Deliberation** | headyconnection-core | Discussion threads, voting, sentiment tracking |
| **Decision History** | heady-traces | Past decisions with outcomes and retrospective learnings |

**Personal decision view (headybuddy-core):**

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **My Decisions** | HeadyMemory | Personal decisions with AI-guided framework |
| **Quick Analysis** | heady-vinci | Lightweight pro/con and recommendation for simpler choices |
| **Decision Journal** | HeadyMemory | History of personal decisions with outcome reflections |

## Output Format

When designing Decision Theater features, produce:

1. **Decision model** with types, structure, and storage
2. **Framework engine** with 6-phase structured process
3. **Multi-criteria analysis** with elicitation, scoring, and visualization
4. **Scenario simulation** with Monte Carlo configuration, stress testing, and output
5. **Collaborative deliberation** with async/sync/AI-facilitated modes
6. **Dashboard** specification with team and personal decision views

## Tips

- **heady-montecarlo turns guesses into distributions** — never present a single estimate; always model uncertainty with probability distributions
- **heady-critique is the devil's advocate** — every important decision needs its assumptions challenged; automated stress-testing catches blind spots
- **heady-battle structures comparison** — head-to-head evaluation is more reliable than absolute scoring; compare options directly
- **Decision audit trails enable learning** — heady-traces records the entire decision process; retrospectives against actual outcomes improve future decisions
- **Bias detection is valuable** — heady-critique can flag common cognitive biases (anchoring, sunk cost, confirmation bias); awareness alone improves decision quality
- **Reversibility matters** — always assess switching costs; prefer reversible decisions where possible, invest more analysis in irreversible ones
- **The process IS the value** — even if the "right" answer seems obvious, the structured process surfaces hidden considerations and builds stakeholder alignment
