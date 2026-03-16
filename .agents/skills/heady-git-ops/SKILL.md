---
name: heady-git-ops
description: Use when automating daily git workflows, branch management, commit formatting, PR creation, or multi-remote push operations in the Heady™ ecosystem. Keywords include git, branch, commit, PR, push, merge, pull request, remote, conventional commits, git workflow.
metadata:
  author: HeadySystems
  version: '1.0'
---

# Heady™ Git Ops

## When to Use This Skill

Use this skill when the user needs to:
- Automate repetitive git workflows (branch → commit → push → PR)
- Push to multiple remotes simultaneously
- Format commit messages following conventional commits
- Manage feature branches with standard naming
- Create pull requests with auto-generated descriptions

## Instructions

### Branch Naming Convention

```
<type>/<ticket>-<description>
```

| Type | Use |
|---|---|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `refactor/` | Code refactor |
| `docs/` | Documentation only |
| `chore/` | Maintenance, deps, config |
| `hotfix/` | Emergency production fix |

### Conventional Commit Format

```
<type>(<scope>): <description>

[body]

[footer]
```

Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `perf`, `ci`, `build`.

### Multi-Remote Push

The Heady monorepo pushes to 4 remotes:

```bash
git push headyai main     # HeadyAI/Heady (primary)
git push hc-main main     # HeadyConnection/Heady-Main
git push production main  # HeadyMe/heady-production
git push hs-main main     # HeadySystems/Heady-Main
```

### Full Workflow Automation

```bash
# 1. Create feature branch
git checkout -b feat/ABS-001-crdt-collaboration

# 2. Make changes + stage
git add -A

# 3. Commit with conventional format
git commit -m "feat(collab): implement LiquidMesh CRDT multiplayer editing

- Yjs integration with y-websocket provider
- Awareness CRDT for live cursors
- Per-agent Y.UndoManager
- Firebase JWT session auth

Refs: ABS-001"

# 4. Push to origin and create PR
git push origin feat/ABS-001-crdt-collaboration
gh pr create --title "feat: LiquidMesh CRDT multiplayer" --body "..." --base main

# 5. After merge, push main to all remotes
git checkout main && git pull
git push headyai main && git push hc-main main && git push production main && git push hs-main main
```

### PR Description Template

```markdown
## Summary
[One-line description]

## Changes
- [Change 1]
- [Change 2]

## Pipeline Task
Refs: [ABS-XXX / FEAT-XXX / etc.]

## Testing
- [ ] Unit tests pass
- [ ] Linter clean
- [ ] Manual verification

## Screenshots
[If applicable]
```

## Output Format

- Branch Status
- Commit Log
- PR URL
- Push Status (per remote)
