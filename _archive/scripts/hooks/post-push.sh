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
# ║  FILE: _archive/scripts/hooks/post-push.sh                                                    ║
# ║  LAYER: automation                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
# © 2026 Heady Systems LLC.
# PROPRIETARY AND CONFIDENTIAL.
# Unauthorized copying, modification, or distribution is strictly prohibited.
#!/bin/bash
# Heady post-push hook — auto-sync and audit-log to Notion after push
# Install: ln -sf ../../scripts/hooks/post-push.sh .git/hooks/post-push

SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
NOTION_TOKEN=$(grep NOTION_TOKEN "$SCRIPT_DIR/.env" 2>/dev/null | cut -d '=' -f2)

if [ -n "$NOTION_TOKEN" ]; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  COMMIT=$(git log -1 --format="%h %s" 2>/dev/null || echo "unknown")
  
  echo "📋 Logging push audit to Notion..."
  NOTION_TOKEN="$NOTION_TOKEN" node "$SCRIPT_DIR/src/services/heady-notion.js" audit "Git push: [$BRANCH] $COMMIT" 2>&1 | tail -1
  echo "✅ Notion audit logged"
else
  echo "⚠ NOTION_TOKEN not found — skipping Notion audit"
fi
