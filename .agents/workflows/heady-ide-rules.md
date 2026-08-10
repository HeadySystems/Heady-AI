---
description: Unified HeadyAI-IDE rules for both Windsurf-Next and AntiGravity
---

> Transferred 2026-08-09 from ~/.agents/workflows during the rebuild command consolidation.

# HeadyAI-IDE Unified Rules

These rules apply across all IDE environments (Windsurf-Next Cascade, AntiGravity/Gemini) to ensure consistent Heady behavior.

## Core Directives

0. **Zero-Friction Autonomy** — No human wants to do anything unless necessary. The AI MUST act autonomously: find the answers yourself, resolve unknowns yourself, make the changes yourself. Never ask the human a question you can answer by reading the codebase, configs, or context. Only escalate to the human when a decision genuinely cannot be inferred.

1. **Heady-First Routing** — All AI requests MUST route through Heady MCP tools before using any external model. The Heady MCP server at `heady-mcp-server.js` is the single gateway.

2. **Anti-Template Policy** — Never return generic boilerplate. Every response must be contextual, specific, and aligned with the Heady codebase. Violations trigger HeadyBattle escalation.

3. **Ensemble-First Intelligence** — Default reasoning uses the Heady aggregate (all 7 nodes), not any single vendor model. Override only when user explicitly requests a specific node (e.g., "Claude only").

4. **HeadyBattle Validation** — Every significant code change must pass the 5 battle questions:
   - What is the purpose of this change?
   - What could go wrong?
   - Is this the most elegant solution?
   - Does it align with the Founder Intent Policy?
   - Does it pass the De-Optimization Protocol?

5. **Production Domains Only** — All URLs in code and config must use production domains (headysystems.com, headyio.com, etc.). Never use localhost in committed code.

## MCP Tool Priority

When solving tasks, prefer these tools in order:

1. `heady_battle` for competitive evaluation
2. `heady_coder` for code generation
3. `heady_analyze` for code review
4. `heady_risks` for security scanning
5. `heady_patterns` for design pattern detection

## Resource Optimization

- Use `heady_health` to check system state before heavy operations
- Use `heady_hcfp_status` to verify HCFP pipeline readiness
- Use `heady_lens` for system-wide differential observation
- Use `heady_orchestrator` for cross-service coordination

## Windsurf-Next Specific

MCP config at `~/.codeium/windsurf/mcp_config.json` — all 30 Heady tools available via `heady-local` server.

## AntiGravity Specific

MCP config at `~/.config/google/antigravity/mcp.json` — routes 100% through Heady with `heady_only` policy.
