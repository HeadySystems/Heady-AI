#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Heady Benchmark Runner
# Runs all k6 load tests and outputs results to .benchmarks/results/
#
# Usage:
#   ./run-benchmarks.sh                          # Run all benchmarks
#   ./run-benchmarks.sh health                   # Health checks only
#   ./run-benchmarks.sh mcp                      # MCP tools only
#   HEADY_AUTH_TOKEN=<tok> ./run-benchmarks.sh   # With auth
#
# GCP Project: gen-lang-client-0920560496
# © 2026 HeadySystems Inc. All Rights Reserved.
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Constants ────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/results"
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
SUMMARY_FILE="${RESULTS_DIR}/summary-${TIMESTAMP}.txt"

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error()   { echo -e "${RED}[FAIL]${NC} $*"; }

# ─── Prerequisites ───────────────────────────────────────────────────────────
check_prerequisites() {
  if ! command -v k6 &>/dev/null; then
    log_error "k6 is not installed. See README.md for installation instructions."
    echo ""
    echo "  Quick install:"
    echo "    macOS:  brew install k6"
    echo "    Linux:  snap install k6"
    echo "    Docker: docker run --rm -i grafana/k6 run -"
    echo ""
    exit 1
  fi
  log_info "k6 version: $(k6 version 2>/dev/null || echo 'unknown')"
}

# ─── Benchmark Runners ───────────────────────────────────────────────────────
run_health_check() {
  log_info "Running health check benchmark (100 VUs, 30s)..."
  echo ""

  local exit_code=0
  k6 run \
    --out json="${RESULTS_DIR}/health-raw-${TIMESTAMP}.json" \
    "${SCRIPT_DIR}/k6-health-check.js" 2>&1 | tee -a "${SUMMARY_FILE}" || exit_code=$?

  echo ""
  if [ "${exit_code}" -eq 0 ]; then
    log_success "Health check benchmark — all thresholds passed"
  elif [ "${exit_code}" -eq 99 ]; then
    log_warn "Health check benchmark — some thresholds exceeded"
  else
    log_error "Health check benchmark failed (exit ${exit_code})"
  fi

  return "${exit_code}"
}

run_mcp_tools() {
  log_info "Running MCP tool benchmark (100 VUs, 30s)..."
  echo ""

  local exit_code=0
  k6 run \
    --out json="${RESULTS_DIR}/mcp-tools-raw-${TIMESTAMP}.json" \
    "${SCRIPT_DIR}/k6-mcp-tools.js" 2>&1 | tee -a "${SUMMARY_FILE}" || exit_code=$?

  echo ""
  if [ "${exit_code}" -eq 0 ]; then
    log_success "MCP tool benchmark — all thresholds passed"
  elif [ "${exit_code}" -eq 99 ]; then
    log_warn "MCP tool benchmark — some thresholds exceeded"
  else
    log_error "MCP tool benchmark failed (exit ${exit_code})"
  fi

  return "${exit_code}"
}

# ─── Summary ──────────────────────────────────────────────────────────────────
print_summary() {
  echo ""
  echo "================================================================="
  echo "  BENCHMARK SUMMARY"
  echo "================================================================="
  echo ""
  echo "  Results directory: ${RESULTS_DIR}"
  echo "  Summary file:     ${SUMMARY_FILE}"
  echo ""
  echo "  Files generated:"
  ls -1 "${RESULTS_DIR}/"*"${TIMESTAMP}"* 2>/dev/null | while read -r f; do
    echo "    ${f}"
  done
  echo ""
  echo "  Threshold reference (phi-derived):"
  echo "    Health p99:      < 50ms   (investor claim)"
  echo "    Health p95:      < 34ms   (FIB[8])"
  echo "    Health p50:      < 21ms   (FIB[7])"
  echo "    Cognitive p99:   < 1618ms (phi * 1000)"
  echo "    Cognitive p95:   < 987ms  (FIB[16])"
  echo "    Error rate:      < 1%     (health) / < 5% (tools)"
  echo ""
  echo "================================================================="
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
  local mode="${1:-all}"
  local overall_exit=0

  echo ""
  echo "================================================================="
  echo "  HEADY BENCHMARK SUITE"
  echo "  Timestamp: ${TIMESTAMP}"
  echo "  Runner:    $(hostname 2>/dev/null || echo 'unknown')"
  echo "================================================================="
  echo ""

  check_prerequisites
  mkdir -p "${RESULTS_DIR}"

  # Initialize summary file
  {
    echo "HEADY BENCHMARK RESULTS — ${TIMESTAMP}"
    echo "================================================"
    echo ""
  } > "${SUMMARY_FILE}"

  case "${mode}" in
    health)
      run_health_check || overall_exit=$?
      ;;
    mcp)
      run_mcp_tools || overall_exit=$?
      ;;
    all)
      run_health_check || overall_exit=$?
      echo ""
      log_info "Pausing between benchmark runs..."
      sleep 2
      echo ""
      run_mcp_tools || overall_exit=$?
      ;;
    *)
      log_error "Unknown mode: ${mode}"
      echo "  Usage: $0 [health|mcp|all]"
      exit 1
      ;;
  esac

  print_summary

  if [ "${overall_exit}" -ne 0 ]; then
    echo ""
    log_warn "One or more thresholds were exceeded."
    log_warn "Exit code 99 = threshold violation (benchmark ran successfully)."
    echo ""
  fi

  exit "${overall_exit}"
}

cd "${SCRIPT_DIR}"
main "$@"
