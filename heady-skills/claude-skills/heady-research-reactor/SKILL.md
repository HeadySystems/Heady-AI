---
name: heady-research-reactor
description: Design and operate the Heady Research Reactor for AI-assisted research workflows, literature synthesis, hypothesis generation, experiment design, and knowledge discovery. Use when building research pipeline orchestration, designing literature review automation, creating hypothesis generation engines, implementing experiment tracking and reproducibility systems, planning multi-agent research teams, or designing research knowledge graphs. Integrates with heady-docs for research documentation, heady-vinci for analysis and synthesis, heady-montecarlo for experiment simulation, HeadyMemory for research knowledge base, heady-stories for research narrative generation, heady-battle for comparative evaluation, and heady-critique for peer review simulation.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Research Reactor

Use this skill when you need to **design, build, or operate the Research Reactor** — Heady's AI-powered research platform that accelerates knowledge discovery through multi-agent research teams, automated literature synthesis, and intelligent experiment design.

## When to Use This Skill

- Building research pipeline orchestration for complex investigations
- Designing literature review automation and synthesis systems
- Creating hypothesis generation and validation engines
- Implementing experiment tracking, reproducibility, and result management
- Planning multi-agent research teams with coordinator-specialist patterns
- Designing research knowledge graphs for cross-domain discovery

## Platform Context

The Research Reactor operates across Heady's intelligence infrastructure:

- **heady-docs** — Research documentation hub; stores papers, findings, methodologies, and research outputs
- **heady-vinci** — Research analysis engine; literature synthesis, pattern discovery, statistical analysis, and insight generation
- **heady-montecarlo** — Experiment simulation; models experiment outcomes before execution, estimates sample sizes, predicts effect sizes
- **HeadyMemory** (`latent-core-dev`, pgvector) — Research knowledge base; stores paper embeddings, research findings, and knowledge graph as 3D vector data for semantic discovery
- **heady-stories** — Research narrative generation; writes literature reviews, abstracts, methodology sections, and findings summaries
- **heady-battle** — Comparative evaluation; ranks competing hypotheses, models, or approaches through structured comparison
- **heady-critique** — Peer review simulation; evaluates research quality, identifies methodology weaknesses, suggests improvements
- **heady-patterns** — Discovers research trends, citation patterns, and emerging topic clusters
- **heady-metrics** — Tracks research productivity, pipeline throughput, and discovery metrics
- **headybot-core** — Research agent orchestration; multi-agent research teams with specialist roles
- **template-swarm-bee** — Swarm template for coordinating research agent teams
- **heady-observer** — Monitors research pipeline health and deadlines
- **headyconnection-core** — Community research collaboration for open science (nonprofit)
- **HeadyWeb** — Research dashboard for project management and visualization

## Instructions

### 1. Define the Research Model

```yaml
research_reactor:
  research_types:
    literature_review:
      description: systematic synthesis of existing knowledge on a topic
      agents: [search_agent, screening_agent, extraction_agent, synthesis_agent]
      output: structured literature review with evidence map

    hypothesis_generation:
      description: AI-assisted generation and ranking of research hypotheses
      agents: [knowledge_agent, pattern_agent, hypothesis_agent, evaluation_agent]
      output: ranked hypothesis list with supporting evidence and testability scores

    experiment_design:
      description: design experiments to test hypotheses
      agents: [design_agent, simulation_agent, power_agent, protocol_agent]
      output: experiment protocol with power analysis and expected outcomes

    data_analysis:
      description: analyze experimental or observational data
      agents: [cleaning_agent, analysis_agent, visualization_agent, interpretation_agent]
      output: analysis report with statistical results and visualizations

    cross_domain_discovery:
      description: find connections between disparate research domains
      agents: [domain_mappers, bridge_agent, novelty_agent]
      output: cross-domain insight report with novel connection hypotheses

  knowledge_graph:
    storage: HeadyMemory research namespace
    nodes: [papers, concepts, methods, findings, researchers, datasets, hypotheses]
    edges: [cites, supports, contradicts, extends, uses_method, produces_finding]
    embedding: 3D vector representation for semantic similarity search
    growth: continuously updated as new research is processed
```

### 2. Build the Research Pipeline

```yaml
research_pipeline:
  orchestration:
    engine: headybot-core with template-swarm-bee coordinator pattern
    coordinator: research_coordinator agent manages pipeline stages
    specialists: domain-specific agents assigned to pipeline stages

  stages:
    scoping:
      agent: research_coordinator
      actions:
        1. Define research question with user
        2. Identify relevant domains and keywords
        3. Set inclusion/exclusion criteria
        4. Estimate scope and timeline
        5. Assign specialist agents
      output: research protocol document in heady-docs

    collection:
      agents: search_agents (parallelized by source)
      sources:
        academic: [arXiv, PubMed, Semantic Scholar, IEEE, ACM]
        patent: [USPTO, EPO, WIPO via patent-sentinel integration]
        web: [curated domain sources, preprint servers]
        internal: [HeadyMemory knowledge base, heady-docs existing research]
      actions:
        1. Execute searches across all sources in parallel
        2. Deduplicate results
        3. Store papers and metadata in HeadyMemory with vector embeddings
        4. Update knowledge graph with new nodes and edges
      output: candidate corpus with metadata

    screening:
      agent: screening_agent
      method:
        1. heady-vinci scores relevance of each candidate against research question
        2. Apply inclusion/exclusion criteria
        3. Flag borderline cases for human review
        4. Generate screening report with counts and rationale
      output: filtered corpus ready for extraction

    extraction:
      agent: extraction_agent
      method:
        1. Extract key findings, methods, sample sizes, effect sizes from each paper
        2. Code papers against predefined themes or categories
        3. Identify contradictions, gaps, and trends
        4. Store structured extractions in HeadyMemory
      output: structured evidence table

    synthesis:
      agent: synthesis_agent powered by heady-vinci
      method:
        1. Aggregate evidence across papers by theme
        2. Identify consensus, disagreement, and gaps
        3. Generate synthesis narrative via heady-stories
        4. Create evidence map visualization
        5. heady-critique evaluates synthesis quality
      output: literature review document with evidence map

    evaluation:
      agents: heady-battle + heady-critique
      method:
        1. heady-battle compares competing hypotheses or approaches
        2. heady-critique reviews methodology and identifies weaknesses
        3. Generate quality assessment with confidence levels
      output: evaluation report with ranked findings
```

### 3. Design Hypothesis Generation

```yaml
hypothesis_engine:
  generation:
    method:
      1. heady-vinci analyzes knowledge graph for unexplored connections
      2. heady-patterns identifies emerging trends and anomalies in research data
      3. Cross-domain bridge agent finds analogies between distant fields
      4. Generate candidate hypotheses from gaps, trends, and analogies
      5. Each hypothesis structured as: claim, mechanism, testability, novelty

  ranking:
    dimensions:
      novelty: { weight: 0.25, source: distance from existing knowledge in HeadyMemory }
      testability: { weight: 0.25, source: feasibility of experiment design }
      impact: { weight: 0.20, source: potential significance if confirmed }
      evidence_support: { weight: 0.20, source: existing evidence strength }
      risk: { weight: 0.10, source: probability of null result }
    engine: heady-battle comparative ranking

  simulation:
    method: heady-montecarlo simulates expected experiment outcomes per hypothesis
    outputs: expected effect sizes, required sample sizes, estimated timeline and cost
    decision_support: investment-vs-return analysis for hypothesis portfolio
```

### 4. Implement Experiment Tracking

```yaml
experiment_tracking:
  protocol_management:
    registration: experiment protocols registered in heady-docs before execution
    versioning: protocol changes tracked with rationale
    pre_registration: hypotheses and analysis plans locked before data collection

  execution_tracking:
    events: [experiment_start, data_collection, milestone, deviation, completion]
    logging: all events in heady-traces for reproducibility audit
    monitoring: heady-observer tracks timeline and flags deviations
    deviation_handling: protocol deviations logged with justification

  reproducibility:
    requirements:
      - complete protocol in heady-docs
      - all data versioned and stored in HeadyMemory
      - analysis code version-controlled
      - environment specification captured
      - random seeds recorded
    verification: heady-critique checks reproducibility checklist before publication

  results:
    storage: HeadyMemory results namespace with full provenance
    analysis: heady-vinci statistical analysis with pre-registered methods
    visualization: auto-generated charts and figures
    narrative: heady-stories generates results section from data
    comparison: heady-battle compares results against hypotheses and prior work
```

### 5. Build the Research Dashboard

HeadyWeb interface for research management:

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Active Projects** | HeadyMemory | Research projects with stage, progress, and timeline |
| **Knowledge Graph** | HeadyMemory | Interactive visualization of research knowledge network |
| **Literature Pipeline** | headybot-core | Papers in collection → screening → extraction → synthesis |
| **Hypothesis Board** | HeadyMemory | Ranked hypotheses with scores and simulation results |
| **Experiment Tracker** | heady-traces | Active experiments, milestones, deviations |
| **Findings Feed** | heady-vinci | Recent discoveries, synthesis outputs, cross-domain insights |
| **Agent Team** | headybot-core | Research agent status, task assignments, performance |

**Collaboration view (headyconnection-core):**

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Shared Projects** | headyconnection-core | Collaborative research with community members |
| **Open Datasets** | HeadyMemory | Shared research data for open science |
| **Peer Review Queue** | heady-critique | Papers awaiting community peer review |

## Output Format

When designing Research Reactor features, produce:

1. **Research model** with research types, agent teams, and knowledge graph structure
2. **Research pipeline** with orchestration, stages, and agent assignments
3. **Hypothesis engine** with generation, ranking, and simulation
4. **Experiment tracking** with protocol management, reproducibility, and results
5. **Dashboard** specification with project management and collaboration views

## Tips

- **Coordinator + specialist pattern** — research_coordinator agent manages the pipeline; specialist agents handle specific tasks; this mirrors successful multi-agent research patterns from HF research
- **HeadyMemory is the research brain** — every paper, finding, hypothesis, and result is embedded in 3D vector space for semantic discovery; the knowledge graph grows with every project
- **Pre-registration prevents p-hacking** — lock hypotheses and analysis plans before data collection; heady-traces provides immutable proof of pre-registration
- **heady-battle for hypothesis ranking** — comparative evaluation is more reliable than absolute scoring; pit hypotheses against each other
- **heady-critique as peer reviewer** — automated quality checks catch methodology issues before human reviewers see the work
- **Cross-domain discovery is the unique value** — the knowledge graph spanning multiple domains enables connections that siloed researchers would never find
- **Reproducibility is a first-class requirement** — every experiment must be reproducible; heady-traces + version-controlled protocols make this automatic
