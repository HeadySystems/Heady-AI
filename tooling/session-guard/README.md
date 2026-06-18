# @heady/session-guard — stop autonomous writers from racing your edits

**Problem this solves.** This machine runs several processes that commit/push on their own. They
share one git identity (`Eric Haywood <eric@headysystems.com>`), so their commits are
indistinguishable from yours, and they interleave with active work — clobbering edits, injecting
commits mid-session, reverting a file you just changed. You said *"I don't know what to pause."*
This is the answer: **one machine-wide lock that every writer consults, enforced at the git layer
so no local writer can race past it** — with a TTL so a crashed session never blocks forever.

## The autonomous writers found on this machine (2026-06-18)

| Writer | How it runs | What it does | Now coordinated? |
|--------|-------------|--------------|------------------|
| `auto-commit-push.sh` | **cron `*/5`** (`/home/headyme/Heady/scripts/`) | commits + pushes the legacy repo (delegates to `auto-commit-engine.js`) | ✅ patched to honor lock + pause |
| `in-folder-watcher.sh` | `@reboot` (PID-resident) | watches a dropzone, triggers `auto-commit-push.sh` on new files | ✅ via auto-commit-push.sh |
| `guard-index-lock.sh` | cron `*/5` | removes stale `.git/index.lock` | n/a (no commits) |
| `resource-watchdog.sh` | cron `*/2` | resource monitor | n/a (no commits) |
| Antigravity IDE agent | interactive | edits + commits in this `Heady-AI` clone | ✅ via git hooks (same clone) |
| PM2 `heady-manager` | pm2 | currently **stopped** | n/a |

## How it works

- **Lock:** `~/.heady/session.lock` (machine-wide JSON: owner, pid, heartbeat, ttl, intent).
- **Freshness:** a lock is honored only while `now − heartbeatAt ≤ ttlSec` (default 1800s). Stale
  locks are ignored — **a dead session never deadlocks the machine.**
- **Chokepoint:** `git commit`/`git push` in this repo run `tooling/hooks/{pre-commit,pre-push}`,
  which call `heady-session check`. If a *different* owner holds a *fresh* lock → the commit/push is
  **blocked** (exit 1). Bypass only in a real emergency with `--no-verify`.
- **Autonomous writers** call `heady-session check` first and **skip the cycle** when blocked, and
  also honor the persistent pause flag `~/.heady/autonomy.paused`.

## Use it

```bash
G=tooling/session-guard/src/session-guard.mjs

# Start of an interactive/agent session — claim the machine:
node $G acquire --owner claude-code --intent "rebuild CI work" --ttl 3600
node $G heartbeat --owner claude-code     # refresh periodically (long sessions)
node $G release  --owner claude-code      # when done

node $G status                            # who holds it, stale?, autonomy paused?
node $G pause                             # hard-pause ALL autonomous writers (one switch)
node $G resume                            # let them run again
```

`HEADY_SESSION_OWNER` env var sets the owner for hooks without flags (export it in your shell so
your own commits pass while others are blocked).

## Install the hooks in a clone

```bash
git config core.hooksPath tooling/hooks      # one-time, per clone
# or: bash tooling/session-guard/install.sh
```

## Scope & limits (honest)

- Covers every writer that commits through **this clone** (IDE, manual, agents) + the patched
  legacy cron. A writer in a **different clone** or pushing via the **GitHub API/app** is not bound
  by a local hook — for those, the server-side coordination is **branch protection (PR-only)**,
  which is already configured on `rebuild`. Don't bypass it.
- Advisory, not security: `--no-verify` bypasses hooks by design (emergency valve).
