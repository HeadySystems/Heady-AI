#!/bin/bash
# © 2026 Heady Systems Inc.
# HCFP Autonomous Learning Cycle — Cron-safe wrapper
# Runs every 5 minutes via crontab with flock protection.
# Delegates to src/engines/learning-engine.js

REPO="/home/headyme/Heady"
LOCK="/tmp/heady-learn.flock"
LOG="$REPO/logs/learning-cron.log"

# flock — prevent overlapping instances
exec 201>"$LOCK"
flock -n 201 || {
    echo "[$(date)] Skipped: another learning instance is running" >> "$LOG"
    exit 0
}

cd "$REPO" || exit 1

# Run the learning engine
node src/engines/learning-engine.js >> "$LOG" 2>&1

exit 0
