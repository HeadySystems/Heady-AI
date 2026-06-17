<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  HEADY™ · DUAL_ACTIVE_BRANCH_STRATEGY.md                            ║
<!-- ║  Dual-active branch model: main + rebuild both live.             ║
<!-- ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END -->

# Dual-Active Branch Strategy
**Repository:** HeadySystems/heady-ai
**Author:** Eric Haywood, Founder — HeadySystems Inc. (Colorado C-Corp, EIN 41-3412204)
**Date:** 2026-06-17
**Status:** Active policy
**Supersedes:** `MAIN_TO_REBUILD_MIGRATION_PLAN.md` (retirement model)

## 1. Purpose
Both `main` and `rebuild` are first-class, always-deployable branches in `HeadySystems/heady-ai`. Neither branch is retired, frozen, or subordinate to the other. They serve distinct but parallel purposes and can be interchanged as the active deployment target at any time.

This replaces the one-way cutover model described in `MAIN_TO_REBUILD_MIGRATION_PLAN.md`. The Dependabot alert reduction goal from that plan is preserved here — but achieved through Dependabot scoping rather than branch retirement.

## 2. Branch Identities

| Property | main | rebuild |
|---|---|---|
| **Role** | Legacy-compatible stable line | Clean-slate next-gen line |
| **Lockfile model** | npm (`package-lock.json`, scoped) | pnpm (`pnpm-lock.yaml`, single) |
| **Archive / downloads** | Present (1,193 `_archive/`, 195 `_downloads/`) | Absent |
| **Commit depth** | 8,542+ commits | 12+ commits (growing) |
| **Deploy target** | `heady-main` Cloud Run service | `heady-rebuild` Cloud Run service |
| **Dependabot config** | `.github/dependabot-main.yml` | `.github/dependabot-rebuild.yml` (PR #207) |
| **CI workflow** | `.github/workflows/ci-main.yml` | `.github/workflows/ci-rebuild.yml` |
| **GitHub default branch** | Yes (ergonomic choice only) | No |
| **Protected** | Yes (full) | Yes (full — see §4) |
| **May be retired** | Only by explicit future decision | Only by explicit future decision |

> **Rule 0 — No forced succession.** `rebuild` being newer does not make `main` obsolete. `main` being the GitHub default does not make `rebuild` secondary. Both are production-grade.

## 3. Guiding Principles

1. **Parallel parity, not replacement.** Work that needs to exist on both branches must be ported explicitly. Neither branch auto-inherits from the other.
2. **No cross-branch merges.** Never merge `main` into `rebuild` or vice versa — this would reintroduce the lockfile sprawl or corrupt the clean-slate model. Transfer is by cherry-pick or manual reimplementation only.
3. **Protection is symmetric.** Both branches carry equal protection rules. No unreviewed commits land on either.
4. **Deploy topology is fixed per branch.** `main` → `heady-main` service; `rebuild` → `heady-rebuild` service. Traffic switching happens at the Cloud Run / Cloudflare layer, not by deleting a branch.
5. **Alert noise is scoped, not silenced.** The 777 Dependabot alerts from `main`'s dead lockfiles are managed by scoping `dependabot-main.yml` to active manifests, not by promoting `rebuild` over `main`.
6. **Interchange is a runtime decision.** Switching active production between branches is a traffic-routing operation, documented in §7. It does not require any Git operations.
7. **Reversible at every step.** Every operation in this document has an explicit rollback.

## 4. Branch Protection (Both Branches)

Apply the following rules identically to both `main` and `rebuild`.

```bash
# Snapshot existing main protection first (rollback record)
gh api repos/HeadySystems/heady-ai/branches/main/protection \
  > main-protection-snapshot.json

# Apply to rebuild (if not yet protected)
gh api -X PUT repos/HeadySystems/heady-ai/branches/rebuild/protection \
  --input rebuild-protection.json
```

**Required rules on both branches:**
- Required PR reviews: ≥ 1 (2 for breaking changes per `release-process.md`)
- Commit signing required
- Linear history enforced
- Conversation resolution required before merge
- Enforce for admins (no direct push; admin override for hotfixes only)
- Required status checks: `verify`, `scan`, `governance`

## 5. CI Topology — Separate Workflows Per Branch

Each branch runs its own CI workflow. They may differ in required checks but must both gate on `verify`, `scan`, and `governance`.

```text
.github/
  workflows/
    ci-main.yml        ← triggered on push/PR to main
    ci-rebuild.yml     ← triggered on push/PR to rebuild
  dependabot-main.yml  ← scoped to active npm manifests on main only
  dependabot-rebuild.yml ← PR #207 config; scoped to pnpm-lock.yaml
```

## 6. Dependabot Scoping — Reducing Alert Noise Without Retiring Main

The 777 alerts on `main` are ~19 unique advisories × 69 orphaned `package-lock.json` files. They are a noise problem, not a real exposure problem. Scope Dependabot to suppress duplicate alert generation without deleting the branch or its history.

`.github/dependabot-main.yml` (create/update):
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"              # root manifest only — not _archive/ or _downloads/
    schedule:
      interval: "weekly"
    ignore:
      - dependency-name: "*"
        update-types: ["version-update:semver-patch"]   # reduce noise further
    labels: ["dependencies", "main-branch"]
```
*Do NOT add entries for subdirectories under `_archive/` or `_downloads/`.*

## 7. Interchange Protocol — Switching the Active Production Branch

"Interchange" means changing which branch serves live production traffic. This is a traffic-routing operation only.

### 7.1 Cloud Run Traffic Switch
```bash
# Promote rebuild to 100% production traffic
gcloud run services update-traffic heady-gateway \
  --region=us-central1 \
  --to-revisions=LATEST=100 \
  --project=heady-production

# Roll back to main-based revision
MAIN_REVISION=$(gcloud run revisions list \
  --service=heady-main \
  --region=us-central1 \
  --limit=1 \
  --format='value(name)' \
  --sort-by=~createTime)

gcloud run services update-traffic heady-gateway \
  --region=us-central1 \
  --to-revisions="${MAIN_REVISION}=100" \
  --project=heady-production
```

### 7.2 Cloudflare Routing Switch
If traffic is routed at the Cloudflare Workers / Pages layer:
```bash
# Point production origin to rebuild service
wrangler vars put ACTIVE_ORIGIN "https://heady-rebuild-<hash>-uc.a.run.app" --env production
# Revert to main service
wrangler vars put ACTIVE_ORIGIN "https://heady-main-<hash>-uc.a.run.app" --env production
```

## 8. Porting Protocol — Moving Work Between Branches

Because the branches cannot be merged, changes travel between them by explicit porting only.

### 8.1 PR Labels for Tracking
| Label | Meaning |
|---|---|
| `target:main` | This PR lands on main only |
| `target:rebuild` | This PR lands on rebuild only |
| `port-to-main` | Merged on rebuild; also needs a port PR to main |
| `port-to-rebuild` | Merged on main; also needs a port PR to rebuild |
| `do-not-port` | Intentional divergence — do not port to the sibling branch |
| `behavior-diverges` | Functionally equivalent but implementation differs per branch |

### 8.2 Cherry-Pick Port
```bash
# After merging SHA abc1234 into rebuild, port to main:
git checkout main
git pull origin main
git cherry-pick -x abc1234   # -x annotates commit with source SHA
git push origin main         # triggers CI, then PR review as normal
```

### 8.3 Manual Port
When cherry-pick fails cleanly:
1. Open a new branch from the target branch.
2. Manually reimplement the change.
3. PR description must include `Ports: #NNN` linking to the source PR.

## 9. Deployment Topology

```text
                    ┌──────────────────────────────────────────────┐
                    │  Cloudflare (headyme.com / headysystems.com) │
                    │  Workers / Pages routing                     │
                    └──────┬────────────────────┬──────────────────┘
                           │                    │
              ACTIVE_ORIGIN│      STANDBY_ORIGIN│
                           ▼                    ▼
              ┌────────────────────┐   ┌────────────────────┐
              │  Cloud Run         │   │  Cloud Run         │
              │  heady-rebuild     │   │  heady-main        │
              │  (rebuild branch)  │   │  (main branch)     │
              └────────────────────┘   └────────────────────┘
                  pnpm / clean-slate       npm / legacy-compat
```

## 10. Immediate Actions
1. Apply branch protection to `rebuild` per §4 (highest priority).
2. Create `.github/dependabot-main.yml` per §6 to scope alert generation on main.
3. Batch-close dead lockfile Dependabot PRs on main per §6 script.
4. Merge PR #207 into rebuild (governance + scoped dependabot config).
5. Backport governance CI gate from PR #207 to main CI workflow.
6. Create `docs/BRANCH-PARITY.md` per §11.
7. Create `PARITY_LOG.md` at repo root.
8. Triage PRs #203 and #189 per §9.
9. Deploy heady-rebuild Cloud Run service.
10. Set `STANDBY_ORIGIN` in Cloudflare.

---
φ = 1.618033988749895 · Fibonacci-scaled limits per LAW-10 Sacred Geometry.
*© 2026 HeadySystems Inc. — Eric Haywood, Founder*
