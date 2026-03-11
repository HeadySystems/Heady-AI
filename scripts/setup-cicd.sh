#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Heady™ CI/CD Setup — One-Time Configuration
# Run this ONCE to enable auto-deploy from GitHub → Cloud Run
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_ID="gen-lang-client-0920560496"
SA_NAME="heady-github-deploy"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
KEY_FILE="/tmp/heady-github-deploy-key.json"

echo "═══ Heady CI/CD Setup ═══"
echo ""

# Step 1: Authenticate (only step that needs human interaction)
echo "Step 1: Authenticating with GCP..."
if ! gcloud auth print-access-token &>/dev/null; then
  echo "  → Opening browser for authentication..."
  gcloud auth login --project="$PROJECT_ID"
fi
echo "  ✅ Authenticated"

# Step 2: Create service account for GitHub Actions
echo ""
echo "Step 2: Creating deploy service account..."
if gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" &>/dev/null; then
  echo "  → Service account already exists"
else
  gcloud iam service-accounts create "$SA_NAME" \
    --project="$PROJECT_ID" \
    --display-name="Heady GitHub Actions Deploy"
  echo "  ✅ Service account created"
fi

# Step 3: Grant required roles
echo ""
echo "Step 3: Granting Cloud Run + Cloud Build permissions..."
for role in "roles/run.admin" "roles/cloudbuild.builds.editor" "roles/storage.admin" "roles/iam.serviceAccountUser"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="$role" \
    --quiet &>/dev/null
  echo "  ✅ Granted $role"
done

# Step 4: Create SA key
echo ""
echo "Step 4: Creating service account key..."
gcloud iam service-accounts keys create "$KEY_FILE" \
  --iam-account="$SA_EMAIL" \
  --project="$PROJECT_ID"
echo "  ✅ Key saved to $KEY_FILE"

# Step 5: Set GitHub secret
echo ""
echo "Step 5: Setting GCP_SA_KEY secret on GitHub repos..."
KEY_CONTENT=$(cat "$KEY_FILE")

for repo in "HeadyMe/heady-production" "HeadyMe/Heady-Staging"; do
  gh secret set GCP_SA_KEY --repo="$repo" --body="$KEY_CONTENT" 2>/dev/null && \
    echo "  ✅ Secret set on $repo" || \
    echo "  ⚠️  Failed to set on $repo (check gh auth)"
done

# Step 6: Store API keys as GCP secrets (for Cloud Run --set-secrets)
echo ""
echo "Step 6: Storing API keys in GCP Secret Manager..."
source /home/headyme/Heady/.env 2>/dev/null || true

for secret_name in "ANTHROPIC_API_KEY" "OPENAI_API_KEY" "GROQ_API_KEY" "GEMINI_API_KEY_HEADY"; do
  val="${!secret_name:-}"
  if [ -n "$val" ]; then
    echo -n "$val" | gcloud secrets create "$secret_name" --data-file=- --project="$PROJECT_ID" 2>/dev/null || \
    echo -n "$val" | gcloud secrets versions add "$secret_name" --data-file=- --project="$PROJECT_ID" 2>/dev/null
    echo "  ✅ $secret_name stored"
  else
    echo "  ⚠️  $secret_name not found in .env"
  fi
done

# Step 7: Clean up
rm -f "$KEY_FILE"
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ Setup complete! Auto-deploy is now enabled."
echo "  Every push to main will auto-deploy to Cloud Run."
echo "  You can also manually trigger deploys from GitHub Actions."
echo "═══════════════════════════════════════════════════════"
