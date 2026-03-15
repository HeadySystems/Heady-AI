#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
#  HEADY™ Docker Auth Configuration
#  Configures Docker credential helpers for dual-registry pipeline:
#    - Docker Hub (Team plan) → base images, public pulls
#    - Artifact Registry (GCP) → production images
#
#  Usage:
#    ./scripts/docker-auth-setup.sh
#
#  © 2026 Heady™Systems Inc. All rights reserved.
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

log() { echo -e "${GREEN}✓${NC} $*"; }
step() { echo -e "\n${CYAN}→${NC} ${BOLD}$*${NC}"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }

echo -e "\n${CYAN}═══ HEADY™ Docker Auth Setup ═══${NC}\n"

# ─── Docker Hub ───────────────────────────────────────────────────
step "Checking Docker Hub authentication..."

if docker info 2>/dev/null | grep -q "Username:"; then
  DOCKER_USER=$(docker info 2>/dev/null | grep "Username:" | awk '{print $2}')
  log "Docker Hub: logged in as $DOCKER_USER"
else
  warn "Not logged in to Docker Hub."
  echo "  Run: docker login"
  echo "  Use your Docker Team credentials"
fi

# ─── Artifact Registry ───────────────────────────────────────────
step "Checking Artifact Registry authentication..."

if gcloud auth print-access-token &>/dev/null; then
  ACCOUNT=$(gcloud config get-value account 2>/dev/null)
  log "gcloud authenticated as: $ACCOUNT"

  # Configure Docker credential helper for Artifact Registry
  gcloud auth configure-docker "us-central1-docker.pkg.dev" --quiet 2>/dev/null
  log "Docker credential helper configured for us-central1-docker.pkg.dev"
else
  warn "gcloud auth expired."
  echo "  Run: gcloud auth login"
fi

# ─── Verify Docker Config ────────────────────────────────────────
step "Docker credential config:"
DOCKER_CONFIG="${HOME}/.docker/config.json"

if [[ -f "$DOCKER_CONFIG" ]]; then
  echo ""
  echo "  Credential helpers:"
  python3 -c "
import json, sys
with open('$DOCKER_CONFIG') as f:
    cfg = json.load(f)
helpers = cfg.get('credHelpers', {})
auths = cfg.get('auths', {})
for registry, helper in helpers.items():
    print(f'    {registry} → {helper}')
for registry in auths:
    print(f'    {registry} → stored credentials')
if not helpers and not auths:
    print('    (none configured)')
" 2>/dev/null || echo "  (unable to parse config)"
else
  warn "No Docker config found at $DOCKER_CONFIG"
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e " ${BOLD}Auth Summary${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Docker Hub${NC}          → Base images (node, python, postgres)"
echo -e "  ${BOLD}Artifact Registry${NC}   → Production built images (heady-*)"
echo ""
echo -e "  Pipeline flow:"
echo -e "  ${CYAN}Docker Hub${NC} ──(FROM)──▶ ${CYAN}Cloud Build${NC} ──(push)──▶ ${CYAN}Artifact Registry${NC} ──(deploy)──▶ ${CYAN}Cloud Run${NC}"
echo ""
