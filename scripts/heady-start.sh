#!/usr/bin/env bash

################################################################################
# Heady™ Master Startup Script
# Checks prerequisites, configures environment, starts MCP server
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
TRANSPORT="${1:-stdio}"
NODE_VERSION_REQUIRED="20"
EXIT_CODE=0

################################################################################
# Utility Functions
################################################################################

log_info() {
  echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
  echo -e "${GREEN}[✓]${NC} $*"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $*"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $*"
}

print_header() {
  echo ""
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║${NC} $1"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

print_footer() {
  echo ""
  echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
  echo -e "$1"
  echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
  echo ""
}

################################################################################
# Validation Functions
################################################################################

check_node_version() {
  log_info "Checking Node.js version..."

  if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed"
    log_error "Please install Node.js >= ${NODE_VERSION_REQUIRED}.0.0"
    log_error "Visit: https://nodejs.org/"
    return 1
  fi

  local node_version
  node_version=$(node -v | sed 's/v//' | cut -d. -f1)

  if [[ ${node_version} -lt ${NODE_VERSION_REQUIRED} ]]; then
    log_error "Node.js version ${node_version} is too old"
    log_error "Required: >= ${NODE_VERSION_REQUIRED}.0.0"
    log_error "Current: $(node -v)"
    return 1
  fi

  log_success "Node.js $(node -v) is compatible"
  return 0
}

check_mcp_service_dir() {
  log_info "Checking MCP service directory..."

  if [[ ! -d "${MCP_SERVICE_DIR}" ]]; then
    log_error "MCP service directory not found: ${MCP_SERVICE_DIR}"
    return 1
  fi

  if [[ ! -f "${MCP_SERVICE_DIR}/package.json" ]]; then
    log_error "package.json not found in MCP service directory"
    return 1
  fi

  log_success "MCP service directory found"
  return 0
}

install_dependencies() {
  log_info "Checking dependencies in ${MCP_SERVICE_DIR}..."

  if [[ ! -d "${MCP_SERVICE_DIR}/node_modules" ]]; then
    log_warn "node_modules not found, running npm install..."

    if ! (cd "${MCP_SERVICE_DIR}" && npm install); then
      log_error "Failed to install dependencies"
      return 1
    fi

    log_success "Dependencies installed successfully"
  else
    log_success "Dependencies already installed"
  fi

  return 0
}

load_environment() {
  log_info "Loading environment variables..."

  local env_file="${REPO_ROOT}/.env"

  if [[ -f "${env_file}" ]]; then
    log_info "Loading from ${env_file}"
    set -a
    # shellcheck disable=SC1090
    source "${env_file}"
    set +a
    log_success "Environment variables loaded"
  else
    log_warn "No .env file found at ${env_file}"
    log_warn "Using system environment variables only"
  fi

  return 0
}

validate_transport() {
  case "${TRANSPORT}" in
    stdio|http|sse)
      log_success "Transport mode: ${TRANSPORT}"
      return 0
      ;;
    *)
      log_error "Invalid transport: ${TRANSPORT}"
      log_error "Valid options: stdio (default), http, sse"
      return 1
      ;;
  esac
}

print_startup_info() {
  echo ""
  log_info "Heady™ MCP Server Configuration:"
  log_info "  Repository:   ${REPO_ROOT}"
  log_info "  Service:      ${MCP_SERVICE_DIR}"
  log_info "  Transport:    ${TRANSPORT}"
  log_info "  Node.js:      $(node -v)"
  log_info "  npm:          $(npm -v)"

  if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
    log_info "  API Key:      ✓ Configured"
  else
    log_warn "  API Key:      ✗ Not configured (ANTHROPIC_API_KEY)"
  fi

  echo ""
}

################################################################################
# Main Startup Logic
################################################################################

main() {
  print_header "Heady™ Master Control Program"

  # Step 1: Validate Node.js
  if ! check_node_version; then
    EXIT_CODE=1
  fi

  # Step 2: Check MCP service directory
  if ! check_mcp_service_dir; then
    EXIT_CODE=1
  fi

  # Step 3: Install dependencies if needed
  if ! install_dependencies; then
    EXIT_CODE=1
  fi

  # Step 4: Load environment
  if ! load_environment; then
    EXIT_CODE=1
  fi

  # Step 5: Validate transport
  if ! validate_transport; then
    EXIT_CODE=1
  fi

  # Exit early if any check failed
  if [[ ${EXIT_CODE} -ne 0 ]]; then
    print_footer "${RED}[✗] Startup validation failed${NC}"
    return ${EXIT_CODE}
  fi

  # Print startup information
  print_startup_info

  # Step 6: Start the server
  log_info "Starting MCP server with ${TRANSPORT} transport..."

  print_footer "${GREEN}[✓] All checks passed, starting server...${NC}"

  cd "${MCP_SERVICE_DIR}"

  export HEADY_MCP_TRANSPORT="${TRANSPORT}"

  # Use exec to replace the current process with the Node server
  exec node src/index.js
}

################################################################################
# Usage Information
################################################################################

print_usage() {
  cat << EOF
Usage: ${0} [TRANSPORT]

Start the Heady™ MCP Server with the specified transport.

Arguments:
  TRANSPORT    Transport protocol to use (default: stdio)
               - stdio: Standard input/output (CLI)
               - http:  HTTP server (port 3310)
               - sse:   Server-Sent Events (HTTP with streaming)

Examples:
  ${0}              # Start with stdio transport
  ${0} http         # Start with HTTP transport
  ${0} sse          # Start with SSE transport

Environment Variables:
  HEADY_MCP_TRANSPORT   Override transport mode
  ANTHROPIC_API_KEY    Claude API key (from .env or system)

More Information:
  Repository:  https://github.com/HeadyMe/Heady-pre-production
  Docs:        ${REPO_ROOT}/docs/
  Config:      ${REPO_ROOT}/.env

EOF
}

################################################################################
# Entry Point
################################################################################

# Handle --help and -h
if [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
  print_usage
  exit 0
fi

# Handle --version
if [[ "${1:-}" == "--version" ]] || [[ "${1:-}" == "-v" ]]; then
  echo "Heady™ MCP Server Startup Script"
  echo "Repository: $(cat ${REPO_ROOT}/package.json 2>/dev/null | grep -o '"version": "[^"]*' | head -1 | cut -d'"' -f4)"
  exit 0
fi

# Run main function
main "$@" || exit $?
