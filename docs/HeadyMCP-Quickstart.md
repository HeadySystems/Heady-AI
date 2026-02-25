<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# HeadyMCP — API Quickstart Guide

**Heady Systems, Inc.** | [headymcp.com](https://headymcp.com) | [headysystems.com](https://headysystems.com)

---

## What is HeadyMCP?

HeadyMCP is a **Model Context Protocol (MCP)** gateway that unifies 30+ AI services into a single, standardized interface. It provides tool-based access to AI chat, code analysis, embeddings, research, deployment orchestration, and more — all routed through Heady's branded infrastructure.

### Architecture

```
Client (IDE / Agent / API)
    │
    ▼
HeadyMCP Server (stdio/HTTP)
    │
    ▼
HeadyManager (orchestration layer)
    ├── HeadyBrain — AI chat, analysis, embeddings
    ├── HeadyLens — GPU-accelerated visual monitoring
    ├── HeadyCoder — Multi-model code generation ensemble
    ├── HeadyBuddy — Personal AI assistant
    ├── HCFP — Auto-success engine
    └── 25+ additional Heady services
    │
    ▼
Cloudflare (CDN, DNS, Workers, WAF)
```

---

## Authentication

All API requests require a Bearer token:

```
Authorization: Bearer <YOUR_HEADY_API_KEY>
```

Include these headers on every request:

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <YOUR_HEADY_API_KEY>",
  "X-Heady-Source": "heady-ide-mcp",
  "X-Heady-Version": "1.0.0"
}
```

---

## Base URLs

| Service | URL |
|---------|-----|
| **HeadyManager** (primary gateway) | `https://manager.headysystems.com` |
| **HeadyBrain** (AI services) | `https://manager.headysystems.com/api/brain` |
| **HeadyMCP Hub** | `https://headymcp.com` |
| **HeadyBuddy** | `https://headybuddy.org` |

---

## Quick Start — 5 API Calls

### 1. Health Check

```bash
curl -s https://manager.headysystems.com/api/health \
  -H "Authorization: Bearer $HEADY_API_KEY" | jq
```

**Response:**

```json
{
  "status": "operational",
  "uptime": 57600,
  "services": 31,
  "hcfp_mode": "full-auto",
  "version": "3.3.0"
}
```

### 2. AI Chat (HeadyBrain)

```bash
curl -s -X POST https://manager.headysystems.com/api/brain/chat \
  -H "Authorization: Bearer $HEADY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Explain the MCP protocol in 2 sentences",
    "model": "heady-brain",
    "temperature": 0.7,
    "max_tokens": 256
  }' | jq
```

**Response:**

```json
{
  "ok": true,
  "response": "The Model Context Protocol (MCP) is an open standard...",
  "model": "heady-brain",
  "source": "heady-brain",
  "stored_in_memory": true
}
```

### 3. Code Analysis

```bash
curl -s -X POST https://manager.headysystems.com/api/brain/analyze \
  -H "Authorization: Bearer $HEADY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "function add(a, b) { return a + b; }",
    "type": "code",
    "language": "javascript",
    "focus": "security"
  }' | jq
```

### 4. Generate Embeddings

```bash
curl -s -X POST https://manager.headysystems.com/api/brain/embed \
  -H "Authorization: Bearer $HEADY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Cloudflare startup program evaluation",
    "model": "nomic-embed-text"
  }' | jq
```

### 5. Search Knowledge Base

```bash
curl -s -X POST https://manager.headysystems.com/api/brain/search \
  -H "Authorization: Bearer $HEADY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "deployment architecture",
    "scope": "all",
    "limit": 5
  }' | jq
```

---

## MCP Protocol Integration

HeadyMCP implements the **Model Context Protocol v1.26.0** standard. The HeadyAI-IDE gateway connects any MCP-compatible client (HeadyAI-IDE, VS Code, etc.) to the full Heady service mesh:

```json
{
  "mcpServers": {
    "heady-local": {
      "command": "node",
      "args": ["heady-mcp-server.js"],
      "env": {
        "HEADY_API_KEY": "<YOUR_KEY>",
        "HEADY_MANAGER_URL": "https://manager.headysystems.com",
        "HEADY_BRAIN_URL": "https://headyio.com"
      }
    }
  }
}
```

### All 30 MCP Tools

| Tool | Description |
|------|-------------|
| `heady_chat` | AI chat — routes 100% through HeadyBrain |
| `heady_complete` | Code/text completion |
| `heady_analyze` | Code analysis (security, performance, architecture) |
| `heady_embed` | Vector embeddings for semantic search |
| `heady_search` | Knowledge base and service catalog search |
| `heady_refactor` | Code refactoring suggestions |
| `heady_deploy` | Trigger deployments and service actions |
| `heady_health` | Service health monitoring |
| `heady_jules_task` | Dispatch async background coding tasks |
| `heady_perplexity_research` | Real-time web research |
| `heady_huggingface_model` | HuggingFace model search/inference |
| `heady_soul` | HeadySoul — intelligence & consciousness layer |
| `heady_hcfp_status` | HCFP auto-success engine metrics |
| `heady_orchestrator` | Trinity communication & wavelength alignment |
| `heady_battle` | **HeadyBattle Arena** — multi-node competitive eval + leaderboard |
| `heady_patterns` | Design pattern detection & analysis |
| `heady_risks` | Security scanning & risk mitigation |
| `heady_coder` | Multi-assistant code generation ensemble |
| `heady_claude` | HeadyClaude — deep reasoning (Claude Opus 4.6) |
| `heady_openai` | HeadyOpenAI — GPT chat & completion |
| `heady_gemini` | HeadyGemini — multimodal generation |
| `heady_groq` | HeadyGroq — ultra-fast inference |
| `heady_codex` | HeadyCodex — agentic code generation |
| `heady_copilot` | HeadyCopilot — inline suggestions |
| `heady_ops` | HeadyOps — deployment & infrastructure |
| `heady_maid` | HeadyMaid — cleanup & scheduling |
| `heady_maintenance` | HeadyMaintenance — health monitoring & backups |
| `heady_lens` | HeadyLens — GPU-accelerated visual analysis |
| `heady_vinci` | HeadyVinci — pattern learning & prediction |
| `heady_buddy` | HeadyBuddy — personal AI assistant |

### HeadyBattle Arena Mode ✦

Pit 7 AI nodes against each other on the same task:

```bash
curl -s -X POST https://manager.headysystems.com/api/battle/arena \
  -H "Authorization: Bearer $HEADY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"task": "Optimize this sorting algorithm", "nodes": ["heady-claude","heady-codex","heady-gemini"]}' | jq
```

---

## Production Domains

| Domain | Purpose |
|--------|---------|
| headysystems.com | Corporate infrastructure |
| headyio.com | AI brain and umbrella |
| headybuddy.org | Personal AI assistant |
| headyconnection.org | Social-impact hub |
| headymcp.com | Developer and MCP hub |
| **headyme.com** | **Admin portal, subscriptions & monitoring** |

All domains route through **Cloudflare** for DNS, CDN, and security.

---

## Subscription Plans

| Plan | Price | Features |
|------|-------|----------|
| **Free** | $0/forever | 10 AI searches/day, Sacred Geometry new-tab, basic HeadyBuddy |
| **Pro** | $9.99/mo | Unlimited search, priority HeadyBrain, HeadyBattle analysis, search sync |
| **Enterprise** | Custom | Team management, API access, custom branding, SLA, self-hosted |

Manage subscriptions and monitor all Heady apps at **[headyme.com](https://headyme.com)**.

---

## Rate Limits & Policies

- **Default**: 100 requests/minute per API key
- **Brain API**: 30 requests/minute (AI inference)
- **Embeddings**: 60 requests/minute
- **Circuit breaker**: 5 failures → 60s recovery
- **Retry policy**: 3 retries, exponential backoff (500ms base)

---

## Infrastructure Stack

- **Runtime**: Node.js + Express
- **AI Models**: Heady Brain (proprietary routing), Claude, Gemini, GPT, Groq, Perplexity
- **Vector DB**: Qdrant (semantic search and RAG)
- **CMS**: Drupal 11 (content management)
- **CDN/DNS/WAF**: Cloudflare ← **this is where you come in** ✨
- **Monitoring**: HeadyLens (GPU-accelerated visual analysis)
- **Memory**: Persistent disk-backed + vector storage

---

## Contact

**Heady Systems, Inc.**

- Web: [headysystems.com](https://headysystems.com)
- MCP Hub: [headymcp.com](https://headymcp.com)
- Email: See attached correspondence

---

*Generated by HeadyMCP v2.0.0 — HeadyAI-IDE ✦ Sacred Geometry · Ensemble Intelligence · 30 Services*
