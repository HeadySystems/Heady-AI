# HEA-304 — Codex Directive
@codex Own this work end to end. All code is at https://github.com/HeadySystems/heady-ai on the rebuild branch.
Drive each item to completion. Prefer acting directly over asking for unnecessary confirmation.
Surface only material blockers or decisions that require human input.

## Context files committed (Wave 3 + 4, 2026-06-17)
All files below have been committed or are ready to commit to rebuild.

### Foundation (shared/)
- `shared/phi-math.js` — all φ constants, CSL thresholds, phiBackoff, CSL gates
- `shared/csl-engine.js` — cosineSimilarity, routeByCoherence, coherenceGate, detectDrift
- `shared/logger.js` — Pino JSON logger (childLogger export)
- `shared/health.js` — health endpoint factory
- `shared/config.js` — Zod-validated env

### Core (src/core/)
- `src/core/heady-bee.js` — HeadyBee base class (spawn/execute/report/retire, withRetry)
- `src/core/heady-conductor.js` — CSL router (register, dispatch, healthReport)

### Bees (src/bees/)
- `src/bees/memory-bee.js` — T0 Redis → T2 pgvector (384-dim HNSW, patent HS-2026-017)
- `src/bees/sentinel-bee.js` — coherence drift detection + P1 Sentry escalation
- `src/bees/ai-router-bee.js` — Claude → Groq → GPT-4o fallback chain (patent HS-2026-022)

### Resilience (src/resilience/)
- `src/resilience/circuit-breaker.js` — phi-scaled thresholds (fail=8, success=2, timeout=21s)

### Middleware (src/middleware/)
- `src/middleware/security.js` — Helmet + phi rate limits + CORS (all 11 domains)
- `src/middleware/firebase-auth.js` — requireAuth / optionalAuth

### Routes (src/routes/)
- `src/routes/checkout.js` — Stripe session creation (HEA-310)
- `src/routes/pricing.js` — plan data API (HEA-309)
- `src/routes/webhook.js` — Stripe webhook + Firebase claim setting (HEA-311, HEA-313, HEA-314)

### Edge (cloudflare/)
- `cloudflare/worker.js` — Hono edge router, CORS, rate limiting, proxy to Cloud Run
- `cloudflare/wrangler.toml` — all 11 domain routes

### Tests
- `tests/unit/phi-math.test.js` — 25 assertions (phi, fib, CSL gates, backoff)
- `tests/unit/circuit-breaker.test.js` — 7 assertions
- `tests/integration/checkout.test.js` — Stripe session + webhook + pricing + health

## Your task queue (ordered, no blockers after setup)

### SETUP (do once, 10 min)
1. Verify `.env` has all required vars from `.env.example`
2. Run `pnpm install && pnpm test` — should pass phi-math and circuit-breaker tests
3. Run `node scripts/governance-check.js` — should pass clean

### HEA-308: Define monetization requirements
1. Review `src/config/pricing.js` plan config (Heady Pro $29, Enterprise $299/$2990, API $21)
2. Ensure all 4 Stripe price IDs are mapped correctly
3. Document any missing fields in a comment in `src/config/pricing.js`

### HEA-309: Add pricing page data (DONE — route exists)
1. `GET /pricing/plans` already returns plan data
2. Wire up to headysystems.com and headyme.com pricing pages
3. Integration test exists: `tests/integration/checkout.test.js#GET /pricing/plans`

### HEA-310: Add paid conversion flow
1. `POST /checkout/session` is implemented
2. Add redirect from pricing page CTA → `POST /checkout/session` → Stripe Checkout
3. On return: `GET /welcome?session_id=...` → verify session, set tier in Firebase, show success
4. Required: `src/routes/success.js` — validate session_id, return { plan, customerId }

### HEA-311: Track monetization funnel
1. Sentry.metrics.increment calls are in `webhook.js` and `pricing.js`
2. Add funnel events to: landing page CTA click, pricing plan select, checkout start, checkout complete
3. Frontend: `POST /api/funnel/event` with { event, plan, sessionId }
4. Create `src/routes/funnel.js` — stores event in Neon + emits Sentry metric

### HEA-312: Review website copy and CTAs
1. Audit headysystems.com, headyme.com, headyai.com for conversion copy
2. CTAs should say "Start free trial" (Pro) and "Contact sales" (Enterprise)
3. Ensure UTM params are preserved through checkout flow (utm_source, utm_medium, utm_campaign)

### HEA-313: Instrument revenue-critical funnel events in Sentry
1. Add `Sentry.metrics.distribution('funnel.time_to_checkout', ms)` at checkout session creation
2. Add `Sentry.metrics.set('funnel.unique_plans_viewed', plan)` at `GET /pricing/plans`
3. Add custom dashboard: Funnel → views → sessions → completions → revenue

### HEA-314: Set Sentry alerts for checkout and signup failures
1. Alert rule: `invoice.payment_failed > 3 in 5 min` → Slack #alerts + PagerDuty
2. Alert rule: `checkout.session.completed` drops to 0 for >30 min during business hours
3. Alert rule: `POST /checkout/session` p95 latency > 2618ms (φ^3 * 1000 / 1.618 ≈ 2618ms)

### HEA-315–317: Sentry dashboards + ownership rules
1. **HEA-315:** Release health → add `Sentry.init({ release: process.env.COMMIT_SHA })`
2. **HEA-316:** Dashboard → Checkout Funnel widget using custom metrics from HEA-313
3. **HEA-317:** Ownership rules → set `src/routes/checkout.js` and `src/routes/webhook.js` to owner: eric@headyconnection.org

## Required secrets (Cloud Run + GitHub Secrets)
All secrets listed in `.env.example`. Add them via:
```bash
gcloud secrets create STRIPE_SECRET_KEY --data-file=- <<< "sk_live_..."
gcloud run services update heady-origin --update-secrets=STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:latest --region=us-central1
```
GitHub Actions: add all secrets at https://github.com/HeadySystems/heady-ai/settings/secrets/actions

## Definition of Done for HEA-304
- [ ] `pnpm test:coverage` passes with ≥89% line coverage
- [ ] `pnpm lint` exits 0
- [ ] `node scripts/governance-check.js` exits 0
- [ ] CI pipeline (verify + scan + governance) passes on rebuild
- [ ] Cloud Run deploy completes → `/health` returns 200
- [ ] `POST /checkout/session` returns a valid Stripe session URL for all 3 plans
- [ ] Stripe webhook receives events and sets Firebase custom claims
- [ ] Sentry DSN active — events visible in dashboard
- [ ] `GET /pricing/plans` returns all 3 tiers with correct price IDs
- [ ] 501(c)(3) status noted in headyconnection.org footer copy (effective 2026-01-03)
