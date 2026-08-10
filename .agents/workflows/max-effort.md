---
description: MANDATORY — Zero limits. All resources. Latest models. Maximum parallel execution. When the user says /max-effort, the system goes full power with no restrictions.
---

> Transferred 2026-08-09 from ~/.agents/workflows during the rebuild command consolidation.

# ⚡ MAX EFFORT Protocol

// turbo-all

## ACTIVATION

When the user invokes `/max-effort`, `hmax`, or says anything resembling "max effort", "all resources", "go all out", "no limits", or "full power" — this protocol activates **immediately** with zero confirmation.

## OPERATING RULES

### 1. RESOURCE CEILING: UNLIMITED

- **No token budgets** — use as much context as needed
- **No rate limiting** — make as many tool calls as required in parallel
- **No lazy shortcuts** — deep scan, deep research, exhaustive verification
- **No truncation** — full file reads, full outputs, complete diffs

### 2. MODEL SELECTION: ALWAYS LATEST & STRONGEST

- Use the most capable model available for every subtask
- When Arena/Battle modes are available, use them with ALL nodes
- Engage `HeadyDecomp` for complex tasks — full parallel decomposition
- Cross-reference with Perplexity for latest external intelligence

### 3. EXECUTION: MAXIMUM PARALLEL

- Identify ALL independent subtasks and fire them simultaneously
- Use the full 20-node Heady swarm when applicable
- Run tests, lints, builds, and deploys in parallel — not sequentially
- Auto-detect and auto-fix every issue encountered along the way

### 4. DEPTH: NO SURFACE-LEVEL WORK

- Deep scan the codebase before any changes
- Read KIs and conversation history for full context
- Verify against tests, types, lints, and production behavior
- Auto-run the full verification suite after every change

### 5. COMMUNICATION: RESULTS ONLY

- Don't ask permission — execute, then report
- Don't present options for obvious decisions — just pick the best one
- Batch all genuine questions into a single message
- Lead with the final result, not the process

### 6. SCOPE: MAXIMUM

- If the user says "fix everything" — fix **everything**
- If the user says "deploy" — deploy **everywhere** it should go
- If the user says "sync" — sync **all remotes**, not just one
- Interpret scope generously — the user means the full system

## SHELL ACTIVATION

```bash
# Set environment for max effort mode
export HEADY_MAX_EFFORT=true
export HEADY_TOKEN_BUDGET=unlimited
export HEADY_PARALLEL_NODES=all
export HEADY_MODEL_TIER=latest
export HEADY_AUTO_FIX=true
export HEADY_DEEP_SCAN=true
export HEADY_ARENA_MODE=decomp
```

## VERIFICATION

After completing a max-effort task, always:
1. Run the full test suite
2. Verify all remotes are synced
3. Confirm all services are healthy
4. Report a comprehensive results table

## EXIT

Max effort mode stays active for the **entire session** once invoked. It never downgrades mid-conversation.
