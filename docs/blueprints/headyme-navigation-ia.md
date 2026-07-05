# HEADY™ headyme.com Navigation IA — Buddy-Guided Service Navigation

> © 2026 HeadySystems Inc. — Eric Haywood, Founder
> Status: **v1.0 — implemented in `apps/headyme-portal` (route `#services`)**
> Ground truth: `src/hc_service_dispatcher.js` (`SERVICE_CATALOG`, `INTENT_KEYWORDS`, `registerServiceRoutes`) · `src/services/buddy-chat-contract.js` · `src/buddy-agent-hub.js`

## 1. Goal

headyme.com must be simple to understand and to navigate through Heady services,
with HeadyBuddy's help. A visitor should never need to know what an "endpoint",
"component", or "dispatcher" is. They state what they need in their own words;
Buddy resolves it against the **real** dispatcher (`POST /api/service/resolve`)
and walks them to the right place.

## 2. Comfort principles (non-negotiable)

1. **Plain-language labels.** Every service gets a human label and a one-sentence
   blurb ("Chat with Heady — ask anything and get a straight answer"), never raw
   service keys as the primary text. Raw keys stay visible as small print so power
   users keep their bearings — honesty, not hiding.
2. **One obvious next action.** Every screen state has exactly one primary action:
   the intent box ("Tell Heady what you need"), then **Go** on the resolved card,
   then per-service **Ask Buddy about this**.
3. **Status honesty.** Confidence from the dispatcher is shown, tiered in plain
   words (see §5.2). If the API is unreachable the UI says *Buddy is offline* —
   it never fakes a resolution, never shows cached results as live.
4. **Progressive disclosure.** Seven categories collapsed by default; a category
   opens to its services; a service opens to its details (endpoint, method,
   capabilities). Nothing deeper than three levels.
5. **Never break on growth.** The category map is keyed by **service name**;
   any catalog entry the map does not know lands in a visible **More** group
   with a label titleized from its name and a blurb synthesized from its
   capabilities — new services appear, nothing 404s.

## 3. Category IA — 7 categories + More

All 40 services in `SERVICE_CATALOG` are mapped. Grouping is by **user goal**,
not by internal component. Order is fixed (most-used first).

| # | Key | Label | Promise (blurb) | Services |
|---|-----|-------|-----------------|----------|
| 1 | `ask` | **Ask & Chat** | Talk with Heady — questions, quick answers, deep research. | `chat`, `buddy`, `jules`, `compute`, `fast`, `research`, `edge` |
| 2 | `create` | **Create & Code** | Generate code, content, music, and creative work. | `coder`, `codex`, `copilot`, `pythia`, `vinci`, `daw`, `midi`, `spatial` |
| 3 | `understand` | **Understand & Review** | Analyze code, images, and patterns; compare results. | `analyze`, `patterns`, `soul`, `lens`, `battle`, `deep-scan` |
| 4 | `find` | **Find & Remember** | Search knowledge, recall memory, sync your notes. | `search`, `memory`, `embed`, `notion`, `huggingface` |
| 5 | `safety` | **Safety & Quality** | Security scans, quality checks, integrity monitoring. | `risks`, `qa`, `scientist` |
| 6 | `operate` | **Run & Maintain** | Deploy, automate, clean up, watch system health. | `ops`, `maid`, `maintenance`, `auto-flow`, `auto-success`, `orchestrator`, `liquid`, `health` |
| 7 | `tools` | **Hands-On Tools** | Browser, terminal, and data tools Heady can drive for you. | `browser`, `terminal`, `datacloud` |
| 8 | `more` | **More** | Newer services not yet categorized — still fully usable. | *(fallback for any catalog name not in the map)* |

Canonical data module (single source for the portal):
`apps/headyme-portal/src/services/service-categories.js`.

### Route scheme

```
#services                          → categorized nav, all collapsed
#services/<category>               → that category expanded
#services/<category>/<service>     → category expanded + service highlighted/opened
```

Example: `#services/find/search` — deep-linkable, shareable, survives reload.

## 4. INTENT_KEYWORDS → category paths

Every keyword the dispatcher understands, mapped to where the user lands.
(Derived 1:1 from `INTENT_KEYWORDS` in `src/hc_service_dispatcher.js`.)

| Keywords | Resolves to | Category path |
|----------|-------------|---------------|
| chat, talk, ask, converse | `chat` | `#services/ask/chat` |
| buddy, assistant, help | `buddy` | `#services/ask/buddy` |
| think, reason, deep, complex | `jules` | `#services/ask/jules` |
| fast, quick, speed, instant | `fast` | `#services/ask/fast` |
| research, academic, web search | `research` | `#services/ask/research` |
| edge, cloudflare, edge ai | `edge` | `#services/ask/edge` |
| code, generate code, scaffold, build | `coder` | `#services/create/coder` |
| predict, learn, recognize, creative | `vinci` | `#services/create/vinci` |
| midi, note | `midi` | `#services/create/midi` |
| daw, audio, osc | `daw` | `#services/create/daw` |
| spatial, 3d, position, ump | `spatial` | `#services/create/spatial` |
| analyze, review, inspect, audit, refactor, improve | `analyze` | `#services/understand/analyze` |
| pattern, design pattern, architecture | `patterns` | `#services/understand/patterns` |
| soul, reflect, introspect | `soul` | `#services/understand/soul` |
| vision, image, visual, detect | `lens` | `#services/understand/lens` |
| battle, arena, compete, compare | `battle` | `#services/understand/battle` |
| search, find, lookup, query | `search` | `#services/find/search` |
| memory, recall, remember | `memory` | `#services/find/memory` |
| embed, vector, embedding | `embed` | `#services/find/embed` |
| notion, sync, knowledge | `notion` | `#services/find/notion` |
| model, huggingface, hub | `huggingface` | `#services/find/huggingface` |
| security, vulnerability, risk, scan | `risks` | `#services/safety/risks` |
| deploy, infrastructure, scale | `ops` | `#services/operate/ops` |
| clean, cleanup, housekeeping | `maid` | `#services/operate/maid` |
| backup, restore, update | `maintenance` | `#services/operate/maintenance` |
| pipeline, auto-flow | `auto-flow` | `#services/operate/auto-flow` |
| orchestrate, coordinate, route | `orchestrator` | `#services/operate/orchestrator` |
| health, status, uptime | `health` | `#services/operate/health` |
| browser, browse, navigate, ui test | `browser` | `#services/tools/browser` |
| terminal, bash, shell, execute | `terminal` | `#services/tools/terminal` |
| bigquery, spanner, sql | `datacloud` | `#services/tools/datacloud` |

**No-keyword services** — `compute`, `codex`, `copilot`, `pythia`, `deep-scan`,
`auto-success`, `qa`, `scientist`, `liquid` — are reachable only by category
browsing or the dispatcher's fuzzy capability match. They remain first-class in
the nav; the intent box may not find them by their obvious names. (Follow-up
noted in §7.)

## 5. HeadyBuddy guidance loop

### 5.1 The loop

```
user types intent ("I need to scan my code for security holes")
      │
      ▼
POST {VITE_CODEFLOW_API}/api/service/resolve   body: { "intent": "<text>" }
      │  response: { ok, resolved, confidence, endpoint, method, capabilities }
      ▼
Buddy explains the destination in ONE sentence
   → label + blurb from service-categories.js (e.g. "Security Scan —
     scans for vulnerabilities and rates the risk.")
   → confidence tier shown in plain words (§5.2)
      │
      ▼
user presses Go → route #services/<category>/<service>
   → ServiceNav expands the category, highlights the service, scrolls to it
```

Reverse loop: every service row in the nav has **Ask Buddy about this**, which
calls `POST /api/service/resolve` with `{ "service": "<name>" }` (explicit-name
resolution, confidence 1.0) so the buddy card and the nav always agree.

### 5.2 Confidence honesty tiers

| Dispatcher confidence | Buddy says |
|----------------------|------------|
| ≥ 0.9 (keyword hit or explicit name) | "Confident match." |
| 0.5 – 0.89 (capability match) | "Likely match — check it's what you meant." |
| < 0.5 (fuzzy/fallback) | "Best guess. Heady wasn't sure, so it picked the safest starting point." |
| = 0.3 and `resolved === "chat"` | Additionally: "This is Heady's default when nothing matched — open chat can route you from there." |

### 5.3 Degraded state — never fake

If `POST /api/service/resolve` fails (network error, non-2xx, malformed body,
or φ⁴-second timeout ≈ 6.854 s):

- BuddyGuide shows **"HeadyBuddy is offline"** with the real error and a single
  **Try again** action. No cached answer is presented as live; no resolution is
  invented client-side.
- ServiceNav is independent: if `GET /api/service/catalog` fails, it shows
  **"Service directory unavailable"** with the error, a **Retry** button, and
  auto-retries on the φ⁷ golden-heartbeat backoff (29 034 ms × φⁿ, capped at
  ×6) — same cadence as the ADR-0026 build narrative.
- If catalog loads but `GET /api/service/health` fails, the nav renders the
  directory and honestly labels dispatcher health *unknown* — partial truth is
  labeled partial.

## 6. Mobile behavior

- The portal's `.dashboard-grid` is `repeat(auto-fit, minmax(250px, 1fr))` —
  below ~530 px everything stacks to one column: **Buddy box first**, nav below.
  Intent-first is the mobile navigation model; browsing is the fallback.
- Categories and services use native `<details>/<summary>` — full-row tap
  targets (≥ 44 px), correct keyboard/screen-reader semantics, zero JS needed
  to disclose.
- Buddy's **Go** performs an in-page scroll (`scrollIntoView`, centered) after
  expanding — no page reload, no lost input.
- The resolved card renders below the input (thumb-reachable), not in a modal.
- System tab strip (`Rebuild · Legacy · Services`) wraps; it is the only
  horizontal chrome.

## 7. Endpoint contract + observed mismatches (raw findings)

Real endpoints consumed by the portal (base = `VITE_CODEFLOW_API`, the
heady-manager app where `registerServiceRoutes` mounts — see
`apps/headyme-portal/.env.example`; no host is hardcoded):

| Call | Shape |
|------|-------|
| `GET /api/service/catalog` | `{ ok, services: [{ name, endpoint, method, capabilities, component }] }` |
| `GET /api/service/health` | `{ ok, status, totalDispatches, totalServices, recentSuccessRate, avgLatencyMs, ts }` |
| `POST /api/service/resolve` | in `{ intent? , service? }` → out `{ ok, resolved, confidence, endpoint, method, capabilities }` |
| `POST /api/service` | in `{ intent?, service?, params? }` → out `{ ok, service, confidence, result }` (not used by this pass) |

Mismatches found between the buddy contract and the dispatcher (recorded, not
worked around silently):

1. **No description field in `/api/service/resolve`.** The response carries no
   human explanation, so the buddy's one-sentence explanation is supplied by the
   portal data module. If the dispatcher later adds `description`, the portal
   should prefer the server's sentence.
2. **`buildChatRequest` envelope is lost through the dispatcher.**
   `src/services/buddy-chat-contract.js` builds `{ message, history, context }`
   plus `Authorization`/`X-Heady-Device`/`X-Heady-Workspace` headers, but
   `HeadyServiceDispatcher.dispatch()` forwards only `{ ...params, source,
   message? }` with `X-Heady-Source` — auth/device/workspace context is dropped
   when buddy traffic is routed via `POST /api/service`.
3. **`parseBuddyResponse` cannot read a dispatch envelope directly.** It expects
   `payload.response|reply|message|text`, but `POST /api/service` nests the
   service reply under `result` — callers must unwrap `result` first.
4. **Fallback is silent at the API level.** `resolve()` never returns "no
   match"; it falls back to `chat` at confidence 0.3. The portal compensates
   with the §5.2 honesty tiers.
5. **`HeadyServiceDispatcher` constructor default `managerUrl` is
   `https://127.0.0.1:3301`** (`src/hc_service_dispatcher.js:118`) — a localhost
   default in violation of the zero-localhost law. Out of scope for this pass
   (src/ read-only here); needs an env-derived default.

## 8. Implementation map

| Artifact | Path |
|----------|------|
| Category/label/blurb data module | `apps/headyme-portal/src/services/service-categories.js` |
| API client (`services.*`) | `apps/headyme-portal/src/services/heady-api.js` |
| BuddyGuide component `<heady-buddy-guide>` | `apps/headyme-portal/src/components/BuddyGuide.js` |
| ServiceNav component `<heady-service-nav>` | `apps/headyme-portal/src/components/ServiceNav.js` |
| Route view (mount pattern = AdminUI) | `apps/headyme-portal/src/components/ServicesUI.js` |
| Router wiring (`#services`) | `apps/headyme-portal/src/main.js` |
