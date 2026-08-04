<!-- HEADY_BRAND:BEGIN -->
<!-- FILE: docs/LEGACY_GAP_ANALYSIS_AND_ROADMAP.md · LAYER: governance · gap analysis + roadmap -->
<!-- HEADY_BRAND:END -->

# Legacy → Rebuild Gap Analysis & Implementation Roadmap

> **Question answered:** which features/components exist in the **legacy** lineage but **not**
> in `rebuild`, ranked by significance, and how do we bring the significant ones in?
>
> **Method:** component-level (not file-level) cross-map of the legacy orphan
> (`legacy/sacred-geometry-orphan-2026-06`, ref `e911513b`) against `rebuild`'s packages,
> apps, **and 135 skills**. A raw file diff reports ~7.5k "unique" files and ~409 "missing"
> names — **both are misleading**. Findings below are deduped, superseded-filtered, and
> **verified against the actual source** (endpoint code + line counts). Verified spot-checks
> are noted inline; unverified inferences are labeled.

## Headline (grounded)

1. **The 20k-file legacy mass is largely illusory as _capability_.** Of ~292 legacy
   `services/` dirs, **95 are empty stubs** (`server.js` = 0 lines — verified: `heady-oracle`,
   `heady-quantum`, `heady-soul`), and most of the rest are **machine-generated boilerplate**
   that differs only in name/port/description.
2. **Rebuild's 135-skill layer absorbs nearly all genuinely-implemented legacy services** —
   routing, memory, CSL, swarm/bee, resilience, security, billing, perplexity, MIDI, Drupal,
   forensics, etc. These are **superseded, not gaps.**
3. **24 genuine gaps remain** (H=3, M=15, L=6), clustering in two themes with **no rebuild
   equivalent**: speculative/analytical **engines**, and a consumer **personal-companion MCP** line.
4. **Corrected false-positive (grounding):** legacy `hc_imagination` / `hc_monte_carlo` /
   `hc_story_driver` are **already in rebuild** (`src/hc_monte_carlo.js`, `src/hc_story_driver.js`,
   `src/routes/imagination-routes.js`) — **not gaps.**

## Confirmed gaps (legacy-only), ranked

| # | Component | What it does (verified evidence) | Sig | Rebuild landing |
|---|---|---|---|---|
| 1 | **causal-inference** | Causal DAG models: `/model/:id/intervene`, `/counterfactual`, `/simulate`, `/pipeline/assess` (do-calculus). *Verified 519L, endpoints confirmed.* | **H** | new `packages/causal-inference` |
| 2 | **digital-twin** | Entity twins: `/twin`, `/simulate`, `/twin/:id/compare`. *Verified 351L, endpoints confirmed.* | **H** | new `packages/digital-twin` |
| 3 | **ghost-protocol** | Speculative shadow execution: `/ghost/create → /execute → /commit` + history. *Verified 553L, endpoints confirmed.* | **H** | `packages/resilience` (or new `packages/ghost-protocol`) |
| 4 | time-crystal | Agent-state time-travel: `/snapshot /branch /merge /undo /redo` (467L) | M | extend `heady-durable-agent-state` |
| 5 | temporal-forecast | Seeded time-series metric forecasting (461L; near-dup exists) | M | extend `heady-intelligence-analytics` |
| 6 | living-contract | Self-evaluating SLA/policy contracts: `/evaluate /report /violations` (365L) | M | extend `packages/approvals` + `heady-trust-receipts` |
| 7 | consensus-tribunal | Multi-agent adjudication: `/case` → verdict + precedent (267L) | M | extend `packages/csl-engine` + `heady-dual-pass` |
| 8 | dream-engine | Divergent idea-gen over memory: `/walk /search/divergent /dream` (574L) | M | extend `heady-hypothesis-lab` |
| 9 | parallel-universe | Fork conversation into N branches → coherence → merge (194L) | M | extend `heady-battle-arena` |
| 10 | pheromone-trails | Stigmergic swarm memory: `recordTrail(...)` + viz (146L) | M | extend `heady-bee-swarm-ops` |
| 11 | buddy-evolution | φ-constrained personality drift (1/φ per interaction, 281L) | M | extend `heady-liquid-persona` |
| 12 | silicon-bridge | Hardware-accel / GPU compute routing | M | new `packages/silicon-bridge` (or extend router) |
| 13 | dream-journal-mcp | Personal dream journaling MCP (305L) | M | companion line (see Wave 3) |
| 14 | emotional-intelligence-mcp | Emotion / cognitive-distortion detection (231L) | M | companion line + `heady-companion-memory` |
| 15 | habit-formation-mcp | Habit tracking + optimal-time scheduling (265L) | M | companion line |
| 16 | ar-spatial-mcp | AR/spatial scene generation `/generate` (176L) | M | companion line (net-new capability) |
| 17 | apps/mobile | Mobile client app (none in rebuild `apps/*`) | M | new `apps/mobile` (product decision) |
| 18 | reputation-engine | Entity reputation: `/entity /outcome /endorse /leaderboard` (489L) | M | extend `heady-trust-receipts` |
| 19 | contextual-nudge | Proactive context nudges `generateNudge()` (114L) | L | extend `heady-intent-tracker` |
| 20 | thought-debugger | Step-through reasoning-trace inspector (104L) | L | extend `heady-forensic-analyst` |
| 21 | decision-matrix | Weighted multi-criteria scoring (88L) | L | skill or fold into `csl-engine` |
| 22 | resonance-engine | φ concept-pair resonance scoring (76L) | L | fold into `packages/csl-engine` |
| 23 | wallpaper-generator | Personalized sacred-geometry mandala PNG (116L) | L | extend `heady-sacred-geometry-css-generator` |
| 24 | time-machine | Deterministic conversation replay store (109L) | L | extend `heady-durable-execution` |

## Superseded (present in rebuild under another name) — summary

~155 legacy components map to existing rebuild packages/apps/skills and are **not** gaps.
Representative: `heady-vector-memory`→`packages/memory-stream`; `heady-csl-*`→`packages/csl-engine`;
`heady-bee-factory`→`heady-bee-swarm-ops`; `*-router/*-gateway`→`packages/heady-router` +
`heady-gateway-routing`; `heady-billing/stripe-webhook/usage-metering`→`heady-monetization-platform`;
`heady-vault/secret-gateway`→`packages/secrets`; `heady-saga/event-store`→`packages/events` +
`consistency-bus`; `heady-drupal`→`apps/cms`; `perplexity-mcp`→14 `heady-perplexity*` skills.
_(Full mapping table available on request; ~90 additional entries are boilerplate scaffolds.)_

## Excluded as noise (~150)

95 empty-stub dirs · ~20 `_`/`-` name-variant dupes · ~16 single-file `.js` "services" ·
~19 non-components (`Dockerfile`, `SERVICE_INDEX.json`, `grpc-protos`, `*.py` shims).

---

# Implementation roadmap

Every ported component MUST land in rebuild's conventions (per `AGENTS.md` / `CLAUDE.md`):
ESM only · `HEADY_BRAND` header · Zod at boundaries · **Latent Service Pattern**
(`{ start, stop, health, metrics }`) · φ-constants (no magic numbers) · contracts in
`packages/contracts` (OpenAPI→Kubb) · Vitest alongside · no `localhost`/secrets · structured
`pino` logs. Each net-new package needs an **ADR** (per SOURCE_OF_TRUTH `docs/adr/`).

### Wave 1 — High: net-new reasoning engines (differentiated, likely patent-relevant)
Port as first-class packages; these have no rebuild analogue and are the real losses.
1. `packages/causal-inference` — do-calculus/counterfactual engine. Deps: `csl-engine`, `memory-stream`. Needs ADR + contract surface. **Est: L.**
2. `packages/digital-twin` — entity simulation. Deps: `memory-stream`, `events`. **Est: M.**
3. `ghost-protocol` — speculative-then-commit execution. Fold into `packages/resilience` unless it grows; align with `heady-sandbox-execution` + `heady-durable-execution`. **Est: M.**

> Recommend an **ARBITER/patent review** on Wave 1 — causal-inference and ghost-protocol
> touch novel reasoning claims (patent zones HS-2026-051…062).

### Wave 2 — Medium: extend existing components (mostly enhancements, not net-new)
Most Medium gaps are **partial matches** — implement as endpoints/features on the named
rebuild neighbor rather than new packages: time-crystal→durable-agent-state,
temporal-forecast→intelligence-analytics, living-contract→approvals+trust-receipts,
consensus-tribunal→csl-engine+dual-pass, dream-engine→hypothesis-lab,
parallel-universe→battle-arena, pheromone-trails→bee-swarm-ops, buddy-evolution→liquid-persona,
reputation-engine→trust-receipts. Net-new in this wave: `packages/silicon-bridge`
(hardware-accel routing) if GPU routing is on the roadmap. **Est: M each, parallelizable.**

### Wave 3 — Consumer personal-companion line (PRODUCT decision, not just engineering)
`dream-journal-mcp`, `emotional-intelligence-mcp`, `habit-formation-mcp`, `ar-spatial-mcp`,
`contextual-nudge`, plus `apps/mobile` form a coherent **HeadyBuddy consumer companion**
surface with no rebuild home. **Decide first whether this product line is in scope for the
engineering rebuild** or belongs to a separate consumer track. If in scope: one
`packages/companion-mcp` (journal/emotion/habit) + `ar-spatial` as its own capability +
`apps/mobile`. `ar-spatial` is the only genuinely net-new *technical* capability here. **Est: L (product).**

### Wave 4 — Low: fold or defer
decision-matrix, resonance-engine, thought-debugger, contextual-nudge, wallpaper-generator,
time-machine → implement as skills or small features on existing neighbors, or drop. **Est: S / defer.**

## Sequencing & sizing

| Wave | Scope | Net-new packages | Effort | Gate |
|---|---|---|---|---|
| 1 | 3 reasoning engines | 2–3 | Large | ADRs + ARBITER patent review |
| 2 | 9 enhancements | 0–1 | Medium (parallel) | per-feature CI + coherence gate |
| 3 | companion product | 1–2 + mobile app | Large | **product scope decision first** |
| 4 | 6 utilities | 0 | Small / defer | — |

**Recommended first step:** Wave 1 item #1 (`causal-inference`) as a single pilot PR into
`rebuild` — it proves the legacy→rebuild porting recipe (ADR + package + contracts + tests +
Latent Service Pattern) end-to-end before scaling to the rest.

## Provenance

Cross-map produced by a dedicated analysis pass over `e911513b` vs `origin/rebuild`; the 3
High gaps, the empty-stub claim, the rebuild-absence of the reasoning engines, and the
`hc_*` false-positive correction were **independently re-verified against source files**
before publication. Legacy is preserved in full at `legacy/sacred-geometry-orphan-2026-06`.
