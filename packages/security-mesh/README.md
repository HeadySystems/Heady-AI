# @heady/security-mesh

Trust-boundary primitives. Every decision **fails closed** (SEC-002). ⚠️ **PATENT zone** (HS-2026-051+); changes require ARBITER review. Secret *loading* lives in `@heady/secrets` — this package consumes resolved secrets and enforces the boundary.

```js
import { signRequest, verifyRequest, authorize, can, redactSecrets, scanPromptInjection, buildCSP } from "@heady/security-mesh";

signRequest({ method: "POST", path: "/tasks", body, timestamp: Date.now() }, secret); // HMAC-SHA256
verifyRequest(req, sig, secret, { maxSkewMs: 60000 });   // constant-time + replay guard

authorize({ principal }, { env: "production" });          // "ALLOW" | "DENY" — no principal in prod ⇒ DENY
can("viewer", "write", { admin: ["*"], viewer: ["read"] }); // false (unknown action ⇒ deny)
redactSecrets(text);                                       // masks Anthropic/Google/GitHub/PEM shapes
scanPromptInjection(userText);                             // { flagged, score, hits }
buildCSP();                                                // strict default Content-Security-Policy
```

Functions: `signRequest`/`verifyRequest`, `authorize`, `can`, `redactSecrets`, `scanPromptInjection`, `buildCSP`, `newTraceId`, `BREAKER` (φ circuit-breaker policy). Depends on `@heady/phi-math`. `node:crypto` only. `pnpm --filter @heady/security-mesh test`.
