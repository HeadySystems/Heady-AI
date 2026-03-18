# ADR-004: Why Firebase Auth

**Status:** Accepted
**Date:** 2025-11-15
**Authors:** Eric Haywood

## Context

Heady™ requires a cross-domain authentication system that works across 9+ websites with SSO, supports multiple identity providers (Google, Apple, GitHub, Microsoft, Discord, X), handles anonymous-to-authenticated upgrades, and scales to millions of users without infrastructure management burden.

## Decision

Use **Firebase Authentication** as the identity provider with a custom session server at `auth.headysystems.com` that converts Firebase ID tokens into httpOnly session cookies.

### Why Firebase Auth over Alternatives

| Criteria | Firebase Auth | Auth0 | Keycloak | Custom JWT |
|----------|:---:|:---:|:---:|:---:|
| Zero infrastructure | ✓ | ~ | ✗ | ✗ |
| Free tier (50K MAU) | ✓ | ✗ | ✓ | ✓ |
| Google OAuth native | ✓ | ✓ | ✓ | ~ |
| Anonymous → upgrade | ✓ | ✗ | ✗ | ~ |
| Cross-domain SSO | Custom relay | Built-in | Built-in | Custom |
| GCP integration | Native | Plugin | Manual | Manual |

### Auth Flow Architecture

```
User clicks "Sign In"
  → Firebase Auth SDK (client)
  → Firebase ID token (JWT)
  → POST to auth.headysystems.com/session
  → Verify Firebase ID token (server)
  → Create httpOnly __heady_session cookie
  → Set on .headysystems.com (all subdomains)
  → Relay iframe propagates to headyme.com, headyconnection.org, etc.
```

## Consequences

### Positive

- Zero auth infrastructure to manage — Firebase scales automatically
- Native Google OAuth (majority of Heady users)
- Anonymous auth enables instant onboarding (no friction)
- Firebase Admin SDK gives server-side token verification
- Free for current scale

### Negative

- Firebase lock-in for identity storage
- Cross-domain relay iframe adds complexity
- Custom session server needed for httpOnly cookies (Firebase SDK uses localStorage by default — security violation)
- No built-in RBAC — must build custom role hierarchy

### Mitigations

- Session server abstracts Firebase dependency — swappable
- RBAC implemented in AuthManager (`07-auth-manager.js`)
- Cookie-based sessions with client fingerprint binding prevent replay attacks
