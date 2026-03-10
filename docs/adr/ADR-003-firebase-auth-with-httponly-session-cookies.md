   # ADR-003: Firebase Auth with httpOnly Session Cookies

   **Status:** Accepted
   **Date:** 2026-01-15
   **Author:** Eric Haywood
   **Heady Systems Inc. — Sacred Geometry v4.0**

   ## Problem

   How to handle authentication across 9 domains

   ## Decision

   Firebase Auth for identity, converted to httpOnly session cookies via auth relay

   ## Consequences

- Firebase handles OAuth (Google), email/password, and anonymous auth
- auth-relay service converts Firebase ID tokens to __Host-heady_session cookies
- Cookies are httpOnly, Secure, SameSite=None, Domain=.headysystems.com
- Cross-domain relay via postMessage iframe at auth.headysystems.com
- Session bound to client (IP hash + User-Agent hash) to prevent replay attacks
- NO localStorage for tokens — EVER (Unbreakable Law)

   ---
   *© 2026 HeadySystems Inc. — 51 Provisional Patents*
