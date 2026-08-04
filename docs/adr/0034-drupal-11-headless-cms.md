# ADR-0034: Drupal 11 as Headless CMS

**Renumbered:** ADR-0020 → ADR-0034 (2026-08-04) — resolves the `docs/ADR/`↔`docs/adr/` numbering collision (audit F1, `docs/reports/sot-consistency-audit-2026-08-04.md`)  
**Status:** Accepted  
**Date:** 2026-06-17  
**Deciders:** Eric Haywood (HeadySystems Inc.)  
**Strength of Acceptance:** ⭐⭐⭐⭐ (Strong — governs content layer for headyconnection.org and documentation hubs; less critical for pure SaaS domains)

---

## Context

HeadyConnection Inc.'s public portal (`headyconnection.org`) and several HeadySystems documentation hubs require structured content management: grant program pages, educational resources, community event calendars, blog/research posts, and legal/compliance pages. These surfaces need:

- Non-developer editorial workflows (grant writers, community managers, nonprofit staff).
- Structured content types with field-level access control (per IRS nonprofit transparency requirements).
- API-first delivery so that Heady's Cloudflare edge layer can render content without CORS-crossing server requests.
- Grandfathered Drupal expertise within the HeadySystems team.

Alternatives evaluated:

| CMS | Verdict | Reason Rejected |
|---|---|---|
| WordPress | Rejected | PHP, poor API ergonomics, high CVE surface |
| Contentful | Rejected | SaaS lock-in, cost at scale, no self-host option for PII compliance |
| Sanity | Rejected | JavaScript-native but proprietary schema store |
| Strapi | Considered | Node.js native, but immature for complex content hierarchies |
| Ghost | Rejected | Blog-only, lacks structured content types |
| **Drupal 11** | **Selected** | API-first (JSON:API + GraphQL), mature RBAC, self-hosted, team expertise |

Drupal 11 (released 2024) ships with:
- Native **JSON:API** module (decoupled content delivery with HATEOAS links).
- **GraphQL 4.x** module for query-specific field selection.
- **Decoupled Router** module for frontend path resolution.
- Built-in **content moderation workflows** for editorial approval chains.
- **OpenID Connect** module for Firebase Auth SSO integration (ADR-0009).

---

## Decision

Adopt **Drupal 11** as the headless CMS for all content-managed surfaces within the Heady ecosystem. Drupal operates in **fully decoupled (headless) mode**: it serves zero frontend HTML. All content is consumed by Cloudflare edge workers via JSON:API or GraphQL, cached at edge (Cloudflare KV, TTL=233s per phi-scaled tier), and rendered by the appropriate Heady micro-frontend (ADR per heady-microfrontend-portal).

### Deployment Architecture

```
Editorial Staff
    │
    ▼
Drupal 11 Admin UI (headless-cms.headyconnection.org)
    │  JSON:API / GraphQL
    ▼
Cloudflare Worker (content-gateway)
    │  KV Cache (TTL=233s warm, 89s hot)
    ▼
Heady Micro-Frontend (headyconnection.org, headylab.com docs)
```

### Configuration Mandates

1. **Decoupled only:** No Drupal theme renders HTML for end users. The default Bartik/Olivero theme is disabled. Only the Drupal admin UI (restricted IP) is served server-rendered.

2. **JSON:API as primary:** JSON:API is the canonical content delivery protocol. GraphQL is available for complex nested queries but MUST NOT be publicly exposed without authentication.

3. **Auth integration:** Drupal user accounts are provisioned via Firebase Auth OIDC (ADR-0009). No Drupal-native password auth for editorial accounts — all login via `/user/login/openid-connect/firebase`.

4. **Content moderation:** All public-facing content types (grant pages, blog posts, event listings) require at least one Editorial Review workflow state before publication. Direct `Published` transitions without review are disabled.

5. **Infrastructure:** Drupal 11 deploys on Cloud Run `us-east1` (ADR-0016, ADR-0036) backed by Neon Postgres (ADR-0016). File assets (images, PDFs) go to Cloudflare R2 via the S3-compatible adapter.

6. **ESM boundary:** Drupal is PHP-based and runs outside the Node.js ESM boundary (ADR-0011). The content-gateway Cloudflare Worker (Node.js ESM) is the adapter layer. No PHP code is permitted inside `src/` of the heady-ai monorepo.

7. **phi-scaled cache TTLs:** Cloudflare KV content cache follows phi-tier TTLs: hot content (home, grants) 89s; warm content (blog, events) 233s; cold content (archives) 610s.

8. **Security:** Drupal admin UI endpoint is IP-allowlisted to HeadyVPN / Tailscale mesh. Public JSON:API endpoints enforce rate limiting via Cloudflare WAF (Fibonacci limits: anonymous 8 req/s, authenticated 21 req/s).

### Content Types

| Type | Entity | Access | Notes |
|---|---|---|---|
| `grant_program` | HeadyConnection | Public read | Requires Editorial Review |
| `blog_post` | Both | Public read | Commercial posts served from headyme.com domain |
| `event` | HeadyConnection | Public read | Community calendar |
| `legal_page` | Both | Public read | Privacy policy, ToS — legal team edit only |
| `research_note` | HeadySystems | Authenticated read | headylab.com |
| `team_profile` | Both | Public read | About pages |

---

## Consequences

### Positive
- Non-developer staff can manage content without engineering support.
- JSON:API provides typed, versioned content contracts compatible with Cloudflare Workers.
- Drupal's RBAC satisfies nonprofit transparency and IRS documentation requirements.
- Self-hosted on Cloud Run (not SaaS CMS) maintains data sovereignty — all content stays in Neon Postgres.
- Firebase Auth SSO means editorial staff use the same identity as platform users.
- Cloudflare KV edge caching eliminates CMS origin load for public traffic.

### Negative
- PHP runtime adds an additional technology to the stack alongside Node.js ESM.
- Drupal updates (security patches) require a separate CI pipeline distinct from the Node.js monorepo.
- Neon Postgres branch testing (used for Node.js migrations) is PHP-incompatible — Drupal migrations use `drush deploy` with a separate branch workflow.
- Content-gateway Worker is a synchronization point: Cloudflare KV cache invalidation must be triggered on content publish webhooks.

### Neutral
- Drupal operates entirely outside the heady-ai monorepo `src/` boundary — it is a peer service, not a module.
- ADR-0011 ESM mandate does not apply to Drupal PHP code.

---

## Cache Invalidation Strategy

On Drupal content publish webhook (`POST /webhook/content-update`):
1. Content-gateway Worker receives webhook (verified by HMAC-SHA3-256 shared secret).
2. Purges affected Cloudflare KV keys.
3. Pre-warms hot content tier (home page, active grant pages).
4. Emits `content.updated` event to Upstash Redis EventSpine (ADR-0013).

---

## Related ADRs

- ADR-0009: Firebase Auth + httpOnly cookies (OIDC integration)
- ADR-0013: Upstash Redis as EventSpine (publish webhooks)
- ADR-0016: Neon replaces Cloud SQL (Drupal DB backend)
- ADR-0033: Nine-domain brand architecture (headyconnection.org, headylab.com)
- ADR-0036: GCP region canonical lock (Cloud Run us-east1)
