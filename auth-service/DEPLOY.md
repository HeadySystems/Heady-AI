# HeadyAuth Deployment Guide

## Prerequisites
- GCP project: `headyme-444017`
- Region: `us-central1`
- Docker registry: `us-central1-docker.pkg.dev/headyme-444017/heady-services`

## Step 1: Set Environment
```bash
export GCP_PROJECT=headyme-444017
export GCP_REGION=us-central1
export SERVICE_NAME=heady-auth
```

## Step 2: Generate JWT Secret (if not already in Secret Manager)
```bash
openssl rand -hex 64 | gcloud secrets create heady-jwt-secret \
  --project=$GCP_PROJECT --data-file=- --replication-policy=automatic
```

## Step 3: Build & Push Docker Image
```bash
cd auth-service
docker build -t $GCP_REGION-docker.pkg.dev/$GCP_PROJECT/heady-services/$SERVICE_NAME:5.0.0 .
docker push $GCP_REGION-docker.pkg.dev/$GCP_PROJECT/heady-services/$SERVICE_NAME:5.0.0
```

## Step 4: Deploy to Cloud Run
```bash
gcloud run deploy $SERVICE_NAME \
  --project=$GCP_PROJECT \
  --region=$GCP_REGION \
  --image=$GCP_REGION-docker.pkg.dev/$GCP_PROJECT/heady-services/$SERVICE_NAME:5.0.0 \
  --port=3309 \
  --set-env-vars="NODE_ENV=production,SERVICE_NAME=heady-auth" \
  --set-secrets="JWT_SECRET=heady-jwt-secret:latest,DATABASE_URL=neon-database-url:latest" \
  --allow-unauthenticated \
  --min-instances=1 \
  --max-instances=13 \
  --memory=256Mi \
  --cpu=0.25
```

## Step 5: Wire DNS
auth.headysystems.com should CNAME to the Cloud Run URL.
The Cloudflare zone for headysystems.com is: `d71262d0faa509f890fd5fea413c39bc`

## Step 6: Verify
```bash
curl https://auth.headysystems.com/health/live
curl https://auth.headysystems.com/health/ready
curl https://auth.headysystems.com/health/startup
```

## Step 7: Create Founder Account
```bash
curl -X POST https://auth.headysystems.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"eric@headyconnection.org","password":"<secure>","name":"Eric Haywood"}'
```

Then upgrade to admin via direct DB:
```sql
UPDATE users SET role = 'admin', onboarding_stage = 5 WHERE email = 'eric@headyconnection.org';
```
