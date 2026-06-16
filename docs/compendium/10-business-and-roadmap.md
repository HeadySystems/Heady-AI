# 10 — Business, Compliance, Billing & Roadmap

> The commercial layer the engineering serves: the beachhead product, the compliance gate that unlocks
> regulated revenue, the billing model, pricing, credit programs, the remediation backlog, and the
> 12-month gate plan. **What · Why · How · When · Where · Disposition.** Source: the 88KB Architectural
> Blueprint.

---

## B1. Beachhead product — the IRS Form 990 Parser

**What.** A high-margin service that parses IRS Form 990 XML filings (nonprofit tax data) on Cloud Run.
**Why.** First revenue vertical: narrow, high-value, nonprofit-adjacent (fits HeadyConnection's 501(c)(3)
mission), and it exercises the full pipeline (ParserBee, document processing). **How.** ParserBee (domain
14) executes high-performance 990 XML translations; output embedded + receipted. **When.** Months 3–6
(Gate 3). **Where.** `heady-nonprofit-ops`, ParserBee. **Disposition:** Phase 4 product; the *capability*
(document parsing) can ship earlier as an MCP tool.

## B2. PHI / regulated-industry compliance layer

**What.** The gate that lets Heady handle Protected Health Information and enter fintech/healthcare under
HIPAA / GDPR / EU AI Act / CLOUD Act. **Why.** Regulated verticals are the high-margin contracts (Gate 4).
**How — PHI scorecard:** PHI Anomaly Gate (quarantine HIPAA markers before external inference; **0%
transit leak**); Sovereignty Framework (edge execution, zero localhost; 80% baseline); State Auditing (CF
KV + pgvector telemetry, <50ms); Governance Swarm (AuditBee/ComplianceBee/PermissionGuardBee at CSL
≥0.70); Code Integrity (CI secret/dep scans, 100% core coverage). Single-tenant **sovereign DB** per
client guarantees residency. **When.** Months 3–6 staging (Gate 3), scaling Gate 4. **Where.** `06-G11`,
governance bees. **Disposition:** Phase 3/4 evidence-gated; PHI handling needs the data-map + retention
(ADR-0008) first.

## B3. Reserve-Commit billing + per-thought micro-transactions

**What.** A two-phase billing pattern + usage metering. **Why.** Isolate execution latency from billing
DB writes; capture true compute cost. **How.** `Balance_available = Balance_total − Budget_reserved`: on a
multi-turn workflow the gateway reserves a max "thought budget" out-of-band (no DB lock on the hot path),
then commits the actual cost on completion. **Per-thought micro-transactions:** `Cost = BaseRate × φ^intensity`,
BaseRate `$0.000100`/action — embedding ×1 ($0.000100), search/write ×φ ($0.000162), pipeline-stage ×φ³
($0.000424), bee-dispatch/990-parse ×φ⁴ ($0.000685), multi-model route ×φ⁵ ($0.001109). **When.** Phase 4
(needs Stripe). **Where.** API gateway, Oracle swarm (economic guardrails). **Disposition:** Phase 4
(monetization); pairs with FinOps caps (ADR-0012) and budget-factor routing (ADR-0018).

## B4. Pricing — Fibonacci tiers

Trial (free, local-model trials) · **Seed $89/mo** (basic memory persistence) · **Grow $233/mo** (pro
devs) · **Scale $610/mo** (high-concurrency swarm dispatch). **Disposition:** Phase 4; φ/Fibonacci pricing
is a brand-consistent default, not a hard gate.

## B5. Cost & credit programs (act now — x-ref §15 register)

Target infra **~$610/mo** ($610 infra + $377 API = **$987 ceiling**, φ-pure); immediate ~$1,200–1,500
token bottleneck. **Credit programs:**

| Program | Status | Action | Impact |
|---|---|---|---|
| **Cloudflare for Startups** | active, **$250k pending** | confirm allocation | covers entire edge tier |
| **Anthropic ×Goodstack** | pending (email 2026-06-10) | click verification link | Claude credits + lower token cost |
| **OpenAI ×Goodstack** | pending | upload involvement proof | GPT credits |
| **Adobe ×Goodstack** | **approved** | activate Express + Acrobat | doc license = $0 ×1yr |
| **Perplexity Enterprise** | 25% offer, ticket closes **~2026-06-16** | reply with org/site/501c3 | −25% seats |

**Disposition:** non-engineering, time-sensitive — these directly fund the build and gate provider tiers.

## B6. Technical remediation matrix (the stabilization backlog)

| Issue | Action | Stage |
|---|---|---|
| James Haywood GPG | import his public key (eric@headyconnection.org) to decrypt investor `.asc` | Days 1–5 |
| Credential exposure | `git filter-repo` purge + rotate all keys | Days 1–10 (ADR-0008/SEC-001) |
| CI/CD blocks | fix container/test scripts, pin `actions/checkout@v4` (digests) | Days 11–30 |
| No branch protection | enforce on main/staging/prod + required reviews | Days 11–30 (ADR-0005/0016) |
| Repo sprawl | archive legacy, consolidate to monorepo | Days 31–60 (ADR-0001) |
| ~30 Dependabot alerts | `pnpm audit fix` + manual upgrades; **Renovate** primary | Days 31–60 |

**Disposition:** Phase 0 containment — these *are* the SEC-001/INFRA-001 items in REBUILD_PLAN_V2 §13.

## B7. The 12-month, 4-gate roadmap (business view)

- **Gate 1 — Stabilization (Days 1–60):** GPG keys, secret purge, monorepo migration. ↔ Phases 0–1.
- **Gate 2 — Security & CI (Days 61–90):** fix CI, branch protection, MCP sandboxing. ↔ Phase 0/3 security.
- **Gate 3 — Compliance & Staging (Days 91–180):** PHI gate to staging, **launch 990 Parser**, Founder's
  Pilots. ↔ Phases 3–4.
- **Gate 4 — Enterprise Scaling (Days 181–365):** mid-market fintech/healthcare contracts, patents
  provisional→granted (deadline 2027-03-06), edge optimization, Series-A posture. ↔ Phase 4.

**Reconciliation with the engineering phases:** the 4 business gates are *calendar* milestones; the v2
engineering phases (P0–P4) are *dependency* milestones (every gate is a condition, not a clock —
ADR-0013). They run concurrently: Gate 1≈P0–P1, Gate 2≈P0 security + P3 MCP, Gate 3≈P3 spearhead + P4
beachhead, Gate 4≈P4 verticals. **Disposition:** the business roadmap is the *why/when*; the v2 phases are
the *how* — keep both, drive engineering by conditions and report progress against the calendar gates.

## B8. Organizational frame

HeadySystems Inc. (commercial) + HeadyConnection Inc. (501(c)(3)). Patents: 51 provisionals to reassign
off never-formed "Heady Systems LLC" → HeadySystems Inc.; TM licensing (HeadyConnection owns "HEADY" →
licenses HeadySystems) to avoid IRS private-inurement. **Disposition:** legal/non-engineering track
(PandaDoc/Drive), surfaced in the time-sensitive register.
