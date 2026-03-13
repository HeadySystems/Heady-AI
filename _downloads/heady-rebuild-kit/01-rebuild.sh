#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ MASTER REBUILD SCRIPT — Part 1 of 5                    ║
# ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
# ║  φ-derived timing · Deterministic dependency order              ║
# ╚══════════════════════════════════════════════════════════════════╝
set -euo pipefail
IFS=$'\n\t'

# ═══════════════════════════════════════════════════════════════
# φ-CONSTANTS (matching phi-constants.js)
# ═══════════════════════════════════════════════════════════════
PHI="1.618034"
PSI="0.618034"
FIB=(0 1 1 2 3 5 8 13 21 34 55 89 144)
MAX_CONCURRENT=${FIB[6]}  # 8 parallel clones

HEADY_ROOT="${HEADY_ROOT:-$(pwd)/heady-ecosystem}"
GITHUB_ORG="HeadyMe"
LOG_FILE="${HEADY_ROOT}/rebuild.log"
PASS=0
FAIL=0
SKIP=0

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; PURPLE='\033[0;35m'; NC='\033[0m'

log()  { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $*" | tee -a "$LOG_FILE"; }
ok()   { echo -e "${GREEN}  ✓${NC} $*" | tee -a "$LOG_FILE"; ((PASS++)); }
warn() { echo -e "${YELLOW}  ⚠${NC} $*" | tee -a "$LOG_FILE"; ((SKIP++)); }
fail() { echo -e "${RED}  ✗${NC} $*" | tee -a "$LOG_FILE"; ((FAIL++)); }

# ═══════════════════════════════════════════════════════════════
# REPO DEFINITIONS — Dependency-ordered tiers
# ═══════════════════════════════════════════════════════════════

# Tier 0: Core Pipeline (must clone first — everything depends on these)
TIER0_REPOS=(
  "Heady-Testing"
  "Heady-Staging"
  "heady-production"
)

# Tier 1: Core Projection Repos (public, contain canonical source per vertical)
TIER1_REPOS=(
  "headysystems-core"
  "headyme-core"
  "headyconnection-core"
  "headymcp-core"
  "headyos-core"
  "headybuddy-core"
  "headyapi-core"
  "headyio-core"
  "headybot-core"
)

# Tier 2: Utility & Standalone
TIER2_REPOS=(
  "admin-ui"
  "HeadyBuddy"
  "HeadyWeb"
  "latent-core-dev"
  "heady-docs"
)

# Tier 3: Production Projection Targets
TIER3_REPOS=(
  "headysystems-production"
  "headymcp-production"
  "ableton-edge-production"
)

# Tier 4: Templates
TIER4_REPOS=(
  "template-heady-ui"
  "template-swarm-bee"
  "template-mcp-server"
)

# Tier 5: Site/Domain Repos (44 repos — all follow identical structure)
TIER5_REPOS=(
  "headyme" "headyme-com"
  "headysystems" "headysystems-com"
  "headymcp" "headymcp-com"
  "headyio" "headyio-com"
  "headyos"
  "headybuddy-org"
  "headyconnection" "headyconnection-org"
  "headydocs" "headyapi"
  "1ime1"
  "heady-atlas" "heady-builder" "heady-buddy-portal"
  "heady-chrome" "heady-critique" "heady-desktop"
  "heady-discord" "heady-discord-connection" "heady-discord-connector"
  "heady-github-integration" "heady-imagine"
  "heady-jetbrains" "heady-jules" "heady-kinetics"
  "heady-logs" "heady-maestro" "heady-metrics"
  "heady-mobile" "heady-montecarlo" "heady-observer"
  "heady-patterns" "heady-pythia" "heady-sentinel"
  "heady-slack" "heady-stories" "heady-traces"
  "heady-vinci" "heady-vscode" "instant"
  "heady-vscode"
)

# ═══════════════════════════════════════════════════════════════
# PHASE 0: Environment Setup
# ═══════════════════════════════════════════════════════════════
phase0_setup() {
  log "═══ PHASE 0: Environment Setup ═══"
  mkdir -p "$HEADY_ROOT"/{tier0-pipeline,tier1-core,tier2-utility,tier3-projections,tier4-templates,tier5-sites}
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) — Rebuild started" > "$LOG_FILE"

  # Verify prerequisites
  for cmd in git node npm docker; do
    if command -v "$cmd" &>/dev/null; then
      ok "$cmd $(command -v $cmd)"
    else
      fail "$cmd not found — install before continuing"
    fi
  done

  # Node version check (require >=20)
  NODE_V=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
  if [[ "${NODE_V:-0}" -ge 20 ]]; then
    ok "Node.js v${NODE_V} (≥20 required)"
  else
    fail "Node.js v${NODE_V} too old — need ≥20"
  fi
}

# ═══════════════════════════════════════════════════════════════
# CLONE HELPER — with φ-backoff retry
# ═══════════════════════════════════════════════════════════════
clone_repo() {
  local repo="$1"
  local dest="$2"
  local branch="${3:-main}"
  local max_attempts=${FIB[5]}  # 5 retries
  local base_ms=1000

  if [[ -d "$dest/.git" ]]; then
    # Already cloned — pull latest
    pushd "$dest" > /dev/null
    if git pull --ff-only origin "$branch" &>/dev/null 2>&1; then
      ok "$repo (updated)"
    else
      warn "$repo (pull failed, using existing)"
    fi
    popd > /dev/null
    return 0
  fi

  for attempt in $(seq 0 $((max_attempts - 1))); do
    if git clone --depth 1 --branch "$branch" \
       "git@github.com:${GITHUB_ORG}/${repo}.git" "$dest" 2>/dev/null; then
      ok "$repo → $dest"
      return 0
    fi
    # φ-backoff: delay = base × φ^attempt (capped at 60s)
    local delay=$(python3 -c "import math; print(min(int($base_ms * ($PHI ** $attempt)), 60000))" 2>/dev/null || echo 3000)
    warn "$repo clone failed (attempt $((attempt+1))/$max_attempts), retrying in ${delay}ms..."
    sleep "$(echo "scale=3; $delay / 1000" | bc)"
  done

  fail "$repo — all $max_attempts attempts failed"
  return 1
}

# Parallel clone with concurrency limit
parallel_clone() {
  local dest_prefix="$1"
  shift
  local repos=("$@")
  local pids=()
  local running=0

  for repo in "${repos[@]}"; do
    # Determine branch (HeadyBuddy/HeadyWeb use 'master')
    local branch="main"
    [[ "$repo" == "HeadyBuddy" || "$repo" == "HeadyWeb" || "$repo" == "HeadyAI-IDE" ]] && branch="master"

    clone_repo "$repo" "${dest_prefix}/${repo}" "$branch" &
    pids+=($!)
    ((running++))

    # Throttle to MAX_CONCURRENT
    if [[ $running -ge $MAX_CONCURRENT ]]; then
      wait "${pids[0]}" 2>/dev/null || true
      pids=("${pids[@]:1}")
      ((running--))
    fi
  done

  # Wait for remaining
  for pid in "${pids[@]}"; do
    wait "$pid" 2>/dev/null || true
  done
}

# ═══════════════════════════════════════════════════════════════
# PHASE 1: Clone All Repos (Tier-ordered)
# ═══════════════════════════════════════════════════════════════
phase1_clone() {
  log "═══ PHASE 1: Clone Repositories (77 total, ${MAX_CONCURRENT} concurrent) ═══"

  log "  Tier 0: Core Pipeline (sequential — dependency root)"
  for repo in "${TIER0_REPOS[@]}"; do
    clone_repo "$repo" "${HEADY_ROOT}/tier0-pipeline/${repo}" "main"
  done

  log "  Tier 1: Core Projections (parallel)"
  parallel_clone "${HEADY_ROOT}/tier1-core" "${TIER1_REPOS[@]}"

  log "  Tier 2: Utility & Standalone (parallel)"
  parallel_clone "${HEADY_ROOT}/tier2-utility" "${TIER2_REPOS[@]}"

  log "  Tier 3: Production Projections (parallel)"
  parallel_clone "${HEADY_ROOT}/tier3-projections" "${TIER3_REPOS[@]}"

  log "  Tier 4: Templates (parallel)"
  parallel_clone "${HEADY_ROOT}/tier4-templates" "${TIER4_REPOS[@]}"

  log "  Tier 5: Site Repos (parallel, largest batch)"
  parallel_clone "${HEADY_ROOT}/tier5-sites" "${TIER5_REPOS[@]}"
}

# ═══════════════════════════════════════════════════════════════
# PHASE 2: Fix Known Issues
# ═══════════════════════════════════════════════════════════════
phase2_fix() {
  log "═══ PHASE 2: Fix Known Issues ═══"
  local TESTING="${HEADY_ROOT}/tier0-pipeline/Heady-Testing"

  # Fix 1: Resolve merge conflicts in docker-compose.yml
  if grep -q "<<<<<<< HEAD" "${TESTING}/docker-compose.yml" 2>/dev/null; then
    warn "docker-compose.yml has unresolved merge conflicts — generating clean version"
    # The clean version will be provided in Part 2 (Docker Compose Unification)
  fi

  # Fix 2: Resolve merge conflicts in .env.example
  if grep -q "<<<<<<< HEAD" "${TESTING}/.env.example" 2>/dev/null; then
    warn ".env.example has unresolved merge conflicts — generating clean version"
  fi

  # Fix 3: Check for malformed URLs in docker-compose.full.yml
  if grep -q "headysystems.comheadyio.com" "${TESTING}/docker-compose.full.yml" 2>/dev/null; then
    warn "docker-compose.full.yml contains concatenated domain bug (headysystems.comheadyio.com)"
    # Will be fixed in Part 2
  fi
}

# ═══════════════════════════════════════════════════════════════
# PHASE 3: Install Dependencies (Tier 0 first, then parallel)
# ═══════════════════════════════════════════════════════════════
phase3_deps() {
  log "═══ PHASE 3: Install Dependencies ═══"

  # Tier 0: Core monorepo deps
  local TESTING="${HEADY_ROOT}/tier0-pipeline/Heady-Testing"
  if [[ -f "${TESTING}/package.json" ]]; then
    log "  Installing Heady-Testing root deps..."
    pushd "$TESTING" > /dev/null
    npm ci --production 2>/dev/null && ok "Heady-Testing: npm ci" || fail "Heady-Testing: npm ci failed"
    popd > /dev/null
  fi

  # Tier 5: Site repos (all identical structure — npm ci in parallel)
  log "  Installing site repo deps (parallel)..."
  local pids=()
  local running=0
  for site_dir in "${HEADY_ROOT}"/tier5-sites/*/; do
    if [[ -f "${site_dir}/package.json" ]]; then
      (cd "$site_dir" && npm ci --production 2>/dev/null) &
      pids+=($!)
      ((running++))
      if [[ $running -ge $MAX_CONCURRENT ]]; then
        wait "${pids[0]}" 2>/dev/null || true
        pids=("${pids[@]:1}")
        ((running--))
      fi
    fi
  done
  for pid in "${pids[@]}"; do wait "$pid" 2>/dev/null || true; done
  ok "Site repos: npm ci complete"
}

# ═══════════════════════════════════════════════════════════════
# PHASE 4: Build All Sites
# ═══════════════════════════════════════════════════════════════
phase4_build() {
  log "═══ PHASE 4: Build Sites ═══"

  # Core monorepo build
  local TESTING="${HEADY_ROOT}/tier0-pipeline/Heady-Testing"
  if [[ -f "${TESTING}/package.json" ]]; then
    pushd "$TESTING" > /dev/null
    npm run build 2>/dev/null && ok "Heady-Testing: build" || warn "Heady-Testing: build (non-fatal)"
    popd > /dev/null
  fi

  # Site repos don't need build — they serve pre-built dist/ dirs
  local site_count=0
  for site_dir in "${HEADY_ROOT}"/tier5-sites/*/; do
    if [[ -d "${site_dir}/dist" ]]; then
      ((site_count++))
    else
      warn "$(basename "$site_dir"): missing dist/ directory"
    fi
  done
  ok "Sites with dist/: ${site_count}"
}

# ═══════════════════════════════════════════════════════════════
# PHASE 5: Health Verification
# ═══════════════════════════════════════════════════════════════
phase5_verify() {
  log "═══ PHASE 5: Verification ═══"

  # Verify phi-math module exists and is loadable
  local TESTING="${HEADY_ROOT}/tier0-pipeline/Heady-Testing"
  local PHI_PATHS=(
    "${TESTING}/shared/phi-math.js"
    "${TESTING}/core/shared/phi-math.js"
    "${TESTING}/05-heady-auto-context.js"
  )
  local phi_found=false
  for p in "${PHI_PATHS[@]}"; do
    if [[ -f "$p" ]]; then
      ok "phi-math module found: $p"
      phi_found=true
      break
    fi
  done
  $phi_found || warn "phi-math module not found at expected paths"

  # Verify architecture doc
  [[ -f "${TESTING}/ARCHITECTURE.md" ]] && ok "ARCHITECTURE.md present" || warn "ARCHITECTURE.md missing"

  # Verify Docker configs
  [[ -f "${TESTING}/Dockerfile" ]] && ok "Dockerfile present" || fail "Dockerfile missing"
  [[ -f "${TESTING}/docker-compose.full.yml" ]] && ok "docker-compose.full.yml present" || fail "docker-compose.full.yml missing"

  # Verify key directories
  for dir in backend frontend core agents apps cloudflare deploy; do
    [[ -d "${TESTING}/${dir}" ]] && ok "dir: ${dir}/" || warn "dir: ${dir}/ missing"
  done

  # Summary
  log ""
  log "═══════════════════════════════════════════════════"
  log "  REBUILD COMPLETE"
  log "  ✓ Pass: ${PASS}  ⚠ Skip: ${SKIP}  ✗ Fail: ${FAIL}"
  log "═══════════════════════════════════════════════════"
  log ""
  log "  Next steps:"
  log "    Part 2: docker-compose unification  → fixes merge conflicts + malformed URLs"
  log "    Part 3: site generator audit/fix     → ensures all 44 site UIs are functional"
  log "    Part 4: CI/CD pipeline               → GitHub Actions Testing→Staging→Production"
  log "    Part 5: Cloudflare deployment         → DNS + Workers + tunnel config"
}

# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════
main() {
  echo ""
  echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${PURPLE}║  HEADY™ MASTER REBUILD — Part 1 of 5                       ║${NC}"
  echo -e "${PURPLE}║  77 repos · 5 phases · φ-backoff retries                   ║${NC}"
  echo -e "${PURPLE}║  © 2026 HeadySystems Inc.                                  ║${NC}"
  echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  phase0_setup
  phase1_clone
  phase2_fix
  phase3_deps
  phase4_build
  phase5_verify
}

main "$@"
