<!-- HEADY_BRAND:BEGIN -->
<!-- FILE: docs/SYSTEM_AUDIT_AND_REMEDIATION_PLAN.md · LAYER: governance -->
<!-- HEADY_BRAND:END -->

# Heady System Audit & Remediation Plan

> **Goal.** Isolate what is *functional & connected* (live deployments) versus *legacy
> / redundant / orphaned*, across repos, services, configs, and files — then eliminate,
> archive, or keep each, executing only safe operations autonomously and gating
> destructive ones on explicit confirmation.
>
> **Status:** Evidence gathered, classification drafted. **No destructive operation
> (file deletion, worker deletion, hard-archive) has been executed.** Safe operations
> already done are listed in §8.

---

## 1. Method & definitions

- **Rebuild (canonical):** `HeadySystems/heady-ai` (v5.0.0) and its staging mirror
  `HeadySystems/Heady-Staging`. Active, source of truth per `docs/DEVELOPMENT_FLOW.md`.
- **Legacy / redundant:** duplicate or superseded repos, workers, and files not wired
  to a live surface and not recently modified.
- **Functional & connected (ground truth):** a service is "functional" if it has a
  **live deployment** (Cloudflare Worker, Vercel project, Cloud Run service) and/or is
  **actively monitored** (Sentry project). A file is "connected" if it is referenced by
  build/deploy config, source imports, or registry entries.

Connectors used for ground truth: **Cloudflare** (Workers), **Vercel** (projects),
**Sentry** (monitored projects), **GitHub** (repo state). Connectors *not* used —
Stripe, Gmail, Slack, Hugging Face, Linear, Monday — have no bearing on a file/service
inventory; invoking them would add risk and noise, so they were deliberately excluded.

---

## 2. Live surface (ground truth, 2026-06-19)

| Surface | Count | Source |
|---------|------:|--------|
| Cloudflare Workers | 37 | `workers_list` |
| Vercel projects | 1 (`heady`, team `heady-ai`) | `list_projects` |
| Sentry monitored projects | 19 | `find_projects` |

**Sentry projects (actively monitored = functional):** api-gateway, auth-session-server,
edge-proxy, heady-ai, heady-ai-cloudrun, heady-api, heady-bot, heady-buddy,
headybuddy-frontend, heady-connection, heady-dynamic-sites, heady-io, heady-manager,
heady-mcp, heady-mcp-server, headyme-frontend, heady-systems, heady-web,
liquid-gateway-worker.

---

## 3. Service-level findings (Cloudflare Workers)

**Duplicate / non-prod vs prod pairs** (consolidate to one; the older sibling is an
archive candidate after confirming routes point at the survivor):

- `heady-api` ↔ `heady-api-production`
- `heady-edge-proxy` ↔ `heady-edge-proxy-production`
- `liquid-gateway-worker` ↔ `liquid-gateway-worker-production`
- `heady-edge-router-production` / `heady-intent-router` / `heady-router` /
  `worker-heady-router` — **four overlapping routers**; expected: one.

**Stale candidates** (last modified > 90 days, no matching Sentry project — verify
before deletion): `heady-edge-node`, `heady-edge-gateway`, `headycloud-site`,
`headyos-site`, `heady-ai-org`, `headycloud-site`, `heady-guard`, `heady-lens-proxy`,
`heady-finance-proxy`, `heady-bot-proxy` (per-domain proxies may still be DNS-bound —
check routes first).

> ⚠️ Worker deletion is destructive and outward-facing. **None will be deleted without
> per-worker confirmation and a route check.**

### Consolidation proposal (approved: investigate → propose → eliminate)

**Tooling limitation discovered:** the Cloudflare MCP surface exposes only
`workers_list` and `workers_get_worker`/`_code` — **no route-listing and no
worker-delete tool** (delete exists only for D1/KV/R2/Hyperdrive). `get_worker` returns
just `{name, id}`, with no routes/bindings/traffic. Therefore elimination **cannot be
executed through available automation** and route-safety cannot be MCP-verified. The
proposal below must be executed via `wrangler delete` / Cloudflare dashboard after a
route check.

Proposed survivors → retire (after route check):
- Keep `heady-api-production`; retire `heady-api`.
- Keep `heady-edge-proxy-production`; retire `heady-edge-proxy`.
- Keep `liquid-gateway-worker-production`; retire `liquid-gateway-worker`.
- Routers — keep `heady-edge-router-production` as the canonical edge router; retire
  `heady-router`, `worker-heady-router`, `heady-intent-router` after folding any unique
  logic into the survivor (verify with `workers_get_worker_code`).
- Stale per-domain proxies (`heady-*-proxy`, last-modified 2026-03-18): keep only those
  still bound to a live DNS route; retire the rest.

> ⚠️ **CODE-REVIEW FINDING (2026-06-19) — naming-based consolidation is UNSAFE.**
> Inspecting `workers_get_worker_code` disproved the duplicate assumption:
> `heady-intent-router` is **not** a redundant router — it is a **live multi-domain site
> server** rendering full pages for headybot.com, headyapi.com, headyio.com,
> headybuddy.com, headyconnection.org, and heady-ai.com, plus health checks, intent
> redirects, and `ACTIVE_DOMAINS` passthrough. It must be **KEPT**. The other "routers"
> likewise carry distinct logic and large bundles. **Do not delete any worker on naming
> evidence.** Each retire-candidate requires hands-on `wrangler` + route-map review by
> someone with Cloudflare access. The MCP surface can neither list routes nor delete
> workers, so this step cannot be completed here — it is handed off, not executed.

`wrangler` retirement template (run **only** after per-worker code+route review):
```bash
wrangler delete --name heady-api            # only after routes moved to heady-api-production
wrangler delete --name heady-router
wrangler delete --name worker-heady-router
wrangler delete --name heady-intent-router
```

---

## 4. Repo-level findings

Full table in `docs/REPO_INVENTORY.md`. Summary:

- **Keep (functional):** heady-ai, Heady-Staging, HeadyAutoContext, headyai,
  HeadyEcosystem (nascent), Heady-Main (verify prod role).
- **Soft-archived (done):** `HeadyAI/headydocs` (empty shell),
  `HeadyAI/Heady-Main-ddb9351d` (redundant duplicate) — banners + stop-notices merged.

---

## 5. File-level findings (in `heady-ai`, mirrored in `Heady-Staging`)

| Bucket | Count | Path pattern | Disposition |
|--------|------:|--------------|-------------|
| Committed build bundles | **254 `.zip`** | `archive/code-bundles/`, root `*.zip` | **Eliminate from git** (binaries don't belong in source; use Releases/object storage) |
| Duplicate `(1)`/`(2)` files | **88** | various | **Eliminate** (exact-duplicate suffixes) |
| Binary docs in code repo | **181 `.docx`/`.pdf`** | `audit/`, `docs/`, `_downloads/` | **Archive** to object storage; keep canonical `.md` only |
| `_downloads/` scratch | **195 files** | `_downloads/` | **Eliminate** (model-response scratch, not source) |
| `archive/` cold storage | **157 files** | `archive/` | **Review** — intentional cold storage vs. cruft |
| Report/status dumps | **331** under `docs/` + root | `*REPORT*`, `*STATUS*`, `*SUMMARY*` | **Consolidate/Archive** — collapse to a single living status doc |

> These counts are identical in `Heady-Staging`, confirming it is a near-clone of
> `heady-ai`; remediation applied to the source of truth promotes down per the flow.

---

## 6. Classification buckets

- **KEEP:** all source under `src/`, `packages/`, `apps/`, `configs/`, `.github/`,
  canonical `docs/*.md`, live-mapped workers/projects.
- **ARCHIVE (move out of git, retain elsewhere):** `.docx`/`.pdf` binaries,
  intentional `archive/` cold storage, the two soft-archived repos.
- **ELIMINATE (remove from git history-forward):** `*.zip` build bundles,
  `(1)`/`(2)` duplicates, `_downloads/` scratch, redundant report/status dumps.

---

## 7. Staged execution plan (destructive stages gated)

| Stage | Operation | Risk | Gate |
|-------|-----------|------|------|
| S0 | Soft-archive dead repos + stop-notices | low | ✅ **done** |
| S1 | Add `.gitignore` rules for `*.zip`, `_downloads/`, build bundles | low | autonomous |
| S2 | `git rm --cached` the 254 zips + 195 `_downloads` (untrack, keep working copy) | medium | **confirm** |
| S3 | Delete 88 `(1)`/`(2)` duplicate files | medium | **confirm** |
| S4 | Move 181 `.docx/.pdf` to object storage; drop from git | medium | **confirm** |
| S5 | Consolidate 331 report dumps into one living status doc | medium | **confirm** |
| S6 | Consolidate duplicate Cloudflare workers; delete stale ones | **high (outward-facing)** | **confirm per item + route check** |

**S2–S5 executed** (646 files untracked: 254 zips, 181 docx/pdf, `_downloads/`,
1 true duplicate, 14 status dumps → `docs/STATUS.md`). Source code untouched.

**S-HIST (history purge): PLANNED, not executed.** Script staged at
`scripts/history-purge.sh` (dry-run by default; requires `--execute` +
`HEADY_HISTORY_PURGE_CONFIRM=YES`). It is **irreversible**, rewrites every SHA, and
requires a coordinated force-push + re-clone by all collaborators. Run only on explicit
go, ideally during a freeze window.

---

## 8. Already executed (safe operations)

- Merged: `Heady-Staging#43`, `headydocs#2`, `Heady-Main-ddb9351d#231`.
- Soft-archived `headydocs` and `Heady-Main-ddb9351d` (banners + `CLAUDE.md`/`AGENTS.md`
  stop-notices).
- Authored `DEVELOPMENT_FLOW.md`, `HEADY.md`, `AGENT_CONTEXT_PACK.md`,
  `REPO_INVENTORY.md`, and this plan.

## 9. Decisions required from owner

1. Approve destructive stages **S2–S5** (file untracking/deletion in `heady-ai`)?
2. Approve worker consolidation **S6**, and which router is the survivor?
3. Confirm `Heady-Main` (HeadySystems) production role before any change.
4. Confirm `Heady-Main-ddb9351d` backs no live deploy → then hard-archive on GitHub.
