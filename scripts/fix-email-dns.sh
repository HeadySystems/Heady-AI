#!/usr/bin/env bash
# ============================================================
# fix-email-dns.sh — Remove ProtonMail DNS remnants
#
# Cleans SPF, DKIM, DMARC, and verification records for:
#   - headysystems.com
#   - headyconnection.org
#
# Requires: CLOUDFLARE_API_TOKEN in environment or .env
# ============================================================
set -euo pipefail

# Load token from .env if not already set
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  ENV_FILE="${SCRIPT_DIR}/../.env"
  if [[ -f "$ENV_FILE" ]]; then
    CLOUDFLARE_API_TOKEN=$(grep '^CLOUDFLARE_API_TOKEN=' "$ENV_FILE" | cut -d'=' -f2-)
    export CLOUDFLARE_API_TOKEN
  fi
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "ERROR: CLOUDFLARE_API_TOKEN not set"
  exit 1
fi

CF_API="https://api.cloudflare.com/client/v4"
AUTH_HEADER="Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"

# Known zone IDs
ZONE_HEADYSYSTEMS="d71262d0faa509f890fd5fea413c39bc"
ZONE_HEADYME="7153f1efff9af0d91570c1c1be79e241"

# Look up headyconnection.org zone ID
echo "=== Looking up headyconnection.org zone ID ==="
ZONE_HEADYCONNECTION=$(curl -s "${CF_API}/zones?name=headyconnection.org" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  | python3 -c "import sys,json; r=json.load(sys.stdin)['result']; print(r[0]['id'] if r else '')" 2>/dev/null)

if [[ -z "$ZONE_HEADYCONNECTION" ]]; then
  echo "ERROR: Could not find zone for headyconnection.org"
  exit 1
fi
echo "  Zone ID: ${ZONE_HEADYCONNECTION}"

# ────────────────────────────────────────────
# Helper functions
# ────────────────────────────────────────────

list_records() {
  local zone_id=$1
  local type=${2:-}
  local name=${3:-}
  local url="${CF_API}/zones/${zone_id}/dns_records?per_page=100"
  [[ -n "$type" ]] && url="${url}&type=${type}"
  [[ -n "$name" ]] && url="${url}&name=${name}"
  curl -s "$url" -H "$AUTH_HEADER" -H "Content-Type: application/json"
}

delete_record() {
  local zone_id=$1
  local record_id=$2
  local record_name=$3
  echo "  Deleting record: ${record_name} (${record_id})"
  local result
  result=$(curl -s -X DELETE "${CF_API}/zones/${zone_id}/dns_records/${record_id}" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json")
  local success
  success=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null)
  if [[ "$success" == "True" ]]; then
    echo "    ✅ Deleted"
  else
    echo "    ❌ Failed: $(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('errors', []))" 2>/dev/null)"
  fi
}

update_record() {
  local zone_id=$1
  local record_id=$2
  local type=$3
  local name=$4
  local content=$5
  echo "  Updating record: ${name} → ${content}"
  local result
  result=$(curl -s -X PUT "${CF_API}/zones/${zone_id}/dns_records/${record_id}" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"${type}\",\"name\":\"${name}\",\"content\":\"${content}\",\"ttl\":1}")
  local success
  success=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null)
  if [[ "$success" == "True" ]]; then
    echo "    ✅ Updated"
  else
    echo "    ❌ Failed: $(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('errors', []))" 2>/dev/null)"
  fi
}

# ────────────────────────────────────────────
# FIX 1: headysystems.com
# ────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  FIX 1: headysystems.com"
echo "══════════════════════════════════════════"

# 1a. Fix SPF record — remove protonmail include
echo ""
echo "--- Step 1a: Fix SPF record ---"
SPF_RECORDS=$(list_records "$ZONE_HEADYSYSTEMS" "TXT" "headysystems.com")
SPF_ID=$(echo "$SPF_RECORDS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for r in data.get('result', []):
    if 'spf1' in r.get('content', ''):
        print(r['id'])
        break
" 2>/dev/null)

if [[ -n "$SPF_ID" ]]; then
  update_record "$ZONE_HEADYSYSTEMS" "$SPF_ID" "TXT" "headysystems.com" \
    "v=spf1 include:_spf.google.com include:amazonses.com ~all"
else
  echo "  ⚠️  SPF record not found"
fi

# 1b. Remove old ProtonMail DKIM TXT from root (if it's a stale DKIM key at root)
echo ""
echo "--- Step 1b: Check for stale ProtonMail DKIM TXT at root ---"
DKIM_ROOT=$(echo "$SPF_RECORDS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for r in data.get('result', []):
    c = r.get('content', '')
    if 'DKIM1' in c and r.get('name') == 'headysystems.com':
        print(r['id'])
        break
" 2>/dev/null)

if [[ -n "$DKIM_ROOT" ]]; then
  delete_record "$ZONE_HEADYSYSTEMS" "$DKIM_ROOT" "headysystems.com (DKIM TXT at root)"
else
  echo "  ℹ️  No stale DKIM at root (may be Google DKIM — keeping)"
fi

# ────────────────────────────────────────────
# FIX 2: headyconnection.org
# ────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  FIX 2: headyconnection.org"
echo "══════════════════════════════════════════"

# 2a. Fix SPF record
echo ""
echo "--- Step 2a: Fix SPF record ---"
HC_TXT_RECORDS=$(list_records "$ZONE_HEADYCONNECTION" "TXT" "headyconnection.org")
HC_SPF_ID=$(echo "$HC_TXT_RECORDS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for r in data.get('result', []):
    if 'spf1' in r.get('content', ''):
        print(r['id'])
        break
" 2>/dev/null)

if [[ -n "$HC_SPF_ID" ]]; then
  update_record "$ZONE_HEADYCONNECTION" "$HC_SPF_ID" "TXT" "headyconnection.org" \
    "v=spf1 include:_spf.google.com include:amazonses.com ~all"
else
  echo "  ⚠️  SPF record not found"
fi

# 2b. Delete protonmail-verification TXT
echo ""
echo "--- Step 2b: Delete protonmail-verification TXT ---"
PM_VERIFY_ID=$(echo "$HC_TXT_RECORDS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for r in data.get('result', []):
    if 'protonmail-verification' in r.get('content', ''):
        print(r['id'])
        break
" 2>/dev/null)

if [[ -n "$PM_VERIFY_ID" ]]; then
  delete_record "$ZONE_HEADYCONNECTION" "$PM_VERIFY_ID" "protonmail-verification TXT"
else
  echo "  ℹ️  protonmail-verification already removed"
fi

# 2c. Delete ProtonMail DKIM CNAME records
echo ""
echo "--- Step 2c: Delete ProtonMail DKIM CNAMEs ---"
for prefix in protonmail protonmail2 protonmail3; do
  DKIM_NAME="${prefix}._domainkey.headyconnection.org"
  DKIM_RECORDS=$(list_records "$ZONE_HEADYCONNECTION" "CNAME" "$DKIM_NAME")
  DKIM_ID=$(echo "$DKIM_RECORDS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for r in data.get('result', []):
    if r.get('name') == '${DKIM_NAME}':
        print(r['id'])
        break
" 2>/dev/null)
  
  if [[ -n "$DKIM_ID" ]]; then
    delete_record "$ZONE_HEADYCONNECTION" "$DKIM_ID" "$DKIM_NAME"
  else
    echo "  ℹ️  ${DKIM_NAME} already removed"
  fi
done

# 2d. Fix duplicate DMARC — delete the older p=quarantine one
echo ""
echo "--- Step 2d: Fix duplicate DMARC ---"
DMARC_RECORDS=$(list_records "$ZONE_HEADYCONNECTION" "TXT" "_dmarc.headyconnection.org")
OLD_DMARC_ID=$(echo "$DMARC_RECORDS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for r in data.get('result', []):
    if 'p=quarantine' in r.get('content', ''):
        print(r['id'])
        break
" 2>/dev/null)

if [[ -n "$OLD_DMARC_ID" ]]; then
  delete_record "$ZONE_HEADYCONNECTION" "$OLD_DMARC_ID" "_dmarc (p=quarantine — old)"
else
  echo "  ℹ️  No duplicate DMARC found"
fi

# ────────────────────────────────────────────
# SUMMARY
# ────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  ALL DONE — Verify with:"
echo "══════════════════════════════════════════"
echo ""
echo "  dig TXT headysystems.com +short | grep spf"
echo "  dig TXT headyconnection.org +short | grep spf"
echo "  dig TXT headyconnection.org +short | grep protonmail"
echo "  dig CNAME protonmail._domainkey.headyconnection.org +short"
echo "  dig TXT _dmarc.headyconnection.org +short"
echo ""
