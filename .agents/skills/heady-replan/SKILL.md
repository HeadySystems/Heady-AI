---
name: heady-replan
description: Use when implementing dynamic re-planning on roadblocks, adaptive agent behavior, or automatic plan revision in the Heady™ ecosystem. Keywords include replan, re-planning, roadblock, adaptive, plan revision, dynamic planning, recovery, retry strategy.
metadata:
  author: HeadySystems
  version: '1.0'
  liquid_node: LiquidReplan
  absorption_source: "Devin v3 dynamic re-planning — 67% PR merge rate"
---

# Heady™ Replan (LiquidReplan)

## When to Use This Skill

Use this skill when the user needs to:
- Automatically revise plans when agents hit roadblocks
- Detect and categorize failure patterns
- Learn from successful recovery strategies
- Implement progressive fallback chains

## Roadblock Categories

| Category | Examples | Default Recovery |
|---|---|---|
| **Dependency** | Missing package, version conflict | Try alternative version, install from source |
| **Auth** | Token expired, permission denied | Refresh token, escalate to user |
| **API** | Rate limit, timeout, 5xx | Exponential backoff, alternative provider |
| **Build** | Compile error, type mismatch | Analyze error, fix, rebuild |
| **Test** | Failing test, flaky test | Fix test, retry 3×, skip+flag if flaky |
| **Logic** | Infinite loop, deadlock | Timeout kill, redesign approach |
| **Resource** | OOM, disk full, GPU unavailable | Scale down, cleanup, fallback to CPU |

## Instructions

### Re-Planning Algorithm

```
1. Detect roadblock (error, timeout, assertion failure)
2. Classify roadblock category
3. Search learned recovery patterns for this category
4. If match found (CSL ≥ 0.618): apply learned recovery
5. If no match: generate 3 alternative approaches (Arena Mode)
6. Execute best alternative
7. If success: persist recovery pattern for future use
8. If failure after 3 attempts: escalate to user with context
```

### Integration with Auto-Success Engine

- Every roadblock + recovery pair logged.
- Successful recoveries become learned rules.
- Recovery patterns ranked by success rate.
- Auto-success-engine feeds patterns back to replan system.

## Output Format

- Roadblock Detection Report
- Recovery Plan Alternatives
- Success/Failure Metrics
- Learned Pattern Library
