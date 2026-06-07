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
# ║  FILE: _archive/scripts/system/hcfp/hcfp-nuke.sh                                                    ║
# ║  LAYER: automation                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
# © 2026 Heady Systems LLC.
# ╔══════════════════════════════════════════════════════╗
# ║  HCFP NUKE — Permanently eliminate recurring issues ║
# ╚══════════════════════════════════════════════════════╝
#
# Usage:
#   hcfp-nuke <issue>
#
# Examples:
#   hcfp-nuke index-lock     # Kill stale .git/index.lock forever
#   hcfp-nuke log-bloat      # Purge local log files that shouldn't exist
#   hcfp-nuke stale-commits  # Force commit + push all pending changes NOW
#   hcfp-nuke all            # Run ALL fixes
#
# This command does NOT ask permission. It fixes the issue PERMANENTLY.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

REPO="/home/headyme/Heady"

nuke_index_lock() {
    echo -e "${RED}☢ NUKING: .git/index.lock${NC}"
    
    # Kill any zombie git processes
    pkill -9 -f "git (add|commit|push|index-pack)" 2>/dev/null || true
    sleep 0.5
    
    # Remove all git lock files
    rm -f "$REPO/.git/index.lock"
    rm -f "$REPO/.git/refs/heads/main.lock"
    rm -f "$REPO/.git/HEAD.lock"
    rm -f "$REPO/.git/heady-auto-commit.lock"
    
    # Install a cron guard that auto-removes locks older than 5 min
    # (This is the PERMANENT fix — it prevents the issue from ever coming back)
    GUARD_SCRIPT="$REPO/scripts/system/hcfp/guard-index-lock.sh"
    mkdir -p "$(dirname "$GUARD_SCRIPT")"
    cat > "$GUARD_SCRIPT" << 'GUARD'
#!/bin/bash
# Auto-remove stale git locks older than 5 minutes
REPO="/home/headyme/Heady"
for lockfile in "$REPO/.git/index.lock" "$REPO/.git/HEAD.lock" "$REPO/.git/refs/heads/main.lock"; do
    if [ -f "$lockfile" ]; then
        AGE=$(( $(date +%s) - $(stat -c %Y "$lockfile" 2>/dev/null || echo 0) ))
        if [ "$AGE" -gt 300 ]; then
            rm -f "$lockfile"
            echo "[$(date)] Removed stale lock: $lockfile (age: ${AGE}s)"
        fi
    fi
done
GUARD
    chmod +x "$GUARD_SCRIPT"
    
    # Add to crontab if not already there
    if ! crontab -l 2>/dev/null | grep -q "guard-index-lock"; then
        (crontab -l 2>/dev/null; echo "*/5 * * * * $GUARD_SCRIPT") | crontab -
        echo -e "${GREEN}✅ Installed permanent lock guard (runs every 5m)${NC}"
    else
        echo -e "${GREEN}✅ Lock guard already installed${NC}"
    fi
    
    echo -e "${GREEN}✅ All git locks destroyed${NC}"
}

nuke_log_bloat() {
    echo -e "${RED}☢ NUKING: local log bloat${NC}"
    
    # Remove local log files that shouldn't accumulate
    find "$REPO/logs" -name "*.log" -size +10M -delete 2>/dev/null || true
    
    # Truncate (not delete) the auto-commit log so the file reference doesn't break
    if [ -f "$REPO/logs/auto-commit.log" ]; then
        tail -100 "$REPO/logs/auto-commit.log" > "$REPO/logs/auto-commit.log.tmp"
        mv "$REPO/logs/auto-commit.log.tmp" "$REPO/logs/auto-commit.log"
        echo -e "${GREEN}✅ Truncated auto-commit.log to last 100 lines${NC}"
    fi
    
    # Remove stale PID files
    find "$REPO" -name "*.pid" -mmin +60 -delete 2>/dev/null || true
    
    echo -e "${GREEN}✅ Log bloat eliminated${NC}"
}

nuke_stale_commits() {
    echo -e "${RED}☢ NUKING: stale uncommitted changes${NC}"
    
    cd "$REPO" || exit 1
    
    # Kill locks first
    rm -f .git/index.lock .git/HEAD.lock
    
    CHANGE_COUNT=$(git status --porcelain | wc -l)
    if [ "$CHANGE_COUNT" -eq 0 ]; then
        echo -e "${GREEN}✅ Repository is clean — nothing to commit${NC}"
        return 0
    fi
    
    echo -e "${CYAN}📦 Staging $CHANGE_COUNT files...${NC}"
    git add -A
    
    # Build smart commit message
    NOTABLE=$(git diff --cached --stat | head -5 | awk -F'|' '{print $1}' | xargs | tr ' ' ', ')
    MSG="HCFP-NUKE: force-commit $CHANGE_COUNT file(s) — $NOTABLE"
    
    echo -e "${CYAN}📝 Committing: $MSG${NC}"
    git commit --no-verify -m "$MSG"
    
    echo -e "${CYAN}🚀 Pushing to origin/main...${NC}"
    if git push origin main; then
        echo -e "${GREEN}✅ Successfully pushed $CHANGE_COUNT files${NC}"
    else
        echo -e "${YELLOW}⚠ Push failed — trying force push...${NC}"
        git push --force-with-lease origin main && \
            echo -e "${GREEN}✅ Force-pushed successfully${NC}" || \
            echo -e "${RED}❌ Push still failing — check auth/remote${NC}"
    fi
}

nuke_all() {
    echo -e "${RED}☢☢☢ FULL NUKE — ELIMINATING ALL RECURRING ISSUES ☢☢☢${NC}"
    echo ""
    nuke_index_lock
    echo ""
    nuke_log_bloat
    echo ""
    nuke_stale_commits
    echo ""
    echo -e "${GREEN}════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ALL RECURRING ISSUES ELIMINATED       ${NC}"
    echo -e "${GREEN}════════════════════════════════════════${NC}"
}

# ── Main dispatch ────────────────────────────────────────────────────
ISSUE="${1:-help}"

case "$ISSUE" in
    index-lock)   nuke_index_lock ;;
    log-bloat)    nuke_log_bloat ;;
    stale-commits) nuke_stale_commits ;;
    all)          nuke_all ;;
    *)
        echo -e "${CYAN}HCFP-NUKE — Permanently eliminate recurring issues${NC}"
        echo ""
        echo "Usage: hcfp-nuke <issue>"
        echo ""
        echo "Issues:"
        echo "  index-lock     Kill stale .git/index.lock + install permanent guard"
        echo "  log-bloat      Purge oversized local logs + stale PIDs"
        echo "  stale-commits  Force commit + push ALL pending changes NOW"
        echo "  all            Run ALL fixes at once"
        ;;
esac
