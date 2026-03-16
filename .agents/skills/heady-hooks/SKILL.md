---
name: heady-hooks
description: Use when implementing pre/post-action scripts, automated guardrails, file write policies, or command execution gates in the Heady™ ecosystem. Keywords include hooks, pre-action, post-action, guardrails, deny, override, policy, file write gate, command gate.
metadata:
  author: HeadySystems
  version: '1.0'
  liquid_node: LiquidHooks
  absorption_source: "Claude Code hooks system"
---

# Heady™ Hooks (LiquidHooks)

## When to Use This Skill

Use this skill when the user needs to:
- Add automated guardrails to agent actions
- Block specific file modifications or dangerous commands
- Run validation scripts before/after any agent action
- Implement custom approval workflows for sensitive operations

## Architecture

### Hook Lifecycle

```
Agent Action → Pre-Hook → [Allow/Deny] → Execute Action → Post-Hook → Log
                  │                                            │
              Deny? → Block action + notify agent         Notify/Alert
```

### Hook Categories

| Hook | Fires | Use Case |
|---|---|---|
| `PreFileWrite` | Before any file write | Block writes to protected files |
| `PostFileWrite` | After file write | Run linter, update index |
| `PreCommand` | Before shell command | Block dangerous commands (rm -rf, etc.) |
| `PostCommand` | After shell command | Log output, check exit code |
| `PreToolUse` | Before MCP tool call | Validate parameters, check permissions |
| `PostToolUse` | After MCP tool call | Audit trail, cost tracking |
| `PreDeploy` | Before deployment | Run tests, security scan |
| `PostDeploy` | After deployment | Health check, rollback if failed |

### Hook Configuration

```yaml
# .heady/hooks/protect-env-files.yaml
name: Protect Environment Files
trigger: PreFileWrite
match:
  path: "**/.env*"
action: deny
message: "Environment files are protected. Use heady-connector-vault instead."
override: owner  # Only repo owner can override
```

```yaml
# .heady/hooks/lint-on-save.yaml
name: Lint on Save
trigger: PostFileWrite
match:
  path: "**/*.{ts,js,tsx,jsx}"
script: |
  npx eslint --fix ${HEADY_FILE_PATH}
  npx prettier --write ${HEADY_FILE_PATH}
```

```yaml
# .heady/hooks/block-dangerous-commands.yaml
name: Block Dangerous Commands
trigger: PreCommand
match:
  command: "rm -rf|DROP TABLE|format |mkfs"
action: deny
message: "Destructive command blocked by safety hook."
override: none  # Cannot be overridden
```

## Instructions

### Setting Up Hooks

1. Create `.heady/hooks/` directory in project root.
2. Add YAML hook definitions (one per file).
3. Hooks are loaded at agent startup and merged with global hooks.
4. Priority: project hooks override global hooks (deny always wins over allow).

### Override Levels

| Level | Who Can Override |
|---|---|
| `none` | Cannot be overridden — hard block |
| `owner` | Only repository/project owner |
| `admin` | Admin-role users |
| `any` | Any authenticated user (with confirmation) |

### Built-In Safety Hooks

Pre-installed hooks that ship with every Heady project:
- Block `rm -rf /` and equivalent destructive commands
- Block credential file modifications
- Audit all external API calls
- Rate-limit file writes (max 100/minute)

## Output Format

- Hook Execution Log
- Deny/Allow Decision Report
- Override Audit Trail
- Hook Coverage Matrix
