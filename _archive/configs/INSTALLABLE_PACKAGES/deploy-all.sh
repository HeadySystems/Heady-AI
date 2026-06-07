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
# ║  FILE: _archive/configs/INSTALLABLE_PACKAGES/deploy-all.sh                                                    ║
# ║  LAYER: config                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

echo "🚀 Deploying All Heady Installable Packages..."
echo "============================================"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Deploy HeadyBuddy
echo "🤖 Deploying HeadyBuddy..."
cd "$SCRIPT_DIR/HeadyBuddy"
npx -y wrangler pages deploy . --project-name=heady-buddy 2>/dev/null &
BUDDY_PID=$!

# Deploy HeadyAI-IDE
echo "💻 Deploying HeadyAI-IDE..."
cd "$SCRIPT_DIR/HeadyAI-IDE"
npx -y wrangler pages deploy . --project-name=heady-ide 2>/dev/null &
IDE_PID=$!

# Deploy HeadyWeb
echo "🌐 Deploying HeadyWeb..."
cd "$SCRIPT_DIR/HeadyWeb"
npx -y wrangler pages deploy . --project-name=heady-web 2>/dev/null &
WEB_PID=$!

echo "✅ All packages deploying!"
echo "🌐 Production URLs:"
echo "   HeadyBuddy: https://headyme.com/buddy"
echo "   HeadyAI-IDE: https://headyme.com/ide"
echo "   HeadyWeb:    https://headyme.com"

echo "🎯 Waiting for deploys to complete..."

# Wait for all deploys
wait $BUDDY_PID $IDE_PID $WEB_PID 2>/dev/null

echo "🎉 All packages deployed to production!"
