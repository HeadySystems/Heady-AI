# HeadySystems Deep Scan: Dynamic UI, Onboarding & Context Switcher
## Complete Implementation Roadmap — Based on 8,037 Files Scanned

> **Scan Date:** March 11, 2026
> **Repos Scanned:** 10 (HeadySystems org) + HeadyMe personal (13 repos)
> **Active Repo:** `HeadySystems/sandbox` — 208MB, 8,037 files
> **Source Files Read:** ContextSwitcher.tsx, OnboardingWizard.tsx, onboarding-controller.js, onboarding-stages.ts, ui-projection-engine.js, generative-ui-engine.js (×2), headyme-onboarding.js, headyme/index.html, App.jsx, CLAUDE.md, patent_info.md, heady-ide.yaml, heady-auto-ide.yaml, heady-buddy.yaml, package.json (×5), prisma/schema.prisma, render.yaml, mcp-gateway-config.json, + 55 YAML configs inventoried

---

## PART 1: WHAT ALREADY EXISTS (Actual Code Found)

### 1.1 Repository Inventory (10 repos)

| Repo | Lang | Size | Status | Created | Purpose |
|------|------|------|--------|---------|---------|
| **sandbox** | JS | 79MB | **Active** | Feb 6 | Monorepo — main codebase |
| Heady | Java | 249MB | Archived | Feb 6 | Sacred Geometry Arch v3 |
| Heady-pre-production | JS | 1.7MB | Archived | Jan 26 | Official repo |
| main | Python | 2MB | Archived | Jan 19 | Codex v13 builder |
| ai-workflow-engine | TS | 26KB | Archived | Jan 31 | Cloudflare Workers AI |
| sandbox-pre-production | Python | 1.3MB | Archived | Jan 24 | Checkpoints |
| headybuddy-web | — | 0 | Archived | Feb 20 | HeadyBuddy web |
| **Heady-Main** | — | 0 | **Active** | **Today** | Production mirror |
| **Heady-Staging** | — | 0 | **Active** | **Today** | Pre-production mirror |
| **Heady-Testing** | — | 0 | **Active** | **Today** | Testing mirror |

Three new repos were created **today** (March 11) — Heady-Main, Heady-Staging, Heady-Testing — indicating an active deployment pipeline push.

### 1.2 Tech Stack (Discovered from package.json + source)

| Layer | Technology | Source File |
|-------|-----------|-------------|
| **Backend** | Node.js + Express 4.21 | `heady-manager.js` (53KB) |
| **Protocol** | MCP SDK 1.0.1 | `package.json` |
| **Frontend** | React 19 + Vite 6 | `frontend/package.json` |
| **Styling** | Tailwind CSS 3.4 | `frontend/tailwind.config.js` |
| **Icons** | Lucide React 0.474 | `frontend/package.json` |
| **Onboarding Service** | Next.js 14 + Prisma 5.22 | `services/heady-onboarding/package.json` |
| **Auth** | NextAuth 5.0-beta | `services/heady-onboarding/package.json` |
| **Database** | PostgreSQL + Prisma ORM | `services/heady-onboarding/prisma/schema.prisma` |
| **State Caching** | Redis | `src/onboarding/onboarding-controller.js` |
| **Animation** | Framer Motion 11 | `services/heady-onboarding/package.json` |
| **UI Components** | Radix UI | `services/heady-onboarding/package.json` |
| **Validation** | Zod 3.23 | `services/heady-onboarding/package.json` |
| **Worker** | Python | `backend/python_worker/` |
| **Edge** | Cloudflare Workers | `workers/` (8 workers found) |
| **Desktop** | Electron | `desktop-overlay/` |
| **Browser Ext** | Chrome Extension | `extensions/chrome-extension/` |
| **Deployment** | Render.com + GCP Cloud Run | `render.yaml`, `cloudbuild.yaml` |
| **Design** | Sacred Geometry | φ (PHI) constants throughout all code |

### 1.3 Existing Onboarding System (ALREADY BUILT)

**Three parallel onboarding implementations exist:**

**A) `services/heady-onboarding/` — Next.js Onboarding App (Most Complete)**
- Full Next.js 14 app with App Router
- Prisma + PostgreSQL user model
- NextAuth authentication (OAuth)
- 5 onboarding stages defined in `onboarding-stages.ts`:
  1. Create Account (username → `@headyme.com` identity)
  2. Email Configuration (secure client / forward)
  3. Permissions & Runtime (cloud-only / hybrid)
  4. Buddy Setup (themes, contexts, quick-switch profiles)
  5. Complete (workspace ready, API key in Settings)
- Components: `ContextSwitcher.tsx`, `OnboardingWizard.tsx`
- Dashboard components: API key card, recent activity, system status, quick actions
- Auth: sign-in providers, callback handling
- Phi-scaled timing for each stage
- **Deployed to GCP Cloud Run:** `heady-onboarding-609590223909.us-east1.run.app`

**B) `src/onboarding/onboarding-controller.js` — Redis-Backed Controller (Most Robust)**
- 8-step onboarding flow: WELCOME → AUTH → PERMISSIONS → ACCOUNT_SETUP → EMAIL_SETUP → UI_CUSTOMIZATION → COMPANION_CONFIG → COMPLETE
- Full Redis persistence with 30-day TTL
- Step prerequisites + skip logic
- Analytics event recording per step
- Webhook on completion
- Cross-session/cross-device resume
- HMAC-signed webhook payloads

**C) `src/routes/headyme-onboarding.js` — Express API Routes (Context-Focused)**
- 5 context templates: Business Ops, Creative Studio, Nonprofit Mgmt, Dev Platform, Personal Wellness
- Context → sites + connectors + features resolution
- `/plan` — generate personalized onboarding plan
- `/activate` — provision all services
- `/buddy-setup` — guided setup with UI layouts and context definitions
- `/buddy-suggestions` — AI-powered context suggestions based on auth provider
- `/finalize` — complete onboarding with buddy welcome message

### 1.4 Existing Context Switcher (ALREADY BUILT)

**`services/heady-onboarding/src/components/ContextSwitcher.tsx`**
- Dropdown-based context profile switcher
- Each profile has: id, name, description, color, systemPrompt, tools, active flag
- Calls `POST /api/buddy/context` on switch
- Default profile: "Default — General-purpose assistant"
- PHI constant used for sizing
- Outside-click-to-close behavior
- Styled with Sacred Geometry dark theme

**Current limitations:**
- Dropdown only, not a persistent bar
- No cloud environment provisioning on switch
- No AI agent reconfiguration
- No keyboard shortcuts
- No drag-to-reorder
- No transition animations
- No pre-warming
- Profiles are hardcoded/passed as props, not fetched from API

### 1.5 Existing Dynamic UI System (ALREADY BUILT)

**A) `src/ui/generative-ui-engine.js` — Simple template-based generator**
- 5 template types: card, dashboard, list, form, chat
- Generates HTML/CSS from semantic descriptions
- Sandboxing with CSP
- LRU cache (200 entries)

**B) `services/heady-ui/generative-engine.js` — Advanced CSL-gated generator**
- CSL (Continuous Semantic Logic) confidence gates
- φ-scaled complexity tiers: basic → standard → advanced → expert
- Deterministic: same input → same layout hash (SHA-256)
- Adaptive onboarding with progressive disclosure
- Phi spacing/sizing system

**C) `src/onboarding/ui-projection-engine.js` — Full Sacred Geometry Layout Engine (MOST POWERFUL)**
- 8 projection types: dashboard, companion-chat, command-center, minimal, focus, creative-studio, trading-desk, developer-console
- Fibonacci-aligned grid columns (1, 2, 3, 5, 8, 13)
- Golden ratio widget area distribution scoring
- Device breakpoints: mobile (1 col) → tablet (2 col) → desktop (5 col)
- Template scoring against Sacred Geometry principles (0-100 score)
- Behavior pattern detection → automatic re-projection
- Full color scheme generation with CSS custom properties
- Typography with PHI line-height (1.618)
- Accessibility features (high contrast, reduced motion, screen reader)
- Redis-cached projections
- Re-projection triggers: orientation change, window resize, preference change, behavior pattern

### 1.6 Existing HeadyMe Landing Page (ALREADY BUILT)

**`sites/headyme/index.html` — Complete marketing site**
- Full landing page with hero, features, pricing, ecosystem
- Canvas particle animation (60 particles with connection lines)
- 4 pricing tiers: Free ($0), Personal ($55/mo), Pro ($89/mo), Unlimited ($233/mo)
- 8 feature cards: Persistent Memory, Personal Agents, Multi-Model Intelligence, Privacy-First, Cross-Platform, Creative Tools, Continuous Learning, Heady Buddy
- 5-step "How It Works": Create → Talk → Deploy Agents → Memory Grows → Access Everywhere
- 6-item Memory Architecture section: 384-D Vectors, CSL Confidence Gates, φ-Consolidation, Zero-Knowledge Privacy, Semantic Search, Infinite Retention
- 9-item Ecosystem grid: HeadyMe, HeadySystems, HeadyAI, HeadyOS, HeadyConnection, HeadyEx, HeadyFinance, HeadyDocs, Admin Portal
- JSON-LD structured data
- Mobile responsive with hamburger menu
- Sign-in links to GCP Cloud Run deployment
- **HeadyAI IDE link found:** `heady-ide-bf4q4zywhq-ue.a.run.app`

### 1.7 Existing Database Schema (ALREADY BUILT)

**`services/heady-onboarding/prisma/schema.prisma`**

User model with:
- `headyUsername` (unique) — username@headyme.com identity
- `headyEmail` (unique) — generated email
- `onboardingComplete` + `onboardingStep` (0-5)
- `emailSetup` (JSON) — provider config + forwarding
- `permissionMode` — cloud / hybrid
- `buddySetupComplete` + `buddyConfig` (JSON) — UI contexts & preferences
- `apiKey` + `apiKeyCreatedAt`
- OAuth accounts, sessions, verification tokens
- `OnboardingLog` — step-by-step audit trail
- `ApiKeyUsage` — per-request tracking

### 1.8 Key Source Files by Size (Complexity Indicator)

| File | Size | What It Does |
|------|------|--------------|
| `heady-manager.js` | 53KB | MCP server + Express API gateway |
| `hc_monte_carlo.js` | 59KB | Monte Carlo scheduling |
| `hc_pipeline.js` | 38KB | HCFullPipeline engine |
| `hc_imagination.js` | 36KB | Creative problem solving |
| `hc_pattern_engine.js` | 28KB | Pattern recognition |
| `hc_orchestrator.js` | 26KB | Service orchestration |
| `hc_conductor.js` | 26KB | Infrastructure conductor |
| `hc_claude_agent.js` | 26KB | Claude AI agent |
| `hc_performance_profiler.js` | 25KB | Performance profiling |
| `hc_self_critique.js` | 19KB | Self-reflection (Patent #29) |
| `hc_resource_manager.js` | 19KB | Resource management |
| `hc_task_scheduler.js` | 18KB | Task scheduling |
| `hc_secrets_manager.js` | 18KB | Secrets management |
| `hc_story_driver.js` | 17KB | Narrative-driven tasks |
| `hc_skill_executor.js` | 14KB | Skill execution |
| `hc_cloud_conductor.js` | 14KB | Cloud provisioning |
| `hc_billing.js` | 12KB | Billing + cost tracking |
| `heady-registry.json` | 46KB | Central component catalog |

### 1.9 Config Inventory (55+ YAML configs in `configs/`)

Most relevant for this implementation:

| Config | Size | Direct Relevance |
|--------|------|-----------------|
| `heady-buddy.yaml` | 11.5KB | Buddy companion — cross-device presence, launch modes, installation |
| `heady-ide.yaml` | 6.5KB | HeadyIDE — code-server, extensions, Sacred Geometry theme |
| `heady-auto-ide.yaml` | 6.5KB | Agentic IDE — spec-driven dev, pattern catalog, workflow panel |
| `heady-buddy-always-on.yaml` | 8.1KB | Always-on companion behavior |
| `skills-registry.yaml` | 24KB | Complete skills registry |
| `system-self-awareness.yaml` | 22KB | System self-awareness |
| `universal-domains.yaml` | 26KB | Domain architecture |
| `hcfullpipeline.yaml` | 16KB | Master pipeline definition |
| `imagination-engine.yaml` | 7.5KB | Imagination engine |
| `story-driver.yaml` | 10KB | Narrative-driven UX |
| `activation-manifest.yaml` | 12KB | System activation sequencing |
| `service-discovery.yaml` | 8.7KB | Service mesh discovery |
| `device-management.yaml` | 11KB | Cross-device management |

---

## PART 2: GAP ANALYSIS — What's Missing vs. What's Needed

### 2.1 The Three Systems and Their Current State

| System | Status | What Exists | What's Missing |
|--------|--------|-------------|----------------|
| **Dynamic UI** | 70% built | Generative UI Engine, UI Projection Engine, Sacred Geometry scoring, Fibonacci grids, behavior detection | No real-time WebSocket push, no live re-rendering on context switch, projection engine not wired to frontend |
| **Onboarding** | 60% built | 3 parallel implementations, Prisma schema, 5-8 step flows, context templates, buddy suggestions, landing page deployed | Implementations not unified, no AI-driven discovery interview, no live preview step, no context designer visual builder |
| **Context Switcher** | 40% built | ContextSwitcher.tsx component, context templates in routes, UI projection switching | Dropdown only (not persistent bar), no cloud env provisioning, no AI reconfiguration, no pre-warming, no keyboard shortcuts |

### 2.2 Critical Integration Gaps

**Gap 1: No Real-Time Layer**
- `heady-manager.js` is REST-only
- MCP uses SSE at `manager.headysystems.com/mcp/sse` but no WebSocket for UI
- UI Projection Engine generates projections but can't push them to the browser
- Context switches require page reload, not live morph

**Gap 2: Three Unconnected Onboarding Implementations**
- `services/heady-onboarding/` (Next.js) has auth + Prisma but limited context design
- `src/onboarding/onboarding-controller.js` has best orchestration logic (Redis, analytics, webhooks) but no UI
- `src/routes/headyme-onboarding.js` has best context template system but no auth
- None of these talk to each other

**Gap 3: UI Projection Engine Not Wired to Frontend**
- `src/onboarding/ui-projection-engine.js` (800+ lines) generates full projections with Sacred Geometry scoring
- But `frontend/src/App.jsx` is a basic 3-card dashboard that doesn't consume projections
- No `DynamicRenderer` component that takes a projection and renders it

**Gap 4: Context Switcher Has No Backend**
- `ContextSwitcher.tsx` calls `POST /api/buddy/context` but this endpoint doesn't exist in `heady-manager.js`
- No context CRUD API
- No cloud environment provisioning per context
- No MCP tool swapping per context

**Gap 5: HeadyAI-IDE Context Not Assembled**
- `heady-ide.yaml` defines code-server + extensions + Sacred Geometry theme
- `heady-auto-ide.yaml` defines agentic workflows panel, pattern catalog, spec workspace
- `remotes/heady-ide/` has a micro-frontend shell (bootstrap.js, App.js, mount.js)
- `apps/headyweb/remotes/heady-ide/` has another copy
- But no unified IDE context that combines all these into a switchable workspace

---

## PART 3: IMPLEMENTATION TASKS

### Phase 0: Unify (Week 1) — CRITICAL FOUNDATION

| # | Task | What To Do | Files to Modify/Create |
|---|------|------------|----------------------|
| 0.1 | **Merge onboarding implementations** | Take the best from each: Redis controller from `src/onboarding/`, Prisma schema from `services/heady-onboarding/`, context templates from `src/routes/headyme-onboarding.js` | Create `src/onboarding/unified-onboarding.js` |
| 0.2 | **Add WebSocket to heady-manager.js** | Install `ws`, create WebSocket server alongside Express on port 3300, add event channels for context, onboarding, pipeline, health | Modify `heady-manager.js`, create `src/hc_realtime.js` |
| 0.3 | **Create context CRUD API** | REST endpoints for context profiles backed by PostgreSQL + Redis cache | Create `src/routes/context-api.js`, add to heady-manager routes |
| 0.4 | **Wire ContextSwitcher to real backend** | Replace hardcoded profiles with API-fetched profiles, add WebSocket subscription | Modify `ContextSwitcher.tsx` |

### Phase 1: Dynamic UI Rendering (Weeks 2-3)

| # | Task | What To Do | Files to Modify/Create |
|---|------|------------|----------------------|
| 1.1 | **Build DynamicRenderer component** | React component that takes a UIProjection object (from `ui-projection-engine.js`) and renders it as actual grid layout with panels/widgets | Create `frontend/src/components/DynamicRenderer.tsx` |
| 1.2 | **Wire UI Projection Engine to API** | Add REST endpoint `GET /api/projection/:userId` that calls `ui-projection-engine.js` and returns projection JSON | Create `src/routes/projection-api.js` |
| 1.3 | **Build PanelManager component** | Drag-and-drop panel system using `react-grid-layout`, reads widget placements from projection | Create `frontend/src/components/PanelManager.tsx` |
| 1.4 | **Implement useRealtime hook** | WebSocket connection manager with auto-reconnect using φ-scaled backoff | Create `frontend/src/hooks/useRealtime.ts` |
| 1.5 | **Build context transition system** | When context switches via WebSocket event → fetch new projection → morph UI with Framer Motion | Create `frontend/src/lib/contextEngine.ts` |
| 1.6 | **Connect existing Sacred Geometry theme** | Use existing `tailwind.config.js` breathing animation + heady color palette, extend with projection's `cssVars` | Modify `frontend/tailwind.config.js`, create `frontend/src/components/SacredGeometryProvider.tsx` |

### Phase 2: Onboarding Experience (Weeks 3-5)

| # | Task | What To Do | Files to Modify/Create |
|---|------|------------|----------------------|
| 2.1 | **Add AI Discovery Interview step** | Chat-like interface where HeadyBuddy asks adaptive questions, uses Claude API via existing `hc_claude_agent.js`, stores discoveries in user profile | Create `frontend/src/components/onboarding/DiscoveryInterview.tsx`, create `src/routes/discovery-api.js` |
| 2.2 | **Build Context Designer visual builder** | Card-based UI where users see suggested contexts (from existing templates), customize layouts by dragging panels, configure AI tools per context | Create `frontend/src/components/onboarding/ContextDesigner.tsx` |
| 2.3 | **Build Live Preview step** | Renders DynamicRenderer with the user's configured contexts, lets them click through each context to preview | Create `frontend/src/components/onboarding/LivePreview.tsx` |
| 2.4 | **Integrate existing buddy-suggestions API** | Wire the `/buddy-suggestions` endpoint (already built) into the onboarding flow to pre-populate context recommendations based on OAuth provider | Modify `ContextDesigner.tsx` to call existing endpoint |
| 2.5 | **Build Service Activation grid** | Grid of toggleable service cards populated from existing `service-catalog.yaml` + `skills-registry.yaml`, auto-resolves dependencies | Create `frontend/src/components/onboarding/ServiceActivation.tsx` |
| 2.6 | **Build Launch sequence** | Calls existing `/finalize` endpoint, provisions contexts via `hc_conductor.js`, redirects to headme.com with live workspace | Modify `src/routes/headyme-onboarding.js` `/finalize`, create `frontend/src/components/onboarding/LaunchSequence.tsx` |
| 2.7 | **Unify headyme.com landing with onboarding app** | Replace the static `sites/headyme/index.html` GCP links with integrated onboarding flow, or serve the Next.js onboarding app directly from headyme.com | Modify `sites/headyme/index.html` or configure routing in `render.yaml` |

### Phase 3: Context Switcher Upgrade (Weeks 5-7)

| # | Task | What To Do | Files to Modify/Create |
|---|------|------------|----------------------|
| 3.1 | **Upgrade ContextSwitcher to persistent bar** | Replace dropdown with horizontal bar at top of workspace, show all contexts with color dots and labels, active context has breathing glow | Rewrite `ContextSwitcher.tsx` |
| 3.2 | **Add cloud environment provisioning** | On context activation, call `hc_cloud_conductor.js` to provision/resume cloud environments (code-server, containers), leverage HOT/WARM/COLD pool strategy | Create `src/context/context-provisioner.js`, wire to `hc_cloud_conductor.js` |
| 3.3 | **Add AI agent reconfiguration** | On context switch, swap MCP tools via existing `mcp-gateway-config.json` pattern, update Claude system prompt via `hc_claude_agent.js`, change skill set via `hc_skill_executor.js` | Create `src/context/context-ai-config.js` |
| 3.4 | **Add pre-warming with HeadyPhi** | Track context usage patterns, φ-rank contexts by frequency, pre-warm top contexts using `hc_task_scheduler.js` | Create `src/context/context-prewarmer.js` |
| 3.5 | **Add keyboard shortcuts** | Ctrl+1/2/3 to switch contexts, Cmd+K for context search | Add to `frontend/src/lib/shortcuts.ts` |
| 3.6 | **Add drag-to-reorder** | Let users drag context tabs to reorder, persist order in user profile | Modify `ContextSwitcher.tsx` |
| 3.7 | **Add context transition animations** | Smooth 300ms morph between layouts using Framer Motion `AnimatePresence` + `layoutId` | Wire into `DynamicRenderer.tsx` |

### Phase 4: HeadyAI-IDE Context (Weeks 7-9)

| # | Task | What To Do | Files to Modify/Create |
|---|------|------------|----------------------|
| 4.1 | **Assemble IDE context from existing configs** | Combine `heady-ide.yaml` (code-server + extensions) + `heady-auto-ide.yaml` (agentic workflows + pattern catalog) into a unified context definition | Create `configs/contexts/headyai-ide.yaml` |
| 4.2 | **Embed code-server** | iframe or window.open code-server instance, configure via existing `heady-ide.yaml` platform configs | Modify `remotes/heady-ide/src/App.js` or create new panel component |
| 4.3 | **Build agentic workflows panel** | Visual panel showing active agent tracks (from `hc_orchestrator.js`), pause/resume/inspect, parallel branch view | Create `frontend/src/components/ide/AgenticWorkflows.tsx` |
| 4.4 | **Build pattern catalog sidebar** | Sidebar listing patterns from `hc_pattern_engine.js` with apply-pattern commands (from `heady-auto-ide.yaml` spec) | Create `frontend/src/components/ide/PatternCatalog.tsx` |
| 4.5 | **Connect to HCFullPipeline** | Show pipeline status/stages in IDE, link tasks to code | Wire `hc_pipeline.js` events through WebSocket |
| 4.6 | **Integrate HeadyBuddy in IDE mode** | HeadyBuddy personality adjusts for coding context (from existing `headybuddy/SYSTEM_PROMPT.md`), exposed via Continue extension config in `heady-ide.yaml` | Configure Continue extension `apiBase` |

### Phase 5: Polish & Deploy (Weeks 9-11)

| # | Task | What To Do | Files to Modify/Create |
|---|------|------------|----------------------|
| 5.1 | **Cross-device sync** | Use existing `src/cross-device-sync.js` + `device-management.yaml` config, persist active context across devices via Redis | Wire `cross-device-sync.js` into context system |
| 5.2 | **Connect Heady MCP server** | Enable the Heady MCP connector at `manager.headysystems.com/mcp/sse` for direct API access from Claude | Test via claude.ai MCP integration |
| 5.3 | **Wire Colab-LiquidMesh Bridge** | For GPU-heavy contexts, route tasks through the Colab bridge (from uploaded code) using HOT/WARM/COLD pools | Create context-aware routing in `src/context/context-gpu-router.js` |
| 5.4 | **Deploy to new repo structure** | Push to today's new Heady-Testing → Heady-Staging → Heady-Main repos | Use existing `nexus_deploy.ps1` pattern |
| 5.5 | **End-to-end testing** | Leverage existing test suite (100+ test files in `tests/`) including `onboarding-orchestrator.test.js`, `cross-device-sync.test.js`, `ide-bridge.test.js` | Add new tests for context switching, dynamic rendering |
| 5.6 | **Performance budget** | Use existing `tests/performance-budget.test.js` to ensure context switches < 100ms UI, < 2s cloud env | Extend performance tests |

---

## PART 4: DATA MODELS NEEDED

### 4.1 Context Profile (extends existing ContextProfile from ContextSwitcher.tsx)

```typescript
interface HeadyContext {
  // From existing ContextSwitcher.tsx
  id: string;
  name: string;
  description?: string;
  color: string;
  systemPrompt?: string;
  tools?: string[];
  active: boolean;

  // NEW: Layout (from UIProjectionEngine)
  projectionType: 'dashboard' | 'companion-chat' | 'command-center' | 
                  'minimal' | 'focus' | 'creative-studio' | 
                  'trading-desk' | 'developer-console';
  templateId: string;          // HeadyBee template ID for projection engine
  customWidgets?: WidgetPlacement[];
  
  // NEW: Cloud Environment
  cloudEnv?: {
    type: 'code-server' | 'jupyter' | 'container' | 'vm';
    image?: string;
    resources: { cpu: number; memoryMB: number; diskGB: number };
    extensions?: string[];
    port?: number;
    pool: 'HOT' | 'WARM' | 'COLD';
  };
  
  // NEW: AI Configuration
  aiConfig?: {
    model: string;
    systemPrompt: string;
    tools: string[];
    skills: string[];           // From skills-registry.yaml
    temperature: number;
    buddyPersonality: string;   // Personality variant for HeadyBuddy
  };
  
  // NEW: Services
  services: string[];           // Service IDs from service-catalog.yaml
  connectors: string[];         // From context templates
  features: string[];
  
  // NEW: State
  order: number;                // Position in context bar
  shortcut?: string;            // Keyboard shortcut
  lastUsed?: string;
  totalTimeMs?: number;
  usageCount?: number;
}
```

### 4.2 Prisma Schema Addition (Add to existing schema.prisma)

```prisma
model Context {
  id              String   @id @default(cuid())
  userId          String
  name            String
  description     String?
  color           String   @default("#00d4ff")
  icon            String?
  order           Int      @default(0)
  projectionType  String   @default("dashboard")
  templateId      String?
  systemPrompt    String?  @db.Text
  tools           Json?    // string[]
  skills          Json?    // string[]
  services        Json?    // string[]
  connectors      Json?    // string[]
  features        Json?    // string[]
  cloudEnvConfig  Json?    // CloudEnv object
  aiConfig        Json?    // AIConfig object
  customWidgets   Json?    // WidgetPlacement[]
  shortcut        String?
  isActive        Boolean  @default(false)
  totalTimeMs     Int      @default(0)
  usageCount      Int      @default(0)
  lastUsedAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([userId, isActive])
}
```

### 4.3 API Endpoints to Create

```
# Context CRUD (new)
GET    /api/contexts                    → List user's contexts
POST   /api/contexts                    → Create context
PUT    /api/contexts/:id                → Update context
DELETE /api/contexts/:id                → Delete
POST   /api/contexts/:id/activate       → Activate (triggers full spin-up)
POST   /api/contexts/:id/deactivate     → Deactivate
GET    /api/contexts/:id/status         → Health/readiness of context
GET    /api/contexts/templates           → Available templates

# Projection (new, wraps existing ui-projection-engine.js)
GET    /api/projection/:userId          → Current active projection
POST   /api/projection/generate         → Generate new projection
POST   /api/projection/switch           → Switch to different template

# Onboarding (extend existing)
POST   /api/onboarding/discover         → Submit discovery answers (AI-driven)
POST   /api/onboarding/contexts/design  → Save context configuration
GET    /api/onboarding/preview           → Get preview projection

# WebSocket events (new)
ws://localhost:3300/ws
  → context:activated          — Context fully ready
  → context:warming            — Cloud env warming up
  → context:ui-projection      — New projection to render
  → onboarding:step-complete   — Step advanced
  → pipeline:status            — Pipeline updates
  → system:health              — Health broadcasts
```

---

## PART 5: WHAT TO BUILD FIRST (Priority Order)

### Minimum Viable Dynamic Context Switcher (1 Week)

1. **Add WebSocket to `heady-manager.js`** — 50 lines of `ws` integration
2. **Create context CRUD routes** — `/api/contexts` backed by the existing Prisma DB
3. **Build `useRealtime` hook** — WebSocket client with reconnection
4. **Upgrade ContextSwitcher to bar** — Persistent horizontal bar, API-fetched profiles
5. **Build DynamicRenderer** — Takes a projection from `ui-projection-engine.js` and renders panels
6. **Wire context switch → projection → render** — Click context → fetch projection → morph UI

### Then Layer On (Weeks 2-4)

7. Cloud environment provisioning per context (via `hc_cloud_conductor.js`)
8. AI agent reconfiguration per context (via `hc_claude_agent.js`)
9. AI-driven discovery interview in onboarding
10. Context Designer visual builder
11. HeadyAI-IDE as a full context

---

## PART 6: EXISTING TEST COVERAGE

Tests already written that relate to this implementation:

| Test File | What It Tests |
|-----------|--------------|
| `tests/onboarding-orchestrator.test.js` | Onboarding flow orchestration |
| `tests/cross-device-sync.test.js` | Cross-device state sync |
| `tests/cross-device-sync.runtime.test.js` | Runtime sync behavior |
| `tests/ide-bridge.test.js` | IDE integration bridge |
| `tests/buddy-core.test.js` | HeadyBuddy core functionality |
| `tests/buddy-core.realtime.test.js` | Real-time buddy features |
| `tests/buddy-chat-contract.test.js` | Buddy chat API contract |
| `tests/buddy-system.test.js` | Full buddy system |
| `tests/hc-full-pipeline.test.js` | Pipeline execution |
| `tests/performance-budget.test.js` | Performance budgets |
| `tests/self-awareness.test.js` | System self-awareness |
| `tests/auto_context_contract.test.js` | Context auto-switching |
| `tests/sacred-geometry-sdk.test.js` | Sacred Geometry SDK |
| `tests/digital-presence-orchestrator.test.js` | Digital presence management |

---

## PART 7: KEY INTEGRATION POINTS

| Existing System | File | How to Integrate |
|----------------|------|-----------------|
| MCP Gateway | `mcp-gateway.js` + `mcp-gateway-config.json` | Swap `allowedTools` per context |
| Claude Agent | `hc_claude_agent.js` | Call `agent.reconfigure()` with context's systemPrompt + tools |
| Cloud Conductor | `hc_cloud_conductor.js` | Call `conductor.provision()` for cloud env contexts |
| Pipeline | `hc_pipeline.js` | Stream pipeline events through WebSocket to active context |
| Skill Executor | `hc_skill_executor.js` | Load/unload skills per context |
| Pattern Engine | `hc_pattern_engine.js` | Feed into IDE context's pattern catalog panel |
| Imagination Engine | `hc_imagination.js` | Power creative context with LLM-backed imagination |
| Story Driver | `hc_story_driver.js` | Drive narrative-based onboarding flow |
| Billing | `hc_billing.js` | Track per-context resource usage + cost |
| HeadyRegistry | `heady-registry.json` (46KB) | Register UI components, contexts, templates |
| Sacred Geometry SDK | `packages/heady-sacred-geometry-sdk/` | Expose φ math for frontend animations |
| Colab Bridge | Uploaded `colab-mesh-bridge.js` | Route GPU tasks per context to HOT/WARM/COLD pools |
| Desktop Overlay | `desktop-overlay/` (Electron) | System tray context switcher |
| Chrome Extension | `extensions/chrome-extension/` | Browser-based context awareness |
| HeadyBuddy PWA | `services/heady-buddy/pwa/` | Mobile context switching |

---

## SUMMARY

The Heady codebase is far more built-out than expected — **70% of the dynamic UI system, 60% of onboarding, and 40% of the context switcher already exist in code.** The main work is:

1. **Unification** — Three parallel onboarding implementations need to become one
2. **Wiring** — The UI Projection Engine (800+ lines, Sacred Geometry scoring) exists but isn't connected to the React frontend
3. **Real-time** — WebSocket layer needs to be added to enable instant context switching without page reloads
4. **Cloud provisioning** — Context switch needs to trigger actual cloud environment spin-up via the existing conductor
5. **AI reconfiguration** — Context switch needs to swap MCP tools and Claude system prompts

The patent portfolio, configs, and engine code provide the full architectural blueprint. The frontend just needs to consume what the backend already generates.
