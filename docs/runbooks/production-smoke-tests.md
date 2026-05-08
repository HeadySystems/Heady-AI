# Production Smoke Tests
**Ticket:** HEA-238  
**Project:** gen-lang-client-0920560496  
**Region:** us-east1  
**GitHub Org:** HeadyMe / heady-production  
**Last Updated:** 2026-04-04  

---

## Overview

This runbook defines the minimum set of smoke tests that must pass before a production deployment is declared successful and before any rollback can be declared resolved. Tests are grouped by subsystem. They are designed to be run in order — infrastructure tests first, then application-layer tests, then cross-cutting verification.

**Target execution time:** < 15 minutes for full suite  
**Tools required:** `curl`, `jq`, `psql`, `redis-cli` (or Upstash REST API), `wrangler` (for log tailing)

---

## Environment Variables (Pre-Test Setup)

Export these before running any test commands in this runbook:

```bash
export PROJECT_ID="gen-lang-client-0920560496"
export REGION="us-east1"
export DATABASE_URL="<neon-production-connection-string>"   # pooler endpoint
export REDIS_URL="<upstash-redis-url>"                     # rediss:// URL
export FIREBASE_PROJECT_ID="<firebase-production-project>"

# Service base URLs — fill in per deployment
export API_URL="https://<api-service>.run.app"
export APP_URL="https://headyme.com"

# Populate with all 9 domains
DOMAINS=(
  "headyme.com"
  "headyai.com"
  # ... add remaining 7 domains
)
```

---

## Suite 1 — Health Endpoint Checks

### ST-1.1 Cloud Run `/health` — HTTP Status

For each Cloud Run service, the `/health` endpoint must return HTTP 200.

```bash
for SERVICE_URL in $API_URL; do
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$SERVICE_URL/health")
  if [ "$STATUS" = "200" ]; then
    echo "PASS  $SERVICE_URL/health → HTTP $STATUS"
  else
    echo "FAIL  $SERVICE_URL/health → HTTP $STATUS"
  fi
done
```

**Pass criteria:** HTTP 200 for every service.

- [ ] ST-1.1 PASS

---

### ST-1.2 Cloud Run `/health` — Coherence Score

The response body must contain a `coherence_score` field with a value of **>= 0.809**.

```bash
for SERVICE_URL in $API_URL; do
  RESPONSE=$(curl -sf "$SERVICE_URL/health")
  SCORE=$(echo "$RESPONSE" | jq -r '.coherence_score // empty')
  
  if [ -z "$SCORE" ]; then
    echo "FAIL  $SERVICE_URL/health — coherence_score field missing"
  elif (( $(echo "$SCORE >= 0.809" | bc -l) )); then
    echo "PASS  $SERVICE_URL/health — coherence_score: $SCORE"
  else
    echo "FAIL  $SERVICE_URL/health — coherence_score $SCORE is below 0.809"
  fi
done
```

**Pass criteria:** `coherence_score >= 0.809` on every Cloud Run service.

- [ ] ST-1.2 PASS

---

### ST-1.3 Health Response Structure

The `/health` response should contain at minimum: `status`, `coherence_score`, and `timestamp`.

```bash
RESPONSE=$(curl -sf "$API_URL/health")
echo "$RESPONSE" | jq '{status, coherence_score, timestamp}'
```

**Pass criteria:** All three fields present; `status` is `"ok"` or equivalent.

- [ ] ST-1.3 PASS

---

## Suite 2 — API Endpoint Verification

### ST-2.1 Unauthenticated Public Endpoints

Test any routes that are expected to be publicly accessible without auth:

```bash
# Example: API version / ping endpoint
curl -sf "$API_URL/api/v1/ping" | jq .
# Expected: HTTP 200, body contains version info

# Replace with actual public endpoints for the Heady API:
curl -sf -o /dev/null -w "%{http_code}" "$API_URL/api/v1/ping"
```

**Pass criteria:** HTTP 200.

- [ ] ST-2.1 PASS

---

### ST-2.2 Authentication-Required Endpoints Return 401 Without Token

```bash
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$API_URL/api/v1/me")
if [ "$STATUS" = "401" ]; then
  echo "PASS  /api/v1/me → HTTP 401 (unauthenticated correctly rejected)"
else
  echo "FAIL  /api/v1/me → HTTP $STATUS (expected 401)"
fi
```

**Pass criteria:** HTTP 401 (or 403) — the endpoint is not publicly accessible.

- [ ] ST-2.2 PASS

---

### ST-2.3 Core API Routes (Authenticated)

Use a test Firebase ID token to verify authenticated routes. Generate a token via the Firebase Auth REST API:

```bash
# Obtain a Firebase ID token for a test account
FIREBASE_ID_TOKEN=$(curl -sf \
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=<FIREBASE_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"<TEST_USER_EMAIL>","password":"<TEST_USER_PASSWORD>","returnSecureToken":true}' \
  | jq -r '.idToken')

# Verify token was obtained
if [ -z "$FIREBASE_ID_TOKEN" ]; then
  echo "FAIL  Could not obtain Firebase ID token"
  exit 1
fi

# Test an authenticated endpoint
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  "$API_URL/api/v1/me")
echo "ST-2.3  /api/v1/me authenticated → HTTP $STATUS"
```

**Pass criteria:** HTTP 200 with valid user profile in response body.

> **Note:** Maintain a dedicated smoke-test user account in Firebase (separate from real users). Credentials stored in Secret Manager under `smoke-test/firebase-credentials`.

- [ ] ST-2.3 PASS

---

### ST-2.4 Error Response Shape

Confirm the API returns structured error responses (not raw stack traces):

```bash
RESPONSE=$(curl -sf -o - -w "\n%{http_code}" "$API_URL/api/v1/nonexistent-route" 2>&1)
echo "$RESPONSE"
# Expected: HTTP 404, body is JSON with an error field (not HTML or stack trace)
```

**Pass criteria:** HTTP 404; response body is valid JSON; no stack trace visible.

- [ ] ST-2.4 PASS

---

## Suite 3 — Auth Flow Testing (Firebase)

### ST-3.1 Firebase Token Verification (Server-Side)

Confirm the API correctly validates Firebase JWTs:

```bash
# Test with a valid token (reuse $FIREBASE_ID_TOKEN from ST-2.3)
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  "$API_URL/api/v1/me")
echo "Valid token → HTTP $STATUS (expected 200)"

# Test with an invalid / expired token
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer invalid.token.here" \
  "$API_URL/api/v1/me")
echo "Invalid token → HTTP $STATUS (expected 401)"
```

**Pass criteria:**
- Valid token → HTTP 200
- Invalid token → HTTP 401

- [ ] ST-3.1 PASS

---

### ST-3.2 Firebase Auth Authorized Domains

Verify the Firebase console authorized domains list includes production domains and not dev/localhost for production use. This is a manual check:

1. Open [Firebase Console](https://console.firebase.google.com/) → select the production project
2. Navigate to **Authentication** → **Settings** → **Authorized domains**
3. Confirm all 9 Heady production domains are listed
4. Confirm `localhost` is NOT listed (or is intentionally allowed and documented)

- [ ] ST-3.2 PASS (manual verification)

---

### ST-3.3 Sign-In Flow (Browser-Based Smoke Test)

Perform a manual sign-in through the production web app:

1. Open `https://headyme.com` (or the primary app URL) in a private/incognito browser window
2. Navigate to the sign-in page
3. Sign in with the smoke-test account credentials
4. Confirm redirect to the authenticated home/dashboard
5. Confirm user display name or email is rendered correctly
6. Sign out
7. Confirm redirect to sign-in page and session is cleared

- [ ] ST-3.3 PASS (manual verification)

---

## Suite 4 — Database Connectivity (Neon pgvector)

### ST-4.1 Basic Connectivity

```bash
psql "$DATABASE_URL" -c "SELECT NOW() AS server_time, current_database(), current_user;"
```

**Pass criteria:** Returns a row with current timestamp, database name, and user.

- [ ] ST-4.1 PASS

---

### ST-4.2 pgvector Extension

```bash
psql "$DATABASE_URL" -c \
  "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"
```

**Pass criteria:** Returns one row with `extname = vector` and a version string.

- [ ] ST-4.2 PASS

---

### ST-4.3 Vector Operations (Basic Sanity)

```bash
psql "$DATABASE_URL" -c \
  "SELECT '[1,2,3]'::vector <-> '[4,5,6]'::vector AS l2_distance;"
```

**Pass criteria:** Returns a numeric distance (approximately `5.196`).

- [ ] ST-4.3 PASS

---

### ST-4.4 Core Table Existence and Row Counts

Verify that critical tables exist and have the expected approximate row counts (compare against staging baseline):

```bash
psql "$DATABASE_URL" -c "
  SELECT schemaname, tablename, n_live_tup
  FROM pg_stat_user_tables
  ORDER BY n_live_tup DESC;
"
```

**Pass criteria:** All expected tables are present; row counts match staging expectations within reasonable variance.

- [ ] ST-4.4 PASS

---

### ST-4.5 Vector Index Exists

```bash
psql "$DATABASE_URL" -c "
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE indexdef ILIKE '%vector%' OR indexdef ILIKE '%ivfflat%' OR indexdef ILIKE '%hnsw%';
"
```

**Pass criteria:** At least one vector index exists on the expected table(s).

- [ ] ST-4.5 PASS

---

### ST-4.6 Read/Write Round-Trip via API

This tests the database via the application layer (not a direct connection):

```bash
# Write: create a resource via the API
RESPONSE=$(curl -sf -X POST \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"smoke-test-item","description":"automated smoke test"}' \
  "$API_URL/api/v1/<resource-endpoint>")
ITEM_ID=$(echo "$RESPONSE" | jq -r '.id')
echo "Created item: $ITEM_ID"

# Read: fetch the created resource back
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  "$API_URL/api/v1/<resource-endpoint>/$ITEM_ID")
echo "Read item → HTTP $STATUS (expected 200)"

# Delete: clean up the smoke test item
curl -sf -X DELETE \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  "$API_URL/api/v1/<resource-endpoint>/$ITEM_ID"
echo "Cleaned up smoke test item"
```

**Pass criteria:** Create returns HTTP 201 (or 200), Read returns HTTP 200, Delete returns HTTP 200 or 204.

- [ ] ST-4.6 PASS

---

## Suite 5 — Redis Connectivity (Upstash)

### ST-5.1 Basic Ping

```bash
redis-cli -u "$REDIS_URL" PING
# Expected output: PONG
```

Or via Upstash REST API:
```bash
curl -sf -X POST "$UPSTASH_REDIS_REST_URL/ping" \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" | jq .
# Expected: {"result":"PONG"}
```

**Pass criteria:** `PONG` returned.

- [ ] ST-5.1 PASS

---

### ST-5.2 Write / Read / Delete Round-Trip

```bash
KEY="prod:smoketest:$(date +%s)"
VALUE="smoke-test-value"

# Write
redis-cli -u "$REDIS_URL" SET "$KEY" "$VALUE" EX 60

# Read
RESULT=$(redis-cli -u "$REDIS_URL" GET "$KEY")
if [ "$RESULT" = "$VALUE" ]; then
  echo "PASS  Redis read/write round-trip"
else
  echo "FAIL  Expected '$VALUE', got '$RESULT'"
fi

# Delete
redis-cli -u "$REDIS_URL" DEL "$KEY"
```

**Pass criteria:** Read returns the exact value written.

- [ ] ST-5.2 PASS

---

### ST-5.3 TLS Verification

```bash
# Confirm the connection URL uses rediss:// (TLS)
if echo "$REDIS_URL" | grep -q "^rediss://"; then
  echo "PASS  Redis URL uses TLS (rediss://)"
else
  echo "FAIL  Redis URL does not use TLS — expected rediss://"
fi
```

**Pass criteria:** URL starts with `rediss://`.

- [ ] ST-5.3 PASS

---

### ST-5.4 Application-Layer Cache Validation

Verify the API actually uses Redis by confirming a cache hit:

```bash
# Make the same request twice; the second should be faster (cache hit)
TIME1=$(curl -sf -o /dev/null -w "%{time_total}" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  "$API_URL/api/v1/<cacheable-endpoint>")

TIME2=$(curl -sf -o /dev/null -w "%{time_total}" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  "$API_URL/api/v1/<cacheable-endpoint>")

echo "First request: ${TIME1}s"
echo "Second request: ${TIME2}s (expected to be faster)"
```

**Pass criteria:** Second request is noticeably faster (< 50% of first request time), indicating a cache hit.

- [ ] ST-5.4 PASS (or document if caching is not implemented for this endpoint)

---

## Suite 6 — Static Site Serving (Cloudflare Pages)

### ST-6.1 HTTP → HTTPS Redirect

```bash
for DOMAIN in "${DOMAINS[@]}"; do
  LOCATION=$(curl -sf -o /dev/null -w "%{redirect_url}" "http://$DOMAIN/")
  if echo "$LOCATION" | grep -q "^https://"; then
    echo "PASS  http://$DOMAIN → $LOCATION"
  else
    echo "FAIL  http://$DOMAIN — no HTTPS redirect (got: '$LOCATION')"
  fi
done
```

**Pass criteria:** All HTTP requests redirect to HTTPS.

- [ ] ST-6.1 PASS

---

### ST-6.2 HTTPS Response — Status and Content-Type

```bash
for DOMAIN in "${DOMAINS[@]}"; do
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "https://$DOMAIN/")
  CTYPE=$(curl -sf -I "https://$DOMAIN/" | grep -i content-type | awk '{print $2}')
  echo "$DOMAIN → HTTP $STATUS | $CTYPE"
done
```

**Pass criteria:** HTTP 200; `Content-Type: text/html`.

- [ ] ST-6.2 PASS

---

### ST-6.3 Static Asset Serving

```bash
# Replace with an actual known static asset path (e.g., favicon, CSS bundle)
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "https://headyme.com/favicon.ico")
echo "favicon.ico → HTTP $STATUS (expected 200)"

STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "https://headyme.com/_next/static/<bundle-path>/main.js")
echo "JS bundle → HTTP $STATUS (expected 200)"
```

**Pass criteria:** HTTP 200 for all static assets.

- [ ] ST-6.3 PASS

---

### ST-6.4 Security Headers

```bash
for DOMAIN in headyme.com headyai.com; do
  echo "--- $DOMAIN ---"
  curl -sf -I "https://$DOMAIN/" | grep -i \
    -e "strict-transport-security" \
    -e "content-security-policy" \
    -e "x-content-type-options" \
    -e "x-frame-options" \
    -e "referrer-policy"
  echo ""
done
```

**Pass criteria:** At minimum, `Strict-Transport-Security` is present. `X-Content-Type-Options: nosniff` is present.

- [ ] ST-6.4 PASS

---

## Suite 7 — Cross-Domain Routing Verification

### ST-7.1 API Routing (Worker → Cloud Run Proxy)

For each domain that proxies API calls through a Cloudflare Worker to Cloud Run:

```bash
for DOMAIN in "${DOMAINS[@]}"; do
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "https://$DOMAIN/api/v1/ping")
  echo "$DOMAIN/api/v1/ping → HTTP $STATUS"
done
```

**Pass criteria:** HTTP 200 on all domains that are expected to serve the API.

- [ ] ST-7.1 PASS

---

### ST-7.2 CORS Headers on API from a Browser Origin

```bash
RESPONSE=$(curl -sf -I \
  -H "Origin: https://headyme.com" \
  -H "Access-Control-Request-Method: GET" \
  -X OPTIONS \
  "$API_URL/api/v1/ping")
echo "$RESPONSE" | grep -i "access-control"
```

**Pass criteria:**
- `Access-Control-Allow-Origin` is `https://headyme.com` (not `*` for authenticated routes)
- `Access-Control-Allow-Methods` includes `GET` (and POST, PUT as appropriate)

- [ ] ST-7.2 PASS

---

### ST-7.3 Domain Canonicalization

Verify `www.` subdomains redirect to the apex domain (or vice versa, per design):

```bash
for DOMAIN in "${DOMAINS[@]}"; do
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "https://www.$DOMAIN/")
  LOCATION=$(curl -sf -o /dev/null -w "%{redirect_url}" "https://www.$DOMAIN/")
  echo "www.$DOMAIN → HTTP $STATUS | redirect: $LOCATION"
done
```

**Pass criteria:** `www.` either redirects to apex (301) or serves the same content (200), with no mixed behavior.

- [ ] ST-7.3 PASS

---

### ST-7.4 Unknown Domain Handling

Confirm that requests to domains not in the production set do not reach internal services:

```bash
# This should return a 404 or redirect — not expose internal services
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" --resolve "notaheadydomain.example:443:104.21.0.1" "https://notaheadydomain.example/")
echo "Unknown domain → HTTP $STATUS"
```

**Pass criteria:** Unknown domains do not return application data.

- [ ] ST-7.4 PASS

---

## Suite 8 — Sentry Error Capture Verification

### ST-8.1 Frontend Error Capture

In a browser console on the production app, run:

```javascript
// Open browser dev tools on https://headyme.com and run:
Sentry.captureMessage("smoke-test-frontend-" + Date.now(), "info");
```

Then in the [Sentry dashboard](https://sentry.io/organizations/heady-ai/):
1. Navigate to `heady-ai` org → the frontend project
2. Filter by `environment: production`
3. Confirm the message appears within 30 seconds

**Pass criteria:** Message visible in Sentry under the correct project and environment.

- [ ] ST-8.1 PASS

---

### ST-8.2 Backend Error Capture

Trigger a controlled error via a dedicated smoke-test endpoint (if available):

```bash
curl -sf -X POST \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  "$API_URL/api/v1/debug/sentry-test"
```

If no dedicated endpoint exists, manually send a test event via the Sentry API:

```bash
curl -sf -X POST "https://sentry.io/api/<PROJECT_ID>/store/" \
  -H "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=<DSN_PUBLIC_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "production-smoke-test-backend",
    "level": "info",
    "environment": "production",
    "release": "<RELEASE_TAG>"
  }'
```

Then verify in Sentry:
1. Navigate to `heady-ai` org → the backend project
2. Filter by `environment: production`
3. Confirm the event appears within 30 seconds

**Pass criteria:** Event visible in Sentry under the correct project and environment.

- [ ] ST-8.2 PASS

---

### ST-8.3 Sentry Alert Rules Functioning

Manually verify at least one alert rule is active:

1. Open Sentry → `heady-ai` org → **Alerts**
2. Confirm at least one active alert rule targeting the production environment
3. Confirm the rule has an action (email / Slack / PagerDuty)

- [ ] ST-8.3 PASS (manual verification)

---

## Suite 9 — Performance Baseline Checks

### ST-9.1 API Response Time — Health Endpoint

```bash
for i in {1..5}; do
  TIME=$(curl -sf -o /dev/null -w "%{time_total}" "$API_URL/health")
  echo "Run $i: ${TIME}s"
done
```

**Pass criteria:** All 5 runs complete in < 1 second. Median < 500ms.

- [ ] ST-9.1 PASS

---

### ST-9.2 API Response Time — Authenticated Endpoint

```bash
for i in {1..3}; do
  TIME=$(curl -sf -o /dev/null -w "%{time_total}" \
    -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
    "$API_URL/api/v1/me")
  echo "Run $i: ${TIME}s"
done
```

**Pass criteria:** All runs complete in < 2 seconds.

- [ ] ST-9.2 PASS

---

### ST-9.3 Static Page Load Time

```bash
for DOMAIN in headyme.com headyai.com; do
  TIME=$(curl -sf -o /dev/null -w "%{time_total}" "https://$DOMAIN/")
  echo "$DOMAIN: ${TIME}s"
done
```

**Pass criteria:** All pages return in < 1.5 seconds (TTFB from curl perspective).

- [ ] ST-9.3 PASS

---

### ST-9.4 Cloud Run Cold Start Check

Force a fresh instance by sending a burst of concurrent requests, then measure:

```bash
# Send 10 concurrent requests and measure max response time
seq 10 | xargs -P10 -I{} curl -sf -o /dev/null -w "%{time_total}\n" "$API_URL/health" | sort -n
```

**Pass criteria:** Maximum response time (including any cold start) < 10 seconds. If minimum instance count > 0 was set, all requests should complete in < 2 seconds.

- [ ] ST-9.4 PASS

---

## Smoke Test Sign-Off

### Results Summary

| Suite | Tests | Status | Notes |
|-------|-------|--------|-------|
| 1 — Health Endpoints | ST-1.1 to ST-1.3 | | |
| 2 — API Endpoints | ST-2.1 to ST-2.4 | | |
| 3 — Firebase Auth | ST-3.1 to ST-3.3 | | |
| 4 — Neon Postgres | ST-4.1 to ST-4.6 | | |
| 5 — Upstash Redis | ST-5.1 to ST-5.4 | | |
| 6 — Cloudflare Pages | ST-6.1 to ST-6.4 | | |
| 7 — Cross-Domain Routing | ST-7.1 to ST-7.4 | | |
| 8 — Sentry | ST-8.1 to ST-8.3 | | |
| 9 — Performance Baseline | ST-9.1 to ST-9.4 | | |

### Final Determination

- [ ] **ALL PASS** — Deployment verified. Proceed with go-live / declare rollback resolved.
- [ ] **FAILURES PRESENT** — List all failed tests:  
  - `_______________________`  
  - `_______________________`  
  Decision: [ ] Fix and retest | [ ] Roll back (see `production-rollback-plan.md`)

**Executed by:** _________________________ **Date/Time:** _________________________  
**Reviewed by:** _________________________ **Date/Time:** _________________________
