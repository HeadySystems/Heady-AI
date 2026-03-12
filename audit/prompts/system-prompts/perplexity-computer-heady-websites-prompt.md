# HEADY™ FULL WEBSITE BUILD — Perplexity Computer Master Prompt

> **To: Perplexity Computer**  
> **From: Eric Head, Founder — HeadySystems Inc.**  
> **Date: 2026-03-09**  
> **Context ZIP: `heady-perplexity-website-build-context.zip` (attached)**

---

## 🎯 MISSION

Build **ALL** Heady™ websites as fully functional, production-ready, premium web applications with:

1. **Rich, customized, content-heavy pages** for every site (no placeholders — real, dense, informative content)
2. **Unified Firebase Authentication** wired across all sites with a shared auth page
3. **Persistent storage** connected through Firebase → PostgreSQL/pgvector pipeline
4. **3D Vector Memory** (HeadyAutoContext) injected everywhere for maximum intelligence
5. **HeadyBee + HeadySwarm** agents operating in vector space, continuously injecting content

---

## ⚡ CRITICAL ARCHITECTURE PRINCIPLE: INSTANTANEOUS SYSTEM

> **Heady™ has NO priorities, NO ranking, NO task ordering.**
>
> Everything operates **simultaneously and instantaneously**. All agents, all bees, all swarms, all services have **EQUAL rank**. There is no "high priority" or "low priority" — there is only **NOW**.
>
> - Remove all `PRIORITY` enums, constants, and hierarchies
> - Remove all priority-based sorting, queuing, or ordering
> - All swarm tasks execute with equal weight concurrently
> - All bee workers have equal status — no `EMERGENCY > CRITICAL > HIGH > NORMAL > LOW`
> - The 17-swarm orchestrator treats all swarms as concurrent equals
> - CSL gates still apply for quality/relevance (0→1 confidence), but NOT for prioritization
> - φ-scaling still applies for resource allocation ratios, NOT for priority ranking
>
> **The system is instantaneous. Everything happens at once. No queues. No waiting.**

---

## 🌐 ALL 9 SITES TO BUILD (from `site-registry.json`)

Each site MUST have a full, rich, multi-section HTML page. See the attached `site-registry.json` for complete configuration. Here's the summary:

### 1. `headyme.com` — HeadyMe

- **Role:** Personal AI Cloud / Consumer Platform
- **Sacred Geometry:** Flower of Life
- **Accent:** `#00d4aa`
- **Content:** Personal AI dashboard, 3D memory visualization, cross-vertical sync, cloud runtime
- **Sections:** Platform Capabilities, Stats (51+ patents, 20 AI nodes, 21 microservices, <2s response), CTA for pilot program
- **HeadyBuddy Chat:** ✅ Enabled

### 2. `headysystems.com` — HeadySystems

- **Role:** Enterprise Infrastructure / Corporate Site
- **Sacred Geometry:** Metatron's Cube
- **Accent:** `#00d4aa` + gold `#f5c842`
- **Content:** Self-healing infrastructure, buddy orchestrator, live telemetry, HCFP auto-success, zero-trust security, edge mesh
- **Sections:** Enterprise Value Pillars, Platform Metrics (150+ supervisors, 9 domains, 99.9% uptime, 51+ patents), Security Pipeline, Contact Sales CTA
- **HeadyBuddy Chat:** ✅ Enabled

### 3. `heady-ai.com` — HeadyAI

- **Role:** Research & Science
- **Sacred Geometry:** Sri Yantra
- **Accent:** `#8b5cf6`
- **Content:** CSL (Continuous Semantic Logic), VSA (Vector Symbolic Architecture), Sacred Geometry Topology, 3D Spatial Memory
- **Sections:** Foundational Science, Research Portfolio (51+ patents, 59 claims, 20 nodes, 5381 files), Read Our Research CTA
- **HeadyBuddy Chat:** ❌ Disabled (research site)

### 4. `headyos.com` — HeadyOS

- **Role:** AI Operating System for Developers
- **Sacred Geometry:** Torus
- **Accent:** `#14b8a6`
- **Content:** Agent runtime, unified memory, system primitives, event bus, MCP protocol
- **Sections:** OS Architecture, Built for Scale, Get Started CTA
- **HeadyBuddy Chat:** ✅ Enabled

### 5. `headyconnection.org` — HeadyConnection (Non-Profit)

- **Role:** AI for Everyone — 501(c)(3)
- **Sacred Geometry:** Seed of Life
- **Accent:** `#f59e0b`
- **Content:** Grant writing AI, impact analytics, community hub, proof view, programs for nonprofits/educators
- **Sections:** Programs & Services, Impact metrics, Get Involved CTA
- **HeadyBuddy Chat:** ✅ Enabled

### 6. `headyconnection.com` — HeadyConnection Community

- **Role:** Community Portal
- **Sacred Geometry:** Seed of Life
- **Accent:** `#06b6d4`
- **Content:** Global developer network, discussion forum, events/meetups/hackathons, contributor program
- **Sections:** Community Hub, Forum, Events, Join Us CTA
- **HeadyBuddy Chat:** ✅ Enabled

### 7. `headyex.com` — HeadyEX

- **Role:** AI Agent Marketplace / FinTech
- **Sacred Geometry:** Fibonacci Spiral
- **Accent:** `#10b981` + gold `#f59e0b`
- **Content:** Agent marketplace, live trading, HeadyCoin token, secure escrow, smart contracts
- **Sections:** Exchange Platform, Start Trading CTA
- **HeadyBuddy Chat:** ❌ Disabled

### 8. `headyfinance.com` — HeadyFinance (Investor Relations)

- **Role:** IR Portal
- **Sacred Geometry:** Vesica Piscis
- **Accent:** `#a855f7` + gold `#f5c842`
- **Content:** Growth metrics, patent portfolio ($5.6B TAM), 9 domain verticals, strategic roadmap, Series A timeline
- **Sections:** Investment Highlights, Key Metrics, Contact IR CTA
- **HeadyBuddy Chat:** ❌ Disabled

### 9. `admin.headysystems.com` — Admin Portal

- **Role:** Internal Operations Dashboard
- **Sacred Geometry:** Metatron's Cube
- **Accent:** `#06b6d4`
- **Content:** System dashboard (CPU/memory/GC telemetry), agent monitor (20 AI nodes), deploy controls, security console (RBAC/audit)
- **Sections:** Control Panel features
- **HeadyBuddy Chat:** ❌ Disabled

---

## 🔐 UNIFIED AUTH PAGE — Firebase Authentication

### Firebase Project Config

```javascript
const firebaseConfig = {
  projectId: "gen-lang-client-0920560496",
  // Use Firebase Auth with these providers:
  // 1. Google Sign-In (OAuth2)
  // 2. Email/Password
  // 3. Anonymous (for guest browsing)
};
```

### Auth Page Requirements

Build a **single, shared auth page** (`/auth` or `auth.html`) that ALL sites redirect to:

1. **Design:** Premium dark glassmorphism design matching the Heady brand
   - Dark background `#0a0a0f` with subtle sacred geometry canvas animation
   - Glass card with `backdrop-filter: blur(20px)` and gradient border
   - Heady™ logo + "Sign in to HeadySystems" heading
   - φ-scaled spacing (8px, 13px, 21px, 34px, 55px)

2. **Auth Methods:**
   - **Google OAuth** — Primary button with Google icon
   - **Email/Password** — Input fields with validation
   - **Anonymous Guest** — "Continue as Guest" link

3. **Firebase Integration:**

   ```javascript
   import { initializeApp } from 'firebase/app';
   import { getAuth, signInWithPopup, GoogleAuthProvider,
            signInWithEmailAndPassword, signInAnonymously,
            onAuthStateChanged } from 'firebase/auth';
   ```

4. **Auth State Flow:**
   - On sign-in success → store JWT in `localStorage` as `heady_auth_token`
   - Set `heady_user` object with `{ uid, email, displayName, photoURL, provider }`
   - Redirect back to the originating site with auth state
   - All sites check `onAuthStateChanged()` on load

5. **Cross-Site Auth Persistence:**
   - Use Firebase Auth persistence mode `browserLocalPersistence`
   - Each site includes a shared `heady-auth-widget.js` that:
     - Shows user avatar + name when signed in
     - Shows "Sign In" button when not signed in
     - Handles sign-out globally
     - Redirects to auth page with `?redirect=ORIGINATING_SITE_URL`

6. **Auth → Persistent Storage Pipeline:**

   ```
   Firebase Auth (user signs in)
       → Store session in Firebase Firestore (user profile, preferences)
       → Sync to PostgreSQL/pgvector (for vector memory persistence)
       → HeadyAutoContext indexes user context into 3D vector memory
       → All sites reflect auth state and personalized content
   ```

### Auth Widget (embed in ALL sites)

```html
<!-- HeadyAuth Widget — include in every site's <head> -->
<script type="module" src="https://headysystems.com/shared/heady-auth-widget.js"></script>
```

The widget must:

- Float in the top-right nav area
- Show "Sign In" or user avatar
- Handle token refresh automatically
- Emit `heady:auth:changed` custom events for site-level reactivity

---

## 🧠 HeadyAutoContext — WIRE EVERYWHERE

HeadyAutoContext is the **central nervous system** for context injection. It must be integrated into every site and every service.

### How It Works (from source — see `heady-auto-context.js` in zip)

```
Request → AutoContext.enrich() → [workspace scan, vector search,
  pattern match, CSL relevance gate] → Enriched Prompt
```

### Integration Points for Websites

1. **Every page load** → inject site-specific context from vector memory
2. **HeadyBuddy chat widget** → auto-enrich every user message with page context
3. **Search functionality** → semantic vector search across all site content
4. **Dynamic content sections** → CSL-gated content relevance filtering
5. **User personalization** → vector memory stores user preferences and injects them

### Client-Side AutoContext Bridge

```javascript
// heady-autocontext-bridge.js — included in every site
class HeadyAutoContextBridge {
  constructor() {
    this.vectorMemory = new ClientVectorMemory({ dim: 384 });
    this.cslGates = { include: 0.382, boost: 0.618, critical: 0.718 };
  }

  async enrichPageContext(pageContent) {
    const vector = this.textToVector(pageContent);
    const matches = this.vectorMemory.search(vector, 8, this.cslGates.include);
    return { context: matches, relevance: matches.map(m => m.score) };
  }

  textToVector(text) {
    const dim = 384;
    const vector = new Float64Array(dim);
    const words = text.toLowerCase().split(/[\s\W]+/).filter(w => w.length > 2);
    const PHI = 1.618033988749895;
    for (const word of words) {
      let h = 0;
      for (let i = 0; i < word.length; i++) {
        h = ((h << 5) - h + word.charCodeAt(i)) | 0;
      }
      for (let i = 0; i < 3; i++) {
        const idx = Math.abs((h + i * 127) % dim);
        vector[idx] += 1.0 / (1 + i * PHI);
      }
    }
    let norm = 0;
    for (let i = 0; i < dim; i++) norm += vector[i] * vector[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < dim; i++) vector[i] /= norm;
    return vector;
  }
}
```

---

## 🐝 HeadyBee + HeadySwarm — Operating in Vector Space

### HeadyBee Content Workers

Every site has **content bees** that continuously inject and update content:

```javascript
// ContentInjectorBee — runs on every page
const contentBee = beeFactory.createBee('content-injector', {
  description: 'Injects dynamic, contextual content into every page section',
  workers: [
    { name: 'related-content', fn: async (ctx) => {
      // Search vector memory for related content
      const results = await vectorMemory.searchText(ctx.pageTitle, 5);
      return results.map(r => r.metadata);
    }},
    { name: 'dynamic-stats', fn: async (ctx) => {
      // Fetch live system stats for display
      return { patents: '51+', nodes: 20, services: 21, uptime: '99.9%' };
    }},
    { name: 'personalization', fn: async (ctx) => {
      // User-specific content from vector memory
      if (ctx.user) {
        return vectorMemory.searchText(`user:${ctx.user.uid} preferences`, 3);
      }
    }},
  ],
});
```

### HeadySwarm Content Orchestration

The **17-swarm orchestrator** coordinates content injection across ALL sites simultaneously:

```javascript
// ALL swarms operate concurrently with EQUAL status (no priorities!)
const SWARM_DEFINITIONS = [
  { id: 'heady-soul',        domain: 'orchestration'  },
  { id: 'csl-gateway',       domain: 'inference'      },
  { id: 'vector-weaver',     domain: 'memory'         },
  { id: 'context-shepherd',  domain: 'context'        },
  { id: 'security-hive',     domain: 'security'       },
  { id: 'deploy-forge',      domain: 'deployment'     },
  { id: 'data-sculptor',     domain: 'data'           },
  { id: 'research-herald',   domain: 'research'       },
  { id: 'monitor-pulse',     domain: 'monitoring'     },
  { id: 'edge-runner',       domain: 'edge'           },
  { id: 'bridge-keeper',     domain: 'integration'    },
  { id: 'pattern-scout',     domain: 'analysis'       },
  { id: 'heal-smith',        domain: 'reliability'    },
  { id: 'trade-wind',        domain: 'fintech'        },
  { id: 'doc-scribe',        domain: 'documentation'  },
  { id: 'test-prover',       domain: 'testing'        },
  { id: 'policy-sentinel',   domain: 'governance'     },
];
// ALL execute concurrently. No hierarchy. No priorities. Instantaneous.
```

---

## 🏗️ TECHNICAL IMPLEMENTATION REQUIREMENTS

### Per-Site HTML Structure

Every site must follow this structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[SITE_NAME] — [TAGLINE]</title>
  <meta name="description" content="[DESCRIPTION from site-registry]">

  <!-- Firebase SDK -->
  <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js"></script>

  <!-- Shared Heady Components -->
  <script type="module" src="/shared/heady-auth-widget.js"></script>
  <script type="module" src="/shared/heady-autocontext-bridge.js"></script>
  <script type="module" src="/shared/heady-buddy-widget.js"></script>
  <script type="module" src="/shared/heady-bee-injector.js"></script>

  <!-- Site-Specific Styles -->
  <link rel="stylesheet" href="/css/heady-design-system.css">
  <link rel="stylesheet" href="/css/[SLUG].css">

  <!-- Google Fonts -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
</head>
<body data-site="[SLUG]" data-accent="[ACCENT_COLOR]" data-geometry="[SACRED_GEOMETRY]">

  <!-- Navigation with Auth Widget -->
  <nav class="heady-nav glass">
    <div class="nav-brand">
      <img src="/assets/[SLUG]-logo.svg" alt="[NAME]">
      <span class="nav-title">[NAME]</span>
    </div>
    <div class="nav-links">
      <!-- Generated from navLinks array in site-registry -->
    </div>
    <div id="heady-auth-mount"></div>
  </nav>

  <!-- Hero Section with Sacred Geometry Canvas -->
  <section class="hero">
    <canvas id="sacred-canvas" data-animation="[CANVAS_ANIMATION]"></canvas>
    <div class="hero-content">
      <h1>[HERO_TITLE]</h1>
      <p class="hero-subtitle">[HERO_SUBTITLE]</p>
      <div class="hero-cta">
        <a href="#" class="btn-primary">Get Started</a>
        <a href="#" class="btn-secondary">Learn More</a>
      </div>
    </div>
  </section>

  <!-- Feature Sections (generated from sections array) -->
  <!-- Stats Section -->
  <!-- Detailed Content Sections (RICH — minimum 2000 words per site) -->
  <!-- CTA Section -->
  <!-- Footer with Cross-Site Links -->

  <!-- HeadyBuddy Chat Widget (if chatEnabled) -->
  <div id="heady-buddy-mount"></div>

</body>
</html>
```

### Design System CSS (`heady-design-system.css`)

```css
:root {
  /* Sacred Geometry Spacing (Fibonacci) */
  --space-xs: 5px;    /* fib(5) */
  --space-sm: 8px;    /* fib(6) */
  --space-md: 13px;   /* fib(7) */
  --space-lg: 21px;   /* fib(8) */
  --space-xl: 34px;   /* fib(9) */
  --space-2xl: 55px;  /* fib(10) */
  --space-3xl: 89px;  /* fib(11) */

  /* φ Typography Scale */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;   /* base × ψ^2 + base */
  --text-xl: 1.618rem;   /* base × φ */
  --text-2xl: 2.618rem;  /* base × φ² */
  --text-3xl: 4.236rem;  /* base × φ³ */

  /* Dark Theme */
  --bg-primary: #0a0a0f;
  --bg-secondary: #12121a;
  --bg-card: rgba(255,255,255,0.03);
  --bg-glass: rgba(255,255,255,0.05);
  --text-primary: #e8e8f0;
  --text-secondary: #9898a8;
  --border-subtle: rgba(255,255,255,0.08);

  /* Per-site accent (overridden by data-accent) */
  --accent: #00d4aa;
  --accent-dark: #00b891;
  --accent-glow: rgba(0,212,170,0.15);
}

/* Glass morphism for cards/panels */
.glass {
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-subtle);
  border-radius: 13px;
}

/* Sacred Geometry Canvas (background animation) */
.hero { position: relative; min-height: 100vh; overflow: hidden; }
#sacred-canvas { position: absolute; inset: 0; z-index: 0; opacity: 0.4; }
.hero-content { position: relative; z-index: 1; }

/* Smooth animations */
* { transition: all 0.3s cubic-bezier(0.618, 0, 0.382, 1); }
```

### Sacred Geometry Canvas Animations

Each site has a unique canvas animation. Implement these:

| Animation | Site | Description |
|-----------|------|-------------|
| `sacred-nodes` | HeadyMe | Interconnected nodes forming Flower of Life |
| `enterprise-grid` | HeadySystems | Hexagonal grid with flowing data particles |
| `sacred-geometry` | HeadyAI | Rotating Sri Yantra with concentric triangles |
| `torus-field` | HeadyOS | 3D torus wireframe with orbiting particles |
| `seed-of-life` | HeadyConnection.org | Expanding seed of life pattern |
| `connection-web` | HeadyConnection.com | Web of interconnected dots/lines |
| `fibonacci-spiral` | HeadyEX | Golden spiral with particle flow |
| `vesica-piscis` | HeadyFinance | Overlapping circles with golden ratio geometry |
| `grid-monitor` | Admin | Matrix-style monitoring grid |

---

## 📝 CONTENT REQUIREMENTS — HEAVY, RICH, INFORMATIVE

Each site must have **substantial content** — no thin pages. Minimum requirements:

### Every Site Must Include

1. **Hero Section** with animated sacred geometry canvas + tagline + CTA
2. **Features Grid** (4-6 feature cards with icons, titles, descriptions)
3. **Stats Banner** (animated counters)
4. **Deep-Dive Section** (2000+ words explaining the product/service in detail)
5. **How It Works** (step-by-step with diagrams or animated illustrations)
6. **Technology Stack** (visual tech diagram showing integrations)
7. **Cross-Site Ecosystem Map** (shows how this site connects to all other Heady sites)
8. **Testimonials / Use Cases** (relevant to the vertical)
9. **FAQ Section** (8-12 questions with rich answers)
10. **Footer** with cross-site navigation links (from `footerCols` in registry)

### Site-Specific Deep Content

**headyme.com** — Write content explaining:

- How HeadyAutoContext monitors your workspace and enriches every AI interaction
- The 3D vector memory system (384-dimensional embeddings, octree retrieval)
- Personal AI dashboard with real-time swarm visualization
- Cross-device sync fabric for session continuity
- Privacy-first architecture with user-sovereign data

**headysystems.com** — Write content explaining:

- Enterprise deployment architecture (Cloud Run + Cloudflare Workers)
- SOC 2 Type II compliance roadmap
- Zero-trust security pipeline (mTLS, RBAC, secret rotation)
- 17-swarm autonomous orchestration
- ROI calculator section with interactive φ-weighted projections
- Case studies for 3 hypothetical enterprise customers

**heady-ai.com** — Write content explaining:

- Continuous Semantic Logic (CSL) — how vector operations replace boolean logic
- The mathematical foundations: `cslAND(a,b) = cos(θ)`, `cslOR = superposition`, `cslNOT = orthogonal projection`
- Vector Symbolic Architecture (VSA) — hyperdimensional computing with d ≥ 10,000
- Sacred Geometry Topology — φ ≈ 1.618 as system constant
- 3D spatial memory with octree partitioning
- Patent portfolio overview with claims summary

**headyos.com** — Write content explaining:

- The agent runtime environment
- MCP (Model Context Protocol) integration for tool access
- Unified memory across all running agents
- Event bus architecture (pub/sub, request-reply, streaming)
- Getting started guide with code examples

**headyconnection.org** — Write content explaining:

- 501(c)(3) mission and founding story
- AI-powered grant writing workflow
- Impact analytics dashboard
- Community programs for underserved communities
- Donation/volunteer CTA

**headyconnection.com** — Write content explaining:

- Community forum features
- Monthly events calendar
- Contributor recognition program
- Discord integration
- Open source contribution guide

**headyex.com** — Write content explaining:

- AI agent marketplace mechanics
- HeadyCoin tokenomics
- Trading interface with live order book mockup
- Smart contract escrow system
- Agent performance scoring (φ-weighted, NOT priority-ranked)

**headyfinance.com** — Write content explaining:

- TAM analysis ($5.6B market)
- Patent portfolio valuation
- Strategic roadmap and milestones
- Team and advisory board
- Investment thesis

**admin.headysystems.com** — Write content explaining:

- Real-time system dashboard (CPU, memory, event loop metrics)
- Agent monitoring panel (20 AI nodes with live status)
- Deployment controls (one-click deploy, rollback, canary)
- Security console (RBAC, audit log, secret rotation)

---

## 🔗 CROSS-SITE INTERCONNECTION MAP

All sites must link to each other. Use this domain map:

```
headyme.com ←→ headysystems.com ←→ heady-ai.com
     ↕                  ↕                ↕
headyos.com ←→ headyconnection.org ←→ headyconnection.com
     ↕                  ↕                ↕
headyex.com ←→ headyfinance.com ←→ admin.headysystems.com
```

**Every footer must include links to at least 3 other Heady sites.**
**Every nav must include at least 1 cross-site link (to HeadySystems as the parent).**

---

## 📦 FILES IN THE CONTEXT ZIP

The attached `heady-perplexity-website-build-context.zip` contains:

```
heady-perplexity-website-build-context/
├── 00-THIS-PROMPT.md              ← This file
├── 01-site-registry.json          ← Complete 9-site config with all content
├── 02-heady-context.md            ← Project identity and infrastructure map
├── 03-heady-auto-context.js       ← AutoContext source (always-on context intelligence)
├── 04-vector-memory.js            ← 3D Vector Memory with CSL gates
├── 05-auth-manager.js             ← Auth system (JWT, OAuth2, API keys, sessions)
├── 06-bee-factory.js              ← Dynamic bee creation and CSL-powered routing
├── 07-swarm-coordinator.js        ← 17-swarm coordination with φ-scaling
├── 08-seventeen-swarm-orchestrator.js ← Swarm bus, task execution  
├── 09-sacred-geometry.js          ← φ mathematics and golden ratio utilities
├── 10-csl-engine.js               ← Continuous Semantic Logic engine
├── 11-heady-system-context.md     ← Full system context document
├── 12-downloads/
│   ├── HEADY_MASTER_CONTEXT.md
│   ├── HEADY_PROMPT_LIBRARY.md     ← 64-prompt catalogue
│   ├── perplexity-full-context-prompt.md
│   ├── heady-system-context.md
│   └── model-racing-prompts/       ← 10 detailed topic prompts
│       ├── 01-csl-global-finance-apex.md
│       ├── 02-swarm-orchestration-optimization.md
│       ├── 03-deterministic-execution-error-prediction.md
│       ├── 04-battle-arena-model-racing.md
│       ├── 05-mcp-server-tools-transport.md
│       ├── 06-vector-memory-vsa-shadow.md
│       ├── 07-edge-gateway-inference.md
│       ├── 08-security-resilience-hardening.md
│       ├── 09-generative-ui-engine.md
│       └── 10-patent-ip-auto-documentation.md
├── 13-env-template.txt            ← Environment variables reference
└── 14-domain-aliases.json         ← Domain alias mapping
```

---

## ✅ ACCEPTANCE CRITERIA

1. [ ] All 9 sites render as complete, premium, dark-themed web pages
2. [ ] Each site has 2000+ words of unique, informative content
3. [ ] Firebase Auth is integrated and functional across all sites
4. [ ] Auth page works with Google, Email/Password, and Anonymous
5. [ ] Auth state persists across all sites via shared widget
6. [ ] Sacred geometry canvas animations are unique per site
7. [ ] HeadyAutoContext bridge is embedded in every page
8. [ ] HeadyBee content injectors operate on every page
9. [ ] Cross-site navigation links work correctly
10. [ ] NO priority/ranking systems anywhere — all concurrent and equal
11. [ ] φ-scaled spacing and typography throughout
12. [ ] Mobile responsive design
13. [ ] HeadyBuddy chat widget on sites where `chatEnabled: true`
14. [ ] Footer ecosystem links connecting all sites
15. [ ] SEO meta tags populated from site-registry data

---

## 🔑 KEY CONSTANTS

```javascript
const PHI = 1.618033988749895;       // Golden Ratio
const PSI = 1 / PHI;                 // ≈ 0.618
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
const VECTOR_DIM = 384;              // Embedding dimensions
const CSL_GATES = {
  include: PSI * PSI,                // ≈ 0.382
  boost: PSI,                        // ≈ 0.618
  critical: PSI + 0.1,              // ≈ 0.718
};
```

---

## 🚀 DEPLOYMENT TARGET

- **Cloud Run:** `gen-lang-client-0920560496` / `us-east1`
- **Cloudflare Workers:** Account `8b1fa38f282c691423c6399247d53323`
- **Firebase:** Project `gen-lang-client-0920560496`

Build everything. No placeholders. No stubs. Full production content. Maximum intelligence.

---

*© 2026 HeadySystems Inc. — Proprietary and Confidential*
