<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  HEADY™ SECURITY POLICY                                           ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Zero-Trust · Sovereign Identity            ║
<!-- ║  FILE: SECURITY.md · LAYER: root                                 ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# Security Policy

## Reporting a vulnerability

Report suspected vulnerabilities privately to **security@headysystems.com**.
Do **not** open a public issue for undisclosed vulnerabilities. Include repro
steps, affected paths, and impact. We acknowledge within 48h and target a
remediation plan within one φ-week (5 business days).

## Secrets

- **Never commit secrets.** Credentials come from **GCP Secret Manager via
  keyless OIDC (ADR-0008)** or an uncommitted local `.env` (excluded by
  `.gitignore` and `Dockerfile`). See `.env.example` for the template.
- Direct credential storage in code or `.env` under version control is blocked
  by the secret-scan enforcer (`tooling/enforcers/secret-scan.mjs`) and
  gitleaks (`.gitleaks.toml` when present). Pre-commit hooks run these locally.
- API keys at rest are encrypted with `VAULT_PASSPHRASE`; inter-service calls
  authenticate with `INTERNAL_NODE_SECRET`.

## Boundaries & controls

- **Zod validation** on every input crossing a service boundary — no
  unvalidated data reaches a handler.
- **Zero-trust MCP gateway**: MCP tools are tier-gated in `configs/mcp-tools.json`
  (tier1 auto, tier2 session-scoped, tier3 human-in-the-loop with Ed25519 trust
  receipts). Destructive tools never auto-approve.
- **CORS** is allowlist-only (`src/middleware/cors.js` / `cors-config.js`);
  no wildcard origins in production.
- **Security headers** and rate limiting are applied via
  `src/middleware/security-headers.js` and `src/security/rate-limiter.js`.
- **PQC**: post-quantum crypto primitives live in `src/security/pqc.js`
  (see `scripts/pqc-scanner.js` and the ADR-0019+ series).
- **Patent-lock zones** (`⚠️ PATENT LOCK`, HS-2026-051…062) require ARBITER
  review before modification.

## Supported surfaces

Security fixes land on both first-class branches (`main` and `rebuild`) per the
dual-active branch strategy; they are ported, never merged across.

---

*∞ Sacred Geometry · Liquid Intelligence · Permanent Life ∞*
*© 2026 HeadySystems Inc. — Eric Haywood, Founder*
