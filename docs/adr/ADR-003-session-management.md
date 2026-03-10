# ADR-003: httpOnly Cookie Session Management

**Status:** Accepted  
**Date:** 2026-03-09

## Context
Auth tokens stored in `localStorage` are vulnerable to XSS attacks. Multiple files (`template-bee.js`, `generate-verticals.js`) stored tokens in `localStorage`.

## Decision
- Replace `localStorage` token storage with `sessionStorage` for ephemeral client state
- Store persistent auth in `httpOnly; Secure; SameSite=Strict` cookies
- New `auth-session-server` microservice manages cookie lifecycle
- Server-side session validation via `/api/auth/session`

## Consequences
- Tokens no longer accessible to injected scripts
- Session expires on browser close (sessionStorage) or 24h (cookie)
- All auth flows use `credentials: 'include'` for cookie transmission
