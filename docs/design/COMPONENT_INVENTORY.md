<!-- ╔══════════════════════════════════════════════════════════════════╗
     ║  HEADY™ Component Inventory v1.0.0 — docs/design bundle           ║
     ║  What exists in apps/headyme-portal today + the target component  ║
     ║  set for the living-dashboard home. Derived from source, not      ║
     ║  aspiration. © 2026 HeadySystems Inc. — Eric Haywood, Founder     ║
     ╚══════════════════════════════════════════════════════════════════╝ -->

# Component Inventory — headyme-portal (current) → living dashboard (target)

Source of truth: `apps/headyme-portal/src/components/` + `apps/headyme-portal/src/services/heady-api.js`, read 2026-07-04 on branch `feat/service-registry`.

## 1. What exists today

The portal is a Vite SPA with a hash router (`#onboarding` → `#admin` ↔ `#legacy`), vanilla Web Components + classes rendering into a container, Firebase Auth session (ADR-0019 architecture).

### `OnboardingUI` — `apps/headyme-portal/src/components/OnboardingUI.js`
- **Purpose:** email/password sign-in and account creation gate for the portal.
- **State:** built, minimal. No Heady brand header in file (only component without one). No password reset, no OAuth providers.
- **Data:** Firebase Auth only (`signInWithEmailAndPassword` / `createUserWithEmailAndPassword` via `../services/firebase.js`). No Heady API calls.

### `AdminUI` — `apps/headyme-portal/src/components/AdminUI.js`
- **Purpose:** "Heady™ Mission Control" — the rebuild control plane. Dual-state tab strip (Rebuild PRIMARY / Legacy ADVISOR).
- **State:** built + live (`heady-ai.web.app`). Panels: System Coherence, Variable Registry, Legacy Decomposition, Build Narrative, Governed Codeflow.
- **Data endpoints** (all via `api` client → `VITE_CODEFLOW_API`):
  - `GET /api/status` — coherence gate (GREEN + contradictions + incomplete), variable registry counts, decomposition counts.
  - `GET /api/files?path=` — repo browse/load for the codeflow editor.
  - `POST /codeflow/proposals` → `POST /codeflow/proposals/:id/evaluate|approve|apply|rollback` — the full governed-change loop (ADR-0005). Sensitive paths surface "human approval required (no self-approve)".
- **Status honesty already present:** cards render `online / alert / offline` and print the *reason* (`API unreachable: … Set VITE_CODEFLOW_API`) instead of faking green.

### `<heady-build-narrative>` — `apps/headyme-portal/src/components/heady-build-narrative.js`
- **Purpose:** live build story — Shadow-DOM Web Component streaming HeadyLens beats grouped by `traceId`.
- **State:** built. ADR-0026 palette baked in (teal/violet/amber/red), φ⁷ = 29 034 ms reconnect heartbeat, FIB[12] = 144 beat DOM cap.
- **Data:** `lens` client → `VITE_HEADYLENS_API`: `GET /api/lens/stream?subject=heady.action.build.&detail=forensic` (SSE via fetch+ReadableStream because EventSource can't set the Bearer header), `GET /api/lens/health`.
- **Beat vocabulary (reuse everywhere):** `plan ◇ · start ▸ · progress · · decision ◆ · gate ⛬ · done ✓ · blocked ⏸ · fail ✕`, with `waitingOn`, `rationale`, `score/threshold`, `durationMs` metadata.

### `ScaffoldPlannerUI` — `apps/headyme-portal/src/components/ScaffoldPlannerUI.js`
- **Purpose:** accept / defer / replan every option of the rebuild plan; two builds (Heady-AI rebuild, Heady-V1 legacy).
- **State:** built. Decisions overlay in `localStorage` or shared via API; replan converses with HeadyBuddy and is *honest when off* ("HeadyBuddy not connected (set VITE_HEADYBUDDY_URL)").
- **Data:** `GET /scaffold-plan.json` (static, emitted by `heady-scaffold sync` from `configs/scaffold-plan.json`); `GET|POST ${VITE_SCAFFOLD_API}/api/scaffold/decisions`; `POST ${VITE_HEADYBUDDY_URL}` (`kind: scaffold.replan`).
- **Option states:** `done ✓ · in-progress ◐ · pending ○ · deferred ⏸` + decision chips `accepted / deferred / replan ↻`.

### `LegacyUI` — `apps/headyme-portal/src/components/LegacyUI.js`
- **Purpose:** read-only Legacy Advisor — health, swarm status, baseline-vs-rebuild metric table, pattern advisor, live log SSE.
- **State:** built. φ-backoff SSE reconnect (1000·φⁿ ms capped at FIB[13] = 233 s), FIB[11] = 89-line log cap.
- **Data** (via `legacyApi` → `VITE_LEGACY_API`): `GET /api/advisor/health`, `/api/advisor/swarm-status`, `/api/advisor/baseline`, `/api/advisor/patterns/:domain` (auth|routing|vector|csl|swarm|pipeline), `/api/advisor/config/:service`, `GET /api/advisor/stream` (SSE).

### Shared services
- `apps/headyme-portal/src/services/heady-api.js` — three clients: `api` (codeflow), `legacyApi` (advisor), `lens` (HeadyLens SSE). Bearer = Firebase ID token.
- `apps/headyme-portal/src/services/firebase.js` — Firebase Auth (web config public-by-design).

## 2. Target component set — the living-dashboard home

Additions that turn AdminUI's card grid into the living dashboard (ADR-0026 honeycomb + heady-living-dashboard skill layout). All vanilla Web Components unless canvas/3D complexity earns React (ADR-0019).

### The status honesty pattern (mandatory, every component)
Canon sources: launch-runbook buckets (`✅ built / 🔒 externally blocked / ⚖️ partial`), `tooling/awareness` `currency.blockedReason`, ADR-0026 first-class `token_expired`, narrative `blocked` beat with `waitingOn`.

```
state:  healthy (teal) | degraded/projection (violet) | blocked (amber) | fail (red) | pending (neutral)
rule 1: blocked/pending ALWAYS carries a visible blockedReason string ("needs firebase login",
        "waiting on secretAccessor IAM grant") — never a bare spinner or silent gray.
rule 2: a blocked state renders its one-tap unblock action when one exists (ADR-0026
        "Re-authorize" pattern) — never a dead end.
rule 3: green is quiet (gates invisible when green); non-green is loud and explains itself.
```

### Target components
| Component | Purpose | Primary data | Notes |
|---|---|---|---|
| `<heady-status-hex>` | One connector/service cell of the honeycomb; self-reports state via manifest verdict | connector registry probe on 29 034 ms heartbeat; `ServerManifest` (`projection_only` + `Provenance`) | ADR-0026 state machine: `not_connected / connecting / connected×{healthy,degraded} / unreachable / token_expired / projection_only / empty` |
| `<heady-honeycomb>` | The living honeycomb home hero — hex grid of all connectors, canvas:drawer ≈ φ:1 | composed of `<heady-status-hex>`; `ConsoleSummary` | REBUILD_PLAN_V2 §8; ambient φ-heartbeat pulse on healthy cells, off under `prefers-reduced-motion` |
| `<heady-gate-banner>` | Single top-of-page coherence verdict: Gate GREEN/AMBER/RED + contradictions count | `GET /api/status` (`coherence.gate`) | replaces the System Coherence card as the page's first fact |
| `<heady-blocked-list>` | "Needs you" — every blocked item with blockedReason + unblock action, ranked | codeflow `governance_pending` proposals; awareness `currency.blockedReason`; runbook 🔒 rows | this is the founder-bottleneck surface (ADR-0013) |
| `<heady-approval-queue>` | Codeflow proposals awaiting human approval, with diff preview + approve/apply/rollback | `GET /codeflow/proposals` + evaluate/approve/apply/rollback | lift out of AdminUI's inline form into a drill-down |
| `<heady-build-narrative>` | (exists) live build story | HeadyLens SSE | reuse as-is |
| `<heady-lens-feed>` | Altitude-2 drill-down: full HeadyLens stream with subject + detail-tier filters | `GET /api/lens/stream?subject=&detail=` | generalization of the narrative component beyond `heady.action.build.` |
| `<heady-service-catalog>` | Browse the real service map (40 services, 7 groups) with caps + endpoint + component | `SERVICE_CATALOG` from `src/hc_service_dispatcher.js` (served via registry API) | the IA source for the user surface too |
| `<heady-coherence-spark>` | Sparkline of coherence score vs φ-thresholds (0.882 / 0.691 bands) | lens records `score/threshold` | bands from phi-math `CSL_THRESHOLDS` |
| `<heady-buddy-dock>` | Persistent HeadyBuddy conversation dock (user surface primary nav; admin helper) | `POST ${VITE_HEADYBUDDY_URL}` | honest-when-off is already the ScaffoldPlanner pattern |

### Explicit non-goals (today)
- No "Approve all" anywhere — approval is accountability transfer (REBUILD_PLAN_V2 §7).
- No mock/fake data states: a component with no backend renders its blocked state + reason, exactly like ScaffoldPlannerUI's HeadyBuddy row.
- No Vue/Angular/Tailwind (ADR-0019).
