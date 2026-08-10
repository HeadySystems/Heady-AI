---
description: Sync all git remotes in the Heady multi-remote topology
---

> Transferred 2026-08-09 from ~/.agents/workflows during the rebuild command consolidation.
> ⚠ Remote topology references (HeadyInc/Heady, 16+ remotes) predate the rebuild — Heady-AI currently has a single `origin` (HeadySystems/Heady-AI); verify against current remote state before running.

# Heady Multi-Remote Sync

// turbo-all

The Heady monorepo uses 16+ git remotes for redundancy and multi-agent access. Use this workflow to synchronize all remotes.

## Step 1: List All Configured Remotes

```bash
cd ~/Heady-AI && git remote -v
```

Verify that all expected remotes are present. The standard set includes:
- `origin` — primary GitHub remote (HeadyInc/Heady)
- `codex` — Codex-contributed remote
- `claude` — Claude Code remote
- `backup` — secondary backup remote
- Additional AI agent remotes as configured

## Step 2: Fetch and Status Check

```bash
# Fetch all remotes
git fetch --all --prune
# Show divergence from each remote
for remote in $(git remote); do
  echo "=== $remote ==="
  git log --oneline HEAD..$remote/main 2>/dev/null | head -5
  git log --oneline $remote/main..HEAD 2>/dev/null | head -5
done
```

## Step 3: Push to All Remotes

```bash
# Push current branch to all remotes
for remote in $(git remote); do
  echo "Pushing to $remote..."
  git push "$remote" HEAD 2>&1 | tail -1
done
```

## Step 4: Handle Divergence

If any remote has diverged:

```bash
# For non-force-push situations — merge the remote changes first
git fetch REMOTE_NAME
git merge REMOTE_NAME/main --no-edit

# For force-push situations (CAUTION — only when you are certain local is correct)
git push REMOTE_NAME HEAD --force-with-lease
```

## Step 5: Verify Sync Status

```bash
# Print sync status table
echo "Remote Sync Status:"
echo "==================="
for remote in $(git remote); do
  local_sha=$(git rev-parse HEAD)
  remote_sha=$(git rev-parse "$remote/main" 2>/dev/null || echo "N/A")
  if [ "$local_sha" = "$remote_sha" ]; then
    echo "✅ $remote — in sync"
  else
    echo "❌ $remote — diverged (local: ${local_sha:0:7}, remote: ${remote_sha:0:7})"
  fi
done
```

## Rules

- Always `fetch --all` before pushing to detect conflicts
- Never force-push without `--force-with-lease`
- Document any unresolvable divergence in the `integration/ai-remote-sync` branch
- Reference the `heady_decentralized_ai_integration` KI for the full remote topology
