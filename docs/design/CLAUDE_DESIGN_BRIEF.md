<!-- ╔══════════════════════════════════════════════════════════════════╗
     ║  HEADY™ Claude Design Brief v1.0.0 — docs/design bundle           ║
     ║  Brand voice, comfort principles, layout grammar, do/don't for    ║
     ║  Claude-based design work on the admin (1ime1.com) and user       ║
     ║  (headyme.com) surfaces. Derived from repo canon — sources cited  ║
     ║  inline. © 2026 HeadySystems Inc. — Eric Haywood, Founder         ║
     ╚══════════════════════════════════════════════════════════════════╝ -->

# Claude Design Brief — Heady surfaces

Read `design-tokens.json` first — it is the only permitted source of colors, spacing, type sizes, radii, and durations. This brief is the judgment layer on top of it.

## 1. What Heady is (one paragraph of context)

Heady is a pre-launch Latent OS (facts.yaml: `product.status: pre-launch`, v3.0.0) built by HeadySystems Inc. — a φ-native system where every constant derives from the golden ratio (`packages/phi-math`), every change flows through governed proposals with human approval (ADR-0005), and every projection must tell the truth about itself (ADR-0017/0026). The design's job is to make an autonomous system *legible and trustworthy* to the one human governing it, and calm and useful to end users.

## 2. Brand voice

- **Honest operator, not marketer.** The system reports; it never sells its own state. Canon exemplar: the launch runbook's "Honest headline" — *"that notification cannot be sent until the site actually serves"* (`docs/HEADYME_LAUNCH_RUNBOOK.md`). Copy states facts with counts and reasons: "Gate GREEN · 0 contradictions", "blocked — needs firebase login".
- **Terse, dense, specific.** Machine values always in mono, always exact ("29034ms", "0.913 / 0.882 ✓"). No rounding that hides information.
- **Quiet confidence.** Sacred geometry is structural (proportions, cadence), not decorative fireworks. The compendium's correction applies to design too: sacred geometry is *"a default/heuristic, not a hard gate"* (`docs/compendium/09-infra-and-services.md` §I6) — use φ because it makes the system coherent, not as ornament.
- **Named things keep their names.** HeadyBuddy, HeadyLens, Governed Codeflow, the honeycomb — product nouns are stable and capitalized; never invent synonyms.

## 3. Comfort principles (the emotional contract)

These are the load-bearing UX laws, each anchored in canon:

1. **Honesty of state.** Green/blocked/pending with `blockedReason` surfaced verbatim (pattern from `tooling/awareness` currency + the runbook's ✅/🔒/⚖️ buckets). A component that can't reach its backend says so and names the fix (`AdminUI`: "API unreachable … Set VITE_CODEFLOW_API"). Faking green is the one unforgivable design crime — the runbook refuses to "fake the completion notification"; the UI holds the same line.
2. **Reversibility visible.** Every applied change shows its undo (`Rollback` is a first-class button in the codeflow loop, `AdminUI.renderResult`). Users trust a system whose actions they can see how to reverse — surface rollback affordances *before* users ask.
3. **Progressive disclosure = the three altitudes.** Glanceable verdict (A1) → time-ordered evidence (A2, HeadyLens detail tiers up to `forensic`) → written rationale (A3, compendium/ADRs). Never dump A2 detail on an A1 surface; never strand a user at A1 with no way down (`IA_SITEMAP.md`).
4. **Gates invisible when green.** A passing gate is a thin quiet line; a failing gate is loud, explains itself, and ranks itself in "Needs you". Attention is a budget spent only on non-green (ADR-0013 founder-bottleneck governance: the system exists to protect the human's attention).
5. **No dead ends.** Every blocked state carries its one-tap unblock when one exists (ADR-0026 `token_expired` → inline "Re-authorize" — *"never a dead end"*). If no action exists, say who/what it waits on (`waitingOn` in narrative beats).
6. **Accountability stays human.** No "Approve all" anywhere (REBUILD_PLAN_V2 §7: *"approval is accountability transfer, not control"*). Sensitive actions display *who* will be recorded as approver ("Approve as eric@… (human)").

## 4. Layout grammar

- **Golden-section splits.** Primary/secondary regions at 61.8/38.2 (`heady-living-dashboard` grid; REBUILD_PLAN_V2 §8 canvas:drawer ≈ φ:1). Nesting repeats the ratio.
- **Fibonacci lattice.** All gaps, paddings, radii from {3,5,8,13,21,34,55,89,144}px. Card radius 13px, deep-glass 21px. If a value isn't Fibonacci, it's wrong.
- **Glass depth = hierarchy.** Two elevation steps only: `.glass` (blur 20, sat 180%) for content, `.glass-deep` (blur 40, sat 200%) for overlays/modals. No drop-shadow stacks.
- **Type ramp.** Display headline at φ-powers (1.618/2.618rem); workhorse text at base/1.125; machine values at 0.875/0.75 mono. Admin display face Space Grotesk; user body face Inter; JetBrains Mono for every machine value on both surfaces (compendium §I6).
- **Motion as physiology.** UI transitions 192/309/500ms on `cubic-bezier(0.618,0,0.382,1)`; user-site transitions 382ms; the only ambient animation is the φ⁷ = 29 034 ms heartbeat pulse on *healthy* cells — a slow breath, not a blink — suppressed under `prefers-reduced-motion`.
- **Feeds are bounded.** Live lists cap at Fibonacci counts (144 beats, 89 log lines) and drop oldest — the DOM never grows unbounded.
- **State color is signal, never wallpaper** (REBUILD_PLAN_V2 §8). Teal/violet/amber/red appear only as state; large surfaces stay neutral.

## 5. Do / Don't

| Do | Don't |
|---|---|
| Use only token values from `design-tokens.json` | Invent colors, spacing, shadows, or durations |
| Pair every state color with glyph + text label (✓ ⏸ ✕ ◆) | Communicate state by color alone |
| Surface `blockedReason` verbatim, mono where it's a machine string | Show bare spinners or unexplained disabled states |
| Render honest empty states ("No build activity yet…") | Mock data into empty components |
| Put rollback/undo affordances in the visual hierarchy | Bury reversal behind menus |
| Keep green quiet and non-green loud | Celebrate normal operation with visual noise |
| Vanilla Web Components by default; React only where state complexity earns it (ADR-0019) | Reach for Vue/Angular/Tailwind/UI kits — ever |
| SSE for live data (`ui_sync: sse-http2`), reconnect on φ-backoff | WebSockets, polling storms, fixed 1s retries |
| Respect `prefers-reduced-motion` (kill heartbeat + geometry animation) | Autoplay motion for reduced-motion users |
| Meet WCAG 2.1 AA with the validated pairs in the tokens file | Use `text.muted` (#5a5a6a) for load-bearing copy |
| Keep both themes first-class (light uses the `onLight` state ramp) | Ship dark-only, or reuse raw teal `#00d4aa` as text on light bg (1.77:1 — fails) |
| Read the honeycomb's truth from manifests (`projection_only` shown as violet, proudly) | Let a projection shell masquerade as a real backend |

## 6. Per-surface temperament

- **Admin (1ime1.com):** an instrument panel. Density is a feature; the founder reads it like a cockpit. Space Grotesk + mono, honeycomb hero, "Needs you" always visible. Assume expertise; never explain Heady to Heady's founder.
- **User (headyme.com):** a doorway. One intent bar (HeadyBuddy), four verbs, generous whitespace on the same lattice. Assume zero context; the system's honesty shows up as a status strip, not a diagnostics wall. Accent `#00d4aa`, Flower of Life geometry (the headyme.com signature per the sacred-geometry skill).

## 7. Regeneration contract

If `facts.yaml`, `packages/phi-math`, or the design-system canon changes, this bundle is stale — regenerate per `docs/design/README.md`. Never hand-patch a generated value here without fixing its source.
