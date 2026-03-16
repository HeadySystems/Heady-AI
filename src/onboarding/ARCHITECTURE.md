# Heady Onboarding Architecture — Production Build Spec

## Firebase Project: heady-ai
## Auth Domain: heady-ai.firebaseapp.com
## Requirement: Firebase Auth with Identity Platform upgrade (for OIDC support)

## Provider Tiers

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

## 5-Stage Onboarding Flow

### Stage 1: Sign In
- Show Tier 1 + Tier 2 providers as sign-in buttons (social category)
- Show email/password as alternative
- Firebase popup/redirect flow handles all auth
- On success → exchange Firebase ID token with backend → get session JWT

### Stage 2: Identity (Create @headyme.com Account)
- Username selection (debounced availability check)
- Display name (pre-filled from auth provider)
- Optional password for @headyme.com account
- Passkey registration option
- Preview: "You'll be known as **Display Name** (username@headyme.com)"

### Stage 3: Email Configuration
- Option A: Use headyme.com secure inbox
- Option B: Forward to existing email

### Stage 4: Permissions
- Cloud Only vs Hybrid mode
- Device name (for Hybrid)
- AES-256-GCM encryption notice

### Stage 5: HeadyBuddy Setup
- Name your buddy
- Choose cognitive archetype (7 options)
- Select interfaces (Web, CLI, IDE, Mobile, etc.)
- Connect AI API keys (Tier 3 providers) — optional

### Stage 6: Complete
- Summary of all settings
- API key reveal (shown once)
- Launch Dashboard button

## Server Architecture

### Express Server (Cloud Run: `heady-onboarding`)
- Firebase Admin SDK for token verification
- Zod schema validation on all inputs
- Session management (express-session)
- ML-DSA-65 signing receipts
- Structured pino logging
- CORS for 11 Heady domains

### Cloudflare Worker (Edge Auth Gateway)
- Verifies Firebase JWT at edge
- Rate limiting (1000 req/min per IP)
- CORS preflight handling
- Routes to Cloud Run origin
- JWT verification via Firebase's public JWK endpoint

## File Structure
```
heady-onboarding/
├── frontend/
│   ├── onboarding.html
│   ├── css/
│   │   └── onboarding.css
│   └── js/
│       ├── auth-handler.js      — Firebase auth (Tier 1 native + Tier 2 OIDC)
│       ├── onboarding.js        — 5-stage wizard controller
│       ├── buddy-setup.js       — HeadyBuddy configuration + API key vault
│       └── particles.js         — Background particle system
├── server/
│   ├── index.js                 — Express app factory + bootstrap
│   ├── package.json
│   ├── routes/
│   │   ├── auth-routes.js       — Firebase token exchange
│   │   └── onboarding-routes.js — 7 onboarding endpoints
│   ├── middleware/
│   │   └── onboarding-guard.js  — Stage enforcement
│   ├── services/
│   │   ├── identity-service.js  — Username/email provisioning
│   │   └── latent-space-init.js — 384D vector space initialization
│   └── schemas/
│       └── onboarding-schemas.js — Zod schemas
├── worker/
│   └── auth-gateway.js          — Cloudflare Worker edge gateway
├── SETUP.md                     — Firebase Console + provider setup guide
└── Dockerfile
```
