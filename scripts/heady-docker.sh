#!/usr/bin/env bash

################################################################################
# Heady™ Docker Build and Run Helper
# Manages Docker image building, running, and monitoring
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
DOCKER_IMAGE="heady-mcp-server"
DOCKER_TAG="latest"
CONTAINER_NAME="heady-mcp-server"
CONTAINER_PORT="${CONTAINER_PORT:-3310}"
HOST_PORT="${HOST_PORT:-3310}"
TRANSPORT="${TRANSPORT:-http}"
ACTION="${1:-help}"

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

################################################################################
# Docker Operations
################################################################################

docker_build() {
  print_header "Building Docker Image"

  if [[ ! -f "${MCP_SERVICE_DIR}/Dockerfile" ]]; then
    log_error "Dockerfile not found at ${MCP_SERVICE_DIR}/Dockerfile"
    return 1
  fi

  log_info "Building image: ${DOCKER_IMAGE}:${DOCKER_TAG}"
  log_info "Context: ${MCP_SERVICE_DIR}"

  if docker build \
    -t "${DOCKER_IMAGE}:${DOCKER_TAG}" \
    -f "${MCP_SERVICE_DIR}/Dockerfile" \
    "${MCP_SERVICE_DIR}"; then
    log_success "Docker image built successfully"
    docker images | grep "${DOCKER_IMAGE}" | head -1
    return 0
  else
    log_error "Failed to build Docker image"
    return 1
  fi
}

docker_run() {
  print_header "Running Docker Container"

  log_info "Configuration:"
  log_info "  Image:         ${DOCKER_IMAGE}:${DOCKER_TAG}"
  log_info "  Container:     ${CONTAINER_NAME}"
  log_info "  Host Port:     ${HOST_PORT}"
  log_info "  Container Port: ${CONTAINER_PORT}"
  log_info "  Transport:     ${TRANSPORT}"

  # Check if image exists
  if ! docker image inspect "${DOCKER_IMAGE}:${DOCKER_TAG}" &>/dev/null; then
    log_warn "Image not found, building first..."
    if ! docker_build; then
      log_error "Failed to build image"
      return 1
    fi
  fi

  # Check if container is already running
  if docker ps --filter "name=${CONTAINER_NAME}" --format '{{.Names}}' | grep -q "${CONTAINER_NAME}"; then
    log_warn "Container already running, stopping it first..."
    docker stop "${CONTAINER_NAME}" || true
  fi

  # Remove existing container if present
  if docker ps -a --filter "name=${CONTAINER_NAME}" --format '{{.Names}}' | grep -q "${CONTAINER_NAME}"; then
    log_info "Removing existing container..."
    docker rm "${CONTAINER_NAME}" || true
  fi

  log_info "Starting container..."

  if docker run \
    --name "${CONTAINER_NAME}" \
    -p "${HOST_PORT}:${CONTAINER_PORT}" \
    -e "HEADY_MCP_TRANSPORT=${TRANSPORT}" \
    -e "PORT=${CONTAINER_PORT}" \
    --health-cmd='curl -f http://localhost:'"${CONTAINER_PORT}"'/health || exit 1' \
    --health-interval=10s \
    --health-timeout=5s \
    --health-retries=3 \
    -d \
    "${DOCKER_IMAGE}:${DOCKER_TAG}"; then

    log_success "Container started successfully"

    sleep 2

    if docker ps --filter "name=${CONTAINER_NAME}" --format '{{.Names}}' | grep -q "${CONTAINER_NAME}"; then
      log_success "Container is running"
      log_info "Access the server at: http://localhost:${HOST_PORT}"
      return 0
    else
      log_error "Container failed to start"
      log_info "View logs with: docker logs ${CONTAINER_NAME}"
      return 1
    fi
  else
    log_error "Failed to start container"
    return 1
  fi
}

docker_stop() {
  print_header "Stopping Docker Container"

  if docker ps --filter "name=${CONTAINER_NAME}" --format '{{.Names}}' | grep -q "${CONTAINER_NAME}"; then
    log_info "Stopping container: ${CONTAINER_NAME}"

    if docker stop "${CONTAINER_NAME}"; then
      log_success "Container stopped"

      if docker rm "${CONTAINER_NAME}"; then
        log_success "Container removed"
        return 0
      fi
    fi
  else
    log_warn "Container is not running"
    return 0
  fi

  return 0
}

docker_logs() {
  print_header "Docker Container Logs"

  if ! docker ps -a --filter "name=${CONTAINER_NAME}" --format '{{.Names}}' | grep -q "${CONTAINER_NAME}"; then
    log_error "Container not found: ${CONTAINER_NAME}"
    return 1
  fi

  log_info "Showing logs for: ${CONTAINER_NAME}"
  echo ""

  docker logs -f "${CONTAINER_NAME}"
}

docker_status() {
  print_header "Docker Container Status"

  log_info "Checking container status..."
  echo ""

  if docker ps --filter "name=${CONTAINER_NAME}" --format '{{.Names}}' | grep -q "${CONTAINER_NAME}"; then
    log_success "Container is running"
    echo ""
    docker ps --filter "name=${CONTAINER_NAME}"
  else
    log_warn "Container is not running"

    if docker ps -a --filter "name=${CONTAINER_NAME}" --format '{{.Names}}' | grep -q "${CONTAINER_NAME}"; then
      log_info "Stopped container found:"
      echo ""
      docker ps -a --filter "name=${CONTAINER_NAME}"
    fi
  fi

  echo ""
  log_info "Image status:"
  docker images | grep "${DOCKER_IMAGE}" || log_warn "Image not found"
}

docker_health() {
  print_header "Health Check"

  if ! docker ps --filter "name=${CONTAINER_NAME}" --format '{{.Names}}' | grep -q "${CONTAINER_NAME}"; then
    log_error "Container is not running"
    return 1
  fi

  log_info "Checking container health..."

  local health_status
  health_status=$(docker inspect --format='{{.State.Health.Status}}' "${CONTAINER_NAME}")

  if [[ "${health_status}" == "healthy" ]]; then
    log_success "Container is healthy"
    return 0
  else
    log_warn "Container health status: ${health_status}"

    log_info "Checking HTTP endpoint..."

    if curl -sf "http://localhost:${HOST_PORT}/health" > /dev/null; then
      log_success "HTTP health check passed"
      return 0
    else
      log_error "HTTP health check failed"
      return 1
    fi
  fi
}

print_usage() {
  cat << EOF
Usage: ${0} [ACTION] [OPTIONS]

Manage Heady™ MCP Server Docker container.

Actions:
  build           Build the Docker image
  run             Build (if needed) and run the container
  stop            Stop and remove the running container
  logs            View container logs (streaming)
  status          Show container status
  health          Perform health checks
  help            Show this help message

Environment Variables:
  DOCKER_IMAGE     Docker image name (default: heady-mcp-server)
  DOCKER_TAG       Docker image tag (default: latest)
  CONTAINER_NAME   Container name (default: heady-mcp-server)
  CONTAINER_PORT   Port inside container (default: 3310)
  HOST_PORT        Port on host machine (default: 3310)
  TRANSPORT        Server transport: stdio, http, sse (default: http)

Examples:
  ${0} build               # Build the image
  ${0} run                 # Build and run the container
  ${0} stop                # Stop the container
  HOST_PORT=8080 ${0} run  # Run container with custom host port
  TRANSPORT=sse ${0} run   # Run with SSE transport
  ${0} logs                # View logs
  ${0} health              # Check container health

For more information, visit: https://github.com/HeadyMe/Heady-pre-production

EOF
}

################################################################################
# Main Entry Point
################################################################################

case "${ACTION}" in
  build)
    docker_build
    ;;
  run)
    docker_run
    ;;
  stop)
    docker_stop
    ;;
  logs)
    docker_logs
    ;;
  status)
    docker_status
    ;;
  health)
    docker_health
    ;;
  help|-h|--help)
    print_usage
    exit 0
    ;;
  *)
    log_error "Unknown action: ${ACTION}"
    echo ""
    print_usage
    exit 1
    ;;
esac
