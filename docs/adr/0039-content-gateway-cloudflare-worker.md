# ADR-0039: Content-Gateway Cloudflare Worker Contract

**Renumbered:** ADR-0025 → ADR-0039 (2026-08-04) — resolves the `docs/ADR/`↔`docs/adr/` numbering collision (audit F1, `docs/reports/sot-consistency-audit-2026-08-04.md`)  
**Status:** Accepted  
**Date:** 2026-06-17  
**Deciders:** Eric Haywood (HeadySystems Inc.)  
**Strength of Acceptance:** ⭐⭐⭐⭐ (High — required for Drupal JSON:API delivery pipeline; blocked on ADR-0034 Drupal deployment)

---

## Context

ADR-0034 establishes Drupal 11 as the headless CMS for `headyconnection.org` and `headylab.com` documentation. Drupal runs on Cloud Run `us-east1` and exposes content via JSON:API. The problem: Drupal's origin (`headless-cms.headyconnection.org`) cannot be directly called from browser clients due to CORS, auth complexity, and cache-busting requirements. A purpose-built Cloudflare Worker is needed as the adapter layer.

This Worker — the **content-gateway** — sits between frontend micro-frontends and the Drupal origin, providing:

1. **Edge caching** via Cloudflare KV (phi-scaled TTLs per ADR-0034)
2. **CORS normalization** using DOMAIN_REGISTRY (ADR-0038)
3. **Cache invalidation** on Drupal publish webhook
4. **Request authentication** — proxy adds Drupal API token from Workers Secrets, clients never see it
5. **Content-type routing** — maps URL patterns to Drupal JSON:API resource paths
6. **Rate limiting** per ADR-0038 (Fibonacci tiers: anonymous 8 req/s, authenticated 21 req/s)
7. **PQC request signing** — Worker signs every origin request with ML-DSA-65 service key (ADR-0035)

---

## Decision

Deploy a Cloudflare Worker named `content-gateway` at the route pattern `headyconnection.org/api/content/*` and `headylab.com/api/content/*`. This Worker is the **only** component permitted to call the Drupal JSON:API origin directly.

### Worker Contract

#### Route Patterns

| Route | Drupal Resource | Cache Tier | TTL |
|---|---|---|---|
| `/api/content/grants` | `/jsonapi/node/grant_program` | Hot | 89s |
| `/api/content/events` | `/jsonapi/node/event` | Hot | 89s |
| `/api/content/blog` | `/jsonapi/node/blog_post` | Warm | 233s |
| `/api/content/team` | `/jsonapi/node/team_profile` | Warm | 233s |
| `/api/content/legal/:slug` | `/jsonapi/node/legal_page` | Cold | 610s |
| `/api/content/research` | `/jsonapi/node/research_note` | Cold | 610s |
| `POST /api/webhooks/drupal-publish` | Cache invalidation trigger | — | — |

#### Response Shape

Content-gateway normalizes Drupal's HATEOAS JSON:API envelope to a simpler shape for frontend consumption:

```json
{
  "ok": true,
  "type": "grant_program",
  "data": [...],
  "meta": {
    "total":     21,
    "cached":    true,
    "cachedAt":  "2026-06-17T21:00:00Z",
    "ttl":       89,
    "source":    "kv"
  }
}
```

#### Cache Architecture

```
Browser / Micro-Frontend
    │
    ▼
Cloudflare Worker: content-gateway
    │
    ├── HIT → KV cache (L1, phi TTL)
    │         return cached + meta.source='kv'
    │
    └── MISS → Drupal JSON:API (Cloud Run us-east1)
              │  PQC-signed request (ADR-0035)
              │  Authorization: Bearer {DRUPAL_API_TOKEN}
              ▼
              Store in KV → return + meta.source='origin'
```

#### KV Key Schema

```
content:{contentType}:{hash(queryParams)}
```

Example: `content:grant_program:a3f9bc12`

KV metadata stores: `cachedAt`, `ttl`, `drupalRevisionId` (for precise invalidation).

#### Cache Invalidation Webhook

Drupal fires `POST /api/webhooks/drupal-publish` on every content publish. The Worker:

1. Verifies HMAC-SHA3-256 signature against `DRUPAL_WEBHOOK_SECRET` (Workers Secret).
2. Extracts `contentType` and `nid` from the payload.
3. Deletes all KV keys matching `content:{contentType}:*` (prefix scan).
4. Pre-warms hot-tier content: fetches grants + events immediately.
5. Emits `content.invalidated` to Upstash Redis EventSpine (ADR-0013).

```js
// Webhook payload shape from Drupal
{
  "event":       "node.published",
  "contentType": "grant_program",
  "nid":         42,
  "langcode":    "en",
  "timestamp":   1750200000
}
```

### Worker Implementation Skeleton

```js
// workers/content-gateway/index.js
// Deploy via: wrangler deploy --env production

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Webhook handler
    if (request.method === 'POST' && url.pathname === '/api/webhooks/drupal-publish') {
      return handleWebhook(request, env);
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return handlePreflight(request, env);
    }

    return handleContentRequest(request, env, url);
  }
};

async function handleContentRequest(request, env, url) {
  const origin      = request.headers.get('Origin') ?? '';
  const allowed     = env.ALLOWED_ORIGINS.split(','); // seeded from DOMAIN_REGISTRY at build
  const isAllowed   = allowed.includes(origin);

  if (origin && !isAllowed) {
    return Response.json({ ok: false, error: 'CORS_ORIGIN_REJECTED' }, { status: 403 });
  }

  const contentType = resolveContentType(url.pathname);
  if (!contentType) return Response.json({ ok: false, error: 'UNKNOWN_ROUTE' }, { status: 404 });

  const cacheKey    = `content:${contentType}:${hashParams(url.searchParams)}`;
  const cached      = await env.CONTENT_KV.getWithMetadata(cacheKey, 'json');

  if (cached.value) {
    return corsResponse(origin, isAllowed, {
      ok: true, type: contentType, data: cached.value,
      meta: { cached: true, cachedAt: cached.metadata?.cachedAt, source: 'kv' }
    });
  }

  // Origin fetch — PQC signed (ADR-0035)
  const drupalUrl   = buildDrupalUrl(contentType, url.searchParams, env);
  const drupalResp  = await fetch(drupalUrl, {
    headers: {
      'Authorization': `Bearer ${env.DRUPAL_API_TOKEN}`,
      'X-Heady-PQC-Sig': await signRequest(drupalUrl, env),
      'Accept': 'application/vnd.api+json',
    }
  });

  if (!drupalResp.ok) {
    return Response.json({ ok: false, error: 'DRUPAL_ORIGIN_ERROR', status: drupalResp.status }, { status: 502 });
  }

  const payload    = await drupalResp.json();
  const normalized = normalizeDrupalResponse(payload, contentType);
  const ttl        = TTL_BY_TIER[contentTier(contentType)];

  await env.CONTENT_KV.put(cacheKey, JSON.stringify(normalized), {
    expirationTtl: ttl,
    metadata:      { cachedAt: new Date().toISOString(), ttl, drupalRevisionId: payload.meta?.revisionId }
  });

  return corsResponse(origin, isAllowed, {
    ok: true, type: contentType, data: normalized,
    meta: { cached: false, source: 'origin', ttl }
  });
}
```

### Workers Secrets Required

| Secret Name | Purpose |
|---|---|
| `DRUPAL_API_TOKEN` | Bearer token for Drupal JSON:API auth |
| `DRUPAL_WEBHOOK_SECRET` | HMAC secret for publish webhook verification |
| `PQC_SERVICE_KEY` | ML-DSA-65 private key for request signing |
| `UPSTASH_REDIS_URL` | EventSpine connection for invalidation events |
| `UPSTASH_REDIS_TOKEN` | EventSpine auth token |

Set via: `wrangler secret put DRUPAL_API_TOKEN --env production`

### phi-Scaled TTL Constants

```js
// ADR-0006: phi-scaled — no magic numbers
const PHI = 1.618033988749895;
const FIB = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610];

const TTL_BY_TIER = {
  hot:  FIB[11],  // 89s  — grants, events (high-traffic, time-sensitive)
  warm: FIB[13],  // 233s — blog, team (moderate traffic)
  cold: FIB[15],  // 610s — legal, archives (low traffic, rarely changes)
};
```

---

## Consequences

### Positive
- Drupal origin is fully protected behind the Worker — never directly accessible from browsers.
- `DRUPAL_API_TOKEN` stays in Workers Secrets — never exposed to clients.
- Cloudflare KV edge cache absorbs >90% of content requests, eliminating Cloud Run origin load for public content.
- PQC-signed origin requests satisfy ADR-0035 service-to-service requirement.
- Cache invalidation is precise (per content type) and event-driven via Upstash.
- Rate limiting at Fibonacci tiers prevents DDoS amplification against Drupal.

### Negative
- Worker adds one more deployment unit to manage (separate `wrangler.toml`).
- KV prefix scans for cache invalidation are eventually consistent — brief stale windows possible under high publish frequency.
- Drupal JSON:API field selection must be coordinated with the Worker's `normalizeDrupalResponse()` — schema changes require Worker update.

### Neutral
- `headyconnection.org` and `headylab.com` are the only consumers of this Worker at launch. `headyweb.com` marketing content may be added in a follow-up ADR.

---

## Related ADRs

- ADR-0002: Cloudflare edge + Cloud Run origin (Worker is the edge adapter)
- ADR-0013: Upstash Redis EventSpine (invalidation events)
- ADR-0033: Nine-domain brand architecture (served domains)
- ADR-0034: Drupal 11 headless CMS (origin being proxied)
- ADR-0035: PQC mandate (request signing)
- ADR-0038: Domain registry canonical file (CORS origins)
