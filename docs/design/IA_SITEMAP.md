<!-- ╔══════════════════════════════════════════════════════════════════╗
     ║  HEADY™ IA & Sitemap v1.0.0 — docs/design bundle                  ║
     ║  Two surfaces (admin 1ime1.com · user headyme.com), one canon.    ║
     ║  Service IA derived from src/hc_service_dispatcher.js             ║
     ║  SERVICE_CATALOG. © 2026 HeadySystems Inc. — Eric Haywood         ║
     ╚══════════════════════════════════════════════════════════════════╝ -->

# Information Architecture — admin (1ime1.com) + user (headyme.com)

Domain assignments per canon: `docs/HEADY_MASTER_CONTEXT.md` — "Admin surface: 1ime1.com"; `docs/HEADYME_LAUNCH_RUNBOOK.md` — headyme.com is the user-facing welcome → onboarding → workspace → HeadyBuddy journey. The portal codebase serving the admin surface is `apps/headyme-portal` (currently live at `heady-ai.web.app`; see canon-gaps in README.md for the domain-naming drift).

## The three-altitude model

Every piece of information lives at exactly one altitude; navigation moves *down* altitudes, never sideways into dead ends. (Altitude framing follows the repo's established pattern — e.g. `docs/compendium/02-bees-and-swarms.md` "same conceptual layer at three altitudes".)

| Altitude | Surface | Question answered | Refresh cadence |
|---|---|---|---|
| **A1 — Glanceable dashboard** | living-dashboard home | "Is everything OK, and if not, what needs *me*?" | φ⁷ heartbeat 29 034 ms probes; SSE pushes |
| **A2 — HeadyLens feed** | time-ordered, detail-graded event stream | "What exactly happened, in what order, decided by whom?" | live SSE (`/api/lens/stream`), detail tiers up to `forensic` |
| **A3 — Compendium deep-read** | `docs/compendium/` + ADRs rendered read-only | "Why is the system shaped this way?" | static, versioned with the repo |

Rule: every A1 cell links to its A2 filter (`subject=` prefix); every A2 record type links to its A3 explanation (ADR/compendium section). Nothing at A1 exists that cannot be drilled.

## Surface 1 — Admin: `1ime1.com` (apps/headyme-portal)

Audience: Heady engineers (the founder). Firebase-auth'd, internal-first (ADR-0026). Fonts: Space Grotesk display / JetBrains Mono machine values.

```
1ime1.com
├── / ................................. Living-dashboard home (A1)
│   ├── <heady-gate-banner> ........... coherence Gate GREEN/AMBER/RED — the page's first fact
│   ├── <heady-honeycomb> ............. connector/service hex cells, self-reported state
│   │                                   (teal healthy · violet degraded/projection ·
│   │                                    amber blocked/token_expired · red fail)
│   ├── <heady-blocked-list> .......... "Needs you": every blocked item + blockedReason
│   │                                   + one-tap unblock (Re-authorize pattern)
│   └── <heady-coherence-spark> ....... score vs φ-bands (0.882 / 0.691)
│
├── /scaffold ......................... Scaffold Planner (exists: ScaffoldPlannerUI)
│   │                                   accept · defer · replan per option; two builds
│   └── data: /scaffold-plan.json · /api/scaffold/decisions · HeadyBuddy replan
│
├── /onboarding ....................... Onboarding admin (exists: OnboardingUI as sign-in;
│   │                                   target: provisioning states w/ PARTIAL surfaced —
│   │                                   launch-runbook OnboardPort row)
│   └── data: Firebase Auth · workspace provisioning API
│
├── /approvals ........................ Governed Codeflow queue (exists inline in AdminUI;
│   │                                   target: <heady-approval-queue> drill-down)
│   │                                   submit → evaluate → approve (human) → apply → rollback
│   └── data: GET/POST /codeflow/proposals + :id/evaluate|approve|apply|rollback
│
├── /lens ............................. HeadyLens feed (A2) — <heady-lens-feed>
│   │                                   subject-prefix + detail-tier filters; build subset is
│   │                                   the existing <heady-build-narrative>
│   └── data: GET /api/lens/stream?subject=&detail= · /api/lens/health
│
├── /services ......................... Service catalog — <heady-service-catalog>
│   │                                   the 40 real services (7 groups, table below);
│   │                                   per service: endpoint · method · caps · component ·
│   │                                   live health state
│   └── data: SERVICE_CATALOG (registry API) + /api/health probes
│
├── /legacy ........................... Legacy Advisor (exists: LegacyUI, read-only)
│   └── data: /api/advisor/{health,swarm-status,baseline,patterns/:domain,stream}
│
└── /compendium ....................... Deep-read (A3): docs/compendium + docs/adr rendered
                                        read-only; the "why" layer every A2 record links into
```

## Surface 2 — User: `headyme.com`

Audience: end users. Journey per `docs/HEADYME_LAUNCH_RUNBOOK.md`: welcome/authorization page → onboarding into a personal workspace + persistent 3D vector memory → HeadyBuddy. Fonts: Inter body / JetBrains Mono machine values. Accent `#00d4aa` (site-accent table).

Navigation principle: **HeadyBuddy is the primary navigator** — users state intent, the same `INTENT_KEYWORDS → SERVICE_CATALOG` mapping the dispatcher uses (`src/hc_service_dispatcher.js`) routes them. Browsable groups exist as a visible fallback, never as the required path.

```
headyme.com
├── / ................................. Welcome + authorization (exists: OnboardingUI base)
│   └── honest gate: this page IS the launch deliverable (runbook L4)
├── /welcome .......................... First-run onboarding → personal workspace +
│   │                                   persistent memory tenant (runbook L2/L3 gates)
├── /buddy ............................ HeadyBuddy home — conversational service navigation
│   │                                   <heady-buddy-dock> full-screen; intent → service
│   └── data: POST /api/buddy/chat (caps: personal-assist, multi-provider, memory)
├── /services ......................... Simple service navigation (browsable fallback)
│   ├── /services/create .............. AI Providers group (chat, coder, pythia, fast…)
│   ├── /services/understand .......... Core Engines group (analyze, patterns, memory…)
│   ├── /services/automate ............ Pipeline & System group (auto-flow, health…)
│   └── /services/connect ............. Integrations group (notion, research, edge…)
├── /workspace ........................ Personal workspace + memory (tenant-isolated, L3)
└── /status ........................... Honest system status (public read of A1 states —
                                        green/blocked/pending + blockedReason, no fake green)
```

## The real service map (IA source of truth)

`SERVICE_CATALOG`, `src/hc_service_dispatcher.js` — 40 services, 7 groups. READ-ONLY source; the UI must render *this* list (via the registry API), never a hardcoded copy.

| Group | Services (name → endpoint) |
|---|---|
| **AI Providers** (11) | chat `/api/brain/chat` · analyze `/api/brain/analyze` · embed `/api/brain/embed` · search `/api/brain/search` · jules `/api/headyjules/chat` · compute `/api/headycompute/chat` · pythia `/api/headypythia/generate` · fast `/api/groq/chat` · coder `/api/coder/generate` · codex `/api/codex/generate` · copilot `/api/copilot/suggest` |
| **Core Engines** (7) | soul `/api/soul/analyze` · battle `/api/battle/session` · patterns `/api/patterns/analyze` · risks `/api/risks/assess` · vinci `/api/vinci/predict` · lens `/api/lens/analyze` · memory `/api/memory/search` |
| **Ops & Maintenance** (3) | ops `/api/ops/deploy` · maid `/api/maid/clean` · maintenance `/api/maintenance/status` |
| **Integrations** (6) | notion `/api/notion/sync` · edge `/api/edge/chat` · buddy `/api/buddy/chat` · research `/api/perplexity/research` · huggingface `/api/headyhub/model` · orchestrator `/api/orchestrator/send` |
| **Pipeline & System** (7) | auto-flow `/api/hcfp/auto-flow` · deep-scan `/api/edge/deep-scan` · auto-success `/api/auto-success/status` · health `/api/health` · liquid `/api/liquid/state` · scientist `/api/scientist/status` · qa `/api/qa/status` |
| **DAW / MIDI / Spatial** (3) | daw `/api/daw/bridge` · midi `/api/daw/midi` · spatial `/api/spatial/context` |
| **Native Sovereign** (3) | browser `/api/native/browser` · terminal `/api/native/sandbox` · datacloud `/api/native/datacloud` |

Admin `/services` shows all 40 with health. User `/services` shows the user-reachable subset grouped by *intent verbs* (create/understand/automate/connect) — the grouping is presentational; identity stays the catalog key.

## Cross-surface invariants
- **Status honesty everywhere:** `green | blocked | pending` + `blockedReason` surfaced verbatim (see COMPONENT_INVENTORY.md pattern). The user `/status` page and the admin honeycomb read the *same* state source.
- **Auth:** Firebase Auth SSO (facts.yaml `auth: firebase-auth`); admin requires it for everything; user surface gates workspace/buddy, not the welcome page.
- **Sync:** SSE + HTTP/2 only (facts.yaml `ui_sync: sse-http2`) — no WebSockets.
- **No dead ends:** every error state names its unblock path.
