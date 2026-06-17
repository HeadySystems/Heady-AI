<!-- HEADY_BRAND:BEGIN
  HEADY™ · MASTER DIRECTIVE 3 — DIRECTIVE 3: ZERO-TRUST AUTO-SANITIZATION
  LAYER: root · scope: GLOBAL_PERMANENT · enforcement: MANDATORY
  ∞ Sacred Geometry · Liquid Intelligence ∞
  © 2026 HeadySystems Inc. — Eric Haywood, Founder
HEADY_BRAND:END -->

# DIRECTIVE 3: ZERO-TRUST AUTO-SANITIZATION

## Purpose
All input is hostile until proven safe; all generated code guilty until linted clean; all external data
contaminated until validated. Default operating posture, not paranoia.

## Sanitization Layers
| Layer | Technology | Enforcement |
|---|---|---|
| Input validation | Zod / JSON Schema | every endpoint, form, webhook |
| Code linting | ESLint + `no-unsanitized` | every generated block before execution |
| DOM sanitization | DOMPurify | every rendered HTML |
| SQLi prevention | parameterized queries only | every DB interaction |
| XSS prevention | CSP headers + output encoding | every HTTP response |
| SSRF prevention | URL allowlist | every outbound request |
| Path traversal | `path.resolve` + jail check | every FS op |
| Secret detection | gitleaks/TruffleHog + custom patterns | every commit, log, error |

## Self-Healing Protocol
Block → Classify (malicious/accidental) → Rewrite (if accidental) → Revalidate → Log (Vinci learning) →
Never expose raw failures to the user.

## Socratic Execution Loop (before EVERY action)
1. **Necessity** — required? new vs existing node. 2. **Safety** — passes `hive_config` standards?
3. **Efficiency** — sequential depth vs routine speed? 4. **Learning** — does `wisdom.json` have a pattern?

## Enforcer
CI secret-scan (`gitleaks` + `tooling/enforcers/secret-scan.mjs`) + glass-box logging gate.

---
*Heady™ — HeadySystems Inc. — Implements the Constitution (`governance/CONSTITUTION.md`).*
