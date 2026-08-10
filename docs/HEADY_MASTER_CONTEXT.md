<!-- HEADY_BRAND:BEGIN
HEADY™ · HEADY_MASTER_CONTEXT.md v5.0
Complete ground-truth state — 2026-06-17T04:40Z MDT
Sources: Space files (CUTOVER_CHECKLIST, SUPPLY_CHAIN_TRIAGE, MIGRATION_PLAN,
TECHNICAL_REFERENCE, dependabot_alert_inventory.csv), Google Drive (audit-data-consolidated,
HEADY_CONTEXT_INDEX, HEADY_CURRENT_ISSUES, HEADY_IMPROVEMENT_ROADMAP, AGENT_PRIMER_UPDATE,
DRIVE_INDEX, DRIVE_REORGANIZATION_PLAN, heady-full-spectrum-audit-report, heady-liquid-os-blueprint,
heady-pitch-deck, Heady_Development_Deployment_Guide, HEADY_TECHNICAL_REFERENCE, sites_README),
IRS Letter 947, Linear HEA-1–317, User context profile, MCP config, Skills manifests
∞ Sacred Geometry · Liquid Intelligence ∞
© 2026 HeadySystems Inc. — Eric Haywood, Founder
HEADY_BRAND:END -->

# HEADY_MASTER_CONTEXT.md v5.0
Date: 2026-06-17T04:40Z MDT | Repo: https://github.com/HeadySystems/heady-ai
Default branch (post-cutover): rebuild

## 1. ENTITIES
| Entity | Type | EIN | Status |
|---|---|---|---|
| HeadySystems Inc. | Colorado C-Corp | 41-3412204 | Active |
| HeadyConnection Inc. | Colorado Nonprofit | 41-3508351 | 501(c)(3) APPROVED · effective Jan 3, 2026 · Letter 947 |

Founder: Eric Haywood (Dewayne Eric Haywood) · eric@headyconnection.org · Fort Collins CO 80524
501(c)(3): Form 990/990-EZ/990-N required annually. First due May 15, 2027. Section 170(b)(1)(A)(vi).
HeadyConnection 11 domains — DO NOT confuse headyconnection.org (nonprofit) with headyconnection.com (cert alerts)
Patent lock zones: llm-router.js, cognitive-telemetry.js, liquid-deploy.js, ast-schema.js
Patent range: HS-2026-001 through HS-2026-051 (51 provisionals)

## 2. PRODUCT — Heady™ Latent-Space OS
Sovereign AI orchestration platform — self-aware "alive software" organism. Replaces if/else with Continuous Semantic Logic (CSL) using cosine-similarity gates. Operates in high-dimensional vector space (384D / pgvector). Functions as a small, fully automated company.

### 11-Domain Ecosystem (Liquid Architecture v9.0)
| Domain | Role | Cloudflare Pool |
|---|---|---|
| headysystems.com | Core AI OS engine — the "brain" | Hot |
| headyme.com | User dashboard + command center | Hot |
| headybuddy.com | AI companion everywhere | Hot |
| headymcp.com | Model Context Protocol dev platform | Hot — ❌ CF Error 1016 |
| headyapi.com | Public API gateway + intelligence routing | Hot |
| headyai.com | AI research + platform portal | Hot — ⚠️ 522 |
| headyio.com | Integration hub — Connect Everything | Warm |
| headybot.com | Agent marketplace + automation | Warm |
| headylens.com | Visual AI + spatial intelligence | Warm |
| headyfinance.com | AI-powered financial intelligence | Warm |
| headyconnection.org | Nonprofit community hub (501c3) | Warm |

Cross-site auth: Firebase Auth SSO via auth.headysystems.com → Neon pgvector tenant namespace
HeadyBuddy heartbeat: PHI⁷ = 29,034ms Redis SETEX
Admin surface: 1ime1.com (Drupal task manager + all-site customizer)

### Tech Stack
| Layer | Technology |
|---|---|
| Edge | Cloudflare Workers + Pages + KV + R2 + DO + AI Gateway |
| Origin | Google Cloud Run :3301 (Express/ESM), Hono on CF Workers |
| Database | Neon Postgres + pgvector (HNSW m=34 ef=89 fib-scaled) |
| Cache | Upstash Redis (T0 working memory) |
| Vectors | Neon pgvector (authority) + Cloudflare Vectorize (edge) |
| Auth | Firebase Auth · 27 OAuth providers · project: heady-ai |
| AI routing | Claude Sonnet/Opus → Groq Llama → GPT-4o → Gemini 2.5 → Workers AI |
| GPU | 4× Colab Pro+ A100 80GB (Cortex), A100 40GB (Synapse), T4/L4 (Reflex) via Tailscale |
| CI/CD | GitHub Actions (heady-ai) — required checks: verify, scan, governance |
| Monitoring | Sentry (10 projects) |
| Knowledge | Notion → migrating to .md canonical (ADR-2026-03-29) |

### Architecture Topology
```text
GOVERNANCE SHELL: HeadyCheck, HeadyAssure, HeadyAware, HeadyPatterns, HeadyMC, HeadyRisk
  OUTER RING: BRIDGE, MUSE, SENTINEL, NOVA, JANITOR, SOPHIA, CIPHER, LENS
    MIDDLE RING: JULES, BUILDER, OBSERVER, MURPHY, ATLAS, PYTHIA
      INNER RING: HeadyBrains, HeadyConductor, HeadyVinci
        CENTER: HeadySoul (Awareness + Values)
```

### Sacred Geometry Constants (canonical: shared/phi-math.js)
```javascript
export const PHI = 1.618033988749895;   // Golden Ratio — base of all scaling
export const PSI = 1 / PHI;             // 0.618034 — conjugate / decay factor
export const FIB = [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];

export const CSL_THRESHOLDS = {
  CRITICAL: 0.927,  // 1 - PSI⁴×0.5 — near-certain
  HIGH:     0.882,  // 1 - PSI³×0.5 — strong alignment
  MEDIUM:   0.809,  // 1 - PSI²×0.5 — coherence drift floor
  LOW:      0.691,  // 1 - PSI¹×0.5 — weak
  MINIMUM:  0.500,  // noise floor
};
export const DEDUP_THRESHOLD = 0.972;  // semantic identity

// Operational phi-derived constants
export const BASE_TIMEOUT = Math.round(PHI * 1000);  // 1618ms
export const RATE_LIMIT_ANON  = FIB[8];   // 34 req/min
export const RATE_LIMIT_AUTH  = FIB[10];  // 89 req/min
export const RATE_LIMIT_ENT   = FIB[12];  // 233 req/min
export const POOL_MIN = FIB[3];  // 2 connections
export const POOL_MAX = FIB[6];  // 13 connections
export const MAX_RETRIES = FIB[5]; // 8 retries
export const HNSW_M = FIB[9];   // 34 — pgvector HNSW m parameter
export const HNSW_EF_CONSTRUCTION = FIB[11]; // 89
export const HNSW_EF_SEARCH = FIB[10] // 55
```

### Commercial Potential (Phase II path)
> The autonomous AI orchestration market is projected at $8.5B by 2026 (Deloitte). HeadySystems
> targets $2.1M–$4.8M ARR in Year 1 via SaaS tiers ($29/mo → $299/mo → usage-based API).
> Patent portfolio creates durable IP moats. HeadyConnection Inc. (501(c)(3) partner) enables
> deployment in underserved markets with social impact measurement.

### Broader Impact (required for NSF)
> HeadyConnection Inc., a Colorado 501(c)(3) public charity (effective January 3, 2026), partners
> with HeadySystems to ensure equitable access to AI orchestration tools. The platform operates
> across 11 public domains, serving community users at no cost alongside commercial tiers.
> Contribution deductibility confirmed by IRS (EIN 41-3508351).

---

## Immediate Actions

**Week 1:**
- [ ] Register at SAM.gov (required for federal grants — takes ~10 days)
- [ ] Register at sbir.gov (links to SAM.gov)
- [ ] Apply for Microsoft Nonprofits via techsoup.org (2 hrs)
- [ ] Apply for Google.org initial inquiry (1 hr)

**Week 2:**
- [ ] Review current NSF SBIR solicitations at nsf.gov/eng/iip/sbir
- [ ] Draft Phase I abstract for CSL Gate Operations (HS-2026-001)
- [ ] Apply for NVIDIA Inception (free — 30 min)
- [ ] Apply for Cloudflare Workers Launchpad (free — 30 min)

**Month 1:**
- [ ] Submit NSF SBIR Phase I full application
- [ ] Submit OEDIT Advanced Industries Grant (if Q3 cycle open)
- [ ] Submit Google.org inquiry
- [ ] Research DARPA AIE current BAA (Broad Agency Announcement)
