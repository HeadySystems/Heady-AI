#!/usr/bin/env bash

################################################################################
# Heady™ Validation Script
# Validates all required files, syntax, and dependencies
################################################################################

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script variables
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MCP_SERVICE_DIR="${REPO_ROOT}/services/heady-mcp-server"
CHECKS_PASSED=0
CHECKS_FAILED=0
TOTAL_CHECKS=0

################################################################################
# Utility Functions
################################################################################

log_pass() {
  echo -e "${GREEN}[✓]${NC} $*"
  ((CHECKS_PASSED++))
}

log_fail() {
  echo -e "${RED}[✗]${NC} $*"
  ((CHECKS_FAILED++))
}

log_info() {
  echo -e "${BLUE}[→]${NC} $*"
}

print_section() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}${1}${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_summary() {
  echo ""
  echo -e "${BLUE}────────────────────────────────────────────────────────────${NC}"
  echo -e "${BLUE}Validation Summary${NC}"
  echo -e "${BLUE}────────────────────────────────────────────────────────────${NC}"
  echo -e "Total Checks:    ${TOTAL_CHECKS}"
  echo -e "Passed:          ${GREEN}${CHECKS_PASSED}${NC}"
  echo -e "Failed:          ${RED}${CHECKS_FAILED}${NC}"
  echo -e "${BLUE}────────────────────────────────────────────────────────────${NC}"
  echo ""

  if [[ ${CHECKS_FAILED} -eq 0 ]]; then
    echo -e "${GREEN}[✓] All validation checks passed!${NC}"
    return 0
  else
    echo -e "${RED}[✗] Validation failed: ${CHECKS_FAILED} check(s) failed${NC}"
    return 1
  fi
}

increment_check() {
  ((TOTAL_CHECKS++))
}

################################################################################
# Validation Functions
################################################################################

check_file_exists() {
  local file_path="$1"
  local description="$2"

  increment_check

  if [[ -f "${file_path}" ]]; then
    log_pass "File exists: ${description}"
    return 0
  else
    log_fail "File missing: ${description} (${file_path})"
    return 1
  fi
}

check_directory_exists() {
  local dir_path="$1"
  local description="$2"

  increment_check

  if [[ -d "${dir_path}" ]]; then
    log_pass "Directory exists: ${description}"
    return 0
  else
    log_fail "Directory missing: ${description} (${dir_path})"
    return 1
  fi
}

validate_js_syntax() {
  local file_path="$1"
  local description="$2"

  increment_check

  if ! node --check "${file_path}" 2>/dev/null; then
    log_fail "JS syntax error: ${description}"
    node --check "${file_path}" 2>&1 | sed 's/^/    /'
    return 1
  else
    log_pass "JS syntax valid: ${description}"
    return 0
  fi
}

validate_json_syntax() {
  local file_path="$1"
  local description="$2"

  increment_check

  if ! node -e "JSON.parse(require('fs').readFileSync('${file_path}', 'utf8'))" 2>/dev/null; then
    log_fail "JSON syntax error: ${description}"
    return 1
  else
    log_pass "JSON syntax valid: ${description}"
    return 0
  fi
}

check_package_dependency() {
  local package_name="$1"
  local package_json="${MCP_SERVICE_DIR}/package.json"

  increment_check

  if grep -q "\"${package_name}\"" "${package_json}"; then
    log_pass "Dependency listed: ${package_name}"
    return 0
  else
    log_fail "Dependency missing: ${package_name}"
    return 1
  fi
}

run_registry_validation() {
  increment_check

  local validate_script="${MCP_SERVICE_DIR}/src/__tests__/validate-registry.js"

  if [[ ! -f "${validate_script}" ]]; then
    log_fail "Registry validation script not found"
    return 1
  fi

  if ! node "${validate_script}" > /dev/null 2>&1; then
    log_fail "Registry validation failed"
    node "${validate_script}" 2>&1 | sed 's/^/    /'
    return 1
  else
    log_pass "Registry validation passed"
    return 0
  fi
}

################################################################################
# Main Validation Sequence
################################################################################

main() {
  print_section "Heady™ Validation Report"

  # ==========================================================================
  # Section 1: Core Service Files
  # ==========================================================================
  print_section "1. Core Service Files"

  check_directory_exists "${MCP_SERVICE_DIR}" "MCP Server Directory"
  check_file_exists "${MCP_SERVICE_DIR}/package.json" "MCP package.json"
  check_file_exists "${MCP_SERVICE_DIR}/src/index.js" "MCP Server Entry Point"
  check_file_exists "${MCP_SERVICE_DIR}/Dockerfile" "MCP Dockerfile"
  check_file_exists "${MCP_SERVICE_DIR}/.env.example" "MCP .env.example"

  # ==========================================================================
  # Section 2: Configuration Files
  # ==========================================================================
  print_section "2. Configuration Files"

  check_directory_exists "${MCP_SERVICE_DIR}/src/config" "Config Directory"
  check_file_exists "${MCP_SERVICE_DIR}/src/config/phi-constants.js" "Phi Constants"
  check_file_exists "${MCP_SERVICE_DIR}/src/config/services.js" "Services Config"

  # ==========================================================================
  # Section 3: Tool Files
  # ==========================================================================
  print_section "3. Tool Files"

  check_directory_exists "${MCP_SERVICE_DIR}/src/tools" "Tools Directory"
  check_file_exists "${MCP_SERVICE_DIR}/src/tools/service-client.js" "Service Client Tool"
  check_file_exists "${MCP_SERVICE_DIR}/src/tools/registry.js" "Registry Tool"
  check_file_exists "${MCP_SERVICE_DIR}/src/tools/drupal-integration.js" "Drupal Integration Tool"

  # ==========================================================================
  # Section 4: Transport Implementations
  # ==========================================================================
  print_section "4. Transport Implementations"

  check_directory_exists "${MCP_SERVICE_DIR}/src/transports" "Transports Directory"
  check_file_exists "${MCP_SERVICE_DIR}/src/transports/stdio.js" "Stdio Transport"
  check_file_exists "${MCP_SERVICE_DIR}/src/transports/http.js" "HTTP Transport"

  # ==========================================================================
  # Section 5: Middleware
  # ==========================================================================
  print_section "5. Middleware"

  check_directory_exists "${MCP_SERVICE_DIR}/src/middleware" "Middleware Directory"
  check_file_exists "${MCP_SERVICE_DIR}/src/middleware/circuit-breaker.js" "Circuit Breaker"
  check_file_exists "${MCP_SERVICE_DIR}/src/middleware/rate-limiter.js" "Rate Limiter"
  check_file_exists "${MCP_SERVICE_DIR}/src/middleware/logger.js" "Logger"
  check_file_exists "${MCP_SERVICE_DIR}/src/middleware/graceful-shutdown.js" "Graceful Shutdown"

  # ==========================================================================
  # Section 6: JavaScript Syntax Validation
  # ==========================================================================
  print_section "6. JavaScript Syntax Validation"

  log_info "Validating core entry point..."
  validate_js_syntax "${MCP_SERVICE_DIR}/src/index.js" "Main entry point"

  log_info "Validating configuration files..."
  validate_js_syntax "${MCP_SERVICE_DIR}/src/config/phi-constants.js" "Phi constants"
  validate_js_syntax "${MCP_SERVICE_DIR}/src/config/services.js" "Services config"

  log_info "Validating tools..."
  validate_js_syntax "${MCP_SERVICE_DIR}/src/tools/service-client.js" "Service client"
  validate_js_syntax "${MCP_SERVICE_DIR}/src/tools/registry.js" "Registry"
  validate_js_syntax "${MCP_SERVICE_DIR}/src/tools/drupal-integration.js" "Drupal integration"

  log_info "Validating transports..."
  validate_js_syntax "${MCP_SERVICE_DIR}/src/transports/stdio.js" "Stdio transport"
  validate_js_syntax "${MCP_SERVICE_DIR}/src/transports/http.js" "HTTP transport"

  log_info "Validating middleware..."
  validate_js_syntax "${MCP_SERVICE_DIR}/src/middleware/circuit-breaker.js" "Circuit breaker"
  validate_js_syntax "${MCP_SERVICE_DIR}/src/middleware/rate-limiter.js" "Rate limiter"
  validate_js_syntax "${MCP_SERVICE_DIR}/src/middleware/logger.js" "Logger"
  validate_js_syntax "${MCP_SERVICE_DIR}/src/middleware/graceful-shutdown.js" "Graceful shutdown"

  # ==========================================================================
  # Section 7: JSON Syntax Validation
  # ==========================================================================
  print_section "7. JSON Syntax Validation"

  validate_json_syntax "${MCP_SERVICE_DIR}/package.json" "MCP package.json"
  validate_json_syntax "${REPO_ROOT}/package.json" "Root package.json"

  # ==========================================================================
  # Section 8: Dependencies
  # ==========================================================================
  print_section "8. Package Dependencies"

  check_package_dependency "express" "Express.js"
  check_package_dependency "cors" "CORS middleware"
  check_package_dependency "helmet" "Security middleware"
  check_package_dependency "compression" "Compression middleware"
  check_package_dependency "uuid" "UUID generator"
  check_package_dependency "ws" "WebSocket library"
  check_package_dependency "pino" "Logger library"

  # ==========================================================================
  # Section 9: Registry Validation
  # ==========================================================================
  print_section "9. Registry Validation"

  if [[ -f "${MCP_SERVICE_DIR}/src/__tests__/validate-registry.js" ]]; then
    run_registry_validation
  else
    increment_check
    log_fail "Registry validation script not found"
  fi

  # ==========================================================================
  # Final Summary
  # ==========================================================================
  print_summary
}

################################################################################
# Entry Point
################################################################################

main "$@" || exit 1
