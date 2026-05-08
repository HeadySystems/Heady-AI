# Production Rollback Plan
**Ticket:** HEA-237  
**Project:** gen-lang-client-0920560496  
**Region:** us-east1  
**GitHub Org:** HeadyMe / heady-production  
**Last Updated:** 2026-04-04  

---

## Overview

This document is the authoritative rollback playbook for the Heady production environment. It covers every layer of the stack from Cloud Run services through Cloudflare routing to the Neon database. It must be read and understood by every engineer in the on-call rotation **before** the go-live window.

**Rollback is not a failure. It is a planned, practiced procedure.**

---

## Decision Criteria: When to Roll Back

Rollback is triggered when **any** of the following conditions are met and cannot be mitigated within the defined time window:

| Signal | Threshold | Time Window | Action |
|--------|-----------|-------------|--------|
| Sentry unhandled error rate | > 2× pre-launch baseline | > 5 minutes | Investigate → Rollback if no fix |
| `/health` endpoint failure | Any service returning non-200 | > 2 minutes | Immediate rollback |
| `coherence_score` below threshold | `< 0.809` on any service | > 2 minutes | Immediate rollback |
| p99 API latency | > 5× pre-launch baseline | > 5 minutes | Investigate → Rollback if no fix |
| Database connection pool exhaustion | `pg_stat_activity` at connection limit | Sustained | Investigate → Rollback if no fix |
| Data integrity issue | Any confirmed data corruption or loss | Immediate | Immediate rollback + incident |
| Security incident | Confirmed exploit in new code | Immediate | Immediate rollback + security incident |

### Decision Authority

**A single named incident commander** makes the rollback decision. No rollback should be executed without their explicit go-ahead unless a service is fully down and the commander is unreachable (in which case the on-call lead has authority).

Do not let debate delay a rollback. **When in doubt, roll back.**

---

## Pre-Rollback Checklist

Run this before executing any rollback procedure:

- [ ] Incident commander notified and on the call
- [ ] Rollback reason documented in `#prod-golive` (one sentence is sufficient)
- [ ] Current state captured (screenshots of Sentry, Cloud Monitoring, error logs)
- [ ] Database write state assessed — if a migration ran, go to Section 4 first
- [ ] Estimated time to rollback communicated to stakeholders
- [ ] Status page updated: "Investigating issue — rollback may occur"

---

## Section 1 — Cloud Run Revision Rollback

### 1.1 Identify the Rollback Target Revision

```bash
gcloud run revisions list \
  --service <SERVICE_NAME> \
  --region us-east1 \
  --project gen-lang-client-0920560496 \
  --format="table(name,status.conditions[0].lastTransitionTime,spec.containers[0].image)"
```

Note the last known-good revision name (should have been recorded in Phase 6 of the go-live checklist).

### 1.2 Execute Revision Rollback (100% traffic shift)

```bash
gcloud run services update-traffic <SERVICE_NAME> \
  --region us-east1 \
  --project gen-lang-client-0920560496 \
  --to-revisions <ROLLBACK_REVISION_NAME>=100
```

**Expected output:** `Traffic: <ROLLBACK_REVISION_NAME>: 100%`

### 1.3 Verify

```bash
# Confirm traffic assignment
gcloud run services describe <SERVICE_NAME> \
  --region us-east1 \
  --project gen-lang-client-0920560496 \
  --format="value(status.traffic)"

# Confirm health
curl -sf https://<SERVICE_URL>/health | jq .
```

Expected: HTTP 200, `coherence_score >= 0.809`.

### 1.4 Services Reference

| Service Name | Cloud Run URL | Notes |
|---|---|---|
| (fill in) | | |

### 1.5 If the Previous Revision Was Deleted

In the unlikely event the rollback revision no longer exists, redeploy from the previous release tag:

```bash
gcloud run deploy <SERVICE_NAME> \
  --image gcr.io/gen-lang-client-0920560496/<IMAGE_NAME>:<PREVIOUS_TAG> \
  --region us-east1 \
  --project gen-lang-client-0920560496 \
  --no-traffic   # deploy without traffic first, then shift

gcloud run services update-traffic <SERVICE_NAME> \
  --region us-east1 \
  --project gen-lang-client-0920560496 \
  --to-latest
```

**Estimated time:** 3–7 minutes for Cloud Run revision rollback.

---

## Section 2 — Cloudflare Worker Version Rollback

### 2.1 Identify the Rollback Target Version

Via Cloudflare dashboard:
1. Navigate to **Workers & Pages** → select the Worker script
2. Click **Deployments** tab
3. Identify the version deployed before the current release (note the version ID and timestamp)

Via `wrangler` CLI:
```bash
wrangler deployments list --name <WORKER_NAME>
```

### 2.2 Roll Back a Worker to a Previous Deployment

```bash
wrangler rollback --deployment-id <DEPLOYMENT_ID> --name <WORKER_NAME>
```

If `wrangler rollback` is not available in the pinned version, redeploy the previous script:

```bash
git checkout <PREVIOUS_TAG>
wrangler deploy --env production --name <WORKER_NAME>
```

### 2.3 Cloudflare Pages Rollback

1. Navigate to **Workers & Pages** → select the Pages project
2. Click **Deployments**
3. Find the last known-good deployment
4. Click **"..."** → **"Rollback to this deployment"**

This is instantaneous and does not require a new build.

### 2.4 Verify Worker Rollback

```bash
# Test a representative route served by the Worker
curl -sf -o /dev/null -w "%{http_code}" https://<DOMAIN>/api/ping
# Expected: 200

# Check Worker logs for errors
wrangler tail --name <WORKER_NAME>
```

### 2.5 Workers & Pages Reference

| Worker / Pages Name | Domain(s) | Notes |
|---|---|---|
| (fill in) | | |

**Estimated time:** < 1 minute for Cloudflare Pages rollback; 2–4 minutes for Worker rollback.

---

## Section 3 — DNS Failover Procedures

### 3.1 When DNS Failover Is Needed

DNS failover is appropriate when:
- The Cloud Run service URL itself is unreachable and a Cloud Run rollback is not fast enough
- A Pages project is broken and a Pages rollback is not resolving the issue
- An emergency "static maintenance page" must be served

### 3.2 Point a Domain to a Maintenance / Fallback Page

**Option A: Cloudflare Pages Maintenance Redirect (fastest)**

1. In Cloudflare Dashboard → **Rules** → **Redirect Rules**
2. Create a rule matching `*.headyme.com/*` → redirect to `maintenance.headyme.com` or a static Cloudflare Pages URL
3. Set to "301 Permanent" only after rollback is verified; use "302 Temporary" during the incident

**Option B: Swap CNAME/A Record**

```
# In Cloudflare DNS, update the A/CNAME record for the affected domain:
# Before: CNAME api.headyme.com → <broken-cloud-run-url>
# After:  CNAME api.headyme.com → <fallback-endpoint>
```

Because Cloudflare is the authoritative DNS and proxy, changes propagate within seconds to minutes (not the full TTL, since Cloudflare's edge picks up changes near-instantly).

### 3.3 Cloudflare Worker Route Disable (Bypass Workers for a Domain)

If a Worker is causing failures and you need to bypass it:

1. Dashboard → **Workers & Pages** → **Overview**
2. Select the Worker → **Triggers** → **Routes**
3. Delete or disable the problematic route to let requests fall through to the origin

### 3.4 Verify DNS Propagation

```bash
# Check from external resolvers
dig +short <DOMAIN> @1.1.1.1
dig +short <DOMAIN> @8.8.8.8

# Confirm HTTPS response
curl -sf -I https://<DOMAIN>/ | head -5
```

**Estimated time:** 30 seconds to 2 minutes for Cloudflare-proxied records.

---

## Section 4 — Database Migration Rollback (Neon Branching)

### 4.1 Assessment First

Before rolling back the database, answer:

1. **Were any destructive migrations run?** (DROP TABLE, DROP COLUMN, data delete)
2. **Has user data been written to the new schema?**
3. **What is the volume of data written since migration?**

If destructive migrations ran AND new data was written, rollback becomes a data recovery operation. Engage Neon support (`support@neon.tech`) immediately.

### 4.2 Rollback Using Neon Branching (Non-Destructive Migrations)

Neon's branching model allows restoring to a point-in-time snapshot taken before the migration.

**Step 1:** Identify the pre-migration branch (should have been recorded in go-live checklist Phase 5).

```bash
# List Neon branches via API
curl -s -H "Authorization: Bearer $NEON_API_KEY" \
  "https://console.neon.tech/api/v2/projects/<PROJECT_ID>/branches" | jq '.branches[] | {id, name, created_at}'
```

**Step 2:** Reset the main branch to the pre-migration point.

Using the Neon console:
1. Navigate to the project → **Branches**
2. Select the `main` branch → **"Restore"** → choose the pre-migration branch or timestamp

Using the Neon API:
```bash
curl -X POST \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source_branch_id": "<PRE_MIGRATION_BRANCH_ID>"}' \
  "https://console.neon.tech/api/v2/projects/<PROJECT_ID>/branches/main/restore"
```

**Step 3:** After the restore, update the connection string if the branch endpoint ID changed.

### 4.3 Down Migrations (If a Migration Tool Supports Them)

If using a migration tool with down migrations (e.g., `dbmate`, `flyway`, `golang-migrate`):

```bash
# Example for golang-migrate — roll back 1 version
migrate -database "$DATABASE_URL" -path ./migrations down 1

# Verify migration version
migrate -database "$DATABASE_URL" -path ./migrations version
```

> **Warning:** Down migrations that include `DROP` statements are destructive. Always take a Neon branch snapshot before running down migrations.

### 4.4 Verify Database State

```bash
psql "$DATABASE_URL" -c "\dt"                           # List tables
psql "$DATABASE_URL" -c "SELECT count(*) FROM <table>;" # Row count check
psql "$DATABASE_URL" -c "SELECT version();"             # Confirm connection

# Verify pgvector extension
psql "$DATABASE_URL" -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"
```

**Estimated time:** 2–5 minutes for Neon branch restore (near-instant for small databases).

---

## Section 5 — Redis Cache Invalidation

### 5.1 When Cache Invalidation Is Needed

- Application logic changed and stale cached values are causing incorrect responses
- A Redis key format or schema changed and old keys are incompatible
- Cache poisoning or corrupt values are suspected

### 5.2 Targeted Key Flush (Preferred)

Flush only the affected namespace rather than the entire cache:

```bash
# Using redis-cli via Upstash REST API or CLI
# List keys in a namespace (use with caution on large datasets)
redis-cli -u "$REDIS_URL" --scan --pattern "prod:session:*"

# Delete a specific key
redis-cli -u "$REDIS_URL" DEL "prod:cache:<specific-key>"

# Delete all keys matching a pattern (SCAN + DEL loop — safer than KEYS)
redis-cli -u "$REDIS_URL" --scan --pattern "prod:cache:*" | xargs redis-cli -u "$REDIS_URL" DEL
```

### 5.3 Full Cache Flush (Last Resort)

> **Impact:** All cached data is lost; the application will experience a "cold cache" penalty (increased DB load) until the cache warms up. Monitor Neon connection pool and query latency after a flush.

```bash
redis-cli -u "$REDIS_URL" FLUSHDB
```

Or via Upstash console: **Database** → **CLI** → `FLUSHDB`

### 5.4 Verify After Flush

```bash
# Confirm cache is empty or at expected state
redis-cli -u "$REDIS_URL" DBSIZE

# Monitor for a few seconds
redis-cli -u "$REDIS_URL" MONITOR  # Ctrl+C to stop
```

### 5.5 Rollback Notes

- Sessions stored in Redis: if session keys are flushed, **all active users will be logged out**. This is a known tradeoff and should be communicated before a full flush.
- If sessions use Firebase Auth JWTs (verified server-side), a Redis flush does not affect authentication — users will simply need to re-fetch their session state.

**Estimated time:** < 30 seconds for targeted flush; < 1 minute for full flush.

---

## Section 6 — Rollback Verification Steps

After all rollback actions are complete, verify the following before declaring the rollback successful:

### 6.1 Service Health

```bash
# Run for each Cloud Run service URL
for URL in <SERVICE_URL_1> <SERVICE_URL_2>; do
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$URL/health")
  SCORE=$(curl -sf "$URL/health" | jq -r '.coherence_score')
  echo "$URL → HTTP $STATUS | coherence_score: $SCORE"
done
```

- [ ] All services return HTTP 200
- [ ] All `coherence_score` values are `>= 0.809`

### 6.2 Smoke Test Suite

- [ ] Run `production-smoke-tests.md` — all checks pass against the rolled-back state
- [ ] Auth flow (Firebase) confirmed working
- [ ] Database read/write confirmed working
- [ ] Redis connectivity confirmed

### 6.3 Sentry

- [ ] Error rate returning to pre-launch baseline in `heady-ai` org
- [ ] No new unhandled exception types introduced by the rollback itself

### 6.4 DNS / Routing

- [ ] All 9 domains responding correctly
- [ ] No unintended redirect loops
- [ ] Cloudflare Worker routes confirmed pointing at correct scripts

### 6.5 Stakeholder Notification

- [ ] Status page updated: "Rollback complete — investigating root cause"
- [ ] `#prod-golive` message posted with: what was rolled back, when, current status
- [ ] Incident retrospective scheduled

---

## Communication Templates

### Rollback Initiated

```
[INCIDENT - ROLLBACK INITIATED]
Time: {TIME} EDT
Service(s) affected: {SERVICES}
Reason: {ONE_SENTENCE_REASON}
Action: Rolling back to revision {REVISION} / tag {TAG}
ETA to stable: {ESTIMATE} minutes
IC: {INCIDENT_COMMANDER}
Status page: {URL}
```

### Rollback Complete

```
[INCIDENT - ROLLBACK COMPLETE]
Time: {TIME} EDT
Status: All services restored to pre-launch state
Verification: All health checks passing | Sentry baseline normal
Next steps: Root cause analysis in progress
Retrospective: {DATE/TIME}
IC: {INCIDENT_COMMANDER}
```

### External User-Facing Message (for Status Page)

```
We identified an issue following today's deployment and have rolled back to a 
stable version of the service. All features are fully operational. We are 
investigating the root cause and will post an update by {TIME}.
```

---

## Rollback Time Estimates Summary

| Component | Procedure | Estimated Time |
|---|---|---|
| Cloud Run service | Traffic shift to previous revision | 3–7 minutes |
| Cloudflare Pages | Rollback via dashboard | < 1 minute |
| Cloudflare Worker | `wrangler rollback` | 2–4 minutes |
| DNS record change | Cloudflare proxied record | 30s – 2 min |
| Neon branch restore | Non-destructive restore | 2–5 minutes |
| Redis flush (targeted) | Pattern-based DEL | < 30 seconds |
| Redis flush (full) | FLUSHDB | < 1 minute |
| **Total (parallel execution)** | | **~10 minutes** |

---

## Post-Rollback Root Cause Analysis

Within 48 hours of a rollback, the following must be documented:

- [ ] Timeline of events (detection → decision → rollback complete)
- [ ] Root cause identified
- [ ] Contributing factors identified
- [ ] Fix committed to `heady-production` main with test coverage
- [ ] Prevention measures proposed for next release
- [ ] Go-live checklist updated if any gap was identified

Template location: create `docs/incidents/YYYY-MM-DD-<slug>.md` in `heady-production`.
