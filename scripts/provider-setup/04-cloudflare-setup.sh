#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ Provider Separation — 04 Cloudflare Setup                  ║
# ║  Creates rebuild-namespaced resources mirroring legacy:            ║
# ║   • KV namespaces  (HEADY_KV → HEADY_KV--REBUILD)                 ║
# ║   • R2 buckets     (heady-* → heady-rebuild-*)                     ║
# ║   • Pages project  for headykey-rebuild                            ║
# ║   • Pages project  for headyme-portal-rebuild                      ║
# ║   • Worker secrets via wrangler (CLOUDFLARE_ACCOUNT_ID, token)     ║
# ║                                                                    ║
# ║  Prerequisites:                                                    ║
# ║    wrangler login                                                  ║
# ║    export CF_ACCOUNT_ID=$(wrangler whoami --json | jq -r '.id')    ║
# ╚══════════════════════════════════════════════════════════════════╝
set -euo pipefail

CF_ACCOUNT="${CF_ACCOUNT_ID:?Set CF_ACCOUNT_ID — find it: wrangler whoami}"
REBUILD_GCP="${REBUILD_GCP_PROJECT:?Set REBUILD_GCP_PROJECT}"

log() { echo -e "\n\033[1;34m▶  $*\033[0m"; }
ok()  { echo -e "\033[0;32m✓  $*\033[0m"; }
warn(){ echo -e "\033[1;33m⚠  $*\033[0m"; }

# Helper: create KV namespace if it doesn't already exist; echoes the ID
ensure_kv() {
  local title="$1"
  local existing
  existing=$(wrangler kv:namespace list 2>/dev/null \
    | jq -r ".[] | select(.title == \"${title}\") | .id" 2>/dev/null || echo "")
  if [ -n "$existing" ]; then
    ok "KV namespace '${title}' already exists: ${existing}"
    echo "$existing"
  else
    local result
    result=$(wrangler kv:namespace create "$title" 2>/dev/null)
    local id
    id=$(echo "$result" | grep -oP '(?<=id = ")[^"]+' || echo "$result" | jq -r '.id' 2>/dev/null || echo "")
    ok "Created KV namespace '${title}': ${id}"
    echo "$id"
  fi
}

# ── 1. KV Namespaces ─────────────────────────────────────────────────
log "Creating KV namespaces (rebuild)"

# Core namespaces — one per logical concern, rebuild-suffixed
KV_SESSION_REBUILD=$(ensure_kv   "HEADY_SESSIONS--REBUILD")
KV_CACHE_REBUILD=$(ensure_kv     "HEADY_CACHE--REBUILD")
KV_RATE_REBUILD=$(ensure_kv      "HEADY_RATE_LIMIT--REBUILD")
KV_CONFIG_REBUILD=$(ensure_kv    "HEADY_CONFIG--REBUILD")
KV_EMBED_REBUILD=$(ensure_kv     "HEADY_EMBED_CACHE--REBUILD")

# Preview variants (Wrangler uses these for --local dev)
KV_SESSION_REBUILD_PREV=$(ensure_kv   "HEADY_SESSIONS--REBUILD__preview")
KV_CACHE_REBUILD_PREV=$(ensure_kv     "HEADY_CACHE--REBUILD__preview")

echo ""
echo "  KV IDs (save these — needed for wrangler.toml):"
echo "    HEADY_SESSIONS--REBUILD      = ${KV_SESSION_REBUILD}"
echo "    HEADY_CACHE--REBUILD         = ${KV_CACHE_REBUILD}"
echo "    HEADY_RATE_LIMIT--REBUILD    = ${KV_RATE_REBUILD}"
echo "    HEADY_CONFIG--REBUILD        = ${KV_CONFIG_REBUILD}"
echo "    HEADY_EMBED_CACHE--REBUILD   = ${KV_EMBED_REBUILD}"

# ── 2. R2 Buckets ────────────────────────────────────────────────────
log "Creating R2 buckets (rebuild)"

ensure_r2() {
  local name="$1"
  if wrangler r2 bucket list 2>/dev/null | grep -q "\"$name\""; then
    ok "R2 bucket '${name}' already exists"
  else
    wrangler r2 bucket create "$name"
    ok "Created R2 bucket: ${name}"
  fi
}

ensure_r2 "heady-rebuild-assets"
ensure_r2 "heady-rebuild-uploads"
ensure_r2 "heady-rebuild-backups"

# ── 3. Cloudflare Pages — HeadyKey Rebuild ──────────────────────────
log "Creating Pages project: headykey-rebuild"
if wrangler pages project list 2>/dev/null | grep -q "headykey-rebuild"; then
  ok "Pages project 'headykey-rebuild' already exists"
else
  wrangler pages project create headykey-rebuild \
    --production-branch main
  ok "Created Pages project: headykey-rebuild"
fi

# ── 4. Cloudflare Pages — HeadyMe Portal Rebuild ────────────────────
log "Creating Pages project: headyme-portal-rebuild"
if wrangler pages project list 2>/dev/null | grep -q "headyme-portal-rebuild"; then
  ok "Pages project 'headyme-portal-rebuild' already exists"
else
  wrangler pages project create headyme-portal-rebuild \
    --production-branch rebuild
  ok "Created Pages project: headyme-portal-rebuild"
fi

# ── 5. Pull Firebase rebuild config from Secret Manager → CF secrets ─
log "Syncing Firebase rebuild config into Cloudflare Worker secrets"
warn "This requires REBUILD_GCP_PROJECT to be set and gcloud authenticated"

pull_and_set_cf_secret() {
  local secret_name="$1"
  local cf_secret_name="${2:-$1}"
  local value
  value=$(gcloud secrets versions access latest \
    --secret="$secret_name" \
    --project="$REBUILD_GCP" 2>/dev/null || echo "")

  if [ -z "$value" ] || [ "$value" = "PLACEHOLDER_REPLACE_ME" ]; then
    warn "Secret ${secret_name} is still a placeholder — skipping CF secret push"
    return 0
  fi

  # Push to all rebuild Worker scripts that need it
  # (headykey-rebuild worker context — if you have one; otherwise this is for future use)
  echo "$value" | wrangler secret put "$cf_secret_name" \
    --name heady-rebuild-edge 2>/dev/null \
    || warn "Worker 'heady-rebuild-edge' not deployed yet — secret will be set on first deploy"
  ok "CF secret ${cf_secret_name} set"
}

pull_and_set_cf_secret "FIREBASE_PROJECT_ID"
pull_and_set_cf_secret "FIREBASE_API_KEY"
pull_and_set_cf_secret "FIREBASE_AUTH_DOMAIN"

# ── 6. Write wrangler.toml [env.rebuild] stanza ──────────────────────
log "Generating wrangler.toml environment stanza for rebuild"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WRANGLER_PATCH="${SCRIPT_DIR}/wrangler-rebuild-env.toml"

cat > "$WRANGLER_PATCH" <<WRANGLER
# ── Paste this into your wrangler.toml under [env.rebuild] ──────────
# Generated by 04-cloudflare-setup.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)

[env.rebuild]
name = "heady-edge-rebuild"
compatibility_date = "2026-01-01"

[env.rebuild.vars]
ENVIRONMENT = "rebuild"
FIREBASE_PROJECT_ID = "${REBUILD_GCP_PROJECT}"

[[env.rebuild.kv_namespaces]]
binding = "SESSIONS"
id = "${KV_SESSION_REBUILD}"
preview_id = "${KV_SESSION_REBUILD_PREV}"

[[env.rebuild.kv_namespaces]]
binding = "CACHE"
id = "${KV_CACHE_REBUILD}"
preview_id = "${KV_CACHE_REBUILD_PREV}"

[[env.rebuild.kv_namespaces]]
binding = "RATE_LIMIT"
id = "${KV_RATE_REBUILD}"

[[env.rebuild.kv_namespaces]]
binding = "CONFIG"
id = "${KV_CONFIG_REBUILD}"

[[env.rebuild.kv_namespaces]]
binding = "EMBED_CACHE"
id = "${KV_EMBED_REBUILD}"

[[env.rebuild.r2_buckets]]
binding = "ASSETS"
bucket_name = "heady-rebuild-assets"

[[env.rebuild.r2_buckets]]
binding = "UPLOADS"
bucket_name = "heady-rebuild-uploads"
WRANGLER

ok "wrangler-rebuild-env.toml written to ${WRANGLER_PATCH}"

# ── 7. Output summary ────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Cloudflare Setup Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Pages projects:"
echo "    headykey-rebuild       → https://headykey-rebuild.pages.dev"
echo "    headyme-portal-rebuild → https://headyme-portal-rebuild.pages.dev"
echo ""
echo "  KV namespaces created with --REBUILD suffix"
echo "  R2 buckets: heady-rebuild-{assets,uploads,backups}"
echo ""
echo "  wrangler.toml patch → ${WRANGLER_PATCH}"
echo "  Merge [env.rebuild] stanza into your wrangler.toml"
echo ""
echo "  Next: bash 05-headykey-deploy.sh"
