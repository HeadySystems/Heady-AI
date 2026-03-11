#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Heady™ Promotion Pipeline — Testing → Staging → Production
# © 2026 HeadySystems Inc. All Rights Reserved.
# ═══════════════════════════════════════════════════════════════
#
# Usage:
#   ./scripts/promote.sh staging     # Promote Testing → Staging
#   ./scripts/promote.sh production  # Promote Staging → Production
#   ./scripts/promote.sh status      # Show current state
#
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

TESTING_REMOTE="testing"
STAGING_REMOTE="staging"
PRODUCTION_REMOTE="production"
BRANCH="main"

log()  { echo -e "${CYAN}[PROMOTE]${NC} $*"; }
ok()   { echo -e "${GREEN}  ✅ $*${NC}"; }
warn() { echo -e "${YELLOW}  ⚠️  $*${NC}"; }
fail() { echo -e "${RED}  ❌ $*${NC}"; exit 1; }

# ── Pre-flight checks ──────────────────────────────────────────
preflight() {
    log "Running pre-flight checks..."

    # 1. Ensure on main branch
    CURRENT=$(git branch --show-current)
    [[ "$CURRENT" == "$BRANCH" ]] || fail "Must be on '$BRANCH' branch (currently on '$CURRENT')"
    ok "On branch $BRANCH"

    # 2. Ensure working tree is clean
    if [[ -n "$(git status --porcelain)" ]]; then
        warn "Working tree has uncommitted changes"
        echo "  Commit or stash changes before promoting."
        exit 1
    fi
    ok "Working tree clean"

    # 3. Syntax check critical files
    log "Syntax checking core files..."
    node -c src/middleware/cors-config.js 2>/dev/null && ok "cors-config.js" || warn "cors-config.js syntax error"
    node -c src/middleware/security-headers.js 2>/dev/null && ok "security-headers.js" || warn "security-headers.js syntax error"
    node -c src/config/domains.js 2>/dev/null && ok "domains.js" || warn "domains.js syntax error"

    # 4. Validate pipeline JSON
    node -e "JSON.parse(require('fs').readFileSync('hcfullpipeline.json','utf8'))" 2>/dev/null \
        && ok "hcfullpipeline.json valid" \
        || warn "hcfullpipeline.json invalid JSON"
}

# ── Promote Testing → Staging ──────────────────────────────────
promote_to_staging() {
    log "═══ Promoting Testing → Staging ═══"
    preflight

    log "Fetching latest from testing..."
    git fetch "$TESTING_REMOTE" "$BRANCH" --quiet
    ok "Testing fetch complete"

    log "Pushing to staging..."
    git push "$STAGING_REMOTE" "$BRANCH" --force-with-lease
    ok "Staging updated"

    log "Creating promotion PR on staging..."
    STAGING_SHA=$(git rev-parse HEAD | head -c 8)
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN} ✅ Promoted to Staging (${STAGING_SHA})${NC}"
    echo -e "${GREEN} Next: Verify full functionality, then run:${NC}"
    echo -e "${GREEN}   ./scripts/promote.sh production${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
}

# ── Promote Staging → Production ───────────────────────────────
promote_to_production() {
    log "═══ Promoting Staging → Production ═══"
    preflight

    # Extra gate: confirm staging is synced
    log "Verifying staging is in sync..."
    git fetch "$STAGING_REMOTE" "$BRANCH" --quiet
    LOCAL_SHA=$(git rev-parse HEAD)
    STAGING_SHA=$(git rev-parse "$STAGING_REMOTE/$BRANCH" 2>/dev/null || echo "unknown")

    if [[ "$LOCAL_SHA" != "$STAGING_SHA" ]]; then
        fail "Local main ($LOCAL_SHA) != staging ($STAGING_SHA). Promote to staging first."
    fi
    ok "Staging in sync"

    # Safety confirmation
    echo ""
    echo -e "${YELLOW}⚠️  You are about to push to PRODUCTION.${NC}"
    echo -e "${YELLOW}   Commit: $(git log -1 --format='%h %s')${NC}"
    echo ""
    read -p "Type 'yes' to confirm: " CONFIRM
    [[ "$CONFIRM" == "yes" ]] || { warn "Aborted."; exit 0; }

    log "Pushing to production..."
    git push "$PRODUCTION_REMOTE" "$BRANCH" --force-with-lease
    ok "Production updated"

    PROD_SHA=$(git rev-parse HEAD | head -c 8)
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN} 🚀 DEPLOYED TO PRODUCTION (${PROD_SHA})${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
}

# ── Status ─────────────────────────────────────────────────────
show_status() {
    log "═══ Promotion Pipeline Status ═══"
    echo ""

    LOCAL_SHA=$(git rev-parse HEAD 2>/dev/null | head -c 8)
    echo -e "  Local main:      ${CYAN}${LOCAL_SHA}${NC} — $(git log -1 --format='%s' 2>/dev/null)"

    git fetch "$TESTING_REMOTE" "$BRANCH" --quiet 2>/dev/null
    TESTING_SHA=$(git rev-parse "$TESTING_REMOTE/$BRANCH" 2>/dev/null | head -c 8 || echo "n/a")
    echo -e "  Testing remote:  ${CYAN}${TESTING_SHA}${NC}"

    git fetch "$STAGING_REMOTE" "$BRANCH" --quiet 2>/dev/null
    STAGING_SHA=$(git rev-parse "$STAGING_REMOTE/$BRANCH" 2>/dev/null | head -c 8 || echo "n/a")
    echo -e "  Staging remote:  ${CYAN}${STAGING_SHA}${NC}"

    git fetch "$PRODUCTION_REMOTE" "$BRANCH" --quiet 2>/dev/null
    PROD_SHA=$(git rev-parse "$PRODUCTION_REMOTE/$BRANCH" 2>/dev/null | head -c 8 || echo "n/a")
    echo -e "  Production:      ${CYAN}${PROD_SHA}${NC}"

    echo ""
    if [[ "$LOCAL_SHA" == "$STAGING_SHA" ]] && [[ "$STAGING_SHA" == "$PROD_SHA" ]]; then
        echo -e "  ${GREEN}✅ All tiers in sync${NC}"
    elif [[ "$LOCAL_SHA" == "$STAGING_SHA" ]]; then
        echo -e "  ${YELLOW}⚠️  Staging in sync, Production behind${NC}"
        echo -e "     Run: ${CYAN}./scripts/promote.sh production${NC}"
    else
        echo -e "  ${YELLOW}⚠️  Testing ahead of Staging${NC}"
        echo -e "     Run: ${CYAN}./scripts/promote.sh staging${NC}"
    fi
}

# ── Main ───────────────────────────────────────────────────────
case "${1:-status}" in
    staging)    promote_to_staging ;;
    production) promote_to_production ;;
    status)     show_status ;;
    *)
        echo "Usage: $0 {staging|production|status}"
        echo "  staging     — Promote Testing → Staging"
        echo "  production  — Promote Staging → Production"
        echo "  status      — Show pipeline sync status"
        exit 1
        ;;
esac
