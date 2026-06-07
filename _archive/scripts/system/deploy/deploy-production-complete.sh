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
# ║  FILE: _archive/scripts/system/deploy/deploy-production-complete.sh                                                    ║
# ║  LAYER: automation                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
# © 2026 Heady Systems LLC.
# PROPRIETARY AND CONFIDENTIAL.
# Unauthorized copying, modification, or distribution is strictly prohibited.
#!/bin/bash
# deploy-production-complete.sh - Complete production deployment

set -e

echo "🚀 COMPLETE PRODUCTION DEPLOYMENT"
echo "================================="

# Load environment
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

echo "Select deployment target:"
echo "1) Cloudflare Workers (Global Edge)"
echo "2) Mini-Computer/Edge Device"
echo "3) Both (Hybrid Setup)"
echo "4) Local Development Only"

read -p "Choose option (1-4): " choice

case $choice in
    1)
        echo "🌩️  Deploying to Cloudflare Workers..."
        cd /home/headyme/cloudflare-workers
        wrangler deploy heady-router-worker.js --name heady-router --env=""
        ;;
    2)
        echo "🖥️  Deploying to Mini-Computer..."
        ./setup-mini-computer.sh
        ;;
    3)
        echo "🌐 Hybrid Deployment - Both Cloudflare Workers and Mini-Computer"
        echo "Deploying to Cloudflare Workers first..."
        cd /home/headyme/cloudflare-workers
        wrangler deploy heady-router-worker.js --name heady-router --env=""
        cd /home/headyme
        echo "Then setting up mini-computer..."
        ./setup-mini-computer.sh
        ;;
    4)
        echo "🏠 Local Development Setup"
        echo "Starting local servers..."
        
        # Kill existing servers
        pkill -f "python3 -m http.server" || true
        
        # Start all local servers
        cd /home/headyme && python3 -m http.server 9000 --directory headybuddy/dist &
        cd /home/headyme && python3 -m http.server 9001 --directory headysystems/dist &
        cd /home/headyme && python3 -m http.server 9002 --directory headyconnection/dist &
        cd /home/headyme && python3 -m http.server 9003 --directory headymcp/dist &
        cd /home/headyme && python3 -m http.server 9004 --directory headyio/dist &
        cd /home/headyme && python3 -m http.server 9005 --directory headyme/dist &
        
        echo "✅ Local servers started on ports 9000-9005"
        ;;
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo ""
echo "📋 Next Steps:"
echo "1. Configure DNS records to point to your deployment"
echo "2. Set up SSL certificates (if using mini-computer)"
echo "3. Test all domains and cross-domain navigation"
echo "4. Configure monitoring and alerts"
echo ""
echo "🌐 Your Heady ecosystem is now live!"
