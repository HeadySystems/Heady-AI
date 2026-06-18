<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ Master Incorporation Plan · Domain 09                     ║
║  Legacy Transfer Disposition — the cross-cutting transfer map     ║
║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# Domain 09 — Legacy Transfer Disposition (Master Cross-Cutting View)

> **Status:** Authoritative transfer map · **Owner:** Eric Anthony Haywood
> **Primary source (THE source):** `tooling/decomposition/manifest.json` — 14 transfer groups, **150 components** (full disposition coverage), built/verified by `tooling/decomposition/src/decompose.mjs` (manifest-driven, fail-closed, idempotent).
> **Disposition authority:** `docs/LEGACY_STACK_COMPONENT_DISPOSITION.md` (the per-component marks). **Method:** `docs/LEGACY_EXTRACTION_SYSTEM.md` (the Extraction Engine that consumes these rows). **Regrouping:** `docs/SYSTEM_DECOMPOSITION.md`. **Patent track:** `docs/LEGACY_PATENT_TRADESECRET_MIGRATION_PLAN.md`.
> **Legacy roots:** `/home/headyme/Heady` (the carve source, 366 top-level entries; also mirrored at `/home/headyme/workspace/Heady`). **Rebuild root:** `/home/headyme/Heady-AI`.
> **Premise (ADR-0002 strangler-fig, reframed):** pre-launch port-and-verify — no live traffic to shadow, no production data to migrate — **except** the R-5 data-layer carve-out below.

This ties the whole Master Incorporation Plan to the decomposition system. It is the answer to "what
exists in legacy, where each piece goes, and on what condition." It is **grounded** — the decomposition
tool has already run (`.data/decomposition/decomposition-report.json`): **14 groups, 150 components, 13
bundled, 1 provenance-only (G99), 0 secret-leak-blocked bundles, 11 quarantined files (7 likely-real
leaks).**

---

## Disposition vocabulary mapping

The task's vocabulary (`transfer-as-is | rebuild | rewrite | drop | patent-gated`) maps onto the
manifest's four marks. **"Defer" is preserved as its own value** — G13 alone is 25 deferred components, a
real category the 5-verb list omits.

| Manifest mark | Task disposition | Meaning |
|---|---|---|
| `integrate` ✅ | **transfer-as-is** | Port largely as-is; already conforms to the locked stack. |
| `adapt` 🔧 | **rewrite / rebuild** | Concept/logic valuable but must be rewritten to conform (ESM, framework, store, gateway). |
| `defer` ⏸ | **defer** | Real but post-launch / Phase-4+ / evidence-gated. Bundled for provenance, marked deferred. |
| `drop` ❌ | **drop** | Dead, duplicate, superseded, or violates a locked decision. Provenance-only (never bundled). |
| `patent_lock` overlay | **patent-gated** | Overlay on G01 + G12; needs ARBITER `ALLOW` + signed HCP before merge. |

---

## (a) The 14 transfer groups

Component counts are `group.components.length` (the disposition-authoritative count), **not** the
report's `present`/`missing` path counts (a single component can carry multiple paths — e.g. G13 has 25
components across 41 paths).

| Group | Name | # comp | Primary disposition | Target rebuild location | Patent-gated? |
|---|---|---:|---|---|:--:|
| **G01** | φ-Math & CSL Core | 6 | rewrite (adapt) + 2 transfer-as-is | `packages/phi-math`, `packages/csl-engine` | ⚠️ **yes** (BZ-05/HS-058) |
| **G02** | Bee / Swarm Runtime & Orchestration | 6 | rewrite (adapt) | `packages/bees`, `orchestration`, `engines` | no |
| **G03** | Data / Memory / Vector / Projections | 9 | rewrite (adapt) + 2 defer | `packages/db`, `memory-stream`, `projections` | no (🔴 **R-5-gated**) |
| **G04** | MCP Servers / AI Gateway / Colab Fabric | 11 | rewrite (adapt) | `packages/contracts`, `headyme-portal`, model-gateway | no |
| **G05** | Backend Core / Kernel / Manager | 12 | rewrite (adapt) | `core/modules`, `packages/kernel` | no |
| **G06** | Auth / Security / Middleware / Compliance | 5 | rewrite (adapt) | `packages/security-mesh`, `auth` | no |
| **G07** | Cloudflare Edge / Workers Fleet | 3 | transfer-as-is (integrate) | CF Workers/Pages/DO/Workflows | no |
| **G08** | Infra / CI-CD / Observability / Governance | 12 | mixed transfer-as-is + rewrite | `tooling/ci`, `packages/observability`, infra (Terraform) | no |
| **G09** | Frontend / MCP Console / Buddy | 7 | rewrite (adapt) | `headyme-portal`, `apps/*` | no |
| **G10** | Content / Cognition / Assets / Personas | 6 | transfer-as-is + rewrite | content store, `docs/compendium`, asset store | no |
| **G11** | Golden Record / Foundations / Skills / Tooling | 6 | transfer-as-is + rewrite | `facts.yaml` (root), `docs/compendium`, `.agents/skills`, `tooling` | no |
| **G12** | 🔒 Patent Implementations (ARBITER-GATED) | 1 | **patent-gated** (defer) | `packages/*` under ARBITER patent-lock review | ⚠️ **yes** (R-8) |
| **G13** | Deferred — Post-Launch / Evidence-Gated | 25 | defer | mobile / desktop / enterprise / niche phases | no (BE-21/IN-19 carry patent concepts C9/C10) |
| **G99** | Dropped — Provenance Manifest Only | 41 | drop | `_archive/provenance` (tarball ref only) | no |
| | **Total** | **150** | | **31 target repos/pkgs (7 exist, 24 net-new)** | |

**Extraction order / DAG.** Phases gate the order: **P0** (G08, G11) → **P1** (G01, G03, G06, G10) →
**P2** (G02) → **P3** (G04, G05, G07, G09) → **deferred** (G12, arbiter-only) → **P4** (G13). `maxParallel
= fib(6) = 8`; independent groups within a phase run in parallel. Every component is carved through the
Extraction Engine: `security-bee` (G1 pre-import) → `arbiter` (G2 pre-port, patent zones) → codemod
(G2.5) → characterization tests (G3-pre) → `eval-gate` (G3) → consistency gate vs `facts.yaml` (G4,
fail-closed) → ledger + STEPWISE entry + HCP where a lock is touched.

---

## (b) Per-group detail

### G01 — φ-Math & CSL Core
- **6 components · primary disposition: rewrite (adapt), 2 transfer-as-is · Confidence: HIGH** (all paths verified present in legacy).
- **What it contains:** the mathematical differentiator — the foundation layer everything depends on. φ/Fibonacci constants, sacred-geometry topology, the canonical CSL cosine-gate engine, VSA→CSL bridge.
- **Key components:**
  - `BE-04` `shared/csl-engine-v2.js` → `@heady/csl-engine` (**rewrite** — the live CSL dep).
  - `AG-04` `maximum-potential/phi-constants.cjs` → `@heady/phi-math` (**transfer-as-is**).
  - `DA-16` `sacred-geometry.js` → `@heady/phi-math` (**transfer-as-is**).
  - `BZ-05` `heady-vsa-integration` → `@heady/csl-engine` (**rewrite, ⚠️ patent HS-058**).
  - `BE-07` `shared/` (auth-mgr, bee-factory, encryption, CORS), `BE-08` `shared-ts/` → `@heady/shared` (rewrite/transfer-as-is).
- **Target:** `packages/phi-math`, `packages/csl-engine`.
- **Transfer order/deps:** P1, no deps — the root of the DAG; G02/G03/G05 all depend on it.
- **⚠ Gates:** `BZ-05` is **patent-gated** (HS-058, CSL concept cluster C1) → ARBITER `ALLOW` + HCP before port. `csl-engine.js` root copy is the dropped `BE-05` (broken import) — do not carry.

### G02 — Bee / Swarm Runtime & Orchestration
- **6 components · primary disposition: rewrite (adapt) · Confidence: HIGH.**
- **What it contains:** the φ-math swarm engine (spawn→dispatch→consensus→fuse) — the best runnable agent code in legacy.
- **Key components:**
  - `AG-01` `agents/` (bee-factory, hive-coordinator, federation-manager) → `packages/bees` (**rewrite** — best code in layer; CSL+φ is the IP).
  - `AG-03` `maximum-potential/liquid-nodes` (`BaseHeadyBee` lifecycle) → `packages/bees` (transfer-as-is concept; some broken imports).
  - `AG-05` `heady-10-10` + `directives/source` (auto-success engine, LAW-07) → `packages/orchestration` (**rewrite** — keep the TS/ESM twin, drop the CJS dup).
  - `AG-06` `heady-hive-sdk` → `packages/orchestration` (rewrite; route via AI Gateway+NATS, not REST).
  - `AG-02` `agents/headybee-swarm.js` → `packages/bees` (**rewrite** — salvage routing, **drop Pinecone/Redis**; it introduces a 4th competing taxonomy — do not propagate).
  - `AG-13` `heady-agents` → AI SDK v6 agents (reuse personas; **drop rejected Agent-SDK wiring + `localhost:3310`**, R-10).
- **Target:** `packages/bees`, `packages/orchestration`, `packages/engines`.
- **Transfer order/deps:** P2, depends on G01 + G03.
- **⚠ Decisions:** AG-02 brings a 4-way taxonomy (reconciled in compendium/02 — use Taxonomy B). AG-05 maps to patent concept C8 (Auto-Success φ⁷ heartbeat, trade secret).

### G03 — Data / Memory / Vector / Projections
- **9 components · primary disposition: rewrite (adapt) + 2 defer · Confidence: HIGH — but 🔴 R-5-GATED.**
- **What it contains:** the canonical `heady_*` pgvector(384) schema + φ-vector memory engine.
- **Key components:**
  - `DA-01` `migrations/` (0001–0009) → `packages/db` (**rewrite, R-5-gated** — verify live Neon `\dt heady_*` before assuming greenfield).
  - `DA-06` `memory/vector-store.js` → **Vectorize T2 cache** (net-new; salvage φ-eviction/CSL-gate).
  - `DA-08` `memory/projection-engine.js` → `packages/projections`.
  - `DA-07` `memory/embedding-pipeline.js` → single-provider CF embed (**KEEP breaker only; drop fake-hash + 7-provider router**, R-4).
  - `DA-05` `heady-db-infra` (redis-pool) → T0 Redis/KV adapter. `DA-14` `registry` → service registry table. `BZ-07` `heady-implementation` → db/migrations + `packages/vector` (only section1 portable).
  - `DA-04` `migrations/_superseded`, `DA-11` `heady-projection` → **defer** (port only `projection_tables` + `graph_rag_schema` from _superseded into 0010+).
- **Target:** `packages/db`, `packages/memory-stream`, `packages/projections`.
- **Transfer order/deps:** P1, depends on G01.
- **🔴 R-5 GATE:** `DA-01` extraction is hard-gated on live-Neon verification. If `\dt heady_*` returns rows, the data layer is **not** greenfield → revert to expand→migrate→contract (ADR-0007), not a clean port. Maps to patent concept C5 (3-tier φ-decay memory + 384→3 projection).

### G04 — MCP Servers / AI Gateway / Colab Fabric
- **11 components · primary disposition: rewrite (adapt) · Confidence: HIGH (with 1 manifest path bug — see flag).**
- **What it contains:** the AI brain — 8 Node MCP servers + tool services + the 4-runtime Colab GPU fallback fabric.
- **Key components:**
  - `MC-01` `mcp-servers/heady-mcp-server.js` (v6, canonical) → `packages/contracts` + MCP Console.
  - `MC-06` `mcp-servers/services` + `tool-schemas.js` → `mcp-tools.json` (regen via OpenAPI/Kubb).
  - `MC-04` `mcp-servers/liquid-nodes-mcp-server.js` → **reroute via CF AI Gateway** (🔴 R-3 — direct Gemini bypass).
  - `MC-03` the 4 domain MCP servers → contracts + MCP tools. **⚠ Manifest path bug:** manifest lists `mcp-servers/{governance,intelligence,memory,orchestration}-mcp-server.js`, but legacy has them as `heady-governance-mcp-server.js` etc. (the `heady-` prefix is dropped in the manifest). **Components exist** — fix the manifest paths before extraction; do not classify as "missing."
  - `MC-10` `colab-gateway` (TS) → Colab inference adapter (**transfer-as-is** — newest, typed). `MC-09` `colab` runtimes → inference fallback (**swap embed → bge-small-384**, Nomic-384 model mismatch).
  - `MC-08` `heady-mcp-security` → CF Worker gateway / security-bee. `MC-20` `proto` → OpenAPI/Kubb (not raw gRPC) + keyless OIDC + GCP SM.
- **Target:** `packages/contracts`, `headyme-portal`, model-gateway.
- **Transfer order/deps:** P3, depends on G01 + G03.
- **⚠ Security:** R-3 (AI Gateway bypass) originates here — **all model egress must reroute through CF AI Gateway** (`facts.model_layer.egress_chokepoint`). R-1 (live key in `perplexity-build/`) is the dropped MC-14, see security callout.

### G05 — Backend Core / Kernel / Manager
- **12 components · primary disposition: rewrite (adapt) · Confidence: HIGH.** Largest single effort.
- **What it contains:** the ESM microkernel + the 136KB `heady-manager.js` god-server to migrate-then-archive.
- **Key components:**
  - `BE-02` `core/heady-manager-kernel.js` (cslGate/phiBackoff) → `packages/kernel` (closest to target).
  - `BE-01` `heady-manager.js` → `core/modules` (**decompose + archive**; `git filter-repo` history).
  - `BE-11` `orchestration` → **CF Workflows+Queues+DO** (no Temporal — ADR-0004).
  - `BZ-02` `heady-latent-os` → `packages/orchestration`, engines (the canonical φ-runtime; concept C3 HCFullPipeline 21-stage).
  - `BZ-04` `heady-latent-os-runtime-bundle` → `packages/kernel`, observability. `BE-10` `circuit-breaker` → `packages/resilience` (genuine φ-backoff). `BE-22` `services/heady-bus` → the ~4 conformant Latent-pattern service pkgs.
  - `BE-03` boot-barrel, `BE-06` `core`/`src`, `BE-16` `middleware`, `BE-17` `adapters`, `BZ-08` `heady-platform-fixes` (all rewrite).
- **Target:** `core/modules`, `packages/kernel`.
- **Transfer order/deps:** P3, depends on G01, G02, G03, G04.
- **⚠ Decisions:** maps to patent concepts C3 (HCFullPipeline), C6 (deterministic replay + SHA-256 drift), C11 (Socratic loop + ORS). The `heady-manager` monolith→kernel migration is the biggest effort. `BE-23` `services/` sprawl (~290 dupes) is the dropped counterpart.

### G06 — Auth / Security / Middleware / Compliance
- **5 components · primary disposition: rewrite (adapt) · Confidence: HIGH.**
- **What it contains:** a mature, mostly fail-closed security set.
- **Key components:**
  - `BE-12` `auth/` (Firebase identity + cross-domain SSO, 27 providers) → Firebase Auth + SSO pkg.
  - `BE-13` `auth-service/` (HS256 JWT IdP, headykey.com) → **fold RBAC/API-keys into Firebase** (custom JWT conflicts with Firebase lock).
  - `BE-15` `security-middleware/` → Hono/Express middleware pkg (🔴 **R-7 fail-closed CORS/rate-limit on port** — localhost CORS + `skipOnError=true` must be fixed).
  - `IN-17` `security/` (18 fail-closed modules) → `packages/security-mesh` (transfer-as-is; SEC-002 satisfied here).
  - `IN-18` `credential-rotation` + `compliance-templates` → GCP SM rotation + `packages/compliance`.
- **Target:** `packages/security-mesh`, `auth`.
- **Transfer order/deps:** P1, depends on G01.
- **⚠ Security:** `security-bee` must clear fail-open paths (R-2/R-7) on port. The dropped `BE-14` `auth-session-server/` is **R-2 CRITICAL fail-open** (mints/accepts any cookie as `dev-user`) — never transfer. Maps to patent concept C9 (security-mesh, PQC posture) and HCP-0001 (HeadyKey rotation executor — see patent callout).

### G07 — Cloudflare Edge / Workers Fleet
- **3 components · primary disposition: transfer-as-is (integrate) · Confidence: HIGH.**
- **What it contains:** real edge logic matching the CF edge lock.
- **Key components:**
  - `IN-13` `cloudflare` + `cloudflare-workers` (router, edge-node, mcp-telemetry, ai-gateway) → CF Workers/Pages/DO (**drop nested `cloudflare/cloudflare` dup**).
  - `IN-14` `workers` (liquid-gateway, edge-auth, buddy, mcp, secret-service) → CF Workers+Queues+DO (**drop `workers/workers` nested dup**).
  - `IN-15` `edge`, `boot`, `bin` → edge libs (rework creds to keyless OIDC).
- **Target:** CF Workers/Pages/DO/Workflows.
- **Transfer order/deps:** P3, depends on G04 + G06.
- **⚠ Security:** `workers/liquid-gateway-worker/src/{index,auth-page}.ts` and the `workers/workers/` dup were flagged LIKELY-REAL-LEAK by the content scanner. Working-tree grep is now clean (0 matches) → **scrubbed from tree, but the credential is live in git history (commit f26a490)** until rotated. The 2nd live AIza key originally lived here (SEC-001 expansion) — **rotate + history-purge before transfer.** Drop the nested dup regardless.

### G08 — Infra / CI-CD / Observability / Governance
- **12 components · primary disposition: mixed transfer-as-is + rewrite · Confidence: HIGH.**
- **What it contains:** cross-cutting gates. GHA+pnpm+OIDC CI matches the lock; Sentry+Langfuse+pino are net-new.
- **Key components:**
  - `IN-01` `.github/workflows/ci.yml` → GHA+Turborepo (**transfer-as-is**).
  - `IN-05` governance config (`Makefile`, `CODEOWNERS`, `renovate.json`, `commitlint`, `branch-protection`, `gitleaks.yml`) → locked governance. **⚠ `gitleaks.yml` is absent in legacy** (1 of 6 paths missing) — recreate in rebuild; the other 5 paths are present.
  - `IN-02` `deploy-cloud-run.yml` → GHA φ-canary (🔴 **INFRA-001 / R-6 rollback fix** — selects wrong revision).
  - `IN-16` `monitoring`/`observability`/`otel-wrappers` → OTel+Sentry+Langfuse+pino (swap logger→pino, add net-new tooling).
  - `IN-07` collapse 14 docker-compose → ONE dev compose. `IN-08` keep distroless+production Dockerfiles (drop service/universal/monorepo). `IN-09` `infra` → Terraform (GCP+CF). `IN-11` `nats` → locked NATS bus. `IN-06` `ci-pipelines`/`policy` → CI gate + OPA/Rego. `IN-03` `cloudbuild.yaml` → salvage canary-config (GHA is chosen CI). `IN-12` `scale` → cloud-run-optimizer. `DX-11` rescue scripts (`ban-localhost.sh`, `backup-pgvector.js`).
- **Target:** `tooling/ci`, `packages/observability`, infra (Terraform).
- **Transfer order/deps:** P0, no deps — gating layer.

### G09 — Frontend / MCP Console / Buddy
- **7 components · primary disposition: rewrite (adapt) · Confidence: HIGH.**
- **What it contains:** React→Vanilla-WC adapt. `headyme-portal` is the locked spearhead (unblocks Google for Startups).
- **Key components:**
  - `FE-01` `frontend/` (admin/IDE SPA) → `headyme-portal` (🔴 **R-9 merge-conflict in `package.json`** — resolve before port).
  - `FE-02` `public/mcp-dashboard.html` + `apps/heady-mcp-portal` + `admin-ui` → `headyme-portal` (the MCP-console seeds).
  - `FE-03` `ui/` → console widgets (SSE). `FE-09` `websites` → CF Pages + WC. `FE-13` `css`/`designs` → WC design system. `FE-15` `web` → build tooling.
  - `AG-14` `headybuddy` → Buddy app (🔴 R-9 merge-conflict).
- **Target:** `headyme-portal`, `apps/*`.
- **Transfer order/deps:** P3, depends on G04 + G06.

### G10 — Content / Cognition / Assets / Personas
- **6 components · primary disposition: transfer-as-is + rewrite · Confidence: HIGH.**
- **What it contains:** framework-agnostic, directly reusable IP. `heady-cognition` is the canonical design-IP superset.
- **Key components:**
  - `FE-11` `content/` → content store (**transfer-as-is**). `FE-12` `assets/` → asset store (LFS pull, **transfer-as-is**).
  - `AG-07` `heady-cognition` + `heady-cognitive-config.json` → `docs/compendium/02` + CSL config (**transfer-as-is** — single source of design-IP truth).
  - `AG-08` `archetypes` → persona/archetype prompts (rewrite; drop byte-identical dupes `animal-archetypes`/`13-animal-archetypes`). `AG-09` `personas`, `AG-10` `directives`/`prompts` → harness persona library + AGENTS.md/system rules.
- **Target:** content store, `docs/compendium`, asset store.
- **Transfer order/deps:** P1, no deps. Maps to patent concept C2 (Sacred Geometry / φ-math, trade secret).

### G11 — Golden Record / Foundations / Skills / Tooling
- **6 components · primary disposition: transfer-as-is + rewrite · Confidence: HIGH.**
- **What it contains:** `facts.yaml` is the top-priority survivor (already incorporated into rebuild). 67 unique concept skills triaged individually.
- **Key components:**
  - `DX-01` `facts.yaml` → `Heady-AI/facts.yaml` (**transfer-as-is** — top priority; now present in rebuild, `patents_provisional: 51`).
  - `DX-02` `01-foundations`/`02-implementation-references` → `docs/compendium`. `DX-03` `skills`/`heady-skills` → `.agents/skills` (**67 unique, triage** — concept-stage, build-readiness unvalidated).
  - `DX-12` `tools`/`tooling` (facts validator) → consistency engine. `AG-17` `heady-bee-swarm-ops`/`heady-a2a-protocol`/`heady-cognitive-runtime` → designs feed impl (A2A→NATS, CSL ternary = 3-layer gate).
  - `DX-09` legacy boot docs (`BUDDY_KERNEL.md` etc.) → **defer**; harvest φ/Fib params into facts.yaml/compendium (BUDDY_KERNEL carries the 9-stage battle-sim + φ resource table).
- **Target:** `facts.yaml` (root), `docs/compendium`, `.agents/skills`, `tooling`.
- **Transfer order/deps:** P0, no deps.

### G12 — 🔒 Patent Implementations (ARBITER-GATED)
- **1 component · primary disposition: patent-gated (defer) · Confidence: HIGH.**
- **What it contains:** the **only full-source copy** of 8 provisionals (HS-2026-051..062, 59 claims, 806 tests). R-8.
- **Key components:**
  - `BZ-01` `heady-patent-implementations` → `packages/*` (**patent-gated** — requires ARBITER `ALLOW` + signed HCP; bundled **separately** with a `_PATENT-LOCKED_` prefix and guard banner; **never bulk-merged**).
- **Target:** `packages/*` under ARBITER patent-lock review.
- **Transfer order/deps:** deferred phase, depends on G01.
- **⚠ Patent-gate:** see callout (c). This is the do-not-transfer-without-clearance zone.

### G13 — Deferred — Post-Launch / Evidence-Gated
- **25 components · primary disposition: defer · Confidence: HIGH.**
- **What it contains:** real but post-launch components, bundled for provenance, marked deferred with trigger conditions.
- **Notable components (→ defer each unless noted):**
  - `AG-15` `headybuddy-mobile` (Kotlin/Compose) → mobile phase. `FE-04` `HeadyAI-IDE` (R-9 conflict) → Phase 4+ IDE. `FE-07` desktop shells, `BZ-15` `heady-desktop-suite` → desktop phase. `FE-16` `extensions` → companion extensions.
  - `BE-18` `oracle_service` (R-9 conflict), `BE-19` `heady-native-services` (conflicts w/ AI Gateway), `BE-21` `heady-voice-relay` → Phase 4+. `MC-19` `midi_bridge` → optional edge worker (patent concept C10). `IN-19` `heady-pqc-security` → forward-looking crypto (patent concept C9).
  - `MC-12`/`MC-13` python/notebooks → docs/notebooks. `MC-18` `HeadyAcademy`/`training`, `MC-11` `colab-integration` (fold runtime-bridge.py → colab-gateway, JS dead). `BZ-10` `heady-enterprise` (only real vertical), `BZ-13` GTM/research assets, `BZ-16` vertical skill manifests → `.claude/skills`.
  - `DA-13` `heady-drift-detection` (→ Merkle re-index, integrate) / `heady-vector-projection` (defer). `BZ-12` `heady-improvement`/`heady-system-fix` (inspect for unique tests/crypto before drop). `DX-05` dropzone skills, `DX-07` arch diagrams, `DX-16` remediation-tracker, `AG-11`/`DX-10` stage-prompts → archive/triage.
- **Target:** mobile / desktop / enterprise / niche phases.
- **Transfer order/deps:** P4, various deps.

### G99 — Dropped — Provenance Manifest Only (NOT BUNDLED)
- **41 components · primary disposition: drop · Confidence: HIGH.** Recorded for audit completeness; **no code transferred.**
- **What it contains:** dead, duplicate, superseded, or locked-decision-violating components.
- **Notable drops (with reason):**
  - `BE-14` `auth-session-server` (**R-2 CRITICAL fail-open**). `DA-02` `db`/`postgres` (**R-4 1536-dim violates 384 lock**). `MC-14` `perplexity-build` (**R-1 leaks live key**; hollow stubs). `DA-15` registry-context7-patch (**R-10 localhost:3371**).
  - `BE-23` `services` (~290 dupes/dead). `BZ-17` meta-snapshots (`heady-complete`/`heady-monorepo`/`HeadySystems_v13`/etc. — superseded by Heady-AI itself). `FE-05` Vue fragments, `FE-06` module-federation shell, `FE-10` static-site dupes, `FE-17` drupal-triad (salvage 13 content-type schemas).
  - `IN-04` off-platform CI (Azure/Render/PM2), `IN-10` `infrastructure` (273M dup), `DX-13` config-sprawl (api-keys.json secret risk), `DX-14` env-files (R-14 secrets — rotate, never port). `MC-02` unified-mcp dup, `MC-05` render-mcp, `MC-07` mcp-enhancement (unwired), `DA-09`/`DA-10`/`DA-12` broken/junk memory+data.
- **Target:** `_archive/provenance` (tarball ref only).
- **⚠ Note:** the dropped set is the **fail-closed counterpart** to the keep set — several drops exist *because* of a security finding (R-1/R-2/R-4/R-10/R-14).

---

## (c) Patent-gated / do-not-transfer callout

**Patent-gated groups:** G01 (via BZ-05) and G12 (`patent_lock: true`). **No bulk transfer of patent-zone
source without an ARBITER `ALLOW` verdict + a signed HCP** (`AGENTS.md` §Patent Lock Zones, IDs
**HS-2026-051 through HS-2026-062**).

| Item | Where | Disposition | Rule |
|---|---|---|---|
| `BZ-01` `heady-patent-implementations` | G12 | **patent-gated / defer** | R-8: only full-source copy of 8 provisionals (59 claims, 806 tests). Bundled **separately** as `_PATENT-LOCKED_G12-patent-ip.zip` with a guard banner. ARBITER `ALLOW` + HCP required; never bulk-merged or bulk-deleted. |
| `BZ-05` `heady-vsa-integration` | G01 | **patent-gated / rewrite** | Overlaps patent **HS-058** (CSL concept cluster C1). Coordinate the VSA→CSL bridge port through ARBITER before touching `packages/csl-engine`. |
| **HeadyKey rotation executor** | HCP-0001 | **executor mechanics — do-not-transfer without clearance** | `docs/hcp/HCP-0001-headykey-rotation-executor.md`: the HeadyKey secret-rotation **executor** sits in patent zone HS-2026-051+. ARBITER returned an **element-3 BLOCK**; HCP-0001 is **draft, needs 2 approvals + a pinned claim id** (`docs/hcp/README.md`). The executor's auto-rotation mechanic under a dedicated SA (`secretVersionAdder`, D4) is the patented behavior — **do not stand up the executor as part of the G06 auth port** until HCP-0001 clears. Tracked as the canonical HCP precedent in `docs/LAW_TRANSFER_AUDIT.md`. |
| Concept clusters C1–C12 | various | mixed | `docs/LEGACY_PATENT_TRADESECRET_MIGRATION_PLAN.md`: the 12 inventive clusters (CSL, φ-math, HCFullPipeline, swarm matrix, φ-decay memory, deterministic replay, Arena/Council, Auto-Success, PQC, protocol matrix, Socratic/ORS, continuous-learning) each map to a rebuild package. `⚠️`-marked targets (`csl-engine`, `bees`, `memory-stream`, `security-mesh`) are patent zones — port concept-first into a **stronger** rebuild embodiment (ADR-0015 single-embedding lock; Ed25519 receipts) and let the conversion narrative pivot to the rebuild. |

> **Patent gate placement (G2 in the Extraction Engine):** ARBITER runs **before** modifying any
> patent-zone file — you must not touch a patent file before clearance. `CODEOWNERS` marks HS-2026-051+
> zones stage0-untouchable.

---

## (d) Security callouts — live keys must be scrubbed/rotated before any transfer

The decomposition bundler is **fail-closed** on credentials: `global_excludes` + `blocked_secret_paths`
strip secret-ish files; a two-stage audit (filename regex + content regex incl. `AIza…`, `sk-…`, PEM,
`ghp_…`, `AKIA…`, `xox…`) **destroys any bundle** that still contains a live-credential pattern. The
last run blocked **0 bundles** (clean) but quarantined **11 files** (7 likely-real leaks) — excluded from
bundles and fed to SEC-001. Status per primary finding:

| Finding | Location | Tree state (re-grepped now) | Action before transfer |
|---|---|---|---|
| **R-1** — live Google/Firebase `AIza…` key | `perplexity-build/.env.template` | **STILL present in working tree** (1 match) | Contained: `blocked_secret_paths` + global excludes → never bundled; the whole component (`MC-14`) is **drop**. But the credential is **live** → **rotate now**, then scrub. |
| **2nd live `AIza…` key** (worker source, SEC-001 expansion) | `workers/liquid-gateway-worker/src/{index,auth-page}.ts` + `workers/workers/` dup | **grep-clean now (0 matches)** | Scrubbed from tree, but **live in git history** (legacy commit f26a490). **Rotate + `git filter-repo` history-purge** before the G07 edge port. Drop the `workers/workers` nested dup. |
| **colab Neon `npg_…` DB password** | `colab/` node scripts | **grep-clean now** | Scrubbed before commit f26a490 (per containment log), but **live in history** → **rotate the Neon credential** + history-purge. |
| In-tree credential patterns | `shared/auth/relay.html` (1), `shared/secret-manager.js` (2), `src/auth/email-client.js` (1) | **STILL present in working tree** | Likely-real leaks flagged by the content scanner — review each (some may be format strings); excluded from bundles. Scrub/rotate before the G01/G05 ports that touch `shared/`+`src/`. |
| Test fixtures (4) | `heady-mcp-security/tests`, `heady-guard/__tests__`, `heady-patent-implementations/tests`, `heady-native-services/__tests__` | matched | Classed **test-fixture** (low risk) — verify they are synthetic, not real keys, then they may transfer with the component. |
| `R-14` populated env files | `env`, `env.local`, `env.production`, `configs/api-keys.json` | blocked | `DX-13`/`DX-14` = **drop**; in `blocked_secret_paths`. **Rotate, never port.** |

> **Bottom line:** no live credential may enter the rebuild tree or its history. R-1 and three `shared/`+
> `src/` files are **still in the legacy working tree** → rotate + scrub. The colab Neon key and the 2nd
> worker AIza key are **scrubbed from the tree but live in legacy history** → rotate + history-purge. The
> bundler enforces this fail-closed, but rotation is a manual action-now item (SEC-001).

---

## Coverage audit (manifest ↔ legacy ground-truth)

**Manifest → legacy (all keep-group key paths verified present).** Two path-level exceptions, neither a
real "component no longer exists":

1. **`MC-03` (G04) — stale manifest paths, not missing components.** The 4 domain MCP servers are listed
   as `mcp-servers/{governance,intelligence,memory,orchestration}-mcp-server.js` but exist in legacy as
   `heady-governance-mcp-server.js` etc. (the `heady-` prefix is dropped in the manifest). **Fix the
   manifest paths.**
2. **`IN-05` (G08) — `gitleaks.yml` genuinely absent** (1 of 6 governance paths). The other 5 are present;
   recreate `gitleaks.yml` fresh in the rebuild.
3. G99's 6 "missing" paths (`heady-connection`, `heady-systems`, `DEEP_SCAN`, `STATUS-DASHBOARD`,
   `SYNC_STATUS`, `ECOSYSTEM-AUDIT`) are already **drop**-marked → harmless (the dirs exist under slightly
   different names like `heady-hf-space-connection`).

**Legacy → manifest (reverse coverage).** Manifest path-segments cover the load-bearing top-level dirs.
The reverse-scan surfaced top-level entries **not** matched by any manifest path; almost all fall into
already-dropped categories (status-report `.md` sprawl, 14 docker-compose files, `.bat`/`.ps1` scripts,
build-meta, `node_modules`-adjacent junk) — consistent with the greenfield drop rule. **Genuine
uncaptured items worth a note** (carry real source but no manifest row):

- `remotes/` (21 code files), `source-reference/` (11), `templates/` (11), `code-archaeology/` (8),
  `heady_audit_full_pack/` (7), `utils/` (5), `_downloads/` (55 — likely vendored) — **recommend an
  explicit drop/defer row each** so the manifest reaches true 100% top-level coverage.
- SKILL-stub dirs (`heady-cloud-orchestrator`, `heady-resilience-cache`, `heady-sandbox-execution`,
  `heady-middleware-armor`, `heady-incident-ops`, `heady-connector-vault`, `heady-buddy-device`,
  `heady-midi-creative`) are **covered conceptually** by `BE-20` (drop), `MC-20` (`proto`), `BZ-16`, etc.,
  but the manifest points at *other* paths (`heady-manager`, `proto`) so the dirs themselves are
  path-orphans. Low risk (doc stubs), but add a `BE-20`-style catch-all path to close the gap.

---

## 6-line summary

1. **# groups:** 14 (G01–G13 + G99); 13 transfer-eligible & bundled, G99 provenance-only.
2. **# components:** 150 (full disposition coverage) — 109 transfer-eligible, 25 deferred (G13), 41 dropped (G99); ~21 MB bundled after excluding 2.2 GB junk.
3. **# patent-gated:** 2 groups (G01 via BZ-05/HS-058; G12 `heady-patent-implementations`/R-8) + the HeadyKey HCP-0001 executor (ARBITER element-3 BLOCK, draft) = the do-not-transfer-without-clearance set.
4. **# security flags:** R-1 + 3 `shared/`/`src/` files **still in tree** (rotate+scrub); 2nd worker AIza + colab Neon key **live in history** (rotate+purge); R-14 env files dropped; 11 quarantined (7 likely-real). Bundler fail-closed; 0 bundles blocked last run.
5. **Open decisions:** R-5 live-Neon verify (gates DA-01 clean port vs ADR-0007 migrate); R-3 AI-Gateway reroute scope; R-6/INFRA-001 canary rollback fix; R-9 4 merge-conflict manifests; HCP-0001 needs 2 approvals + pinned claim id; fix MC-03 manifest paths + add `gitleaks.yml`.
6. **Coverage:** manifest→legacy verified (MC-03 = stale paths not missing; `gitleaks.yml` genuinely absent); reverse scan found ~7 source-bearing top-level dirs (`remotes`, `source-reference`, `templates`, `code-archaeology`, etc.) uncaptured by any manifest row — recommend explicit drop/defer rows to reach true 100% top-level coverage.

---
*© 2026 HeadySystems Inc. — Eric Haywood, Founder*
