# Production Go-Live Checklist
**Ticket:** HEA-240  
**Project:** gen-lang-client-0920560496  
**Region:** us-east1  
**GitHub Org:** HeadyMe / heady-production  
**Last Updated:** 2026-04-04  

---

## How to Use This Document

Work through each phase sequentially. Every item must be checked off or explicitly deferred with a written justification and owner before proceeding to the next phase. No phase may be declared complete while any item is unresolved.

**Sign-off columns:** `[ ]` = not started · `[~]` = in-progress / deferred · `[x]` = complete

---

## Phase 0 — Pre-Flight (T-48h)

### 0.1 Team Readiness

- [ ] Incident commander identified and confirmed available for go-live window
- [ ] On-call rotation updated; all participants have Sentry access to `heady-ai` org
- [ ] War-room channel created (e.g., `#prod-golive`) and all responders added
- [ ] Rollback plan (`production-rollback-plan.md`) reviewed by at least two engineers
- [ ] Smoke test runbook (`production-smoke-tests.md`) reviewed; executors assigned
- [ ] Maintenance window communicated to stakeholders (time, expected duration, impact)
- [ ] Rollback decision authority confirmed (single named decision-maker)

### 0.2 Code Freeze & Branch Status

- [ ] Feature freeze enforced on `main` branch of `heady-production` monorepo
- [ ] All open PRs that are not going to production are merged to a holding branch or closed
- [ ] Release tag created: `git tag -a v<SEMVER> -m "Production release <DATE>"` and pushed
- [ ] CI pipeline is green on the tagged commit (all tests passing)
- [ ] No `TODO: before prod` or `FIXME` comments in code paths exercised at launch
- [ ] Dependency lock files (`package-lock.json`, `requirements.txt`, `go.sum`) committed and match CI

---

## Phase 1 — Infrastructure Readiness (T-24h)

### 1.1 Cloud Run

- [ ] All Cloud Run services in `us-east1` are deployed from the release tag
- [ ] Minimum instance count set (≥ 1) to eliminate cold-start risk on go-live
- [ ] Maximum instance count reviewed and set appropriate to expected traffic
- [ ] Memory and CPU limits reviewed; no OOM events in staging under load test
- [ ] Health check endpoints configured: `/health` returning HTTP 200 with `coherence_score >= 0.809`
- [ ] Startup probe and liveness probe configured on each service
- [ ] VPC connector / private networking confirmed (if applicable)
- [ ] Service account permissions are least-privilege; no Editor/Owner roles on runtime SA
- [ ] Cloud Run IAM — `allUsers` invoker only on public services; internal services are IAM-gated
- [ ] Cloud Armor policies (if any) applied and tested in staging
- [ ] Binary Authorization policy enforced on `gen-lang-client-0920560496` project

### 1.2 Cloudflare Workers & Pages

- [ ] All Worker scripts deployed from release tag via `wrangler deploy --env production`
- [ ] Worker compatibility date is pinned and reviewed for breaking changes
- [ ] Pages projects built and deployed; preview URLs confirmed healthy
- [ ] Worker KV namespaces, Durable Objects, or R2 bindings verified for production environment
- [ ] Rate limiting rules active and tested
- [ ] Firewall rules reviewed; bot-fight mode setting confirmed intentional
- [ ] Cache rules reviewed; no sensitive API routes cached incorrectly
- [ ] `wrangler tail` confirmed accessible for live log streaming during go-live

### 1.3 Neon Postgres (pgvector)

- [ ] Production Neon project/branch is the **main** branch (not a dev branch)
- [ ] Connection pooler (PgBouncer) endpoint used by all Cloud Run services; direct connections only for migrations
- [ ] `pgvector` extension installed and version confirmed: `SELECT extversion FROM pg_extension WHERE extname = 'vector';`
- [ ] All pending migrations applied to production branch (migration tool: confirm zero pending)
- [ ] Migration run log reviewed; no errors or warnings
- [ ] Neon branch snapshot taken immediately before migration as rollback baseline
- [ ] Row counts on critical tables validated against staging expectations
- [ ] Indexes on vector columns confirmed: `SELECT indexname FROM pg_indexes WHERE tablename = '<table>';`
- [ ] Connection string in Secret Manager verified (not a dev/branch URL)
- [ ] SSL mode enforced (`sslmode=require` or `verify-full`)
- [ ] Neon autoscaling limits set; compute size reviewed for launch traffic

### 1.4 Upstash Redis

- [ ] Production Redis database is the correct instance (not shared with staging/dev)
- [ ] Connection URL and token stored in Secret Manager, not in environment variables inline
- [ ] Eviction policy confirmed appropriate for use case (e.g., `allkeys-lru` for caching)
- [ ] Max data size limit reviewed; current usage well below limit
- [ ] TLS enforced on all connections (`rediss://` protocol)
- [ ] Key namespacing convention confirmed and applied (e.g., `prod:session:`, `prod:cache:`)
- [ ] No staging or dev keys present in the production database
- [ ] REST API access (if used) restricted to known Cloud Run egress IPs or uses token auth

---

## Phase 2 — Security Checks (T-24h)

### 2.1 Secrets & Credentials

- [ ] All secrets stored in GCP Secret Manager; no plaintext secrets in Cloud Run env vars, Worker env vars, or committed code
- [ ] Secrets audit: run `git log --all -S 'SECRET\|KEY\|PASSWORD\|TOKEN' --oneline` and confirm zero results
- [ ] Secrets rotated within last 90 days (or at go-live if not):
  - [ ] Neon database credentials
  - [ ] Upstash Redis token
  - [ ] Firebase Admin SDK private key
  - [ ] Sentry DSN (not a secret, but verify it is the production DSN, not dev)
  - [ ] Any third-party API keys (OpenAI, etc.)
- [ ] Secret versions are pinned in Cloud Run (`--set-secrets` using version numbers, not `latest`, for reproducibility)
- [ ] IAM bindings on Secret Manager secrets follow least-privilege (only the runtime SA has `secretAccessor`)

### 2.2 TLS / HTTPS

- [ ] All 9 Heady domains resolve over HTTPS with valid certificates:
  - [ ] headyme.com
  - [ ] headyai.com
  - [ ] (remaining 7 domains)
- [ ] HTTP → HTTPS redirect enforced at Cloudflare for all domains (SSL/TLS mode: Full Strict)
- [ ] HSTS headers present on all responses (`Strict-Transport-Security: max-age=31536000; includeSubDomains`)
- [ ] TLS 1.2 minimum enforced; TLS 1.0/1.1 disabled in Cloudflare
- [ ] Certificate expiry dates reviewed; all certificates expire > 60 days from launch date

### 2.3 CORS

- [ ] CORS `Allow-Origin` headers set to explicit domain allowlist (no wildcard `*` on authenticated endpoints)
- [ ] CORS preflight responses verified for all API routes accessed from browser clients
- [ ] OPTIONS method handled correctly on all API routes
- [ ] Confirmed that internal service-to-service calls do not rely on CORS (use service account auth instead)

### 2.4 Firebase Auth

- [ ] Firebase project is production (not dev/test project)
- [ ] Authorized domains list in Firebase console contains only production domains
- [ ] Email enumeration protection enabled
- [ ] MFA enforcement configured per security policy
- [ ] Firebase Admin SDK credentials use a dedicated service account with minimal IAM roles
- [ ] Token verification is performed server-side on every authenticated API call
- [ ] Session cookie expiry / JWT `exp` values reviewed

### 2.5 Headers & Hardening

- [ ] `Content-Security-Policy` header set and tested (no `unsafe-eval` unless explicitly justified)
- [ ] `X-Frame-Options: DENY` or `frame-ancestors 'none'` in CSP
- [ ] `X-Content-Type-Options: nosniff` present
- [ ] `Referrer-Policy` set appropriately
- [ ] Server / `X-Powered-By` headers suppressed

---

## Phase 3 — Monitoring Verification (T-12h)

### 3.1 Sentry

- [ ] Sentry organization: `heady-ai` — confirmed correct org in all SDK initializations
- [ ] Each service has its own Sentry project with a unique DSN
- [ ] Production DSNs (not staging DSNs) are active in all deployed services
- [ ] `environment: "production"` tag set in all Sentry SDK configurations
- [ ] Release tracking configured: `release` tag matches the git tag deployed
- [ ] Source maps uploaded to Sentry for all frontend bundles (if applicable)
- [ ] Alert rules configured: P0 errors (unhandled exceptions) page on-call immediately
- [ ] Test error sent and confirmed received in Sentry before go-live:
  ```
  sentry.captureException(new Error("production-golive-smoke-test"))
  ```
  — verify it appears in the `heady-ai` org under the correct project with `environment: production`
- [ ] Sentry inbound filters reviewed (e.g., localhost errors filtered)
- [ ] Issue owners / alert routing configured so alerts reach the right team

### 3.2 Health Endpoints

- [ ] `/health` endpoint accessible and returns HTTP 200 on all Cloud Run services
- [ ] `/health` response body contains `coherence_score` field with value `>= 0.809`
- [ ] Cloud Run health check is wired to `/health` (not just TCP probe)
- [ ] Uptime check configured (GCP Monitoring or external) against `/health` for each service
- [ ] Alert policy: notify on-call if `/health` returns non-200 for > 1 minute

### 3.3 Cloud Logging & Metrics

- [ ] Structured JSON logging confirmed in all Cloud Run services (not plaintext)
- [ ] Log severity levels used correctly (INFO / WARNING / ERROR / CRITICAL)
- [ ] GCP Log-based metric created for ERROR-level log entries per service
- [ ] Dashboard created in GCP Monitoring covering: request latency (p50/p95/p99), error rate, instance count
- [ ] Alerting policies set on: error rate > threshold, latency p99 > threshold, instance count at max

---

## Phase 4 — DNS & Routing Verification (T-12h)

### 4.1 DNS Records

- [ ] All 9 domains have DNS managed by Cloudflare (nameservers confirmed in registrar)
- [ ] For each domain, verify:
  - [ ] A / CNAME records point to the correct Cloudflare Pages project or Cloud Run service URL
  - [ ] MX records present and correct (if mail is expected to function)
  - [ ] SPF, DKIM, DMARC records valid (check with `dig TXT <domain>`)
  - [ ] No stale or conflicting records from previous deployments
- [ ] TTLs reviewed; low TTLs (60–300s) set for records that may need rapid failover
- [ ] Cloudflare proxy (orange cloud) enabled on appropriate records; grey-cloud records intentional

### 4.2 Routing & Workers Routes

- [ ] Cloudflare Worker routes correctly map URL patterns to Worker scripts for all 9 domains
- [ ] No route conflicts between Workers and Pages projects
- [ ] Path-based routing (e.g., `/api/*` → Cloud Run, `/*` → Pages) verified end-to-end
- [ ] Redirect rules (301/302) tested for any legacy paths that must be preserved
- [ ] Cross-domain API calls (CORS + routing) smoke-tested from browser

### 4.3 Custom Domain Bindings

- [ ] Custom domains verified in Cloudflare Pages for each applicable Pages project
- [ ] Cloud Run custom domain mappings (if using `gcloud beta run domain-mappings`) verified
- [ ] SSL certificate status: "Active" for all custom domains in Cloudflare dashboard

---

## Phase 5 — Database Migration Status (T-6h)

- [ ] Migration tool (`flyway` / `dbmate` / `prisma migrate` / other — specify: ________) version confirmed
- [ ] Dry-run of `migrate --dry-run` (or equivalent) executed against production Neon branch; zero pending
- [ ] Migration history table matches expected state (no gaps, no failed migrations)
- [ ] Schema diff between staging and production is zero (tool: `pg_dump --schema-only` diff or equivalent)
- [ ] Seed data (if required for production) applied and verified
- [ ] Neon point-in-time restore tested on a branch: confirm ability to restore to pre-migration state
- [ ] Database connection pool size confirmed not to exceed Neon compute connection limits
- [ ] Long-running migration risk: estimated migration time < 30 minutes; if longer, reviewed and approved

---

## Phase 6 — Deployment Verification (T-1h)

### 6.1 Final Deployment

- [ ] All Cloud Run services redeployed from the release tag (not from a local build):
  ```bash
  gcloud run deploy <SERVICE> \
    --image gcr.io/gen-lang-client-0920560496/<image>:<tag> \
    --region us-east1 \
    --project gen-lang-client-0920560496
  ```
- [ ] Deployment output reviewed; no warnings about deprecated flags or missing permissions
- [ ] Cloudflare Workers deployed: `wrangler deploy --env production` for each Worker
- [ ] Cloudflare Pages build triggered from the release tag; build logs reviewed for errors

### 6.2 Traffic Validation (Pre-Shift)

- [ ] Cloud Run traffic split is 100% to the new revision (no split-traffic configuration left active)
- [ ] Run full smoke test suite (`production-smoke-tests.md`) — all checks must pass
- [ ] Load test (even light: 10 RPS for 5 minutes) run against production to confirm no cold-start failures
- [ ] Error rate in Sentry is zero (or at expected baseline) after smoke tests

### 6.3 Rollback Readiness

- [ ] Previous stable Cloud Run revision ID noted for each service:
  ```
  gcloud run revisions list --service <SERVICE> --region us-east1 --project gen-lang-client-0920560496
  ```
  | Service | Rollback Revision |
  |---------|-------------------|
  |         |                   |
- [ ] Rollback command pre-staged and ready to execute (see `production-rollback-plan.md`)
- [ ] Previous Cloudflare Worker version IDs noted per script
- [ ] Neon pre-migration branch name noted: `_________________________`
- [ ] Everyone on the team has confirmed they can execute the rollback procedure

---

## Phase 7 — Go-Live (T-0)

- [ ] Final go/no-go decision made by incident commander; all blockers resolved
- [ ] Maintenance window (if any) officially started; status page updated
- [ ] DNS TTLs lowered 30 minutes before cutover (if doing a DNS-based cutover)
- [ ] Traffic shifted / DNS updated to production endpoints
- [ ] Smoke tests re-run immediately after traffic shift (target: complete within 5 minutes)
- [ ] All `/health` endpoints returning 200 with `coherence_score >= 0.809`
- [ ] Sentry error volume monitored for 15 minutes post-shift; no unexpected spike
- [ ] Cloud Logging queried for ERROR entries in first 15 minutes
- [ ] First real user request confirmed in logs (verify end-to-end flow works under real traffic)
- [ ] Maintenance window ended; status page updated to operational

---

## Phase 8 — Post-Launch Monitoring (T+1h to T+24h)

### 8.1 Immediate (T+0 to T+1h)

- [ ] Sentry error rate stable and below threshold
- [ ] Cloud Run p99 latency within baseline
- [ ] No Redis eviction rate spike (Upstash metrics dashboard reviewed)
- [ ] Neon compute auto-scaling behaving as expected; no connection pool exhaustion
- [ ] Cloudflare analytics: no unexpected 5xx rates, no request volume anomalies
- [ ] All `/health` endpoints still returning 200 with `coherence_score >= 0.809`

### 8.2 Extended (T+1h to T+24h)

- [ ] Hourly check: Sentry — zero new unhandled error types
- [ ] Neon: no long-running queries (`pg_stat_activity` review)
- [ ] Upstash: memory usage trend is stable
- [ ] Cloud Run: instance count is not pegged at max (auto-scaling headroom exists)
- [ ] All 9 domains respond correctly from external DNS check tool
- [ ] No customer-reported issues in support channels

### 8.3 Rollback Window

The rollback window is officially **24 hours** post-launch. After 24 hours, rollback decisions require additional analysis of data migration impact.

- [ ] Rollback window explicitly closed by incident commander at T+24h
- [ ] Post-mortem / launch retrospective scheduled (even if launch was clean)

---

## Phase 9 — Stakeholder Communication

### 9.1 Communication Checklist

- [ ] T-24h: Internal "go-live tomorrow" message sent to `#prod-golive` and relevant stakeholders
- [ ] T-1h: "Launch imminent" message sent; support team briefed on what to watch for
- [ ] T-0: "Launch started" message posted
- [ ] T+15m: First health check passed — "Launch successful, monitoring" message sent
- [ ] T+1h: Status update posted (error rate, performance, any issues)
- [ ] T+24h: Launch retrospective / close-out message sent
- [ ] External status page updated at each milestone

### 9.2 Escalation Contacts

| Role | Name | Contact |
|------|------|---------|
| Incident Commander | | |
| Backend Lead | | |
| Infrastructure Lead | | |
| Frontend Lead | | |
| Cloudflare Contact | | |
| Neon Support | support@neon.tech | |
| GCP Support | [console.cloud.google.com/support](https://console.cloud.google.com/support) | |

---

## Sign-Off

| Phase | Owner | Signed Off | Time (EDT) |
|-------|-------|-----------|------------|
| 0 — Pre-Flight | | | |
| 1 — Infrastructure | | | |
| 2 — Security | | | |
| 3 — Monitoring | | | |
| 4 — DNS & Routing | | | |
| 5 — DB Migrations | | | |
| 6 — Deployment Verification | | | |
| 7 — Go-Live | | | |
| 8 — Post-Launch | | | |

**Final Go-Live Approval:**  
Name: _________________________ Date/Time: _________________________
