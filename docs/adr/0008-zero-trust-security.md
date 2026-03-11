# ADR-006: Zero Trust Security Model

**Status:** Accepted
**Date:** 2025-12-01
**Authors:** Eric Haywood

## Context

Heady™ is a distributed AI operating system with 50+ microservices, 9 external websites, WebSocket real-time connections, and autonomous agent swarms. Traditional perimeter-based security (firewall → trusted internal network) is inadequate because:

1. Services communicate over internal networks that could be compromised
2. Autonomous agents execute code and make API calls without human oversight
3. Multiple third-party model providers (OpenAI, Anthropic, Google) handle sensitive data
4. Cross-domain authentication spans 9+ domains

## Decision

Adopt a **Zero Trust** security model: "Never trust, always verify."

### Core Principles

1. **Every request is authenticated** — no implicit trust, even between internal services
2. **Least privilege** — agents and services get minimum required permissions
3. **Defense in depth** — multiple independent security layers
4. **Assume breach** — design for resilience when (not if) a component is compromised

### Implementation Layers

| Layer | Component | File |
|-------|-----------|------|
| 1. Network | CORS policy with domain allowlist | `src/middleware/cors-policy.js` |
| 2. Transport | TLS everywhere, HSTS preload | `src/middleware/security/csp-headers.js` |
| 3. Authentication | JWT + session cookies + API keys | `src/07-auth-manager.js` |
| 4. Authorization | RBAC roles (guest, user, admin, enterprise) | `src/07-auth-manager.js` |
| 5. Input validation | Prompt injection defense | `src/middleware/security/prompt-injection-defense.js` |
| 6. WebSocket | Per-frame token validation + rate limiting | `src/middleware/security/websocket-auth.js` |
| 7. Autonomy | Operation allowlist/denylist + confidence gating | `src/security/autonomy-guardrails.js` |
| 8. Output | HTML sanitization + JSON schema validation | `src/middleware/security/prompt-injection-defense.js` |
| 9. Audit | Structured JSON logging for all security events | All security modules |
| 10. CSP | Nonce-based scripts, no unsafe-inline/eval | `src/middleware/security/csp-headers.js` |

## Consequences

### Positive

- Every service independently validates requests — no single point of failure
- Autonomous agents are bounded by guardrails — prevents runaway operations
- Prompt injection is caught before LLM interaction
- WebSocket connections are continuously re-authenticated
- Complete audit trail for security forensics

### Negative

- Performance overhead from per-request auth verification (~2ms per request)
- Complexity of managing keys/secrets across 50+ services
- Development friction — every new service must implement auth middleware

### Mitigations

- Shared auth middleware (`07-auth-manager.js`) reduces per-service implementation
- Token caching with 21s (Fibonacci) TTL reduces verification overhead
- Central secrets management via Google Secret Manager
