# Heady™ Security Model

## Architecture Overview
Zero-trust, defense-in-depth with φ-scaled security layers.

## Authentication
| Method | Use Case | Implementation |
|--------|----------|----------------|
| httpOnly Cookies | Web sessions | `auth-session-server` sets `Secure; HttpOnly; SameSite=Strict` cookies |
| API Keys | Developer access | Hashed with SHA-256, stored in `api_keys` table |
| OAuth2/OIDC | SSO integration | Google, GitHub, custom OIDC providers |

## Authorization
- Role-Based Access Control (RBAC): `admin`, `developer`, `user`, `viewer`
- Per-resource permissions via JWT claims
- API key scoping: read-only, write, admin

## Data Security
- **In transit:** TLS 1.3 (Cloud Run default)
- **At rest:** Google-managed encryption (Cloud SQL, Cloud Storage)
- **Secrets:** Google Secret Manager (no env vars for sensitive values)
- **Tokens:** Never stored in localStorage — sessionStorage only for ephemeral client state

## CORS Policy
- Origin whitelist: `packages/shared/cors-whitelist.js`
- Approved domains: `*.headysystems.com`, `*.headyme.com`, `*.run.app`
- No wildcards in production

## Rate Limiting
- φ-scaled sliding window: `packages/shared/rate-limiter.js`
- Default: 100 requests per ~97s (φ minutes)
- Budget enforcement via `CostTrackerBee`

## Logging & Monitoring
- Structured JSON logging: `packages/shared/structured-logger.js`
- Sensitive field redaction: passwords, tokens, API keys auto-redacted
- Cloud Logging integration

## Incident Response
See `docs/runbooks/incident-response.md`
