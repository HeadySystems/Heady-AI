#!/usr/bin/env bash
# Heady Docker Security Scan — Sacred Genesis v4.0.0
# Scans all Heady service images for vulnerabilities
# Author: Eric Haywood, HeadySystems Inc.

set -euo pipefail

SEVERITY_THRESHOLD="HIGH,CRITICAL"
SCAN_TIMEOUT=233  # Fibonacci-derived seconds

echo '{"level":"info","service":"security-scan","message":"Starting container security scan"}'

SERVICES_DIR="./services"
FAILURES=0
SCANNED=0

for service_dir in "${SERVICES_DIR}"/*/; do
  service_name=$(basename "${service_dir}")

  if [ ! -f "${service_dir}/Dockerfile" ]; then
    continue
  fi

  SCANNED=$((SCANNED + 1))
  IMAGE_TAG="heady/${service_name}:scan"

  echo '{"level":"info","service":"security-scan","message":"Scanning","target":"'"${service_name}"'"}'

  # Build image for scanning
  docker build -t "${IMAGE_TAG}" -f "${service_dir}/Dockerfile" . --quiet 2>/dev/null || {
    echo '{"level":"warn","service":"security-scan","message":"Build failed","target":"'"${service_name}"'"}'
    FAILURES=$((FAILURES + 1))
    continue
  }

  # Run Trivy scan
  trivy image --severity "${SEVERITY_THRESHOLD}" --exit-code 1 --timeout "${SCAN_TIMEOUT}s" \
    --format json --output "/tmp/scan-${service_name}.json" \
    "${IMAGE_TAG}" 2>/dev/null || {
    echo '{"level":"critical","service":"security-scan","message":"Vulnerabilities found","target":"'"${service_name}"'"}'
    FAILURES=$((FAILURES + 1))
  }

  # Cleanup
  docker rmi "${IMAGE_TAG}" --force 2>/dev/null || true
done

echo '{"level":"info","service":"security-scan","message":"Scan complete","scanned":'"${SCANNED}"',"failures":'"${FAILURES}"'}'

exit ${FAILURES}
