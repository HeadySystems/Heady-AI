# 🖥️ HEADY LOCAL INSTALL GUIDE
### HeadyBuddy + HeadyAI-IDE — Complete Device Setup

> Version: 1.0.0 — March 20, 2026
> For: Eric Head — Fort Collins, CO
> Assumes: macOS (primary), with Windows/Linux notes where different

---

## ⚡ QUICK START (10-minute path)

```bash
# 1. Install prerequisites (run in Terminal)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node@20 git
node --version   # must be 20.x+
git --version    # must be 2.x+

# 2. Install Tailscale (required for GPU tunnels)
brew install --cask tailscale-app
open -a Tailscale  # sign in with your HeadySystems Google account

# 3. Install Cursor IDE (HeadyAI-IDE)
brew install --cask cursor

# 4. Clone HeadyBuddy
git clone https://github.com/HeadyMe/headybuddy.org ~/heady/headybuddy
cd ~/heady/headybuddy && npm install

# 5. Copy your .env (see Section 4)
cp .env.example .env && nano .env

# 6. Start HeadyBuddy locally
npm run dev
```

---

## SECTION 1: Prerequisites

### Required Software

| Tool | Version | Install |
|---|---|---|
| Node.js | 20.x LTS | `brew install node@20` |
| npm | 10.x (included) | — |
| Git | 2.x+ | `brew install git` |
| Tailscale | Latest | `brew install --cask tailscale-app` |
| Cursor IDE | Latest | `brew install --cask cursor` |
| Docker Desktop | 4.x+ | `brew install --cask docker` (optional — for local services) |

### Optional but Recommended

| Tool | Purpose | Install |
|---|---|---|
| `wrangler` | Deploy/debug Cloudflare Workers locally | `npm i -g wrangler` |
| `gcloud` CLI | Manage Cloud Run services | `brew install --cask google-cloud-sdk` |
| `gh` CLI | GitHub operations from terminal | `brew install gh` |
| Sentry CLI | Upload source maps | `npm i -g @sentry/cli` |

### System Requirements
- macOS 12+ (Monterey or later)
- 8GB RAM minimum (16GB recommended for running local GPU tunnels)
- 20GB free disk space
- Internet connection with <50ms latency to us-central1 recommended

---

## SECTION 2: Tailscale Setup (Required for GPU Access)

Your 4x Colab Pro+ GPUs connect to your local machine via Tailscale. Without it,
GPU tunnel connections will fail.

### Install & Connect

**macOS (recommended — standalone variant, NOT App Store):**
```bash
# Download from packages.tailscale.com (not App Store — avoids sandboxing)
brew install --cask tailscale-app
open -a Tailscale
```
When the app opens:
1. Click **Log In** → authenticate with your HeadySystems Google account
2. Click **Allow** when macOS asks about VPN configuration
3. Go to System Settings → Privacy & Security → VPN → enable Tailscale
4. Click the blue **Connect** button
5. Install CLI integration: click **Show Me How** in the Tailscale menu

**Windows:**
```powershell
winget install Tailscale.Tailscale
# Or download .exe from https://tailscale.com/download/windows
```

**Linux:**
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo systemctl enable --now tailscaled
sudo tailscale up
```

### Verify GPU Tunnel Connectivity
```bash
tailscale status
# You should see your 4 Colab runtimes listed as peers
ping 100.x.x.x  # replace with your Colab runtime Tailscale IP
```

### Your Tailnet Devices to Expect
- `heady-colab-gpu-1` through `heady-colab-gpu-4` — your 4 GPU runtimes
- `heady-production-cloudrun` — Cloud Run proxy (if configured)
- Your local machine

---

## SECTION 3: HeadyAI-IDE (Cursor) Setup

HeadyAI-IDE is Cursor IDE configured with your full Heady MCP server stack,
custom keybindings, and the HeadyBuddy extension context.

### Install Cursor

```bash
brew install --cask cursor
# Or download from https://cursor.sh
```

### Configure MCP Servers

Cursor reads MCP config from `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per-project).

Create or edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "heady-main": {
      "type": "streamableHttp",
      "url": "https://headymcp.com/mcp",
      "headers": {
        "Authorization": "Bearer ${HEADY_MCP_TOKEN}"
      }
    },
    "heady-github": {
      "type": "streamableHttp",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_TOKEN}"
      }
    },
    "heady-filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/USERNAME/heady",
        "/Users/USERNAME/Documents"
      ]
    },
    "heady-sentry": {
      "command": "npx",
      "args": ["-y", "@sentry/mcp-server@latest"],
      "env": {
        "SENTRY_AUTH_TOKEN": "${SENTRY_AUTH_TOKEN}",
        "SENTRY_ORG": "headysystems",
        "SENTRY_HOST": "https://sentry.io"
      }
    },
    "heady-fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    },
    "heady-memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}
```

> Replace `USERNAME` with your macOS username and fill in actual tokens via your `.env`.

### Apply Cursor Config (settings.json)

Open Cursor → `Cmd+Shift+P` → `Open User Settings (JSON)` and add:

```json
{
  "cursor.general.enableShadowWorkspace": true,
  "cursor.cpp.enableCopilotPlusIndexing": true,
  "editor.fontSize": 14,
  "editor.tabSize": 2,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.rulers": [89, 144],
  "terminal.integrated.defaultProfile.osx": "zsh",
  "javascript.updateImportsOnFileMove.enabled": "always",
  "typescript.updateImportsOnFileMove.enabled": "always",
  "files.associations": {
    "*.env*": "dotenv",
    "wrangler.toml": "toml"
  },
  "extensions.autoUpdate": false
}
```

### Install Cursor Extensions

```bash
# Run all at once in terminal
cursor --install-extension esbenp.prettier-vscode
cursor --install-extension bradlc.vscode-tailwindcss
cursor --install-extension dbaeumer.vscode-eslint
cursor --install-extension ms-azuretools.vscode-docker
cursor --install-extension eamodio.gitlens
cursor --install-extension humao.rest-client
cursor --install-extension mikestead.dotenv
cursor --install-extension redhat.vscode-yaml
cursor --install-extension tamasfe.even-better-toml
cursor --install-extension usernamehw.errorlens
cursor --install-extension PKief.material-icon-theme
```

### Restart Cursor and Verify MCP

1. Fully quit Cursor (`Cmd+Q`)
2. Reopen: `open -a Cursor`
3. `View → Output → MCP` — all servers should show green ✅
4. Open any Heady repo and ask: "What are the active Heady issues?" — Heady MCP should respond

---

## SECTION 4: HeadyBuddy Local Setup

HeadyBuddy (headybuddy.org) is your AI companion service. Local dev runs on port 3000.

### Clone & Install

```bash
mkdir -p ~/heady
git clone https://github.com/HeadyMe/headybuddy.org ~/heady/headybuddy
cd ~/heady/headybuddy
npm install
```

### Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your rotated credentials:

```env
# Core
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://[user]:[password]@[neon-host]/headybuddy?sslmode=require
DIRECT_URL=postgresql://[user]:[password]@[neon-host]/headybuddy?sslmode=require

# Cache
UPSTASH_REDIS_URL=https://[your-upstash-endpoint].upstash.io
UPSTASH_REDIS_TOKEN=[your-token]

# Auth
FIREBASE_PROJECT_ID=heady-production
FIREBASE_SERVICE_ACCOUNT=[base64-encoded-json or path to JSON file]

# AI Routing (phi-based cascade: Claude → Groq → GPT-4o → Gemini)
ANTHROPIC_API_KEY=[new-key-after-rotation]
GROQ_API_KEY=[your-groq-key]
OPENAI_API_KEY=[your-openai-key]
GOOGLE_AI_API_KEY=[your-google-key]

# Monitoring
SENTRY_DSN=[your-headybuddy-project-dsn]

# Heady-specific
PHI=1.618033988749895
CSL_THRESHOLD_MEDIUM=0.809
RATE_LIMIT_PER_MIN=89
```

### Run in Development

```bash
npm run dev
# → Server listening on http://localhost:3000
# → Health: http://localhost:3000/health
```

### Verify

```bash
curl http://localhost:3000/health
# Expected: {"ok":true,"service":"headybuddy","coherence":0.95,"ts":"..."}
```

---

## SECTION 5: Claude Desktop MCP (Optional Secondary IDE)

If you also use Claude Desktop alongside Cursor:

```bash
# Download Claude Desktop
open https://claude.ai/download

# Edit config
nano "~/Library/Application Support/Claude/claude_desktop_config.json"
```

Paste:
```json
{
  "mcpServers": {
    "heady-main": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://headymcp.com/mcp"],
      "env": {
        "HEADY_MCP_TOKEN": "your-mcp-token"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/USERNAME/heady"
      ]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your-github-pat"
      }
    }
  }
}
```

Quit and relaunch Claude Desktop. The 🔨 hammer icon should appear in the chat input.

---

## SECTION 6: Windsurf IDE (Alternative to Cursor)

If you prefer Windsurf:

```bash
# Download from windsurf.com
open https://windsurf.com/download
```

Config file location:
```
macOS: ~/.codeium/windsurf/mcp_config.json
Windows: %USERPROFILE%\.codeium\windsurf\mcp_config.json
```

Add your MCP servers using the same JSON structure as the Cursor config above.
Access via: `Cmd+Shift+P` → `MCP: Add Server` or Plugins icon → Manage Plugins.

---

## SECTION 7: Local .env Management

**Never commit `.env` files.** Use this pattern for all Heady repos:

```bash
# Install dotenv-vault for encrypted .env sync (optional)
npm i -g dotenv-vault

# Or use 1Password CLI for secrets injection
brew install --cask 1password-cli
op inject -i .env.template -o .env
```

Store your master secrets in:
- 1Password vault: "HeadySystems Secrets"
- Or: `~/.heady/.secrets` (chmod 600, gitignored globally)

Add to `~/.gitignore_global`:
```
.env
.env.*
!.env.example
!.env.template
*.pem
*.key
*-service-account*.json
gcp-*.json
.heady/
```

Enable global gitignore:
```bash
git config --global core.excludesfile ~/.gitignore_global
```

---

## SECTION 8: Post-Install Checklist

Run through this after every fresh setup:

- [ ] `node --version` → 20.x
- [ ] `tailscale status` → shows your 4 GPU nodes
- [ ] `curl http://localhost:3000/health` → ok: true
- [ ] Cursor MCP panel shows all 6 servers green
- [ ] `wrangler whoami` → shows your Cloudflare account
- [ ] `gcloud auth list` → shows heady-systems@... active
- [ ] `gh auth status` → shows HeadyMe org access
- [ ] No `console.log(process.env.ANTHROPIC_API_KEY)` in any file
- [ ] `.env` is in `.gitignore`
- [ ] Sentry DSN set → `curl http://localhost:3000/health` → Sentry receives event

---

## SECTION 9: Troubleshooting

| Symptom | Fix |
|---|---|
| `tailscale: command not found` | Open Tailscale app → menu → Install CLI |
| Cursor MCP servers show red | Fully quit Cursor → reopen → check `~/.cursor/mcp.json` JSON syntax |
| `npm install` fails on M1/M2 | `softwareupdate --install-rosetta` then retry |
| `ECONNREFUSED localhost:3000` | Check `.env` PORT and that `npm run dev` is running |
| Firebase auth fails locally | Verify `FIREBASE_SERVICE_ACCOUNT` is valid base64 JSON |
| Neon DB connection timeout | Check Neon dashboard — free tier may be paused, click Resume |
| `wrangler` login fails | `wrangler logout && wrangler login` |
| Claude Desktop 🔨 missing | Quit fully via system tray → reopen → check JSON syntax in config |
| GPU tunnel not reachable | Reconnect Colab runtime → re-run Tailscale auth key cell |

---

HeadySystems Inc. · φ = 1.618
Last updated: March 20, 2026
