#!/usr/bin/env bash
#
# Heady™ Developer Setup Script
# ═════════════════════════════
# Target: New developer → running system in < 5 minutes
# Usage:  bash scripts/setup-dev.sh [--dry-run]
#
# © 2026 HeadySystems Inc.

set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

# ─── Sacred Geometry Banner ──────────────────────────────────────────────────
echo -e "${PURPLE}"
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║       ✦  HEADY™ DEVELOPER SETUP  ✦       ║"
echo "  ║     Sacred Geometry v4.0 · φ-Scaled       ║"
echo "  ╚═══════════════════════════════════════════╝"
echo -e "${NC}"

ERRORS=0
WARNINGS=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ─── Step 1: Validate Prerequisites ─────────────────────────────────────────
echo -e "${CYAN}▸ Step 1: Checking prerequisites...${NC}"

# Node.js 20+
if command -v node &>/dev/null; then
  NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  if [[ "$NODE_VERSION" -ge 20 ]]; then
    echo -e "  ${GREEN}✓${NC} Node.js v$(node -v | sed 's/v//') (≥ 20 required)"
  else
    echo -e "  ${RED}✗${NC} Node.js v$(node -v | sed 's/v//') — ${RED}v20+ required${NC}"
    echo -e "    Install: ${YELLOW}nvm install 20 && nvm use 20${NC}"
    ((ERRORS++))
  fi
else
  echo -e "  ${RED}✗${NC} Node.js not found"
  echo -e "    Install: ${YELLOW}curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs${NC}"
  ((ERRORS++))
fi

# npm
if command -v npm &>/dev/null; then
  echo -e "  ${GREEN}✓${NC} npm v$(npm -v)"
else
  echo -e "  ${RED}✗${NC} npm not found"
  ((ERRORS++))
fi

# Docker
if command -v docker &>/dev/null; then
  if docker info &>/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Docker $(docker --version | grep -oP '\d+\.\d+\.\d+')"
  else
    echo -e "  ${YELLOW}⚠${NC} Docker installed but daemon not running"
    echo -e "    Fix: ${YELLOW}sudo systemctl start docker${NC}"
    ((WARNINGS++))
  fi
else
  echo -e "  ${YELLOW}⚠${NC} Docker not found (optional for local services)"
  echo -e "    Install: ${YELLOW}https://docs.docker.com/get-docker/${NC}"
  ((WARNINGS++))
fi

# docker-compose
if command -v docker-compose &>/dev/null || docker compose version &>/dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} Docker Compose available"
else
  echo -e "  ${YELLOW}⚠${NC} Docker Compose not found (optional)"
  ((WARNINGS++))
fi

# gcloud CLI
if command -v gcloud &>/dev/null; then
  GCLOUD_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "not-set")
  echo -e "  ${GREEN}✓${NC} gcloud CLI (project: ${GCLOUD_PROJECT})"
else
  echo -e "  ${YELLOW}⚠${NC} gcloud CLI not found (optional for local dev)"
  echo -e "    Install: ${YELLOW}https://cloud.google.com/sdk/docs/install${NC}"
  ((WARNINGS++))
fi

# Git
if command -v git &>/dev/null; then
  echo -e "  ${GREEN}✓${NC} Git $(git --version | grep -oP '\d+\.\d+\.\d+')"
else
  echo -e "  ${RED}✗${NC} Git not found"
  ((ERRORS++))
fi

echo ""

# ─── Step 2: Check Environment Files ────────────────────────────────────────
echo -e "${CYAN}▸ Step 2: Checking environment files...${NC}"

ENV_FILE="${PROJECT_ROOT}/.env"
ENV_EXAMPLE="${PROJECT_ROOT}/.env.example"

if [[ -f "$ENV_FILE" ]]; then
  echo -e "  ${GREEN}✓${NC} .env file exists"

  # Check for required variables
  REQUIRED_VARS=("NODE_ENV" "JWT_SECRET" "PORT")
  for var in "${REQUIRED_VARS[@]}"; do
    if grep -q "^${var}=" "$ENV_FILE" 2>/dev/null; then
      echo -e "  ${GREEN}✓${NC} ${var} configured"
    else
      echo -e "  ${YELLOW}⚠${NC} ${var} not set in .env"
      ((WARNINGS++))
    fi
  done
elif [[ -f "$ENV_EXAMPLE" ]]; then
  echo -e "  ${YELLOW}⚠${NC} .env not found — copying from .env.example"
  if [[ "$DRY_RUN" == "false" ]]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    echo -e "  ${GREEN}✓${NC} Created .env from .env.example — ${YELLOW}edit with your values${NC}"
  else
    echo -e "  ${BLUE}[dry-run]${NC} Would copy .env.example → .env"
  fi
else
  echo -e "  ${YELLOW}⚠${NC} No .env or .env.example found"
  if [[ "$DRY_RUN" == "false" ]]; then
    cat > "$ENV_FILE" << 'ENVFILE'
NODE_ENV=development
PORT=3310
JWT_SECRET=heady-dev-secret-change-in-production
NATS_URL=nats://localhost:4222
DATABASE_URL=postgresql://heady:heady@localhost:5432/heady
FIREBASE_PROJECT_ID=gen-lang-client-0920560496
LOG_LEVEL=debug
ENVFILE
    echo -e "  ${GREEN}✓${NC} Created default .env — ${YELLOW}edit with your values${NC}"
  fi
  ((WARNINGS++))
fi

echo ""

# ─── Step 3: Install Dependencies ───────────────────────────────────────────
echo -e "${CYAN}▸ Step 3: Installing dependencies...${NC}"

if [[ -f "${PROJECT_ROOT}/package.json" ]]; then
  if [[ "$DRY_RUN" == "false" ]]; then
    cd "$PROJECT_ROOT"
    npm install --prefer-offline 2>/dev/null && echo -e "  ${GREEN}✓${NC} npm install complete" || {
      echo -e "  ${YELLOW}⚠${NC} npm install had warnings (non-fatal)"
      ((WARNINGS++))
    }
  else
    echo -e "  ${BLUE}[dry-run]${NC} Would run: npm install"
  fi
else
  echo -e "  ${YELLOW}⚠${NC} No package.json found in project root"
  ((WARNINGS++))
fi

echo ""

# ─── Step 4: Validate Project Structure ─────────────────────────────────────
echo -e "${CYAN}▸ Step 4: Validating project structure...${NC}"

REQUIRED_DIRS=("src" "shared" "config" "docs" "scripts")
for dir in "${REQUIRED_DIRS[@]}"; do
  if [[ -d "${PROJECT_ROOT}/${dir}" ]]; then
    echo -e "  ${GREEN}✓${NC} ${dir}/"
  else
    echo -e "  ${YELLOW}⚠${NC} ${dir}/ not found"
    ((WARNINGS++))
  fi
done

REQUIRED_FILES=("index.js" "package.json" "CHANGES.md" "IMPROVEMENTS.md" "ERROR_CODES.md")
for file in "${REQUIRED_FILES[@]}"; do
  if [[ -f "${PROJECT_ROOT}/${file}" ]]; then
    echo -e "  ${GREEN}✓${NC} ${file}"
  else
    echo -e "  ${YELLOW}⚠${NC} ${file} not found"
    ((WARNINGS++))
  fi
done

echo ""

# ─── Step 5: Syntax Check Critical Files ────────────────────────────────────
echo -e "${CYAN}▸ Step 5: Syntax checking critical modules...${NC}"

CRITICAL_FILES=(
  "shared/phi-math.js"
  "shared/csl-engine.js"
  "src/middleware/security/csp-headers.js"
  "src/middleware/security/prompt-injection-defense.js"
  "src/scaling/feature-flags.js"
  "src/scaling/saga-coordinator.js"
  "src/security/autonomy-guardrails.js"
)

for file in "${CRITICAL_FILES[@]}"; do
  FULL_PATH="${PROJECT_ROOT}/${file}"
  if [[ -f "$FULL_PATH" ]]; then
    if node -c "$FULL_PATH" 2>/dev/null; then
      echo -e "  ${GREEN}✓${NC} ${file}"
    else
      echo -e "  ${RED}✗${NC} ${file} — syntax error"
      ((ERRORS++))
    fi
  else
    echo -e "  ${YELLOW}—${NC} ${file} (not found, skipping)"
  fi
done

echo ""

# ─── Summary ─────────────────────────────────────────────────────────────────
echo -e "${PURPLE}═══════════════════════════════════════════${NC}"
if [[ $ERRORS -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}  ✦ Setup Complete — ${ERRORS} errors, ${WARNINGS} warnings${NC}"
  echo ""
  echo -e "  ${CYAN}Quick Start:${NC}"
  echo -e "    ${BOLD}npm run dev${NC}        — Start development server"
  echo -e "    ${BOLD}npm test${NC}           — Run test suite"
  echo -e "    ${BOLD}npm run lint${NC}       — Check code style"
  echo ""
  echo -e "  ${CYAN}Infrastructure (optional):${NC}"
  echo -e "    ${BOLD}docker-compose up${NC}  — Start all 50 services"
  echo -e "    ${BOLD}nats-server -js${NC}    — Start NATS JetStream"
  echo ""
else
  echo -e "${RED}${BOLD}  ✗ Setup incomplete — ${ERRORS} errors, ${WARNINGS} warnings${NC}"
  echo -e "  Fix the errors above and re-run: ${YELLOW}bash scripts/setup-dev.sh${NC}"
fi
echo -e "${PURPLE}═══════════════════════════════════════════${NC}"

exit $ERRORS
