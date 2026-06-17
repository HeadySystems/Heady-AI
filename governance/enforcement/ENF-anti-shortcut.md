<!-- HEADY_BRAND:BEGIN
  HEADY™ · governance/enforcement/ENF-anti-shortcut.md
  Anti-Shortcut & No-Placeholder enforcement protocol (the "environment enforces" layer).
  ∞ Sacred Geometry · Liquid Intelligence ∞
  © 2026 HeadySystems Inc. — Eric Haywood, Founder
HEADY_BRAND:END -->
---
title: "Enforcement: Anti-Shortcut & No-Placeholder Protocols"
domain: enforcement-protocol
scope: GLOBAL_PERMANENT
enforcement: ABSOLUTE
implements: [LAW-0, LAW-1, LAW-2, ALAW-4]
ci_job: governance
---

# ENFORCEMENT PROTOCOLS

> **Thesis:** *agent proposes, human approves, environment enforces.*
> A rule that is not machine-checked is not a rule — it is a suggestion. These protocols
> are realized by fail-closed CI jobs so the `rebuild` branch is compliant from day one.

## Protocol 1 — Anti-Shortcut (forbidden patterns, auto-block at CI)

The following patterns trigger automatic PR rejection. The authoritative regex set lives in
the enforcer scripts under `tooling/enforcers/`; this table is the human-readable contract.

| Pattern | Why forbidden | Enforcer | Law |
|---|---|---|---|
| `(TODO\|FIXME\|HACK\|XXX\|KLUDGE\|TEMP)` markers | unfinished work shipped | `glass-box.mjs` | LAW-1 |
| `throw new Error('Not implemented')` / stub throws | stub masquerading as code | `glass-box.mjs` | LAW-1 |
| `console.(log\|warn\|error\|debug\|info)` | unstructured logging | `glass-box.mjs` | LAW-2 |
| `catch (e) {}` empty catch / swallowed promise | hidden failure | `glass-box.mjs` | LAW-2 |
| `@ts-ignore` · `@ts-nocheck` · `eslint-disable` (file-wide) | suppressing checks | `glass-box.mjs` | LAW-2 |
| `localhost` · `127.0.0.1` · `0.0.0.0` · hardcoded `:PORT` | non-cloud / local coupling | `no-localhost.mjs` | LAW-0 |
| committed secret material (keys, tokens, PEM) | credential leak | `gitleaks` + `secret-scan.mjs` | LAW-0 |

## Protocol 2 — No-Placeholder

Every committed artifact MUST be complete and runnable. No "coming soon", no fake/mock data in
production paths, no commented-out dead code blocks left as scaffolding. Mock data is permitted
**only** under `**/*.test.*`, `**/__tests__/**`, `**/fixtures/**`, and `**/mocks/**`.

## Protocol 3 — Glass-Box Logging

All runtime observability flows through structured JSON (pino) carrying `X-Heady-Trace-Id`.
The enforcer asserts the absence of `console.*` in shipped source; it does **not** police log
shape (that is the linter's job), keeping the gate fast and deterministic (LAW-5).

## Scope & Exemptions

- **Scanned:** `apps/`, `packages/`, `services/`, `tooling/`, `scripts/`, `workers/`.
- **Exempt:** `**/*.test.*`, `**/__tests__/**`, `**/fixtures/**`, `**/mocks/**`,
  `**/*.md`, `**/*.mdx`, `node_modules/`, `dist/`, `build/`, `.data/`, and this
  `governance/` tree (governance prose legitimately *names* the forbidden tokens).
- A line may carry an explicit, reviewed waiver: `// heady-allow:<rule> — <reason>`.
  Waivers are logged by the enforcer and surface in the CI summary for human approval.

## Disposition

Each rule resolves to one of: **red** (fail-closed, blocks merge), **amber** (advisory signal),
**green** (informational). The current dispositions are recorded in
[`law-enforcers.yaml`](./law-enforcers.yaml), the machine-readable Law→enforcer→CI-job map.

---
*Heady™ — HeadySystems Inc. — Implements the Constitution (`governance/CONSTITUTION.md`).*
