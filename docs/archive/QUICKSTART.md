<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# Heady Quickstart Guide

> **Updated: February 22, 2026** — Reflects HeadyLens monitoring, LLM Gateway (52 models), /v1/create creative service, Notion sync, and auto-ASAP policy.

---

## 1. Launch Everything (One Click)

Double-click **Heady Launcher** on your Desktop, or from a terminal:

```bash
~/CascadeProjects/heady-launcher.sh
```

This will:

- ✅ Install all dependencies
- ✅ Build production bundles (HeadyWeb, HeadyAI-IDE, HeadyBuddy)
- ✅ Start Heady Manager (port 3301) and HeadyBuddy server (port 4800)
- ✅ Verify the Cloudflare edge proxy is running
- ✅ Install the desktop launcher icon

**Other launcher commands:**

```bash
./heady-launcher.sh --status    # Dashboard: local + edge + CDN status
./heady-launcher.sh --update    # Rebuild only changed components
./heady-launcher.sh --stop      # Stop local services
```

---

## 2. HeadyBuddy — Your AI Assistant

**What it is:** A multi-provider AI chat assistant with persistent memory, skills, and task scheduling.

### Run it locally

```bash
cd ~/CascadeProjects/HeadyBuddy

# Dev mode (hot-reload frontend + server)
npm run dev:all

# Or just the server (production)
npm start
```

### Access it

| Mode | URL |
|---|---|
| Local dev | <https://api.headysystems.com> (frontend) + <https://api.headysystems.com> (API) |
| Production | <https://buddy.headysystems.com> |

### Use it

1. Open HeadyBuddy in your browser
2. Pick a provider from the dropdown: **Heady Brain**, **Gemini**, or **Claude**
3. Type a message and hit Send
4. HeadyBuddy remembers your conversations — come back later and the context is still there

**Key features:**

- **Multi-provider chat** — Switch between Gemini 3.1 Pro, Claude Opus, and Heady Brain mid-conversation
- **Persistent memory** — Conversations survive restarts (SQLite-backed)
- **Skills system** — Extensible capabilities HeadyBuddy can learn
- **Scheduled tasks** — Set recurring AI tasks
- **Fallback chain** — If one provider is down, it automatically falls back to the next

### API usage (for scripts/integrations)

```bash
# Chat with HeadyBuddy's API
curl -X POST https://api.headysystems.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What can you do?", "provider": "heady-brain"}'
```

---

## 3. HeadyWeb — The Heady Browser/Search Engine

**What it is:** A Chromium-style new-tab page with AI-powered search, Firebase auth, and Stripe payments.

### Run it locally

```bash
cd ~/CascadeProjects/HeadyWeb
npm run dev        # Dev server at https://api.headysystems.com
```

### Access it

| Mode | URL |
|---|---|
| Local dev | <https://api.headysystems.com> |
| Production | <https://headysystems.com> |
| Cloudflare Pages | <https://master.headyweb.pages.dev> |

### Use it

1. Open HeadyWeb — you'll see the new-tab page
2. **Search** — Type anything in the search bar. It queries the Heady knowledge base first, then falls back to AI
3. **AI Sidebar** — Click the purple 🧠 button to chat with Heady Brain
4. **Sign In** — Click the user icon for Google or email authentication
5. **Pricing** — Click the pricing button to see subscription plans

---

## 4. HeadyAI-IDE — AI Code Editor

**What it is:** A Monaco-powered code editor with AI assistance for code generation, explanation, and optimization.

### Run it locally

```bash
cd ~/CascadeProjects/HeadyAI-IDE
npm run dev        # Dev server at https://api.headysystems.com
```

### Access it

| Mode | URL |
|---|---|
| Local dev | <https://api.headysystems.com> |
| Production | Accessed through HeadyMCP tools |

### Use it

1. Open HeadyAI-IDE in your browser
2. Write or paste code in the Monaco editor
3. Use the AI toolbar buttons:
   - **✨ Generate** — AI generates code from a prompt
   - **🧠 Explain** — AI explains the selected code
   - **⚡ Optimize** — AI suggests performance improvements
4. The status bar at the bottom shows live connection to Heady Brain

---

## 5. Heady Manager — The Origin API Server

**What it is:** The central API server powering all Heady services. Runs locally on port 3301.

### Run it

```bash
cd ~/Heady
node heady-manager.js    # Starts on port 3301
```

### Key endpoints

```bash
# Health check
curl https://api.headysystems.com/api/health

# System status
curl https://api.headysystems.com/api/system/status

# Edge proxy status
curl https://api.headysystems.com/api/edge/status

# AI chat (via Brain API)
curl -X POST https://api.headysystems.com/api/brain/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from curl"}'

# Service pulse
curl https://api.headysystems.com/api/pulse
```

---

## 6. Edge Proxy — Cloudflare Intelligence Layer

**What it is:** A Cloudflare Worker that sits in front of ALL Heady services. It handles AI caching, mesh routing, CDN delivery, monitoring, multimodal creative generation, and Notion sync.

**You don't need to do anything** — it's always running at Cloudflare's edge. All client apps are already wired to use it.

### Check it

```bash
# Health
curl https://headysystems.com/v1/health

# Full service status
curl https://headysystems.com/v1/services -H "X-Heady-API-Key: heady_api_key_001"

# HeadyLens monitoring metrics
curl https://headysystems.com/v1/lens -H "X-Heady-API-Key: heady_api_key_001"

# Available model groups (35 LLM models across 5 groups)
curl https://headysystems.com/v1/models -H "X-Heady-API-Key: heady_api_key_001"

# HeadyMemory activity report (syncs to Notion)
curl https://headysystems.com/v1/memory -H "X-Heady-API-Key: heady_api_key_001"

# Creative generation capabilities (17 models, 5 output types)
curl https://headysystems.com/v1/create -H "X-Heady-API-Key: heady_api_key_001"
```

### API Endpoints (9 total)

| Endpoint | Purpose |
|----------|--------|
| `/v1/health` | System health check |
| `/v1/services` | Service groups, scaling, health |
| `/v1/lens` | HeadyLens monitoring metrics (p50/p95/p99) |
| `/v1/models` | 35 LLM models across 5 capability groups |
| `/v1/stream` | Real-time SSE event streaming |
| `/v1/sandbox` | Agent code execution (Colab GPU) |
| `/v1/forge` | Schema auto-generation from natural language |
| `/v1/create` | Multimodal creative generation (Sora, FLUX, DALL-E) |
| `/v1/memory` | HeadyMemory activity report + Notion sync |
| `/v1/auto-success` | Background task queue |
| `/v1/integrations` | 8 integration patterns status |

### Model Groups

| Group | Alias | Models | Use Case |
|-------|-------|--------|----------|
| fast | `heady-fast` | 7 | Chat, autocomplete, quick tasks |
| reasoning | `heady-think` | 8 | Deep analysis, chain-of-thought, full-repo reasoning |
| creative | `heady-create` | 6 | Content generation, storytelling |
| code | `heady-code` | 8 | Code gen, debugging, refactoring (HeadyJules/Copilot/Codex) |
| vision | `heady-vision` | 6 | Image analysis, OCR, multimodal |

### Creative Service (`/v1/create`)

| Output | Models | Input Types |
|--------|--------|------------|
| 🖼 Image | DALL-E 3, FLUX.1, SDXL, Imagen 3 | text, text+image, image+mask |
| 🎬 Video | Sora, Runway Gen-3, Pika, CogVideoX | text, text+image, image-to-video |
| ✨ Animation | Runway Turbo, SVD, Pika | image, image+prompt, sketch+prompt |
| 🧊 3D | Point-E, Shap-E, Luma Genie | text, image, multi-image |
| 🎵 Audio | MusicGen, Bark, MusicFX | text, text+style, humming |

### What it does automatically

- **AI requests** → Fingerprinted, cached in KV, routed through 35 LLM models
- **Static assets** → JS/CSS/fonts cached 1 year at 300+ PoPs worldwide
- **Monitoring** → HeadyLens records latency, errors, baselines for all requests
- **Notion sync** → Activity reports pushed to System Status & Updates page
- **Task promotion** → Auto-ASAP policy: beneficial tasks never deferred

---

## 7. MCP Tools (for IDE integration)

Use Heady's MCP tools directly from your IDE:

```bash
# In your IDE, these tools are available:
heady_chat       # Chat with Heady Brain
heady_analyze    # Analyze code or text
heady_search     # Search the knowledge base
heady_deploy     # Deploy services
heady_health     # Check system health
heady_battle     # Arena mode — pit AI nodes against each other
```

---

## Architecture at a Glance

```
┌─ LOCAL (your machine) ───────────────────────────────────────────────┐
│  Heady Manager (:3301)    HeadyBuddy Server (:4800)          │
│  HeadyWeb (Vite dev)      HeadyAI-IDE (Vite dev)             │
└────────────────────┬──────────────────────────────────────────────┘
                     │ All traffic
                     ▼
┌─ EDGE (Cloudflare Workers) ───────────────────────────────────────┐
│  HeadyLens Monitoring → 5 Model Groups (35 LLM models)       │
│  /v1/create (17 creative models: Sora, FLUX, DALL-E)        │
│  /v1/memory (Notion sync) → /v1/lens → /v1/forge            │
│  CDN → AI Mesh Router → Auto-ASAP Task Queue                │
└────────────────────┬───────────┬──────────────────────────┘
                     │ Primary   │ Creative
                     ▼           ▼
┌─ CLOUD (AI Providers) ─────────────────────────────────────────┐
│  Claude 4 │ Gemini 2.5 Pro │ GPT-4o │ Groq │ xAI Grok 3     │
│  Sora │ FLUX.1 │ DALL-E 3 │ Runway Gen-3 │ MusicGen       │
│  DeepSeek-R1 │ Qwen3-Coder │ Kimi-Dev │ HuggingFace    │
└───────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm install` fails | Make sure Node.js >= 18: `node -v` |
| Port 3301 in use | `lsof -i :3301` then `kill <PID>` |
| Port 4800 in use | `lsof -i :4800` then `kill <PID>` |
| Edge proxy unreachable | Run: `./heady-launcher.sh --status` to diagnose |
| HeadyBuddy shows no providers | Check `~/CascadeProjects/HeadyBuddy/.env` has API keys |
| Build fails | Check logs: `~/CascadeProjects/logs/<app>-build.log` |

---

*Heady Systems — 52 Models · 9 Endpoints · 7 Domains · Local Speed · Edge Intelligence · Cloud Scale*
