# ADR-0019: Nine-Domain Brand Architecture — Nonprofit/Commercial Split

**Status:** Accepted  
**Date:** 2026-06-17  
**Deciders:** Eric Haywood (HeadySystems Inc.)  
**Strength of Acceptance:** ⭐⭐⭐⭐⭐ (Critical — governs every deployment target, legal entity, and revenue stream)

---

## Context

HeadySystems Inc. operates across nine distinct internet domains spanning two legal entities and three strategic categories. Without a canonical mapping of domains to legal entities, revenue models, and deployment stacks, individual contributors risk deploying commercial features on nonprofit infrastructure (IRS compliance violation), mixing auth sessions across incompatible entity boundaries, or exposing restricted HeadySystems IP through HeadyConnection endpoints.

The two legal entities:
- **HeadyConnection Inc.** — Colorado nonprofit, EIN 41-3508351, 501(c)(3) pending. Mission: education, community access, digital equity.
- **HeadySystems Inc.** — Colorado C-Corp, EIN 41-3412204. Mission: sovereign AI platform, commercial SaaS.

The Sacred Geometry topology (ADR-0015) assigns every node to a ring layer (Center → Inner → Middle → Outer → Governance → Memory → Ops). Domain assignment must follow the same topological logic so that UI-layer routing, CDN configuration, and Firebase Auth tenant isolation all derive from a single canonical registry.

---

## Decision

Establish a canonical nine-domain registry as the single source of truth for all domain-to-entity, domain-to-revenue-model, and domain-to-stack mappings. No CI/CD pipeline, Workers routing rule, Firebase Auth tenant, or Cloudflare Page may reference a domain not present in this registry.

### Domain Registry

| Domain | Legal Entity | Category | Revenue Model | Auth Tenant | Sacred Geometry Layer |
|---|---|---|---|---|---|
| **headyme.com** | HeadySystems Inc. | Core Platform | SaaS / Subscription | `headyme` | Center |
| **headyai.com** | HeadySystems Inc. | AI Orchestration | SaaS / API Credits | `headyai` | Inner |
| **headymcp.com** | HeadySystems Inc. | MCP Gateway | API / Per-Request | `headymcp` | Inner |
| **headybuddy.com** | HeadySystems Inc. | Companion AI | Subscription + Usage | `headybuddy` | Middle |
| **headyos.com** | HeadySystems Inc. | Latent OS | Enterprise License | `headyos` | Middle |
| **headytrade.com** | HeadySystems Inc. | FinTech / Trading | Revenue Share + SaaS | `headytrade` | Outer |
| **headylab.com** | HeadySystems Inc. | Research / Patents | Enterprise + Grants | `headylab` | Outer |
| **headyconnection.org** | HeadyConnection Inc. | Nonprofit Portal | Grants / Donations | `headyconnection` | Governance |
| **headyweb.com** | HeadySystems Inc. | Web / Frontend Hub | Ad-supported / Free | `headyweb` | Ops |

### Separation Rules

1. **IRS Compliance Boundary:** `headyconnection.org` MUST NOT serve any commercial SaaS feature, paywall, or revenue-generating endpoint. Any feature crossing this boundary requires a formal inter-entity service agreement.

2. **Auth Tenant Isolation:** Each domain maps to its own Firebase Auth tenant. Cross-tenant session sharing is forbidden. SSO across entity boundary (headyconnection.org ↔ headyme.com) requires an explicit OAuth 2.0 delegation flow with audit logging.

3. **Deployment Target:** All nine domains deploy to Cloudflare Pages (static/edge) backed by Cloud Run `us-east1` (ADR-0016 / ADR-0022). No domain deploys to `us-central1` or legacy `heady-prod-609590223909`.

4. **Revenue Attribution:** All billing, Stripe webhooks, and HeadyCoin ledger entries MUST tag the originating domain from this registry. Mixed-entity revenue records are an audit failure.

5. **PQC Key Isolation (ADR-0021):** Each domain's service-to-service calls use domain-scoped ML-DSA signing keys. Key fingerprints are namespaced `{domain}:{serviceId}`.

### Registry Enforcement

The canonical registry lives at `src/config/domain-registry.js` (ESM, phi-scaled constants). The ADR Sentinel CI job (`.github/workflows/adr-sentinel.yml`) verifies any PR touching `cloudflare/`, `firebase/`, or `src/routes/` against this registry.

```js
// src/config/domain-registry.js
export const DOMAIN_REGISTRY = {
  'headyme.com':         { entity: 'HeadySystems', category: 'core',       layer: 'Center',     tenant: 'headyme',       commercial: true  },
  'headyai.com':         { entity: 'HeadySystems', category: 'ai',         layer: 'Inner',      tenant: 'headyai',       commercial: true  },
  'headymcp.com':        { entity: 'HeadySystems', category: 'mcp',        layer: 'Inner',      tenant: 'headymcp',      commercial: true  },
  'headybuddy.com':      { entity: 'HeadySystems', category: 'companion',  layer: 'Middle',     tenant: 'headybuddy',    commercial: true  },
  'headyos.com':         { entity: 'HeadySystems', category: 'os',         layer: 'Middle',     tenant: 'headyos',       commercial: true  },
  'headytrade.com':      { entity: 'HeadySystems', category: 'fintech',    layer: 'Outer',      tenant: 'headytrade',    commercial: true  },
  'headylab.com':        { entity: 'HeadySystems', category: 'research',   layer: 'Outer',      tenant: 'headylab',      commercial: true  },
  'headyconnection.org': { entity: 'HeadyConnection', category: 'nonprofit', layer: 'Governance', tenant: 'headyconnection', commercial: false },
  'headyweb.com':        { entity: 'HeadySystems', category: 'web',        layer: 'Ops',        tenant: 'headyweb',      commercial: true  },
};
```

---

## Consequences

### Positive
- IRS compliance: clear audit trail separating nonprofit and commercial operations.
- Firebase Auth tenant isolation prevents session leakage across entity boundary.
- CDN routing rules, feature flags, and billing attribution all derive from one file.
- Sacred Geometry topology (ADR-0015) and domain architecture are co-located in the same conceptual model.
- Enables per-domain PQC key namespacing and sovereign compliance routing (heady-sovereign-mesh).

### Negative
- Nine Auth tenants increase Firebase configuration surface area.
- Inter-entity features require formal delegation flows, adding latency.
- ADR Sentinel must be updated whenever a new domain is considered — prevents organic experimentation.

### Neutral
- ADR-0019/ADR-0020 reserved placeholders now filled; INDEX.md gap closed.

---

## Superseded rows (pointer only — the tables above are unchanged)

- **`headytrade.com` → `headyfinance.com`.** This legacy file is a historical artifact and its
  tables are preserved as accepted; the retired brand is history here and appears nowhere live.
  The succession is recorded in **ADR-0054 (Proposed)**; the operative canonical record is
  `docs/adr/0033-nine-domain-brand-architecture.md`, and the live roster is `facts.yaml` `domains:`.

## Compliance

| Concern | Status |
|---|---|
| IRS 501(c)(3) commercial / nonprofit separation | ✅ Enforced by registry |
| Firebase Auth tenant isolation | ✅ Enforced by registry |
| Cloudflare deployment targeting | ✅ Enforced via ADR Sentinel |
| PQC key namespace isolation | ✅ Per ADR-0021 |

---

## Related ADRs

- ADR-0002: Canonical topology (Cloudflare + Cloud Run)
- ADR-0009: Firebase Auth + httpOnly cookies
- ADR-0015: Sacred Geometry node topology
- ADR-0021: Post-quantum cryptography mandate
- ADR-0022: GCP region canonical lock
