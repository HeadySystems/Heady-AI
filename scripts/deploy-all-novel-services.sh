#!/bin/bash
# © 2026 Heady™ Systems Inc.
# Deploy all 43 novel services to Google Cloud Run
# Usage: bash scripts/deploy-all-novel-services.sh [PROJECT_ID] [REGION]

set -e

PROJECT="${1:-gen-lang-client-0920560496}"
REGION="${2:-us-central1}"

echo "🐝 Heady Novel Services Mass Deployer"
echo "   Project: $PROJECT"
echo "   Region:  $REGION"
echo ""

# All 43 novel services
SERVICES=(
  sacred-geometry-mcp heady-cron heady-watch consciousness-dashboard buddy-evolution
  dream-journal-mcp habit-formation-mcp emotional-intelligence-mcp heady-guild heady-quest
  heady-lint heady-bridge heady-collab
  heady-pipeline-builder pheromone-trails parallel-universe time-machine golden-spiral-ui wallpaper-generator
  heady-migrate heady-test heady-doc heady-perf heady-recipe code-archaeology
  heady-mentor heady-showcase ar-spatial-mcp contextual-nudge collective-memory
  knowledge-graph thought-debugger decision-matrix
  swarm-optimizer prompt-alchemist context-weaver semantic-compass resonance-engine
  csl-validator heady-sync heady-scope heady-forge heady-pulse
)

gcloud config set project "$PROJECT" 2>/dev/null

TOTAL=${#SERVICES[@]}
SUCCESS=0
FAILED=0
URLS=()

echo "Deploying $TOTAL services..."
echo ""

for i in "${!SERVICES[@]}"; do
  svc="${SERVICES[$i]}"
  num=$((i + 1))
  echo "[$num/$TOTAL] 🚀 Deploying $svc..."

  if gcloud run deploy "$svc" \
    --source "services/$svc" \
    --region "$REGION" \
    --allow-unauthenticated \
    --memory 256Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 3 \
    --port 8080 \
    --quiet 2>&1; then
    URL=$(gcloud run services describe "$svc" --region "$REGION" --format="value(status.url)" 2>/dev/null)
    URLS+=("$svc: $URL")
    echo "  ✅ $svc → $URL"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "  ❌ $svc FAILED"
    FAILED=$((FAILED + 1))
  fi
  echo ""
done

echo "============================================"
echo "🐝 Deployment Complete"
echo "   ✅ Success: $SUCCESS/$TOTAL"
echo "   ❌ Failed:  $FAILED/$TOTAL"
echo ""
echo "=== Live URLs ==="
for url in "${URLS[@]}"; do
  echo "  $url"
done
echo "============================================"
