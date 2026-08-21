---
description: Route a noteworthy observation through the canonical @heady intelligence preflight without fabricating an API or silently persisting data
---

<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ Trigger Update Compatibility Workflow v2.0.0            ║
║  Observation intake through the governed intelligence router.   ║
║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# `/heady-trigger-update`

Treat the submitted observation as `/heady <observation>` and follow
`.agents/workflows/heady.md`. Preserve severity, evidence, affected resources,
and the user's requested outcome in the routed input.

## Rules

- Do not claim `POST /api/heady/trigger`, `src/hc_trigger_update.js`, or a local
  vector-memory sink exists without verifying it in the current checkout and,
  for live use, exercising its authenticated contract.
- Do not silently discard low-confidence observations. Report the route and any
  ambiguity, then continue with safe diagnostics that remain within user scope.
- Do not write to Neon, emit external events, deploy, or persist a background
  trigger unless the user authorized that mutation and all governance gates pass.
- Never recursively invoke this workflow or `@heady` after the initial route.

Completion requires the selected capabilities, executed diagnostics/actions,
verification evidence, and any unresolved live-state blocker.
