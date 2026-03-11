#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Heady™ Full Deploy — Auth + Deploy + CI/CD Setup
# Runs everything. One command. Done forever.
# Usage: bash scripts/full-deploy.sh
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_ID="gen-lang-client-0920560496"
REGION="us-central1"
SA_NAME="heady-github-deploy"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo ""
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║   Heady™ Full Deploy — One Command Done   ║"
echo "  ╚═══════════════════════════════════════════╝"
echo ""

# ── Step 1: GCP Auth ──
echo "▸ Step 1/6: GCP Authentication"
if gcloud auth print-access-token &>/dev/null 2>&1; then
  echo "  ✅ Already authenticated"
else
  echo "  → Opening browser to authenticate..."
  gcloud auth login --project="$PROJECT_ID" --update-adc
  echo "  ✅ Authenticated"
fi
echo ""

# ── Step 2: Deploy HeadySite (main app) ──
echo "▸ Step 2/6: Deploying HeadySite to Cloud Run..."
gcloud run deploy heady-site \
  --source . \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --allow-unauthenticated \
  --port=3301 \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --set-env-vars="NODE_ENV=production,PORT=3301" \
  --quiet
SITE_URL=$(gcloud run services describe heady-site --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)')
echo "  ✅ HeadySite deployed: $SITE_URL"
echo ""

# ── Step 3: Deploy Admin UI ──
echo "▸ Step 3/6: Deploying Admin UI to Cloud Run..."
cd admin-ui
gcloud run deploy heady-admin-ui \
  --source . \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=5 \
  --set-env-vars="NODE_ENV=production" \
  --quiet
cd ..
ADMIN_URL=$(gcloud run services describe heady-admin-ui --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)')
echo "  ✅ Admin UI deployed: $ADMIN_URL"
echo ""

# ── Step 4: Set env vars from .env ──
echo "▸ Step 4/6: Configuring API keys on Cloud Run..."
source .env 2>/dev/null || true
ENV_VARS=""
[ -n "${ANTHROPIC_API_KEY:-}" ] && ENV_VARS="${ENV_VARS:+$ENV_VARS,}ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"
[ -n "${OPENAI_API_KEY:-}" ] && ENV_VARS="${ENV_VARS:+$ENV_VARS,}OPENAI_API_KEY=$OPENAI_API_KEY"
[ -n "${GROQ_API_KEY:-}" ] && ENV_VARS="${ENV_VARS:+$ENV_VARS,}GROQ_API_KEY=$GROQ_API_KEY"
[ -n "${GEMINI_API_KEY_HEADY:-}" ] && ENV_VARS="${ENV_VARS:+$ENV_VARS,}GEMINI_API_KEY=$GEMINI_API_KEY_HEADY"

if [ -n "$ENV_VARS" ]; then
  gcloud run services update heady-admin-ui \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --set-env-vars="$ENV_VARS" \
    --quiet
  gcloud run services update heady-site \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --update-env-vars="$ENV_VARS" \
    --quiet
  echo "  ✅ API keys configured"
else
  echo "  ⚠️  No API keys found in .env"
fi
echo ""

# ── Step 5: Setup CI/CD (GitHub Actions) ──
echo "▸ Step 5/6: Setting up CI/CD auto-deploy..."

# Create SA + key
if ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" &>/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_NAME" \
    --project="$PROJECT_ID" \
    --display-name="Heady GitHub Actions Deploy" --quiet
fi

for role in "roles/run.admin" "roles/cloudbuild.builds.editor" "roles/storage.admin" "roles/iam.serviceAccountUser"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="$role" --quiet &>/dev/null
done

KEY_FILE="/tmp/heady-sa-key-$$.json"
gcloud iam service-accounts keys create "$KEY_FILE" \
  --iam-account="$SA_EMAIL" --project="$PROJECT_ID" --quiet

KEY_CONTENT=$(cat "$KEY_FILE")
for repo in "HeadyMe/heady-production" "HeadyMe/Heady-Staging"; do
  gh secret set GCP_SA_KEY --repo="$repo" --body="$KEY_CONTENT" 2>/dev/null && \
    echo "  ✅ GCP_SA_KEY set on $repo" || \
    echo "  ⚠️  Could not set on $repo"
done
rm -f "$KEY_FILE"
echo ""

# ── Step 6: Summary ──
echo "▸ Step 6/6: Done!"
echo ""
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║  ✅ HeadySite:  $SITE_URL"
echo "  ║  ✅ Admin UI:   $ADMIN_URL"
echo "  ║  ✅ CI/CD:      Auto-deploy on push to main"
echo "  ║                                                      ║"
echo "  ║  → Point 1ime1.com CNAME to Admin UI URL             ║"
echo "  ║  → Every future push auto-deploys. Zero manual.      ║"
echo "  ╚══════════════════════════════════════════════════════╝"
