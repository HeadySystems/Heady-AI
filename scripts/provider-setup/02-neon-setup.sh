#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ Provider Separation — 02 Neon Setup                        ║
# ║  Creates heady-rebuild Neon project mirroring heady-production:    ║
# ║   • New Neon project: heady-rebuild                                ║
# ║   • pgvector + uuid-ossp extensions                               ║
# ║   • Initial migration from packages/db/migrations/0001_init.sql    ║
# ║   • Dev branches: dev/legacy and dev/rebuild                       ║
# ║   • Writes DATABASE_URL to GCP Secret Manager for both envs        ║
# ║                                                                    ║
# ║  Prerequisites:                                                    ║
# ║    neonctl auth                                                    ║
# ║    export LEGACY_GCP_PROJECT=heady-ai                              ║
# ║    export REBUILD_GCP_PROJECT=heady-rebuild                        ║
# ║    export LEGACY_NEON_PROJECT_ID=<id from: neonctl projects list>  ║
# ╚══════════════════════════════════════════════════════════════════╝
set -euo pipefail

LEGACY_GCP="${LEGACY_GCP_PROJECT:?Set LEGACY_GCP_PROJECT}"
REBUILD_GCP="${REBUILD_GCP_PROJECT:?Set REBUILD_GCP_PROJECT}"
LEGACY_NEON="${LEGACY_NEON_PROJECT_ID:-}"   # optional; used to create dev branch on legacy
REGION="${NEON_REGION:-aws-us-east-2}"       # Neon region — use: neonctl regions list
REBUILD_PROJECT_NAME="heady-rebuild"

log() { echo -e "\n\033[1;34m▶  $*\033[0m"; }
ok()  { echo -e "\033[0;32m✓  $*\033[0m"; }

# ── 1. Create rebuild Neon project ──────────────────────────────────
log "Creating Neon project: ${REBUILD_PROJECT_NAME}"
EXISTING=$(neonctl projects list --output json 2>/dev/null \
  | jq -r ".[] | select(.name == \"${REBUILD_PROJECT_NAME}\") | .id" 2>/dev/null || echo "")

if [ -n "$EXISTING" ]; then
  REBUILD_PROJECT_ID="$EXISTING"
  ok "Project ${REBUILD_PROJECT_NAME} already exists: ${REBUILD_PROJECT_ID}"
else
  RESULT=$(neonctl projects create \
    --name "$REBUILD_PROJECT_NAME" \
    --region-id "$REGION" \
    --output json)
  REBUILD_PROJECT_ID=$(echo "$RESULT" | jq -r '.id')
  ok "Created Neon project: ${REBUILD_PROJECT_NAME} (${REBUILD_PROJECT_ID})"
fi

# ── 2. Get connection strings ────────────────────────────────────────
log "Fetching connection strings"

REBUILD_DB_URL=$(neonctl connection-string \
  --project-id "$REBUILD_PROJECT_ID" \
  --branch main \
  --database-name neondb \
  --role-name neondb_owner \
  --output plain 2>/dev/null)
ok "Rebuild DATABASE_URL retrieved"

if [ -n "$LEGACY_NEON" ]; then
  LEGACY_DB_URL=$(neonctl connection-string \
    --project-id "$LEGACY_NEON" \
    --branch main \
    --database-name neondb \
    --role-name neondb_owner \
    --output plain 2>/dev/null)
  ok "Legacy DATABASE_URL retrieved"
fi

# ── 3. Run initial migration on rebuild project ──────────────────────
log "Running 0001_init.sql on rebuild project (enables pgvector + creates schema)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="${SCRIPT_DIR}/packages/db/migrations/0001_init.sql"

if [ ! -f "$MIGRATION" ]; then
  echo "  ⚠  Migration file not found at ${MIGRATION}"
  echo "     Clone heady-ai rebuild branch and run from repo root."
  echo "     Manual: psql \"\$DATABASE_URL\" -f packages/db/migrations/0001_init.sql"
else
  psql "$REBUILD_DB_URL" -f "$MIGRATION" -v ON_ERROR_STOP=1
  ok "Migration 0001_init.sql applied to rebuild"
fi

# ── 4. Create dev branches ───────────────────────────────────────────
log "Creating dev branches"

# dev/rebuild on rebuild project
EXISTING_DEV=$(neonctl branches list \
  --project-id "$REBUILD_PROJECT_ID" \
  --output json 2>/dev/null \
  | jq -r '.[] | select(.name == "dev/rebuild") | .id' 2>/dev/null || echo "")

if [ -n "$EXISTING_DEV" ]; then
  ok "Branch dev/rebuild already exists"
else
  neonctl branches create \
    --project-id "$REBUILD_PROJECT_ID" \
    --name "dev/rebuild" \
    --parent main
  ok "Created branch: dev/rebuild on ${REBUILD_PROJECT_NAME}"
fi

# dev/legacy on legacy project (if LEGACY_NEON is set)
if [ -n "$LEGACY_NEON" ]; then
  EXISTING_LEGACY_DEV=$(neonctl branches list \
    --project-id "$LEGACY_NEON" \
    --output json 2>/dev/null \
    | jq -r '.[] | select(.name == "dev/legacy") | .id' 2>/dev/null || echo "")

  if [ -n "$EXISTING_LEGACY_DEV" ]; then
    ok "Branch dev/legacy already exists on legacy project"
  else
    neonctl branches create \
      --project-id "$LEGACY_NEON" \
      --name "dev/legacy" \
      --parent main
    ok "Created branch: dev/legacy on legacy project"
  fi
fi

# ── 5. Write DATABASE_URL to GCP Secret Manager ──────────────────────
log "Writing DATABASE_URL to GCP Secret Manager"

echo -n "$REBUILD_DB_URL" | \
  gcloud secrets versions add DATABASE_URL \
    --project="$REBUILD_GCP" \
    --data-file=-
ok "DATABASE_URL written to ${REBUILD_GCP} Secret Manager"

if [ -n "$LEGACY_NEON" ] && [ -n "${LEGACY_DB_URL:-}" ]; then
  echo -n "$LEGACY_DB_URL" | \
    gcloud secrets versions add DATABASE_URL \
      --project="$LEGACY_GCP" \
      --data-file=-
  ok "DATABASE_URL written to ${LEGACY_GCP} Secret Manager"
fi

# ── 6. Output summary ────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Neon Setup Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Rebuild Neon project ID : ${REBUILD_PROJECT_ID}"
echo "  Rebuild DATABASE_URL    : [written to Secret Manager — not printed]"
echo ""
echo "  Branches:"
echo "    rebuild: main + dev/rebuild"
if [ -n "$LEGACY_NEON" ]; then
  echo "    legacy:  main + dev/legacy"
fi
echo ""
echo "  Neon Console:"
echo "    https://console.neon.tech/app/projects/${REBUILD_PROJECT_ID}"
echo ""
echo "  Next: bash 03-firebase-setup.sh"
