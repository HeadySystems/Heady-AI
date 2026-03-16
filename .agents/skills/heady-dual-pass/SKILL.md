---
name: heady-dual-pass
description: Use when implementing architect/editor model separation, multi-model reasoning pipelines, or cost-optimized code generation in the Heady™ ecosystem. Keywords include dual pass, architect, editor, model separation, reasoning, formatting, multi-model, code planning.
metadata:
  author: HeadySystems
  version: '1.0'
  liquid_node: LiquidDualPass
  absorption_source: "Aider Architect/Editor separation — 85% benchmark"
---

# Heady™ Dual Pass (LiquidDualPass)

## When to Use This Skill

Use this skill when the user needs to:
- Separate reasoning from code formatting for better results
- Route expensive reasoning models only to the planning phase
- Use cheaper formatting models for syntactically correct code output
- Implement multi-model pipelines for complex code changes

## Architecture

### Two-Phase Pipeline

```
Pass 1: ARCHITECT (Reasoning Model)           Pass 2: EDITOR (Formatting Model)
┌────────────────────────────┐                ┌────────────────────────────┐
│ Model: o1-preview / Opus   │                │ Model: GPT-4 / Sonnet     │
│ Input: problem + repo map  │ ──── plan ───→ │ Input: plan + target files │
│ Output: structured plan    │                │ Output: valid code diffs   │
│ Cost: $$$                  │                │ Cost: $                    │
└────────────────────────────┘                └────────────────────────────┘
```

### Model Routing

| Phase | Model Tier | Examples | Focus |
|---|---|---|---|
| Architect | Reasoning-class | o1-preview, Claude Opus, Gemini Ultra | WHY and WHAT to change |
| Editor | Formatting-class | GPT-4, Claude Sonnet, Gemini Pro | HOW to change (correct syntax) |

### Architect Output Format

```yaml
changes:
  - file: src/auth/session.ts
    rationale: "Session validation missing expiry check"
    action: modify
    description: "Add JWT expiry validation before session creation"
    affected_functions: [createSession, validateToken]
  - file: src/auth/session.test.ts
    rationale: "Test coverage for new expiry validation"
    action: create
    description: "Add test cases for expired, valid, and missing tokens"
```

## Instructions

### Implementing Dual Pass

1. **Architect Pass**: Send problem description + repo map to reasoning model. Ask for structured plan (YAML/JSON) — what files to change, why, and what the change should accomplish. No code in this pass.
2. **Editor Pass**: Send the architect's plan + actual file contents to formatting model. Ask for concrete code diffs. Validate output through linter gate.
3. **Verification**: Compare generated code against architect's intent. If drift detected, re-run editor pass with clarified instructions.

### Cost Savings

```
Traditional single-pass (Opus for everything): $0.075/1K tokens
Dual pass (Opus architect + Sonnet editor):     $0.018/1K tokens average
Savings: 76% cost reduction with same or better quality
```

## Output Format

- Architect Plan Document
- Editor Code Diffs
- Cost Comparison Report
- Intent Drift Analysis
