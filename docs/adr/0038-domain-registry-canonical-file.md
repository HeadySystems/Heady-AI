# ADR-0038: src/config/domain-registry.js as Canonical Domain File

**Renumbered:** ADR-0024 → ADR-0038 (2026-08-04) — resolves the `docs/ADR/`↔`docs/adr/` numbering collision (audit F1, `docs/reports/sot-consistency-audit-2026-08-04.md`)  
**Status:** Accepted  
**Date:** 2026-06-17  
**Deciders:** Eric Haywood (HeadySystems Inc.)  
**Strength of Acceptance:** ⭐⭐⭐⭐⭐ (Critical — all CORS, Firebase Auth tenant resolution, PQC key namespacing, and IRS compliance checks derive from this single file)

---

## Context

ADR-0033 established the nine-domain brand architecture as policy. That ADR defines which domains belong to which legal entity, Sacred Geometry layer, Firebase Auth tenant, and revenue model. However, ADR-0033 did not mandate a specific file format or location for the machine-readable registry.

Without a canonical file, the policy leaks into multiple places:

- `heady-manager.js` hard-codes the CORS `ALLOWED_ORIGINS` env var (string split, wildcard fallback — P0 bug)
- Cloudflare Workers reference domain strings inline in routing rules
- Firebase Auth tenant IDs are referenced by string literals in multiple auth files
- CI/CD scripts that validate domain coverage have no authoritative reference to check against

The result is that domain configuration is scattered across at least 6 files, drift is undetectable by ADR Sentinel, and the IRS compliance boundary (headyconnection.org must never serve commercial features) is unenforced in code.

---

## Decision

The file `src/config/domain-registry.js` is the **single source of truth** for all domain-level configuration in the Heady monorepo. No file outside of this module may define, enumerate, or hard-code Heady domain names.

### File Contract

`src/config/domain-registry.js` MUST export:

| Export | Type | Purpose |
|---|---|---|
| `DOMAIN_REGISTRY` | `Record<string, DomainEntry>` | Full registry — all 9 domains |
| `Entity` | `frozen enum` | `HeadySystems` / `HeadyConnection` |
| `Layer` | `frozen enum` | Sacred Geometry layers |
| `Category` | `frozen enum` | Domain functional categories |
| `Revenue` | `frozen enum` | Revenue model types |
| `ALL_DOMAINS` | `string[]` | Ordered domain list |
| `ALLOWED_ORIGINS` | `string[]` | HTTPS origins for CORS |
| `ALLOWED_ORIGINS_SET` | `Set<string>` | O(1) CORS lookup |
| `NONPROFIT_DOMAINS` | `string[]` | IRS boundary enforcement |
| `COMMERCIAL_DOMAINS` | `string[]` | Billing attribution |
| `DOMAINS_BY_LAYER` | `Record<string, string[]>` | Sacred Geometry grouping |
| `DOMAINS_BY_ENTITY` | `Record<string, string[]>` | Entity grouping |
| `assertDomain(domain)` | `DomainEntry \| throws` | Guard utility |
| `isAllowedOrigin(origin)` | `boolean` | CORS check |
| `tenantForOrigin(origin)` | `string \| null` | Firebase tenant resolution |
| `pqcKeyNamespace(domain, serviceId)` | `string` | PQC key namespacing |

### DomainEntry Schema

```ts
interface DomainEntry {
  entity:      string;   // Entity enum
  category:    string;   // Category enum
  layer:       string;   // Layer enum
  tenant:      string;   // Firebase Auth tenant ID
  revenue:     string;   // Revenue enum
  commercial:  boolean;  // false = nonprofit (IRS boundary)
  description: string;   // Human-readable purpose
}
```

### Consumer Pattern

Every downstream consumer MUST import from `domain-registry.js`, never define its own list:

```js
// src/middleware/cors.js
import { ALLOWED_ORIGINS_SET, isAllowedOrigin } from '../config/domain-registry.js';

// src/middleware/auth.js
import { tenantForOrigin } from '../config/domain-registry.js';

// src/security/pqc.js
import { pqcKeyNamespace } from '../config/domain-registry.js';

// Cloudflare Worker (content-gateway)
// domains imported via module federation or Worker env var seeded from registry
```

### Registry Mutation Rules

1. **Adding a domain:** Requires a new ADR amending ADR-0033. The ADR must specify entity, layer, tenant, commercial flag, and revenue model. The ADR number becomes a comment in the registry entry.

2. **Removing a domain:** Requires a deprecation ADR. The domain stays in the registry with `deprecated: true` for one full release cycle before removal, to allow CDN cache invalidation.

3. **Changing commercial → true for headyconnection.org:** Prohibited without IRS counsel review. ADR Sentinel blocks any PR that sets `commercial: true` on a `.org` domain.

4. **No env var override:** `ALLOWED_ORIGINS` environment variable is deprecated. The registry replaces it. If `ALLOWED_ORIGINS` is still set in an environment, `src/middleware/cors.js` logs a warning and ignores it in favor of the registry.

### CI Enforcement (ADR Sentinel addition)

Add a `domain-registry-lint` job to `.github/workflows/adr-sentinel.yml`:

```yaml
domain-registry-lint:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: '22' }
    - name: Validate domain registry
      run: node scripts/validate-domain-registry.js
```

`scripts/validate-domain-registry.js` checks:
- All 9 canonical domains are present.
- No domain has `commercial: true` AND `.org` TLD.
- All `tenant` values are unique.
- All `layer` values are valid Layer enum members.
- `ALLOWED_ORIGINS_SET` size equals `ALL_DOMAINS` length.

---

## Consequences

### Positive
- Single source of truth eliminates domain string drift across 6+ files.
- CORS allowlist is automatically kept in sync with brand architecture changes.
- IRS compliance boundary (`commercial: false`) is machine-enforceable via CI.
- Firebase Auth tenant resolution is consistent everywhere — no more per-file tenant lookups.
- PQC key namespacing is deterministic from domain + serviceId — no manual key naming.
- AI coding assistants (Windsurf, Claude Code) have a single authoritative file to reference for any domain question.

### Negative
- Adding any new domain now requires both an ADR amendment and a code change in the registry file — intentionally raises the bar to prevent undocumented domain sprawl.
- Cloudflare Workers (edge-only, no Node.js module imports) must receive the ALLOWED_ORIGINS list via Wrangler environment variables seeded at build time from the registry — adds a build step.

### Neutral
- `ALLOWED_ORIGINS` env var is deprecated but not immediately removed. Migration path: set it to empty string to activate registry mode.

---

## Related ADRs

- ADR-0033: Nine-domain brand architecture (the policy this file implements)
- ADR-0009: Firebase Auth + httpOnly cookies (tenant ID resolution)
- ADR-0018: CI/CD GitHub Actions gates (domain-registry-lint job)
- ADR-0035: PQC mandate (key namespace derivation)
- ADR-0037: heady-manager.js decomposition (cors.js and auth.js consumers)
- ADR-0039: content-gateway Cloudflare Worker (CORS origins at edge)
