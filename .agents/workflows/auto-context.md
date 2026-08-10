---
description: Dynamically pull architectural rules and context from the central rules-registry.json via the MCP Context Projector
---

> Transferred 2026-08-09 from ~/.agents/workflows during the rebuild command consolidation.

# `/auto-context`

**Purpose**: This workflow forces the AI to dynamically request its architectural rules and context from the central `rules-registry.json` via the MCP Context Projector, eliminating the need for hardcoded `.windsurfrules` files.

**Trigger**: Execute this workflow automatically when entering a new repository, or manually via the `/auto-context` slash command.

---

## Step 1: Detect Environment
- **Action**: Identify your Current Working Directory (CWD).

## Step 2: Invoke Context Projector
- **Action**: Use the `call_mcp_tool` or invoke the `get_project_context` prompt from the `heady-context-projector` MCP Server, passing your CWD as the argument.
- **Goal**: Retrieve the exact ephemeral rules and required skills for the directory you are working in.

## Step 3: Hydrate Working Memory
- **Action**: Read the returned Markdown payload. Do NOT write it to a file. Keep it in your context.
- **Goal**: Immediately apply the mandatory rules (e.g., using `pgvector.ts` or routing through `mcp-client.ts`) to all subsequent code generation tasks in this session.

## Next Steps
If the projection recommends specific skills (e.g., `heady-optimal-blueprint`), use `view_file` to read their `SKILL.md` files before writing any code.
