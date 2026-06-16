# Heady-AI — Optimal Rebuild Plan

> ⚠️ **SUPERSEDED by `REBUILD_PLAN_V2.md` (2026-06-15).** Retained for provenance only. Where this v1
> differs from v2, **v2 wins** — notably stores (v1 says "defer Qdrant to P2"; v2 **drops Qdrant**:
> pgvector authority + Vectorize derived cache), supply chain (v2 = Renovate primary), and the agent loop
> (v2 = rustc bootstrap, ADR-0016). Do not build from this document.
>
> **Status:** Superseded · **Date:** 2026-06-15 · **Owner:** Eric Anthony Haywood
> Synthesizes `dropzone/heady_current_state_handoff.md`, `Gem_Heady_Rebuild.md`,
> `gpt-deep-research-report.md`, and `Heady_Arch_Audit_Open_Source_Int.md`, and reconciles
> them against the antigravity "Master Concurrent Rebuild Plan."

## 1. Premise

There are two builds on disk:

| | `~/Heady-AI` (this repo) | `~/workspace/heady-ai` (legacy) |
|---|---|---|
| State | Clean scaffold (empty `apps/`/`packages/`; canonical root config + `.agents/`) | ~75 packages, ~35 apps, archived repos, auto-commit bot |
| Role | **Canonical target** | **Migration source → archive** |

This is a true greenfield consolidation. Nothing is wired yet, so we can sequence it correctly.

## 2. The governing principle

Two independent deep-research passes (`gpt-deep-research-report.md`, `Heady_Arch_Audit_Open_Source_Int.md`)
converge against the maximalism of the Gem blueprint. The rule for this rebuild:

> **Reduce concurrency of architectural bets. Sequence the bets; parallelize only the execution within a bet.**
> Every new service is a quarter of solo-founder attention. ≤1 net-new platform per phase. Every phase retires
> at least one complexity source. Reserve 20% of capacity for debt paydown.

## 3. What stays fixed (the backbone — do not reopen)

- Modular monolith with strict bounded contexts.
- **PostgreSQL (Neon) as the single system of record** + transactional outbox as the *only* cross-boundary write path.
- **OpenAPI-first contracts** → generated TS types / Zod / `mcp-tools.json` (Kubb), CI drift-fail.
- One durable orchestration surface (Cloudflare Workflows + Queues + Durable Objects).
- **pgvector as the single retrieval authority** (NOT Vectorize, NOT Qdrant — see ADR-0003).

## 4. Corrections to the antigravity plan

| # | Antigravity | Correction | ADR |
|---|---|---|---|
| 1 | 3-tier memory (Upstash Redis + pgvector + Qdrant) | **pgvector only**; KV cache in front; defer Qdrant to P2 w/ benchmark | ADR-0003 |
| 2 | Phase 2 builds 4 packages + 4 apps concurrently | Sequence the bets; ≤1 net-new platform/phase | ADR-0013 |
| 3 | Jumps to code projection | **Governance first**: one canonical repo + ADRs + supply-chain CI | ADR-0001 |
| 4 | ARCH-001 formalize projection manifests | Default action is **fold satellites into monorepo**, not document the sprawl | ADR-0001 |
| 5 | Verify = smoke + branding + cache-warm | Add the operating system: eval gates, restore drills, FinOps, SLO alerts, idempotency, mcp-scan | ADR-0006/0009/0011/0012 |
| 6 | Edge Code Mode / DO-per-session in Phase 3 | Correct direction but P2; "every Worker→Cloud Run hop is a $-and-ms tax — push reads to the Worker" | ADR-0004 |
| 7 | Sacred geometry / RAM-ops as hard operating rules | Keep φ/CSL as **defaults & heuristics**, not hard gates that add ops drag | — |

**Dependency-graph verdict:** `phi-math` + `csl-engine` baseline is fine but incomplete. The real baseline
leaves are **`phi-math`, `csl-engine`, `packages/contracts`, `packages/db`** → then `security-mesh`,
`heady-vault`, `memory-stream`, `auto-context` → then apps.

## 5. Phased plan

### Phase 0 — Containment & Authority *(days · P0 · before any code projection)*
- **SEC-001** rotate Cloudflare + MCP creds; `git filter-repo` purge across legacy repos; secrets → GCP Secret Manager (keyless OIDC).
- **SEC-002** fail-closed admin mutation auth + test proving missing prod auth returns an error.
- **INFRA-001** canary rollback captures the stable Cloud Run revision *before* traffic shift.
- Declare ONE canonical repo → `SOURCE_OF_TRUTH.md` + ADR-0001. Collapse 4 GitHub orgs → 1.
- Supply-chain CI now: gitleaks + TruffleHog + Semgrep + Trivy/Grype/Syft + Dependabot (3-day cooldown) + pinned action **digests** + mcp-scan.
- Write/approve the ADR set (this directory).

### Phase 1 — Backbone packages *(P0)*
- Leaves: `phi-math`, `csl-engine`, `packages/contracts` (Kubb), `packages/db` (Drizzle + Neon **pgvector** + `pgmq` outbox + `pg_cron`).
- `security-mesh` (CORS allowlist not `*`, constant-time token compare, Zod validation), `heady-vault` (Secret Manager bindings).

### Phase 2 — Task ledger + memory *(P0/P1)*
- **Task ledger first**: `task`, `task_attempt`, `outbox`, reconciliation, idempotency (ADR-0006). First living bounded context.
- `memory-stream` as a TS pgvector schema — port CoALA/Letta/mem0 *patterns*; do not run Python servers; do not add Qdrant.
- `auto-context` via WAL→projector CDC with change-significance filtering (ADR-0007).

### Phase 3 — Apps & native agent loop *(P1)*
- `api-gateway` (reads in Worker, writes to Cloud Run; circuit breaker = library), `heady-manager` (decompose into routes; standardize `PORT`), `heady-mcp-server` (Streamable HTTP, official MCP SDK, single transport), `headyme-portal`.
- Native agent loop: plan → sandbox → PR → **human approval**; eval gate; **no auto-merge** (ADR-0005).
- 🎯 Shipping `headyme-portal` on the verified domain unblocks the Google for Startups suspension.

### Phase 4 — Expand carefully *(P2 · evidence-gated)*
- Edge Code Mode, DO-per-session, optional Vectorize/Qdrant projector — each requires benchmark + feature flag + rollback path.

### Running throughout (the missing OS)
OTel GenAI semconv · Sentry SLO-burn alerts only (ADR-0011) · Langfuse · daily FinOps spend rollup (ADR-0012) · monthly Neon restore drill (ADR-0009) · eval gates on every agent PR.

## 6. Time-sensitive non-engineering items (from the Gem audit)

- ⏰ **Perplexity Enterprise ticket closes ~June 16** — reply to enterprise@perplexity.ai (HeadyConnection Inc. / headyconnection.org / 501(c)(3) letter).
- **Google for Startups suspended (June 10)** — needs functional portal on headyme.com (ties to Phase 3).
- **Patent assignments** — 51 provisionals list applicant "Heady Systems LLC" (never formed) → assign to HeadySystems Inc.; non-provisional conversion deadline **2027-03-06**.
- **Trademark licensing agreement** between HeadyConnection Inc. (owns "HEADY") and HeadySystems Inc. — avoids IRS private-inurement risk.
- Adobe Express / Acrobat grants pending activation.

## 7. Operational hazard

`~/` holds **32 core dumps** (~375 GB real) on a 945 GB disk at 68% full — something is crash-looping.
Investigate the dumping process (likely a legacy-tree watcher) and clear them.

## 8. ADR index

See `docs/adr/`. Architectural: 0001 repo authority · 0002 backbone · 0003 retrieval · 0004 orchestration ·
0005 agent governance. Operational (the 8 gaps): 0006 idempotency · 0007 DDL coordination · 0008 data
retention/GDPR · 0009 PITR/DR · 0010 rate limits · 0011 SLO on-call · 0012 FinOps · 0013 founder governance.
