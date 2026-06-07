#!/bin/bash
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
# ║  FILE: _archive/bin/launchers/heady-buddy.sh                                                    ║
# ║  LAYER: root                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
# HeadyBuddy
APP_DIR="/home/headyme/Heady/heady-buddy"
LOG="/home/headyme/Heady/logs/heady-buddy.log"
mkdir -p "$(dirname "$LOG")"

echo "[$(date)] Starting HeadyBuddy..." | tee "$LOG"
cd "$APP_DIR"
if [ ! -d "node_modules" ]; then npm install >> "$LOG" 2>&1; fi
npm run start >> "$LOG" 2>&1 &
echo "[$(date)] HeadyBuddy Electron app launched"
