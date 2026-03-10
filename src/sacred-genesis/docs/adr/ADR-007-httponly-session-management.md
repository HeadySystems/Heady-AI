# ADR-007: httpOnly Cookie Session Management

## Status
Accepted

## Date
2026-01-15

## Context
The Heady platform requires authenticated sessions for all user-facing services. Common approaches include JWT tokens stored in localStorage, bearer tokens in Authorization headers, and httpOnly cookie-based sessions. LocalStorage-based token storage is vulnerable to Cross-Site Scripting (XSS) attacks — any script executing in the page context can read tokens from localStorage and exfiltrate them to attacker-controlled servers. For a sovereign AI platform that processes sensitive organizational intelligence, this attack vector is unacceptable.

## Decision
We mandate httpOnly cookie-based session management for all Heady user-facing services. The session server (port 3373) issues cryptographically secure session identifiers stored in httpOnly, Secure, SameSite=Strict cookies. Session IDs are SHA-256 hashed before storage, preventing replay attacks even if the session store is compromised. CSRF protection uses a companion token with double-submit cookie validation.

Session TTL is fib(17) seconds (1,597 seconds, approximately 26.6 minutes) with sliding window renewal on activity. Maximum concurrent sessions per user is fib(6) = 8, with LIFO eviction of oldest sessions when the limit is reached. Maximum total sessions is fib(16) = 987, with periodic cleanup of expired sessions every fib(10) = 55 seconds.

No tokens, session identifiers, or authentication credentials are ever stored in localStorage, sessionStorage, or any other client-side JavaScript-accessible storage mechanism. This is an absolute requirement across all Heady services.

## Consequences

### Benefits
httpOnly cookies are immune to XSS-based token theft — JavaScript cannot access httpOnly cookie values. SameSite=Strict prevents CSRF attacks by ensuring cookies are only sent with same-site requests. SHA-256 hashing of session IDs before storage means a compromised session store cannot be used to impersonate users. Sliding window TTL balances security (short sessions) with usability (active users stay authenticated).

### Risks
httpOnly cookies require server-side session state, which adds infrastructure complexity. We accept this cost as necessary for the security guarantees required by a sovereign AI platform. Cookie-based sessions do not naturally support pure API clients. We provide OAuth 2.1 with PKCE for API authentication, keeping cookie-based sessions for browser-based user interfaces only.

### Related ADRs
ADR-006 (self-healing), ADR-008 (zero-trust architecture)
