# Heady Onboarding Architecture — Production Build Spec v3

## System Overview

```
┌─────────────────┐     ┌───────────────────────┐     ┌──────────────────────┐
│  Drupal 11 +    │────▶│  Cloudflare Worker     │────▶│  Cloud Run (GCE)     │
│  Twig Templates │     │  (Edge Auth Gateway)   │     │  Express + Firebase  │
│  headyme.com    │     │  JWT verify + CORS     │     │  Admin SDK           │
└─────────────────┘     │  Rate limiting         │     │  Port 8080           │
                        └───────────────────────┘     └──────────────────────┘
```

## Firebase Project: heady-ai
## Auth Domain: heady-ai.firebaseapp.com
## Requirement: Firebase Auth with Identity Platform upgrade (for OIDC support)

## Auth Provider Tiers

| Tier | Providers | Method |
|------|-----------|--------|
| 1 — Native Firebase | google.com, github.com, facebook.com, twitter.com, microsoft.com, apple.com | Firebase SDK `signInWithPopup` |
| 2 — OIDC Custom | oidc.huggingface, oidc.discord, oidc.slack, oidc.linkedin, oidc.spotify | Firebase `OAuthProvider` with custom OIDC config |
| 3 — API Keys | OpenAI, Anthropic, Google AI, Perplexity, Mistral, Cohere, Groq, etc. | User-entered keys stored with AES-256-GCM |

### Tier 1: Firebase Native Providers (built-in SDK support)
These have dedicated `AuthProvider` classes in the Firebase JS SDK:
- **Google** → `GoogleAuthProvider` / firebaseId: `google.com`
- **GitHub** → `GithubAuthProvider` / firebaseId: `github.com`
- **Facebook** → `FacebookAuthProvider` / firebaseId: `facebook.com`
- **Twitter/X** → `TwitterAuthProvider` / firebaseId: `twitter.com`
- **Microsoft** → `OAuthProvider('microsoft.com')` / firebaseId: `microsoft.com`
- **Apple** → `OAuthProvider('apple.com')` / firebaseId: `apple.com`

### Tier 2: OIDC Custom Providers (require Firebase Console setup + Identity Platform)
These have valid `.well-known/openid-configuration` endpoints and can be registered as OIDC custom providers in Firebase:
- **HuggingFace** → `OAuthProvider('oidc.huggingface')` / issuer: `https://huggingface.co`
- **Discord** → `OAuthProvider('oidc.discord')` / issuer: `https://discord.com`
- **Slack** → `OAuthProvider('oidc.slack')` / issuer: `https://slack.com`
- **LinkedIn** → `OAuthProvider('oidc.linkedin')` / issuer: `https://www.linkedin.com/oauth`
- **Spotify** → `OAuthProvider('oidc.spotify')` / issuer: `https://accounts.spotify.com`

### Tier 3: API Key Connections (NOT auth providers — handled in Buddy Setup stage)
These services don't provide OIDC/OAuth identity. Users connect their API keys:
- OpenAI, Anthropic/Claude, Gemini, Perplexity, Mistral, Cohere, Groq, Replicate,
  Together AI, Fireworks, DeepSeek, xAI/Grok

## Firebase Console Configuration Required

For each Tier 2 OIDC provider, the admin must:
1. Go to Firebase Console → Authentication → Sign-in method
2. Click "Add new provider" → OpenID Connect
3. Toggle "Enable"
4. Select "Code flow" (recommended)
5. Enter: Name, Client ID, Client Secret, Issuer URL
6. Save → note the callback URL (`https://heady-ai.firebaseapp.com/__/auth/handler`)
7. Register that callback URL in each provider's developer console

### OIDC Provider Setup Details:
| Provider | Issuer URL | Developer Console | Scopes |
|----------|-----------|-------------------|--------|
| HuggingFace | `https://huggingface.co` | huggingface.co/settings/connected-apps | `openid profile email` |
| Discord | `https://discord.com` | discord.com/developers/applications | `identify email openid` |
| Slack | `https://slack.com` | api.slack.com/apps | `openid profile email` |
| LinkedIn | `https://www.linkedin.com/oauth` | linkedin.com/developers/apps | `openid profile email` |
| Spotify | `https://accounts.spotify.com` | developer.spotify.com/dashboard | `openid email profile` |

## Onboarding Stages

### Stage 1: Auth — Sign In
- Show Tier 1 + Tier 2 providers as sign-in buttons (social category)
- Show email/password as alternative
- Firebase popup/redirect flow handles all auth
- On success → `POST /auth/callback` `{ idToken, provider }` → get session JWT

### Stage 2: Identity — Create @headyme.com Account
- Username selection (debounced availability check)
- Display name (pre-filled from auth provider)
- Optional password for @headyme.com account
- Passkey registration option
- Preview: "You'll be known as **Display Name** (username@headyme.com)"
- Endpoint: `POST /api/onboarding/create-identity` `{ username, displayName, password? }`

### Stage 3: Email Configuration
- Option A: Use headyme.com secure inbox (provisionHeadyEmail: true)
- Option B: Forward to existing email (provisionHeadyEmail: false)
- Endpoint: `POST /api/onboarding/configure-email` `{ contactEmail, provisionHeadyEmail, headyEmailPrefix? }`

### Stage 4: Permissions
- Cloud Only vs Hybrid mode
- Device name (for Hybrid)
- Analytics opt-in toggle
- Data region selector (us-east, us-west, eu-west, ap-south, ap-northeast)
- AES-256-GCM encryption notice
- Endpoint: `POST /api/onboarding/set-permissions` `{ mode, analyticsOptIn, buddyBrowsingAccess, buddyCodeExecution, buddyToolAccess, dataRegion, deviceName? }`

### Stage 5: HeadyBuddy Setup
- Name your buddy
- Choose cognitive archetype (7 options: OWL, EAGLE, DOLPHIN, RABBIT, ANT, ELEPHANT, BEAVER)
- Select tone (professional, casual, mentor, peer, concise)
- Select domains (engineering, design, writing, research, data-science, devops, product, general)
- Select interfaces (web, cli, ide, mobile, api, slack, discord)
- Connect AI API keys (Tier 3 providers) — optional
- Endpoint: `POST /api/onboarding/configure-buddy` `{ archetype, buddyName, tone, domains[], interfaces[]? }`

### Stage 6: Complete
- Call `POST /api/onboarding/complete` `{ acknowledged: true }` to finalize
- Summary of all settings
- API key reveal (shown once, format: `HY-{uuid}`)
- Launch Dashboard button

## API Contracts

### Response Envelope

All API responses use the standard envelope pattern:

```json
// Success
{ "ok": true, "data": { ... } }

// Error
{ "ok": false, "error": { "code": "ERROR_CODE", "message": "Human-readable message", "details": {} } }
```

### Auth Endpoints (mounted at `/auth`)

#### `POST /auth/callback`
Exchange Firebase ID token for a session JWT.

**Request:**
```json
{ "idToken": "firebase-id-token-string", "provider": "google.com" }
```

**Response:**
```json
{ "ok": true, "data": { "uid": "firebase-uid", "sessionToken": "jwt-session-token", "expiresAt": "2026-03-18T..." } }
```

### Onboarding Endpoints (mounted at `/api/onboarding`)

#### `GET /api/onboarding/check-username?username=yourname`
Check if a username is available.

**Response:**
```json
{ "ok": true, "data": { "available": true, "username": "yourname" } }
```

#### `POST /api/onboarding/create-identity`
Create the user's @headyme.com identity.

**Request:**
```json
{ "username": "yourname", "displayName": "Your Full Name", "password": "optional-password" }
```

**Response:**
```json
{ "ok": true, "data": { "username": "yourname", "headyEmail": "yourname@headyme.com", "displayName": "Your Full Name" } }
```

#### `POST /api/onboarding/configure-email`
Configure email preferences.

**Request:**
```json
{
  "contactEmail": "user@gmail.com",
  "provisionHeadyEmail": true,
  "headyEmailPrefix": "yourname"
}
```

**Response:**
```json
{ "ok": true, "data": { "headyEmail": "yourname@headyme.com", "forwardingEnabled": false } }
```

#### `POST /api/onboarding/set-permissions`
Set data storage mode and permission preferences.

**Request:**
```json
{
  "mode": "cloud",
  "analyticsOptIn": true,
  "buddyBrowsingAccess": false,
  "buddyCodeExecution": false,
  "buddyToolAccess": false,
  "dataRegion": "us-east",
  "deviceName": "eric-macbook"
}
```

**Response:**
```json
{ "ok": true, "data": { "mode": "cloud", "dataRegion": "us-east" } }
```

#### `POST /api/onboarding/configure-buddy`
Configure HeadyBuddy personality and interfaces.

**Request:**
```json
{
  "archetype": "OWL",
  "buddyName": "Eric",
  "tone": "casual",
  "domains": ["engineering", "design"],
  "interfaces": ["web", "cli"]
}
```

**Response:**
```json
{ "ok": true, "data": { "archetype": "OWL", "buddyName": "Eric", "ready": true } }
```

#### `POST /api/onboarding/complete`
Finalize onboarding and generate API key.

**Request:**
```json
{ "acknowledged": true }
```

**Response:**
```json
{ "ok": true, "data": { "apiKey": "HY-550e8400-e29b-41d4-a716-446655440000", "dashboardUrl": "/dashboard", "receipt": "base64url-ml-dsa-65-signed-receipt" } }
```

#### `GET /api/onboarding/status`
Get current onboarding progress.

**Response:**
```json
{ "ok": true, "data": { "stage": "email", "stageIndex": 2, "completed": false } }
```

## CORS — 12 Allowed Origins

Both the Cloudflare Worker and Express server allow:
```
https://heady.ai        https://www.heady.ai      https://app.heady.ai     https://api.heady.ai
https://headyme.com     https://www.headyme.com    https://app.headyme.com  https://mail.headyme.com
https://heady.dev       https://www.heady.dev      https://app.heady.dev    https://mail.heady.dev
```

Development mode adds: `http://localhost:3000`, `http://localhost:8080`, `http://localhost:5173`

## Server Architecture

### Express Server (Cloud Run: `heady-onboarding`)
- Firebase Admin SDK for token verification (checkRevoked: true)
- Zod schema validation on all inputs
- Session management (express-session)
- ML-DSA-65 (FIPS 204) signing receipts for onboarding completion
- Structured pino logging
- CORS for 12 Heady domains
- Port 8080 (Cloud Run standard)

### Cloudflare Worker (Edge Auth Gateway)
- Verifies Firebase JWT at edge (Web Crypto API)
- Rate limiting (1000 req/min per IP, KV-backed)
- CORS preflight handling
- Routes to Cloud Run origin
- JWT verification via Firebase's public JWK endpoint
- 6-hour JWK cache per isolate

## 3-Tier Latent Space

| Tier | Purpose | TTL | Storage |
|------|---------|-----|---------|
| T0 | Working memory | Session | Redis / In-memory |
| T1 | Short-term | 47 hours | PostgreSQL + pgvector |
| T2 | Long-term | Permanent | Hot → Warm → Cold → Archive |

All embeddings are 384-dimensional (text-embedding-3-small).

## Security

- ML-DSA-65 (FIPS 204) signing receipts for onboarding completion
- AES-256-GCM encryption for API keys and sensitive data
- Argon2id password hashing (when password is provided)
- JWT session tokens (24h TTL, issued by server)
- Firebase ID token verification (server-side, checkRevoked=true)
- Edge JWT verification (Cloudflare Worker, Web Crypto API)
- Rate limiting: 1000 req/min per IP (KV-backed)
- Non-root Docker container (user: heady, uid: 1001)
- Helmet security headers
- API key format: `HY-{uuid-v4}`

## File Structure

```
heady-onboarding/
├── frontend/
│   ├── onboarding.html
│   ├── css/
│   │   └── onboarding.css
│   └── js/
│       ├── onboarding.js        — 6-stage wizard controller
│       ├── buddy-setup.js       — HeadyBuddy configuration + API key vault
│       └── particles.js         — Background particle system
├── server/
│   ├── index.js                 — Express app factory + bootstrap
│   ├── package.json
│   ├── routes/
│   │   ├── auth-routes.js       — Firebase token exchange
│   │   └── onboarding-routes.js — 8 onboarding endpoints
│   ├── middleware/
│   │   └── onboarding-guard.js  — Stage enforcement
│   ├── services/
│   │   ├── identity-service.js  — Username/email provisioning
│   │   └── latent-space-init.js — 384D vector space initialization
│   └── schemas/
│       └── onboarding-schemas.js — Zod schemas
├── worker/
│   ├── auth-gateway.js          — Cloudflare Worker edge gateway
│   └── wrangler.toml            — Worker configuration
├── ARCHITECTURE.md              — This file
├── SETUP.md                     — Firebase Console + provider setup guide
└── Dockerfile                   — Multi-stage node:20-alpine, port 8080
```
