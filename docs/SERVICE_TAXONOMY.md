# HEADY_BRAND — Service Taxonomy & Count Reconciliation

> Canonical reference for Heady platform service counting methodology.
> Resolves the 19 vs 57 vs 175 discrepancy identified in platform audit.

---

## Why Three Numbers Exist

Heady is a multi-service platform built across dozens of repositories. Depending on how you count — total registered code units, services needing infrastructure work, or live production deployments — you arrive at different totals. All three numbers are correct; they measure different things.

| Count | What It Measures | Source of Truth |
|------:|------------------|-----------------|
| **175** | Total registered entries in `SERVICE_INDEX.json` — every service, library, variant, worker, and utility across all Heady repositories | `SERVICE_INDEX.json` |
| **57** | Services that require infrastructure work (missing entrypoints, Dockerfiles, or CI pipelines) to become deployment-ready | Infrastructure audit / remediation plan |
| **19** | Critical production services actively deployed to Google Cloud Run at time of initial audit | Cloud Run console / `gcloud run services list` |

The initial audit surfaced 19 Cloud Run services. After reconciliation and additional deployments, the confirmed production count is **21 live Cloud Run services**.

---

## Service Tier Definitions

### Tier 1 — Production Services (21 confirmed live)

Services actively deployed to Google Cloud Run, serving real traffic, and monitored in production. These have:

- Verified Cloud Run deployment
- Production Dockerfile and entrypoint
- CI/CD pipeline (Cloud Build or GitHub Actions)
- Health check endpoints
- Logging and alerting configured

**This is the number that matters for uptime SLAs and incident response.**

### Tier 2 — Infrastructure-Ready Services (~33 of the 57)

Services that have functional entrypoints and Dockerfiles but are not yet deployed to Cloud Run. They are containerized and can be promoted to Tier 1 with:

- Cloud Run service configuration
- DNS / routing setup
- Production environment variables and secrets
- CI/CD pipeline integration

**These are the next candidates for production deployment.**

### Tier 3 — Code-Complete Services

Services registered in `SERVICE_INDEX.json` that contain working application code but are not yet containerized. They need:

- Dockerfile creation
- Entrypoint script
- Dependency lockfile verification
- Container build and test pass

**The bulk of the 175 count falls here — working code awaiting containerization.**

### Tier 4 — Experimental / Archive

Experimental repositories, proof-of-concept implementations, archived components, and deprecated variants. These include:

- Early prototypes that informed current architecture
- Superseded service versions retained for reference
- Research spikes and one-off tooling
- Components scheduled for removal or consolidation

**These remain in SERVICE_INDEX.json for traceability but are not on the deployment roadmap.**

---

## Reconciliation Summary

```
175  Total SERVICE_INDEX.json entries
 - Tier 4 (Experimental/Archive)     ~  varies
 - Tier 3 (Code-Complete)            ~  bulk remainder
 - Tier 2 (Infrastructure-Ready)     ~  33
 - Tier 1 (Production / Cloud Run)   =  21
                                        ──
 57  = Tier 2 + Tier 3 services requiring infrastructure work
 21  = Tier 1 production services (updated from initial count of 19)
175  = Tier 1 + Tier 2 + Tier 3 + Tier 4 (canonical platform total)
```

---

## Canonical Counts

- **175 registered services** is the canonical count for the total Heady platform. It represents every discrete service unit tracked in `SERVICE_INDEX.json`.
- **21 Cloud Run services** is the production deployment count. It represents services actively running in Google Cloud Run and serving traffic.

Both numbers are accurate. They answer different questions: "How large is the platform?" vs "What is deployed right now?"

---

## For Investors

Heady operates **175 registered service units** across its platform, reflecting the breadth of the technology stack — APIs, workers, AI pipelines, data services, edge functions, and supporting infrastructure.

Of these, **21 services are deployed to production** on Google Cloud Run, handling live user traffic today. An additional **~33 services are containerized and infrastructure-ready**, positioned for rapid promotion to production as customer demand scales.

This architecture is intentional:

1. **Capital efficiency.** Not every service needs to run 24/7. Services are promoted to production based on demand, keeping cloud spend proportional to revenue.
2. **Speed to market.** With ~33 services already containerized, Heady can expand its production footprint in days, not months, when new features or enterprise contracts require it.
3. **Platform depth.** The 175-service registry demonstrates the full scope of IP and engineering investment — the moat is not just what is live today, but the breadth of capability ready to deploy.

### Key Takeaway

> The "19 vs 175" discrepancy is not a gap — it is a deliberate staging strategy.
> Heady maintains a deep service catalog and promotes services to production
> based on business need, keeping infrastructure costs aligned with growth.

---

*Last updated: 2026-03-18*
