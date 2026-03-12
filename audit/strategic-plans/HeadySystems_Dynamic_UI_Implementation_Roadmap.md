# HeadySystems Dynamic UI, Onboarding & Context Switcher
## Complete Implementation Roadmap

> **Based on:** Deep scan of `HeadySystems/sandbox` (active), `HeadySystems/main` (archived v13), HeadyMe personal repos, Colab-LiquidMesh Bridge source, 50-patent portfolio, and all YAML configs.

---

## Part 1: What Exists Today (Deep Scan Findings)

### Repository Inventory

| Repo | Language | Status | Purpose |
|------|----------|--------|---------|
| `HeadySystems/sandbox` | JS/TS | **Active** | Monorepo — HeadyManager, HCFullPipeline, frontend, configs |
| `HeadySystems/main` | Python | Archived | Codex v13 builder, patent registry, install packages |
| `HeadySystems/Heady-pre-production` | JavaScript | Archived | Official HeadySystems repo |
| `HeadySystems/ai-workflow-engine` | TypeScript | Archived | Cloudflare Workers + Render + GitHub Actions AI orchestration |
| `HeadySystems/Heady` | Java | Archived | Sacred Geometry Architecture v3.0.0 |
| `HeadySystems/sandbox-pre-production` | Python | Archived | Project checkpoints & file dumps |
| `HeadySystems/headybuddy-web` | N/A | Archived | HeadyBuddy web version |
| HeadyMe (personal) | Mixed | 13 repos | Personal dev repos |

### Current Tech Stack (from sandbox)

| Layer | Technology | Details |
|-------|-----------|---------|
| **Backend / API Gateway** | Node.js + Express | `heady-manager.js` (53KB, port 3300) |
| **Protocol** | MCP (Model Context Protocol) | `@modelcontextprotocol/sdk ^1.0.1` |
| **Frontend** | React 19 + Vite 6 | `frontend/` — `heady-ui` v3.0.0 |
| **Styling** | Tailwind CSS 3.4 | Custom `heady` color palette (green 50-900), `breathe` animation |
| **Icons** | Lucide React | `lucide-react ^0.474.0` |
| **Worker** | Python | `backend/python_worker/`, `src/heady_project/` |
| **Deployment** | Render.com | Web service blueprint in `render.yaml` |
| **AI** | Anthropic Claude | `ANTHROPIC_API_KEY`, Claude Code agent registered |
| **Edge** | Cloudflare Workers | `ai/intel-edge/worker.js` — 15-min cron intel feed |
| **Database** | PostgreSQL | Via Render, `DATABASE_URL` env var |
| **Security** | Helmet, CORS, rate-limiting | `express-rate-limit`, timing-safe API keys |
| **Scheduling** | node-cron | Automated health checks and pipeline runs |
| **Design Language** | Sacred Geometry | Rounded, organic, breathing interfaces |

### Core Engine Architecture (from CLAUDE.md + src/)

The `src/` directory contains the full orchestration engine:

| Module | Size | Purpose |
|--------|------|---------|
| `hc_monte_carlo.js` | 59KB | Monte Carlo scheduling & probabilistic optimization |
| `hc_pipeline.js` | 38KB | Master HCFullPipeline — ingest → plan → execute → recover → finalize |
| `hc_pattern_engine.js` | 28KB | Pattern recognition & application engine |
| `hc_imagination.js` | 36KB | Imagination Engine — creative problem solving |
| `hc_orchestrator.js` | 26KB | Multi-service orchestration |
| `hc_conductor.js` | 26KB | Infrastructure conductor (maps to Patent #30 HeadyConductor) |
| `hc_claude_agent.js` | 26KB | Claude AI agent integration |
| `hc_pipeline.js` | 38KB | Pipeline runtime with checkpoints |
| `hc_performance_profiler.js` | 25KB | Performance profiling & optimization |
| `hc_self_critique.js` | 19KB | Self-critique/reflection system (maps to Patent #29 HeadyReflect) |
| `hc_resource_manager.js` | 19KB | Resource management with budgets |
| `hc_secrets_manager.js` | 18KB | Secrets & credential management |
| `hc_task_scheduler.js` | 18KB | Task scheduling & queue management |
| `hc_story_driver.js` | 17KB | Narrative-driven task execution |
| `hc_skill_executor.js` | 14KB | Skill execution engine |
| `hc_imagination_llm.js` | 14KB | LLM-powered imagination |
| `hc_cloud_conductor.js` | 14KB | Cloud infrastructure provisioning |
| `hc_cloudflare.js` | 15KB | Cloudflare Workers integration |
| `hc_billing.js` | 12KB | Billing & cost tracking |
| `hc_integration_fabric.js` | 8.8KB | Service integration layer |
| `heady-manager.js` | 53KB | MCP server + Express API gateway |

### Existing Config System (55+ YAML configs!)

Critical configs for the implementation:

| Config | Size | Relevance |
|--------|------|-----------|
| `heady-ide.yaml` | 6.5KB | HeadyIDE spec — code-server, extensions, Sacred Geometry theme |
| `heady-auto-ide.yaml` | 6.5KB | Agentic IDE — spec-driven development, pattern catalog |
| `heady-buddy.yaml` | 11.5KB | HeadyBuddy companion — cross-device presence, launch modes |
| `heady-buddy-always-on.yaml` | 8.1KB | Always-on companion behavior |
| `skills-registry.yaml` | 24KB | Complete skills registry |
| `system-self-awareness.yaml` | 22KB | System self-awareness definitions |
| `universal-domains.yaml` | 26KB | Universal domain architecture |
| `branded-domains.yaml` | 18KB | Branded domain mappings |
| `heady-com-domains.yaml` | 18KB | Domain structure for heady.com ecosystem |
| `imagination-engine.yaml` | 7.5KB | Imagination engine config |
| `story-driver.yaml` | 10KB | Narrative-driven UX config |
| `activation-manifest.yaml` | 12KB | System activation sequencing |
| `domain-architecture.yaml` | 6.7KB | Domain boundary definitions |
| `service-discovery.yaml` | 8.7KB | Service mesh discovery |
| `device-management.yaml` | 11KB | Cross-device management |

### Patent Portfolio Directly Relevant to This Implementation

| # | Name | What It Specifies |
|---|------|-------------------|
| **23** | **HeadyUI** | Context-aware UI dynamically injecting controls based on real-time task & state + feedback loop |
| **30** | **HeadyConductor** | Spinning up/destroying nodes based on specific task intent + JIT attestation |
| **20** | **HeadyEd** | Adaptive engine generating personalized curricula via knowledge graph traversal |
| **24** | **HeadyLearn** | Knowledge capture from successful interaction patterns for community use |
| **26** | **HeadyStore** | Dynamic, transient, personalized interface generation matching user query |
| **34** | **HeadyPhi** | Golden Ratio optimization for retries, scaling, decay |
| **31** | **HeadyResonance** | Phase-shifting optimization to avoid destructive interference |
| **29** | **HeadyReflect** | Mandatory recursive self-questioning before acting |
| **45** | **HeadyBare** | JIT bare-metal provisioning — flash specialized firmware in seconds |
| **11** | **AI Tool Safety Gateway** | Two-phase confirmation for high-risk actions |

### What's Missing (Gaps to Fill)

Based on the scan, here's what **does not yet exist** but is needed:

1. **No real-time WebSocket/SSE layer** — The manager uses REST only. No live push to clients.
2. **No onboarding flow** — No wizard, setup, or first-run experience anywhere in the codebase.
3. **No context switcher UI** — HeadyBuddy YAML defines launch modes conceptually but no implementation.
4. **No dynamic UI renderer** — HeadyUI patent is filed but no component that renders UI from state exists.
5. **No user preference/profile store** — No user model, preferences schema, or personalization DB.
6. **No headyme.com frontend** — The site doesn't exist yet as a deployed application.
7. **No auth system** — API key auth only; no user accounts, OAuth, or session management.

---

## Part 2: Dynamic UI System Architecture

### 2.1 Core Concept: State-Driven UI Rendering

Based on Patent #23 (HeadyUI) and the existing config-driven architecture, the Dynamic UI system should work like this:

```
User State + System State + Context Config
         ↓
    UI State Machine
         ↓
    Component Registry
         ↓
   Rendered Interface
         ↓
   User Interaction
         ↓
   Feedback Loop → State Update → Re-render
```

### 2.2 Data Models Required

#### User Profile Schema

```typescript
interface HeadyUserProfile {
  id: string;                    // Sovereign identity (Patent #3)
  displayName: string;
  email: string;
  onboardingState: OnboardingState;
  contexts: UserContext[];        // Their configured contexts
  activeContextId: string;
  preferences: {
    theme: 'light' | 'dark' | 'sacred-geometry';
    layout: 'compact' | 'expanded' | 'zen';
    animationLevel: 'none' | 'subtle' | 'breathing';  // Sacred Geometry breathing
    colorScheme: string;         // From HeadyPhi palette
  };
  deviceProfiles: DeviceProfile[];
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  interests: string[];           // Discovered during onboarding
  activeSubscriptions: string[];
  createdAt: string;
  lastActiveAt: string;
}

interface OnboardingState {
  completed: boolean;
  currentStep: number;
  totalSteps: number;
  discoveries: Discovery[];      // What we've learned about the user
  selectedContexts: string[];    // Contexts they've chosen to set up
  configuredServices: string[];  // Services they've activated
}

interface Discovery {
  key: string;
  value: any;
  source: 'explicit' | 'inferred' | 'behavioral';
  confidence: number;            // 0-1 confidence score
  timestamp: string;
}
```

#### Context Definition Schema

```typescript
interface UserContext {
  id: string;
  label: string;                 // e.g., "HeadyAI-IDE"
  icon: string;                  // Lucide icon name
  description: string;
  color: string;                 // Brand color
  type: 'ide' | 'dashboard' | 'creative' | 'admin' | 'custom';
  
  // What spins up when this context is activated
  activation: {
    // UI Layout
    layout: LayoutConfig;
    panels: PanelConfig[];
    toolbar: ToolbarConfig;
    
    // Cloud Environment
    cloudEnv?: {
      type: 'code-server' | 'jupyter' | 'container' | 'vm';
      image?: string;
      resources: ResourceSpec;
      extensions?: string[];
      mountPoints?: MountPoint[];
    };
    
    // AI Agent Configuration
    aiConfig?: {
      primaryModel: string;
      systemPrompt: string;
      tools: string[];           // MCP tools to activate
      temperature: number;
      contextWindow: number;
      skills: string[];          // From skills-registry.yaml
    };
    
    // Services to activate
    services: ServiceActivation[];
    
    // Keyboard shortcuts
    shortcuts: Shortcut[];
  };
  
  // State persistence
  state: {
    lastUsed: string;
    totalTimeSpent: number;
    pinnedItems: string[];
    recentFiles: string[];
  };
}

interface LayoutConfig {
  template: 'single-pane' | 'split-horizontal' | 'split-vertical' | 'quad' | 'custom';
  sidebar: 'left' | 'right' | 'none' | 'both';
  sidebarWidth: number;          // Percentage
  headerVisible: boolean;
  footerVisible: boolean;
  breathingEnabled: boolean;     // Sacred Geometry animation
}

interface PanelConfig {
  id: string;
  component: string;             // React component name from registry
  position: 'main' | 'sidebar' | 'bottom' | 'floating';
  props: Record<string, any>;
  visible: boolean;
  resizable: boolean;
}
```

#### UI Component Registry

```typescript
interface ComponentRegistry {
  components: {
    [componentId: string]: {
      name: string;
      category: 'layout' | 'widget' | 'panel' | 'overlay' | 'control';
      component: React.ComponentType;
      defaultProps: Record<string, any>;
      requiredServices: string[];
      contextTypes: string[];     // Which context types can use this
      responsive: boolean;
      sacredGeometry: boolean;    // Uses breathing/organic styling
    };
  };
}
```

### 2.3 Real-Time Infrastructure

The biggest gap is real-time communication. Here's what needs to be built:

#### WebSocket Layer (Add to heady-manager.js)

```
New Module: src/hc_realtime.js
├── WebSocket server on ws://localhost:3300/ws
├── Event channels:
│   ├── user:{userId}:state       — User state changes
│   ├── context:{contextId}:event — Context-specific events
│   ├── pipeline:status           — Pipeline execution updates
│   ├── system:health             — System health broadcasts
│   └── onboarding:{userId}:step  — Onboarding progress
├── Authentication via JWT (already configured in mcp-gateway-config.json)
└── Reconnection with exponential backoff (HeadyPhi golden ratio)
```

#### Server-Sent Events (Alternative/Complement)

For simpler unidirectional updates (system status, pipeline progress), SSE may be preferable:

```
GET /api/events/stream
├── event: pipeline-status
├── event: health-check
├── event: context-change
└── event: onboarding-progress
```

### 2.4 Component Architecture

```
frontend/src/
├── components/
│   ├── core/
│   │   ├── DynamicRenderer.tsx       — State-driven UI renderer
│   │   ├── ContextSwitcher.tsx       — The context switching bar
│   │   ├── PanelManager.tsx          — Dynamic panel layout manager
│   │   ├── BreathingContainer.tsx    — Sacred Geometry breathing wrapper
│   │   └── SacredGeometryTheme.tsx   — Theme provider
│   ├── onboarding/
│   │   ├── OnboardingOrchestrator.tsx  — Main onboarding flow controller
│   │   ├── WelcomeStep.tsx           — Initial welcome + identity
│   │   ├── DiscoveryStep.tsx         — Interest/skill discovery
│   │   ├── ContextDesigner.tsx       — Visual context configuration
│   │   ├── ServiceActivation.tsx     — Service selection + activation
│   │   ├── EnvironmentPreview.tsx    — Live preview of configured setup
│   │   └── CompletionCelebration.tsx — Onboarding complete celebration
│   ├── contexts/
│   │   ├── IDEContext.tsx            — HeadyAI-IDE full context
│   │   ├── DashboardContext.tsx      — Admin dashboard context
│   │   ├── CreativeContext.tsx       — Creative/design context
│   │   └── CustomContext.tsx         — User-defined context shell
│   ├── widgets/
│   │   ├── BuddyChat.tsx            — HeadyBuddy AI chat widget
│   │   ├── PipelineStatus.tsx        — HCFullPipeline live status
│   │   ├── ResourceMonitor.tsx       — Resource usage dashboard
│   │   ├── SkillBrowser.tsx          — Browse available skills
│   │   └── PatternCatalog.tsx        — Pattern library browser
│   └── shared/
│       ├── PhiLayout.tsx             — Golden ratio layout primitives
│       ├── OrganicCard.tsx           — Rounded, breathing card
│       └── TransitionWrapper.tsx     — Smooth context transitions
├── hooks/
│   ├── useRealtime.ts               — WebSocket connection hook
│   ├── useContext.ts                 — Active context management
│   ├── useOnboarding.ts             — Onboarding state management
│   └── useSacredGeometry.ts         — Breathing animation timing
├── stores/
│   ├── userStore.ts                 — User profile & preferences
│   ├── contextStore.ts              — Context definitions & state
│   └── uiStore.ts                   — Dynamic UI state
└── lib/
    ├── contextEngine.ts             — Context activation/deactivation logic
    ├── componentRegistry.ts         — Dynamic component registry
    └── phiMath.ts                   — Golden ratio utilities (from shared/phi-math.js)
```

---

## Part 3: The Onboarding Experience

### 3.1 Flow: HeadyMe.com → Configured Workspace

The onboarding is a journey from "I just landed on headyme.com" to "My perfect Heady workspace is live."

```
                    headyme.com Landing
                          │
                    ┌─────▼──────┐
                    │  Welcome    │  "Hey, I'm Heady Buddy."
                    │  + Sign Up  │  Warm, minimal, breathing UI
                    └─────┬──────┘
                          │
                    ┌─────▼──────┐
                    │  Discovery  │  AI-driven conversation
                    │  Interview  │  "What brings you here?"
                    └─────┬──────┘
                          │
                    ┌─────▼──────┐
                    │  Context    │  Visual builder
                    │  Designer   │  Drag, configure, preview
                    └─────┬──────┘
                          │
                    ┌─────▼──────┐
                    │  Service    │  One-click activations
                    │  Activation │  Toggle what you need
                    └─────┬──────┘
                          │
                    ┌─────▼──────┐
                    │  Live       │  See your workspace
                    │  Preview    │  before committing
                    └─────┬──────┘
                          │
                    ┌─────▼──────┐
                    │  Launch!    │  Context switcher
                    │  headme.com │  is ready
                    └─────────────┘
```

### 3.2 Step-by-Step Onboarding Design

#### Step 1: Welcome (headyme.com landing)

The landing page is the first impression. It should embody Sacred Geometry — organic, breathing, alive.

**What the user sees:**
- Full-screen animated background with subtle golden ratio spirals
- Central breathing orb (the Heady Buddy avatar)
- Single line: "Welcome to Heady. Let's build your world."
- Two options: "Sign Up" / "I already have an account"

**Technical requirements:**
- Static site deployable to Vercel/Render (React + Vite)
- Auth integration (OAuth2 — Google, GitHub, email)
- User profile creation on signup
- Device fingerprinting for cross-device recognition (Patent #5 Biometric-Locked Keys simplified)

#### Step 2: Discovery Interview

HeadyBuddy conducts an intelligent, conversational interview to understand the user.

**What the user sees:**
- Chat-like interface with HeadyBuddy
- HeadyBuddy asks questions, adapts based on answers
- Progress indicator shows discovery completeness
- Each answer visually builds out their profile in real-time on a side panel

**Discovery questions (AI-adaptive):**
1. "What's your primary role?" → Developer, Designer, Creator, Business, Student, Other
2. "What are you building?" → Free-form, AI categorizes
3. "How technical are you?" → Inferred from language + explicit scale
4. "What tools do you already use?" → Multi-select + "I'll figure it out"
5. "What does your ideal workspace look like?" → Visual preference selector
6. "How many devices do you work across?" → Desktop, mobile, tablet
7. "What matters most to you?" → Speed, Security, Aesthetics, Power, Simplicity

**AI engine behind it:**
- Uses Claude API via `hc_claude_agent.js` existing infrastructure
- System prompt incorporates HeadyEd (Patent #20) adaptive curriculum logic
- Each answer updates the user profile and adjusts remaining questions
- HeadyLearn (Patent #24) captures the pattern for future users

**Data captured → Discovery objects:**
```json
{
  "discoveries": [
    { "key": "role", "value": "developer", "source": "explicit", "confidence": 1.0 },
    { "key": "skillLevel", "value": "advanced", "source": "inferred", "confidence": 0.85 },
    { "key": "primaryInterest", "value": "ai-development", "source": "explicit", "confidence": 1.0 },
    { "key": "preferredLayout", "value": "split-horizontal", "source": "explicit", "confidence": 1.0 },
    { "key": "deviceCount", "value": 3, "source": "explicit", "confidence": 1.0 }
  ]
}
```

#### Step 3: Context Designer

Based on discoveries, HeadyBuddy suggests initial contexts and lets the user customize.

**What the user sees:**
- Card-based context builder
- Pre-populated suggestions based on their role/interests
- Each context card shows: icon, name, description, what it includes
- Drag to reorder, click to customize, + button to add custom
- Real-time preview of the context switcher bar as they build

**Pre-built context templates (suggested based on Discovery):**

For a developer who said "AI development":
1. **HeadyAI-IDE** — Full code-server IDE with Claude integration, terminal, git
2. **Dashboard** — System health, pipeline status, resource monitor
3. **Research** — Intel edge feeds, documentation browser, knowledge graph
4. **Creative** — HeadySymphony music, HeadyStudio media, imagination engine

For a business user:
1. **Command Center** — KPIs, pipeline overview, team status
2. **Communications** — HeadyBuddy chat, email integration, notifications
3. **Documents** — Doc editor, templates, governance policies
4. **Analytics** — Monte Carlo simulations, performance reports

**Context customization flow:**
```
Click "HeadyAI-IDE" card
  → Opens customization panel
  → Layout selector (visual, drag panels)
  → Extension picker (from skills-registry.yaml)
  → AI model config (which Claude model, what tools)
  → Cloud resource slider (CPU, RAM, storage)
  → Theme picker (breathing intensity, color override)
  → Save → Card updates with preview
```

#### Step 4: Service Activation

One-click toggles for the services each context needs.

**What the user sees:**
- Grid of service cards organized by category
- Each card: service name, icon, one-line description, toggle switch
- Dependencies auto-resolved (turning on IDE auto-enables filesystem access)
- Cost indicators where applicable
- "Activate All Recommended" button

**Service categories (from service-catalog.yaml):**
- **Core:** HeadyBuddy, HeadyManager, Authentication
- **Development:** HeadyIDE, code-server, Git integration
- **AI:** Claude Agent, Imagination Engine, Pattern Engine
- **Infrastructure:** Cloud Conductor, Resource Manager, Health Checks
- **Data:** PostgreSQL, Vector Store (Colab bridge), Secrets Manager
- **Creative:** HeadySymphony, HeadyStudio, HeadyStyle

#### Step 5: Live Preview

Before committing, the user sees exactly what their workspace will look like.

**What the user sees:**
- Full-screen preview of their configured headme.com
- Context switcher bar at the top with their contexts
- Click through each context to see the layout
- HeadyBuddy floating in corner: "Looking good! Want to adjust anything?"
- "Launch My Workspace" button

**Technical implementation:**
- Renders actual React components with their config
- Uses the DynamicRenderer with their LayoutConfig
- Pulls real (but sandboxed) data for pipeline status
- Demonstrates the breathing animation at their chosen intensity

#### Step 6: Launch → headme.com

**What happens:**
1. User profile saved to PostgreSQL
2. Context configs written to user's namespace in heady-registry
3. Cloud environments provisioned (HeadyConductor Patent #30)
4. MCP tools activated per context
5. DNS/routing configured for their headme.com instance
6. Redirect to their personalized headme.com
7. Context switcher is live and functional

### 3.3 Onboarding Data Flow

```
headyme.com (React)
    │
    ├── POST /api/auth/signup          → Create user
    ├── WS  /ws                        → Real-time updates
    ├── POST /api/onboarding/discover  → Send discovery answers
    ├── POST /api/onboarding/contexts  → Save context configs
    ├── POST /api/onboarding/services  → Activate services
    ├── POST /api/onboarding/preview   → Generate preview config
    └── POST /api/onboarding/launch    → Provision everything
            │
            ├── HeadyConductor.provision(contexts)
            ├── HeadyRegistry.createUserNamespace(userId)
            ├── MCPGateway.activateTools(services)
            └── Redirect → headme.com/{userId}
```

---

## Part 4: Context Switcher Deep Dive

### 4.1 The Context Switcher UI

The context switcher is a persistent bar that lives at the top of headme.com. It's always visible, always instant.

```
┌─────────────────────────────────────────────────────────────────┐
│  🟢 HeadyAI-IDE  │  📊 Dashboard  │  🔬 Research  │  🎨 Creative  │  ⚙️ │
└─────────────────────────────────────────────────────────────────┘
     ▲ active                                               settings
```

**Behavior:**
- Click a context → entire workspace transforms instantly
- Active context has a breathing glow (Sacred Geometry)
- Drag to reorder
- Right-click for context settings
- ⚙️ opens context manager (add, edit, delete contexts)
- Keyboard shortcut: `Ctrl+1`, `Ctrl+2`, etc. to switch
- Transition: smooth 300ms morph animation (not a page reload)

### 4.2 What "Instantly Spins Up" Means

When a user clicks "HeadyAI-IDE" on the context switcher, three things happen simultaneously:

#### Layer 1: UI Transformation (Instant — <100ms)
- Layout manager reads the context's `LayoutConfig`
- Panels are shown/hidden/rearranged via React state
- Theme adjusts (colors, breathing intensity)
- Toolbar reconfigures with context-specific actions
- This is purely client-side — no server round-trip

#### Layer 2: Cloud Environment Activation (Warm — <2s)
- If the context has a `cloudEnv` config:
  - **HOT pool:** Pre-warmed environments stay running (code-server, always-on containers)
  - **WARM pool:** Hibernated environments wake up (paused containers resume)
  - **COLD pool:** New environments provision on demand (fresh VMs, new Colab runtimes)
- The Colab-LiquidMesh Bridge (from your uploaded code) routes GPU tasks to the right runtime
- HeadyConductor (Patent #30) manages the JIT provisioning
- HeadyBare (Patent #45) flashes specialized firmware if needed

#### Layer 3: AI Agent Reconfiguration (Instant — <100ms)
- MCP tools are swapped based on context config
- System prompt updates for the Claude agent
- Tool permissions change (filesystem access scope changes)
- Skills from skills-registry.yaml are activated/deactivated
- HeadyBuddy's personality adjusts to the context (more technical in IDE, more friendly in Creative)

### 4.3 Pre-Warming Strategy (HeadyPhi Optimization)

Using Patent #34 (HeadyPhi — Golden Ratio optimization):

```
Context Usage Tracking:
  - Record: context_id, activation_time, duration, time_of_day
  - Build: usage probability model per time-of-day
  - Pre-warm: Top contexts by φ-weighted probability

Pre-warming Rules:
  - Always HOT: User's most-used context (>40% usage)
  - WARM pool: Next 2 contexts by φ-ranked frequency
  - COLD: Everything else
  
  Re-evaluate pool assignments every φ² hours (≈2.618 hours)
```

### 4.4 Context Switcher API Endpoints

```
New endpoints for heady-manager.js:

GET    /api/contexts                    → List user's contexts
POST   /api/contexts                    → Create new context
PUT    /api/contexts/:id                → Update context config
DELETE /api/contexts/:id                → Delete context
POST   /api/contexts/:id/activate       → Activate context (trigger spin-up)
POST   /api/contexts/:id/deactivate     → Deactivate context
GET    /api/contexts/:id/status         → Context health/readiness
POST   /api/contexts/:id/preview        → Generate preview without activating
GET    /api/contexts/templates           → List available templates
POST   /api/contexts/from-template      → Create context from template

WebSocket events:
  context:activated     → Sent when context is fully ready
  context:warming       → Sent during warm-up phase
  context:error         → Sent if activation fails
  context:state-change  → Any context state update
```

---

## Part 5: Implementation Task Breakdown

### Phase 1: Foundation (Weeks 1-3)

| # | Task | Priority | Estimated Effort | Dependencies |
|---|------|----------|-----------------|--------------|
| 1.1 | **Add WebSocket/SSE layer to heady-manager.js** | CRITICAL | 3 days | None |
| 1.2 | **Create user profile schema + PostgreSQL migrations** | CRITICAL | 2 days | None |
| 1.3 | **Implement auth system (OAuth2 + JWT)** | CRITICAL | 3 days | 1.2 |
| 1.4 | **Create component registry pattern in frontend** | HIGH | 2 days | None |
| 1.5 | **Build DynamicRenderer component** | HIGH | 3 days | 1.4 |
| 1.6 | **Implement Sacred Geometry theme system (extend tailwind)** | MEDIUM | 2 days | None |
| 1.7 | **Create `useRealtime` WebSocket hook** | HIGH | 1 day | 1.1 |
| 1.8 | **Build user preference store (Zustand or Jotai)** | HIGH | 1 day | 1.2 |

### Phase 2: Context Switcher Core (Weeks 3-5)

| # | Task | Priority | Estimated Effort | Dependencies |
|---|------|----------|-----------------|--------------|
| 2.1 | **Design context data model + DB schema** | CRITICAL | 2 days | 1.2 |
| 2.2 | **Build context CRUD API endpoints** | CRITICAL | 2 days | 2.1 |
| 2.3 | **Build ContextSwitcher bar component** | CRITICAL | 3 days | 1.4, 1.5 |
| 2.4 | **Implement PanelManager (dynamic layout engine)** | HIGH | 4 days | 1.5 |
| 2.5 | **Build context activation/deactivation engine** | HIGH | 3 days | 2.2 |
| 2.6 | **Integrate HeadyConductor for cloud env provisioning** | HIGH | 4 days | 2.5 |
| 2.7 | **Build MCP tool swapping per context** | HIGH | 2 days | 2.5 |
| 2.8 | **Implement context transition animations** | MEDIUM | 2 days | 2.3 |
| 2.9 | **Build pre-warming scheduler (HeadyPhi)** | MEDIUM | 2 days | 2.5 |
| 2.10 | **Create context template library** | MEDIUM | 2 days | 2.1 |

### Phase 3: Onboarding Experience (Weeks 5-8)

| # | Task | Priority | Estimated Effort | Dependencies |
|---|------|----------|-----------------|--------------|
| 3.1 | **Design headyme.com landing page** | CRITICAL | 3 days | 1.6 |
| 3.2 | **Build Welcome step (signup flow)** | CRITICAL | 2 days | 1.3 |
| 3.3 | **Build Discovery Interview (AI-driven)** | CRITICAL | 5 days | 1.7, Claude API |
| 3.4 | **Create discovery → profile mapping engine** | HIGH | 3 days | 3.3 |
| 3.5 | **Build Context Designer (visual builder)** | HIGH | 5 days | 2.1, 2.3 |
| 3.6 | **Build Service Activation grid** | HIGH | 3 days | Service catalog |
| 3.7 | **Build Live Preview renderer** | HIGH | 3 days | 1.5, 2.3 |
| 3.8 | **Build Launch sequence (full provisioning)** | HIGH | 4 days | 2.6, 2.7 |
| 3.9 | **Create onboarding analytics/tracking** | MEDIUM | 2 days | 3.3 |
| 3.10 | **Build re-onboarding flow (edit setup later)** | MEDIUM | 2 days | 3.5 |

### Phase 4: HeadyAI-IDE Context (Weeks 8-10)

| # | Task | Priority | Estimated Effort | Dependencies |
|---|------|----------|-----------------|--------------|
| 4.1 | **Integrate code-server as embeddable iframe/component** | CRITICAL | 3 days | heady-ide.yaml |
| 4.2 | **Build IDE panel layout (editor, terminal, explorer)** | HIGH | 3 days | 2.4 |
| 4.3 | **Integrate Continue extension + HeadyBuddy model** | HIGH | 3 days | 4.1 |
| 4.4 | **Build agentic workflows panel (from heady-auto-ide.yaml)** | HIGH | 4 days | 4.1 |
| 4.5 | **Implement spec workspace (versioned specs alongside code)** | MEDIUM | 3 days | 4.1 |
| 4.6 | **Build pattern catalog sidebar** | MEDIUM | 2 days | Pattern engine |
| 4.7 | **Connect IDE to HCFullPipeline for task tracking** | MEDIUM | 2 days | Pipeline API |

### Phase 5: Polish & Integration (Weeks 10-12)

| # | Task | Priority | Estimated Effort | Dependencies |
|---|------|----------|-----------------|--------------|
| 5.1 | **Cross-device sync (HeadyBuddy always-on)** | HIGH | 4 days | 1.1, 1.2 |
| 5.2 | **Keyboard shortcut system** | MEDIUM | 2 days | 2.3 |
| 5.3 | **Context usage analytics + HeadyPhi optimization** | MEDIUM | 3 days | 2.9 |
| 5.4 | **Error recovery & degraded mode** | HIGH | 3 days | All |
| 5.5 | **Performance optimization (lazy loading, code splitting)** | HIGH | 3 days | All |
| 5.6 | **Accessibility audit + fixes** | HIGH | 2 days | All |
| 5.7 | **HeadyBuddy personality per context** | MEDIUM | 2 days | 2.7 |
| 5.8 | **Colab-LiquidMesh integration for GPU contexts** | MEDIUM | 3 days | Bridge code |
| 5.9 | **End-to-end testing** | HIGH | 4 days | All |
| 5.10 | **Deploy headyme.com + headme.com** | CRITICAL | 2 days | All |

---

## Part 6: Quick-Start Implementation Guide

### Start Here: The Minimum Viable Context Switcher

If you want to see results fast, build these 5 things first:

1. **Add a user model to PostgreSQL** with context configs as JSONB
2. **Add WebSocket to heady-manager.js** (ws library, 50 lines)
3. **Build the ContextSwitcher React component** with hardcoded contexts first
4. **Build the DynamicRenderer** that reads context config and renders panels
5. **Wire them together** — clicking a context sends WS message → manager routes → UI re-renders

That gives you a working context switcher in ~1 week. Then layer on onboarding, cloud provisioning, and AI configuration iteratively.

### Technology Recommendations

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| State management | **Zustand** | Lightweight, works with existing React 19, no boilerplate |
| WebSocket client | **native WebSocket + reconnecting-websocket** | No heavy deps, matches Express backend |
| WebSocket server | **ws** npm package | Pairs with Express, already in Node ecosystem |
| Auth | **Clerk or Auth.js** | OAuth2 + JWT, works with React + Express |
| DB ORM | **Drizzle** | TypeScript-first, lightweight, great with PostgreSQL |
| Animation | **Framer Motion** | Smooth context transitions, breathing effects |
| Layout engine | **react-grid-layout** | Drag-and-drop panel management |

### Key Integration Points with Existing Code

| Existing System | Integration Point | What to Build |
|----------------|-------------------|---------------|
| `heady-manager.js` | Express routes | Add `/api/contexts/*`, `/api/onboarding/*`, `/ws` |
| `hc_conductor.js` | Cloud provisioning | Call `conductor.provision()` on context activation |
| `hc_claude_agent.js` | AI config swap | Call `agent.reconfigure()` on context switch |
| `hc_pipeline.js` | Pipeline status | Stream pipeline events to WebSocket |
| `hc_skill_executor.js` | Skill activation | Load/unload skills per context |
| `heady-registry.json` | Component catalog | Register UI components in the registry |
| `configs/skills-registry.yaml` | Skill browser | Feed into onboarding service activation |
| `configs/heady-buddy.yaml` | Buddy personality | Switch personality config per context |
| Colab-LiquidMesh Bridge | GPU routing | Route GPU tasks to appropriate runtime per context |
| `mcp-gateway-config.json` | Tool permissions | Swap allowed tools per context |

---

## Part 7: File-by-File Changes Needed

### Modify Existing Files

| File | Change |
|------|--------|
| `heady-manager.js` | Add WebSocket server, add `/api/contexts/*` routes, add `/api/onboarding/*` routes, add `/api/auth/*` routes |
| `package.json` | Add: `ws`, `jsonwebtoken`, `bcrypt`, `drizzle-orm`, `pg`, `@auth/core` |
| `frontend/package.json` | Add: `zustand`, `framer-motion`, `react-grid-layout`, `reconnecting-websocket` |
| `frontend/tailwind.config.js` | Extend with Sacred Geometry animations, add more breathing variants |
| `render.yaml` | Add headyme.com and headme.com services |
| `heady-registry.json` | Add UI component entries, context template entries |

### Create New Files

| File | Purpose |
|------|---------|
| `src/hc_realtime.js` | WebSocket server + event bus |
| `src/hc_context_engine.js` | Context activation/deactivation/pre-warming |
| `src/hc_onboarding.js` | Onboarding orchestration + discovery AI |
| `src/hc_user_manager.js` | User profiles, preferences, auth |
| `src/routes/contexts.js` | Context CRUD API routes |
| `src/routes/onboarding.js` | Onboarding flow API routes |
| `src/routes/auth.js` | Authentication routes |
| `db/schema.ts` | Drizzle schema (users, contexts, discoveries) |
| `db/migrations/` | PostgreSQL migration files |
| `frontend/src/components/core/ContextSwitcher.tsx` | The context switcher bar |
| `frontend/src/components/core/DynamicRenderer.tsx` | State-driven UI renderer |
| `frontend/src/components/core/PanelManager.tsx` | Layout management |
| `frontend/src/components/onboarding/*` | All onboarding step components |
| `frontend/src/hooks/useRealtime.ts` | WebSocket hook |
| `frontend/src/hooks/useContext.ts` | Context management hook |
| `frontend/src/stores/contextStore.ts` | Zustand context store |
| `frontend/src/stores/userStore.ts` | Zustand user store |
| `frontend/src/lib/contextEngine.ts` | Client-side context logic |
| `frontend/src/lib/componentRegistry.ts` | Dynamic component registry |
| `configs/onboarding.yaml` | Onboarding flow config |
| `configs/context-templates.yaml` | Pre-built context templates |

---

## Summary

**Total estimated effort:** ~12 weeks for a single developer, ~6 weeks with a 2-person team.

**The three pillars are:**
1. **Dynamic UI System** — DynamicRenderer + PanelManager + ComponentRegistry reading from context configs
2. **Onboarding Flow** — AI-driven discovery at headyme.com → Context Designer → Launch at headme.com
3. **Context Switcher** — Persistent bar that instantly swaps UI layouts + cloud environments + AI configs

**Everything builds on what already exists:** The heady-manager.js MCP server, the HCFullPipeline, the 55+ YAML configs, the conductor/orchestrator engines, the Claude agent integration, and the React/Vite/Tailwind frontend. The patent portfolio provides the intellectual framework; the code provides the execution layer. The gap is the user-facing dynamic UI, the real-time layer, and the onboarding journey.

**Connect the Heady MCP server** (suggested above) to unlock scanning of the private repos for even deeper integration points.
