# ADR-0044: ESM-Only Module System

- **Status:** Accepted (original date unrecorded, legacy corpus) · Transferred to canonical corpus 2026-08-09
- **Deciders:** Eric Anthony Haywood

## Context

Mixed module systems (CJS + ESM) cause import resolution issues and prevent tree-shaking. Node.js has
full ESM support; there is no remaining technical reason to carry CommonJS.

## Decision

1. All modules use `export default` and named `export {}`.
2. **No `module.exports` or `require()` anywhere.**
3. Every `package.json` includes `"type": "module"`.
4. Dynamic imports via `import()` where needed.

## Consequences

- (+) Consistent module resolution across the monorepo.
- (+) Tree-shaking enabled.
- (+) Top-level `await` supported.
- (+) All imports are statically analyzable.
- (−) CommonJS-only dependencies must be consumed through ESM interop or replaced.

## Reconciliation (2026-08-09 transfer)

- **Machine-enforced today by `tooling/law-lint`**
  (`/home/headyme/Heady-AI/tooling/law-lint/src/law-lint.mjs`): the linter scans substrate sources for
  CommonJS `require()` and fails closed with "AGENTS.md #1: ESM only — no CommonJS require()". It
  carries exactly one narrow, documented single-file exemption (the heady-desktop Electron preload,
  where an ESM preload would force the sandbox off — a real security downgrade to satisfy a style
  law); everything else stays ESM.
- **Stated as a hard rule** in both governance surfaces: `AGENTS.md` hard rule #1 ("ESM only.
  `import/export`, never `require()`") and `CLAUDE.md` non-negotiable rule #1.
- **Verified in the rebuild:** all 28 `packages/*` manifests declare `"type": "module"`.
- Original decision content is carried unchanged; only the enforcement reality (law-lint, the single
  security-motivated exemption, and the rule's placement in AGENTS.md/CLAUDE.md) is new information
  added at transfer time.

## Provenance

- Source: `/home/headyme/_archive/Heady/docs/adrs/004-esm-exports-only.md` (Accepted, undated;
  legacy corpus).
- Live enforcement: `/home/headyme/Heady-AI/tooling/law-lint/src/law-lint.mjs` +
  `/home/headyme/Heady-AI/AGENTS.md` (hard rule #1) + `/home/headyme/Heady-AI/CLAUDE.md` (rule #1).
- Transferred into the canonical corpus 2026-08-09; the original remains in place in the archive.
