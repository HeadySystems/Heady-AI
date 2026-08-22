# ADR-0038: Canonical Machine-Readable Domain Registry File

- **Status:** Accepted (2026-06-17, legacy corpus docs/ADR) · Transferred to canonical corpus 2026-08-09
- **Deciders:** Eric Haywood (HeadySystems Inc.)
- **Strength of Acceptance:** Critical — all CORS, Firebase Auth tenant resolution, PQC key namespacing, and IRS compliance checks derive from this single file

## Context

ADR-0033 (legacy ADR-0019) established the nine-domain brand architecture as policy. That ADR defines which domains belong to which legal entity, Sacred Geometry layer, Firebase Auth tenant, and revenue model. However, it did not mandate a specific file format or location for the machine-readable registry.

Without a canonical file, the policy leaks into multiple places:

- `heady-manager.js` hard-codes the CORS `ALLOWED_ORIGINS` env var (string split, wildcard fallback — P0 bug)
- Cloudflare Workers reference domain strings inline in routing rules
- Firebase Auth tenant IDs are referenced by string literals in multiple auth files
- CI/CD scripts that validate domain coverage have no authoritative reference to check against

The result is that domain configuration is scattered across at least 6 files, drift is undetectable by ADR Sentinel, and the IRS compliance boundary (headyconnection.org must never serve commercial features) is unenforced in code.

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

1. **Adding a domain:** Requires a new ADR amending the brand architecture (ADR-0033). The ADR must specify entity, layer, tenant, commercial flag, and revenue model. The ADR number becomes a comment in the registry entry.

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

## Related ADRs

- ADR-0033: Nine-domain brand architecture (the policy this file implements)
- Legacy ADR-0009: Firebase Auth + httpOnly cookies (tenant ID resolution)
- Legacy ADR-0018: CI/CD GitHub Actions gates (domain-registry-lint job)
- ADR-0035: PQC mandate (key namespace derivation)
- ADR-0037: heady-manager.js decomposition (cors.js and auth.js consumers)
- ADR-0039: Content-gateway Cloudflare Worker (CORS origins at edge)

## Reconciliation (2026-08-09 transfer)

- **The invariant survives; the carrier moved.** What this ADR permanently establishes: there is exactly ONE machine-readable canonical domain file, and no other file may hard-code a Heady domain. In the legacy repo the carrier was `src/config/domain-registry.js`; in the rebuild the source of truth is the `domains:` block of `facts.yaml` at the repo root (`/home/headyme/Heady-AI/facts.yaml`, the golden record loaded and validated by `@heady/config`), with the site registry (`/home/headyme/Heady-AI/configs/_domains/site-registry.yaml`) driving projection logic per CLAUDE.md §V. The legacy file path is NOT operative in the rebuild.
- **Export contract maps conceptually, not literally.** The exports table above is the accepted contract of the legacy JS module. Its conceptual equivalents in the rebuild: the `domains:` entries in `facts.yaml` carry fqdn, role, status, sources, and verification state (the successor to `DOMAIN_REGISTRY`/`DomainEntry`); derived views (allowed origins, entity/commercial groupings, tenant resolution, PQC key namespacing) are computed from that block by consumers of `@heady/config` rather than exported from a bespoke JS file. The mutation rules (domain add/remove requires an ADR; the headyconnection.org commercial flag is IRS-counsel-gated; no env-var override of the canonical list) carry forward against the new carrier unchanged.
- **Roster is registry-derived.** "All 9 domains" reflects the accepted-time roster; the current mesh is an 11-domain site delivery mesh and the live roster is whatever `facts.yaml` `domains:` enumerates (see ADR-0033 Reconciliation). Validation logic must count against the registry, never against a hard-coded 9.
- **Carrier closure + machine enforcement (2026-08-22).** This ADR's core rule — "no other file may
  hard-code a Heady domain" — was aspirational until now: six files carried a roster. Five are legitimate
  projections and are now registered as CARRIERS with a `sources:` token in `facts.yaml`
  (`domain-registry` = `src/config/domain-registry.js`, `global-config` = `src/config/global.js` DOMAINS,
  `site-registry` = `configs/_domains/site-registry.yaml`, `domain-architecture` =
  `configs/domain-architecture.json`, `edge-router` = the `SITES` map in
  `configs/cloudflare-workers/heady-router-worker.js`). The sixth was an undeclared hardcoded array inside
  `tooling/data-consistency/src/domain-guard.mjs`, which flagged the verified admin surface `1ime1.com` as
  an "unauthorized hostname"; it now derives from the canon instead.
  - **The contract is ONE-DIRECTIONAL, deliberately.** A carrier may only name domains present in
    `facts.yaml domains:`; the canon having domains a carrier lacks is legal, because
    `src/config/domain-registry.js` is a *ratified subset* — a domain joins it when the founder ratifies
    its `entity`/`tenant`/`revenue`/`layer`, which is a business decision and not something a code gate
    may invent. Inverting the direction would fire on every unratified domain and the gate would be
    weakened away.
  - **Enforced by** `tooling/coherence/src/domain-guards.mjs` (pure semantics + 22 unit tests; the kernel
    owns the IO, mirroring `scalar-guards.mjs`): D1 carrier orphan · D2/D3 `sources:` accuracy in both
    directions · D4 sourceless node · D5 `status` agreement between the canon and the brand registry ·
    D6 staleness of the generated projection. `sources:` is therefore checked, not decorative.
  - **Consumers derive, never list.** `configs/_generated/domain-roster.json` (written by
    `node tooling/coherence/src/coherence.mjs domains`, timestamp-free so it is byte-comparable) is the
    projection that consumers read: the Battle Arena rebuild spec and the domain-guard allowlist both do.
  - **Closure added two records:** `headybot.com` and `headylens.com` were carried by the routing map and
    the live edge router while absent from the canon. Canon is now **16 nodes** — a count of *records*,
    not of delivered sites; the "11-domain site delivery mesh" language elsewhere describes delivery and
    is a different measure. `headylens.com` the DOMAIN (vision/OCR per the edge brand copy) is NOT
    `@heady/headylens` the PACKAGE (observability event stream) — a name collision, recorded as such.
- **Enforcement point:** the `domain-registry-lint` ADR Sentinel job was legacy-repo CI; the rebuild's equivalent gates are the governance gate (`tooling/governance-gate`) and the derive/consistency loop that keeps managed regions consistent with `facts.yaml`.

## Provenance

- **Source:** `/home/headyme/Heady-AI/docs/ADR/0024-domain-registry-canonical-file.md` (legacy docs/ADR/0024, titled "src/config/domain-registry.js as Canonical Domain File")
- **Transferred:** 2026-08-09 into the canonical corpus as ADR-0038. The title is generalized because the carrier file moved (see Reconciliation); the decision body preserves the original file contract verbatim.
- The legacy file remains in place as a historical artifact; this canonical file is the operative record.
