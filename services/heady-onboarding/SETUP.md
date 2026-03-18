# Heady Onboarding — Complete Setup Guide

Production deployment guide for the Heady Onboarding system: Firebase Authentication with 11 OAuth providers, Cloud Run backend, and Cloudflare Worker edge gateway.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Firebase Project Setup](#2-firebase-project-setup)
3. [Tier 1: Native OAuth Providers](#3-tier-1-native-oauth-providers)
4. [Tier 2: OIDC Custom Providers](#4-tier-2-oidc-custom-providers)
5. [Environment Variables](#5-environment-variables)
6. [Cloud Run Deployment](#6-cloud-run-deployment)
7. [Cloudflare Worker Deployment](#7-cloudflare-worker-deployment)
8. [DNS Configuration](#8-dns-configuration)
9. [Verification Checklist](#9-verification-checklist)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

- **Google Cloud Project** with billing enabled
- **Firebase project** (`heady-ai`) linked to the GCP project
- **Firebase Identity Platform** upgrade (required for OIDC custom providers)
- **Cloudflare account** with zones configured for `heady.ai`, `headyme.com`, `heady.dev`
- **gcloud CLI** authenticated: `gcloud auth login`
- **wrangler CLI** installed: `npm install -g wrangler`
- **Docker** installed locally (for Cloud Run builds)

### Firebase Identity Platform Upgrade

1. Go to [Firebase Console](https://console.firebase.google.com) → **heady-ai** project
2. Navigate to **Authentication** → **Settings**
3. Click **Upgrade to Identity Platform**
4. Accept the terms — this unlocks OIDC/SAML custom provider support

---

## 2. Firebase Project Setup

### 2.1 Initialize Firebase Auth

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login and select project
firebase login
firebase use heady-ai
```

### 2.2 Authorized Domains

In Firebase Console → Authentication → Settings → **Authorized domains**, add all 11 Heady domains:

```
heady.ai
www.heady.ai
app.heady.ai
api.heady.ai
headyme.com
www.headyme.com
app.headyme.com
mail.headyme.com
heady.dev
www.heady.dev
api.heady.dev
```

### 2.3 Generate Service Account Key

```bash
# Create a service account for the backend
gcloud iam service-accounts create heady-onboarding \
  --display-name="Heady Onboarding Service" \
  --project=heady-ai

# Grant Firebase Auth Admin role
gcloud projects add-iam-policy-binding heady-ai \
  --member="serviceAccount:heady-onboarding@heady-ai.iam.gserviceaccount.com" \
  --role="roles/firebaseauth.admin"
```

> **Note**: On Cloud Run, use Workload Identity Federation instead of JSON keys. The service account attached to the Cloud Run revision automatically authenticates with Firebase Admin SDK.

---

## 3. Tier 1: Native OAuth Providers

These use Firebase's built-in SDK support. Each provider requires registering an OAuth app in the provider's developer console, then enabling it in Firebase Console → Authentication → Sign-in method.

**Firebase Callback URL** (used for all providers):
```
https://heady-ai.firebaseapp.com/__/auth/handler
```

---

### 3.1 Google

**Firebase ID**: `google.com`
**SDK Class**: `GoogleAuthProvider`

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **heady-ai** project
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Heady Onboarding`
5. Authorized redirect URIs: `https://heady-ai.firebaseapp.com/__/auth/handler`
6. Copy **Client ID** and **Client Secret**
7. In Firebase Console → Authentication → Sign-in method → **Google** → Enable
8. Paste Client ID and Secret → Save

**Scopes**: `openid profile email`

---

### 3.2 GitHub

**Firebase ID**: `github.com`
**SDK Class**: `GithubAuthProvider`

1. Go to [GitHub Developer Settings](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**
2. Application name: `Heady`
3. Homepage URL: `https://heady.ai`
4. Authorization callback URL: `https://heady-ai.firebaseapp.com/__/auth/handler`
5. Click **Register application**
6. Copy **Client ID**, generate and copy **Client Secret**
7. In Firebase Console → Authentication → Sign-in method → **GitHub** → Enable
8. Paste Client ID and Secret → Save

**Scopes**: `read:user user:email`

---

### 3.3 Facebook

**Firebase ID**: `facebook.com`
**SDK Class**: `FacebookAuthProvider`

1. Go to [Meta for Developers](https://developers.facebook.com/apps) → **Create App**
2. Select **Consumer** → Next
3. App name: `Heady` → Create
4. From the dashboard, add **Facebook Login** product
5. Settings → Valid OAuth Redirect URIs: `https://heady-ai.firebaseapp.com/__/auth/handler`
6. Go to App Settings → Basic → copy **App ID** and **App Secret**
7. In Firebase Console → Authentication → Sign-in method → **Facebook** → Enable
8. Paste App ID and App Secret → Save
9. Copy the Firebase callback URL back to Facebook's redirect URIs if different

**Scopes**: `email public_profile`

> **Note**: Facebook requires a Privacy Policy URL and Terms of Service URL before going live. Set these to `https://heady.ai/privacy` and `https://heady.ai/terms`.

---

### 3.4 Twitter/X

**Firebase ID**: `twitter.com`
**SDK Class**: `TwitterAuthProvider`

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new Project → App → name it `Heady`
3. Under **User authentication settings** → Set up
4. Type: **Web App**
5. Callback URL: `https://heady-ai.firebaseapp.com/__/auth/handler`
6. Website URL: `https://heady.ai`
7. Copy **API Key** (= Client ID) and **API Key Secret** (= Client Secret)
8. In Firebase Console → Authentication → Sign-in method → **Twitter** → Enable
9. Paste API Key and API Secret → Save

**Note**: Twitter uses OAuth 1.0a. Firebase handles the complexity internally.

---

### 3.5 Microsoft

**Firebase ID**: `microsoft.com`
**SDK Class**: `OAuthProvider('microsoft.com')`

1. Go to [Azure Portal](https://portal.azure.com) → **App registrations** → **New registration**
2. Name: `Heady`
3. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
4. Redirect URI: **Web** → `https://heady-ai.firebaseapp.com/__/auth/handler`
5. Click **Register**
6. Copy **Application (client) ID**
7. Go to **Certificates & secrets** → **New client secret** → copy the **Value**
8. In Firebase Console → Authentication → Sign-in method → **Microsoft** → Enable
9. Paste Application ID and Client Secret → Save

**Scopes**: `openid profile email User.Read`

---

### 3.6 Apple

**Firebase ID**: `apple.com`
**SDK Class**: `OAuthProvider('apple.com')`

1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list/serviceId)
2. Register a new **Services ID**:
   - Description: `Heady Sign In`
   - Identifier: `com.heady.auth`
   - Enable **Sign In with Apple**
   - Configure: Domain = `heady-ai.firebaseapp.com`, Return URL = `https://heady-ai.firebaseapp.com/__/auth/handler`
3. Register a new **Key**:
   - Name: `Heady Auth Key`
   - Enable **Sign In with Apple** → Configure → select the Primary App ID
   - Download the `.p8` key file → note the **Key ID**
4. Note your **Team ID** from the top-right of the developer portal
5. In Firebase Console → Authentication → Sign-in method → **Apple** → Enable
6. Enter:
   - Services ID: `com.heady.auth`
   - Team ID: `YOUR_TEAM_ID`
   - Key ID: `YOUR_KEY_ID`
   - Private Key: paste contents of the `.p8` file
7. Save

**Scopes**: `name email`

> **Important**: Apple only sends the user's name on the FIRST sign-in. Store it immediately.

---

## 4. Tier 2: OIDC Custom Providers

These require Firebase Identity Platform (upgraded). Each is registered as an OpenID Connect custom provider in Firebase Console.

### General Setup Steps

For each Tier 2 provider:

1. **Firebase Console** → Authentication → Sign-in method → **Add new provider** → **OpenID Connect**
2. Toggle **Enable**
3. Select **Code flow** (recommended for security)
4. Fill in: **Name**, **Client ID**, **Client Secret**, **Issuer URL**
5. **Save** → note the generated callback URL: `https://heady-ai.firebaseapp.com/__/auth/handler`
6. Register that callback URL in the provider's developer console

---

### 4.1 HuggingFace

**Firebase Provider ID**: `oidc.huggingface`
**Issuer URL**: `https://huggingface.co`

1. Go to [HuggingFace Settings](https://huggingface.co/settings/connected-apps) → **Create New App**
2. App name: `Heady`
3. Redirect URI: `https://heady-ai.firebaseapp.com/__/auth/handler`
4. Copy **Client ID** and **Client Secret**
5. In Firebase Console, create OIDC provider:
   - Name: `HuggingFace`
   - Provider ID: `oidc.huggingface`
   - Client ID: (from step 4)
   - Client Secret: (from step 4)
   - Issuer URL: `https://huggingface.co`

**Scopes**: `openid profile email`

---

### 4.2 Discord

**Firebase Provider ID**: `oidc.discord`
**Issuer URL**: `https://discord.com`

1. Go to [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**
2. Name: `Heady` → Create
3. Go to **OAuth2** tab
4. Add redirect: `https://heady-ai.firebaseapp.com/__/auth/handler`
5. Copy **Client ID** and **Client Secret** (click Reset Secret if needed)
6. In Firebase Console, create OIDC provider:
   - Name: `Discord`
   - Provider ID: `oidc.discord`
   - Client ID: (from step 5)
   - Client Secret: (from step 5)
   - Issuer URL: `https://discord.com`

**Scopes**: `identify email openid`

---

### 4.3 Slack

**Firebase Provider ID**: `oidc.slack`
**Issuer URL**: `https://slack.com`

1. Go to [Slack API](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. App name: `Heady`, pick a workspace → Create
3. Go to **OAuth & Permissions** → Add redirect URL: `https://heady-ai.firebaseapp.com/__/auth/handler`
4. Under **Scopes** → **User Token Scopes** → add `openid`, `profile`, `email`
5. Go to **Basic Information** → copy **Client ID** and **Client Secret**
6. In Firebase Console, create OIDC provider:
   - Name: `Slack`
   - Provider ID: `oidc.slack`
   - Client ID: (from step 5)
   - Client Secret: (from step 5)
   - Issuer URL: `https://slack.com`

**Scopes**: `openid profile email`

---

### 4.4 LinkedIn

**Firebase Provider ID**: `oidc.linkedin`
**Issuer URL**: `https://www.linkedin.com/oauth`

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps) → **Create App**
2. App name: `Heady`, Company page: select yours
3. Click **Auth** tab → Add redirect URL: `https://heady-ai.firebaseapp.com/__/auth/handler`
4. Request access to **Sign In with LinkedIn using OpenID Connect** product
5. Copy **Client ID** and **Client Secret**
6. In Firebase Console, create OIDC provider:
   - Name: `LinkedIn`
   - Provider ID: `oidc.linkedin`
   - Client ID: (from step 5)
   - Client Secret: (from step 5)
   - Issuer URL: `https://www.linkedin.com/oauth`

**Scopes**: `openid profile email`

> **Note**: LinkedIn requires app verification for production access. Apply via the LinkedIn Developer Portal.

---

### 4.5 Spotify

**Firebase Provider ID**: `oidc.spotify`
**Issuer URL**: `https://accounts.spotify.com`

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) → **Create App**
2. App name: `Heady`
3. Redirect URI: `https://heady-ai.firebaseapp.com/__/auth/handler`
4. Check **Web API** → Save
5. Go to **Settings** → copy **Client ID** and **Client Secret**
6. In Firebase Console, create OIDC provider:
   - Name: `Spotify`
   - Provider ID: `oidc.spotify`
   - Client ID: (from step 5)
   - Client Secret: (from step 5)
   - Issuer URL: `https://accounts.spotify.com`

**Scopes**: `openid email profile`

> **Note**: Spotify requires an Extension Request for production access (>25 users). Submit via the Spotify Developer Dashboard.

---

## 5. Environment Variables

### 5.1 Cloud Run Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | Server port (Cloud Run sets this) | `8080` |
| `FIREBASE_PROJECT_ID` | Firebase project ID | `heady-ai` |
| `SESSION_SECRET` | Express session encryption key | (generate 64-char random) |
| `JWT_SECRET` | JWT token signing secret | (generate 64-char random) |
| `HEADY_API_BASE` | Core Heady API URL | `https://api.heady.ai` |
| `CORS_ORIGINS` | Comma-separated allowed origins | (all 12 domains) |

### 5.2 Secrets (Google Cloud Secret Manager)

```bash
# Create secrets
echo -n "YOUR_SESSION_SECRET" | gcloud secrets create session-secret \
  --data-file=- --project=heady-ai

echo -n "YOUR_JWT_SECRET" | gcloud secrets create jwt-secret \
  --data-file=- --project=heady-ai

echo -n "YOUR_ML_DSA_PRIVATE_KEY" | gcloud secrets create ml-dsa-private-key \
  --data-file=- --project=heady-ai

# Grant access to the Cloud Run service account
gcloud secrets add-iam-policy-binding session-secret \
  --member="serviceAccount:heady-onboarding@heady-ai.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=heady-ai

gcloud secrets add-iam-policy-binding ml-dsa-private-key \
  --member="serviceAccount:heady-onboarding@heady-ai.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=heady-ai
```

### 5.3 Generate Session Secret

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 6. Cloud Run Deployment

### 6.1 Build and Push Container

```bash
cd heady-onboarding

# Build with Cloud Build
gcloud builds submit --tag gcr.io/heady-ai/heady-onboarding --project=heady-ai

# Or build locally and push
docker build -t gcr.io/heady-ai/heady-onboarding .
docker push gcr.io/heady-ai/heady-onboarding
```

### 6.2 Deploy to Cloud Run

```bash
gcloud run deploy heady-onboarding \
  --image=gcr.io/heady-ai/heady-onboarding \
  --platform=managed \
  --region=us-central1 \
  --allow-unauthenticated \
  --service-account=heady-onboarding@heady-ai.iam.gserviceaccount.com \
  --set-env-vars="NODE_ENV=production,FIREBASE_PROJECT_ID=heady-ai" \
  --set-secrets="SESSION_SECRET=session-secret:latest,ML_DSA_PRIVATE_KEY=ml-dsa-private-key:latest" \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=1 \
  --max-instances=10 \
  --concurrency=80 \
  --timeout=60 \
  --port=8080 \
  --project=heady-ai
```

### 6.3 Note the Service URL

```bash
gcloud run services describe heady-onboarding \
  --platform=managed \
  --region=us-central1 \
  --project=heady-ai \
  --format="value(status.url)"
```

Output: `https://heady-onboarding-XXXXXXXX-uc.a.run.app`

Update `ORIGIN_URL` in `worker/wrangler.toml` with this URL.

---

## 7. Cloudflare Worker Deployment

### 7.1 Create KV Namespace

```bash
# Create production KV namespace for rate limiting
wrangler kv:namespace create "RATE_LIMIT"
# Output: { binding = "RATE_LIMIT", id = "abc123..." }

# Create preview KV namespace (for wrangler dev)
wrangler kv:namespace create "RATE_LIMIT" --preview
# Output: { binding = "RATE_LIMIT", preview_id = "def456..." }
```

Copy the `id` and `preview_id` values into `worker/wrangler.toml`.

### 7.2 Update wrangler.toml

Replace all placeholder values in `worker/wrangler.toml`:
- `YOUR_CLOUDFLARE_ACCOUNT_ID` → your Cloudflare account ID
- `YOUR_KV_NAMESPACE_ID` → from step 7.1
- `ORIGIN_URL` → Cloud Run service URL from step 6.3

### 7.3 Deploy Worker

```bash
cd worker

# Login to Cloudflare
wrangler login

# Deploy to staging
wrangler deploy --env staging

# Test staging
curl -I https://heady-auth-gateway-staging.YOUR_SUBDOMAIN.workers.dev/health

# Deploy to production
wrangler deploy --env production
```

### 7.4 Custom Domain (Optional)

If using a custom domain instead of `workers.dev`:

```bash
# Add route via Cloudflare dashboard or API
# Dashboard: Workers & Pages → heady-auth-gateway → Settings → Triggers → Add Route
# Route: api.heady.ai/* → Zone: heady.ai
```

---

## 8. DNS Configuration

### 8.1 Cloudflare DNS Records

Configure these in the Cloudflare dashboard for each zone:

**heady.ai zone:**
| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `api` | `heady-auth-gateway.YOUR_SUBDOMAIN.workers.dev` | Proxied |
| A | `app` | Cloud Run IP or load balancer | Proxied |
| A | `@` | Your web server IP | Proxied |
| CNAME | `www` | `heady.ai` | Proxied |

**headyme.com zone:**
| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `app` | Cloud Run IP or load balancer | Proxied |
| A | `@` | Your web server IP | Proxied |
| CNAME | `www` | `headyme.com` | Proxied |
| MX | `mail` | Your mail server | DNS only |

**heady.dev zone:**
| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `api` | `heady-auth-gateway.YOUR_SUBDOMAIN.workers.dev` | Proxied |
| A | `@` | Your web server IP | Proxied |
| CNAME | `www` | `heady.dev` | Proxied |

### 8.2 SSL/TLS Settings

For each Cloudflare zone:
1. Go to **SSL/TLS** → set mode to **Full (strict)**
2. Go to **Edge Certificates** → enable **Always Use HTTPS**
3. Enable **Automatic HTTPS Rewrites**
4. Enable **HSTS** with `max-age=63072000; includeSubDomains; preload`

---

## 9. Verification Checklist

Run these checks after deployment:

### Health Check
```bash
curl -s https://api.heady.ai/health | jq .
# Expected: { "status": "ok", ... }
```

### CORS Preflight
```bash
curl -s -X OPTIONS https://api.heady.ai/auth/login \
  -H "Origin: https://app.heady.ai" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization, Content-Type" \
  -D - -o /dev/null
# Expected: 204, Access-Control-Allow-Origin: https://app.heady.ai
```

### Rate Limiting
```bash
# Rapid-fire requests to test rate limiting (don't run in production)
for i in $(seq 1 1010); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.heady.ai/health)
  if [ "$STATUS" = "429" ]; then
    echo "Rate limited at request $i"
    break
  fi
done
```

### JWT Verification
```bash
# Should return 401 with no token
curl -s https://api.heady.ai/onboarding/status | jq .
# Expected: { "error": "Missing or malformed Authorization header" }

# Should return 401 with invalid token
curl -s https://api.heady.ai/onboarding/status \
  -H "Authorization: Bearer invalid.token.here" | jq .
# Expected: { "error": "Invalid or expired token" }
```

### Auth Callback Passthrough
```bash
curl -s -o /dev/null -w "%{http_code}" https://api.heady.ai/auth/callback
# Expected: response from origin (not 401)
```

### Security Headers
```bash
curl -s -D - -o /dev/null https://api.heady.ai/health | grep -E "^(X-Content-Type|X-Frame|Referrer-Policy|Permissions-Policy|Strict-Transport|X-Request-ID)"
# Expected: all security headers present
```

---

## 10. Troubleshooting

### Firebase Auth Issues

**"auth/popup-blocked"**
- Ensure the domain is in Firebase Console → Authorized domains
- Use `signInWithRedirect` as fallback instead of `signInWithPopup`

**"auth/unauthorized-domain"**
- Add the exact domain (including subdomain) to Firebase authorized domains list
- Both `app.heady.ai` and `heady.ai` must be listed separately

**OIDC provider returns error**
- Verify the Issuer URL matches exactly (trailing slashes matter)
- Confirm the callback URL `https://heady-ai.firebaseapp.com/__/auth/handler` is registered in the provider's developer console
- Ensure Firebase Identity Platform upgrade is active
- Check that "Code flow" is selected (not "Implicit flow")

**"auth/account-exists-with-different-credential"**
- User has an existing account with a different provider using the same email
- Implement account linking flow: `fetchSignInMethodsForEmail()` → link accounts

### Cloudflare Worker Issues

**Worker returns 500**
- Check worker logs: `wrangler tail --env production`
- Verify `ORIGIN_URL` is correct and the Cloud Run service is running
- Ensure KV namespace ID in `wrangler.toml` matches the created namespace

**CORS errors in browser**
- Verify the requesting origin is in the `ALLOWED_ORIGINS` set in `auth-gateway.js`
- Check that `Access-Control-Allow-Origin` header is present in response
- For credentialed requests, `Access-Control-Allow-Credentials` may be needed

**Rate limiting too aggressive / not working**
- Check KV namespace binding is correct
- Inspect KV keys: `wrangler kv:key list --binding=RATE_LIMIT --env production`
- Adjust `RATE_LIMIT_MAX` (default: 1000) or `RATE_LIMIT_WINDOW_SEC` (default: 60) in `auth-gateway.js`

**JWT verification fails for valid tokens**
- Ensure `FIREBASE_PROJECT_ID` env var matches the Firebase project
- Check clock skew — Worker's `Date.now()` should be accurate (Cloudflare manages this)
- Firebase rotates signing keys — the worker caches JWKs for 6 hours, restart if needed
- Verify the token's `aud` claim matches the project ID

### Cloud Run Issues

**Container fails to start**
- Check logs: `gcloud run services logs read heady-onboarding --project=heady-ai`
- Verify `PORT` env var is set (Cloud Run injects it)
- Ensure the container listens on `0.0.0.0`, not `127.0.0.1`

**Secret access denied**
- Verify IAM binding: `gcloud secrets get-iam-policy session-secret --project=heady-ai`
- Ensure the service account has `roles/secretmanager.secretAccessor`

**Cold start latency**
- Set `--min-instances=1` to keep at least one instance warm
- Optimize container startup (lazy-load heavy dependencies)

### Provider-Specific Notes

| Provider | Gotcha |
|----------|--------|
| Apple | Only sends user's name on FIRST sign-in — persist immediately |
| Facebook | Requires Privacy Policy + ToS URLs before going live |
| Twitter/X | Uses OAuth 1.0a internally — no PKCE support |
| LinkedIn | Requires app verification for production access |
| Spotify | Requires Extension Request for >25 users |
| HuggingFace | Relatively new OIDC support — test thoroughly |
| Discord | Rate limits are strict on OAuth endpoints |
| Slack | Requires separate User Token Scopes configuration |
| Microsoft | Select "any organizational directory + personal" for broadest access |
| Google | Auto-configured when Firebase project is linked to GCP |
| GitHub | OAuth App (not GitHub App) is recommended for Firebase |

---

## Quick Reference

### All 11 Heady Domains
```
heady.ai, www.heady.ai, app.heady.ai, api.heady.ai
headyme.com, www.headyme.com, app.headyme.com, mail.headyme.com
heady.dev, www.heady.dev, api.heady.dev
```

### Firebase Callback URL (all providers)
```
https://heady-ai.firebaseapp.com/__/auth/handler
```

### Provider → Firebase ID Mapping
```
Google      → google.com
GitHub      → github.com
Facebook    → facebook.com
Twitter/X   → twitter.com
Microsoft   → microsoft.com
Apple       → apple.com
HuggingFace → oidc.huggingface
Discord     → oidc.discord
Slack       → oidc.slack
LinkedIn    → oidc.linkedin
Spotify     → oidc.spotify
```

### Key Commands
```bash
# Cloud Run logs
gcloud run services logs read heady-onboarding --project=heady-ai --limit=50

# Worker logs (live tail)
wrangler tail --env production

# KV inspection
wrangler kv:key list --binding=RATE_LIMIT --env production

# Redeploy Cloud Run
gcloud run deploy heady-onboarding --image=gcr.io/heady-ai/heady-onboarding --project=heady-ai

# Redeploy Worker
cd worker && wrangler deploy --env production
```
