# ADR-0033: Nine-Domain Brand Architecture — Nonprofit/Commercial Split

- **Status:** Accepted (2026-06-17, legacy corpus docs/ADR) · Transferred to canonical corpus 2026-08-09
- **Deciders:** Eric Haywood (HeadySystems Inc.)
- **Strength of Acceptance:** Critical — governs every deployment target, legal entity, and revenue stream

## Context

HeadySystems Inc. operates across nine distinct internet domains spanning two legal entities and three strategic categories. Without a canonical mapping of domains to legal entities, revenue models, and deployment stacks, individual contributors risk deploying commercial features on nonprofit infrastructure (IRS compliance violation), mixing auth sessions across incompatible entity boundaries, or exposing restricted HeadySystems IP through HeadyConnection endpoints.

The two legal entities:

- **HeadyConnection Inc.** — Colorado nonprofit, EIN 41-3508351, 501(c)(3) pending. Mission: education, community access, digital equity.
- **HeadySystems Inc.** — Colorado C-Corp, EIN 41-3412204. Mission: sovereign AI platform, commercial SaaS.

The Sacred Geometry topology (legacy ADR-0015) assigns every node to a ring layer (Center → Inner → Middle → Outer → Governance → Memory → Ops). Domain assignment must follow the same topological logic so that UI-layer routing, CDN configuration, and Firebase Auth tenant isolation all derive from a single canonical registry.

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
| **headyfinance.com** | HeadySystems Inc. | FinTech Advisory | Revenue Share + SaaS | `headyfinance` | Outer |
| **headylab.com** | HeadySystems Inc. | Research / Patents | Enterprise + Grants | `headylab` | Outer |
| **headyconnection.org** | HeadyConnection Inc. | Nonprofit Portal | Grants / Donations | `headyconnection` | Governance |
| **headyweb.com** | HeadySystems Inc. | Web / Frontend Hub | Ad-supported / Free | `headyweb` | Ops |

### Separation Rules

1. **IRS Compliance Boundary:** `headyconnection.org` MUST NOT serve any commercial SaaS feature, paywall, or revenue-generating endpoint. Any feature crossing this boundary requires a formal inter-entity service agreement.

2. **Auth Tenant Isolation:** Each domain maps to its own Firebase Auth tenant. Cross-tenant session sharing is forbidden. SSO across entity boundary (headyconnection.org ↔ headyme.com) requires an explicit OAuth 2.0 delegation flow with audit logging.

3. **Deployment Target:** All nine domains deploy to Cloudflare Pages (static/edge) backed by Cloud Run `us-east1` (legacy ADR-0016 / legacy ADR-0022). No domain deploys to `us-central1` or legacy `heady-prod-609590223909`.

4. **Revenue Attribution:** All billing, Stripe webhooks, and HeadyCoin ledger entries MUST tag the originating domain from this registry. Mixed-entity revenue records are an audit failure.

5. **PQC Key Isolation (legacy ADR-0021):** Each domain's service-to-service calls use domain-scoped ML-DSA signing keys. Key fingerprints are namespaced `{domain}:{serviceId}`.

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
  'headyfinance.com':    { entity: 'HeadySystems', category: 'fintech',    layer: 'Outer',      tenant: 'headyfinance',  commercial: true  },
  'headylab.com':        { entity: 'HeadySystems', category: 'research',   layer: 'Outer',      tenant: 'headylab',      commercial: true  },
  'headyconnection.org': { entity: 'HeadyConnection', category: 'nonprofit', layer: 'Governance', tenant: 'headyconnection', commercial: false },
  'headyweb.com':        { entity: 'HeadySystems', category: 'web',        layer: 'Ops',        tenant: 'headyweb',      commercial: true  },
};
```

## Consequences

### Positive

- IRS compliance: clear audit trail separating nonprofit and commercial operations.
- Firebase Auth tenant isolation prevents session leakage across entity boundary.
- CDN routing rules, feature flags, and billing attribution all derive from one file.
- Sacred Geometry topology (legacy ADR-0015) and domain architecture are co-located in the same conceptual model.
- Enables per-domain PQC key namespacing and sovereign compliance routing (heady-sovereign-mesh).

### Negative

- Nine Auth tenants increase Firebase configuration surface area.
- Inter-entity features require formal delegation flows, adding latency.
- ADR Sentinel must be updated whenever a new domain is considered — prevents organic experimentation.

### Neutral

- Legacy ADR-0019/ADR-0020 reserved placeholders were filled by this decision; the legacy INDEX.md gap was closed.

## Compliance

| Concern | Status |
|---|---|
| IRS 501(c)(3) commercial / nonprofit separation | Enforced by registry |
| Firebase Auth tenant isolation | Enforced by registry |
| Cloudflare deployment targeting | Enforced via ADR Sentinel |
| PQC key namespace isolation | Per legacy ADR-0021 (canonical ADR-0035) |

## Related ADRs

- Legacy ADR-0002: Canonical topology (Cloudflare + Cloud Run)
- Legacy ADR-0009: Firebase Auth + httpOnly cookies
- Legacy ADR-0015: Sacred Geometry node topology
- ADR-0035: Post-quantum cryptography mandate (legacy ADR-0021)
- ADR-0036: GCP region canonical lock (legacy ADR-0022)
- ADR-0038: Domain registry canonical file (legacy ADR-0024)
- ADR-0028: Cross-domain SSO partitioned cookie governance (canonical corpus)

## Reconciliation (2026-08-09 transfer)

- **The domain COUNT is registry-derived, not fixed.** "Nine" was the roster at acceptance time; the current mesh is an 11-domain site delivery mesh, and the machine-readable `domains:` block of `facts.yaml` (repo root, `/home/headyme/Heady-AI/facts.yaml`) is the source of truth for the current roster. See ADR-0038 for the registry decision, whose carrier moved from `src/config/domain-registry.js` to `facts.yaml`. The table above is preserved as the accepted 2026-06-17 snapshot, not as the live roster.
- **What this ADR carries forward as invariant:** the legal-entity split (HeadyConnection Inc. nonprofit vs HeadySystems Inc. C-Corp), the IRS boundary (headyconnection.org must never serve commercial endpoints), and per-domain auth tenant isolation.
- **The FinTech row was rewritten — `headytrade.com` → `headyfinance.com` (2026-08-22).** This is a
  deliberate, founder-authorized exception to the immutability rule in `docs/adr/README.md`, granted
  in **ADR-0054 §Decision** and bounded to this single token in this file and the frozen legacy
  `docs/ADR/0019` copy. The founder ruled that no surface may carry the retired brand, historical
  snapshots included. **The table and registry excerpt above therefore no longer match their
  accepted-time 2026-06-17 bytes** — that one delta is expected, and it is the only accepted record
  besides legacy 0019 that carries it. The succession — advisory product (risk + signal, paper-mode
  default, no execution, no custody), code `@heady/headyfinance`, tenant `headyfinance` — is
  recorded in ADR-0054; the founder reconciliation of 2026-07-29 that established the successor name
  is carried in `facts.yaml` `domains.headyfinance.note`.
- **Session layer:** canonical ADR-0028 (cross-domain SSO partitioned cookies) governs the session/cookie layer that sits on top of this entity split; the two are complementary — this ADR draws the entity boundary, ADR-0028 defines how sessions may lawfully cross it.

## Provenance

- **Source:** `/home/headyme/Heady-AI/docs/ADR/0019-nine-domain-brand-architecture.md` (legacy docs/ADR/0019)
- **Transferred:** 2026-08-09 into the canonical corpus as ADR-0033.
- The legacy file remains in place as a historical artifact; this canonical file is the operative record.
