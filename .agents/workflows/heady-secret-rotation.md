---
description: Rotate exposed API keys safely through GCP Secret Manager
---

> Transferred 2026-08-09 from ~/.agents/workflows during the rebuild command consolidation.
> ⚠ Project references (`heady-main-project`) predate the canonical GCP lock (ADR-0036) — verify against current deploy state before running.

# Heady Secret Rotation

// turbo-all

When API keys are exposed (committed to git, logged, or leaked), rotate them immediately using this workflow.

## Step 1: Identify Exposed Keys

```bash
# Scan for exposed secrets in git history
npx trufflehog git file://~/Heady-AI --only-verified
# Or search committed code for known key prefixes
grep -rn "sk-ant-\|sk-proj-\|gsk_\|AKIA" ~/Heady-AI/src ~/Heady/workers --include="*.js" --include="*.ts" --include="*.json" # <!-- legacy path; no rebuild equivalent yet -->
```

## Step 2: Rotate on Provider Dashboard

For each exposed key, log into the provider and revoke + regenerate:

- **Anthropic**: https://console.anthropic.com/settings/keys
- **OpenAI**: https://platform.openai.com/api-keys
- **Groq**: https://console.groq.com/keys
- **Google Cloud**: `gcloud iam service-accounts keys create`
- **Stripe**: https://dashboard.stripe.com/apikeys
- **Neon**: https://console.neon.tech → Project Settings → Connection Details

## Step 3: Update GCP Secret Manager

```bash
# Update the secret with the new value
echo -n "NEW_KEY_VALUE" | gcloud secrets versions add SECRET_NAME --data-file=-
# Verify the new version is active
gcloud secrets versions list SECRET_NAME --project=heady-main-project
```

## Step 4: Update Local Environment

```bash
# Update .env files
sed -i 's/OLD_KEY/NEW_KEY/g' ~/Heady-AI/.env ~/Heady/.env.production # <!-- legacy path; no rebuild equivalent yet -->
# Verify no old keys remain
grep -rn "OLD_KEY" ~/Heady-AI/.env* ~/Heady-AI/configs/
```

## Step 5: Redeploy Affected Services

```bash
# Identify services using the rotated key
grep -rn "SECRET_NAME" ~/Heady-AI/src/ ~/Heady/workers/ --include="*.js" # <!-- legacy path; no rebuild equivalent yet -->
# Redeploy each affected Cloud Run service
gcloud run deploy SERVICE_NAME --source . --region us-east1 --project heady-main-project
# Redeploy affected Cloudflare Workers
npx wrangler deploy --name WORKER_NAME
```

## Step 6: Verify and Clean Git History

```bash
# Verify no old keys exist in HEAD
grep -rn "OLD_KEY" ~/Heady-AI/
# If key was committed, add to .gitignore patterns and consider BFG cleanup
# bfg --replace-text passwords.txt ~/Heady-AI
```

## Rules

- NEVER commit raw API keys — always use `process.env.KEY_NAME` or GCP Secret Manager
- All `.env` files must be in `.gitignore`
- After rotation, immediately test the affected service endpoints
- Log the rotation event with timestamp and reason for audit trail
