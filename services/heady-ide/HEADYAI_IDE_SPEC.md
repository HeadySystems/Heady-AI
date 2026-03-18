# HeadyAI-IDE — Architecture & Build Specification v1.0

> **Codename:** Singularity
> **Version:** 1.0.0
> **Standalone:** `heady-ai.com/ide`
> **Embedded:** `headyme.com` via `<heady-ide>` web component
> **Backend:** Cloud Run (`ide.heady-ai.com`)
> **Storage:** Cloudflare R2 (workspace files) + Neon Postgres (state)
> **Patent:** HS-2026-051, HS-2026-054, HS-2026-060
> © 2026 HeadySystems Inc. — Eric Haywood, Founder

---

## §1 — What HeadyAI-IDE Replaces

| Capability | IDX / Antigravity | Windsurf-Next | **HeadyAI-IDE** |
|------------|-------------------|---------------|-----------------|
| Runtime | Nix VM (Google Cloud) | Electron (local) | **CF Pages + Cloud Run (zero install)** |
| Editor | VS Code Server | VS Code fork | **Monaco Editor (browser-native)** |
| AI Models | Gemini only | GPT-4 / Claude via Cascade | **8 providers, φ-routed SmartRouter** |
| Multi-Model | ✗ | Arena (2 candidates) | **HeadyBattle (N candidates, squash merge)** |
| Agents | Gemini Code Assist | Cascade Flows | **21 swarms · 150 bee types · CfC neurons** |
| Background Autonomy | ✗ | ✗ | **Living System Loop — 15 autonomous tasks** |
| Pipeline Visibility | ✗ | ✗ | **22-stage HCFullPipeline real-time viz** |
| Memory | Session only | Session only | **3-tier persistent (Redis → pgvector → Qdrant)** |
| MCP Tools | Limited | ✗ | **31+ MCP tools · A2A · AG-UI** |
| Self-Improving | ✗ | ✗ | **Alchemist swarm weekly evolution** |
| Access | Browser | Desktop app | **Any browser + HeadyWeb embed** |
| Terminal | Cloud VM | Local shell | **Cloud container via xterm.js + node-pty** |
| Cost | Free (capped) | $15/mo | **Included in Heady platform** |

---

## §2 — Dual-Access Architecture

```
                      ┌──────────────────────────────────┐
                      │        USER DEVICE (any)          │
                      └──────────┬───────────┬────────────┘
                                 │           │
               ┌─────────────────▼───┐  ┌────▼──────────────────┐
               │  heady-ai.com/ide   │  │  headyme.com (app)    │
               │  (standalone URL)   │  │  <heady-ide> embed    │
               │  CF Pages           │  │  via web component    │
               └─────────┬──────────┘  └──────────┬────────────┘
                         │                        │
                         └────────────┬───────────┘
                                      │ (same JS bundle)
                        ┌─────────────▼──────────────┐
                        │     IDE Shell (client)      │
                        │  Monaco + xterm.js + panels │
                        │  Sacred Geometry Theme      │
                        └─────────────┬──────────────┘
                                      │ WS + REST
                        ┌─────────────▼──────────────┐
                        │  ide.heady-ai.com           │
                        │  (Cloud Run backend)        │
                        │  ┌────────────────────────┐ │
                        │  │ Workspace Manager      │ │
                        │  │ R2 filesystem + Git    │ │
                        │  ├────────────────────────┤ │
                        │  │ Terminal Server         │ │
                        │  │ node-pty over WS       │ │
                        │  ├────────────────────────┤ │
                        │  │ LSP Proxy              │ │
                        │  │ TS/JS/Python/Rust      │ │
                        │  ├────────────────────────┤ │
                        │  │ HeadyBattle Engine     │ │
                        │  │ N-candidate tournament │ │
                        │  ├────────────────────────┤ │
                        │  │ HCFullPipeline         │ │
                        │  │ 22-stage processor     │ │
                        │  └────────────────────────┘ │
                        └─────────────┬──────────────┘
                                      │
              ┌───────────┬───────────┼───────────┬───────────┐
              │           │           │           │           │
         ┌────▼───┐  ┌───▼────┐ ┌────▼───┐ ┌────▼───┐ ┌────▼───┐
         │Upstash │  │ Neon   │ │Qdrant  │ │  R2    │ │LLM APIs│
         │Redis   │  │pgvector│ │vectors │ │storage │ │8 provs │
         │T0 mem  │  │T1 mem  │ │T2 mem  │ │files   │ │routed  │
         └────────┘  └────────┘ └────────┘ └────────┘ └────────┘
```

### Access Modes

| Mode | URL | How | Auth |
|------|-----|-----|------|
| **Standalone** | `heady-ai.com/ide` | Direct browser navigation | Firebase Auth SSO |
| **HeadyWeb Embed** | `headyme.com` → IDE tab | `<heady-ide>` web component in dashboard | Shared session cookie |
| **Deep Link** | `heady-ai.com/ide?repo=owner/name&file=path` | URL params auto-clone and open | Firebase Auth SSO |
| **Mobile** | Same URLs | Responsive layout, reduced panels | Firebase Auth SSO |

---

## §3 — IDE Shell Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  ⬡ HeadyAI-IDE    [workspace name]    [branch]    🐝 21/150    │  ← Top Bar
├────────┬─────────────────────────┬───────────────────────────────┤
│        │                         │                               │
│  File  │   Monaco Editor         │   AI Panel                   │
│  Tree  │   (multi-tab, split)    │   ┌─────────────────────┐    │
│        │                         │   │ 💬 Chat / Cascade    │    │
│  R2 FS │   ┌─ tab1 ─┬─ tab2 ─┐  │   │ ⚔️ HeadyBattle      │    │
│  + Git │   │         │        │  │   │ 🔬 Pipeline (22-stg) │    │
│        │   │ code    │ code   │  │   │ 🐝 Swarm Dashboard   │    │
│  ───── │   │         │        │  │   │ 📊 Metrics           │    │
│  Search│   └─────────┴────────┘  │   └─────────────────────┘    │
│  ───── │   ┌──────────────────┐  │                               │
│  MCP   │   │ xterm.js Terminal│  │   Consciousness Viz           │
│  Tools │   │ (multiple tabs)  │  │   (WebGPU sacred geometry     │
│  ───── │   │ bash / zsh       │  │    swarm particle system)     │
│  Git   │   └──────────────────┘  │                               │
│        │                         │                               │
├────────┴─────────────────────────┴───────────────────────────────┤
│  Status: ■ Connected  │ 🐝 5 active bees │ φ⁷ pulse OK │ $0.003 │  ← Status Bar
└──────────────────────────────────────────────────────────────────┘
```

### Panel System

| Panel | Key | Content | Always Visible |
|-------|-----|---------|----------------|
| File Tree | `Ctrl+1` | R2 workspace browser, search, Git status | Yes |
| Editor | — | Monaco with multi-tab, split view, minimap | Yes |
| Terminal | `` Ctrl+` `` | xterm.js tabs (bash/zsh in Cloud Run container) | Collapsible |
| AI Chat | `Ctrl+L` | Conversational AI with all 21 swarms available | Yes |
| HeadyBattle | `Ctrl+B` | N-model tournament with live diff + squash merge | On demand |
| Pipeline | `Ctrl+P` | 22-stage HCFullPipeline real-time progress | On demand |
| Swarm Dashboard | `Ctrl+D` | WebGPU particle viz of active swarms/bees | On demand |
| MCP Tools | `Ctrl+M` | 31+ MCP tool browser with execute buttons | Collapsible |
| Git | `Ctrl+G` | Branch, commit, push, PR creation, diff view | Collapsible |
| Metrics | `Ctrl+K` | Token usage, cost, latency, model performance | On demand |

---

## §4 — HeadyBattle Mode (replaces Windsurf Arena)

HeadyBattle is HeadyAI-IDE's tournament system for code generation. When triggered, N models generate competing solutions. The system evaluates, diffs, and squash-merges the winner.

### Battle Flow

```
User writes prompt or selects code + intent
              │
              ▼
┌─────────────────────────────┐
│  DECOMPOSE (Overmind)       │  Break intent into evaluation criteria
└──────────────┬──────────────┘
               │
     ┌─────────┼─────────┬─────────┬─────────┐
     ▼         ▼         ▼         ▼         ▼
  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
  │Claude│ │GPT-4o│ │Gemini│ │DeepSk│ │Groq  │
  │Sonnet│ │      │ │Flash │ │V3.2  │ │70B   │
  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘
     │        │        │        │        │
     └────────┴────┬───┴────────┴────────┘
                   │
     ┌─────────────▼──────────────┐
     │  ARENA STAGE (Pipeline §9) │
     │  1. Lint + type-check each │
     │  2. Run test suite on each │
     │  3. CSL semantic scoring   │
     │  4. Tensor ConsensusBee    │
     │  5. φ-weighted composite   │
     └──────────────┬─────────────┘
                    │
     ┌──────────────▼──────────────┐
     │  BATTLE VIEW (side-by-side) │
     │  ┌───────┬───────┬────────┐ │
     │  │Cand A │Cand B │Cand C  │ │
     │  │██████ │██████ │██████  │ │
     │  │score  │score  │score   │ │
     │  │0.847  │0.912  │0.761   │ │
     │  └───────┴───┬───┴────────┘ │
     │              │ WINNER: B    │
     │  [Accept] [Merge A+B] [Retry] │
     └──────────────┬──────────────┘
                    │
     ┌──────────────▼──────────────┐
     │  SQUASH MERGE               │
     │  Winner → working tree      │
     │  Losers → archived in T1   │
     │  Trust Receipt signed       │
     └─────────────────────────────┘
```

### Battle Scoring Formula

```
score = (
  lint_pass     × φ²   +    // 2.618 — correctness is paramount
  tests_pass    × φ    +    // 1.618 — functional validation
  csl_semantic  × 1.0  +    // semantic alignment with intent
  token_cost    × PSI  +    // 0.618 — efficiency bonus (inverted)
  latency       × PSI²      // 0.382 — speed bonus (inverted)
) / (φ² + φ + 1.0 + PSI + PSI²)
```

### Battle Modes

| Mode | Candidates | Use Case | Hotkey |
|------|-----------|----------|--------|
| **Quick Duel** | 2 models | Fast comparison, inline | `Ctrl+B` |
| **Full Tournament** | 3-5 models | Complex features, max quality | `Ctrl+Shift+B` |
| **Swarm Battle** | 5+ swarm configs | Architecture decisions | From AI panel |
| **Self-Battle** | Same model, different prompts | Prompt engineering | AI panel |
| **Historical** | Current vs cached best | Regression testing | Git panel |

### Battle Configuration

```javascript
// .heady/battle.json (per-workspace)
{
  "defaultMode": "quick_duel",
  "candidates": {
    "quick_duel": ["claude-sonnet", "deepseek-v3"],
    "tournament": ["claude-sonnet", "gpt-4o", "gemini-flash", "deepseek-v3", "groq-70b"],
    "budget_duel": ["deepseek-v3", "groq-scout"]
  },
  "scoring": {
    "lint_weight": 2.618,
    "test_weight": 1.618,
    "semantic_weight": 1.0,
    "cost_weight": 0.618,
    "speed_weight": 0.382
  },
  "auto_accept_threshold": 0.90,
  "archive_losers": true
}
```

---

## §5 — Autonomous Task Completion

HeadyAI-IDE doesn't wait for you. The Living System Loop runs 15 background tasks on φ-scaled intervals:

### Pre-Completion (Before You Ask)

| Task | Trigger | What It Does |
|------|---------|-------------|
| **Predictive Autocomplete** | Every keystroke + 300ms debounce | 3 providers race: fastest response wins, others cached |
| **Intent Prefetch** | Cursor position + file context | Pre-computes likely next actions, pre-fetches relevant docs |
| **Test Generation** | On file save | TestForgerBee generates tests for changed functions |
| **Lint Auto-fix** | On file save | LintEnforcerBee fixes auto-fixable violations instantly |
| **Import Resolution** | On new symbol typed | DependencyBee finds and adds missing imports |

### Background Autonomy (While You Work)

| Task | Interval | What It Does |
|------|----------|-------------|
| **Dead Code Scan** | Every φ⁹h (76h) | DeadCodeReaperBee identifies unreachable code, offers removal |
| **Dependency Audit** | Every φ⁸h (47h) | VulnScannerBee runs `npm audit`, flags vulnerabilities |
| **Memory Consolidation** | Every φ⁸h (47h) | ConsolidationBee migrates memories between tiers |
| **Anti-Regression Guard** | Every φ⁷h (29h) | AntiRegressionBee stores guards for past bug patterns |
| **Performance Profile** | On PR creation | StressTestBee benchmarks changed code paths |

### Post-Completion (After You're Done)

| Task | Trigger | What It Does |
|------|---------|-------------|
| **Wisdom Commit** | Task completion | WisdomCommitBee extracts learnings → knowledge graph |
| **Changelog Draft** | Git push | ChangelogBee drafts changelog from commits |
| **Documentation Sync** | API file change | DocumentationBee regenerates affected docs |
| **Cost Report** | Daily midnight UTC | TokenCounterBee + ForecastBee → daily spend report |
| **Evolution Cycle** | Weekly | GROMBee + PromptOptBee → parameter tuning |

---

## §6 — AI Panel Features

### Chat Mode (Ctrl+L)

Like Windsurf Cascade but backed by 21 swarms:

- **Context-aware**: Reads open files, terminal output, git diff, selected text
- **Multi-model**: SmartRouter selects optimal provider by complexity
- **Tool-using**: Can execute terminal commands, edit files, run MCP tools
- **Memory**: Remembers across sessions via Librarian swarm (3-tier)
- **Streaming**: SSE response streaming with AG-UI protocol events

### Inline Edit (Ctrl+I)

Select code → describe change → watch it transform:

- Diff preview before applying
- Multi-candidate generation (HeadyBattle if ambiguous)
- Undo stack preserved
- Context includes full file + imports + types

### Generate Mode (Ctrl+Shift+G)

Describe what you want, IDE creates it from scratch:

- Full file generation with correct imports
- Multi-file scaffolding (describe a feature → get all files)
- Test generation alongside implementation
- Sacred geometry UI components (φ-scaled CSS included)

---

## §7 — Swarm Dashboard (WebGPU)

Real-time visualization of the 21 swarms and 150 bee types processing your tasks.

### Visual Design

- **21 Platonic solid nodes** arranged on a golden-angle ring (137.5° spacing)
- Each swarm rendered as its assigned sacred geometry form
- Active bees appear as luminous particles orbiting their swarm
- Data flow between swarms shown as golden spiral particle trails
- Pheromone intensity mapped to trail brightness (decays at 1/φ per cycle)
- Background: deep space dark (#0a0a0f) with subtle Flower of Life grid

### Swarm-to-Geometry Mapping

| Swarm | Geometry | Color | Glow |
|-------|----------|-------|------|
| Overmind | Dodecahedron | #00d4aa | Teal pulse |
| Governance | Cube | #7c5eff | Purple steady |
| Forge | Octahedron | #ff6b35 | Orange forge-fire |
| Emissary | Icosahedron | #00b4d8 | Cyan ripple |
| Foundry | Tetrahedron | #e63946 | Red heat |
| Studio | Torus | #f72585 | Pink wave |
| Arbiter | Cube | #b5838d | Mauve pulse |
| Diplomat | Sphere | #6d6875 | Gray shimmer |
| Oracle | Pyramid | #ffd166 | Gold glow |
| Quant | Octahedron | #06d6a0 | Green ticker |
| Fabricator | Tetrahedron | #118ab2 | Blue spark |
| Persona | Sphere | #ef476f | Rose breath |
| Sentinel | Icosahedron | #e63946 | Red alert |
| Nexus | Dodecahedron | #a8dadc | Ice chain |
| Dreamer | Torus | #9b5de5 | Violet cloud |
| Tensor | Tesseract | #00f5d4 | Mint math |
| Topology | Hypercube | #fee440 | Yellow net |
| Librarian | Flower of Life | #cdb4db | Lavender memory |
| Healer | Seed of Life | #52b788 | Green life |
| Navigator | Compass Rose | #4cc9f0 | Cyan compass |
| Alchemist | Metatron's Cube | #f9c74f | Gold transform |

---

## §8 — Web Component for HeadyWeb Embedding

```html
<!-- In headyme.com dashboard -->
<heady-ide
  workspace="my-project"
  theme="sacred-dark"
  panels="editor,terminal,ai,battle"
  auth-token="${sessionToken}"
  server="wss://ide.heady-ai.com"
></heady-ide>
```

### Web Component API

```javascript
// <heady-ide> custom element
class HeadyIDEElement extends HTMLElement {
  // Attributes
  // workspace  — R2 workspace ID to load
  // theme      — 'sacred-dark' | 'sacred-light' | 'minimal'
  // panels     — comma-separated panel list
  // auth-token — Firebase session token
  // server     — WebSocket server URL
  // readonly   — disable editing (viewer mode)
  // file       — auto-open file path
  // battle     — 'on' | 'off' (HeadyBattle default state)

  // Methods
  openFile(path) {}
  runCommand(cmd) {}
  startBattle(prompt, mode) {}
  getActiveSwarms() {}
  setTheme(theme) {}

  // Events
  // 'ide-ready'      — IDE fully loaded
  // 'file-changed'   — File modified
  // 'battle-complete' — HeadyBattle finished
  // 'swarm-update'   — Swarm state changed
  // 'terminal-output' — Terminal produced output
}
customElements.define('heady-ide', HeadyIDEElement);
```

---

## §9 — Server Architecture (Cloud Run)

### `ide.heady-ai.com` — Backend Service

```
Container: heady-ide-server
Port: 8080
Min instances: 1
Max instances: 13 (fib(7))
CPU: 2 vCPU
Memory: 4Gi
Timeout: 3600s (long-lived WebSocket)

Endpoints:
  WS  /ws/terminal     — xterm.js ↔ node-pty
  WS  /ws/lsp          — LSP proxy (tsserver, pyright, rust-analyzer)
  WS  /ws/collab        — Yjs CRDT collaborative editing
  WS  /ws/swarm         — Real-time swarm state broadcast
  POST /api/workspace    — Create/clone/list workspaces
  POST /api/battle       — Start HeadyBattle
  POST /api/pipeline     — Trigger HCFullPipeline
  POST /api/mcp/:tool    — Execute MCP tool
  GET  /api/fs/*         — R2 file read
  PUT  /api/fs/*         — R2 file write
  DELETE /api/fs/*       — R2 file delete
  GET  /health           — Liveness + dependency matrix
```

### Workspace Storage (R2)

```
r2://heady-workspaces/
  tenant:{id}/
    workspace:{name}/
      .heady/
        battle.json         — Battle configuration
        swarm-prefs.json    — Swarm preferences
        memory-context.json — Session memory snapshot
      src/
        ...                 — User project files
      package.json
      ...
```

### Session Persistence (Neon)

```sql
CREATE TABLE ide_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  workspace_id TEXT NOT NULL,
  open_files JSONB DEFAULT '[]',
  cursor_positions JSONB DEFAULT '{}',
  terminal_history JSONB DEFAULT '[]',
  panel_layout JSONB DEFAULT '{}',
  battle_history JSONB DEFAULT '[]',
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ide_workspaces (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  git_url TEXT,
  r2_prefix TEXT NOT NULL,
  language_servers JSONB DEFAULT '["typescript"]',
  swarm_config JSONB DEFAULT '{}',
  battle_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## §10 — .env Configuration

```bash
# ── HeadyAI-IDE Server ────────────────────────────────────────
HEADY_IDE_PORT=8080
HEADY_IDE_HOST=ide.heady-ai.com

# ── Workspace Storage (R2) ────────────────────────────────────
R2_ACCOUNT_ID=                          # [SECRET] CF account
R2_ACCESS_KEY_ID=                       # [SECRET] R2 credentials
R2_SECRET_ACCESS_KEY=                   # [SECRET]
R2_BUCKET=heady-workspaces
R2_ENDPOINT=https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com

# ── Auth ──────────────────────────────────────────────────────
FIREBASE_PROJECT_ID=gen-lang-client-0920560496
FIREBASE_AUTH_DOMAIN=auth.headysystems.com
INTERNAL_NODE_SECRET=                   # [SECRET] inter-service

# ── LLM Providers (SmartRouter) ───────────────────────────────
ANTHROPIC_API_KEY=                      # [SECRET]
OPENAI_API_KEY=                         # [SECRET]
GEMINI_API_KEY=                         # [SECRET]
DEEPSEEK_API_KEY=                       # [SECRET]
GROQ_API_KEY=                           # [SECRET]

# ── Memory Tiers ──────────────────────────────────────────────
UPSTASH_REDIS_REST_URL=                 # [SECRET]
UPSTASH_REDIS_REST_TOKEN=               # [SECRET]
DATABASE_URL=                           # [SECRET] Neon Postgres
QDRANT_URL=                             # [SECRET]
QDRANT_API_KEY=                         # [SECRET]

# ── HeadyBattle ───────────────────────────────────────────────
BATTLE_DEFAULT_MODE=quick_duel
BATTLE_AUTO_ACCEPT_THRESHOLD=0.90
BATTLE_MAX_CANDIDATES=5
BATTLE_TIMEOUT_MS=30000                 # φ⁷ ≈ 29,034 rounded

# ── Budget ────────────────────────────────────────────────────
BUDGET_MODE=balanced                    # economy | balanced | quality
MONTHLY_IDE_BUDGET_USD=50
TOKEN_ALERT_THRESHOLD=0.80             # Alert at 80% of budget

# ── Feature Flags ─────────────────────────────────────────────
ENABLE_BATTLE=true
ENABLE_SWARM_VIZ=true
ENABLE_BACKGROUND_TASKS=true
ENABLE_COLLABORATIVE=false              # Phase 2
ENABLE_WEBGPU_VIZ=true

# ── Jina (Reranking) ─────────────────────────────────────────
JINA_API_KEY=                           # [SECRET]
PG_SEARCH_ENABLED=true

# ── Sentry ────────────────────────────────────────────────────
SENTRY_DSN=                             # [SECRET]
SENTRY_TRACES_SAMPLE_RATE=0.1
```

---

## §11 — File Manifest

```
packages/heady-ide/
├── client/                              # Browser-side (CF Pages)
│   ├── index.html                       # Standalone entry point
│   ├── ide-shell.js                     # Main IDE layout manager
│   ├── editor/
│   │   ├── monaco-setup.js              # Monaco Editor configuration
│   │   ├── heady-language.js            # Custom language features
│   │   ├── themes/
│   │   │   ├── sacred-dark.json         # Primary theme
│   │   │   ├── sacred-light.json        # Alt theme
│   │   │   └── sacred-tokens.json       # φ-scaled editor tokens
│   │   └── keybindings.js               # All hotkeys
│   ├── terminal/
│   │   ├── terminal-manager.js          # xterm.js multi-tab
│   │   └── terminal-theme.js            # Sacred geometry terminal
│   ├── panels/
│   │   ├── ai-chat.js                   # Chat panel (Ctrl+L)
│   │   ├── battle-panel.js              # HeadyBattle UI (Ctrl+B)
│   │   ├── pipeline-panel.js            # 22-stage viz (Ctrl+P)
│   │   ├── swarm-dashboard.js           # WebGPU swarm viz (Ctrl+D)
│   │   ├── file-tree.js                 # R2 filesystem browser
│   │   ├── git-panel.js                 # Git integration
│   │   ├── mcp-tools.js                 # MCP tool browser
│   │   └── metrics-panel.js             # Cost/token tracking
│   ├── components/
│   │   ├── heady-ide-element.js         # <heady-ide> web component
│   │   ├── sacred-geometry-bg.js        # WebGPU background canvas
│   │   ├── status-bar.js                # Bottom status bar
│   │   └── command-palette.js           # Ctrl+Shift+P
│   └── styles/
│       ├── ide.css                      # Master stylesheet
│       ├── sacred-geometry.css          # φ-scaled design tokens
│       └── glassmorphism.css            # Glass panel effects
├── server/                              # Cloud Run backend
│   ├── index.js                         # Express + WS entry
│   ├── workspace-manager.js             # R2 CRUD + Git clone
│   ├── terminal-server.js               # node-pty WebSocket bridge
│   ├── lsp-proxy.js                     # Language Server Protocol
│   ├── battle-engine.js                 # HeadyBattle orchestrator
│   ├── pipeline-bridge.js              # HCFullPipeline integration
│   ├── swarm-broadcaster.js            # Real-time swarm state → WS
│   ├── autonomous-tasks.js             # Background task scheduler
│   └── routes/
│       ├── workspace.js                 # /api/workspace
│       ├── filesystem.js                # /api/fs/*
│       ├── battle.js                    # /api/battle
│       ├── mcp.js                       # /api/mcp/:tool
│       └── health.js                    # /health
├── shared/
│   ├── constants.js                     # φ-constants, FIB, thresholds
│   ├── types.js                         # JSDoc type definitions
│   └── protocol.js                      # WS message protocol
├── .heady/
│   ├── battle.json                      # Default battle config
│   └── swarm-prefs.json                 # Default swarm prefs
├── Dockerfile                           # Cloud Run container
├── wrangler.toml                        # CF Pages config
└── package.json
```

---

## §12 — Deploy Pipeline

```yaml
# .github/workflows/deploy-ide.yml
name: Deploy HeadyAI-IDE
on:
  push:
    branches: [main]
    paths: ['packages/heady-ide/**']

jobs:
  deploy-client:
    name: Deploy IDE Client → CF Pages
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci --workspace=packages/heady-ide
      - run: npm run build:client --workspace=packages/heady-ide
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          projectName: heady-ai-ide
          directory: packages/heady-ide/client/dist

  deploy-server:
    name: Deploy IDE Server → Cloud Run
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      - uses: google-github-actions/setup-gcloud@v2
      - run: |
          gcloud builds submit packages/heady-ide/server \
            --tag gcr.io/${{ secrets.GCP_PROJECT }}/heady-ide-server:${{ github.sha }}
      - run: |
          gcloud run deploy heady-ide-server \
            --image gcr.io/${{ secrets.GCP_PROJECT }}/heady-ide-server:${{ github.sha }} \
            --region us-central1 \
            --min-instances 1 \
            --max-instances 13 \
            --memory 4Gi \
            --cpu 2 \
            --timeout 3600 \
            --allow-unauthenticated \
            --set-env-vars "NODE_ENV=production"
```

---

## §13 — Sacred Geometry Design Tokens

```css
/* packages/heady-ide/client/styles/sacred-geometry.css */
:root {
  /* ── φ-Scaled Spacing ──────────────────────── */
  --phi: 1.618033988749895;
  --space-0: 1px;
  --space-1: 2px;      /* fib(1) */
  --space-2: 3px;      /* fib(2) */
  --space-3: 5px;      /* fib(3) */
  --space-4: 8px;      /* fib(4) */
  --space-5: 13px;     /* fib(5) */
  --space-6: 21px;     /* fib(6) */
  --space-7: 34px;     /* fib(7) */
  --space-8: 55px;     /* fib(8) */
  --space-9: 89px;     /* fib(9) */
  --space-10: 144px;   /* fib(10) */

  /* ── Colors ────────────────────────────────── */
  --bg-void: #0a0a0f;
  --bg-surface: rgba(255, 255, 255, 0.025);
  --bg-elevated: rgba(255, 255, 255, 0.04);
  --bg-glass: rgba(255, 255, 255, 0.06);

  --accent-teal: #00d4aa;
  --accent-purple: #7c5eff;
  --accent-gold: #f9c74f;
  --accent-rose: #ef476f;

  --text-primary: #e8e8f2;
  --text-secondary: #9898aa;
  --text-muted: #606070;

  --border: rgba(255, 255, 255, 0.06);
  --border-active: rgba(0, 212, 170, 0.3);

  /* ── φ-Scaled Radii ────────────────────────── */
  --radius-sm: 5px;    /* fib(3) */
  --radius-md: 8px;    /* fib(4) */
  --radius-lg: 13px;   /* fib(5) */
  --radius-xl: 21px;   /* fib(6) */

  /* ── Glass Effects ─────────────────────────── */
  --glass-blur: 21px;
  --glass-bg: rgba(10, 10, 15, 0.85);
  --glass-border: 1px solid var(--border);

  /* ── Typography ────────────────────────────── */
  --font-code: 'JetBrains Mono', 'Fira Code', monospace;
  --font-ui: 'DM Sans', system-ui, sans-serif;
  --font-display: 'Instrument Serif', Georgia, serif;

  /* ── Editor ────────────────────────────────── */
  --editor-bg: #0d0d14;
  --editor-line-highlight: rgba(255, 255, 255, 0.03);
  --editor-selection: rgba(0, 212, 170, 0.15);
  --editor-cursor: var(--accent-teal);

  /* ── Transitions ───────────────────────────── */
  --ease-phi: cubic-bezier(0.618, 0, 0.382, 1);
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
}
```

---

*∞ Sacred Geometry · Liquid Intelligence · Permanent Life ∞*
*© 2026 HeadySystems Inc. — Eric Haywood, Founder*
