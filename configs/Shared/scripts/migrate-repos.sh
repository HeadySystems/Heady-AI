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
# ║  FILE: configs/Shared/scripts/migrate-repos.sh                                                    ║
# ║  LAYER: automation                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
# 🔄 Repository Migration Script

set -euo pipefail

BASE_DIR="/home/headyme"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔄 Repository Migration"
echo "===================="
echo ""

# Migrate HeadyConnection web app
if [[ -d "$BASE_DIR/CascadeProjects/Heady/headyconnection-web" ]]; then
    echo "📦 Migrating HeadyConnection web app..."
    
    # Copy to new location
    cp -r "$BASE_DIR/CascadeProjects/Heady/headyconnection-web" "$BASE_DIR/HeadyConnection/web/main-app/"
    
    # Update git remote
    cd "$BASE_DIR/HeadyConnection/web/main-app/"
    if git remote get-url origin >/dev/null 2>&1; then
        echo "  🔄 Updating git remote..."
        # Will need to be updated when HeadyConnection repo is created
    fi
    
    echo -e "${GREEN}✅ HeadyConnection web app migrated${NC}"
fi

# Migrate CascadeProjects
if [[ -d "$BASE_DIR/CascadeProjects" && ! -d "$BASE_DIR/HeadyMe/CascadeProjects" ]]; then
    echo "📦 Migrating CascadeProjects..."
    
    mv "$BASE_DIR/CascadeProjects" "$BASE_DIR/HeadyMe/"
    
    echo -e "${GREEN}✅ CascadeProjects migrated${NC}"
fi

# Migrate HeadyLocal
if [[ -d "$BASE_DIR/HeadyLocal" ]]; then
    echo "📦 Organizing HeadyLocal content..."
    
    # Move HeadyLocal apps to appropriate locations
    if [[ -d "$BASE_DIR/HeadyLocal/apps" ]]; then
        find "$BASE_DIR/HeadyLocal/apps" -maxdepth 1 -type d -not -path "$BASE_DIR/HeadyLocal/apps" | while read -r app; do
            app_name=$(basename "$app")
            echo "  📁 Moving app: $app_name"
            # Determine appropriate location based on app name
            if [[ "$app_name" == *"headyconnection"* ]]; then
                mv "$app" "$BASE_DIR/HeadyConnection/web/"
            else
                mv "$app" "$BASE_DIR/HeadyMe/experiments/"
            fi
        done
    fi
    
    # Remove empty HeadyLocal
    rmdir "$BASE_DIR/HeadyLocal/apps" 2>/dev/null || true
    rmdir "$BASE_DIR/HeadyLocal" 2>/dev/null || true
    
    echo -e "${GREEN}✅ HeadyLocal organized${NC}"
fi

echo ""
echo "🎉 Migration completed!"
echo ""
echo "📋 Next steps:"
echo "1. Create remote repositories on GitHub"
echo "2. Update git remotes in local repositories"
echo "3. Push migrated repositories"
echo ""
echo "🔧 Commands to run:"
echo "  $BASE_DIR/Shared/scripts/repo-manager.sh status-all"
echo "  $BASE_DIR/Shared/scripts/repo-manager.sh list-repos"
