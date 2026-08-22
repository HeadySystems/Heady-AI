# 08 — UIs + Projections

> Domain 08 of the Heady™ Master Incorporation Plan. Inventories every app/UI in `apps/*`, the admin
> portal's dual interfaces (Heady-V1 + Heady-AI/rebuild), dashboards (living-dashboard, HeadyLens
> projections), the 9 public domain sites, the edge serving workers, and the four distinct senses of
> "projection" (latent→physical app projection, vector projection, code/JSON-AST projection, adaptive
> UI projection).
>
> Ground-truth: read from `apps/*` source, `docs/adr/*` + `docs/ADR/*`, `tooling/decomposition/manifest.json`,
> `docs/HEADYME_LAUNCH_RUNBOOK.md`, `facts.yaml`, compendium `09-infra-and-services.md`. Skills are claims,
> verified against source. Read-only inventory — no code was modified.

---

## Live-state headline (verify before claiming "live")

- **LIVE:** `apps/headyme-portal` (Vite SPA, built — `dist/` present, `.firebase/hosting…cache` present) on **Firebase Hosting `heady-ai.web.app`** (per MEMORY.md, post-dates the runbook). This is the one live user-facing surface.
- **READY, NOT LIVE — `headyme.com`:** `apps/heady-portal-proxy` worker is written to serve `headyme.com` → proxy `heady-ai.web.app`, but **DNS is not yet cut over** (runbook: "DNS for headyme.com | no records pointing at the live origin"; `PORTAL_GATEWAY_DEPLOY.md`: add the route "once the headyme.com zone is on this CF account"). Do NOT claim `headyme.com` is serving.
- **DEPLOYED edge auth bridge:** `apps/heady-portal-gateway` (`headyme.com/api/*` → private Cloud Run codeflow API; Firebase-token-in → Google-identity-token-out).
- **PENDING (do NOT claim live):** the codeflow Cloud Run origin (`heady-codeflow-api-…us-east1.run.app`) is image-built but **pending one `secretAccessor` IAM grant + redeploy** (MEMORY.md). The launch **runbook does not record a confirmed `headyme.com` L4 cutover** — its terminal gate is `curl https://headyme.com → welcome page`.
- ⚠ The runbook (`docs/HEADYME_LAUNCH_RUNBOOK.md`) predates the `heady-ai.web.app` live note; treat MEMORY.md as the newer deploy fact. Last mile (DNS / `firebase login` / Cloud Run org-policy) is externally blocked.

---

## (a) UI / App roll-up

| App / UI | Purpose | Status | Live URL | Rebuild loc | Transfer group |
|---|---|---|---|---|---|
| **headyme-portal** | Admin control plane + onboarding + MCP console spearhead; dual-state router (`#onboarding` · `#admin`/Rebuild · `#legacy`/Advisor) | **built / live** | `heady-ai.web.app` (live); `headyme.com` pending DNS | `apps/headyme-portal` | G09 FE-01/FE-02 |
| **heady-portal-proxy** | CF Worker: serves `headyme.com` by proxying Firebase origin (DNS-free cutover) | **built, ready — DNS not cut over** | route `headyme.com/*` (pending) | `apps/heady-portal-proxy` | G09 (edge) |
| **heady-portal-gateway** | CF Worker: Firebase-token→Google-identity-token bridge to private Cloud Run codeflow API; fail-closed 401 | **deployed** | route `headyme.com/api/*` | `apps/heady-portal-gateway` | G09 (edge) |
| **heady-edge-gatekeeper** | CF Worker ingress: Ed25519-authed ingest → Workers AI embed → Vectorize upsert (Hono+Zod) | **built** (worker, not a UI) | edge | `apps/heady-edge-gatekeeper` | G03 (vector edge) |
| **heady-manager** | Origin app (Cloud Run modular monolith) — serves `/health`, `/metrics`, `/`. **Backend/API, not a UI** | **built** | Cloud Run `us-east1` | `apps/heady-manager` | origin (G04/G06) |
| **mcp-dashboard** | UI for `headymcp.com` — MCP tool-catalog / telemetry console | **planned** (README stub only) | (planned) `headymcp.com` | `apps/mcp-dashboard` | G09 FE-02 / projection spoke |
| **headysystems** | UI for `headysystems.com` — commercial platform site | **planned** (README stub only) | (planned) `headysystems.com` | `apps/headysystems` | projection spoke |
| **ableton-edge** | Projection vertical "Ableton SysEx Edge — Cloud MIDI Sequencer" | **planned** (README stub only) | (planned) | `apps/ableton-edge` | projection spoke (Domain 07 overlap) |

**Dashboards / projections (not standalone apps):**
- **`<heady-build-narrative>`** vanilla web component, mounted in AdminUI — live build story via HeadyLens SSE spine. **built**, `apps/headyme-portal/src/components/heady-build-narrative.js`.
- **HeadyLens** projection layer — `packages/headylens` (record/store/collector). Taps events+logger+observability → time-ordered, detail-graded, redacted stream + query/SSE API. **built (package)**.
- **living-dashboard** (skill `heady-living-dashboard`) — vanilla HTML/CSS/JS real-time monitoring dashboards (health, coherence, topology, token budgets, swarm). **skill/pattern, no deployed instance found** → planned/on-demand.
- **ScaffoldPlannerUI** — AdminUI section reading `/scaffold-plan.json`, Heady-AI vs Heady-V1 decision overlay. **built**, `apps/headyme-portal/src/components/ScaffoldPlannerUI.js`.

---

## (b) The 9 public domain sites

✅ **RECONCILED 2026-08-22 — the roster is no longer contradictory, and no longer 9.** The canon is
`facts.yaml domains:` (**16** nodes), closed over every live carrier; the table below is the ADR-time
brand snapshot, not the roster. Membership + each node's `sources:` are enforced by the coherence
kernel's D1–D6 guards, and `configs/_generated/domain-roster.json` is the projection consumers read.
Note a **case-collision**: a *different* ADR-0019 lives at `docs/adr/0019-frontend-framework-selection.md` (lowercase).

| Domain | Entity | UI / Purpose | Status |
|---|---|---|---|
| **headyme.com** | HeadySystems | Core platform / SaaS — admin portal + onboarding (Center) | portal **live at `heady-ai.web.app`**; `headyme.com` proxy ready, **DNS not cut over** |
| **headyai.com** | HeadySystems | AI orchestration / API credits (Inner) | planned |
| **headymcp.com** | HeadySystems | MCP gateway / per-request API console (Inner) | planned (`apps/mcp-dashboard` stub; edge worker live separately) |
| **headybuddy.com** | HeadySystems | Companion AI (Middle) | planned |
| **headyos.com** | HeadySystems | Latent OS — enterprise license (Middle) | planned |
| **headyfinance.com** | HeadySystems | FinTech advisory — risk + signal, paper-mode (Outer) | planned |
| **headylab.com** | HeadySystems | Research / patents (Outer) | planned |
| **headyconnection.org** | HeadyConnection (501(c)(3)) | Nonprofit portal — grants/donations; **IRS boundary: no commercial features** (Governance) | planned |
| **headyweb.com** | HeadySystems | Web / frontend hub (Ops) | planned |

**SSO infra subdomains (not counted in the 9):** `auth.headysystems.com` (ADR-0028 unified auth route), `relay.headysystems.com` (iframed cross-site token relay). All 9 → **Cloudflare Pages backed by Cloud Run `us-east1`**, per-domain Firebase Auth tenant isolation, per-domain ML-DSA signing keys.

⚠ **Conflicting lists (do not treat as canonical)** — none of these is a registered carrier, so
D1 does not see them; they are prose that must be read against `facts.yaml domains:`:
- `docs/compendium/09-infra-and-services.md` §I7 lists **11** (adds headyio, headybot, headyapi, headylens, headyfinance; each a Drupal 11 site).
- `.agents/skills/heady-perplexity-content-generation` "Site Roster (9 Sites)" — different set (heady-ai.com, headyex.com, headyfinance.com, admin.headysystems.com…).
- `_archive/configs/_domains/domain-architecture.yaml` (v2.0, 2025-02-08, legacy) — only **3** brand domains. **Quarantined 2026-08-22** with 18 sibling dumps; it name-collided with the live carrier `configs/domain-architecture.json`. See that directory's README.
- Legacy disposition (`docs/LEGACY_STACK_COMPONENT_DISPOSITION.md`) describes **~16** domain static-site sprawl → collapse to one SSG source + mass Drop.

---

## (c) Per-system templates

### headyme-portal (admin Heady-AI + Heady-V1 + onboarding)
- **Category** · UI / admin control plane · **Status** built + live · **Confidence** high (full source read).
- **What:** Vite SPA, vanilla web components + Firebase Auth. `src/main.js` dual-state hash router:
  `#onboarding` (OnboardingUI, email/pw sign-in) → `#admin` (**AdminUI = Heady-AI / Rebuild**, PRIMARY) ↔ `#legacy`
  (**LegacyUI = Heady-V1 / Advisor**). AdminUI panels: System Coherence, Variable Registry, Legacy Decomposition,
  Build Narrative (HeadyLens SSE), Governed Codeflow (browse/load/submit/evaluate/approve/apply/rollback proposals).
  Three API clients (`src/services/heady-api.js`): `api`→`VITE_CODEFLOW_API`, `legacyApi`→`VITE_LEGACY_API`,
  `lens`→`VITE_HEADYLENS_API`.
- **Legacy:** React+Vite admin/IDE family + duplicate static sites (FE-01/02/03 seeds: `public/mcp-dashboard.html`,
  `apps/heady-mcp-portal`, `admin-ui`) → **Adapt** (right tool, wrong component model).
- **Rebuild(path/URL):** `apps/headyme-portal` → `heady-ai.web.app` + `headyme.com`.
- **Parts:** main.js router → {OnboardingUI, AdminUI(→ScaffoldPlannerUI, `<heady-build-narrative>`, codeflow form), LegacyUI} · services {firebase.js, heady-api.js}.
- **OSS (current+planned):** **Vite 8 SPA + vanilla Web Components + Vanilla CSS w/ Sacred-Geometry tokens** (ADR-0019 frontend). React permitted only for complex canvas/3D. Firebase 12 SDK.
- **Transfer:** G09 `frontend-console-ui` — "**headyme-portal is the locked spearhead (unblocks Google for Startups)**".
- **Incorporation steps:** Firebase deploy (needs `firebase login`); map `headyme.com`→Firebase custom domain or proxy worker; set `VITE_*` envs to gateway URL; Worker route `headyme.com/api/*`→gateway.
- **⚠ Drift+decisions+ADR:** ADR-0019(frontend) Vite+WC; ADR-0026 MCP console; V9 Law-3 "no React ever" is **stale/non-binding** per ADR-0019 reconciliation. Firebase web config (`apiKey`) is committed in `firebase.js` — Firebase web keys are public-by-design, not a secret leak, but note for audit.

### heady-portal-gateway + heady-portal-proxy (edge serving workers)
- **Category** · CF Worker edge projection · **Status** proxy=live, gateway=deployed · **Confidence** high.
- **What:** **proxy** serves `headyme.com` by forwarding to Firebase origin (`ORIGIN=heady-ai.web.app`), rewriting Host/`x-forwarded-*`, passing SPA rewrites through — DNS-free cutover. **gateway** fronts the PRIVATE codeflow Cloud Run API: verifies the browser's Firebase ID token (RS256/JWKS via WebCrypto, fail-closed 401), mints a Google identity token (SA JWT→id_token, run.invoker, ~55m cache), forwards with `x-heady-user`. CORS allowlist `heady-ai.web.app,headyme.com,www.headyme.com`.
- **Legacy:** none (new edge bridge for the `--no-allow-unauthenticated` Cloud Run org policy).
- **Rebuild:** `apps/heady-portal-proxy` (route `headyme.com/*`), `apps/heady-portal-gateway` (route `headyme.com/api/*`, more-specific).
- **Parts:** proxy{fetch passthrough} · gateway{verifyFirebaseToken, gcpIdToken(PKCS8 sign), corsHeaders, proxy}.
- **OSS:** Cloudflare Workers + Wrangler 3.90; WebCrypto (no deps). Structured JSON logs via console→`wrangler tail`/observability.
- **Transfer:** G09 (edge serving) + cross-domain SSO (ADR-0028).
- **Incorporation steps:** `wrangler secret put GCP_SA_KEY` (SA with `roles/run.invoker`); add Worker routes once `headyme.com` zone is on this CF account.
- **⚠ Drift:** gateway carries a long-lived SA **JSON key** as a Worker secret — prefer WIF/keyless per MEMORY (`headykey-headyvault-wif`); flag as rotation candidate. SEC-001 lineage (live keys previously hardcoded in legacy workers).

### HeadyLens projections (observability projection)
- **Category** · projection / observability stream · **Status** built (package) · **Confidence** high.
- **What:** `@heady/headylens` taps events + logger + observability → a time-ordered, detail-graded, redacted event stream with a query/SSE API. Drives `<heady-build-narrative>` in the portal (subject prefix `heady.action.build.`, φ⁷≈29034ms reconnect heartbeat, ADR-0026 teal/violet/amber palette, FIB[12]=144 beat DOM cap).
- **Legacy:** ad-hoc logs / dashboards.
- **Rebuild:** `packages/headylens/src/{record,store,collector,index}.mjs` consumed by portal AdminUI.
- **OSS:** SSE + HTTP/2 (ADR-0022/0026); vanilla web component renderer.
- **Transfer:** G09 FE-03 (ops-dashboard → console widgets, SSE).
- **Incorporation steps:** expose `VITE_HEADYLENS_API`; wire signed audit-of-record (deferred to G5/G9 per MEMORY).
- **⚠ Drift:** signed audit-of-record not yet implemented (deferred).

### "Projection" concept — four distinct senses (do not collapse)
- **Category** · architecture concept · **Confidence** high (ADR-0017/0023 + README stubs + manifest read).

1. **Latent→physical APP projection (liquid deploy).** ADR-0017 "projections-engine": **a projection is a pure one-way derivation `(monorepo_SHA, source_path, transform_fn) → public repo`**. Four invariants: one-way, content-addressable (SHA-256 sorted-tree hash), manifest-authoritative (`projection.yaml`), license/patent-bounded. Tooling: Google **Copybara** + Node projector. Lifecycle: `proposed→scaffolded→active→deprecated→archived→eliminated`. Drift cron (15min): `in-sync` / `source-ahead`(re-project) / `projection-ahead`(**page + freeze**). The MCP Console reads the manifest to render `real_service` vs `projection_only`. **The `apps/{ableton-edge,headysystems,mcp-dashboard}` stubs are projection spokes** — "Built from `latent-core-dev` Hub → projected to `*-production` spoke via GitHub Actions." Transfer: G03 `DA-08` projection-engine (`packages/projections`), `DA-11` projection-daemon (deferred).

2. **Vector projection (3D spatial / pgvector→Vectorize).** ADR-0023 vector-projection-trigger: **Merkle-tree file hashing (`heady-merkle-index`) is the authoritative trigger** for re-embedding only changed files into Neon pgvector (authority) → projected to Vectorize derived edge cache. (DB-level projection uses WAL/logical-replication CDC per ADR-0014; the two are scoped by domain.) Skills: `heady-vector-projection`, `heady-edge-gatekeeper` performs the embed→Vectorize upsert.

3. **Code / JSON-AST projection.** Skill `code-projection` — projecting code structure; complements the governed codeflow (proposals are validated/applied/rolled-back).

4. **Adaptive UI projection (projection-composer).** Skill `heady-projection-composer` — context-driven UI/app delivery; adaptive interfaces that reshape by user intent, composing liquid UI projections from modular components. Planned/conceptual (no deployed instance).

- **⚠ Drift:** `apps/mcp-dashboard/README` claims **"Webpack Module Federation"** + Sacred-Geometry-UI-Kit — this **contradicts ADR-0019** (Vite + vanilla WC, React only for complex canvas; Module-Federation shell `FE-06` is explicitly **Dropped** in the decomposition manifest). The README stub stack is stale/aspirational, not canonical. The `sync-projection-bee` (in `heady-bee-swarm-ops`) is the swarm worker that drives sense-#1 projection sync.

---

## Open decisions / drift to resolve
- **R1 — React vs vanilla Web Components for console/app** (compendium §I6 + MEMORY): ADR-0019 reconciliation says vanilla WC default, React only for complex canvas/console/MCP; the explicit per-surface call for the console/app SPA is still **open**.
- ~~**9-domain canonical list**~~ — **CLOSED 2026-08-22.** Canon = `facts.yaml domains:` (16), closed over all 5 live carriers and gated by coherence D1–D6; consumers read `configs/_generated/domain-roster.json`. What remains is a *founder* call, not drift: brand fields (`entity`/`tenant`/`revenue`/`layer`) are ratified for 10 of 16.
- **mcp-dashboard stack drift** — README claims Webpack Module Federation (a Dropped `FE-06` pattern), contradicting ADR-0019. Stub must be rebuilt to Vite + vanilla WC.
- **ADR-0019 case-collision** — two different ADR-0019 files (`docs/adr/` frontend vs `docs/ADR/` nine-domain); rename one to avoid ambiguity.
- **gateway SA key** — long-lived JSON SA key as Worker secret; migrate to WIF/keyless + rotate.
- **headyme.com last mile** — DNS cutover, `firebase login`, Cloud Run org-policy / `secretAccessor` grant — externally blocked.

## Sources
`apps/headyme-portal/src/{main.js,components/*,services/*}`, `apps/heady-portal-{gateway,proxy}/src/index.ts` + `wrangler.json`, `apps/heady-edge-gatekeeper/src/index.ts`, `apps/heady-manager/src/{app,index}.mjs`, `apps/{ableton-edge,headysystems,mcp-dashboard}/README.md`; `docs/adr/0017,0019(frontend),0022,0023,0026,0028`; `docs/ADR/0019-nine-domain-brand-architecture.md`; `tooling/decomposition/manifest.json` (G09, G03); `docs/HEADYME_LAUNCH_RUNBOOK.md`; `docs/compendium/09-infra-and-services.md`; `docs/LEGACY_STACK_COMPONENT_DISPOSITION.md`; `facts.yaml`; `packages/headylens/`; skills `heady-living-dashboard`, `heady-vector-projection`, `heady-projection-composer`, `code-projection`; MEMORY.md.
