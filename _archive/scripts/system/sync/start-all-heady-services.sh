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
# ║  FILE: _archive/scripts/system/sync/start-all-heady-services.sh                                                    ║
# ║  LAYER: automation                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
# © 2026 Heady Systems LLC.
# PROPRIETARY AND CONFIDENTIAL.
# Unauthorized copying, modification, or distribution is strictly prohibited.
#!/bin/bash

echo "🚀 Starting All Heady Services..."
echo "================================"

# Start HeadyApps Services
echo "📱 Starting HeadyApps Services..."
/home/headyme/HeadyApps/HeadyBuddy/start.sh &
/home/headyme/HeadyApps/HeadyAI-IDE/start.sh &
/home/headyme/HeadyApps/HeadyWeb/start.sh &

# Start HeadyLocal Services
echo "🏠 Starting HeadyLocal Services..."
/home/headyme/HeadyLocal/HeadyBuddy/start.sh &
/home/headyme/HeadyLocal/HeadyAI-IDE/start.sh &
/home/headyme/HeadyLocal/HeadyWeb/start.sh &

# Start HeadyConnection Services
echo "🔗 Starting HeadyConnection Services..."
/home/headyme/HeadyConnection/headyconnection-web/start.sh &

# Start CascadeProjects Services (already running)
echo "📂 Starting CascadeProjects Services..."
cd /home/headyme/CascadeProjects/HeadyBuddy && npm run dev &
cd /home/headyme/CascadeProjects/HeadyAI-IDE && npm run dev &
cd /home/headyme/CascadeProjects/HeadyWeb && npm run dev &

echo "✅ All Heady Services Started!"
echo "🌐 Access URLs:"
echo "   HeadyBuddy: http://localhost:5180"
echo "   HeadyAI-IDE: http://localhost:5175"
echo "   HeadyWeb: http://localhost:5176"
echo "   HeadyConnection: http://localhost:3001"

echo "🌍 Production URLs (when DNS propagates):"
echo "   buddy.headysystems.com"
echo "   ide.headysystems.com"
echo "   web.headysystems.com"
echo "   headyconnection.org"

echo "🎯 Maximum Global Happiness through AI-Powered Social Impact!"
