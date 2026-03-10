# Heady™ Auth & Security v4.0.0

**Author:** Eric Haywood / HeadySystems Inc. — 51 Provisional Patents

---

## Authentication

### OAuth 2.1 + OIDC
- Providers: Google, GitHub (extensible)
- Auth code flow with PKCE
- httpOnly cookies for session tokens — **NEVER localStorage**
- Session TTL: FIB[13] × 60 = 22,620 seconds (≈ 6.3 hours)
- Refresh TTL: FIB[15] × 60 = 36,600 seconds (≈ 10.2 hours)

### Session Management
- Server-side sessions in Redis
- httpOnly, Secure, SameSite=Strict cookies
- Automatic refresh before expiry
- Session check interval: FIB[8] × 1000ms (34 seconds)
- φ-backoff on failed session checks

### RBAC
- Roles: admin, developer, user, viewer, service
- Permission matrix per service endpoint
- Zero-trust: every request authenticated + authorized

## Security Middleware (OWASP)

### Headers
- Strict-Transport-Security (HSTS)
- Content-Security-Policy (CSP)
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin

### Input Validation
- Request body size limit: FIB[16] × 1024 bytes (≈ 1MB)
- SQL injection prevention via parameterized queries
- XSS prevention via output encoding
- CSRF protection via double-submit cookies

### Rate Limiting
- φ-bucketed sliding window per client
- Limit: FIB[12] = 144 requests per minute (standard)
- Limit: FIB[8] = 21 requests per minute (auth endpoints)
- Limit: FIB[5] = 5 requests per minute (password reset)

## Zero-Trust Policy Engine
- All inter-service communication authenticated
- mTLS between services via Envoy proxy
- Network policies restrict pod-to-pod communication
- Audit logging for all sensitive operations

## Encryption
- At rest: AES-256-GCM
- In transit: TLS 1.3
- Secrets: environment variables, never in code

---

© 2026 Eric Haywood / HeadySystems Inc.
