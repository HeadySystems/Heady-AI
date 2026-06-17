# Branch Parity Manifest
_Last updated: 2026-06-17_

## Intentional divergences

| Area | main behavior | rebuild behavior |
|---|---|---|
| Package manager | npm | pnpm |
| Process manager | PM2 | Cloud Run --source |
| Archive directories | Present (_archive/, _downloads/) | Absent |
| Lockfile count | 69 package-lock.json | 1 pnpm-lock.yaml |

## Capabilities present on both branches

- [ ] Governance corpus + CI coherence gate (pending: port from #207 to main)
- [x] Heady swarm orchestration core
- [ ] Dependabot scoping to active manifests only (pending: apply to main)

## Capabilities on rebuild only (pending port decision)

- pnpm workspace monorepo layout
- PR #207 scoped dependabot.yml

## Capabilities on main only (do-not-port)

- PM2 process supervision config
- Legacy _archive/ reference files
