#!/usr/bin/env bash
# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: scripts/in-folder-watcher.sh                                                    ║
# ║  LAYER: automation                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
#
# Polls the in/ folder for new .zip files every 55 seconds (≈fib(10)).
# When found: extracts, diffs against repo, integrates net-new files,
# then triggers auto-commit-push.sh.
#
# Usage:
#   ./scripts/in-folder-watcher.sh          # background daemon mode
#   ./scripts/in-folder-watcher.sh --once   # single-pass (for testing)
#   ./scripts/in-folder-watcher.sh --dry    # show what would happen
#
# Cron: @reboot /home/headyme/Heady/scripts/in-folder-watcher.sh &

set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin:$PATH"
export HOME="${HOME:-/home/headyme}"

REPO_DIR="${HEADY_REPO_DIR:-/home/headyme/Heady}"
IN_DIR="$REPO_DIR/in"
LOG_DIR="$REPO_DIR/logs"
LOG_FILE="$LOG_DIR/in-watcher.log"
PROCESSED_MARKER="$LOG_DIR/.in-watcher-processed"
LOCK_FILE="/tmp/heady-in-watcher.lock"
POLL_INTERVAL=55  # ~fib(10) seconds
MAX_ZIP_SIZE_MB=100
EXTRACT_DIR="/tmp/heady-in-extract"
MODE="${1:-daemon}"

mkdir -p "$LOG_DIR" "$IN_DIR"
touch "$PROCESSED_MARKER"

# ─── Logging ──────────────────────────────────────────────────────
log() {
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "[$ts] $*" >> "$LOG_FILE"
}

# ─── Lock ─────────────────────────────────────────────────────────
acquire_lock() {
  if [ -f "$LOCK_FILE" ]; then
    lock_age=$(($(date +%s) - $(stat -c %Y "$LOCK_FILE" 2>/dev/null || echo 0)))
    if [ "$lock_age" -lt 600 ]; then
      return 1
    fi
    rm -f "$LOCK_FILE"
  fi
  echo $$ > "$LOCK_FILE"
  return 0
}
release_lock() { rm -f "$LOCK_FILE"; }

# ─── Process a single zip ─────────────────────────────────────────
process_zip() {
  local zip_file="$1"
  local basename_zip
  basename_zip=$(basename "$zip_file")

  # Size check
  local size_mb
  size_mb=$(du -m "$zip_file" | cut -f1)
  if [ "$size_mb" -gt "$MAX_ZIP_SIZE_MB" ]; then
    log "SKIP (${size_mb}MB > ${MAX_ZIP_SIZE_MB}MB): $basename_zip"
    return 0
  fi

  # Duplicate check
  if echo "$basename_zip" | grep -q "(1)"; then
    local non_dup
    non_dup=$(echo "$basename_zip" | sed 's/ (1)//')
    if [ -f "$IN_DIR/$non_dup" ]; then
      log "SKIP (duplicate): $basename_zip"
      return 0
    fi
  fi

  log "PROCESSING: $basename_zip (${size_mb}MB)"

  # Extract
  local extract_dir="$EXTRACT_DIR/$(echo "$basename_zip" | sed 's/\.zip$//')"
  rm -rf "$extract_dir"
  mkdir -p "$extract_dir"
  if ! unzip -qo "$zip_file" -d "$extract_dir" 2>/dev/null; then
    log "ERROR: Failed to extract $basename_zip"
    return 1
  fi

  # Find content root (unwrap single wrapper dirs)
  local content_root="$extract_dir"
  while [ "$(find "$content_root" -maxdepth 1 -not -name "$(basename "$content_root")" | wc -l)" -eq 1 ] && \
        [ -d "$(find "$content_root" -maxdepth 1 -not -name "$(basename "$content_root")")" ]; do
    content_root="$(find "$content_root" -maxdepth 1 -not -name "$(basename "$content_root")")"
  done

  # Integrate net-new files
  local new_count=0
  while IFS= read -r -d '' file; do
    local rel_path="${file#$content_root/}"
    case "$rel_path" in
      node_modules/*|.git/*|__pycache__/*|*.pyc|.DS_Store|.gradle/*) continue ;;
    esac

    local dest="$REPO_DIR/$rel_path"
    if [ "$MODE" = "--dry" ]; then
      [ ! -f "$dest" ] && echo "  WOULD ADD: $rel_path" && new_count=$((new_count + 1))
    elif [ ! -f "$dest" ]; then
      mkdir -p "$(dirname "$dest")"
      cp "$file" "$dest"
      new_count=$((new_count + 1))
    fi
  done < <(find "$content_root" -type f -print0)

  log "  → $new_count net-new files from $basename_zip"
  rm -rf "$extract_dir"

  # Mark as processed
  echo "$basename_zip" >> "$PROCESSED_MARKER"
  return $new_count
}

# ─── Main loop ────────────────────────────────────────────────────
run_pass() {
  if ! acquire_lock; then
    log "SKIP — another watcher instance running"
    return
  fi
  trap release_lock EXIT

  local total_new=0
  local processed=0

  for zip_file in "$IN_DIR"/*.zip; do
    [ ! -f "$zip_file" ] && continue
    local basename_zip
    basename_zip=$(basename "$zip_file")

    # Skip if already processed
    if grep -qF "$basename_zip" "$PROCESSED_MARKER" 2>/dev/null; then
      continue
    fi

    process_zip "$zip_file"
    local result=$?
    if [ "$result" -gt 0 ]; then
      total_new=$((total_new + result))
    fi
    processed=$((processed + 1))
  done

  release_lock
  trap - EXIT

  if [ "$total_new" -gt 0 ]; then
    log "TRIGGER auto-commit-push — $total_new new files from $processed zips"
    if [ "$MODE" != "--dry" ]; then
      "$REPO_DIR/scripts/auto-commit-push.sh" "feat: in-folder auto-ingest — ${total_new} files from ${processed} packages [$(date -u +%Y-%m-%dT%H:%M:%SZ)]" &
    fi
  elif [ "$processed" -gt 0 ]; then
    log "PASS — $processed zips scanned, 0 net-new files"
  fi
}

# ─── Entry point ──────────────────────────────────────────────────
log "IN-FOLDER WATCHER STARTING (mode: $MODE, poll: ${POLL_INTERVAL}s)"

if [ "$MODE" = "--once" ] || [ "$MODE" = "--dry" ]; then
  run_pass
  log "Single pass complete"
  exit 0
fi

# Daemon mode — run forever
while true; do
  run_pass
  sleep "$POLL_INTERVAL"
done
