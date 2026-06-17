# ADR-0023: heady-manager.js Decomposition Mandate

**Status:** Accepted  
**Date:** 2026-06-17  
**Deciders:** Eric Haywood (HeadySystems Inc.)  
**Strength of Acceptance:** ⭐⭐⭐⭐⭐ (Critical — 76KB monolith is an active security risk and test-coverage blocker; decomposition is prerequisite for ADR-0018 CI gates)

---

## Context

`heady-manager.js` is a ~76KB monolithic file that currently handles authentication middleware, CORS policy, route orchestration, service health checks, and token validation in a single module. Two **P0 security vulnerabilities** have been identified in this file:

| Location | Severity | Issue |
|---|---|---|
| `heady-manager.js:223` | P0 | String equality token comparison — vulnerable to timing attacks |
| `heady-manager.js:142` | P0 | CORS wildcard `*` — allows any origin to make credentialed requests |

Beyond the security issues, the monolith creates compounding problems:

1. **Test coverage:** A 76KB file with mixed concerns cannot be unit-tested in isolation. The `adr-gate` CI job (ADR-0018) requires module-level test coverage — impossible without decomposition.

2. **CJS runtime:** `heady-manager.js` uses CommonJS `require()` throughout, violating ADR-0011 (Node.js ESM only). Because it touches auth, CORS, routing, and health simultaneously, it cannot be incrementally migrated — it must be decomposed first.

3. **Context window burden:** AI coding assistants (Windsurf, Claude Code) loading the file consume ~19K tokens of context window for a single module, reducing quality on all subsequent operations in the same session.

4. **Sacred Geometry violation:** ADR-0015 assigns distinct responsibilities to distinct topology layers. A monolith that spans auth (Governance), routing (Center), and health (Ops) simultaneously breaks the single-responsibility principle of the ring topology.

5. **Phi-math violations:** `heady-manager.js` contains hardcoded magic number constants (timeouts, retry counts, rate limits) that should live in `core/constants/phi.js` per ADR-0006.

---

## Decision

Decompose `heady-manager.js` into five purpose-built ESM modules, each covering exactly one Sacred Geometry layer responsibility. The decomposition MUST be completed before any `heady-manager.js` change is merged to the `rebuild` branch after this ADR is accepted.

### Target Module Map

| New Module | Path | Responsibility | Layer |
|---|---|---|---|
| `auth-middleware` | `src/middleware/auth.js` | Token validation, timing-safe comparison, session checks | Governance |
| `cors-policy` | `src/middleware/cors.js` | Origin allowlist, preflight handling, credential policy | Governance |
| `route-orchestrator` | `src/routes/orchestrator.js` | Route mounting, request routing, middleware chain | Center |
| `health-monitor` | `src/monitoring/health.js` | Health endpoints, liveness/readiness probes, status aggregation | Ops |
| `manager-core` | `src/core/manager.js` | Service initialization, startup sequence, graceful shutdown hooks | Inner |

### P0 Security Fixes (Required in Phase 1)

These MUST be resolved in the first decomposition PR, targeting `auth-middleware`:

**heady-manager.js:223 — Timing-safe comparison:**
```js
// BEFORE (vulnerable):
if (token === expectedToken) { ... }

// AFTER (secure):
import crypto from 'node:crypto';
const tokenBuf    = Buffer.from(token);
const expectedBuf = Buffer.from(expectedToken);
if (tokenBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(tokenBuf, expectedBuf)) { ... }
```

**heady-manager.js:142 — CORS origin allowlist:**
```js
// BEFORE (wildcard — forbidden):
res.setHeader('Access-Control-Allow-Origin', '*');

// AFTER (allowlisted origins from domain registry):
import { DOMAIN_REGISTRY } from '../config/domain-registry.js';  // ADR-0019
const ALLOWED_ORIGINS = new Set(Object.keys(DOMAIN_REGISTRY).map(d => `https://${d}`));

const origin = req.headers.origin ?? '';
if (ALLOWED_ORIGINS.has(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
} else {
  // Reject with 403, log attempted origin
  return res.status(403).json({ ok: false, error: 'Origin not allowed' });
}
```

### Decomposition Phases

**Phase 1 — Security (P0, immediate):**
- Extract `auth-middleware` with `crypto.timingSafeEqual` fix.
- Extract `cors-policy` with origin allowlist from `DOMAIN_REGISTRY` (ADR-0019).
- Ship as single PR with full unit tests (timing attack test, CORS bypass test).

**Phase 2 — Routing (within 2 sprints):**
- Extract `route-orchestrator`.
- Remove route logic from `heady-manager.js`.

**Phase 3 — Health & Core (within 3 sprints):**
- Extract `health-monitor`.
- Extract `manager-core` initialization.
- Delete `heady-manager.js` when all references are migrated.

### ESM Compliance

Each new module MUST:
- Use `import`/`export` exclusively — no `require()`.
- Export named exports only — no `module.exports`.
- Pass the ADR Sentinel `esm-check` job (`.github/workflows/adr-sentinel.yml`).

### phi-math Compliance

All numeric constants extracted from `heady-manager.js` MUST be relocated to `core/constants/phi.js` per ADR-0006. Examples:

```js
// core/constants/phi.js (additions)
export const AUTH_TOKEN_TIMEOUT_MS     = PHI ** 8  * 1000;  // ≈ 46.9s
export const HEALTH_CHECK_INTERVAL_MS  = PHI ** 7  * 1000;  // ≈ 29.0s
export const CORS_MAX_AGE_SEC          = FIB[13];            // 233 seconds
```

---

## Consequences

### Positive
- P0 security vulnerabilities eliminated in Phase 1 — no waiting on full decomposition.
- Each module can be independently unit-tested — unblocks ADR-0018 CI coverage gates.
- ADR-0011 ESM compliance achievable per-module rather than requiring a single risky rewrite.
- AI coding assistants can load a single 5–10KB module instead of 76KB — 10× context efficiency gain.
- Sacred Geometry layer purity restored: auth/governance, routing/center, health/ops are separate.
- Magic number constants consolidate to `core/constants/phi.js` (ADR-0006 compliance).

### Negative
- Phase 1 PR touches auth middleware — requires thorough review and staging validation before `rebuild` merge.
- Import paths across the codebase referencing `heady-manager.js` require automated refactor (approximately 40–60 import sites estimated).
- Decomposition must maintain backward-compatible exports during transition period to avoid breaking dependent services.

### Neutral
- `heady-manager.js` is retained as a re-export shim during Phase 2 and Phase 3 to avoid big-bang breakage:
  ```js
  // heady-manager.js — TRANSITIONAL SHIM — DELETE after Phase 3
  export { authMiddleware } from './middleware/auth.js';
  export { corsPolicy }     from './middleware/cors.js';
  // ... etc
  ```

---

## Tracking

| Phase | Target Branch | PR Label | Blocking |
|---|---|---|---|
| Phase 1 (P0 security) | `rebuild` | `security/p0` | Yes — merge before any new auth changes |
| Phase 2 (routing) | `rebuild` | `refactor/routing` | Blocks ADR-0018 coverage gate |
| Phase 3 (health + delete) | `rebuild` | `refactor/cleanup` | Blocks `heady-manager.js` deletion milestone |

---

## Related ADRs

- ADR-0006: phi-math single source of truth (constant extraction)
- ADR-0009: Firebase Auth mandate (auth-middleware compliance)
- ADR-0011: Node.js ESM only (CJS elimination)
- ADR-0015: Sacred Geometry node topology (layer separation)
- ADR-0018: CI/CD GitHub Actions gates (test coverage requirement)
- ADR-0019: Nine-domain brand architecture (CORS allowlist source)
- ADR-0021: PQC mandate (timing-safe operations)
