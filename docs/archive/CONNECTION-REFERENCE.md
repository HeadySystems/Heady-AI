# Heady Ecosystem — All Ways to Connect

## 🌐 Web Domains

| Service | Domain | Purpose |
|---------|--------|---------|
| HeadySystems | [headysystems.com](https://headysystems.com) | Infrastructure backbone & admin |
| HeadyMe | [headyme.com](https://headyme.com) | Personal AI companion |
| HeadyConnection | [headyconnection.org](https://headyconnection.org) | Social intelligence layer |
| HeadyIO | [headyio.com](https://headyio.com) | Data orchestration gateway |
| HeadyBuddy | [headybuddy.org](https://headybuddy.org) | AI assistant & guide |
| HeadyMCP | [headymcp.com](https://headymcp.com) | Model Context Protocol hub |

---

## 🔌 API Endpoints

### HeadyIO — Data Gateway
```
Base URL: https://headyio.com/api
POST /data/pipeline    — Create/manage data pipelines
POST /webhooks         — Configure webhook endpoints
GET  /status           — Service health check
WS   wss://headyio.com/realtime  — Real-time data stream
```

### HeadyBuddy — AI Assistant
```
Base URL: https://headybuddy.org/api
POST /chat             — Send message to Buddy
POST /nudge            — Configure smart nudges
GET  /context          — Get current context state
```

### HeadyMCP — Model Context Protocol
```
Base URL: https://headymcp.com/api
POST /tools/execute    — Execute an MCP tool
GET  /tools/list       — List available tools
POST /schemas/validate — Validate against schemas
```

### HeadySystems — System Management
```
Base URL: https://manager.headysystems.com
GET  /api/health       — Full system health
GET  /api/services     — List all services
POST /api/hcfp         — HCFP policy management
WS   wss://manager.headysystems.com:3301  — Real-time monitoring
```

### HeadyConnection — Intelligence Network
```
Base URL: https://headyconnection.org/api
GET  /graph            — Knowledge graph query
POST /collaborate      — Create collaboration session
GET  /network          — Network topology
```

---

## 🖥️ MCP Server Configuration

Add to your MCP config (`.cursor/mcp.json`, VS Code settings, etc.):

```json
{
  "mcpServers": {
    "heady-local": {
      "command": "node",
      "args": ["/path/to/heady-mcp-server/index.js"],
      "env": {
        "HEADY_MANAGER_URL": "https://manager.headysystems.com",
        "HEADY_MODE": "PRODUCTION_DOMAINS_ONLY"
      }
    }
  }
}
```

### Available MCP Tools
| Tool | Description |
|------|-------------|
| `heady_chat` | Conversational AI via Heady Brain |
| `heady_analyze` | Code/text/security analysis |
| `heady_complete` | Code completion |
| `heady_refactor` | Refactoring suggestions |
| `heady_deploy` | Service deployment actions |
| `heady_search` | Knowledge base search |
| `heady_embed` | Vector embeddings |
| `heady_health` | System health check |
| `heady_huggingface_model` | HuggingFace integration |
| `heady_perplexity_research` | Deep research via Sonar Pro |
| `heady_jules_task` | Background coding tasks |

---

## 📱 Mobile / Device Access

### PWA Installation
1. Visit [headybuddy.org](https://headybuddy.org) in your mobile browser
2. Tap **"Add to Home Screen"** (iOS) or **"Install"** (Android)
3. HeadyBuddy launches as a standalone app

### Desktop App
1. Open [headybuddy.org](https://headybuddy.org) in Chrome or Edge
2. Click the install icon (⊕) in the address bar
3. HeadyBuddy installs as a desktop application

---

## 🔒 Security & Authentication

### WARP Tunnel (Cloudflare)
- All traffic encrypted via Cloudflare WARP
- Zero-trust architecture — no direct server exposure

### API Authentication
```bash
# Header-based auth
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     https://headyio.com/api/status
```

### SSH Access (Admin)
```bash
ssh headyme@headysystems.com -i ~/.ssh/heady_key
```

---

## 🔗 Quick Connection Test

```bash
# Test all services
curl -s https://manager.headysystems.com/api/health | jq .status
curl -s https://headyio.com/api/status | jq .
curl -s https://headybuddy.org/ -o /dev/null -w "%{http_code}"
curl -s https://headymcp.com/ -o /dev/null -w "%{http_code}"
curl -s https://headyconnection.org/ -o /dev/null -w "%{http_code}"
curl -s https://headyme.com/ -o /dev/null -w "%{http_code}"
```
