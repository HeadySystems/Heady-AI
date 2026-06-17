#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ Provider Separation — 06 HeadyVault Seed                   ║
# ║  Populates GCP Secret Manager for both legacy and rebuild with     ║
# ║  all secrets defined in packages/secrets/src/registry.mjs.        ║
# ║                                                                    ║
# ║  For each secret:                                                  ║
# ║   • PLACEHOLDER values → prompts you to enter the real value       ║
# ║   • Auto-generated secrets (strategy=internal) → generates them    ║
# ║   • Existing non-placeholder values → skips (idempotent)           ║
# ║                                                                    ║
# ║  Also outputs .env.legacy and .env.rebuild for local dev.          ║
# ║                                                                    ║
# ║  Prerequisites:                                                    ║
# ║    gcloud auth application-default login                           ║
# ║    export LEGACY_GCP_PROJECT=heady-ai                              ║
# ║    export REBUILD_GCP_PROJECT=heady-rebuild                        ║
# ╚══════════════════════════════════════════════════════════════════╝
set -euo pipefail

LEGACY="${LEGACY_GCP_PROJECT:?Set LEGACY_GCP_PROJECT}"
REBUILD="${REBUILD_GCP_PROJECT:?Set REBUILD_GCP_PROJECT}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { echo -e "\n\033[1;34m▶  $*\033[0m"; }
ok()  { echo -e "\033[0;32m✓  $*\033[0m"; }
warn(){ echo -e "\033[1;33m⚠  $*\033[0m"; }

# Generate a cryptographically random secret (32 hex bytes = 64 chars)
gen_secret() { openssl rand -hex 32; }

# Read current secret version from a project; returns "" if placeholder or missing
read_secret() {
  local name="$1" project="$2"
  local val
  val=$(gcloud secrets versions access latest \
    --secret="$name" --project="$project" 2>/dev/null || echo "")
  if [ "$val" = "PLACEHOLDER_REPLACE_ME" ] || [ -z "$val" ]; then
    echo ""
  else
    echo "$val"
  fi
}

# Write a new version to Secret Manager
write_secret() {
  local name="$1" value="$2" project="$3"
  echo -n "$value" | gcloud secrets versions add "$name" \
    --project="$project" --data-file=- 2>/dev/null \
  || echo -n "$value" | gcloud secrets create "$name" \
       --project="$project" --data-file=- \
       --replication-policy=automatic \
       --labels=env="$(echo $project | sed 's/heady-//')",managed-by=heady
}

# ── Declare all secrets with their generation strategy ───────────────
# Format: "NAME|strategy|description"
# strategy: prompt | internal | copy_from_legacy | auto_url
declare -a SECRET_DEFS=(
  "DATABASE_URL|auto_url|Neon Postgres connection string — set by 02-neon-setup.sh"
  "UPSTASH_REDIS_REST_URL|prompt|Upstash Redis REST endpoint (from Upstash console)"
  "UPSTASH_REDIS_REST_TOKEN|prompt|Upstash Redis REST token (from Upstash console)"
  "CLOUDFLARE_ACCOUNT_ID|prompt|Cloudflare account ID (wrangler whoami)"
  "CLOUDFLARE_API_TOKEN|prompt|Cloudflare Workers AI token (scope: Workers AI:Read)"
  "ANTHROPIC_API_KEY|copy_from_legacy|Anthropic API key"
  "OPENAI_API_KEY|copy_from_legacy|OpenAI API key"
  "GEMINI_API_KEY|copy_from_legacy|Gemini API key"
  "GROQ_API_KEY|copy_from_legacy|Groq API key"
  "HUGGINGFACE_TOKEN|copy_from_legacy|Hugging Face token"
  "HEADY_ALLOW_HF_EMBED|prompt_default_0|HuggingFace embed flag (0 or 1)"
  "INTERNAL_NODE_SECRET|internal|Inter-service auth secret (auto-generated)"
  "VAULT_PASSPHRASE|internal|Encryption root passphrase (auto-generated — save offline backup)"
  "HEADY_OWNER|prompt|Owner email (eric@headyconnection.org)"
  "HEADY_OWNER_PASS|internal|Owner credential (auto-generated — rotate after first use)"
)

declare -A LEGACY_VALUES=()
declare -A REBUILD_VALUES=()

log "Processing secrets for LEGACY project: ${LEGACY}"
echo ""

for def in "${SECRET_DEFS[@]}"; do
  IFS='|' read -r name strategy desc <<< "$def"
  existing=$(read_secret "$name" "$LEGACY")

  if [ -n "$existing" ]; then
    ok "${name}: already set in legacy — skipping"
    LEGACY_VALUES[$name]="[already set]"
    continue
  fi

  case "$strategy" in
    internal)
      value=$(gen_secret)
      write_secret "$name" "$value" "$LEGACY"
      ok "${name}: generated + written to legacy"
      LEGACY_VALUES[$name]="[generated]"
      ;;
    copy_from_legacy)
      # For legacy, just prompt
      echo -n "  Enter value for ${name} (${desc}): "
      read -r -s value; echo ""
      if [ -n "$value" ]; then
        write_secret "$name" "$value" "$LEGACY"
        ok "${name}: written to legacy"
        LEGACY_VALUES[$name]="[set]"
      else
        warn "${name}: skipped (empty input)"
        LEGACY_VALUES[$name]="[skipped]"
      fi
      ;;
    auto_url)
      existing_auto=$(read_secret "$name" "$LEGACY")
      if [ -n "$existing_auto" ]; then
        ok "${name}: already set by neon-setup.sh"
      else
        warn "${name}: not yet set — run 02-neon-setup.sh first"
        LEGACY_VALUES[$name]="[needs neon-setup]"
      fi
      ;;
    prompt_default_0)
      echo -n "  Enter value for ${name} [default: 0]: "
      read -r value
      value="${value:-0}"
      write_secret "$name" "$value" "$LEGACY"
      ok "${name}: written to legacy"
      LEGACY_VALUES[$name]="$value"
      ;;
    prompt)
      echo -n "  Enter value for ${name} (${desc}): "
      read -r -s value; echo ""
      if [ -n "$value" ]; then
        write_secret "$name" "$value" "$LEGACY"
        ok "${name}: written to legacy"
        LEGACY_VALUES[$name]="[set]"
      else
        warn "${name}: skipped (empty)"
        LEGACY_VALUES[$name]="[skipped]"
      fi
      ;;
  esac
done

log "Processing secrets for REBUILD project: ${REBUILD}"
echo ""

for def in "${SECRET_DEFS[@]}"; do
  IFS='|' read -r name strategy desc <<< "$def"
  existing=$(read_secret "$name" "$REBUILD")

  if [ -n "$existing" ]; then
    ok "${name}: already set in rebuild — skipping"
    REBUILD_VALUES[$name]="[already set]"
    continue
  fi

  case "$strategy" in
    internal)
      # Generate NEW values for rebuild — never share with legacy
      value=$(gen_secret)
      write_secret "$name" "$value" "$REBUILD"
      ok "${name}: generated + written to rebuild"
      REBUILD_VALUES[$name]="[generated]"
      ;;
    copy_from_legacy)
      # Copy from legacy — same API keys, different project
      legacy_val=$(gcloud secrets versions access latest \
        --secret="$name" --project="$LEGACY" 2>/dev/null || echo "")
      if [ -n "$legacy_val" ] && [ "$legacy_val" != "PLACEHOLDER_REPLACE_ME" ]; then
        write_secret "$name" "$legacy_val" "$REBUILD"
        ok "${name}: copied from legacy to rebuild"
        REBUILD_VALUES[$name]="[copied from legacy]"
      else
        echo -n "  Enter value for ${name} in rebuild (${desc}): "
        read -r -s value; echo ""
        if [ -n "$value" ]; then
          write_secret "$name" "$value" "$REBUILD"
          ok "${name}: written to rebuild"
        fi
      fi
      ;;
    auto_url)
      warn "${name}: not yet set — run 02-neon-setup.sh first"
      REBUILD_VALUES[$name]="[needs neon-setup]"
      ;;
    prompt_default_0)
      echo -n "  Enter value for ${name} in rebuild [default: 0]: "
      read -r value
      value="${value:-0}"
      write_secret "$name" "$value" "$REBUILD"
      ok "${name}: written to rebuild"
      ;;
    prompt)
      # For rebuild, prompt separately (may need different Upstash DB etc)
      echo -n "  Enter value for ${name} in REBUILD (${desc}) [leave blank to copy from legacy]: "
      read -r -s value; echo ""
      if [ -z "$value" ]; then
        legacy_val=$(gcloud secrets versions access latest \
          --secret="$name" --project="$LEGACY" 2>/dev/null || echo "")
        if [ -n "$legacy_val" ] && [ "$legacy_val" != "PLACEHOLDER_REPLACE_ME" ]; then
          write_secret "$name" "$legacy_val" "$REBUILD"
          ok "${name}: copied from legacy to rebuild"
        else
          warn "${name}: skipped"
        fi
      else
        write_secret "$name" "$value" "$REBUILD"
        ok "${name}: written to rebuild"
      fi
      ;;
  esac
done

# ── Generate .env files for local development ─────────────────────────
log "Generating .env.legacy and .env.rebuild for local development"

for env_name in legacy rebuild; do
  project="${LEGACY}"
  [ "$env_name" = "rebuild" ] && project="${REBUILD}"

  env_file="${SCRIPT_DIR}/.env.${env_name}"
  cat > "$env_file" <<ENVHEADER
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ Local Dev — .env.${env_name}                                    ║
# ║  Generated by 06-headyvault-seed.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)  ║
# ║  DO NOT COMMIT. Pulled from GCP Secret Manager (${project}).      ║
# ╚══════════════════════════════════════════════════════════════════╝
ENVIRONMENT=${env_name}
GOOGLE_CLOUD_PROJECT=${project}

ENVHEADER

  for def in "${SECRET_DEFS[@]}"; do
    IFS='|' read -r name strategy desc <<< "$def"
    val=$(gcloud secrets versions access latest \
      --secret="$name" --project="$project" 2>/dev/null || echo "")
    if [ -n "$val" ] && [ "$val" != "PLACEHOLDER_REPLACE_ME" ]; then
      echo "${name}=${val}" >> "$env_file"
    else
      echo "# ${name}=  # NOT SET" >> "$env_file"
    fi
  done

  # Ensure .env.* files are gitignored
  if [ -f "${SCRIPT_DIR}/.gitignore" ]; then
    grep -q "\.env\." "${SCRIPT_DIR}/.gitignore" \
      || echo ".env.*" >> "${SCRIPT_DIR}/.gitignore"
  fi

  ok ".env.${env_name} written (${env_file})"
done

# ── Verification run ─────────────────────────────────────────────────
log "Verifying all required secrets are non-placeholder"
FAIL_COUNT=0
for project in "$LEGACY" "$REBUILD"; do
  echo "  Project: ${project}"
  for def in "${SECRET_DEFS[@]}"; do
    IFS='|' read -r name strategy desc <<< "$def"
    [ "$strategy" = "auto_url" ] && continue  # checked separately
    val=$(gcloud secrets versions access latest \
      --secret="$name" --project="$project" 2>/dev/null || echo "")
    if [ -z "$val" ] || [ "$val" = "PLACEHOLDER_REPLACE_ME" ]; then
      echo "    ✗  ${name}: still placeholder"
      ((FAIL_COUNT++)) || true
    else
      echo "    ✓  ${name}"
    fi
  done
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  HeadyVault Seed Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
if [ "$FAIL_COUNT" -gt 0 ]; then
  warn "${FAIL_COUNT} secrets still need values — re-run this script to fill them."
else
  ok "All secrets populated in both legacy and rebuild projects."
fi
echo ""
echo "  .env.legacy  → ${SCRIPT_DIR}/.env.legacy"
echo "  .env.rebuild → ${SCRIPT_DIR}/.env.rebuild"
echo ""
echo "  To use locally:"
echo "    source .env.legacy   && pnpm dev"
echo "    source .env.rebuild  && pnpm dev"
echo ""
echo "  Cloud Run will inject secrets automatically via --set-secrets"
echo "  (see 07-wrangler-envs.sh for the complete deploy flag sets)"
echo ""
echo "  Next: bash 07-wrangler-envs.sh"
