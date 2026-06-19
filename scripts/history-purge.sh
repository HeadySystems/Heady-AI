#!/bin/bash
# HEADY_BRAND:BEGIN
# Heady Systems - Audit Stage S-HIST: Git history size reclamation (PLANNED)
# HEADY_BRAND:END
#
# ⚠️ IRREVERSIBLE. This rewrites Git history to purge large binary blobs (zips, docx,
# pdf, _downloads) that were untracked in audit stages S2/S4 but still occupy history.
# Rewriting changes EVERY commit SHA after the first affected commit and REQUIRES a
# coordinated force-push; every existing clone/fork must re-clone. DO NOT run casually.
#
# Default mode is DRY-RUN (reports what would be purged, changes nothing).
# To actually execute you must pass --execute AND set HEADY_HISTORY_PURGE_CONFIRM=YES.
#
# Requires: git-filter-repo (https://github.com/newren/git-filter-repo).

set -euo pipefail

MODE="${1:-dry-run}"

PATTERNS=(
  '*.zip' '*.ZIP'
  '*.docx' '*.DOCX'
  '*.pdf' '*.PDF'
  '_downloads/*'
)

echo "== Heady history purge =="
echo "Repo: $(git rev-parse --show-toplevel 2>/dev/null || echo '?')"
echo "Patterns: ${PATTERNS[*]}"

if ! command -v git-filter-repo >/dev/null 2>&1; then
  echo "ERROR: git-filter-repo not installed. Install it before running." >&2
  echo "  pipx install git-filter-repo   # or: pip install git-filter-repo" >&2
  exit 2
fi

# Build the filter-repo path-glob args.
ARGS=()
for p in "${PATTERNS[@]}"; do ARGS+=("--path-glob" "$p"); done

if [ "$MODE" != "--execute" ]; then
  echo
  echo "[DRY-RUN] Would purge blobs matching the patterns above from ALL history."
  echo "[DRY-RUN] Largest blobs currently in history:"
  git rev-list --objects --all 2>/dev/null \
    | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' 2>/dev/null \
    | awk '/^blob/ {print $3, $4}' | sort -rn | head -20 || true
  echo
  echo "To execute (IRREVERSIBLE): HEADY_HISTORY_PURGE_CONFIRM=YES $0 --execute"
  exit 0
fi

if [ "${HEADY_HISTORY_PURGE_CONFIRM:-NO}" != "YES" ]; then
  echo "REFUSING: set HEADY_HISTORY_PURGE_CONFIRM=YES to confirm the irreversible rewrite." >&2
  exit 3
fi

echo "Executing history rewrite (invert-paths = remove matching paths)..."
git filter-repo --invert-paths "${ARGS[@]}" --force
echo
echo "DONE locally. Next (manual, coordinated):"
echo "  1. Re-add remote:    git remote add origin <url>"
echo "  2. Force-push all:   git push --force --all && git push --force --tags"
echo "  3. Notify every collaborator to re-clone (old clones are now incompatible)."
