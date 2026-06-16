#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ deploy — codeflow API (Cloud Run) + portal (Firebase Host) ║
# ║  Idempotent. Reads project from facts; regenerates status first.    ║
# ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
# ╚══════════════════════════════════════════════════════════════════╝
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"
PROJECT="${GCP_PROJECT:-heady-ai}"
REGION="${RUN_REGION:-us-central1}"
SERVICE="heady-codeflow"
log() { printf '{"t":"deploy","level":"info","msg":"%s"}\n' "$1"; }

case "${1:-all}" in
  api|all)
    log "refreshing status snapshots for the image"
    node tooling/coherence/src/coherence.mjs all || true
    node tooling/decomposition/src/decompose.mjs >/dev/null 2>&1 || true
    log "deploying codeflow API → Cloud Run (${SERVICE}, ${REGION})"
    gcloud run deploy "$SERVICE" \
      --source . \
      --project "$PROJECT" \
      --region "$REGION" \
      --dockerfile packages/codeflow/Dockerfile \
      --allow-unauthenticated \
      --min-instances 0 --max-instances 13 \
      --set-env-vars "FIREBASE_PROJECT_ID=${PROJECT},CODEFLOW_ORIGIN=${PORTAL_ORIGIN:-*}" \
      --quiet
    ;;&
  portal|all)
    log "building portal"
    ( cd apps/headyme-portal && (pnpm install || true) && node_modules/.bin/vite build )
    log "deploying portal → Firebase Hosting (requires: firebase login)"
    firebase deploy --only hosting --project "$PROJECT"
    ;;
esac
log "done"
