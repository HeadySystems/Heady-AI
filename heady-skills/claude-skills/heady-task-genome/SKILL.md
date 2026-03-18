---
name: heady-task-genome
description: Design the Heady Task Genome — a system that maps the DNA of every task including structure, dependencies, resource needs, and execution patterns. Use when building task decomposition engines, defining task taxonomies, creating reusable task templates, or analyzing task execution history to optimize future workflows.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Task Genome

Use this skill when you need to **design, analyze, or optimize the Task Genome** — Heady's system for mapping the complete structure, dependencies, and execution DNA of every task that flows through the platform.

## When to Use This Skill

- Designing the task genome schema — capturing full task structure and metadata
- Building task decomposition — breaking complex tasks into atomic units
- Creating reusable task templates from successful execution patterns
- Analyzing task execution history to find optimization opportunities
- Defining task taxonomies and classification systems
- Building dependency graphs and critical path analysis for task pipelines

## Instructions

### 1. Define the Task Genome Schema

Every task has a genome — its complete structural DNA:

```yaml
task_genome:
  id: uuid
  name: human-readable-name
  created_at: ISO-8601
  completed_at: ISO-8601 | null

  classification:
    domain: coding | data | research | ops | creative | communication
    complexity: trivial | simple | moderate | complex | epic
    type: bug-fix | feature | refactor | analysis | review | deploy
    tags: [user-defined tags]

  structure:
    atomic: true | false          # can this task be broken down further?
    subtasks: [task-genome-ids]   # child tasks if decomposed
    parent: task-genome-id | null # parent task if this is a subtask
    depth: int                    # nesting level in decomposition tree

  dependencies:
    blockers: [task-ids that must complete before this starts]
    enables: [task-ids that this unblocks when complete]
    resources: [files, APIs, tools, data sources needed]
    permissions: [scopes required to execute]

  execution:
    assigned_to: agent-id | user
    model_used: model-identifier
    tools_used: [tool-names]
    duration_ms: actual execution time
    attempts: number of retries
    outcome: success | failure | partial | abandoned
    quality_score: 0.0-1.0

  lineage:
    template_id: uuid | null     # if created from a template
    similar_tasks: [task-ids with high genome similarity]
    evolved_from: task-id | null # if this is an iteration of a prior task

  patterns:
    execution_sequence: [ordered list of actions taken]
    decision_points: [moments where a choice was made]
    failure_points: [where things went wrong, if applicable]
    optimization_notes: what could be done better next time
```

### 2. Build the Decomposition Engine

Break complex tasks into atomic units:

**Decomposition rules:**
```
1. If a task has > 1 distinct output → split by output
2. If a task spans > 1 domain → split by domain
3. If a task requires > 1 tool → consider splitting by tool
4. If a task takes > 30 minutes → split by phase
5. Stop splitting when a subtask is atomic (single action, single output)
```

**Example decomposition:**
```
"Add user authentication to the app" (epic)
├── "Research auth approaches" (research, simple)
├── "Design auth schema" (coding, moderate)
│   ├── "Define user model" (coding, simple, atomic)
│   └── "Define session model" (coding, simple, atomic)
├── "Implement login endpoint" (coding, moderate)
│   ├── "Write route handler" (coding, simple, atomic)
│   ├── "Add password hashing" (coding, simple, atomic)
│   └── "Write login tests" (coding, simple, atomic)
├── "Implement signup endpoint" (coding, moderate)
└── "Add auth middleware" (coding, moderate)
```

### 3. Create Task Templates

Extract reusable templates from successful task genomes:

```yaml
task_template:
  id: uuid
  name: "Bug Fix Workflow"
  description: "Standard template for investigating and fixing a bug"
  domain: coding
  complexity_range: simple-moderate

  steps:
    - name: reproduce
      description: "Reproduce the bug locally"
      typical_duration_ms: 300000
      tools: [terminal, test-runner]
    - name: investigate
      description: "Find the root cause"
      typical_duration_ms: 600000
      tools: [code-search, debugger, memory]
    - name: fix
      description: "Implement the fix"
      typical_duration_ms: 900000
      tools: [code-editor]
    - name: test
      description: "Verify the fix with tests"
      typical_duration_ms: 300000
      tools: [test-runner]
    - name: review
      description: "Self-review the change"
      typical_duration_ms: 300000
      tools: [diff-viewer]

  success_criteria:
    - Bug no longer reproduces
    - All existing tests pass
    - New test covers the fixed case
    - No regressions introduced
```

### 4. Analyze Task Execution History

Mine the genome database for insights:

| Analysis | Query | Insight |
|----------|-------|---------|
| **Bottleneck detection** | Tasks with highest retry count | Which tasks fail most often and why |
| **Duration outliers** | Tasks that took 3x+ their template estimate | What causes tasks to take longer than expected |
| **Agent performance** | Success rate by agent and domain | Which agents perform best for which task types |
| **Dependency chains** | Longest critical paths | Where pipeline parallelism can be improved |
| **Template fitness** | Template vs actual execution divergence | Which templates need updating |

### 5. Build the Similarity Engine

Find tasks with similar genomes:

- **Structural similarity** — same decomposition shape and dependency pattern
- **Domain similarity** — same classification and resource requirements
- **Execution similarity** — same tool sequence and decision patterns
- **Outcome correlation** — tasks with similar genomes that succeeded vs failed

Use similarity to:
- Suggest templates for new tasks
- Predict duration and complexity
- Recommend the best agent for the job
- Warn about common failure patterns

### 6. Define the Task Taxonomy

Hierarchical classification system:

```
Domain
├── Coding
│   ├── Bug Fix
│   ├── Feature Development
│   ├── Refactoring
│   ├── Code Review
│   └── Testing
├── Data
│   ├── Query Writing
│   ├── Analysis
│   ├── Pipeline Building
│   └── Visualization
├── Research
│   ├── Codebase Exploration
│   ├── Documentation
│   └── Competitive Analysis
└── Ops
    ├── Deployment
    ├── Monitoring
    ├── Incident Response
    └── Configuration
```

## Output Format

When designing Task Genome features, produce:

1. **Genome schema** with all fields and relationships
2. **Decomposition rules** with examples
3. **Template definitions** for target task types
4. **Analysis queries** for mining task history
5. **Taxonomy** with categories and classification rules
6. **Similarity algorithm** specification

## Tips

- **Every task generates a genome** — even failed tasks; failure patterns are as valuable as success patterns
- **Templates evolve** — update templates based on actual execution data, not assumptions
- **Decomposition is judgment** — not every task should be broken into atoms; sometimes a moderate task is better left whole
- **Similarity is a superpower** — "this task looks like one you did last week that succeeded" is enormously useful
- **Classification enables routing** — the taxonomy is how the system matches tasks to the right agent and tools
