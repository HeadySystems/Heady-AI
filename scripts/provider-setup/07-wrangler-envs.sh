#!/usr/bin/env bash
# =============================================================================
# 07-wrangler-envs.sh
# HeadyKey + HeadyVault — Wrangler env stanza generator + Cloud Run --set-secrets
#
# What this script does:
#   1. Reads KV namespace IDs created by 04-cloudflare-setup.sh from the
#      generated file at $WRANGLER_REBUILD_ENV_FILE
#   2. Validates the wrangler-rebuild-env.toml stanza is correct and complete
#   3. Prints the Cloud Run --set-secrets flag strings for both legacy and
#      rebuild deployments (ready to paste into deploy.sh or CI secrets)
#   4. Writes a machine-readable JSON summary: scripts/output/07-wrangler-envs.json
#
# Prerequisites:
#   - 04-cloudflare-setup.sh must have run successfully
#   - wrangler must be authenticated (wrangler whoami)
#   - $CF_ACCOUNT_ID set in environment
# =============================================================================

set -euo pipefail

# ── colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[07]${RESET} $*"; }
success() { echo -e "${GREEN}[07] ✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}[07] ⚠${RESET} $*"; }
fail()    { echo -e "${RED}[07] ✗${RESET} $*" >&2; exit 1; }

# ── paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/output"
WRANGLER_REBUILD_ENV_FILE="$OUTPUT_DIR/wrangler-rebuild-env.toml"
JSON_OUT="$OUTPUT_DIR/07-wrangler-envs.json"
SECRETS_ENV_LEGACY="$OUTPUT_DIR/.env.legacy"
SECRETS_ENV_REBUILD="$OUTPUT_DIR/.env.rebuild"

mkdir -p "$OUTPUT_DIR"

echo ""
echo -e "${BOLD}════════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  07 · Wrangler Envs + Cloud Run --set-secrets Generator    ${RESET}"
echo -e "${BOLD}════════════════════════════════════════════════════════════${RESET}"
echo ""

# ── 1. Validate prerequisites ─────────────────────────────────────────────────
info "Checking prerequisites..."

if ! command -v wrangler &>/dev/null; then
  fail "wrangler not found. Install: npm i -g wrangler"
fi

if [[ -z "${CF_ACCOUNT_ID:-}" ]]; then
  # Try to read from output of 04
  if [[ -f "$OUTPUT_DIR/04-cloudflare-setup.json" ]]; then
    CF_ACCOUNT_ID=$(jq -r '.account_id // empty' "$OUTPUT_DIR/04-cloudflare-setup.json" 2>/dev/null || true)
  fi
fi

if [[ -z "${CF_ACCOUNT_ID:-}" ]]; then
  warn "CF_ACCOUNT_ID not set. Attempting to read from wrangler whoami..."
  CF_ACCOUNT_ID=$(wrangler whoami 2>/dev/null | grep -oP 'account id: \K[a-f0-9]+' | head -1 || true)
fi

if [[ -z "${CF_ACCOUNT_ID:-}" ]]; then
  fail "Cannot determine CF_ACCOUNT_ID. Set it manually: export CF_ACCOUNT_ID=<your-id>"
fi
success "Cloudflare account: $CF_ACCOUNT_ID"

# ── 2. Read KV namespace IDs ───────────────────────────────────────────────────
info "Reading KV namespace IDs from prior script outputs..."

# Helper: look up a KV namespace ID by title via wrangler API
get_kv_id() {
  local title="$1"
  wrangler kv namespace list 2>/dev/null \
    | grep -A1 "\"title\": \"${title}\"" \
    | grep '"id"' \
    | grep -oP '"id": "\K[^"]+' \
    | head -1 || true
}

# Namespace titles created by 04-cloudflare-setup.sh
declare -A KV_IDS
declare -A KV_NAMES=(
  [HEADY_SESSIONS_LEGACY]="HEADY_SESSIONS"
  [HEADY_SESSIONS_REBUILD]="HEADY_SESSIONS--REBUILD"
  [HEADY_VECTOR_LEGACY]="HEADY_VECTOR_MEMORY"
  [HEADY_VECTOR_REBUILD]="HEADY_VECTOR_MEMORY--REBUILD"
  [HEADY_CACHE_LEGACY]="HEADY_CACHE"
  [HEADY_CACHE_REBUILD]="HEADY_CACHE--REBUILD"
  [HEADY_CONFIG_LEGACY]="HEADY_CONFIG"
  [HEADY_CONFIG_REBUILD]="HEADY_CONFIG--REBUILD"
  [HEADY_AGENT_STATE_LEGACY]="HEADY_AGENT_STATE"
  [HEADY_AGENT_STATE_REBUILD]="HEADY_AGENT_STATE--REBUILD"
)

# First, try to load from the JSON summary written by 04
if [[ -f "$OUTPUT_DIR/04-cloudflare-setup.json" ]]; then
  info "Loading KV IDs from 04-cloudflare-setup.json..."
  for KEY in "${!KV_NAMES[@]}"; do
    TITLE="${KV_NAMES[$KEY]}"
    ID=$(jq -r --arg t "$TITLE" '.kv_namespaces[] | select(.title == $t) | .id // empty' \
         "$OUTPUT_DIR/04-cloudflare-setup.json" 2>/dev/null || true)
    if [[ -n "$ID" ]]; then
      KV_IDS[$KEY]="$ID"
      success "  $TITLE → $ID"
    fi
  done
fi

# Fall back to live wrangler query for any missing
MISSING=0
for KEY in "${!KV_NAMES[@]}"; do
  if [[ -z "${KV_IDS[$KEY]:-}" ]]; then
    TITLE="${KV_NAMES[$KEY]}"
    info "  Live lookup: $TITLE..."
    ID=$(get_kv_id "$TITLE")
    if [[ -n "$ID" ]]; then
      KV_IDS[$KEY]="$ID"
      success "  $TITLE → $ID"
    else
      warn "  $TITLE — NOT FOUND (will use placeholder in output)"
      KV_IDS[$KEY]="PLACEHOLDER_${KEY}"
      MISSING=$((MISSING + 1))
    fi
  fi
done

if [[ $MISSING -gt 0 ]]; then
  warn "$MISSING KV namespace(s) not found. Run 04-cloudflare-setup.sh first, or fill in placeholders manually."
fi

# ── 3. Validate / display wrangler-rebuild-env.toml ───────────────────────────
echo ""
info "Validating wrangler-rebuild-env.toml stanza from 04-cloudflare-setup.sh..."

if [[ ! -f "$WRANGLER_REBUILD_ENV_FILE" ]]; then
  warn "wrangler-rebuild-env.toml not found at: $WRANGLER_REBUILD_ENV_FILE"
  warn "Generating a fresh one now based on discovered KV IDs..."

  # Write a fresh stanza
  cat > "$WRANGLER_REBUILD_ENV_FILE" << TOML
# =============================================================================
# wrangler-rebuild-env.toml  —  [env.rebuild] stanza
# Generated by 07-wrangler-envs.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
#
# HOW TO USE:
#   Append this block to your root wrangler.toml, or include via:
#     [env.rebuild]
#   When deploying rebuild:
#     wrangler deploy --env rebuild
# =============================================================================

[env.rebuild]
name = "heady-portal-rebuild"
account_id = "${CF_ACCOUNT_ID}"

[env.rebuild.vars]
ENVIRONMENT = "rebuild"
GOOGLE_CLOUD_PROJECT = "heady-rebuild"
FIREBASE_PROJECT_ID = "heady-rebuild"
HEADY_ENV_TAG = "rebuild"

[[env.rebuild.kv_namespaces]]
binding = "HEADY_SESSIONS"
id = "${KV_IDS[HEADY_SESSIONS_REBUILD]}"

[[env.rebuild.kv_namespaces]]
binding = "HEADY_VECTOR_MEMORY"
id = "${KV_IDS[HEADY_VECTOR_REBUILD]}"

[[env.rebuild.kv_namespaces]]
binding = "HEADY_CACHE"
id = "${KV_IDS[HEADY_CACHE_REBUILD]}"

[[env.rebuild.kv_namespaces]]
binding = "HEADY_CONFIG"
id = "${KV_IDS[HEADY_CONFIG_REBUILD]}"

[[env.rebuild.kv_namespaces]]
binding = "HEADY_AGENT_STATE"
id = "${KV_IDS[HEADY_AGENT_STATE_REBUILD]}"

# R2 buckets
[[env.rebuild.r2_buckets]]
binding = "HEADY_ASSETS"
bucket_name = "heady-rebuild-assets"

[[env.rebuild.r2_buckets]]
binding = "HEADY_ARTIFACTS"
bucket_name = "heady-rebuild-artifacts"

[[env.rebuild.r2_buckets]]
binding = "HEADY_VECTOR_STORE"
bucket_name = "heady-rebuild-vector-store"
TOML

  success "wrangler-rebuild-env.toml written to: $WRANGLER_REBUILD_ENV_FILE"
else
  success "wrangler-rebuild-env.toml exists."
  # Verify KV IDs in the file match what we found live
  for KEY in HEADY_SESSIONS_REBUILD HEADY_VECTOR_REBUILD HEADY_CACHE_REBUILD HEADY_CONFIG_REBUILD HEADY_AGENT_STATE_REBUILD; do
    ID="${KV_IDS[$KEY]:-}"
    if [[ -n "$ID" ]] && ! grep -q "$ID" "$WRANGLER_REBUILD_ENV_FILE"; then
      warn "KV ID for $KEY ($ID) not found in wrangler-rebuild-env.toml — it may be stale."
    fi
  done
fi

cat "$WRANGLER_REBUILD_ENV_FILE"
echo ""

# ── 4. Corresponding legacy [env.legacy] stanza ───────────────────────────────
WRANGLER_LEGACY_ENV_FILE="$OUTPUT_DIR/wrangler-legacy-env.toml"

cat > "$WRANGLER_LEGACY_ENV_FILE" << TOML
# =============================================================================
# wrangler-legacy-env.toml  —  [env.legacy] stanza
# Generated by 07-wrangler-envs.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# =============================================================================

[env.legacy]
name = "heady-portal-legacy"
account_id = "${CF_ACCOUNT_ID}"

[env.legacy.vars]
ENVIRONMENT = "legacy"
GOOGLE_CLOUD_PROJECT = "heady-ai"
FIREBASE_PROJECT_ID = "heady-ai"
HEADY_ENV_TAG = "legacy"

[[env.legacy.kv_namespaces]]
binding = "HEADY_SESSIONS"
id = "${KV_IDS[HEADY_SESSIONS_LEGACY]}"

[[env.legacy.kv_namespaces]]
binding = "HEADY_VECTOR_MEMORY"
id = "${KV_IDS[HEADY_VECTOR_LEGACY]}"

[[env.legacy.kv_namespaces]]
binding = "HEADY_CACHE"
id = "${KV_IDS[HEADY_CACHE_LEGACY]}"

[[env.legacy.kv_namespaces]]
binding = "HEADY_CONFIG"
id = "${KV_IDS[HEADY_CONFIG_LEGACY]}"

[[env.legacy.kv_namespaces]]
binding = "HEADY_AGENT_STATE"
id = "${KV_IDS[HEADY_AGENT_STATE_LEGACY]}"
TOML

success "wrangler-legacy-env.toml written to: $WRANGLER_LEGACY_ENV_FILE"

# ── 5. Cloud Run --set-secrets flags ─────────────────────────────────────────
echo ""
echo -e "${BOLD}────────────────────────────────────────────────────────────${RESET}"
echo -e "${BOLD}  Cloud Run --set-secrets Flags                             ${RESET}"
echo -e "${BOLD}────────────────────────────────────────────────────────────${RESET}"
echo ""

# Secret names (must exist in GCP Secret Manager — seeded by 06-headyvault-seed.sh)
SECRETS=(
  "DATABASE_URL"
  "UPSTASH_REDIS_REST_URL"
  "UPSTASH_REDIS_REST_TOKEN"
  "CLOUDFLARE_ACCOUNT_ID"
  "CLOUDFLARE_API_TOKEN"
  "INTERNAL_NODE_SECRET"
  "VAULT_PASSPHRASE"
  "ANTHROPIC_API_KEY"
  "GROQ_API_KEY"
  "OPENAI_API_KEY"
  "GEMINI_API_KEY"
  "HUGGINGFACE_TOKEN"
  "HEADY_ALLOW_HF_EMBED"
  "HEADY_OWNER"
  "HEADY_OWNER_PASS"
)

# Format: ENV_VAR=projects/PROJECT/secrets/SECRET_NAME:latest
build_set_secrets_flag() {
  local project="$1"
  local env_tag="$2"
  local flags=()
  for secret in "${SECRETS[@]}"; do
    flags+=("${secret}=projects/${project}/secrets/${secret}:latest")
  done
  # Join with commas
  local joined
  joined=$(IFS=,; echo "${flags[*]}")
  echo "--set-secrets=\"${joined}\""
}

LEGACY_SET_SECRETS=$(build_set_secrets_flag "heady-ai" "legacy")
REBUILD_SET_SECRETS=$(build_set_secrets_flag "heady-rebuild" "rebuild")

echo -e "${CYAN}# ── LEGACY (GCP project: heady-ai) ──────────────────────────${RESET}"
echo ""
echo "gcloud run deploy heady-portal \\"
echo "  --project=heady-ai \\"
echo "  --region=us-central1 \\"
echo "  --set-env-vars=ENVIRONMENT=legacy,GOOGLE_CLOUD_PROJECT=heady-ai,FIREBASE_PROJECT_ID=heady-ai \\"
echo "  ${LEGACY_SET_SECRETS} \\"
echo "  --image=\$LEGACY_IMAGE"
echo ""

echo -e "${CYAN}# ── REBUILD (GCP project: heady-rebuild) ────────────────────${RESET}"
echo ""
echo "gcloud run deploy heady-portal-rebuild \\"
echo "  --project=heady-rebuild \\"
echo "  --region=us-central1 \\"
echo "  --set-env-vars=ENVIRONMENT=rebuild,GOOGLE_CLOUD_PROJECT=heady-rebuild,FIREBASE_PROJECT_ID=heady-rebuild \\"
echo "  ${REBUILD_SET_SECRETS} \\"
echo "  --image=\$REBUILD_IMAGE"
echo ""

# Also write to files for easy copy-paste
LEGACY_CR_FILE="$OUTPUT_DIR/cloud-run-legacy-deploy.sh"
REBUILD_CR_FILE="$OUTPUT_DIR/cloud-run-rebuild-deploy.sh"

cat > "$LEGACY_CR_FILE" << EOF
#!/usr/bin/env bash
# Cloud Run deploy command — LEGACY
# Generated by 07-wrangler-envs.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Usage: LEGACY_IMAGE=<image-url> bash cloud-run-legacy-deploy.sh

set -euo pipefail
: "\${LEGACY_IMAGE:?Set LEGACY_IMAGE to the container image URL}"

gcloud run deploy heady-portal \\
  --project=heady-ai \\
  --region=us-central1 \\
  --set-env-vars=ENVIRONMENT=legacy,GOOGLE_CLOUD_PROJECT=heady-ai,FIREBASE_PROJECT_ID=heady-ai \\
  ${LEGACY_SET_SECRETS} \\
  --image="\$LEGACY_IMAGE"
EOF

cat > "$REBUILD_CR_FILE" << EOF
#!/usr/bin/env bash
# Cloud Run deploy command — REBUILD
# Generated by 07-wrangler-envs.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Usage: REBUILD_IMAGE=<image-url> bash cloud-run-rebuild-deploy.sh

set -euo pipefail
: "\${REBUILD_IMAGE:?Set REBUILD_IMAGE to the container image URL}"

gcloud run deploy heady-portal-rebuild \\
  --project=heady-rebuild \\
  --region=us-central1 \\
  --set-env-vars=ENVIRONMENT=rebuild,GOOGLE_CLOUD_PROJECT=heady-rebuild,FIREBASE_PROJECT_ID=heady-rebuild \\
  ${REBUILD_SET_SECRETS} \\
  --image="\$REBUILD_IMAGE"
EOF

chmod +x "$LEGACY_CR_FILE" "$REBUILD_CR_FILE"
success "Cloud Run deploy scripts written to output/"

# ── 6. JSON summary ───────────────────────────────────────────────────────────
echo ""
info "Writing JSON summary to $JSON_OUT..."

KV_JSON=""
for KEY in "${!KV_NAMES[@]}"; do
  TITLE="${KV_NAMES[$KEY]}"
  ID="${KV_IDS[$KEY]:-unknown}"
  KV_JSON="${KV_JSON}    {\"title\": \"${TITLE}\", \"binding_key\": \"${KEY}\", \"id\": \"${ID}\"},\n"
done
KV_JSON="${KV_JSON%,\\n}"  # trim trailing comma

cat > "$JSON_OUT" << JSON
{
  "generated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "cf_account_id": "${CF_ACCOUNT_ID}",
  "kv_namespaces": [
$(echo -e "$KV_JSON")
  ],
  "wrangler_rebuild_env_file": "${WRANGLER_REBUILD_ENV_FILE}",
  "wrangler_legacy_env_file": "${WRANGLER_LEGACY_ENV_FILE}",
  "cloud_run_legacy_deploy": "${LEGACY_CR_FILE}",
  "cloud_run_rebuild_deploy": "${REBUILD_CR_FILE}",
  "missing_kv_count": ${MISSING}
}
JSON

success "JSON summary written."

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  07 complete.                                              ${RESET}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════${RESET}"
echo ""
echo "Files written to output/:"
echo "  wrangler-rebuild-env.toml    — append to wrangler.toml for rebuild Worker"
echo "  wrangler-legacy-env.toml     — append to wrangler.toml for legacy Worker"
echo "  cloud-run-legacy-deploy.sh   — gcloud run deploy (legacy)"
echo "  cloud-run-rebuild-deploy.sh  — gcloud run deploy (rebuild)"
echo "  07-wrangler-envs.json        — machine-readable summary"
echo ""
if [[ $MISSING -gt 0 ]]; then
  echo -e "${YELLOW}⚠  $MISSING KV namespace(s) used placeholder IDs.${RESET}"
  echo "   Run 04-cloudflare-setup.sh first to create them, then re-run this script."
fi
