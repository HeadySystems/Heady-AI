#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() {
  printf '[setup-dev] %s\n' "$*"
}

require_command() {
  local command_name="$1"
  local install_hint="$2"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf '[setup-dev] missing required command: %s\n' "$command_name" >&2
    printf '[setup-dev] %s\n' "$install_hint" >&2
    exit 1
  fi
}

ensure_node_major() {
  local detected
  detected="$(node --version | sed 's/^v//' | cut -d. -f1)"
  if [ "$detected" -lt 20 ]; then
    printf '[setup-dev] Node.js 20 or newer is required. Detected: v%s\n' "$detected" >&2
    exit 1
  fi
}

log "Validating local development prerequisites"
require_command node "Install Node.js 20 or newer and re-run this script."
ensure_node_major
require_command pnpm "Install pnpm 10 or newer, for example: npm install -g pnpm"
require_command docker "Install Docker Desktop or Docker Engine and re-run this script."
require_command gcloud "Install the Google Cloud CLI and authenticate before local cloud workflows."

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    log "Created .env from .env.example. Populate secrets before production use."
  else
    printf '[setup-dev] .env.example is missing and .env does not exist.\n' >&2
    exit 1
  fi
fi

log "Installing workspace dependencies"
pnpm install --frozen-lockfile

log "Building service manifests"
node ./scripts/generate-service-manifests.mjs

if [ -f docker-compose.yml ]; then
  log "Pulling container images"
  docker compose pull --ignore-pull-failures || true
  log "Starting local development containers"
  docker compose up -d --build
else
  log "docker-compose.yml not found; skipping container startup"
fi

log "Running localhost validation"
node ./scripts/validate-no-localhost.mjs

log "Development setup complete"
