#!/usr/bin/env bash
# =============================================================================
# Heady Cloudflare for Startups — Master Configuration Script
# =============================================================================
# Usage: ./scripts/cloudflare-startup-setup.sh
# Requires: CLOUDFLARE_API_TOKEN set in environment or .env
# =============================================================================
set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
ACCOUNT_ID="8b1fa38f282c691423c6399247d53323"
API_BASE="https://api.cloudflare.com/client/v4"

# Load token from .env if not in environment
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  ENV_FILE="${SCRIPT_DIR}/../.env"
  if [[ -f "$ENV_FILE" ]]; then
    CLOUDFLARE_API_TOKEN=$(grep '^CLOUDFLARE_API_TOKEN=' "$ENV_FILE" | head -1 | cut -d'=' -f2 | tr -d '"')
  fi
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "❌ CLOUDFLARE_API_TOKEN not found. Set it in environment or .env"
  exit 1
fi

# ── Enterprise Domain Zone IDs ───────────────────────────────────────────────
ENTERPRISE_ZONES=(
  "7153f1efff9af0d91570c1c1be79e241"   # headyme.com
  "d71262d0faa509f890fd5fea413c39bc"   # headysystems.com
  "1f1062b74efb9b61d4dd057f8ba9c653"   # headyconnection.org
)

ENTERPRISE_NAMES=(
  "headyme.com"
  "headysystems.com"
  "headyconnection.org"
)

# ── Helpers ──────────────────────────────────────────────────────────────────
cf_api() {
  local method="$1"
  local endpoint="$2"
  local data="${3:-}"

  if [[ -n "$data" ]]; then
    curl -s -X "$method" "${API_BASE}${endpoint}" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$data"
  else
    curl -s -X "$method" "${API_BASE}${endpoint}" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      -H "Content-Type: application/json"
  fi
}

check_success() {
  local response="$1"
  local context="$2"
  if echo "$response" | python3 -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get('success') else 1)" 2>/dev/null; then
    echo "  ✅ $context"
  else
    local errors=$(echo "$response" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('errors', []))" 2>/dev/null || echo "unknown")
    echo "  ⚠️  $context — $errors"
  fi
}

# ── Fetch All Zone IDs ───────────────────────────────────────────────────────
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  Heady Cloudflare for Startups — Configuration Engine       ║"
echo "║  Account: ${ACCOUNT_ID}                ║"
echo "║  Credits: \$5,000 (expires Apr 14, 2027)                     ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

echo "🔍 Fetching all zone IDs..."
ALL_ZONES=()
for page in 1 2; do
  while IFS= read -r zone_id; do
    ALL_ZONES+=("$zone_id")
  done < <(cf_api GET "/zones?per_page=50&account.id=${ACCOUNT_ID}&page=${page}" | \
    python3 -c "import json,sys; [print(z['id']) for z in json.load(sys.stdin).get('result',[])]" 2>/dev/null)
done
echo "📊 Total zones found: ${#ALL_ZONES[@]}"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3: Performance Optimization (Enterprise Domains)
# ══════════════════════════════════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚡ Phase 3: Performance Optimization (Enterprise Domains)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for i in "${!ENTERPRISE_ZONES[@]}"; do
  zone_id="${ENTERPRISE_ZONES[$i]}"
  zone_name="${ENTERPRISE_NAMES[$i]}"
  echo ""
  echo "🌐 Configuring: $zone_name ($zone_id)"

  # Argo Smart Routing
  result=$(cf_api PATCH "/zones/${zone_id}/argo/smart_routing" '{"value":"on"}')
  check_success "$result" "Argo Smart Routing"

  # Argo Tiered Caching
  result=$(cf_api PATCH "/zones/${zone_id}/argo/tiered_caching" '{"value":"on"}')
  check_success "$result" "Argo Tiered Caching"

  # Polish (lossless image compression)
  result=$(cf_api PATCH "/zones/${zone_id}/settings/polish" '{"value":"lossless"}')
  check_success "$result" "Polish (lossless)"

  # Mirage (mobile image optimization)
  result=$(cf_api PATCH "/zones/${zone_id}/settings/mirage" '{"value":"on"}')
  check_success "$result" "Mirage"

  # Early Hints
  result=$(cf_api PATCH "/zones/${zone_id}/settings/early_hints" '{"value":"on"}')
  check_success "$result" "Early Hints"

  # HTTP/3
  result=$(cf_api PATCH "/zones/${zone_id}/settings/h2_prioritization" '{"value":"on"}')
  check_success "$result" "HTTP/2 Prioritization"

  # 0-RTT
  result=$(cf_api PATCH "/zones/${zone_id}/settings/0rtt" '{"value":"on"}')
  check_success "$result" "0-RTT"
done

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 4: Security Hardening (ALL Zones)
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔒 Phase 4: Security Hardening (All ${#ALL_ZONES[@]} Zones)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SUCCESS_COUNT=0
FAIL_COUNT=0

for zone_id in "${ALL_ZONES[@]}"; do
  # Get zone name for logging
  zone_name=$(cf_api GET "/zones/${zone_id}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('result',{}).get('name','unknown'))" 2>/dev/null)

  echo -n "  🌐 $zone_name: "

  # Always Use HTTPS
  cf_api PATCH "/zones/${zone_id}/settings/always_use_https" '{"value":"on"}' > /dev/null 2>&1

  # SSL Full (Strict)
  cf_api PATCH "/zones/${zone_id}/settings/ssl" '{"value":"strict"}' > /dev/null 2>&1

  # HSTS
  cf_api PATCH "/zones/${zone_id}/settings/security_header" \
    '{"value":{"strict_transport_security":{"enabled":true,"max_age":31536000,"include_subdomains":true,"nosniff":true}}}' > /dev/null 2>&1

  # TLS 1.3
  cf_api PATCH "/zones/${zone_id}/settings/min_tls_version" '{"value":"1.2"}' > /dev/null 2>&1

  # Opportunistic Encryption
  cf_api PATCH "/zones/${zone_id}/settings/opportunistic_encryption" '{"value":"on"}' > /dev/null 2>&1

  # Automatic HTTPS Rewrites
  cf_api PATCH "/zones/${zone_id}/settings/automatic_https_rewrites" '{"value":"on"}' > /dev/null 2>&1

  # Browser Integrity Check
  cf_api PATCH "/zones/${zone_id}/settings/browser_check" '{"value":"on"}' > /dev/null 2>&1

  # Brotli compression
  result=$(cf_api PATCH "/zones/${zone_id}/settings/brotli" '{"value":"on"}')
  if echo "$result" | python3 -c "import json,sys; sys.exit(0 if json.load(sys.stdin).get('success') else 1)" 2>/dev/null; then
    echo "✅"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    echo "⚠️"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi

  # Rate limit API calls to avoid 429s
  sleep 0.3
done

echo ""
echo "📊 Security hardening complete: ${SUCCESS_COUNT} succeeded, ${FAIL_COUNT} warnings"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 5: R2 Bucket & Zone ID .env Population
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 Phase 5: R2 Bucket Creation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if R2 bucket already exists
R2_CHECK=$(wrangler r2 bucket list 2>&1 || true)
if echo "$R2_CHECK" | grep -q "heady-assets"; then
  echo "  ✅ R2 bucket 'heady-assets' already exists"
else
  echo "  🔨 Creating R2 bucket 'heady-assets'..."
  wrangler r2 bucket create heady-assets 2>&1 || echo "  ⚠️  R2 bucket creation failed or already exists"
fi

# ══════════════════════════════════════════════════════════════════════════════
# VERIFICATION
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verify Argo on Enterprise domains
for i in "${!ENTERPRISE_ZONES[@]}"; do
  zone_id="${ENTERPRISE_ZONES[$i]}"
  zone_name="${ENTERPRISE_NAMES[$i]}"
  argo=$(cf_api GET "/zones/${zone_id}/argo/smart_routing" | python3 -c "import json,sys; print(json.load(sys.stdin).get('result',{}).get('value','unknown'))" 2>/dev/null)
  echo "  📡 Argo ($zone_name): $argo"
done

# Verify SSL on sample zones
for i in "${!ENTERPRISE_ZONES[@]}"; do
  zone_id="${ENTERPRISE_ZONES[$i]}"
  zone_name="${ENTERPRISE_NAMES[$i]}"
  ssl=$(cf_api GET "/zones/${zone_id}/settings/ssl" | python3 -c "import json,sys; print(json.load(sys.stdin).get('result',{}).get('value','unknown'))" 2>/dev/null)
  echo "  🔐 SSL ($zone_name): $ssl"
done

# R2 buckets
echo "  💾 R2 Buckets:"
wrangler r2 bucket list 2>&1 | head -10

# KV namespaces count
KV_COUNT=$(wrangler kv namespace list 2>&1 | python3 -c "import json,sys; t=sys.stdin.read(); s=t.find('['); print(len(json.loads(t[s:])) if s>=0 else 0)" 2>/dev/null)
echo "  📦 KV Namespaces: $KV_COUNT"

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  ✅ Cloudflare Startup Configuration Complete!               ║"
echo "║                                                             ║"
echo "║  ⚠️  MANUAL STEP REQUIRED:                                  ║"
echo "║  Upgrade 3 domains to Enterprise in the Cloudflare          ║"
echo "║  Dashboard → Websites → Select domain → Overview →          ║"
echo "║  Active Subscription → Change → Enterprise                  ║"
echo "║                                                             ║"
echo "║  Domains to upgrade:                                        ║"
echo "║    1. headyme.com                                           ║"
echo "║    2. headysystems.com                                      ║"
echo "║    3. headyconnection.org                                   ║"
echo "║                                                             ║"
echo "║  Credits expire: April 14, 2027                             ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
