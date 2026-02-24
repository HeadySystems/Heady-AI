#!/bin/bash
# HeadyConnection — headyconnection.org Portal
# Port: 4600
APP_DIR="/home/headyme/HeadyConnection/headyconnection-web"
PORT=4600
LOG="/home/headyme/HeadyApps/logs/heady-connection.log"
mkdir -p "$(dirname "$LOG")"

echo "[$(date)] Starting HeadyConnection on port $PORT..." | tee "$LOG"
cd "$APP_DIR"
npx next start -p $PORT >> "$LOG" 2>&1 &
PID=$!
echo $PID > /tmp/heady-connection.pid
sleep 3
xdg-open "http://localhost:$PORT" 2>/dev/null
echo "[$(date)] HeadyConnection running (PID=$PID) at http://localhost:$PORT"
