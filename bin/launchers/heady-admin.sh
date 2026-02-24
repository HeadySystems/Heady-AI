#!/bin/bash
# Heady Admin UI — Drupal 11 Hybrid Administration Panel
# Server: 4400, Client: 4401
APP_DIR="/home/headyme/CascadeProjects/admin-ui"
SERVER_PORT=4400
CLIENT_PORT=4401
LOG="/home/headyme/HeadyApps/logs/heady-admin.log"
mkdir -p "$(dirname "$LOG")"

echo "[$(date)] Starting Heady Admin UI..." | tee "$LOG"
cd "$APP_DIR"
PORT=$SERVER_PORT node server/index.js >> "$LOG" 2>&1 &
# Note: server/index.js uses process.env.PORT || 8090
echo $! > /tmp/heady-admin-server.pid
sleep 1
npx vite preview --port $CLIENT_PORT --host 0.0.0.0 >> "$LOG" 2>&1 &
echo $! > /tmp/heady-admin-client.pid
sleep 2
xdg-open "http://localhost:$CLIENT_PORT" 2>/dev/null
echo "[$(date)] Heady Admin running — server :$SERVER_PORT, UI :$CLIENT_PORT"
