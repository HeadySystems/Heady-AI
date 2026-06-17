# Heady — Environment & Service-Provider Separation

> **Status:** Adopted 2026-06-17 · **Owner:** Eric Haywood  
> Governs how every service provider is partitioned between the **legacy** (V1, `main` branch) and
> the **rebuild** (turborepo, `rebuild` branch) so both remain fully functional and interchangeable.

---

## 1. Branch → Environment mapping

| Git branch | GitHub Environment | Purpose |
|---|---|---|
| `main` | `legacy` | Heady V1 — existing services, Cloud Run deploy |
| `main` | `legacy-staging` | Legacy staging/preview |
| `rebuild` | `rebuild` | Turborepo monolith, five-tier architecture |
| `rebuild` | `rebuild-staging` | Rebuild staging/preview |
| any | `development` | Shared dev/local (Law 0: no localhost on real services) |
| tags `v*` | `production` | Reserved for cutover — inactive until declared |

---

## 2. Service-provider namespacing by tier

### 2.1 GitHub (HeadySystems/heady-ai)

| Item | Legacy | Rebuild |
|---|---|---|
| Primary branch | `main` | `rebuild` |
| CI environments | `legacy`, `legacy-staging` | `rebuild`, `rebuild-staging` |
| PR labels | `scope:legacy`, `env:legacy-main` | `scope:rebuild`, `env:rebuild` |
| Cross-branch changes | Label `scope:cross-branch`; PR to **both** branches | same |
| Branch protection | Both `main` and `rebuild` require CI pass before merge | |

### 2.2 Cloudflare

| Resource | Legacy | Rebuild |
|---|---|---|
| Workers | `heady-*` (existing) | `heady-rebuild-*` prefix |
| Pages projects | existing pages projects | `heady-rebuild-*` pages projects |
| KV namespaces | existing (title contains no suffix) | suffix `--REBUILD` |
| Durable Objects | existing classes | new classes prefixed `Rebuild` in Workers |
| R2 buckets | `heady-*` (existing) | `heady-rebuild-*` |
| AI Gateway | `heady-gateway` (existing) | `heady-rebuild-gateway` |
| CLOUDFLARE_ACCOUNT_ID | same account (same account for both) | same |
| Wrangler deploy env | `--env legacy` (or no env) | `--env rebuild` |

**In `wrangler.toml`** on the rebuild branch, use named environments:
```toml
[env.rebuild]
name = "heady-rebuild-<service>"
kv_namespaces = [{ binding = "KV", id = "<rebuild-namespace-id>" }]

[env.legacy]
name = "heady-<service>"
kv_namespaces = [{ binding = "KV", id = "<legacy-namespace-id>" }]
```

### 2.3 GCP / Cloud Run

| Resource | Legacy | Rebuild |
|---|---|---|
| GCP Project | `heady-production` (existing) | `heady-rebuild` (new) |
| Cloud Run services | `heady-*` (in `heady-production`) | `heady-*` (in `heady-rebuild`) |
| Service account | existing SA | new SA `heady-rebuild-runner@heady-rebuild.iam.gserviceaccount.com` |
| Artifact Registry | existing | new repo `heady-rebuild` in `heady-rebuild` project |
| Secret Manager | existing secrets in `heady-production` | new secrets in `heady-rebuild` |
| Region | `us-central1` (per ADR) | `us-central1` (same) |
| GOOGLE_CLOUD_PROJECT env | `heady-production` | `heady-rebuild` |

### 2.4 Neon Postgres

| Resource | Legacy | Rebuild |
|---|---|---|
| Project | `heady-production` (existing project) | `heady-rebuild` (new project) |
| Branch | `main` | `main` |
| DATABASE_URL env | points to legacy project endpoint | points to rebuild project endpoint |
| Migrations | existing `0001–0023` | rebuild starts from `0001_init.sql` in `packages/db/` |
| pgvector | existing | fresh install on rebuild project |
| Neon branch for dev | `dev/legacy-*` | `dev/rebuild-*` |

### 2.5 Firebase / Firebase Auth

| Resource | Legacy | Rebuild |
|---|---|---|
| Firebase project | `heady-production` (existing) | `heady-rebuild` (new project) |
| Auth providers | existing 27 providers | mirror subset needed for rebuild |
| Firestore | existing collections | isolated collections (no shared writes) |
| `.firebaserc` | `{"projects": {"default": "heady-production"}}` | `{"projects": {"default": "heady-rebuild"}}` |
| Environment variable | `FIREBASE_PROJECT_ID=heady-production` | `FIREBASE_PROJECT_ID=heady-rebuild` |

### 2.6 Upstash Redis

| Resource | Legacy | Rebuild |
|---|---|---|
| Database | existing Redis DB | new Redis DB `heady-rebuild` |
| Key namespace | `heady:*` | `heady-rebuild:*` |
| QStash | existing | new QStash queue `heady-rebuild` |
| UPSTASH_REDIS_REST_URL | existing | new DB URL |

### 2.7 Linear

| Resource | Legacy | Rebuild |
|---|---|---|
| Team | `Heady` (existing) | `Heady Rebuild` (new team) |
| Project label convention | `[V1]` prefix on legacy issues | `[Rebuild]` prefix |
| Triage | Issues from `main` CI failures → Legacy team | Issues from `rebuild` CI → Rebuild team |
| linear.app workspace | `heady-ai` (shared — no fork needed) | same workspace |

---

## 3. Environment variable comparison (.env per environment)

```
# ── LEGACY (main branch) ──
ENVIRONMENT=legacy
CLOUDFLARE_ACCOUNT_ID=<shared>
CLOUDFLARE_API_TOKEN=<legacy-scoped-token>
DATABASE_URL=<neon-heady-production>
UPSTASH_REDIS_REST_URL=<legacy-upstash-url>
FIREBASE_PROJECT_ID=heady-production
GOOGLE_CLOUD_PROJECT=heady-production

# ── REBUILD (rebuild branch) ──
ENVIRONMENT=rebuild
CLOUDFLARE_ACCOUNT_ID=<shared>
CLOUDFLARE_API_TOKEN=<rebuild-scoped-token>
DATABASE_URL=<neon-heady-rebuild>
UPSTASH_REDIS_REST_URL=<rebuild-upstash-url>
FIREBASE_PROJECT_ID=heady-rebuild
GOOGLE_CLOUD_PROJECT=heady-rebuild
```

---

## 4. Interchangeability contract

Both environments maintain the same external API surface (`*.headysystems.com`) and can be 
swapped via feature flags or DNS cut-over without user impact:

- All 11 domain endpoints are logical routes — both builds respond to the same hostnames
- Health probes are identical: `GET /health` returns `{"env":"legacy"|"rebuild","status":"ok"}`
- No shared mutable state between legacy and rebuild data layers
- Rebuild reads from its own Neon project; legacy from its own — no cross-writes

---

## 5. Governance

- Changes to `main` targeting legacy infra → label `scope:legacy`
- Changes to `rebuild` → label `scope:rebuild`  
- Security patches, CI configs shared across both → label `scope:cross-branch`, PR to both
- This document lives at `docs/ENV_SEPARATION.md` and is governed by `SOURCE_OF_TRUTH.md`
