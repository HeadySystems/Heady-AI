# Heady Onboarding Codebase — Full Audit Report

**Date**: 2026-03-16
**Auditor**: Computer
**Scope**: All 19 files in `onboarding-build/` (7,019 lines)

---

## Critical Gaps Fixed in v3

### 1. DEAD CODE: auth-handler.js (634 lines)
- **Issue**: Complete `AuthHandler` class never imported or used anywhere. `onboarding.js` has its own complete auth implementation.
- **Fix**: **DELETED**. All auth logic consolidated into `onboarding.js`.

### 2. API ENDPOINT MISMATCH (requests would 404)
- **Issue**: `onboarding.js` posts to `${API_BASE}/auth/exchange` but auth-routes.js serves `/auth/callback`. The server mounts auth at `/auth` and onboarding at `/api/onboarding` — so `POST /api/onboarding/auth/exchange` does not exist.
- **Fix**: Client now posts to `/auth/callback` (the actual server endpoint).

### 3. SCHEMA MISMATCHES — 4 endpoints would fail Zod validation

#### 3a. `configure-email`
- **Client sent**: `{ choice, forwardEmail }`
- **Schema expected**: `{ contactEmail, provisionHeadyEmail, headyEmailPrefix? }`
- **Fix**: Client now sends schema-compliant payload. Schema also updated to accept both patterns with a discriminated union.

#### 3b. `set-permissions`
- **Client sent**: `{ mode, deviceName }`
- **Schema expected**: `{ mode, analyticsOptIn, buddyBrowsingAccess, buddyCodeExecution, buddyToolAccess, dataRegion, deviceName? }`
- **Fix**: Frontend now collects all required fields (added toggle switches for permissions). Schema defaults applied for optional fields.

#### 3c. `configure-buddy`
- **Client sent**: `{ preferredName, archetype, interfaces, aiKeys }`
- **Schema expected**: `{ archetype, buddyName, tone, domains[] }`
- **Fix**: Client now maps `preferredName` → `buddyName`, adds `tone` and `domains` fields. Schema also accepts `interfaces` and `aiKeys`.

#### 3d. `auth/callback` — missing `provider` field
- **Client sent**: `{ idToken }` (no provider)
- **Schema expected**: `{ idToken, provider }`
- **Fix**: Client now sends `provider` field from the signin context.

### 4. check-username: Query Param vs Path Param
- **Client**: `GET /check-username?username=foo`
- **Server**: `GET /check-username/:username`
- **Fix**: Server now accepts both patterns (query param as primary, path param as fallback).

### 5. Auth Exchange Response Mismatch
- **Client expected**: `{ sessionId, sessionToken }`
- **Server returned**: `{ ok: true, data: { uid, sessionToken } }` (envelope wrapper, no `sessionId`)
- **Fix**: Client now correctly unwraps the `{ ok, data }` envelope and reads `data.sessionToken`.

### 6. Firebase Config Placeholder
- **Issue**: `apiKey: 'AIzaSyHeadyMe_PLACEHOLDER'` hardcoded
- **Fix**: Config is now read from `window.__HEADY_FIREBASE_CONFIG` (injected by Drupal) with fallback to placeholder for dev mode only.

### 7. API Key Format Mismatch
- **Issue**: Client generates `hm_live_*`, server generates `HY-{uuid}`
- **Fix**: Client mock key now uses `HY-{uuid}` format.

### 8. CORS Origin Mismatch (Worker vs Server)
- **Worker**: `mail.headyme.com`
- **Server**: `mail.heady.dev`
- **Fix**: Both now share the exact same 11-domain list.

### 9. Dockerfile PORT
- **Issue**: `ENV PORT=3000` but Cloud Run expects `8080`
- **Fix**: Changed to `ENV PORT=8080`.

### 10. Server Index Missing Password in CreateIdentityBodySchema
- **Issue**: Client sends `password` field but schema doesn't accept it
- **Fix**: Schema now accepts optional `password` field.

### 11. create-identity Returns Fake headyEmail
- **Issue**: Route returns `headyEmail: ${username}@headyme.com` even though identity record has null headyEmail
- **Fix**: Returns actual identity.headyEmail (null until email stage configures it).

### 12. No JWT_SECRET in SETUP.md
- **Fix**: Added to environment variable table.

### 13. ML-DSA-65 is Fake
- **Acknowledged**: This is intentionally placeholder. Added a clear `// TODO: Replace with real ML-DSA-65 (FIPS 204) implementation` comment.

### 14. Placeholder Values in wrangler.toml
- **Fix**: Added clear `TODO` markers and documentation for each value that must be replaced.

### 15. Firebase Double-Init Risk
- **Issue**: Both auth-handler.js and onboarding.js called `firebase.initializeApp()` — would crash.
- **Fix**: auth-handler.js deleted. Single init in onboarding.js.

### 16. Password Min Length Inconsistency
- **Issue**: auth-handler.js=6, onboarding.js=8, HTML=8
- **Fix**: All standardized to 8.

---

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `frontend/js/auth-handler.js` | **DELETED** | -634 |
| `frontend/js/onboarding.js` | Rewritten | ~980 |
| `frontend/onboarding.html` | Updated permissions stage | ~480 |
| `frontend/js/buddy-setup.js` | Updated state mapping | ~400 |
| `server/schemas/onboarding-schemas.js` | Fixed all schemas | ~250 |
| `server/routes/onboarding-routes.js` | Fixed route + response contracts | ~440 |
| `server/routes/auth-routes.js` | Minor response alignment | ~160 |
| `server/index.js` | Fixed CORS list, PORT | ~210 |
| `server/services/identity-service.js` | Added password acceptance | ~180 |
| `worker/auth-gateway.js` | Fixed CORS origins | ~340 |
| `worker/wrangler.toml` | Fixed placeholders | ~70 |
| `Dockerfile` | Fixed PORT to 8080 | ~40 |
| `SETUP.md` | Added JWT_SECRET, fixed docs | ~750 |
| `ARCHITECTURE.md` | Updated with contract docs | ~200 |

---

## Verification Checklist

- [ ] `npm ci` in `server/` installs cleanly
- [ ] `node index.js` starts without error
- [ ] Firebase config injected by Drupal or env
- [ ] All 6 onboarding stages complete without 400 errors
- [ ] Auth callback sends `provider` field
- [ ] Email stage sends `contactEmail` + `provisionHeadyEmail`
- [ ] Permissions stage sends all required boolean fields
- [ ] Buddy stage sends `buddyName`, `tone`, `domains`
- [ ] API key displayed in `HY-{uuid}` format
- [ ] CORS allows all 11 Heady domains
- [ ] Cloud Run listens on port 8080
