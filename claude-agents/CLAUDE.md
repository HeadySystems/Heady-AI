# Heady™ Agent System — Claude Integration

## Overview

The Heady™ Agent System provides 4 specialized Claude agents backed by 47 MCP tools, 6 skills, and persistent vector memory. Each agent is an autonomous specialist that connects to the HeadyMCP server.

## Setup

### 1. Start HeadyMCP Server

```bash
# From repo root
./scripts/heady-start.sh stdio   # For Claude Desktop/Code
./scripts/heady-start.sh http    # For web clients (port 3310)
```

### 2. Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "heady": {
      "command": "node",
      "args": ["/absolute/path/to/services/heady-mcp-server/src/index.js"],
      "env": {
        "HEADY_MCP_TRANSPORT": "stdio",
        "HEADY_SERVICE_HOST": "localhost"
      }
    }
  }
}
```

### 3. Configure Claude Code

```bash
claude mcp add heady -- node /absolute/path/to/services/heady-mcp-server/src/index.js
```

Or add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "heady": {
      "command": "node",
      "args": ["services/heady-mcp-server/src/index.js"],
      "env": { "HEADY_MCP_TRANSPORT": "stdio" }
    }
  }
}
```

### 4. Configure Cursor

Add to Cursor MCP settings:

```json
{
  "mcpServers": {
    "heady": {
      "command": "node",
      "args": ["services/heady-mcp-server/src/index.js"],
      "env": { "HEADY_MCP_TRANSPORT": "stdio" }
    }
  }
}
```

## Agents

### Heady Brain (Default)
The central cognitive engine with access to all 47 tools. Use for any general task.

**Activate:** Start a conversation with the HeadyMCP server connected. All tools are available automatically.

**Example prompts:**
- "Scan this project and analyze the architecture"
- "Generate a REST API with battle-tested code"
- "What do you know about our authentication system?"

### Heady Researcher
Autonomous research agent. Searches memory, indexes sources, cross-references with multiple AI models, and stores findings.

**Example prompts:**
- "Research how our vector memory system works"
- "Find all documentation about the CSL engine"
- "Investigate performance patterns across our services"

### Heady DevOps
Platform operations agent. Monitors health, deploys code, runs maintenance, responds to incidents.

**Example prompts:**
- "Check the health of all services"
- "Deploy heady-brain v5.1 with canary rollout"
- "Run cleanup on stale sessions and old logs"

### Heady Content
Content management agent for all 9 websites. Creates, publishes, and maintains content via Drupal.

**Example prompts:**
- "Write a blog post about Heady v5.0 for headysystems.com"
- "Publish documentation about the MCP tools to headyos.com"
- "Search all sites for content about phi-scaled architecture"

## Skills

Skills are installed into your Claude environment and automatically trigger based on your prompts:

| Install Path | Triggers |
|-------------|----------|
| `claude-skills/heady-intelligence/` | analyze, scan, risks, patterns |
| `claude-skills/heady-memory/` | remember, recall, search knowledge |
| `claude-skills/heady-orchestrator/` | pipeline, orchestrate, automate |
| `claude-skills/heady-coder/` | write code, build, implement |
| `claude-skills/heady-ops/` | deploy, health, monitor, ops |
| `claude-skills/heady-cms/` | publish, content, article, CMS |

## Tool Discovery

Once connected, you can discover all available tools:
- **In conversation:** Ask "What Heady tools are available?"
- **Via HTTP:** `GET http://localhost:3310/tools`
- **Via MCP:** Send `tools/list` method

## Architecture

```
Claude Desktop / Code / Cursor
  └── HeadyMCP Server (stdio or HTTP)
       └── 47 MCP Tools
            ├── Intelligence (Brain, Soul, Vinci)
            ├── Memory (Vector Store, Embeddings)
            ├── Orchestration (HCFP, Conductor)
            ├── Execution (Coder, Battle, Buddy)
            ├── Security (Guard, Auth)
            ├── Multi-Model (Claude, GPT, Gemini, Groq)
            ├── Operations (Deploy, Health, Maid)
            └── CMS (Drupal × 9 sites)
```
