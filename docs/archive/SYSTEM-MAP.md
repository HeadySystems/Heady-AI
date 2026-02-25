<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# Heady System Map
>
> **Updated: February 22, 2026** — Complete folder-to-repo-to-deployment mapping

---

## 🗂️ What You Have

### Your Computer (Ryzen 9 Desktop)

```
~/                                    ← Home directory
├── CascadeProjects/                  ← 🏗️ MAIN DEV REPO (everything builds from here)
│   ├── cloudflare-workers/           ← Edge proxy (heady-edge-proxy.js)
│   ├── HeadyBuddy/                   ← HeadyBuddy app (server + frontend)
│   ├── HeadyAI-IDE/                  ← AntiGravity-based IDE
│   ├── HeadyWeb/                     ← Browser new-tab page
│   ├── headysystems/                 ← headysystems.com site source
│   ├── headyconnection/              ← headyconnection.com site source
│   ├── headymcp/                     ← headymcp.com site source
│   ├── headybuddy/                   ← headybuddy.org site source
│   ├── headyio/                      ← headyio.com site source
│   ├── headyme/                      ← headyme.com site source
│   ├── cloudflared/                  ← Zero Trust tunnel config
│   ├── scripts/                      ← Launcher, watchdog, heartbeat
│   ├── QUICKSTART.md                 ← How to launch everything
│   └── SYSTEM-MAP.md                 ← ⭐ This file
│
├── Desktop/
│   ├── HeadyE/                       ← 📦 DEPLOYMENT MIRROR (syncs to GitHub for hosting)
│   │   ├── headysystems/             ← → github.com/HeadyMe/headysystems-site
│   │   ├── headyconnection/          ← → github.com/HeadyMe/headyconnection-site
│   │   ├── headymcp/                 ← → github.com/HeadyMe/headymcp-site
│   │   ├── headybuddy/              ← → github.com/HeadyMe/headybuddy-site
│   │   ├── headyio/                 ← → github.com/HeadyMe/headyio-site
│   │   ├── headyme/                 ← → github.com/HeadyMe/headyme-site
│   │   ├── Heady/                   ← Main Heady monorepo mirror
│   │   ├── distribution/            ← Distribution packages
│   │   └── gifts/                   ← Gift packages
│   ├── Heady-Systems-Ecosystem/      ← Legacy ecosystem copy
│   ├── *.desktop                     ← Desktop launchers (Heady, IDE, etc.)
│   └── README.license                ← License info
│
├── headysystems/                     ← Site repo (syncs to HeadyE)
├── headyconnection/                  ← Site repo (syncs to HeadyE)
├── headymcp/                         ← Site repo (syncs to HeadyE)
├── headybuddy/                       ← Site repo (syncs to HeadyE)
├── headyio/                          ← Site repo (syncs to HeadyE)
└── headyme/                          ← Site repo (syncs to HeadyE)
```

---

## 🔄 How Things Sync

```
CascadeProjects/headymcp/  ──build──▶  ~/headymcp/  ──rsync──▶  Desktop/HeadyE/headymcp/  ──git push──▶  GitHub
     (source)                          (deploy copy)              (deploy mirror)                    (live site)
```

| Source (dev) | Deploy copy | HeadyE mirror | GitHub repo | Live domain |
|---|---|---|---|---|
| `CascadeProjects/headysystems/` | `~/headysystems/` | `Desktop/HeadyE/headysystems/` | headysystems-site | headysystems.com |
| `CascadeProjects/headyconnection/` | `~/headyconnection/` | `Desktop/HeadyE/headyconnection/` | headyconnection-site | headyconnection.com |
| `CascadeProjects/headymcp/` | `~/headymcp/` | `Desktop/HeadyE/headymcp/` | headymcp-site | headymcp.com |
| `CascadeProjects/headybuddy/` | `~/headybuddy/` | `Desktop/HeadyE/headybuddy/` | headybuddy-site | headybuddy.org |
| `CascadeProjects/headyio/` | `~/headyio/` | `Desktop/HeadyE/headyio/` | headyio-site | headyio.com |
| `CascadeProjects/headyme/` | `~/headyme/` | `Desktop/HeadyE/headyme/` | headyme-site | headyme.com |

---

## 🏛️ Architecture: Hybrid Local + Edge + Cloud

```
┌─────────────────────────────────────────────────────────┐
│                   YOUR DEVICE (Local)                    │
│                                                          │
│  HeadyBuddy Server (:4800)  ← AI companion + tasks      │
│  HeadyManager (:3301)       ← Service orchestration     │
│  HeadyAI-IDE (desktop app)  ← AntiGravity-based IDE     │
│  HeadyWeb (:5174)           ← Browser new-tab page      │
│  Cloudflared tunnel         ← Secure connection to edge  │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│              CLOUDFLARE EDGE (300+ PoPs)                 │
│                                                          │
│  heady-edge-proxy.js        ← Routes all traffic         │
│    ├─ /v1/chat              ← Public AI chat (Workers AI)│
│    ├─ /v1/create            ← Creative generation        │
│    ├─ /v1/arena             ← AI model competition       │
│    └─ Edge-served sites     ← All 7 .com domains         │
│                                                          │
│  52 AI Models available:                                 │
│    Workers AI (Llama 3.1) + Gemini + Claude + Groq       │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│                    CLOUD SERVICES                        │
│                                                          │
│  GitHub Pages     ← 6 domain sites hosted                │
│  Cloudflare DNS   ← Domain routing                       │
│  Firebase         ← Auth + user data (HeadyWeb)          │
│  Notion           ← Knowledge base sync                  │
└─────────────────────────────────────────────────────────┘
```

---

## 🖥️ What Runs Locally (Hybrid Apps)

| App | Port | What it does | How to launch |
|---|---|---|---|
| **HeadyBuddy** | 4800 | AI companion, chat, tasks, skills, memory | `cd ~/CascadeProjects/HeadyBuddy && npm start` |
| **HeadyManager** | 3301 | Service orchestration, health monitoring | `~/CascadeProjects/heady-launcher.sh` |
| **HeadyAI-IDE** | desktop | VS Code-based IDE with AI features | Desktop shortcut or `~/CascadeProjects/HeadyAI-IDE/antigravity` |
| **HeadyWeb** | 5174 | Intelligent browser new-tab | `cd ~/CascadeProjects/HeadyWeb && npm run dev` |

---

## ☁️ What Runs on Edge/Cloud

| Service | Where | What it does |
|---|---|---|
| **Edge Proxy** | Cloudflare Workers | Routes all API traffic, serves sites, AI chat |
| **7 Websites** | Edge-served HTML | headysystems, headymcp, headybuddy, etc. |
| **HeadyWeb** | Cloudflare Pages | headyweb.pages.dev (production build) |
| **DNS + Tunnels** | Cloudflare | Domain routing + Zero Trust access |

---

## 📋 Deployment Cheatsheet

### Deploy edge proxy (AI + chat + sites)

```bash
cd ~/CascadeProjects/cloudflare-workers
CLOUDFLARE_API_TOKEN=<token> wrangler deploy
```

### Sync all site repos

```bash
for repo in headysystems headyconnection headymcp headybuddy headyio headyme; do
  rsync -a --exclude='.git' ~/CascadeProjects/$repo/ ~/$repo/
  cd ~/$repo && git add -A && git commit -m "sync" && git push origin main
done
```

### Launch everything locally

```bash
~/CascadeProjects/heady-launcher.sh
```

---

## 🗓️ Roadmap

| Priority | Feature | Status |
|---|---|---|
| 🔴 NOW | HeadyBuddy → fast local task companion | Server running, frontend loading |
| 🟡 NEXT | HeadyBuddy cross-device (mobile PWA) | Planned |
| 🟡 NEXT | HeadyMemory persistent intelligence | Architecture planned |
| 🟢 FUTURE | Desktop app packaging (like AntiGravity) | Electron/Tauri |
