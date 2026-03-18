#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Heady™ Benchmark Runner
# Runs all k6 load tests and outputs results to .benchmarks/results/
# © 2026 HeadySystems Inc. All Rights Reserved.
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/results"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "${RESULTS_DIR}"

echo "═══ Heady™ Benchmark Suite ═══"
echo "Timestamp: ${TIMESTAMP}"
echo ""

# Check k6 installation
if ! command -v k6 &> /dev/null; then
  echo "k6 not found. Install: https://k6.io/docs/getting-started/installation/"
  echo "  brew install k6  (macOS)"
  echo "  snap install k6  (Linux)"
  exit 1
fi

echo "─── Running Health Check Benchmark ───"
k6 run "${SCRIPT_DIR}/k6-health-check.js" \
  --out json="${RESULTS_DIR}/health-${TIMESTAMP}.json" \
  2>&1 | tee "${RESULTS_DIR}/health-${TIMESTAMP}.log"

echo ""
echo "═══ Benchmarks Complete ═══"
echo "Results saved to: ${RESULTS_DIR}/"
ls -la "${RESULTS_DIR}/"
