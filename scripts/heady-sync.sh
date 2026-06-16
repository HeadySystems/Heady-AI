#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ heady-sync — git sync across devices, secret-guarded        ║
# ║  Stash → commit → pull --rebase → push. FAILS CLOSED on a detected ║
# ║  live credential (never pushes a secret). LFS-aware.                ║
# ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
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
