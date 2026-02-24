#!/bin/bash
# HeadyAI-IDE — Custom Web-Based IDE
APP_DIR="/home/headyme/Heady/heady-ide-ui"
PORT=4300
LOG="/home/headyme/Heady/logs/heady-ai-ide.log"
mkdir -p "$(dirname "$LOG")"

echo "[$(date)] Starting HeadyAI-IDE on port $PORT..." | tee "$LOG"
cd "$APP_DIR"
if [ ! -d "node_modules" ]; then npm install >> "$LOG" 2>&1; fi
npx vite --port $PORT --host 0.0.0.0 >> "$LOG" 2>&1 &
PID=$!
echo $PID > /tmp/heady-ai-ide.pid
sleep 2
xdg-open "http://localhost:$PORT" 2>/dev/null
echo "[$(date)] HeadyAI-IDE running (PID=$PID) at http://localhost:$PORT"
