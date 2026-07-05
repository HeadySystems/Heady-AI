<!-- ╔══════════════════════════════════════════════════════════════════╗
     ║  HEADY™ Design-Data Bundle v1.0.0 — docs/design                   ║
     ║  Canon-derived inputs for Claude design tools and v0.dev so       ║
     ║  generated UI cannot drift from the system.                       ║
     ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
     ╚══════════════════════════════════════════════════════════════════╝ -->

# docs/design — the design-data bundle

Purpose: everything a design tool (Claude, v0.dev, Figma-adjacent) needs to generate the admin portal UI (1ime1.com → `apps/headyme-portal`) and the headyme.com user experience, with **every value derived from repo canon** so generated output cannot drift from the system.

## Contents

| File | What it is |
|---|---|
| [`design-tokens.json`](./design-tokens.json) | Machine-readable W3C design-tokens (`$value`/`$type`): dark+light color, φ spacing/type scales, radii, glass elevation, motion, breakpoints. Provenance per group in `$description`/`$extensions`. |
| [`COMPONENT_INVENTORY.md`](./COMPONENT_INVENTORY.md) | What exists in `apps/headyme-portal` today (purpose, state, data endpoints per component) + the target living-dashboard component set and the status-honesty pattern. |
| [`IA_SITEMAP.md`](./IA_SITEMAP.md) | Two-surface IA (admin 1ime1.com / user headyme.com), the three-altitude model (dashboard → HeadyLens feed → compendium), and the real 40-service catalog from `SERVICE_CATALOG`. |
| [`V0_PROMPTS.md`](./V0_PROMPTS.md) | Three ready-to-paste v0.dev prompts with token values embedded + post-generation drift checklist. |
| [`CLAUDE_DESIGN_BRIEF.md`](./CLAUDE_DESIGN_BRIEF.md) | Judgment layer: brand voice, comfort principles (honesty of state, visible reversibility, progressive disclosure, gates invisible when green), layout grammar, do/don't. |

## How this bundle stays derived (regeneration contract)

Single-source chain — change the source, regenerate here; never hand-patch a derived value:

| Canon source | Feeds |
|---|---|
| `facts.yaml` | φ constant, product status/version, `ui_sync: sse-http2`, `auth: firebase-auth`, embedding lock, stage counts referenced in briefs |
| `packages/phi-math/src/index.mjs` | PHI/PSI/PSI²/PHI⁷ (29 034 ms heartbeat), FIB spacing/radii/breakpoints/feed caps, CSL coherence bands (0.882/0.691), φ-backoff durations |
| `.agents/skills/heady-sacred-geometry-css-generator/SKILL.md` | Dark palette, glass elevation, type scale, motion ramp, focus-ring spec |
| `docs/adr/0026-mcp-console-ui-architecture.md` + `docs/REBUILD_PLAN_V2.md` §8 | State-color semantics (teal/violet/amber), honeycomb layout, first-class `token_expired`, heartbeat probing |
| `docs/compendium/09-infra-and-services.md` §I6/§I7 | Fonts (Space Grotesk/Inter/JetBrains Mono), 13px radius, 0.382s site transition, 11 site accents |
| `apps/headyme-portal/src/components/*` (READ-ONLY) | Component inventory, beat vocabulary, amber `#ffb020` / red `#ff5470`, feed caps |
| `src/hc_service_dispatcher.js` `SERVICE_CATALOG` (READ-ONLY) | The 40-service IA — UIs must render the live catalog, never a copy |
| `docs/HEADY_MASTER_CONTEXT.md` + `docs/HEADYME_LAUNCH_RUNBOOK.md` | Surface/domain split (admin 1ime1.com, user headyme.com), launch gates L1–L4, blocked-bucket honesty pattern |

Verification: values marked `derived:true` in `design-tokens.json` `$extensions` have **no** canon source (documented below); everything else must trace to a file above. WCAG ratios were computed (2026-07-04) with the WCAG 2.1 relative-luminance formula, not asserted.

## Canon gaps found while building this bundle

1. **No light palette exists anywhere in canon.** All design sources are dark-only. `color.light` + `color.state.onLight` in the tokens file are *derived* (contrast-inversion, hue held, accents darkened to ≥ 4.5:1) and flagged. Needs a founder-approved canonical light palette (or an explicit "dark-only" decision) — until then the derived ramp is the working default.
2. **No canonical breakpoints.** Derived as FIB[14..17] = 377/610/987/1597 px (flagged `derived:true`).
3. **Site-accent drift.** The sacred-geometry skill's per-site table (9 sites, headysystems.com = `#00d4aa`) disagrees with compendium §I7 (11 sites, headysystems = `#7c5eff`). §I7 + ADR-0026's teal/violet pairing was taken as authoritative; the skill's table should be reconciled.
4. **Fibonacci index comments in the skill are off by one** (`--space-xs: 5px /* fib(4) */` — fib(4)=3 in phi-math). Values match FIB[5..12]; the *values* are canon, the comments are drift.
5. **Type-scale comment drift.** Skill says `--text-xs: 0.75rem /* base / φ² */` but 1/φ² ≈ 0.382. The 0.75/0.875/1.125 steps are pragmatic non-φ sizes; only xl…4xl are exact φ-powers. Documented as-is.
6. **Domain naming:** `HEADY_MASTER_CONTEXT.md` sets the admin surface at 1ime1.com while master-plan §08 shows `apps/headyme-portal` live at `heady-ai.web.app` with `headyme.com` pending DNS, and `configs/_domains/site-registry.yaml` still lists `1ime1` as "creative project" with `domain: null`. The runbook's split (headyme.com = user journey; portal = admin) is used here; the site-registry entry needs updating when 1ime1.com DNS lands.
7. **R1 remains open** (React vs vanilla WC for the console SPA — master-plan §08 open decision). The bundle follows ADR-0019's reconciliation: vanilla WC default, React where complexity earns it; v0 prompts request React output that must stay portable to WC.

## Scope note

Creating this bundle required one entry in `tooling/skeleton-guard/skeleton.json` (`docs/design/**` allowing `.md`+`.json`) — the guard's prescribed expansion path — so `design-tokens.json` could exist under `docs/`.
