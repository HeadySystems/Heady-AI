# Domain 06 — Service Providers, Services & Functionality

> Heady™ Master Incorporation Plan · Domain 06. Every external provider, the specific service each
> supplies, which Heady consumer uses it, current-vs-potential usage, and the 9 brand domains.
> **Ground truth (in priority order):** `facts.yaml` (locked stack) · `packages/secrets/src/registry.mjs`
> + `.env.example` (every credential) · `docs/adr/*` + `docs/ADR/*` (decisions) · `docs/HEADYME_LAUNCH_RUNBOOK.md`
> + `docs/PORTAL_GATEWAY_DEPLOY.md` (live deploy state) · skills = claims verified against the above.
> © 2026 HeadySystems Inc. — Eric Haywood, Founder.

**Status legend:** `live` = serving/credential-verified in this environment · `configured` = code wired +
credential slot exists, not yet serving · `potential` = named in plan/skills, no wired integration · `🔮`
marks a future/potential capability · `⚠` marks drift vs the locked stack.

**Canonical-source note.** The locked rebuild lives in `packages/` + `apps/` + `tooling/`. A large
`src/` tree (`src/services/`, `src/bees/`, `src/provider-connector.js`, …) also exists in this repo but is
**legacy-style code, not the locked architecture** — it is cited below only as evidence a provider was
historically integrated, never as canonical wiring.

---

## (a) Provider roll-up

| Provider | Service(s) used | Heady consumer(s) | Status | Locked-by |
|---|---|---|---|---|
| **Cloudflare** | Workers (edge), Workers AI (embeddings + edge infer), AI Gateway (egress chokepoint), Workflows + Queues (durable exec), KV (best-effort cache), Pages (site hosting) | `apps/heady-portal-gateway`, `apps/heady-edge-gatekeeper`, `tooling/embed-corpus` embedder, durable orchestration | **live** (Workers AI 384-dim verified; gateway worker built) | facts.yaml (edge_tier, egress_chokepoint, durable_execution, pages); ADR-0015, ADR-0018, ADR-0004 |
| **Cloudflare Vectorize** | Derived edge vector cache (Tier-5) | projector (ADR-0014/0017) → edge read cache | **configured / 🔮 partial** (permitted derived cache, projector-populated; not authority) | facts.yaml `derived_edge_cache`; ADR-0003 amendment |
| **Cloudflare R2** | Object store (assets, Drupal file assets) | site assets, deferred | **potential** | docs/adr/0034 (Drupal assets → R2) |
| **Cloudflare D1 / Durable Objects** | DO-per-session edge state; D1 not in baseline | edge session state (Phase 2+) | **🔮 potential** (DO Phase 2+, ADR-0004 #4; D1 unused) | ADR-0004 |
| **GCP Cloud Run** | Origin runtime (Node-22 modular monolith); owns SoR writes | `heady-codeflow-api` (live: `heady-codeflow-api-…us-east1.run.app`) | **live** (built image; pending one IAM grant + redeploy) | facts.yaml `deploy_targets.origin`; ADR-0004; ⚠ region (see drift) |
| **GCP Secret Manager** | Secret store + rotation backend for `@heady/secrets` | `packages/secrets` loader/CLI; all runtime creds | **live** (13 secrets in vault per memory) | facts.yaml `secrets: gcp-secret-manager` |
| **Firebase Auth** | Identity (RS256 ID tokens, JWKS) | `apps/headyme-portal` sign-in, `heady-portal-gateway` token verify, `packages/codeflow/src/auth.mjs` | **live** (`heady-ai.web.app`) | facts.yaml `auth: firebase-auth`; ADR-0013 |
| **Firebase Hosting** | Static site hosting | `apps/headyme-portal` → `heady-ai.web.app` | **live** | runbook Bucket 1; PORTAL_GATEWAY_DEPLOY |
| **Neon Postgres** | System of record (serverless Postgres) | all SoR writes via Cloud Run origin | **live** (TLS-verified connection; project `cool-wind-37254039`) | facts.yaml `system_of_record`; ADR-0003 |
| **Neon pgvector** | Single retrieval authority (HNSW + GIN tsvector, RRF k=60) | memory/vector endpoints, embedding pipeline | **live / configured** | facts.yaml `retrieval_authority`; ADR-0003, ADR-0015 |
| **Upstash Redis** | Best-effort hot cache (REST), TTL ≤60s, never authoritative | retrieval hot-read cache | **configured** (provisioned `finer-sole-64861…`) | facts.yaml `cache: upstash-redis`; ADR-0003 #4 |
| **Anthropic (Claude)** | Frontier reasoning LLM (`class=reason`) | model mesh via AI Gateway | **configured** (3 keys: rotation/load-spread) | ADR-0018 |
| **OpenAI** | Deep-agentic / o-series; `text-embedding-3-large` (1536-dim full-CSL) | model mesh; depth-embed path | **configured** | ADR-0018, ADR-0015 |
| **Groq** | Speed tier LLM (`class=cheap`/fast) | model mesh | **configured** | ADR-0018 |
| **Google Gemini** | Long-context multimodal (`class=longctx`) | model mesh | **configured** | ADR-0018 |
| **Perplexity (Sonar)** | Web-grounded research / citations | research skills (`heady-perplexity*`) | **configured** | (skill-tier; not in facts.yaml stack) |
| **HuggingFace** | Off-platform embed **fallback** (`BAAI/bge-small-en-v1.5`); model hub | embed fallback — **OFF by default** (`--allow-hf`) | **configured (gated off)** ⚠ | ADR-0015 watchlist; `HEADY_ALLOW_HF_EMBED=0` |
| **OpenRouter** | Provider-routing relay in front of AI Gateway | model mesh path (Liquid → OpenRouter → CF AI Gateway) | **🔮 potential** (named in ADR-0018; no wired client / no key in registry) | ADR-0018 #1 |
| **Stripe** | Billing (checkout, webhooks, Fibonacci tiers) | monetization (roadmap) | **configured** (`sk_`/`pk_` slots) | secrets registry; ADR roadmap |
| **Sentry** | Error monitoring + Seer; observability sink | runtime error capture, release tracking | **configured** (DSN + org/project + tokens) | secrets registry |
| **Grafana Cloud** | OTel metrics/traces sink | observability pipeline | **🔮 potential** (compendium I3; no wiring/key) | compendium 09 |
| **NATS** | Inter-agent typed pub/sub (best-effort, in-flight) | swarm stigmergy (`heady-event-bus`) | **🔮 potential** (ADR-0020; design-only, no key) | facts.yaml `event_bus: nats`; ADR-0020 |
| **QStash (Upstash)** | Durable HTTP task backup queue | colab task backup, outbox backup | **🔮 potential** (compendium I3/I4; no wiring) | compendium 09 |
| **Google Colab Pro+** | GPU **fallback tail** (heavy infer, batch embed backfill) | inference chain tail (Workers AI → AI Gateway → Cloud Run → **Colab**) | **🔮 potential** (skill + ADR-0018 chain; Tailscale mesh) | ADR-0018 fallback_chain; `heady-colab-runtime` |
| **Tailscale** | Userspace mesh for Colab GPU runtimes (SOCKS5, MagicDNS) | Colab cluster connectivity | **🔮 potential** | compendium I4 |
| **GitHub** | Repo ops (clone/push/PR), Actions CI | git-ops, CI/CD | **live** (PAT in registry) | ADR-0001 (3 orgs → 1) |
| **1Password** | Secrets bootstrap (service-account) | `@heady/secrets` bootstrap path | **configured** (`OP_SERVICE_ACCOUNT_TOKEN`) | secrets registry |
| **Google API (non-Gemini)** | Maps/etc. (distinct from `GEMINI_API_KEY`) | misc Google services | **🔮 potential** (`GOOGLE_API_KEY` slot, no consumer) | secrets registry |
| **Pinecone** | (vector DB) | — | **⚠ VESTIGIAL** (registry-marked; pgvector is authority) | secrets registry note |
| **Qdrant** | (vector DB) | — | **⚠ DROPPED** | facts.yaml `stores.dropped`; ADR-0003 #3 |
| **Vercel · Linear · monday.com · Slack · Gmail · Google Drive** | dev/ops tooling (deploy, PM, chat, mail, files) | **operator MCP/connected apps — NOT product stack** | n/a (ops tooling) | not in facts.yaml or secrets registry |

> **Tooling vs product stack:** Vercel, Linear, monday.com, Slack, Gmail, and Google Drive are connected
> MCP apps used by the operator/agents — they hold **no credential in `packages/secrets/src/registry.mjs`**
> and do not appear in `facts.yaml`. They are operational tooling, not part of Heady's runtime architecture.

---

## (b) The 9 Heady domains

Spine = the 9 domains named in this domain's scope. **⚠ Three divergent domain registries exist** — see
the drift section. Current serving is grounded in the runbook: the only live origin is the Firebase
subdomain `heady-ai.web.app`; every custom domain is DNS-blocked (founder-only external step). The
Cloudflare edge router (`configs/cloudflare-workers/heady-router-worker.js`) is configured to serve 9 of
these by hostname.

| Domain | Role | Current serving | Status |
|---|---|---|---|
| **headyme.com** | Core platform — OS hub, onboarding, persistent 3D vector memory, HeadyBuddy, admin UI (the Phase-3 launch spearhead) | edge route configured; portal built, serves at `heady-ai.web.app`; custom domain DNS-blocked | **configured / partial-live** |
| **headysystems.com** | C-Corp home; **the service registry host** — every logical endpoint is `*.headysystems.com` (auth, api/v1, memory, vector, infer, conductor, soul, brain, mcp, health, admin, events-wss, distiller) | edge route configured; endpoints = logical routes on the monolith (R4/R5), not N deployments | **configured** |
| **headyconnection.org** | 501(c)(3) nonprofit portal (HeadyConnection Inc.) — IRS boundary: **no commercial/paywall endpoints** | edge route configured | **configured / potential** |
| **headybuddy.org** | Companion AI surface (HeadyBuddy) | edge route configured | **potential** ⚠ (.org here vs `.com` in ADR-0033) |
| **headymcp.com** | MCP gateway hub (`headymcp.com/mcp/v1` → edge worker → `heady-mcp-server` on Cloud Run) | edge route configured; endpoint architecture defined | **configured / potential** |
| **headyio.com** | API / integration surface | edge route configured | **potential** |
| **headybot.com** | Bots surface | edge route configured | **potential** |
| **headyapi.com** | API gateway surface | edge route configured | **potential** |
| **heady-ai.com** | Core AI surface (note: also the **Firebase project name** `heady-ai` / `heady-ai.web.app` — domain ≠ project) | **not** in the edge router list (router serves `headylens.com` instead) | **potential** ⚠ |

> The edge router (`heady-router-worker.js`) serves: headyme, headysystems, headyconnection.org,
> headybuddy.org, headymcp, headyio, headybot, headyapi, **headylens.com** — i.e. the 9 above **minus
> heady-ai.com, plus headylens.com**. This is a registry mismatch (drift D2).

---

## (c) Load-bearing service detail (full template)

### Neon pgvector — Retrieval Authority
- **Category** Data plane / vector retrieval · **Status** live/configured · **Confidence** high (facts.yaml + ADR-0003)
- **What** Single retrieval authority: vectors live in Neon Postgres beside the SoR. HNSW (`m=16`, `ef_construction=200`) + GIN `tsvector` (+ optional `pg_trgm`), fused via Reciprocal Rank Fusion (k=60) in one SQL CTE; optional reranker (Cohere Rerank v3.5 / bge-reranker-v2-m3 / LFM2-ColBERT-350M) to recover 384-dim recall. Every row records `embedding_model_version`.
- **Legacy** Antigravity plan proposed a 3-tier stack (Redis + pgvector + Qdrant) + Vectorize — collapsed to pgvector-only.
- **Rebuild** `packages/embedding/` (schema, acquire-tiers `pgvectorTier`, workflow); writes routed through Cloud Run origin (owns SoR connection).
- **Parts** Neon serverless Postgres + `vector(384)` column + HNSW/GIN indexes + RRF CTE.
- **OSS-alternative** *current:* self-hosted Postgres + pgvector. *potential:* pgvecto.rs / Lantern for faster ANN.
- **Transfer** Run migrations against real Neon; confirm `vector(384)` per ADR-0015 (runbook step 4).
- **Incorporation** Provision Neon (us-east1, co-located with Cloud Run) → enable pgvector → migrate schema → backfill embeddings via `tooling/embed-corpus`.
- **⚠ Drift/decisions/ADR** Qdrant **dropped** (ADR-0003 #3); Pinecone **vestigial**; Vectorize permitted only as derived edge cache, never authority. Dimension/pooling immutable after first ingest (ADR-0015).

### Cloudflare Workers AI — Locked Embedder
- **Category** Edge inference / embeddings · **Status** live · **Confidence** high (384-dim vector returned in runbook verification)
- **What** Locked embedding model `@cf/baai/bge-small-en-v1.5`, **384-dim, `mean` pooling**, MIT, edge-resident (same trust boundary as Vectorize). Also the `edge_tier` for fast/cheap/private inference (LFM2 classifiers, etc., per ADR-0018).
- **Legacy** Various ad-hoc embedders; unpinned model = latent corruption risk.
- **Rebuild** `tooling/embed-corpus/src/embedder.mjs` (`resolveEmbedder`) — supports **both** a scoped token (Bearer) and a legacy Global API Key (X-Auth-Email + X-Auth-Key); `packages/embedding` `WorkersAIEmbedder`.
- **Parts** CF account `8b1fa38f…d53323` ("Heady"), Workers AI binding (`HEADY_AI`), `CLOUDFLARE_API_TOKEN` (+ `CLOUDFLARE_EMAIL` for Global-Key auth).
- **OSS-alternative** *current:* `BAAI/bge-small-en-v1.5` on HuggingFace (off-platform fallback, gated off). *potential:* EmbeddingGemma-300M (Matryoshka-truncatable to 384) — the named successor.
- **Transfer** Credential resolved live; embedder verified 384-dim end-to-end (`workers-ai:global-key`).
- **Incorporation** Mint a scoped `Workers AI:Read` token → set `CLOUDFLARE_API_TOKEN` → drop `CLOUDFLARE_EMAIL` (least-privilege; runbook security follow-up). Migrate model only via dual-write `heady-v2` + frozen-Ragas shadow-eval (ADR-0015 recipe).
- **⚠ Drift/decisions/ADR** Pooling+dim **immutable**; mismatch fails closed. 1536-dim `text-embedding-3-large` is the *full-CSL* depth embedder, not a swap. HF fallback transmits corpus off-platform → **OFF by default**. ⚠ Current credential is a **Global API Key** (full-account blast radius) — least-privilege follow-up open.

### Cloudflare AI Gateway — Egress Chokepoint
- **Category** Model-mesh control plane · **Status** configured · **Confidence** high (ADR-0018 Accepted)
- **What** Single egress chokepoint for **all** provider traffic (Liquid → OpenRouter → CF AI Gateway): edge logging, SHA-256 exact-match caching, per-tenant/per-model budgets, mid-stream failover, DLP, `phi_circuit_breaker`. Model identity is a **route** (`class=reason|longctx|cheap|embed`), not a vendor.
- **Legacy** Scattered direct provider calls; vendor model names coupled into business code.
- **Rebuild** `cloudflare/worker-ai-gateway/`; route classes resolved at the gateway; agent harness (ADR-0016, Vercel AI SDK v6) consumes it.
- **Parts** CF AI Gateway + per-provider keys (Anthropic ×3, OpenAI, Groq, Gemini, Perplexity) injected at the gateway, never in business code.
- **OSS-alternative** *current:* LiteLLM proxy (priority/cooldowns) · Portkey (active-probe breaking). *potential:* self-hosted OpenRouter-style router.
- **Transfer** Point all model clients at the gateway; keep business logic naming only route classes.
- **Incorporation** Configure gateway → wire provider keys → set per-route budgets (ADR-0010/0012) → enable failover-to-direct on gateway outage (it is a critical path needing its own SLO).
- **⚠ Drift/decisions/ADR** Semantic caching **default-OFF, per-route opt-in** (poisoning risk); tool-call/personalized = exact-match only. OpenRouter named in the path but **not yet wired and no key in the registry** (D4).

### GCP Cloud Run — Origin
- **Category** Compute / origin · **Status** live · **Confidence** high (live service URL)
- **What** Origin runtime: Node-22 modular monolith, owns the SoR (Neon) write connection. "Push reads to the Worker, route writes to Cloud Run" — every Worker→Cloud Run hop is a $-and-ms tax.
- **Legacy** Cloud SQL + Cloud Run in legacy project `heady-prod-609590223909` (us-central1) — **incompatible, read-only migration access only**.
- **Rebuild** `heady-codeflow-api` (live `heady-codeflow-api-1003436179562.us-east1.run.app`), deployed `--no-allow-unauthenticated`; reached only via the edge `heady-portal-gateway` worker.
- **Parts** GCP project `heady-ai` (live) / `heady-rebuild` (ADR-0036 nominal); region **us-east1**; service `heady-origin`/`heady-codeflow-api`; minimal invoker SA `heady-gateway-invoker`.
- **OSS-alternative** *current:* containerized Node on Cloud Run. *potential:* Knative / Fly.io / self-hosted.
- **Transfer** Image built; pending one `roles/run.invoker` IAM grant + redeploy (memory) and org-policy/edge-worker front (no public unauthenticated surface).
- **Incorporation** Deploy authenticated → front with `heady-portal-gateway` (Firebase token → Google id_token at edge) so the org policy never relaxes → attach `headyme.com/api/*` Worker route.
- **⚠ Drift/decisions/ADR** **Region drift (D1):** ✅ resolved 2026-08-04 — `facts.yaml` corrected to **us-east1** per ADR-0036 (⭐⭐⭐⭐⭐), matching the live service; us-central1 remains legacy-only. **Project drift (D5):** ADR-0036 nominal `heady-rebuild` vs live `heady-ai` (still open).

### Firebase Auth + Hosting — Identity & Site Hosting
- **Category** Identity / hosting · **Status** live · **Confidence** high (`heady-ai.web.app` live)
- **What** Firebase Auth issues RS256 ID tokens verified via JWKS (no Admin SDK); session TTL φ⁷≈8h. Hosting serves the portal SPA. Founder owner credential uses constant-time compare (ADR-0013).
- **Legacy** Ad-hoc auth; cross-site session sharing.
- **Rebuild** `apps/headyme-portal/src/services/firebase.js` (client SDK), `packages/codeflow/src/auth.mjs` (RS256 verify), `apps/heady-portal-gateway` (edge token verify → Google id_token mint).
- **Parts** Firebase project `heady-ai` (`heady-ai.web.app`, appId `1:1003436179562:web:…`); `FIREBASE_API_KEY` (public by design); per-domain Auth tenants (ADR-0033).
- **OSS-alternative** *current:* Firebase Auth + httpOnly cookies. *potential:* Supabase Auth / Ory / Keycloak self-hosted.
- **Transfer** Auth built + locally verified (L2 satisfied); deploy blocked only on `firebase login` session + DNS.
- **Incorporation** `firebase login` → `firebase deploy --only hosting` → custom-domain DNS (TXT + A/AAAA/CNAME at registrar) → Worker route `headyme.com/api/*`.
- **⚠ Drift/decisions/ADR** **Project-ID drift (D3):** live = `heady-ai`; `heady-firebase-auth-orchestrator` skill asserts `gen-lang-client-0920560496` — skill is stale. ADR-0033 mandates 9 Auth tenants. R3: Ed25519 now, PQC Phase-4.

### GCP Secret Manager — Secret Store
- **Category** Security / secrets · **Status** live · **Confidence** high (facts.yaml + 13 secrets in vault per memory)
- **What** Backing store + rotation backend for `@heady/secrets`; fail-closed loader rejects on missing/malformed; rotation strategy declared per secret (internal/provider/manual/root) with FIB-derived `maxAgeDays`.
- **Legacy** Hardcoded keys in worker source + colab scripts (SEC-001 containment); moved to keyless WIF.
- **Rebuild** `packages/secrets/` (registry.mjs = single catalog of every secret; loader; `heady-secrets` CLI; GCP Secret Manager rotation via stdin).
- **Parts** GCP Secret Manager + `packages/secrets/src/registry.mjs` (29 secret/identifier entries) + `.env.example` mirror + `VAULT_PASSPHRASE` (encryption root) + optional 1Password bootstrap.
- **OSS-alternative** *current:* HashiCorp Vault / 1Password (bootstrap already supported). *potential:* SOPS + age, sealed-secrets.
- **Transfer** `heady-secrets push <NAME>` → Secret Manager; `heady-secrets verify` (fail-closed loader must pass) — runbook deploy steps 2–3.
- **Incorporation** Catalog every secret in `registry.mjs` → push to Secret Manager → load at boot via fail-closed loader → rotate per declared strategy.
- **⚠ Drift/decisions/ADR** Pinecone key **vestigial** (registry-flagged). Cloudflare credential is a Global API Key — least-privilege follow-up. Patent-zone executor mechanics (overlap-window/disable-cadence) are founder-gated (HS-2026-051+), **not** encoded in the registry.

---

## Drift flags vs the locked stack

- **D1 — Cloud Run region.** ✅ **Resolved 2026-08-04:** `facts.yaml deploy_targets.origin.region` corrected to `us-east1`, matching ADR-0036 (⭐⭐⭐⭐⭐) and the live service. (Was: facts.yaml stale at `us-central1`.)
- **D2 — Domain registry (3-way).** Task's 9 (incl. `heady-ai.com`, `headybuddy.org`) vs ADR-0033's 9 (incl. `headyai.com`, `headybuddy.com`, headyos/headytrade/headylab/headyweb; **omits headysystems.com**) vs compendium I7's 11 (adds headylens, headyfinance). The **edge router** serves the task's 9 minus heady-ai.com plus headylens.com.
- **D3 — Firebase project.** Live `heady-ai` vs skill-asserted `gen-lang-client-0920560496` (`heady-firebase-auth-orchestrator`). Skill stale.
- **D4 — OpenRouter.** Named as the chokepoint path in ADR-0018 but **no wired client and no credential** in the registry.
- **D5 — GCP project name.** ADR-0036 nominal `heady-rebuild` vs live `heady-ai`.
- **D6 — Two ADR directories.** ✅ **Resolved 2026-08-04:** the uppercase `docs/ADR/` set (0019=nine-domain, 0020=Drupal, 0021=PQC, 0022=region, 0023=decomposition, 0024=domain-registry, 0025=content-gateway) was renumbered into the canonical `docs/adr/` set as **0033–0039**; `docs/ADR/INDEX.md` is now a redirect stub. (Was: same numbers, different decisions.)
- **D7 — Dropped/vestigial stores.** Qdrant **dropped** (facts.yaml + ADR-0003); Pinecone **vestigial** (registry note) — both still leave traces (`PINECONE_API_KEY` slot; Drupal config references a dropped store at a loopback URL — runbook Bucket 2 #3).
- **D8 — HF off-platform embed.** `BAAI/bge-small-en-v1.5` HF fallback transmits corpus off-platform; **OFF by default** (`HEADY_ALLOW_HF_EMBED=0`, requires `--allow-hf`).

## Open decisions

1. **Reconcile the domain registry** (D2) — pick one canonical 9 (or 11); `headysystems.com` must be on it (it hosts the entire service registry) and the `.org`/`.com` + `heady-ai.com`/`headylens.com` splits resolved.
2. **Update `facts.yaml` region to us-east1** (D1) or formally exempt it.
3. **Merge the two ADR directories** (D6) — colliding numbers will corrupt any ADR-by-number reference.
4. **OpenRouter** (D4) — wire + register a key, or drop it from the ADR-0018 path.
5. **Cloudflare least-privilege** — replace the Global API Key with a scoped `Workers AI:Read` token.
6. **Remove vestigial `PINECONE_API_KEY`** and the Drupal dropped-store/loopback reference (D7).

---

### Summary

```
Vendor providers (distinct): 19  (Cloudflare, GCP/Firebase, Neon, Upstash, Anthropic, OpenAI, Google,
  Groq, Perplexity, HuggingFace, OpenRouter, Stripe, Sentry, Grafana, NATS, Colab, Tailscale, GitHub,
  1Password) — counting QStash under Upstash. + 6 ops-tooling apps (Vercel/Linear/monday/Slack/Gmail/
  Drive) outside the product stack.
Distinct services inventoried: ~40 service-rows (Cloudflare alone = Workers/Workers AI/AI Gateway/
  Vectorize/R2/D1/DO/KV/Pages/Workflows; Firebase = Auth+Hosting; Neon = SoR+pgvector; incl. 13 logical
  *.headysystems.com endpoints).
Potential / future (🔮): 9  (Vectorize-full, R2, D1/DO, OpenRouter, Grafana, NATS, QStash, Colab, Tailscale).
Drift flags: 8  (D1 region · D2 domain registry · D3 Firebase project · D4 OpenRouter · D5 GCP project ·
  D6 dual ADR dirs · D7 Qdrant-dropped/Pinecone-vestigial · D8 HF off-platform embed).
Open decisions: 6  (domain registry · facts.yaml region · ADR dir merge · OpenRouter · CF least-priv · vestigial cleanup).
Live now: Cloud Run origin, Neon (SoR+pgvector), Firebase Auth+Hosting (heady-ai.web.app), Workers AI
  embedder (384-dim verified), Secret Manager, GitHub — custom-domain launch DNS-blocked (founder-only).
```
