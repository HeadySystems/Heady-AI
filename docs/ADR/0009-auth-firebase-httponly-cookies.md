# ADR-0009: Authentication — Firebase Auth, httpOnly Cookies Only, No localStorage Tokens
**Date:** 2026-06-17 | **Status:** Accepted | **Author:** Eric Haywood

## Context

The legacy codebase had inconsistent token storage: some paths stored JWTs in
localStorage, others in sessionStorage, and the newer auth paths used httpOnly cookies.
This created XSS exposure on the localStorage paths. The rebuild needed a definitive,
enforceable auth stance.

The SPEC.md Unbreakable Laws state: _"httpOnly cookies ONLY — NO localStorage for tokens."_
Firebase Auth was selected as the identity provider supporting 27+ OAuth providers.

## Decision

- **Identity provider:** Firebase Auth (auth.headysystems.com)
- **Token storage:** httpOnly cookies exclusively — localStorage and sessionStorage are
  prohibited for any token, session ID, or credential
- **Session lifecycle:** access tokens at fib(8)=21 minutes TTL, refresh tokens at fib(16)=987 minutes
- **Auth surface:** Central auth at `auth.headysystems.com` — no per-service auth logic
- **MCP auth:** Bearer token via Authorization header (server-to-server flows only)
- **WebSocket auth:** JWT validated at handshake, not per-message
- **Rate limiting:** Fibonacci-tiered — Free=8 req/s, Pro=21 req/s, Enterprise=55 req/s

## Consequences

### Positive
- httpOnly cookies are immune to XSS token theft — eliminates an entire vulnerability class
- Centralised Firebase Auth eliminates per-service auth reimplementation
- 27 OAuth providers available without custom integration work
- phi-scaled TTLs align with the system-wide constants standard
- CORS is tightly scoped — no wildcard fallbacks in production (fixed from IMMEDIATE_ACTION_PLAN)

### Negative
- httpOnly cookies require CORS configuration for cross-domain API calls
- Firebase Auth introduces a vendor dependency for the identity critical path
- Mobile/CLI clients cannot use httpOnly cookies — these require the bearer token path (MCP flows)
- `crypto.timingSafeEqual` must be used in all token comparison paths (legacy timing attack noted in heady-manager.js:223)

## Alternatives Considered

- **Supabase Auth**: considered — rejected due to Firebase's deeper GCP integration
- **Custom JWT service**: rejected — auth is not a differentiator; vendor handles security updates
- **localStorage with encryption**: rejected — encryption at rest does not prevent XSS runtime access
