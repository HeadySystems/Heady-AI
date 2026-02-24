#!/bin/bash
# Heady Manager — Main Backend API Server
# Port: 3300
APP_DIR="/home/headyme/CascadeProjects/Heady"
PORT=3300
LOG="/home/headyme/HeadyApps/logs/heady-manager.log"
mkdir -p "$(dirname "$LOG")"

echo "[$(date)] Starting Heady Manager on port $PORT..." | tee "$LOG"
cd "$APP_DIR"
PORT=$PORT node src/server.js >> "$LOG" 2>&1 &
PID=$!
echo $PID > /tmp/heady-manager.pid
sleep 2
xdg-open "http://localhost:$PORT" 2>/dev/null
echo "[$(date)] Heady Manager running (PID=$PID) at http://localhost:$PORT"
