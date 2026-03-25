#!/usr/bin/env bash
# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HeadyAutoSync — Parrot OS / Linux VM Installer                ║
# ║  Option 3: Persistent systemd service for local git sync       ║
# ║  © 2026 HeadySystems Inc. | φ = 1.618033988749895              ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
#
# Usage:
#   sudo bash scripts/install-heady-sync.sh [--repo-path /path/to/heady-production]
#
# What it installs:
#   1. heady-auto-sync.service  — Long-running Node.js daemon (auto-commit-deploy.js)
#   2. heady-auto-sync.timer    — φ⁸-interval timer (47s via systemd)
#   3. heady-cross-sync.service — Cross-repo sync one-shot (every 5 min)
#   4. heady-cross-sync.timer   — Timer for cross-repo sync
#   5. Log rotation config
#   6. SSH key validation
#
# Supports: Parrot OS, Ubuntu, Debian, Fedora, Arch

set -euo pipefail

# ─── COLORS ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ─── φ-MATH ─────────────────────────────────────────────────────────────────
PHI_8_SECONDS=47   # Math.round(φ⁸) = 47 seconds
PHI_9_SECONDS=76   # Math.round(φ⁹) = 76 seconds (fetch interval)
FIB_5_MINUTES=5    # Cross-repo sync interval

# ─── DEFAULTS ────────────────────────────────────────────────────────────────
REPO_PATH=""
HEADY_USER="${SUDO_USER:-$(whoami)}"
HEADY_HOME="/home/${HEADY_USER}"
LOG_DIR="${HEADY_HOME}/heady-logs"
SERVICE_DIR="/etc/systemd/system"
NODE_BIN=$(which node 2>/dev/null || echo "/usr/bin/node")

# ─── PARSE ARGS ──────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-path) REPO_PATH="$2"; shift 2 ;;
    --user) HEADY_USER="$2"; HEADY_HOME="/home/${HEADY_USER}"; shift 2 ;;
    --help) echo "Usage: sudo bash $0 [--repo-path /path] [--user username]"; exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# Auto-detect repo path
if [ -z "$REPO_PATH" ]; then
  # Check common locations
  for CANDIDATE in \
    "${HEADY_HOME}/Heady" \
    "${HEADY_HOME}/heady-production" \
    "${HEADY_HOME}/code/heady-production" \
    "${HEADY_HOME}/projects/heady-production" \
    "/opt/heady/heady-production"; do
    if [ -d "$CANDIDATE/.git" ]; then
      REPO_PATH="$CANDIDATE"
      break
    fi
  done

  if [ -z "$REPO_PATH" ]; then
    echo -e "${RED}ERROR: Could not auto-detect repo path. Use --repo-path /path/to/heady-production${NC}"
    exit 1
  fi
fi

echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  HeadyAutoSync Installer — Parrot OS / Linux VM        ║${NC}"
echo -e "${CYAN}║  φ = 1.618033988749895 | Sacred Geometry v4.0          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  User:      ${GREEN}${HEADY_USER}${NC}"
echo -e "  Repo:      ${GREEN}${REPO_PATH}${NC}"
echo -e "  Logs:      ${GREEN}${LOG_DIR}${NC}"
echo -e "  Node:      ${GREEN}${NODE_BIN}${NC}"
echo ""

# ─── PREFLIGHT CHECKS ───────────────────────────────────────────────────────
echo -e "${YELLOW}[1/7] Preflight checks...${NC}"

# Check root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}ERROR: Must run as root (sudo)${NC}"
  exit 1
fi

# Check node
if ! command -v node &>/dev/null; then
  echo -e "${RED}ERROR: Node.js not found. Install with: sudo apt install nodejs${NC}"
  exit 1
fi
NODE_VER=$(node --version)
echo -e "  Node version: ${GREEN}${NODE_VER}${NC}"

# Check git
if ! command -v git &>/dev/null; then
  echo -e "${RED}ERROR: git not found${NC}"
  exit 1
fi

# Check repo
if [ ! -d "${REPO_PATH}/.git" ]; then
  echo -e "${RED}ERROR: ${REPO_PATH} is not a git repo${NC}"
  exit 1
fi

# Check SSH key for push access
SSH_KEY="${HEADY_HOME}/.ssh/id_ed25519"
if [ ! -f "$SSH_KEY" ] && [ ! -f "${HEADY_HOME}/.ssh/id_rsa" ]; then
  echo -e "${YELLOW}WARNING: No SSH key found at ${SSH_KEY}. Push will fail without auth.${NC}"
  echo -e "${YELLOW}         Generate one: ssh-keygen -t ed25519 -C 'heady-sync@$(hostname)'${NC}"
  echo -e "${YELLOW}         Add to GitHub: https://github.com/settings/keys${NC}"
fi

# ─── CREATE LOG DIR ──────────────────────────────────────────────────────────
echo -e "${YELLOW}[2/7] Creating log directory...${NC}"
mkdir -p "$LOG_DIR"
chown "${HEADY_USER}:${HEADY_USER}" "$LOG_DIR"

# ─── INSTALL: Auto-Commit Daemon Service ─────────────────────────────────────
echo -e "${YELLOW}[3/7] Installing heady-auto-sync.service (daemon)...${NC}"
cat > "${SERVICE_DIR}/heady-auto-sync.service" << UNIT
[Unit]
Description=HeadyAutoSync — φ⁸ Interval Auto-Commit & Push Daemon
Documentation=https://github.com/HeadyMe/heady-production
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${HEADY_USER}
Group=${HEADY_USER}
WorkingDirectory=${REPO_PATH}
ExecStart=${NODE_BIN} ${REPO_PATH}/src/orchestration/auto-commit-deploy.js --daemon
Environment=HOME=${HEADY_HOME}
Environment=PATH=/usr/local/bin:/usr/bin:/bin
Environment=NODE_ENV=production
Environment=HEADY_TARGET=vm
Environment=HEADY_MODE=AUTO_SYNC
Environment=ENABLE_SYNC_SERVICE=true
Environment=HEADY_AUTO_BRANCH=main
Environment=HEADY_PUSH_REMOTES=origin

# Restart on failure with φ-scaled backoff
Restart=on-failure
RestartSec=47
StartLimitIntervalSec=600
StartLimitBurst=8

# Logging
StandardOutput=append:${LOG_DIR}/heady-auto-sync.log
StandardError=append:${LOG_DIR}/heady-auto-sync.log

# Resource limits
Nice=10
MemoryMax=256M
CPUQuota=50%

# Security hardening
ProtectSystem=strict
ReadWritePaths=${REPO_PATH} ${LOG_DIR} ${HEADY_HOME}/.ssh
PrivateTmp=true
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
UNIT

# ─── INSTALL: Cross-Repo Sync One-Shot ───────────────────────────────────────
echo -e "${YELLOW}[4/7] Installing heady-cross-sync.service (one-shot)...${NC}"
cat > "${SERVICE_DIR}/heady-cross-sync.service" << UNIT
[Unit]
Description=HeadyAutoSync — Cross-Repo Content Sync
Documentation=https://github.com/HeadyMe/heady-production
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=${HEADY_USER}
Group=${HEADY_USER}
WorkingDirectory=${REPO_PATH}
ExecStart=${REPO_PATH}/scripts/cross-repo-sync-local.sh
Environment=HOME=${HEADY_HOME}
Environment=PATH=/usr/local/bin:/usr/bin:/bin
Environment=NODE_ENV=production

# Logging
StandardOutput=append:${LOG_DIR}/heady-cross-sync.log
StandardError=append:${LOG_DIR}/heady-cross-sync.log

# Safety
TimeoutStartSec=300
Nice=15

[Install]
WantedBy=default.target
UNIT

# ─── INSTALL: Timers ────────────────────────────────────────────────────────
echo -e "${YELLOW}[5/7] Installing timers...${NC}"

# Cross-repo sync timer (every 5 min)
cat > "${SERVICE_DIR}/heady-cross-sync.timer" << UNIT
[Unit]
Description=HeadyAutoSync — Cross-Repo Sync Timer (every ${FIB_5_MINUTES}min)

[Timer]
OnBootSec=3min
OnUnitActiveSec=${FIB_5_MINUTES}min
RandomizedDelaySec=30
Persistent=true

[Install]
WantedBy=timers.target
UNIT

# ─── INSTALL: Cross-Repo Sync Script ────────────────────────────────────────
echo -e "${YELLOW}[6/7] Installing cross-repo-sync-local.sh...${NC}"
cat > "${REPO_PATH}/scripts/cross-repo-sync-local.sh" << 'SCRIPT'
#!/usr/bin/env bash
# HeadyAutoSync — Local cross-repo content sync
# Pushes shared files from heady-production to satellite repos
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] HeadyCrossSync: $*"; }

# Shared files to sync
SHARED_FILES=(
  "shared/phi-math.js"
  "shared/cors-config.js"
  "shared/logger.js"
  "shared/health.js"
  "configs/sacred-geometry-v4.yaml"
)

# Satellite repos (must be configured as remotes)
SATELLITES=(origin)

# Also sync via GitHub API if gh CLI is available
if command -v gh &>/dev/null; then
  GITHUB_REPOS=(
    "headysystems" "headymcp" "headyconnection" "headyai" "headyos"
    "HeadyBuddy" "HeadyWeb" "Heady-Main" "Heady-Main-1"
  )

  for TARGET in "${GITHUB_REPOS[@]}"; do
    for FILE in "${SHARED_FILES[@]}"; do
      [ ! -f "$FILE" ] && continue

      CONTENT_B64=$(base64 -w0 < "$FILE")
      FILE_SHA=$(gh api "repos/HeadyMe/${TARGET}/contents/${FILE}" --jq '.sha' 2>/dev/null || echo "")

      ARGS=("repos/HeadyMe/${TARGET}/contents/${FILE}" -f "message=sync(auto): update $FILE [local-vm]" -f "content=$CONTENT_B64" -f "branch=main")
      [ -n "$FILE_SHA" ] && ARGS+=(-f "sha=$FILE_SHA")

      if gh api "${ARGS[@]}" --method PUT > /dev/null 2>&1; then
        log "Synced $FILE → $TARGET"
      else
        log "WARN: Failed $FILE → $TARGET"
      fi
      sleep 1.618
    done
  done
fi

log "Cross-repo sync complete"
SCRIPT
chmod +x "${REPO_PATH}/scripts/cross-repo-sync-local.sh"

# ─── INSTALL: Log Rotation ──────────────────────────────────────────────────
echo -e "${YELLOW}[7/7] Installing log rotation...${NC}"
cat > /etc/logrotate.d/heady-auto-sync << LOGROTATE
${LOG_DIR}/heady-auto-sync.log
${LOG_DIR}/heady-cross-sync.log
{
    daily
    rotate 13
    compress
    delaycompress
    missingok
    notifempty
    create 640 ${HEADY_USER} ${HEADY_USER}
    postrotate
        systemctl restart heady-auto-sync.service 2>/dev/null || true
    endscript
}
LOGROTATE

# ─── RELOAD AND ENABLE ──────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}Reloading systemd and enabling services...${NC}"
systemctl daemon-reload
systemctl enable heady-auto-sync.service
systemctl enable heady-cross-sync.timer

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  HeadyAutoSync installed successfully!                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Services installed:"
echo -e "    ${CYAN}heady-auto-sync.service${NC}  — Long-running auto-commit daemon"
echo -e "    ${CYAN}heady-cross-sync.service${NC} — Cross-repo sync one-shot"
echo -e "    ${CYAN}heady-cross-sync.timer${NC}   — Triggers cross-sync every ${FIB_5_MINUTES}min"
echo ""
echo -e "  Commands:"
echo -e "    ${YELLOW}sudo systemctl start heady-auto-sync${NC}     — Start the daemon now"
echo -e "    ${YELLOW}sudo systemctl start heady-cross-sync.timer${NC} — Start cross-sync timer"
echo -e "    ${YELLOW}sudo systemctl status heady-auto-sync${NC}    — Check status"
echo -e "    ${YELLOW}journalctl -u heady-auto-sync -f${NC}         — Follow logs"
echo -e "    ${YELLOW}tail -f ${LOG_DIR}/heady-auto-sync.log${NC}   — Direct log file"
echo ""
echo -e "  φ = 1.618033988749895 | HeadySystems Inc."
