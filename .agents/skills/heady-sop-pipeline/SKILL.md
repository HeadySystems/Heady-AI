---
name: heady-sop-pipeline
description: Use when implementing structured output templates between pipeline stages, typed inter-agent communication, or formatted document generation in the Heady™ ecosystem. Keywords include SOP, structured output, pipeline template, typed artifacts, PRD, design doc, inter-agent communication.
metadata:
  author: HeadySystems
  version: '1.0'
  liquid_node: LiquidSOP
  absorption_source: "MetaGPT (ICLR 2024) — SOPs in prompts, 85.9% HumanEval"
---

# Heady™ SOP Pipeline (LiquidSOP)

## When to Use This Skill

Use this skill when the user needs to:
- Define structured output formats between pipeline stages
- Reduce hallucination cascading between agents
- Generate standardized PRDs, design docs, or API specs from agent output
- Implement typed artifact handoffs in multi-agent workflows

## Templates

### Stage Transition Documents

| From Stage | To Stage | Document Type |
|---|---|---|
| CONTEXT_LOAD → ANALYSIS | Analysis Brief | Problem statement, constraints, prior art |
| ANALYSIS → PLANNING | Design Doc | Architecture, interfaces, data flow |
| PLANNING → IMPLEMENTATION | Task Spec | File changes, test cases, acceptance criteria |
| IMPLEMENTATION → REVIEW | Review Package | Diff summary, test results, coverage |
| REVIEW → DEPLOY | Deploy Manifest | Artifacts, env vars, rollback plan |

### Template Format

```yaml
# .heady/sop-templates/design-doc.yaml
name: Design Document
version: 1.0
schema:
  title: string
  problem_statement: string
  constraints: string[]
  proposed_solution:
    architecture: string
    components: { name: string, responsibility: string }[]
    interfaces: { name: string, input: string, output: string }[]
  alternatives_considered: { approach: string, reason_rejected: string }[]
  test_strategy: string
  rollback_plan: string
```

## Instructions

### Implementing SOP Handoffs

1. Define template YAML in `.heady/sop-templates/`.
2. At each pipeline stage transition, the completing agent fills the template.
3. CSL gate validates completeness (all required fields present, quality > 0.618).
4. Template output becomes structured input to the next stage.
5. If validation fails, agent must re-generate (no free-form fallback).

### Benefits Over Free-Form Communication

| Metric | Free-Form | SOP-Structured |
|---|---|---|
| Hallucination cascading | Common (errors amplify) | Rare (schema catches gaps) |
| Context utilization | ~40% (lost in noise) | ~85% (structured extraction) |
| Reproducibility | Low | High (same template, same fields) |
| Audit trail | Difficult | Complete (every field traced) |

## Output Format

- Filled Template Documents
- Validation Report
- Stage Transition Log
- Template Coverage Map
