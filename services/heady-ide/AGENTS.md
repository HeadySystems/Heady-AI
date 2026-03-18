# AGENTS.md — Heady AI Coding Agent Guidelines

> Version: 1.0.0 | Updated: 2026-03-17 | Applies to all 78 Heady repos
> Drop this file in the root of every repository for AI coding agent compatibility.

## Identity

This codebase belongs to **HeadySystems Inc.** — the Heady™ Latent-Space Operating System.
- **Founder:** Eric Haywood
- **Architecture:** Liquid Architecture v9.0
- **IP:** 60+ provisional patents — treat patent-locked zones with care

## Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Backend | Node.js ESM, Express (Cloud Run), Hono (CF Workers) | No CommonJS `require()` |
| Frontend | Vanilla HTML/CSS/JS | No React/Vue/Angular |
| Database | Neon Postgres + pgvector | UUID PKs, TIMESTAMPTZ, vector(1536) |
| Cache | Upstash Redis | Namespace: `tenant:{id}:*` |
| Auth | Firebase Auth + 27 OAuth | Cross-domain SSO via `auth.headysystems.com` |
| Deploy | Cloud Run + CF Pages + CF Workers | φ-stepped canary: 5→25→50→100% |
| CI/CD | GitHub Actions + Turborepo | `turbo run build test --filter='...[origin/main...HEAD]'` |
| Observability | OpenTelemetry + Sentry + Langfuse | Structured JSON logs only |

## Coding Rules

1. **ESM only.** `import/export`, never `require()`.
2. **Zero `console.log`.** Use `pino` structured logger with `X-Heady-Trace-Id`.
3. **Zero `TODO`/`FIXME`/`HACK`.** If it's not done, don't commit it.
4. **Zero `localhost`.** All URLs from env vars. Cloud-deployed only.
5. **Zod validation** on all API inputs. No unvalidated data crosses service boundaries.
6. **HEADY_BRAND header** required in all new files (see template below).
7. **Redis keys** always namespaced: `tenant:{id}:*`.
8. **φ-derived constants.** Timeouts, TTLs, pool sizes from `phi-constants.js`. Zero magic numbers.
9. **Tests alongside code.** Vitest for unit, Playwright for E2E, k6 for load.
10. **Error handling everywhere.** No empty catch blocks. No swallowed promises.

## File Header Template

```javascript
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ [Module Name] v[X.Y.Z]                                ║
// ║  [One-line description]                                        ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝
```

## Architecture Patterns

- **Latent Service Pattern:** Every service exports `{ start, stop, health, metrics }`.
- **CSL Gates:** Use `cslGate(value, cosScore, tau)` for thresholds, not `if/else`.
- **φ-Scaling:** `phiBackoff()` for retries, `FIB[n]` for pool sizes, `PHI_7 * 1000` for heartbeats.
- **3-Tier Memory:** T0 Redis (hot, 21h) → T1 Neon pgvector (warm, 47h) → T2 Qdrant (cold, 144h).
- **Fallback Chain:** Every critical function has a fallback. Never single point of failure.
- **Circuit Breaker:** 5 failures → open, φ-backoff (1,618,034µs base), probe after 30s.

## Patent Lock Zones

Files marked with `⚠️ PATENT LOCK` require ARBITER swarm review before modification.
Patent IDs: HS-2026-051 through HS-2026-062.

## Environment Variables

All secrets from GCP Secret Manager or `.env` with `[SECRET]` markers. Key env vars:
- `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `DATABASE_URL` (Neon Postgres)
- `INTERNAL_NODE_SECRET` (inter-service auth)
- `VAULT_PASSPHRASE` (API key encryption)

## Testing

```bash
# Unit tests
npx vitest run

# Lint
npx eslint src/ --ext .js,.ts

# Type check (if TS)
npx tsc --noEmit

# Build (monorepo)
npx turbo run build test --filter='...[origin/main...HEAD]'
```

## Deploy

```bash
# Cloud Run (φ-stepped canary)
gcloud run deploy heady-manager --image gcr.io/gen-lang-client-0920560496/heady-manager:$VERSION \
  --region us-central1 --min-instances 1 --max-instances 13

# Cloudflare Workers
npx wrangler deploy

# Cloudflare Pages
npx wrangler pages deploy dist/
```

## Do Not

- Add React, Vue, Angular, or any frontend framework
- Use `localhost`, `127.0.0.1`, or hardcoded URLs
- Write placeholder code, stubs, or TODO comments
- Use magic numbers — derive from `PHI`, `PSI`, or `FIB[]`
- Commit secrets to source control
- Skip error handling or validation
- Modify patent-locked files without review

---

*∞ Sacred Geometry · Liquid Intelligence · Permanent Life ∞*
*© 2026 HeadySystems Inc. — Eric Haywood, Founder*
