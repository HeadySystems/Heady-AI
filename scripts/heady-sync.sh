#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ heady-sync — git sync across devices, secret-guarded        ║
# ║  Stash → commit → pull --rebase → push. FAILS CLOSED on a detected ║
# ║  live credential (never pushes a secret). LFS-aware.                ║
# ║  Made with ❤️ by HeadySystems Inc.                                 ║
# ╚══════════════════════════════════════════════════════════════════╝
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
MODE="${1:-sync}"

log() { printf '{"t":"heady-sync","level":"%s","msg":"%s"}\n' "$1" "$2"; }

# Fail-closed secret guard: scan added lines of the working diff for live-credential shapes.
# Mirrors tooling/decomposition + the coherence secret patterns. Test/example keys are allowed.
secret_guard() {
  local hits
  hits="$(git diff --cached 2>/dev/null | grep -E '^\+' \
    | grep -aoE 'AIza[0-9A-Za-z_-]{35}|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-ant-api03-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36}|AKIA[0-9A-Z]{16}' \
    | grep -vE 'EXAMPLE|REDACT|FAKE|sample' || true)"
  if [ -n "$hits" ]; then
    log error "SECRET DETECTED in staged changes — aborting push (fail-closed). Redact and retry."
    printf '%s\n' "$hits" | sed -E 's/(.{10}).*/\1…[redacted]/' >&2
    exit 2
  fi
}

# Fail-closed DELETION guard: the many autonomous writers (cron auto-commit, IDE agent,
# heady-sync --watch) can transiently drop tracked files from the working tree; `git add -A`
# then stages those deletions and this script would commit+push them, wiping the corpus on
# origin. Refuse to auto-commit a BULK deletion (> HEADY_SYNC_MAX_DELETIONS, φ-derived) or ANY
# deletion of a load-bearing invariant path, unless the human explicitly authorizes it. Runs
# AFTER `git add -A` (so it sees the staged deletions) and BEFORE commit.
deletion_guard() {
  local deleted count protected max
  deleted="$(git diff --cached --name-only --diff-filter=D || true)"
  [ -z "$deleted" ] && return 0
  count="$(printf '%s\n' "$deleted" | grep -c . || true)"
  # Invariant corpora — deleting ANY of these is never an unattended-sync action.
  protected="$(printf '%s\n' "$deleted" | grep -E '^(configs/|docs/adr/|packages/db/migrations/|AGENTS\.md|facts\.yaml|CLAUDE\.md)' || true)"
  max="${HEADY_SYNC_MAX_DELETIONS:-13}"   # fib(7) — φ-derived; a race drops far more than a refactor
  if [ "${HEADY_SYNC_ALLOW_DELETIONS:-0}" = "1" ]; then
    log warn "deletion-guard OVERRIDDEN (HEADY_SYNC_ALLOW_DELETIONS=1) — committing ${count} deletion(s)"
    return 0
  fi
  if [ -n "$protected" ] || [ "$count" -gt "$max" ]; then
    log error "deletion-guard TRIPPED (fail-closed) — refusing to auto-commit ${count} deletion(s); max=${max}, protected-path-hit=$([ -n "$protected" ] && echo yes || echo no). A concurrent writer may have dropped tracked files. Review 'git status', restore what should stay, then re-run with HEADY_SYNC_ALLOW_DELETIONS=1 if the deletions are intended."
    printf '%s\n' "$deleted" | sed 's/^/  would-delete: /' >&2
    git reset -q   # unstage everything (working tree untouched); nothing is committed or pushed
    exit 3
  fi
}

status() {
  log info "branch=$BRANCH ahead/behind:"
  git status -sb | head -1
  git fetch --quiet origin "$BRANCH" 2>/dev/null || true
  git --no-pager log --oneline "origin/$BRANCH..HEAD" 2>/dev/null | sed 's/^/  unpushed: /' || true
}

case "$MODE" in
  --status) status; exit 0 ;;
  --dry-run)
    log info "dry-run — changes that WOULD sync:"
    git status --short
    secret_guard || true
    # Preview the deletion guard against working-tree deletions (staged + unstaged).
    DRY_DEL="$(git status --porcelain | grep -E '^[ MADRCU]?D ' | sed -E 's/^...//' || true)"
    if [ -n "$DRY_DEL" ]; then
      DRY_N="$(printf '%s\n' "$DRY_DEL" | grep -c . || true)"
      DRY_PROT="$(printf '%s\n' "$DRY_DEL" | grep -E '^(configs/|docs/adr/|packages/db/migrations/|AGENTS\.md|facts\.yaml|CLAUDE\.md)' || true)"
      if [ -n "$DRY_PROT" ] || [ "$DRY_N" -gt "${HEADY_SYNC_MAX_DELETIONS:-13}" ]; then
        log warn "deletion-guard WOULD TRIP on ${DRY_N} deletion(s) (protected-path-hit=$([ -n "$DRY_PROT" ] && echo yes || echo no)) — sync would abort unless HEADY_SYNC_ALLOW_DELETIONS=1"
      fi
    fi
    exit 0 ;;
  --watch)
    log info "watch mode — syncing every PHI^7 s (≈29s heartbeat); Ctrl-C to stop"
    while true; do "$0" sync || log warn "sync cycle failed; retrying"; sleep 29; done ;;
  sync) ;;
  *) log error "unknown mode: $MODE (use: --status | --dry-run | --watch | <none>)"; exit 1 ;;
esac

# 1. stash anything mid-edit so rebase stays clean
DIRTY=0; if ! git diff --quiet || ! git diff --cached --quiet; then DIRTY=1; fi

# 2. stage + guard + commit local work
git add -A
deletion_guard   # refuse bulk/protected-path deletions before they can be committed+pushed
secret_guard
if ! git diff --cached --quiet; then
  git commit -q -m "chore(sync): heady-sync $(git rev-parse --short HEAD) on ${BRANCH}" \
    -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  log info "committed local changes"
fi

# 3. pull --rebase (LFS-aware), then push
git fetch --quiet origin "$BRANCH" 2>/dev/null || true
if git rev-parse --verify --quiet "origin/$BRANCH" >/dev/null; then
  git pull --rebase --autostash origin "$BRANCH"
fi
git lfs push --all origin "$BRANCH" 2>/dev/null || true
git push origin "$BRANCH"
log info "synced ${BRANCH} → origin (dirty_on_entry=${DIRTY})"
