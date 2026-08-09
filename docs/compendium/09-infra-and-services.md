<!-- 
  ⚠️ GENERATED FILE — DO NOT EDIT DIRECTLY 
  This file is compiled from tooling/doc-hydrator/templates/09-infra-and-services.hbs.
  Run `pnpm run hydrate` to update it.
-->

# 09 — Infrastructure, Services, Security Stack & Sites

> The physical/edge substrate: five tiers, the service registry, compute providers + failover, the
> 8-layer security stack, the GPU mesh, the design system, and the sites. **What · Why · How · When ·
> Where · Disposition.**

---

## I1. The five-tier architecture (canonical — x-ref REBUILD_PLAN_V2 §3)

Edge (Cloudflare Workers + DO-per-session) → Origin (Cloud Run Node-22 modular monolith) → Durable
execution (Cloudflare Workflows) → Data plane (Neon Postgres SoR) → Derived projections (Vectorize edge
cache + KV best-effort). Full detail in `04-memory-and-retrieval.md` + REBUILD_PLAN_V2 §3. **Disposition:**
canonical.

## I2. Service registry (all endpoints — zero localhost, Law 0)

`auth` `api/v1` `memory` `vector` `infer` `conductor` `soul` `brain` `mcp` `health` `admin`
`events(wss)` `distiller` — all `*.headysystems.com`. Data endpoints: Neon (`ep-cold-snow-aesmiwt9…`),
Upstash Redis/REST (`finer-sole-64861…`), QStash, CF AI Gateway, (Qdrant — **dropped**, R2), Cosmos
(deferred). **Disposition:** endpoints = logical routes on the monolith/edge (not N deployments, R4/R5);
Law 0 (no localhost) is baseline.

## I3. The 10 infra services + 7 compute providers

**10 services** (V9 §27): Cloudflare (edge/Workers AI/KV/R2/AI-Gateway), Cloud Run (origin), Neon
(Postgres+pgvector), Upstash (Redis+QStash), GitHub (3 orgs → 1, ADR-0001), Sentry (Business+Seer),
Colab Pro+ (4 GPU runtimes), HuggingFace (Pro), Azure Cosmos (free, deferred), Grafana Cloud (OTel sink).

**7 compute providers** (routed by the LLM Router on class/latency/cost/health, `05`):

| # | Provider | Latency | Failover |
|---|---|---|---|
| 1 | Colab Pro+ GPU ×4 (Tailscale) | 50–500ms | round-robin → Cloud Run |
| 2 | Cloudflare Workers + Workers AI | <10ms / <50ms | PoP → origin Cloud Run |
| 3 | Cloud Run (GCP us-east1) | 100–300ms | multi-region (P4) |
| 4 | Google AI Studio (Gemini) | 200–2000ms | → Vertex → Claude |
| 5 | Vertex AI | 100–500ms | → AI Studio → Workers AI |
| 6 | GitHub Actions | async | → Cloud Run deploy |
| 7 | Local Ryzen 9 | <5ms | dev only |

**Cross-service failover matrix** (all transitions signed + audit-logged): Queue = Redis Streams →
QStash → pg_notify; State = Neon → Cosmos → Redis → DO; Vector = **pgvector (primary) → Vectorize cache**
(Qdrant removed, R2); Inference = Workers AI → AI Gateway → Cloud Run → Colab; Cache = Upstash → CF KV →
in-proc LRU (fib(20)=6765); Observability = OTel→Grafana → Sentry+Seer → pino stdout. **Disposition:**
baseline, with R2 applied (no Qdrant/Upstash-Vector-DiskANN in baseline).

## I4. Colab GPU cluster + Tailscale mesh

**What.** 4× Colab Pro+ runtimes (alpha=training/LoRA/DPO A100, beta=embedding/HNSW A100, gamma=eval L4,
delta=codegen+MAPE-K T4) on a **Tailscale userspace mesh** (SOCKS5 at `localhost:1055` — container-local,
**not** a Law-0 violation; MagicDNS `colab-gpu-{n}.heady-tailnet.ts.net`). **Why.** Free-tier GPU for
fine-tuning, batch embedding, eval, and the MAPE-K loop. **How.** Redis-hash heartbeats (10s/60s TTL),
Redis Streams + XAUTOCLAIM task queue, QStash durable backup, tenacity+circuitbreaker, fallback GPU →
Claude → GPT-4o → Groq. "Cattle not pets" — 3–10h session life, design for recovery. **When.** P2
(embedding/index) + P4 (training). **Where.** `src/colab/`, GPUComputeBee (domain 23). **Disposition:**
baseline-for-batch-compute; **best-effort, never on the SoR write path** (Redis Streams = in-flight only,
R2/T8).

## I5. The 8-layer security stack

Every request traverses all 8; no bypass; defense-in-depth. **(1) Edge** — WAF/DDoS/bot/geo, rate
φ⁸≈47 rpm/IP; **(2) Transport** — TLS 1.3, HSTS, cert pinning; **(3) Identity** — Firebase Auth (27
providers), signed JWTs, session TTL φ⁷≈8h; **(4) Authorization** — RBAC + CSL-gated (write needs
`cos ≥ ψ`), signed authz receipts; **(5) Input** — Zod strict on all endpoints, ≤1MB, no eval/parameterized
queries, boot-time env validation; **(6) Sandbox** — WASM isolation, 5s/256MB/no-network, auto-rollback;
**(7) Data** — AES-256-GCM at rest, field-level PII encryption, pgvector SSL, PITR + 30-day snapshots;
**(8) Audit** — immutable ML-DSA/Ed25519-signed log, signed receipt per run, retention φ¹³≈521 days,
SOC-2 checklist. Plus **Auth Relay iframe hardening** (postMessage origin allowlist across the 11
domains, sandboxed iframe, Zod relay payload, CSP `frame-ancestors`). **Disposition:** baseline, with
**R3** — crypto layers say ML-DSA/ML-KEM ("Ed25519 RETIRED"); canonically **Ed25519 now, PQC Phase-4**
(`06-G9`). AES-256-GCM, TLS 1.3, Zod, WASM sandbox, RBAC+CSL are all baseline today.

## I6. Design system (φ-scaled dark premium)

**What.** Two design expressions: (a) the **MCP Console design system** (the zip — honeycomb/hive, teal
`#00d4aa` + violet `#7c5eff`, Space Grotesk + JetBrains Mono, φ-Fibonacci spacing, `02`/`07`/`06`), and
(b) the **V9 site system** (`#0d0d1a` bg, glassmorphism, Inter + JetBrains Mono, `--heady-radius:13px`,
φ spacing/type ramp, `transition: 0.382s`). **Why.** Consistent sacred-geometry brand. **How.**
`heady-sacred-geometry-css-generator` emits φ-scaled CSS tokens; the zip ships tokens + components.
**Disposition:** baseline; **R1** — components in React (console/app) or vanilla web components (sites)
per dependency-minimalism. Sacred geometry is a **default/heuristic, not a hard gate** (per the v2
correction).

## I7. The sites (11 total)

11 domains, each a Drupal 11 site with a sacred-geometry accent: headyme (#00d4aa, OS hub/onboarding),
headysystems (#7c5eff, docs/node status), headyconnection.org (#00b4ff, 501c3), headybuddy (#ff6b35,
companion), headymcp (#f0c040, MCP hub), headyio (#ff3d82, API/integration), headybot (#4caf50, bots),
headyapi (#ff9800, gateway), headylens (#e91e8c, vision), headyai (#00bcd4, core AI), headyfinance
(#4caf50, finance). **Disposition:** content sites = Drupal 11 + Twig + Vanilla (no build, dependency-
minimal, R1); **headyme.com portal/console is the Phase-3 spearhead** (unblocks Google for Startups) and
may be a React SPA where complexity warrants. Per-site requirements (hero sacred-geometry canvas, features
grid, 2000+ word deep-dive, etc.) per V9 §13.

**Disposition rollup:** infra is canonical and well-specified; the only reconciliations are R2 (Qdrant
dropped from the failover matrix), R3 (Ed25519-now/PQC-later in the security stack), R1 (frontend per
surface), and R4/R5 (services = logical routes, not N deployments).
