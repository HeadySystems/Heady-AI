<!-- ╔══════════════════════════════════════════════════════════════════╗
     ║  HEADY™ v0.dev Prompt Pack v1.0.0 — docs/design bundle            ║
     ║  Ready-to-paste prompts with canon token values EMBEDDED so v0    ║
     ║  output cannot drift from the system. Values from                 ║
     ║  docs/design/design-tokens.json (see provenance there).           ║
     ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
     ╚══════════════════════════════════════════════════════════════════╝ -->

# v0.dev Prompt Pack

Three prompts, one per key screen. Paste verbatim into v0.dev. Each embeds the actual token values (colors, φ spacing, type scale, motion) and the IA from `IA_SITEMAP.md`, plus the hard constraint block. If v0 output uses any value not present in the prompt, regenerate — drift is a defect.

---

## Prompt 1 — Admin living-dashboard home (1ime1.com `/`)

```
Build the "Heady Mission Control" living-dashboard home screen for an internal admin console.

FRAMEWORK CONSTRAINTS (hard requirements):
- React with plain CSS (CSS custom properties). NO Vue, NO Angular, NO Tailwind, NO component libraries.
- Must also work conceptually as vanilla Web Components — keep components self-contained, props-in/events-out, no global state library.
- Dark theme is the default; a light theme via [data-theme="light"] overrides. Both fully styled.
- Accessible: WCAG 2.1 AA. Every interactive element has a :focus-visible ring (2px solid accent, 3px offset, 5px radius). All status colors are paired with a text label and glyph — never color alone. Respect prefers-reduced-motion by disabling the pulse animation.

DESIGN TOKENS (use these exact values as CSS custom properties; do not invent any color, spacing, or duration):
:root {
  --bg-primary:#0a0a0f; --bg-secondary:#12121a; --bg-tertiary:#1a1a26;
  --bg-glass:rgba(255,255,255,0.05); --bg-glass-deep:rgba(255,255,255,0.08);
  --text-primary:#e8e8f0; --text-secondary:#9898a8; --text-muted:#5a5a6a;
  --border-subtle:rgba(255,255,255,0.08); --border-glow:rgba(255,255,255,0.15);
  --state-healthy:#00d4aa; --state-degraded:#7c5eff; --state-blocked:#ffb020; --state-fail:#ff5470;
  --space-2xs:5px; --space-xs:8px; --space-sm:13px; --space-md:21px; --space-lg:34px; --space-xl:55px; --space-2xl:89px;
  --radius-sm:5px; --radius-md:8px; --radius-lg:13px; --radius-xl:21px;
  --text-xs:0.75rem; --text-sm:0.875rem; --text-base:1rem; --text-lg:1.125rem; --text-xl:1.618rem; --text-2xl:2.618rem;
  --ease-phi:cubic-bezier(0.618,0,0.382,1); --duration-fast:192ms; --duration-normal:309ms; --duration-slow:500ms;
  --font-display:'Space Grotesk',ui-sans-serif,system-ui,sans-serif;
  --font-mono:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
}
[data-theme="light"] {
  --bg-primary:#f6f6f9; --bg-secondary:#ededf2; --bg-tertiary:#e3e3ea;
  --bg-glass:rgba(10,10,15,0.05); --bg-glass-deep:rgba(10,10,15,0.08);
  --text-primary:#16161d; --text-secondary:#4c4c5c; --text-muted:#8a8a9a;
  --border-subtle:rgba(10,10,15,0.08); --border-glow:rgba(10,10,15,0.15);
  --state-healthy:#007a62; --state-degraded:#5436d6; --state-blocked:#8a5a00; --state-fail:#c41f44;
}
Glass panels: background var(--bg-glass); backdrop-filter blur(20px) saturate(180%); border 1px solid var(--border-subtle); border-radius var(--radius-lg).

LAYOUT (golden-ratio grid):
1. Full-width top banner "coherence gate": one line, huge glyph + verdict. Three states: GREEN (quiet: thin teal border, small text — gates are invisible when green), AMBER, RED (loud: filled band + count of contradictions, e.g. "Gate RED · 3 contradictions · 2 incomplete"). Use --font-display for the verdict, --font-mono for the counts.
2. Main grid: grid-template-columns 61.8fr 38.2fr, gap var(--space-sm), padding var(--space-md).
   - LEFT (61.8%): "the living honeycomb" — a responsive hex-cell grid of ~15 service cells. Each hex cell shows: service name (--font-display, --text-sm), a status dot with glow (box-shadow 0 0 8px currentColor), state label in --font-mono uppercase --text-xs, and for non-healthy cells a one-line reason. Cell states and colors: healthy=var(--state-healthy) with a slow ambient opacity pulse (animation duration 29034ms — the golden heartbeat; disabled under prefers-reduced-motion); degraded/projection-only=var(--state-degraded); blocked/token_expired=var(--state-blocked) AND an inline one-tap action button (e.g. "Re-authorize") — a blocked cell is never a dead end; fail=var(--state-fail).
   - RIGHT (38.2%): "Needs you" panel — a ranked list of blocked items. Each row: amber ⏸ glyph, item title, blockedReason in --text-sm --text-secondary (real examples: "needs firebase login", "waiting on secretAccessor IAM grant", "org policy blocks public Cloud Run"), and an action button when an unblock action exists. Below it, a compact "coherence sparkline" card: a small SVG sparkline with two horizontal threshold bands at 0.882 (healthy above) and 0.691 (warning above, danger below).
3. Full-width bottom: "Live Build Narrative" feed — newest-first list, each row has a left accent border (2px solid state color), a badge (PLAN ◇ violet / START ▸ teal / DECISION ◆ violet / GATE ⛬ violet / DONE ✓ teal / BLOCKED ⏸ amber / FAIL ✕ red), step name in --font-display bold, timestamp right-aligned --text-xs, one-line summary, optional italic rationale line prefixed "↳". Feed body in --font-mono 13px. Cap visual mock at ~8 rows.

STATUS HONESTY RULES (non-negotiable):
- Every non-green state displays its reason string. No bare spinners, no unexplained gray.
- No "Approve all" button anywhere.
- Empty states say what would populate them ("No build activity yet. Beats appear here the moment a build runs.") — never fake data.
Header: "Heady™ Mission Control" (--text-xl, --font-display) with signed-in user email and a "Disconnect" ghost button.
```

---

## Prompt 2 — Admin drill-downs: service catalog + HeadyLens feed (1ime1.com `/services`, `/lens`)

```
Build two connected admin drill-down screens sharing one shell: "Service Catalog" and "HeadyLens Feed".

FRAMEWORK CONSTRAINTS (hard requirements):
- React with plain CSS custom properties. NO Vue, NO Angular, NO Tailwind, NO UI kits.
- Dark default + [data-theme="light"] overrides, both fully styled.
- WCAG 2.1 AA: focus-visible rings (2px solid accent, 3px offset), aria-live="polite" on the live feed, status = color + glyph + label (never color alone), prefers-reduced-motion respected.

DESIGN TOKENS: use exactly the :root and [data-theme="light"] blocks from Prompt 1 (same file, same values — do not restyle).

SHELL: left rail nav (width 233px) with items: Dashboard, Scaffold, Onboarding, Approvals, Lens, Services, Legacy, Compendium. Active item gets a 2px left accent border in var(--state-healthy). Rail labels --font-display; route paths under them in --font-mono --text-xs.

SCREEN A — SERVICE CATALOG (/services):
A table/card hybrid of exactly these 7 groups and 40 services (render all group headers, and fully render the first two groups; the rest may be collapsed):
- AI Providers (11): chat, analyze, embed, search, jules, compute, pythia, fast, coder, codex, copilot
- Core Engines (7): soul, battle, patterns, risks, vinci, lens, memory
- Ops & Maintenance (3): ops, maid, maintenance
- Integrations (6): notion, edge, buddy, research, huggingface, orchestrator
- Pipeline & System (7): auto-flow, deep-scan, auto-success, health, liquid, scientist, qa
- DAW / MIDI / Spatial (3): daw, midi, spatial
- Native Sovereign (3): browser, terminal, datacloud
Each service row: name (--font-display, 600), endpoint in --font-mono --text-sm --text-secondary (e.g. chat → POST /api/brain/chat, coder → POST /api/coder/generate, health → GET /api/health, browser → POST /api/native/browser), capability chips (--text-xs, border-radius var(--radius-sm), border 1px solid var(--border-subtle); e.g. chat: inference · reasoning · conversation), and a live state cell using the state tokens with glyph+label (✓ HEALTHY teal · ◆ DEGRADED violet · ⏸ BLOCKED amber + reason text · ✕ FAIL red). Group header row: uppercase --text-xs letter-spacing .05em --text-secondary with count, e.g. "AI PROVIDERS · 11".

SCREEN B — HEADYLENS FEED (/lens):
Top filter bar: a subject-prefix input (--font-mono) with default value "heady.action.build.", a detail-tier segmented control [summary | standard | forensic] (forensic active), and a connection status chip: dot + label with states idle(gray) / connecting…(amber) / live(teal, glowing dot: box-shadow 0 0 8px) / reconnecting(violet). Under it, the reconnect note in --text-xs --text-muted: "golden heartbeat reconnect · 29034ms".
Feed: newest-first, max-height scroll region, each record: left accent border 2px in state color, badge + glyph (PLAN ◇ / START ▸ / PROGRESS · / DECISION ◆ / GATE ⛬ / DONE ✓ / BLOCKED ⏸ / FAIL ✕), step name, traceId in --font-mono --text-xs --text-muted, time right-aligned, summary line, meta line (--text-xs, "·"-separated) that may include "312ms", "coherence 0.913 / 0.882 ✓", "waiting on secretAccessor IAM grant". Blocked records show their waiting-on reason; failed records show an error line in a red tint.
Every record row links down one altitude: a subtle "why →" affordance on gate/decision records (tooltip: "opens the ADR that explains this gate").
Empty state: "No records for this filter yet — beats appear the moment the subject emits."
```

---

## Prompt 3 — User home: headyme.com welcome + HeadyBuddy navigation

```
Build the public-facing home + service navigation for headyme.com — a calm, premium, dark AI-OS welcome.

FRAMEWORK CONSTRAINTS (hard requirements):
- React with plain CSS custom properties. NO Vue, NO Angular, NO Tailwind, NO UI kits.
- Dark default + [data-theme="light"] overrides, both fully styled.
- WCAG 2.1 AA: visible labels on all inputs, focus-visible rings, 4.5:1 text contrast (the provided tokens already satisfy this), prefers-reduced-motion respected.

DESIGN TOKENS: use exactly the :root and [data-theme="light"] blocks from Prompt 1, with two changes for this consumer surface:
  --font-body:'Inter',ui-sans-serif,system-ui,sans-serif;  /* body face for user sites */
  --accent:#00d4aa;                                        /* headyme.com site accent */
  --duration-site:382ms;                                   /* user-site transition duration */
All type set in --font-body except machine values (service endpoints, ids) in --font-mono.

LAYOUT:
1. HERO (full viewport height, golden-section split 61.8/38.2):
   - Left 61.8%: headline "Your AI operating system." in --text-2xl (2.618rem), subline in --text-lg --text-secondary, then the HeadyBuddy intent bar: a large glass input (glass style from Prompt 1, border-radius 21px, padding 21px 34px) with placeholder "Tell HeadyBuddy what you want to do…" and a teal submit arrow. Under it, four example-intent chips users can click: "write code with me", "research a topic", "search my memory", "check system health".
   - Right 38.2%: a subtle canvas/SVG "Flower of Life" sacred-geometry line animation in --accent at 5% opacity (static image under prefers-reduced-motion).
2. SERVICE NAVIGATION (browsable fallback under the hero — heading: "Or browse what Heady can do"): four cards in a grid, each a glass panel with an icon, verb-title, --text-sm description, and 3 example service chips in --font-mono --text-xs:
   - Create — chat · coder · pythia
   - Understand — analyze · patterns · memory
   - Automate — auto-flow · orchestrator · ops
   - Connect — notion · research · edge
3. HONEST STATUS STRIP (footer band): "All systems" + a dot-and-label state that has three real designs: ✓ operational (teal, quiet), ⏸ partially available (amber) with a reason line e.g. "workspace provisioning is in partial rollout", ✕ disruption (red) with reason. Never render a fake green: the component takes state as a prop.
4. AUTH GATE: "Enter your workspace" button (filled --accent, dark text #0a0a0f for contrast) leading to sign-in; a --text-xs note "Your workspace and memory are private to you." (tenant-isolated memory is a launch gate).
Transitions: all hovers/reveals use --duration-site with cubic-bezier(0.618,0,0.382,1).
Tone: confident, quiet, zero hype-gradients; the only saturated color on screen is state signal + the single accent.
```

---

## Post-generation checklist (run against any v0 output)

- [ ] Every hex color in the output appears in `design-tokens.json` — no invented colors.
- [ ] Spacing/radii only from the Fibonacci set {3,5,8,13,21,34,55,89,144}.
- [ ] Both themes render; state colors switch to the `onLight` variants in light mode.
- [ ] Blocked/pending states all carry a visible reason string and an action when one exists.
- [ ] No Tailwind classes, no Vue/Angular artifacts, no component-library imports.
- [ ] `prefers-reduced-motion` kills the heartbeat pulse and geometry animation.
- [ ] Machine values (endpoints, traceIds, counts) are set in JetBrains Mono.
