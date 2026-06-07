#!/usr/bin/env bash
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
# ║  FILE: heady-complete/scripts/smoke-test.sh                                                    ║
# ║  LAYER: automation                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
set -euo pipefail
BASE="${1:-http://localhost:3301}"
PASS=0; FAIL=0; TOTAL=0
green() { echo -e "\033[0;32m$1\033[0m"; }
red() { echo -e "\033[0;31m$1\033[0m"; }
check() {
  TOTAL=$((TOTAL+1))
  status=$(curl -s -o /dev/null -w "%{http_code}" "$2" 2>/dev/null || echo "000")
  [ "$status" == "${3:-200}" ] && { green "  ✅ $1 ($status)"; PASS=$((PASS+1)); } || { red "  ❌ $1 (got $status)"; FAIL=$((FAIL+1)); }
}

echo -e "\n🧠 Heady Smoke Test — $BASE\n"
echo "────────────────────────────────────"
echo -e "\n🏥 Health:"
check "Basic health" "$BASE/health"
check "Deep health" "$BASE/health/deep"
echo -e "\n🤖 Agents:"
check "Agent list" "$BASE/api/agents"
check "Agent status" "$BASE/api/agents/status"
echo -e "\n🧠 Memory:"
check "Memory status" "$BASE/api/memory/status"
echo -e "\n📊 Metrics:"
check "Prometheus" "$BASE/metrics"
echo -e "\n────────────────────────────────────"
[ "$FAIL" -eq 0 ] && green "\n✅ All $TOTAL passed!\n" || red "\n❌ $FAIL/$TOTAL failed.\n"
[ "$FAIL" -eq 0 ]
