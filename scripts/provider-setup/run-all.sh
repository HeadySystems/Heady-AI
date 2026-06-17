#!/usr/bin/env bash
# =============================================================================
# run-all.sh
# HeadyKey + HeadyVault — Master Orchestration Script
#
# Runs scripts 00–07 in dependency order with:
#   - Pre-flight auth checks before touching any cloud provider
#   - Output capture per script → output/logs/NN-<name>.log
#   - Dependency checks: each script reads prior outputs before proceeding
#   - Skip-if-done logic: re-running is safe (idempotent)
#   - Final status dashboard printed on completion
#
# Usage:
#   bash run-all.sh                 # Run all scripts
#   bash run-all.sh --from 03       # Resume from script 03
#   bash run-all.sh --only 06       # Run only script 06
#   bash run-all.sh --dry-run       # Print plan, execute nothing
#   bash run-all.sh --yes           # Skip all confirmation prompts
#
# Environment variables (all optional — scripts will prompt if missing):
#   GCP_LEGACY_PROJECT      default: heady-ai
#   GCP_REBUILD_PROJECT     default: heady-rebuild
#   GCP_REGION              default: us-central1
#   GCP_BILLING_ACCOUNT     GCP billing account ID (required for new project)
#   CF_ACCOUNT_ID           Cloudflare account ID
#   NEON_ORG_ID             Neon organization ID (if not using personal)
#   SKIP_LEGACY             set to "1" to skip legacy-only setup steps
# =============================================================================

set -euo pipefail

# ── colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'
DIM='\033[2m'

info()    { echo -e "${CYAN}[run-all]${RESET} $*"; }
success() { echo -e "${GREEN}[run-all] ✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}[run-all] ⚠${RESET} $*"; }
fail()    { echo -e "${RED}[run-all] ✗${RESET} $*" >&2; exit 1; }
step()    { echo -e "\n${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"; \
            echo -e "${BLUE}${BOLD}  $*${RESET}"; \
            echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"; }

# ── argument parsing ──────────────────────────────────────────────────────────
FROM_SCRIPT=0
ONLY_SCRIPT=-1
DRY_RUN=0
AUTO_YES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from)    FROM_SCRIPT="${2#0}"; shift 2 ;;   # strip leading zero: 03 → 3
    --only)    ONLY_SCRIPT="${2#0}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --yes|-y)  AUTO_YES=1; shift ;;
    -h|--help)
      grep '^# ' "$0" | head -30 | sed 's/^# //'
      exit 0 ;;
    *) warn "Unknown argument: $1"; shift ;;
  esac
done

# ── paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/output"
LOG_DIR="$OUTPUT_DIR/logs"
STATUS_FILE="$OUTPUT_DIR/run-all-status.json"

mkdir -p "$OUTPUT_DIR" "$LOG_DIR"

# ── script registry ───────────────────────────────────────────────────────────
# Format: NUM NAME DESCRIPTION DEPENDENCIES(space-separated output files)
declare -A SCRIPT_NAME=(
  [0]="00-preflight"
  [1]="01-gcp-setup"
  [2]="02-neon-setup"
  [3]="03-firebase-setup"
  [4]="04-cloudflare-setup"
  [5]="05-headykey-deploy"
  [6]="06-headyvault-seed"
  [7]="07-wrangler-envs"
)

declare -A SCRIPT_DESC=(
  [0]="Pre-flight auth checks & env validation"
  [1]="GCP project, Service Account, Secret Manager stubs (heady-rebuild)"
  [2]="Neon Postgres project, pgvector, dev branches"
  [3]="Firebase project setup, web app registration, SDK config"
  [4]="Cloudflare KV namespaces, R2 buckets, Pages projects"
  [5]="HeadyKey dual-deploy (legacy + rebuild CF Pages)"
  [6]="HeadyVault secret seeding — both GCP projects"
  [7]="Wrangler env stanzas + Cloud Run --set-secrets flags"
)

# What each script requires to exist before it can run
declare -A SCRIPT_DEPS=(
  [0]=""
  [1]="$OUTPUT_DIR/00-preflight.json"
  [2]="$OUTPUT_DIR/00-preflight.json"
  [3]="$OUTPUT_DIR/01-gcp-setup.json"
  [4]="$OUTPUT_DIR/00-preflight.json"
  [5]="$OUTPUT_DIR/03-firebase-setup.json $OUTPUT_DIR/04-cloudflare-setup.json"
  [6]="$OUTPUT_DIR/01-gcp-setup.json $OUTPUT_DIR/02-neon-setup.json"
  [7]="$OUTPUT_DIR/04-cloudflare-setup.json"
)

TOTAL_SCRIPTS=8  # 0–7

# ── timing helpers ────────────────────────────────────────────────────────────
declare -A STEP_START
declare -A STEP_DURATION
declare -A STEP_STATUS

format_duration() {
  local secs="$1"
  if   (( secs < 60  )); then echo "${secs}s"
  elif (( secs < 3600)); then echo "$(( secs/60 ))m$(( secs%60 ))s"
  else                         echo "$(( secs/3600 ))h$(( (secs%3600)/60 ))m"
  fi
}

# ── confirmation helper ───────────────────────────────────────────────────────
confirm() {
  local msg="$1"
  if [[ $AUTO_YES -eq 1 ]]; then return 0; fi
  echo -e "${YELLOW}${msg}${RESET} [y/N] "
  read -r ans
  [[ "${ans,,}" == "y" || "${ans,,}" == "yes" ]]
}

# ── dependency checker ────────────────────────────────────────────────────────
check_deps() {
  local num="$1"
  local deps="${SCRIPT_DEPS[$num]:-}"
  if [[ -z "$deps" ]]; then return 0; fi
  local missing=0
  for dep in $deps; do
    if [[ ! -f "$dep" ]]; then
      warn "Missing dependency for script $num: $dep"
      missing=$((missing + 1))
    fi
  done
  return $missing
}

# ── run a single script ───────────────────────────────────────────────────────
run_script() {
  local num="$1"
  local name="${SCRIPT_NAME[$num]}"
  local desc="${SCRIPT_DESC[$num]}"
  local script_path="$SCRIPT_DIR/${name}.sh"
  local log_file="$LOG_DIR/${name}.log"

  step "$num/$((TOTAL_SCRIPTS-1)) · ${name}"
  info "$desc"

  # Existence check
  if [[ ! -f "$script_path" ]]; then
    warn "Script not found: $script_path — skipping."
    STEP_STATUS[$num]="SKIPPED(missing)"
    return 0
  fi

  # Dependency check
  if ! check_deps "$num"; then
    warn "Dependencies not satisfied for $name — skipping."
    STEP_STATUS[$num]="SKIPPED(deps)"
    return 0
  fi

  if [[ $DRY_RUN -eq 1 ]]; then
    echo -e "${DIM}  [dry-run] would run: bash $script_path${RESET}"
    STEP_STATUS[$num]="DRY-RUN"
    return 0
  fi

  STEP_START[$num]=$(date +%s)
  echo ""
  info "Running $name... (log: $log_file)"
  echo ""

  # Run with tee so we see live output AND capture to log
  if bash "$script_path" 2>&1 | tee "$log_file"; then
    local end_time=$(date +%s)
    STEP_DURATION[$num]=$(( end_time - STEP_START[$num] ))
    STEP_STATUS[$num]="OK($(format_duration ${STEP_DURATION[$num]}))"
    success "$name completed in $(format_duration ${STEP_DURATION[$num]})"
  else
    local exit_code=$?
    local end_time=$(date +%s)
    STEP_DURATION[$num]=$(( end_time - STEP_START[$num] ))
    STEP_STATUS[$num]="FAILED(exit=$exit_code)"
    echo ""
    fail "$name FAILED (exit $exit_code). Check log: $log_file"
    # Note: set -e will have already exited, but this is belt-and-suspenders
  fi
}

# ── banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   HeadyKey + HeadyVault — Master Setup Orchestration        ║${RESET}"
echo -e "${BOLD}║   Legacy (heady-ai) + Rebuild (heady-rebuild)               ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${DIM}Started: $(date)${RESET}"
echo -e "  ${DIM}Scripts dir: $SCRIPT_DIR${RESET}"
echo -e "  ${DIM}Output dir:  $OUTPUT_DIR${RESET}"
echo ""

# ── print plan ────────────────────────────────────────────────────────────────
echo -e "${BOLD}Execution plan:${RESET}"
echo ""
for i in $(seq 0 $((TOTAL_SCRIPTS-1))); do
  name="${SCRIPT_NAME[$i]}"
  desc="${SCRIPT_DESC[$i]}"
  marker="○"
  color="$RESET"

  if   [[ $ONLY_SCRIPT -ge 0 && $i -ne $ONLY_SCRIPT ]]; then
    marker="${DIM}–${RESET}"; color="$DIM"
  elif [[ $i -lt $FROM_SCRIPT ]]; then
    marker="${DIM}–${RESET}"; color="$DIM"
  elif [[ $DRY_RUN -eq 1 ]]; then
    marker="${CYAN}○${RESET}"
  fi

  printf "  %s ${color}%02d · %-30s%s %s\n${RESET}" \
    "$marker" "$i" "$name" "" "$desc"
done
echo ""

if [[ $DRY_RUN -eq 1 ]]; then
  warn "DRY RUN mode — no changes will be made."
  echo ""
fi

# Confirmation before proceeding
if [[ $DRY_RUN -eq 0 ]] && ! confirm "Proceed with setup? This will create cloud resources."; then
  info "Aborted."
  exit 0
fi

# ── main execution loop ───────────────────────────────────────────────────────
MASTER_START=$(date +%s)

for i in $(seq 0 $((TOTAL_SCRIPTS-1))); do
  # --only filter
  if [[ $ONLY_SCRIPT -ge 0 && $i -ne $ONLY_SCRIPT ]]; then
    STEP_STATUS[$i]="SKIPPED(not-selected)"
    continue
  fi

  # --from filter
  if [[ $i -lt $FROM_SCRIPT ]]; then
    STEP_STATUS[$i]="SKIPPED(before-from)"
    continue
  fi

  run_script "$i"
done

# ── status dashboard ──────────────────────────────────────────────────────────
MASTER_END=$(date +%s)
MASTER_DURATION=$(( MASTER_END - MASTER_START ))

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   Execution Summary                                         ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${RESET}"
echo ""

FAILED_COUNT=0
SUCCESS_COUNT=0
SKIPPED_COUNT=0

for i in $(seq 0 $((TOTAL_SCRIPTS-1))); do
  name="${SCRIPT_NAME[$i]}"
  status="${STEP_STATUS[$i]:-UNKNOWN}"

  case "$status" in
    OK*)         icon="${GREEN}✓${RESET}"; SUCCESS_COUNT=$((SUCCESS_COUNT+1)) ;;
    FAILED*)     icon="${RED}✗${RESET}";   FAILED_COUNT=$((FAILED_COUNT+1)) ;;
    DRY-RUN)     icon="${CYAN}○${RESET}" ;;
    SKIPPED*)    icon="${DIM}–${RESET}";   SKIPPED_COUNT=$((SKIPPED_COUNT+1)) ;;
    *)           icon="${YELLOW}?${RESET}" ;;
  esac

  printf "  %b  %02d · %-30s  %s\n" "$icon" "$i" "$name" "$status"
done

echo ""
echo -e "  Total time: ${BOLD}$(format_duration $MASTER_DURATION)${RESET}"
echo -e "  Completed:  ${GREEN}${SUCCESS_COUNT}${RESET} | Skipped: ${DIM}${SKIPPED_COUNT}${RESET} | Failed: ${RED}${FAILED_COUNT}${RESET}"
echo ""

# ── output file index ─────────────────────────────────────────────────────────
echo -e "${BOLD}Generated artifacts:${RESET}"
echo ""

OUTPUT_FILES=(
  "00-preflight.json            — Pre-flight check results"
  "01-gcp-setup.json            — GCP Service Account, WIF, Secret stubs"
  "02-neon-setup.json           — Neon project/branch IDs, connection strings"
  "03-firebase-setup.json       — Firebase project IDs, SDK configs"
  "04-cloudflare-setup.json     — KV namespace IDs, R2 bucket names, Pages URLs"
  "05-headykey-deploy.json      — HeadyKey CF Pages deployment URLs"
  "06-headyvault-seed.json      — Secret seeding results, .env file paths"
  "07-wrangler-envs.json        — KV IDs, wrangler stanza paths, CR flags"
  ""
  "wrangler-rebuild-env.toml    — [env.rebuild] stanza for wrangler.toml"
  "wrangler-legacy-env.toml     — [env.legacy] stanza for wrangler.toml"
  ""
  "cloud-run-legacy-deploy.sh   — gcloud run deploy (legacy)"
  "cloud-run-rebuild-deploy.sh  — gcloud run deploy (rebuild)"
  ""
  ".env.legacy                  — LEGACY env vars (gitignored)"
  ".env.rebuild                 — REBUILD env vars (gitignored)"
  ""
  "logs/                        — Per-script execution logs"
)

for line in "${OUTPUT_FILES[@]}"; do
  if [[ -z "$line" ]]; then echo ""; continue; fi
  fname="${line%%  *}"
  fdesc="${line#*  }"
  fpath="$OUTPUT_DIR/$fname"
  if [[ -f "$fpath" ]]; then
    echo -e "  ${GREEN}✓${RESET}  ${BOLD}output/$fname${RESET}  ${DIM}$fdesc${RESET}"
  else
    echo -e "  ${DIM}–   output/$fname  $fdesc${RESET}"
  fi
done

# ── write status JSON ─────────────────────────────────────────────────────────
echo ""
info "Writing status to $STATUS_FILE..."

STATUS_JSON="{"
STATUS_JSON+="\"completed_at\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\","
STATUS_JSON+="\"duration_seconds\": ${MASTER_DURATION},"
STATUS_JSON+="\"steps\": {"

for i in $(seq 0 $((TOTAL_SCRIPTS-1))); do
  name="${SCRIPT_NAME[$i]}"
  status="${STEP_STATUS[$i]:-UNKNOWN}"
  STATUS_JSON+="\"${name}\": \"${status}\""
  if [[ $i -lt $((TOTAL_SCRIPTS-1)) ]]; then STATUS_JSON+=","; fi
done

STATUS_JSON+="},"
STATUS_JSON+="\"success_count\": ${SUCCESS_COUNT},"
STATUS_JSON+="\"failed_count\": ${FAILED_COUNT},"
STATUS_JSON+="\"skipped_count\": ${SKIPPED_COUNT}"
STATUS_JSON+="}"

echo "$STATUS_JSON" | python3 -m json.tool > "$STATUS_FILE" 2>/dev/null \
  || echo "$STATUS_JSON" > "$STATUS_FILE"

success "Status written to output/run-all-status.json"

# ── next steps ────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   Next Steps                                                ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo "  1. Review output/wrangler-rebuild-env.toml"
echo "     → Append [env.rebuild] block to your root wrangler.toml"
echo "     → Test with: wrangler deploy --env rebuild --dry-run"
echo ""
echo "  2. Review output/wrangler-legacy-env.toml"
echo "     → Append [env.legacy] block to your root wrangler.toml"
echo ""
echo "  3. Add GitHub Actions secrets for CI:"
echo "     gh secret set GCP_SA_KEY_REBUILD < output/rebuild-sa-key.json  (if exists)"
echo "     gh secret set CLOUDFLARE_API_TOKEN --body \"\$CF_API_TOKEN\""
echo "     gh secret set NEON_DATABASE_URL_REBUILD < output/02-neon-setup.json"
echo ""
echo "  4. Test HeadyKey deployments:"
echo "     Legacy:  https://headykey-legacy.pages.dev"
echo "     Rebuild: https://headykey-rebuild.pages.dev"
echo ""
echo "  5. When ready to deploy Cloud Run:"
echo "     LEGACY_IMAGE=<image> bash output/cloud-run-legacy-deploy.sh"
echo "     REBUILD_IMAGE=<image> bash output/cloud-run-rebuild-deploy.sh"
echo ""
echo "  6. Verify ENV_SEPARATION doc:"
echo "     https://github.com/HeadySystems/heady-ai/blob/rebuild/docs/ENV_SEPARATION.md"
echo ""

if [[ $FAILED_COUNT -gt 0 ]]; then
  echo -e "${RED}${BOLD}⚠  $FAILED_COUNT script(s) failed. Check output/logs/ for details.${RESET}"
  echo ""
  exit 1
else
  echo -e "${GREEN}${BOLD}All systems go. Legacy + Rebuild environments configured.${RESET}"
  echo ""
fi
