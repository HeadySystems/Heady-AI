#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ Provider Separation — 03 Firebase Setup                    ║
# ║  Creates heady-rebuild Firebase project mirroring heady-ai:        ║
# ║   • Firebase project on top of heady-rebuild GCP project           ║
# ║   • Enables Auth + Hosting + Firestore                             ║
# ║   • Mirrors OAuth providers from legacy (manual step — listed)     ║
# ║   • Generates Web App and writes config to Secret Manager          ║
# ║   • Creates .firebaserc for rebuild branch                         ║
# ║                                                                    ║
# ║  Prerequisites:                                                    ║
# ║    firebase login                                                  ║
# ║    export LEGACY_GCP_PROJECT=heady-ai  (legacy Firebase project)   ║
# ║    export REBUILD_GCP_PROJECT=heady-rebuild                        ║
# ╚══════════════════════════════════════════════════════════════════╝
set -euo pipefail

LEGACY="${LEGACY_GCP_PROJECT:?Set LEGACY_GCP_PROJECT}"
REBUILD="${REBUILD_GCP_PROJECT:?Set REBUILD_GCP_PROJECT}"
REBUILD_GCP="${REBUILD_GCP_PROJECT}"

log() { echo -e "\n\033[1;34m▶  $*\033[0m"; }
ok()  { echo -e "\033[0;32m✓  $*\033[0m"; }
warn(){ echo -e "\033[1;33m⚠  $*\033[0m"; }

# ── 1. Add Firebase to the rebuild GCP project ──────────────────────
log "Adding Firebase to GCP project: ${REBUILD}"
# This is idempotent — safe to re-run
firebase projects:addfirebase "$REBUILD" || {
  # If it fails it may already be a Firebase project
  EXISTING=$(firebase projects:list --json 2>/dev/null \
    | jq -r ".[] | select(.projectId == \"${REBUILD}\") | .projectId" 2>/dev/null || echo "")
  if [ "$EXISTING" = "$REBUILD" ]; then
    ok "Firebase already enabled on ${REBUILD}"
  else
    echo "  Failed to add Firebase to ${REBUILD}."
    echo "  Manual: firebase projects:addfirebase ${REBUILD}"
    exit 1
  fi
}
ok "Firebase enabled on ${REBUILD}"

# ── 2. Register a web app ────────────────────────────────────────────
log "Registering web app on ${REBUILD}"
EXISTING_APP=$(firebase apps:list WEB --project "$REBUILD" --json 2>/dev/null \
  | jq -r '.[0].appId' 2>/dev/null || echo "")

if [ -z "$EXISTING_APP" ] || [ "$EXISTING_APP" = "null" ]; then
  firebase apps:create WEB "HeadyKey Rebuild" --project "$REBUILD"
  EXISTING_APP=$(firebase apps:list WEB --project "$REBUILD" --json 2>/dev/null \
    | jq -r '.[0].appId' 2>/dev/null)
  ok "Web app registered: ${EXISTING_APP}"
else
  ok "Web app already exists: ${EXISTING_APP}"
fi

# ── 3. Fetch SDK config ──────────────────────────────────────────────
log "Fetching Firebase SDK config for ${REBUILD}"
SDK_CONFIG=$(firebase apps:sdkconfig WEB "$EXISTING_APP" --project "$REBUILD" --json 2>/dev/null)

FIREBASE_API_KEY=$(echo "$SDK_CONFIG"      | jq -r '.sdkConfig.apiKey')
FIREBASE_AUTH_DOMAIN=$(echo "$SDK_CONFIG"  | jq -r '.sdkConfig.authDomain')
FIREBASE_PROJECT_ID=$(echo "$SDK_CONFIG"   | jq -r '.sdkConfig.projectId')
FIREBASE_STORAGE=$(echo "$SDK_CONFIG"      | jq -r '.sdkConfig.storageBucket')
FIREBASE_MSG_ID=$(echo "$SDK_CONFIG"       | jq -r '.sdkConfig.messagingSenderId')
FIREBASE_APP_ID=$(echo "$SDK_CONFIG"       | jq -r '.sdkConfig.appId')

ok "SDK config fetched"
echo "  projectId: ${FIREBASE_PROJECT_ID}"
echo "  authDomain: ${FIREBASE_AUTH_DOMAIN}"

# ── 4. Enable Auth, Hosting, Firestore ──────────────────────────────
log "Enabling Firebase services on ${REBUILD}"
gcloud services enable \
  identitytoolkit.googleapis.com \
  firestore.googleapis.com \
  firebasehosting.googleapis.com \
  --project="$REBUILD" --quiet
ok "Firebase services enabled"

# ── 5. Write Firebase config to Secret Manager ───────────────────────
log "Writing Firebase secrets to GCP Secret Manager (${REBUILD})"

write_secret() {
  local name="$1" value="$2"
  echo -n "$value" | gcloud secrets versions add "$name" \
    --project="$REBUILD_GCP" --data-file=- 2>/dev/null \
    || echo -n "$value" | gcloud secrets create "$name" \
         --project="$REBUILD_GCP" --data-file=- \
         --replication-policy=automatic --labels=env=rebuild
  ok "Secret ${name} written"
}

write_secret "FIREBASE_PROJECT_ID"      "$FIREBASE_PROJECT_ID"
write_secret "FIREBASE_API_KEY"         "$FIREBASE_API_KEY"
write_secret "FIREBASE_AUTH_DOMAIN"     "$FIREBASE_AUTH_DOMAIN"
write_secret "FIREBASE_STORAGE_BUCKET"  "$FIREBASE_STORAGE"
write_secret "FIREBASE_MSG_SENDER_ID"   "$FIREBASE_MSG_ID"
write_secret "FIREBASE_APP_ID"          "$EXISTING_APP"

# ── 6. Create firebase.json + .firebaserc for rebuild ────────────────
log "Writing firebase.json and .firebaserc for rebuild deployment"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORTAL_DIR="${SCRIPT_DIR}/apps/headyme-portal"

if [ -d "$PORTAL_DIR" ]; then
  # .firebaserc — pointing to rebuild project
  cat > "${PORTAL_DIR}/.firebaserc" <<FIREBASERC
{
  "projects": {
    "default": "${REBUILD}",
    "legacy": "${LEGACY}"
  }
}
FIREBASERC
  ok "Updated ${PORTAL_DIR}/.firebaserc"

  # firebase.json — if not already present
  if [ ! -f "${PORTAL_DIR}/firebase.json" ]; then
    cat > "${PORTAL_DIR}/firebase.json" <<FIREBASEJSON
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ],
    "headers": [
      {
        "source": "**/*.js",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      }
    ]
  }
}
FIREBASEJSON
    ok "Created firebase.json"
  fi
fi

# ── 7. OAuth providers — manual step list ────────────────────────────
echo ""
warn "OAuth Providers require manual setup in Firebase Console:"
echo "  The legacy project (${LEGACY}) has 27+ providers configured."
echo "  The rebuild project (${REBUILD}) needs them mirrored."
echo ""
echo "  Firebase Console → ${REBUILD} → Authentication → Sign-in method:"
echo ""
echo "  REQUIRED for HeadyKey rebuild:"
echo "    ✎  Email/Password"
echo "    ✎  Google          (re-use same OAuth client or create new)"
echo "    ✎  GitHub          (re-use same OAuth app or create new)"
echo "    ✎  Microsoft       (Azure AD app)"
echo ""
echo "  Additional providers — mirror from legacy as needed:"
echo "    https://console.firebase.google.com/project/${LEGACY}/authentication/providers"
echo "    https://console.firebase.google.com/project/${REBUILD}/authentication/providers"
echo ""
echo "  Authorized domains to add in ${REBUILD}:"
echo "    headykey.com"
echo "    headyme.com"
echo "    headysystems.com"
echo "    localhost (dev only)"
echo ""

# ── 8. Output SDK config for HeadyKey deploy ────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Firebase Setup Complete — ${REBUILD}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  SDK config (needed for 05-headykey-deploy.sh):"
echo "  ------------------------------------------------"
cat <<SDKOUT
  apiKey:            "${FIREBASE_API_KEY}"
  authDomain:        "${FIREBASE_AUTH_DOMAIN}"
  projectId:         "${FIREBASE_PROJECT_ID}"
  storageBucket:     "${FIREBASE_STORAGE}"
  messagingSenderId: "${FIREBASE_MSG_ID}"
  appId:             "${EXISTING_APP}"
SDKOUT
echo ""
echo "  Console: https://console.firebase.google.com/project/${REBUILD}"
echo ""
echo "  Next: bash 04-cloudflare-setup.sh"
