#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ Provider Separation — 00 Preflight Check                   ║
# ║  Verifies all required CLIs are present and authenticated before   ║
# ║  running any of the setup scripts.                                 ║
# ║  Run: bash 00-preflight.sh                                         ║
# ╚══════════════════════════════════════════════════════════════════╝
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
PASS=0; FAIL=0

check() {
  local label="$1"; shift
  if "$@" &>/dev/null; then
    echo -e "${GREEN}✓${NC}  $label"
    ((PASS++)) || true
  else
    echo -e "${RED}✗${NC}  $label"
    ((FAIL++)) || true
  fi
}

warn() {
  echo -e "${YELLOW}⚠${NC}  $1"
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  HEADY Provider Separation — Preflight"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "── CLIs ──"
check "gcloud installed"      which gcloud
check "wrangler installed"    which wrangler
check "firebase CLI installed" which firebase
check "neon CLI installed"    which neonctl
check "gh CLI installed"      which gh
check "jq installed"          which jq
check "psql installed"        which psql
echo ""

echo "── Auth ──"
check "gcloud authenticated"  gcloud auth print-identity-token
check "gcloud project set"    gcloud config get-value project
check "wrangler authenticated" wrangler whoami
check "firebase authenticated" firebase login --interactive=false
check "neonctl authenticated"  neonctl me
check "gh authenticated"       gh auth status
echo ""

echo "── Required environment variables ──"
check "LEGACY_GCP_PROJECT set"   test -n "${LEGACY_GCP_PROJECT:-}"
check "REBUILD_GCP_PROJECT set"  test -n "${REBUILD_GCP_PROJECT:-}"
check "CF_ACCOUNT_ID set"        test -n "${CF_ACCOUNT_ID:-}"

if [ -z "${LEGACY_GCP_PROJECT:-}" ]; then
  warn "Set LEGACY_GCP_PROJECT (e.g. heady-production or heady-ai)"
fi
if [ -z "${REBUILD_GCP_PROJECT:-}" ]; then
  warn "Set REBUILD_GCP_PROJECT (e.g. heady-rebuild)"
fi
if [ -z "${CF_ACCOUNT_ID:-}" ]; then
  warn "Set CF_ACCOUNT_ID — find it: wrangler whoami"
fi
echo ""

echo "── Summary ──"
echo -e "  ${GREEN}Passed: $PASS${NC}  ${RED}Failed: $FAIL${NC}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}Fix the above issues before running setup scripts.${NC}"
  exit 1
else
  echo -e "${GREEN}All checks passed. Ready to run setup scripts.${NC}"
  echo ""
  echo "  Suggested run order:"
  echo "    1.  bash 01-gcp-setup.sh"
  echo "    2.  bash 02-neon-setup.sh"
  echo "    3.  bash 03-firebase-setup.sh"
  echo "    4.  bash 04-cloudflare-setup.sh"
  echo "    5.  bash 05-headykey-deploy.sh"
  echo "    6.  bash 06-headyvault-seed.sh"
  echo "    7.  bash 07-wrangler-envs.sh"
fi
