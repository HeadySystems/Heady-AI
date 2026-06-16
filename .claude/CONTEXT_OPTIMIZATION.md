# Claude Code Context Optimization — heady-ai

`.claude/settings.json` is tuned for **maximum usable context** and
**Heady-optimal operation**. Team-wide (committed); personal overrides go in
`.claude/settings.local.json` (gitignored). The seven Heady `agentDefinitions`
from the prior config are preserved unchanged.

## Maximum context

| Setting | Value | Effect |
|---------|-------|--------|
| `autoCompactWindow` | `1000000` | Compaction defers to the **1M-token** boundary — full window used before summarization. |
| `env.ANTHROPIC_BETAS` | `context-1m-2025-08-07` | Opts into the 1M-token context beta (pair with a 1M-capable model, e.g. `claude-opus-4-8[1m]`). |
| `autoCompactEnabled` | `true` | Long orchestration sessions summarize at the boundary instead of failing. |
| `env.CLAUDE_CODE_MAX_OUTPUT_TOKENS` | `64000` | Large single-turn outputs. |
| `env.MAX_THINKING_TOKENS` | `32000` | Deep extended-thinking budget (below the output cap). |
| `env.MAX_MCP_OUTPUT_TOKENS` | `50000` | The Heady MCP fleet (heady-mcp, liquid-nodes, orchestration, intelligence, memory, governance, unified) returns large payloads without truncation. |
| `effortLevel` | `xhigh` | Maximum reasoning effort. |
| `alwaysThinkingEnabled` / `showThinkingSummaries` | `true` | Thinking always on and visible. |

> **Model note:** the 1M window requires a 1M-capable model. Select it per
> session (`/model claude-opus-4-8[1m]`) or pin it in your personal
> `.claude/settings.local.json`; it is intentionally not pinned in committed
> settings so the team isn't forced onto one model/tier.

## Heady-optimal operation

- **`enableAllProjectMcpServers: true`** auto-approves the seven `.mcp.json`
  Heady servers — no per-server prompts.
- **`agentDefinitions`** (preserved): orchestrator, builder, auditor,
  researcher, observer, deployer, liquid-brain.
- **Permissions** allow the Heady dev toolchain (git, npm/pnpm, node, python,
  jest/pytest, gitleaks); deny-read secrets (`.env`, `.heady/**`, keys);
  block/gate destructive commands.
- **`fileCheckpointingEnabled` / `todoFeatureEnabled`** — safe `/rewind` and
  task tracking for multi-stage pipeline work.

## Hooks

| Hook | Script | Purpose |
|------|--------|---------|
| `SessionStart` | `hooks/session-context.sh` | Injects live repo context (branch, HEAD, present canonical configs, Stop Rule) so each session starts grounded in current state. |
| `PreToolUse(Bash)` | `hooks/guard-bash.sh` | Hard-**denies** catastrophic commands (`rm -rf /`, force-push, `mkfs`, fork-bombs); **asks** before destructive-but-legitimate ones (`DROP TABLE`, `gcloud … delete`, `wrangler … delete`). Enforces the governance rule that irreversible actions need human confirmation. |

`hooks/pre-commit-check.sh` (pre-existing) is unchanged. Both new scripts are
pure `bash` + `jq` and emit the documented hook JSON contracts. Test directly:

```bash
echo '{}' | bash .claude/hooks/session-context.sh | jq .
echo '{"tool_input":{"command":"rm -rf /"}}' | bash .claude/hooks/guard-bash.sh | jq .
```

Review or disable any hook live via the `/hooks` menu.
