# ADR-0017: Projections Engine & Lifecycle

- **Status:** Accepted (2026-06-17, founder approval per ADR-0013)
- **Deciders:** Eric Anthony Haywood

## Context

ADR-0001 made the monorepo canonical and said satellites either fold in or carry a projection manifest.
The public `*-core` shells that survive need a *governed* projection mechanism so a shell can never
masquerade as a backend ("projection drift"). Source: `Eng_Playbook.md` §3–4; runtime arm = SyncProjectionBee;
console surface = the MCP Console (`06-governance.md` §G7).

## Decision

1. **A projection is a pure one-way derivation** `(monorepo_SHA, source_path, transform_fn) → public
   repo`. Four invariants: **one-way** (no upstream writes), **content-addressable** (SHA-256 sorted-tree
   hash, excluding `.git`/`node_modules`/build/`private_paths`), **manifest-authoritative**, and
   **license/patent-bounded**.
2. **Manifest** (`projection.yaml`, JSON-Schema 2020-12): `id, source_path, target_repo, projection_type,
   deploy_target, live_url, health_url, status, last_sync_commit, last_sync_hash, last_verified_at, owner,
   license, drift_policy, private_paths, transformations, canary_config`. This is what the MCP Console
   reads to render `real_service` vs `projection_only`.
3. **Tooling:** Google Copybara (Starlark, SQUASH, `GitOrigin-RevId`) for history + a small **Node
   projector** owning hashing, drift, manifest enforcement, deploy dispatch. Josh rejected (its `push`
   violates one-way); `git subtree` only for bootstrap.
4. **Drift detection** (cron, 15 min): `in-sync` / `source-ahead` (re-project) / `projection-ahead`
   (**page + freeze** — unexpected).
5. **Lifecycle (six states):** `proposed→scaffolded→active→deprecated→archived→eliminated`; backward
   forbidden except `deprecated→active`. Deprecate injects RFC-8594 `Sunset = +89d`; eliminate gated on
   zero inbound refs + <13 req/day for 34d + archived ≥34d + no open P0/P1 + dual approval.
6. **Patent-locked content** stripped via `.headyignore` + manifest `private_paths` + inline
   `// HEADY-INTERNAL-BEGIN/END`.

## Consequences

- (+) Shells tell the truth about themselves; drift is observable and frozen on anomaly.
- (+) Patent/IP boundaries are mechanically enforced at projection time.
- (−) Copybara + projector is real infrastructure to maintain — justified by killing projection drift.
- Implements ADR-0001. See ADR-0011 (drift paging), `Eng_Playbook.md`.
