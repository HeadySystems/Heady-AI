#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ Provider Separation — 05 HeadyKey Deploy                   ║
# ║  Deploys two live HeadyKey auth UI instances:                      ║
# ║   • Legacy:  headykey-legacy.pages.dev  → Firebase: heady-ai       ║
# ║   • Rebuild: headykey-rebuild.pages.dev → Firebase: heady-rebuild  ║
# ║                                                                    ║
# ║  HeadyKey is a static HTML auth UI — no build step needed.         ║
# ║  The deploy patches the Firebase config inline and pushes to       ║
# ║  Cloudflare Pages via wrangler pages deploy.                       ║
# ║                                                                    ║
# ║  Prerequisites:                                                    ║
# ║    wrangler login                                                  ║
# ║    03-firebase-setup.sh completed (rebuild Firebase project ready) ║
# ║    export REBUILD_GCP_PROJECT=heady-rebuild                        ║
# ╚══════════════════════════════════════════════════════════════════╝
set -euo pipefail

REBUILD_GCP="${REBUILD_GCP_PROJECT:?Set REBUILD_GCP_PROJECT}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="/tmp/headykey-deploy-$$"

log() { echo -e "\n\033[1;34m▶  $*\033[0m"; }
ok()  { echo -e "\033[0;32m✓  $*\033[0m"; }

cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

mkdir -p "$WORK_DIR/legacy" "$WORK_DIR/rebuild"

# ── 1. Pull source from headykey-com repo ────────────────────────────
log "Cloning headykey-com source"
git clone --depth=1 --quiet \
  https://github.com/HeadyAI/headykey-com.git \
  "$WORK_DIR/source"
ok "Source cloned"

# ── 2. Fetch rebuild Firebase config from Secret Manager ─────────────
log "Fetching rebuild Firebase config"
REBUILD_API_KEY=$(gcloud secrets versions access latest \
  --secret=FIREBASE_API_KEY --project="$REBUILD_GCP" 2>/dev/null || echo "")
REBUILD_AUTH_DOMAIN=$(gcloud secrets versions access latest \
  --secret=FIREBASE_AUTH_DOMAIN --project="$REBUILD_GCP" 2>/dev/null || echo "")
REBUILD_PROJECT_ID=$(gcloud secrets versions access latest \
  --secret=FIREBASE_PROJECT_ID --project="$REBUILD_GCP" 2>/dev/null || echo "")
REBUILD_MSG_ID=$(gcloud secrets versions access latest \
  --secret=FIREBASE_MSG_SENDER_ID --project="$REBUILD_GCP" 2>/dev/null || echo "")
REBUILD_APP_ID=$(gcloud secrets versions access latest \
  --secret=FIREBASE_APP_ID --project="$REBUILD_GCP" 2>/dev/null || echo "")
REBUILD_STORAGE="${REBUILD_PROJECT_ID}.firebasestorage.app"

if [ -z "$REBUILD_API_KEY" ] || [ "$REBUILD_API_KEY" = "PLACEHOLDER_REPLACE_ME" ]; then
  echo "  ✗  Firebase rebuild secrets not yet populated."
  echo "     Run 03-firebase-setup.sh first, then re-run this script."
  exit 1
fi
ok "Rebuild Firebase config retrieved"

# ── 3. Legacy copy — unchanged source ────────────────────────────────
log "Preparing legacy deploy (unmodified source → headykey-legacy)"
cp -r "$WORK_DIR/source/." "$WORK_DIR/legacy/"

# ── 4. Rebuild copy — patch Firebase config ──────────────────────────
log "Preparing rebuild deploy (patching Firebase config)"
cp -r "$WORK_DIR/source/." "$WORK_DIR/rebuild/"

# Patch auth/index.html — replace the legacy Firebase config block
AUTH_FILE="$WORK_DIR/rebuild/auth/index.html"
if [ -f "$AUTH_FILE" ]; then
  # Use Python for reliable multi-line replacement (avoiding sed edge cases)
  python3 - "$AUTH_FILE" \
    "$REBUILD_API_KEY" "$REBUILD_AUTH_DOMAIN" "$REBUILD_PROJECT_ID" \
    "$REBUILD_STORAGE" "$REBUILD_MSG_ID" "$REBUILD_APP_ID" <<'PYEOF'
import sys, re

auth_file = sys.argv[1]
api_key, auth_domain, project_id, storage, msg_id, app_id = sys.argv[2:]

with open(auth_file, 'r') as f:
    content = f.read()

new_config = f"""const firebaseConfig = {{
  apiKey:            "{api_key}",
  authDomain:        "{auth_domain}",
  projectId:         "{project_id}",
  storageBucket:     "{storage}",
  messagingSenderId: "{msg_id}",
  appId:             "{app_id}"
}};"""

# Replace the existing firebaseConfig block
content = re.sub(
    r'const firebaseConfig\s*=\s*\{[^}]+\};',
    new_config,
    content,
    flags=re.DOTALL
)

# Update frame-src in CSP to allow rebuild auth domain
content = content.replace(
    'gen-lang-client-0920560496.firebaseapp.com',
    auth_domain
)

with open(auth_file, 'w') as f:
    f.write(content)

print(f"Patched {auth_file}")
PYEOF
  ok "auth/index.html patched with rebuild Firebase config"
else
  echo "  ⚠  auth/index.html not found in source — skipping patch"
fi

# Patch index.html if it also has Firebase config
INDEX_FILE="$WORK_DIR/rebuild/index.html"
if grep -q "firebaseConfig\|firebase" "$INDEX_FILE" 2>/dev/null; then
  python3 - "$INDEX_FILE" \
    "$REBUILD_API_KEY" "$REBUILD_AUTH_DOMAIN" "$REBUILD_PROJECT_ID" \
    "$REBUILD_STORAGE" "$REBUILD_MSG_ID" "$REBUILD_APP_ID" <<'PYEOF'
import sys, re
auth_file = sys.argv[1]
api_key, auth_domain, project_id, storage, msg_id, app_id = sys.argv[2:]
with open(auth_file, 'r') as f:
    content = f.read()
new_config = f"""const firebaseConfig = {{
  apiKey:            "{api_key}",
  authDomain:        "{auth_domain}",
  projectId:         "{project_id}",
  storageBucket:     "{storage}",
  messagingSenderId: "{msg_id}",
  appId:             "{app_id}"
}};"""
content = re.sub(r'const firebaseConfig\s*=\s*\{[^}]+\};', new_config, content, flags=re.DOTALL)
content = content.replace('gen-lang-client-0920560496.firebaseapp.com', auth_domain)
with open(auth_file, 'w') as f:
    f.write(content)
print(f"Patched {auth_file}")
PYEOF
  ok "index.html patched"
fi

# Add environment indicator to the rebuild deploy
echo "rebuild" > "$WORK_DIR/rebuild/ENVIRONMENT"
echo "$REBUILD_PROJECT_ID" > "$WORK_DIR/rebuild/FIREBASE_PROJECT"

# ── 5. Deploy legacy to Cloudflare Pages ─────────────────────────────
log "Deploying HeadyKey LEGACY → headykey-legacy.pages.dev"
# Create the project if it doesn't exist
if ! wrangler pages project list 2>/dev/null | grep -q "headykey-legacy"; then
  wrangler pages project create headykey-legacy --production-branch main
  ok "Created Pages project: headykey-legacy"
fi

wrangler pages deploy "$WORK_DIR/legacy" \
  --project-name headykey-legacy \
  --branch main \
  --commit-message "HeadyKey legacy deploy (Firebase: heady-ai)"
ok "Legacy deployed → https://headykey-legacy.pages.dev"

# ── 6. Deploy rebuild to Cloudflare Pages ────────────────────────────
log "Deploying HeadyKey REBUILD → headykey-rebuild.pages.dev"
wrangler pages deploy "$WORK_DIR/rebuild" \
  --project-name headykey-rebuild \
  --branch main \
  --commit-message "HeadyKey rebuild deploy (Firebase: ${REBUILD_PROJECT_ID})"
ok "Rebuild deployed → https://headykey-rebuild.pages.dev"

# ── 7. Smoke test both deployments ───────────────────────────────────
log "Smoke testing both deployments"
sleep 5  # give CF Pages a moment to propagate

for url in \
  "https://headykey-legacy.pages.dev" \
  "https://headykey-legacy.pages.dev/auth/" \
  "https://headykey-rebuild.pages.dev" \
  "https://headykey-rebuild.pages.dev/auth/"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    ok "HTTP 200  ${url}"
  else
    echo "  ⚠  HTTP ${STATUS}  ${url}"
  fi
done

# ── 8. Output summary ────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  HeadyKey Deploy Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Legacy  (Firebase: heady-ai)"
echo "    → https://headykey-legacy.pages.dev"
echo "    → https://headykey-legacy.pages.dev/auth/"
echo ""
echo "  Rebuild (Firebase: ${REBUILD_PROJECT_ID})"
echo "    → https://headykey-rebuild.pages.dev"
echo "    → https://headykey-rebuild.pages.dev/auth/"
echo ""
echo "  Custom domain mapping (Cloudflare dashboard):"
echo "    headykey.com/auth  →  headykey-legacy.pages.dev"
echo "    rebuild.headykey.com/auth  →  headykey-rebuild.pages.dev"
echo "    (or use a feature flag in your edge Worker to route by ENVIRONMENT)"
echo ""
echo "  Next: bash 06-headyvault-seed.sh"
