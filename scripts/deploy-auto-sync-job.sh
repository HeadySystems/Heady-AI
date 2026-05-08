#!/usr/bin/env bash
# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  Deploy HeadyAutoSync Cloud Run Job                            ║
# ║  © 2026 HeadySystems Inc. | φ = 1.618033988749895              ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
#
# Usage:
#   bash scripts/deploy-auto-sync-job.sh [--schedule "*/1 * * * *"]
#
# Prerequisites:
#   1. gcloud CLI authenticated
#   2. Docker installed
#   3. Secret Manager secrets created:
#      - heady-deploy-ssh-key (SSH private key for GitHub push)
#      - heady-github-token (PAT with repo scope)

set -euo pipefail

PROJECT_ID="${GCP_PROJECT:-heady-production}"
REGION="${GCP_REGION:-us-central1}"
REPO_NAME="heady-docker-repo"
JOB_NAME="heady-auto-sync"
IMAGE="us-central1-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${JOB_NAME}:latest"
SCHEDULE="${1:-*/5 * * * *}"  # Default: every 5 minutes
SA_EMAIL="${JOB_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "═══ HeadyAutoSync Cloud Run Job Deployment ═══"
echo "Project:  $PROJECT_ID"
echo "Region:   $REGION"
echo "Image:    $IMAGE"
echo "Schedule: $SCHEDULE"
echo ""

# 1. Build and push Docker image
echo "[1/5] Building Docker image..."
docker build -f deploy/Dockerfile.auto-sync -t "$IMAGE" .
docker push "$IMAGE"
echo "✅ Image pushed to Artifact Registry"

# 2. Create service account (if not exists)
echo "[2/5] Ensuring service account..."
gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" 2>/dev/null || \
  gcloud iam service-accounts create "$JOB_NAME" \
    --project="$PROJECT_ID" \
    --display-name="HeadyAutoSync Job" \
    --description="Service account for HeadyAutoSync Cloud Run Job"

# Grant Secret Manager access
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None --quiet 2>/dev/null || true

# Grant Cloud Run invoker (for scheduler)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.invoker" \
  --condition=None --quiet 2>/dev/null || true

echo "✅ Service account configured"

# 3. Create/update Cloud Run Job
echo "[3/5] Deploying Cloud Run Job..."
gcloud run jobs replace deploy/cloud-run-auto-sync-job.yaml \
  --project="$PROJECT_ID" \
  --region="$REGION" 2>/dev/null || \
gcloud run jobs create "$JOB_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --image="$IMAGE" \
  --task-timeout=120s \
  --max-retries=2 \
  --set-secrets="SSH_KEY_PATH=heady-deploy-ssh-key:latest,GITHUB_TOKEN=heady-github-token:latest" \
  --set-env-vars="HEADY_ORG=HeadyMe,HEADY_REPO=heady-production,HEADY_BRANCH=main,HEADY_TARGET=cloud-run-job" \
  --memory=512Mi \
  --cpu=1 \
  --service-account="$SA_EMAIL"

echo "✅ Cloud Run Job deployed"

# 4. Create Cloud Scheduler trigger
echo "[4/5] Setting up Cloud Scheduler..."
gcloud scheduler jobs describe "${JOB_NAME}-trigger" \
  --location="$REGION" --project="$PROJECT_ID" 2>/dev/null && \
gcloud scheduler jobs update http "${JOB_NAME}-trigger" \
  --location="$REGION" \
  --project="$PROJECT_ID" \
  --schedule="$SCHEDULE" \
  --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${JOB_NAME}:run" \
  --http-method=POST \
  --oauth-service-account-email="$SA_EMAIL" || \
gcloud scheduler jobs create http "${JOB_NAME}-trigger" \
  --location="$REGION" \
  --project="$PROJECT_ID" \
  --schedule="$SCHEDULE" \
  --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${JOB_NAME}:run" \
  --http-method=POST \
  --oauth-service-account-email="$SA_EMAIL" \
  --description="HeadyAutoSync scheduled trigger"

echo "✅ Cloud Scheduler configured: $SCHEDULE"

# 5. Test run
echo "[5/5] Triggering test execution..."
gcloud run jobs execute "$JOB_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --wait

echo ""
echo "═══ HeadyAutoSync Deployment Complete ═══"
echo ""
echo "Commands:"
echo "  gcloud run jobs execute $JOB_NAME --region=$REGION    # Manual trigger"
echo "  gcloud run jobs describe $JOB_NAME --region=$REGION   # Check status"
echo "  gcloud run jobs logs $JOB_NAME --region=$REGION       # View logs"
echo ""
echo "φ = 1.618033988749895 | HeadySystems Inc."
