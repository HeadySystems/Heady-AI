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
# ║  FILE: scripts/cloud-run-auto-sync.sh                                                    ║
# ║  LAYER: automation                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

set -euo pipefail

# ─── φ-MATH CONSTANTS ────────────────────────────────────────────────────────
PHI="1.618033988749895"
PSI="0.618033988749895"
MAX_MSG_LEN=89  # FIB[10]

# ─── CONFIGURATION ───────────────────────────────────────────────────────────
ORG="${HEADY_ORG:-HeadyMe}"
REPO="${HEADY_REPO:-heady-production}"
BRANCH="${HEADY_BRANCH:-main}"
WORK_DIR="/tmp/heady-sync-workspace"
SSH_KEY_PATH="${SSH_KEY_PATH:-/secrets/ssh/id_ed25519}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

# ─── LOGGING ─────────────────────────────────────────────────────────────────
log() {
  local level="$1"; shift
  echo "{\"level\":\"$level\",\"component\":\"HeadyAutoSync-CloudRun\",\"msg\":\"$*\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
}

# ─── SSH KEY SETUP ───────────────────────────────────────────────────────────
setup_auth() {
  if [ -f "$SSH_KEY_PATH" ]; then
    log "info" "Configuring SSH key from Secret Manager"
    mkdir -p ~/.ssh
    cp "$SSH_KEY_PATH" ~/.ssh/id_ed25519
    chmod 600 ~/.ssh/id_ed25519
    ssh-keyscan github.com >> ~/.ssh/known_hosts 2>/dev/null
    CLONE_URL="git@github.com:${ORG}/${REPO}.git"
  elif [ -n "$GITHUB_TOKEN" ]; then
    log "info" "Using GITHUB_TOKEN for HTTPS auth"
    CLONE_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${ORG}/${REPO}.git"
  else
    log "error" "No SSH key or GITHUB_TOKEN — cannot authenticate"
    exit 1
  fi
}

# ─── ARENA MODE CLASSIFICATION ───────────────────────────────────────────────
classify_changes() {
  local status="$1"
  if echo "$status" | grep -qiE 'auth|billing|password|private\.key|DROP[[:space:]]TABLE|schema[[:space:]]migrat'; then
    echo "CRITICAL"
  elif echo "$status" | grep -qvE '\.(md|yaml|yml|json|txt|css)$'; then
    echo "SIGNIFICANT"
  else
    echo "TRIVIAL"
  fi
}

# ─── MAIN ────────────────────────────────────────────────────────────────────
main() {
  log "info" "HeadyAutoSync Cloud Run Job starting"
  log "info" "Target: ${ORG}/${REPO}@${BRANCH}"

  # 1. Setup authentication
  setup_auth

  # 2. Clone repository
  log "info" "Cloning ${CLONE_URL}"
  rm -rf "$WORK_DIR"
  git clone --depth=10 --branch="$BRANCH" "$CLONE_URL" "$WORK_DIR"
  cd "$WORK_DIR"

  # 3. Configure git identity
  git config user.name "HeadyAutoSync[bot]"
  git config user.email "autosync@headysystems.com"

  # 4. Check for generated artifacts that need committing
  # Run any generation scripts that produce artifacts
  if [ -f "scripts/generate-configs.sh" ]; then
    log "info" "Running config generation scripts"
    bash scripts/generate-configs.sh 2>/dev/null || true
  fi

  # 5. Detect changes
  STATUS=$(git status --porcelain)
  if [ -z "$STATUS" ]; then
    log "info" "Working tree clean — nothing to commit"
    exit 0
  fi

  FILE_COUNT=$(echo "$STATUS" | wc -l)
  log "info" "Detected $FILE_COUNT changed files"

  # 6. Classify and gate
  TIER=$(classify_changes "$STATUS")
  log "info" "Change tier: $TIER"

  if [ "$TIER" = "CRITICAL" ]; then
    log "warn" "CRITICAL changes detected — skipping auto-commit (requires manual review)"
    # Could send Slack notification here
    exit 0
  fi

  # 7. Build commit message
  CHANGED=$(git status --porcelain | head -5 | awk '{print $2}' | xargs -I{} basename {} | paste -sd', ')
  MSG="chore(auto-sync): ${CHANGED} [tier=${TIER}] [cloud-run-job]"
  MSG="${MSG:0:$MAX_MSG_LEN}"

  # 8. Commit
  git add -A
  git commit -m "$MSG"
  SHA=$(git rev-parse --short HEAD)
  log "info" "Committed: $SHA — $MSG"

  # 9. Push
  git push origin "$BRANCH"
  log "info" "Pushed to origin/${BRANCH}"

  # 10. Sync shared files to satellite repos (top priority files only)
  SHARED_FILES=(
    "shared/phi-math.js"
    "shared/cors-config.js"
    "shared/logger.js"
    "shared/health.js"
  )

  SATELLITE_REPOS=(
    "headysystems" "headymcp" "headyconnection" "headyai" "headyos"
    "HeadyBuddy" "HeadyWeb" "Heady-Main" "Heady-Main-1"
  )

  if [ -n "$GITHUB_TOKEN" ]; then
    log "info" "Syncing shared files to ${#SATELLITE_REPOS[@]} satellite repos"

    for TARGET_REPO in "${SATELLITE_REPOS[@]}"; do
      for FILE in "${SHARED_FILES[@]}"; do
        [ ! -f "$FILE" ] && continue

        CONTENT_B64=$(base64 -w0 < "$FILE")
        FILE_SHA=$(curl -sf -H "Authorization: token $GITHUB_TOKEN" \
          "https://api.github.com/repos/${ORG}/${TARGET_REPO}/contents/${FILE}" \
          | grep '"sha"' | head -1 | cut -d'"' -f4 || echo "")

        PAYLOAD="{\"message\":\"sync(auto): update $FILE from heady-production\",\"content\":\"$CONTENT_B64\",\"branch\":\"main\""
        [ -n "$FILE_SHA" ] && PAYLOAD="${PAYLOAD},\"sha\":\"$FILE_SHA\""
        PAYLOAD="${PAYLOAD}}"

        HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" \
          -H "Authorization: token $GITHUB_TOKEN" \
          -H "Content-Type: application/json" \
          -X PUT -d "$PAYLOAD" \
          "https://api.github.com/repos/${ORG}/${TARGET_REPO}/contents/${FILE}" || echo "000")

        if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
          log "info" "Synced $FILE → $TARGET_REPO"
        else
          log "warn" "Failed to sync $FILE → $TARGET_REPO (HTTP $HTTP_CODE)"
        fi

        # Rate limit: sleep φ seconds between API calls
        sleep 1.618
      done
    done
  fi

  log "info" "HeadyAutoSync Cloud Run Job complete — committed $SHA, synced shared files"
}

main "$@"
