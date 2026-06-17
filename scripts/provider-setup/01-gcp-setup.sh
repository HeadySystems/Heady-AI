#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ Provider Separation — 01 GCP Setup                         ║
# ║  Creates heady-rebuild GCP project mirroring heady-production:     ║
# ║   • GCP project                                                    ║
# ║   • Secret Manager API enabled                                     ║
# ║   • Cloud Run API enabled                                          ║
# ║   • Artifact Registry repo (Docker)                                ║
# ║   • Service account for Cloud Run                                  ║
# ║   • Workload Identity / keyless OIDC for GitHub Actions            ║
# ║   • Empty secret stubs (all SECRETS registry keys)                 ║
# ║                                                                    ║
# ║  Prerequisites:                                                    ║
# ║    gcloud auth login && gcloud auth application-default login      ║
# ║    export LEGACY_GCP_PROJECT=heady-ai   (or heady-production)      ║
# ║    export REBUILD_GCP_PROJECT=heady-rebuild                        ║
# ║    export BILLING_ACCOUNT_ID=XXXXXX-XXXXXX-XXXXXX  (gcloud beta    ║
# ║      billing accounts list)                                        ║
# ╚══════════════════════════════════════════════════════════════════╝
set -euo pipefail

LEGACY="${LEGACY_GCP_PROJECT:?Set LEGACY_GCP_PROJECT}"
REBUILD="${REBUILD_GCP_PROJECT:?Set REBUILD_GCP_PROJECT}"
BILLING="${BILLING_ACCOUNT_ID:-}"      # optional; skipped if unset
REGION="${GCP_REGION:-us-central1}"
GITHUB_ORG="${GITHUB_ORG:-HeadySystems}"
GITHUB_REPO="${GITHUB_REPO:-heady-ai}"

# Service account names (identical pattern in both projects)
SA_NAME="heady-cloud-run-runner"
SA_EMAIL_REBUILD="${SA_NAME}@${REBUILD}.iam.gserviceaccount.com"

log() { echo -e "\n\033[1;34m▶  $*\033[0m"; }
ok()  { echo -e "\033[0;32m✓  $*\033[0m"; }

# ── 1. Create rebuild project ───────────────────────────────────────
log "Creating GCP project: ${REBUILD}"
if gcloud projects describe "$REBUILD" &>/dev/null; then
  ok "Project ${REBUILD} already exists — skipping creation"
else
  gcloud projects create "$REBUILD" \
    --name="Heady Rebuild" \
    --labels=env=rebuild,owner=heady
  ok "Created project ${REBUILD}"
fi

# ── 2. Link billing ─────────────────────────────────────────────────
if [ -n "$BILLING" ]; then
  log "Linking billing account to ${REBUILD}"
  gcloud billing projects link "$REBUILD" --billing-account="$BILLING"
  ok "Billing linked"
else
  echo "  ⚠  BILLING_ACCOUNT_ID not set — skipping billing link (APIs won't activate without billing)"
  echo "     Run: gcloud billing accounts list"
  echo "     Then: gcloud billing projects link ${REBUILD} --billing-account=<ID>"
fi

# ── 3. Enable required APIs ─────────────────────────────────────────
log "Enabling APIs on ${REBUILD}"
APIS=(
  secretmanager.googleapis.com
  run.googleapis.com
  artifactregistry.googleapis.com
  iam.googleapis.com
  iamcredentials.googleapis.com
  cloudresourcemanager.googleapis.com
  container.googleapis.com
  cloudbuild.googleapis.com
)
gcloud services enable "${APIS[@]}" --project="$REBUILD" --quiet
ok "APIs enabled"

# ── 4. Create Artifact Registry Docker repo ─────────────────────────
log "Creating Artifact Registry repo in ${REBUILD}"
if gcloud artifacts repositories describe heady-rebuild \
     --project="$REBUILD" --location="$REGION" &>/dev/null; then
  ok "Artifact Registry repo already exists"
else
  gcloud artifacts repositories create heady-rebuild \
    --repository-format=docker \
    --location="$REGION" \
    --project="$REBUILD" \
    --description="Heady rebuild Docker images"
  ok "Artifact Registry repo created: ${REGION}-docker.pkg.dev/${REBUILD}/heady-rebuild"
fi

# ── 5. Create service account ───────────────────────────────────────
log "Creating Cloud Run service account in ${REBUILD}"
if gcloud iam service-accounts describe "$SA_EMAIL_REBUILD" \
     --project="$REBUILD" &>/dev/null; then
  ok "Service account ${SA_EMAIL_REBUILD} already exists"
else
  gcloud iam service-accounts create "$SA_NAME" \
    --project="$REBUILD" \
    --display-name="Heady Cloud Run Runner (rebuild)" \
    --description="Runtime identity for rebuild Cloud Run services"
  ok "Service account created: ${SA_EMAIL_REBUILD}"
fi

# Grant it access to secrets in the rebuild project
gcloud projects add-iam-policy-binding "$REBUILD" \
  --member="serviceAccount:${SA_EMAIL_REBUILD}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet
gcloud projects add-iam-policy-binding "$REBUILD" \
  --member="serviceAccount:${SA_EMAIL_REBUILD}" \
  --role="roles/run.invoker" \
  --quiet
ok "IAM bindings applied"

# ── 6. Workload Identity Federation (keyless OIDC for GitHub Actions) ─
log "Configuring Workload Identity Federation for GitHub Actions → ${REBUILD}"
POOL_NAME="github-actions-pool"
PROVIDER_NAME="github-actions-provider"
POOL_ID="projects/$(gcloud projects describe $REBUILD --format='value(projectNumber)')/locations/global/workloadIdentityPools/${POOL_NAME}"

if gcloud iam workload-identity-pools describe "$POOL_NAME" \
     --project="$REBUILD" --location=global &>/dev/null; then
  ok "Workload Identity Pool already exists"
else
  gcloud iam workload-identity-pools create "$POOL_NAME" \
    --project="$REBUILD" \
    --location=global \
    --display-name="GitHub Actions Pool (rebuild)"
  ok "Workload Identity Pool created"
fi

if gcloud iam workload-identity-pools providers describe "$PROVIDER_NAME" \
     --workload-identity-pool="$POOL_NAME" \
     --project="$REBUILD" --location=global &>/dev/null; then
  ok "Workload Identity Provider already exists"
else
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_NAME" \
    --project="$REBUILD" \
    --location=global \
    --workload-identity-pool="$POOL_NAME" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository=='${GITHUB_ORG}/${GITHUB_REPO}'"
  ok "Workload Identity Provider created"
fi

# Allow GitHub Actions to impersonate the SA (scoped to rebuild branch)
PROJECT_NUMBER=$(gcloud projects describe "$REBUILD" --format='value(projectNumber)')
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL_REBUILD" \
  --project="$REBUILD" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}/attribute.repository/${GITHUB_ORG}/${GITHUB_REPO}" \
  --quiet
ok "Workload Identity binding applied"

# ── 7. Create Secret Manager stubs (all @heady/secrets registry keys) ──
log "Creating Secret Manager stubs in ${REBUILD}"
# These match packages/secrets/src/registry.mjs — SECRETS array
SECRETS=(
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_API_TOKEN
  DATABASE_URL
  UPSTASH_REDIS_REST_URL
  UPSTASH_REDIS_REST_TOKEN
  INTERNAL_NODE_SECRET
  VAULT_PASSPHRASE
  ANTHROPIC_API_KEY
  GROQ_API_KEY
  OPENAI_API_KEY
  GEMINI_API_KEY
  HUGGINGFACE_TOKEN
  HEADY_ALLOW_HF_EMBED
  HEADY_OWNER
  HEADY_OWNER_PASS
  # Rebuild-specific additions
  FIREBASE_PROJECT_ID
  FIREBASE_API_KEY
  FIREBASE_AUTH_DOMAIN
)

for SECRET in "${SECRETS[@]}"; do
  if gcloud secrets describe "$SECRET" --project="$REBUILD" &>/dev/null; then
    ok "Secret ${SECRET} already exists — skipping"
  else
    # Create with a placeholder — you will populate via 06-headyvault-seed.sh
    echo -n "PLACEHOLDER_REPLACE_ME" | \
      gcloud secrets create "$SECRET" \
        --project="$REBUILD" \
        --data-file=- \
        --replication-policy=automatic \
        --labels=env=rebuild,managed-by=heady
    ok "Created secret stub: ${SECRET}"
  fi
done

# ── 8. Mirror SA + secrets in legacy project (ensure parity) ────────
log "Ensuring legacy project ${LEGACY} has matching secret stubs"
for SECRET in "${SECRETS[@]}"; do
  if gcloud secrets describe "$SECRET" --project="$LEGACY" &>/dev/null; then
    ok "Legacy secret ${SECRET} already exists"
  else
    echo -n "PLACEHOLDER_REPLACE_ME" | \
      gcloud secrets create "$SECRET" \
        --project="$LEGACY" \
        --data-file=- \
        --replication-policy=automatic \
        --labels=env=legacy,managed-by=heady
    ok "Created legacy secret stub: ${SECRET}"
  fi
done

# ── 9. Output summary for GitHub Actions secrets ────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  GCP Setup Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Add these to GitHub Actions secrets (Settings → Secrets → Actions):"
echo ""
echo "  For the rebuild environment:"
echo "    REBUILD_GCP_PROJECT       = ${REBUILD}"
echo "    REBUILD_GCP_SA_EMAIL      = ${SA_EMAIL_REBUILD}"
echo "    REBUILD_GCP_WIF_PROVIDER  = projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}/providers/${PROVIDER_NAME}"
echo ""
echo "  Artifact Registry image path:"
echo "    ${REGION}-docker.pkg.dev/${REBUILD}/heady-rebuild/<service>:latest"
echo ""
echo "  Next: bash 02-neon-setup.sh"
