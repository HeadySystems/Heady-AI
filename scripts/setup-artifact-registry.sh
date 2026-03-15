#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
#  HEADY™ Artifact Registry + Cloud Build Setup
#  One-shot script to configure GCP container pipeline
#
#  Prerequisites:
#    1. gcloud auth login  (run this first if tokens expired)
#    2. $250 GCP credits or billing linked
#
#  Usage:
#    ./scripts/setup-artifact-registry.sh [--project PROJECT_ID]
#
#  © 2026 Heady™Systems Inc. All rights reserved.
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────
PROJECT_ID="${1:-heady-production}"
REGION="us-central1"
REPO_NAME="heady-docker-repo"
REPO_DESCRIPTION="Heady production Docker images — private Artifact Registry"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log() { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
step() { echo -e "\n${CYAN}→${NC} ${BOLD}$*${NC}"; }
fail() { echo -e "${RED}✗${NC} $*"; exit 1; }

echo -e "\n${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e " ${BOLD}HEADY™ Artifact Registry Setup${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}\n"

# ─── Step 0: Verify gcloud auth ──────────────────────────────────
step "Verifying gcloud authentication..."
if ! gcloud auth print-access-token &>/dev/null; then
  fail "gcloud auth expired. Run: gcloud auth login"
fi
ACCOUNT=$(gcloud config get-value account 2>/dev/null)
log "Authenticated as: $ACCOUNT"

# ─── Step 1: Create or select project ────────────────────────────
step "Setting up GCP project: ${PROJECT_ID}..."

if gcloud projects describe "$PROJECT_ID" &>/dev/null; then
  log "Project '$PROJECT_ID' already exists"
else
  warn "Project '$PROJECT_ID' not found. Creating..."
  gcloud projects create "$PROJECT_ID" --name="Heady Production" --set-as-default
  log "Created project: $PROJECT_ID"

  # Link billing
  BILLING_ACCOUNT=$(gcloud billing accounts list --filter="open=true" --format="value(name)" --limit=1)
  if [[ -n "$BILLING_ACCOUNT" ]]; then
    gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"
    log "Linked billing account: $BILLING_ACCOUNT"
  else
    warn "No billing account found. Link one manually:"
    echo "  gcloud billing projects link $PROJECT_ID --billing-account=ACCOUNT_ID"
  fi
fi

gcloud config set project "$PROJECT_ID" 2>/dev/null
log "Active project: $PROJECT_ID"

# ─── Step 2: Enable required APIs ────────────────────────────────
step "Enabling required APIs..."
APIS=(
  "artifactregistry.googleapis.com"
  "cloudbuild.googleapis.com"
  "run.googleapis.com"
  "containerscanning.googleapis.com"
  "secretmanager.googleapis.com"
  "iam.googleapis.com"
)

for api in "${APIS[@]}"; do
  if gcloud services list --enabled --filter="name:$api" --format="value(name)" 2>/dev/null | grep -q "$api"; then
    log "Already enabled: $api"
  else
    gcloud services enable "$api" --quiet
    log "Enabled: $api"
  fi
done

# ─── Step 3: Create Artifact Registry repo ───────────────────────
step "Creating Artifact Registry Docker repo: ${REPO_NAME}..."

if gcloud artifacts repositories describe "$REPO_NAME" \
    --location="$REGION" --format="value(name)" &>/dev/null; then
  log "Repository '$REPO_NAME' already exists in $REGION"
else
  gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --description="$REPO_DESCRIPTION" \
    --immutable-tags \
    --async=false
  log "Created: ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}"
fi

# ─── Step 4: Configure Docker credential helper ──────────────────
step "Configuring Docker credential helper for Artifact Registry..."

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
log "Docker configured for: ${REGION}-docker.pkg.dev"

# Also configure us-docker.pkg.dev for multi-region pulls
gcloud auth configure-docker "us-docker.pkg.dev" --quiet 2>/dev/null || true
log "Docker configured for: us-docker.pkg.dev"

# ─── Step 5: Grant Cloud Build → Cloud Run permissions ───────────
step "Granting Cloud Build service account deploy permissions..."

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

# Cloud Build → Cloud Run deployer
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/run.admin" \
  --quiet &>/dev/null || true

# Cloud Build → act as service account (for Cloud Run)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/iam.serviceAccountUser" \
  --quiet &>/dev/null || true

# Cloud Build → push to Artifact Registry
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/artifactregistry.writer" \
  --quiet &>/dev/null || true

# Cloud Build → read secrets
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet &>/dev/null || true

log "Cloud Build SA permissions configured: ${CLOUD_BUILD_SA}"

# ─── Step 6: Verify setup ────────────────────────────────────────
step "Verifying setup..."

echo ""
echo -e "${BOLD}Registry:${NC}      ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}"
echo -e "${BOLD}Project:${NC}       ${PROJECT_ID}"
echo -e "${BOLD}Region:${NC}        ${REGION}"
echo -e "${BOLD}Cloud Build:${NC}   ${CLOUD_BUILD_SA}"
echo ""

# List repos
gcloud artifacts repositories list --location="$REGION" \
  --format="table(name, format, sizeBytes)" 2>/dev/null || true

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e " ${BOLD}Setup Complete!${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "Build + push an image:"
echo -e "  ${CYAN}docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/heady-manager:latest -f Dockerfile.production .${NC}"
echo -e "  ${CYAN}docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/heady-manager:latest${NC}"
echo ""
echo -e "Or trigger Cloud Build:"
echo -e "  ${CYAN}gcloud builds submit --config cloudbuild.yaml --substitutions=_PROJECT_ID=${PROJECT_ID}${NC}"
echo ""
