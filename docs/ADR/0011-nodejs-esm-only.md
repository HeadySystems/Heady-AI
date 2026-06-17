# ADR-0011: Node.js ESM Only — No CommonJS, No TypeScript Runtime
**Date:** 2026-06-17 | **Status:** Accepted | **Author:** Eric Haywood

## Context

The legacy codebase mixed CommonJS (`require()`) and ESM (`import`/`export`). The
`auto-success-engine.ts` existed as a TypeScript file requiring a build step before
execution. This created two build pipelines and an inconsistent module system where
ESM-only packages (many modern Node.js packages) could not be imported from CJS contexts
without workarounds.

The rebuild's SPEC.md Law #2 states: _"Node.js only — ESM exports."_

## Decision

All rebuild code targets Node.js (20 LTS or later) using native ESM:
- All modules use `export default` / `export {}` syntax
- No `require()` calls outside legacy migration shims
- TypeScript is permitted as a type-checking tool in CI only — no `.ts` files execute at runtime
- Python is isolated to `python_worker/` (the Conductor service on Cloud Run) and does not
  share the Node.js module tree
- Native `fetch()` is used throughout — `node-fetch` package is removed

## Consequences

### Positive
- Native ESM enables top-level `await`, dynamic imports, and tree-shaking
- Eliminates the TypeScript build step from the hot path — no `tsc` required to run
- `node-fetch` removal reduces dependency surface; Node 20 native fetch is stable
- Consistent module system prevents the CJS/ESM dual-mode compatibility bugs
- Python/JS separation in `python_worker/` enforces clean language boundaries

### Negative
- Some older packages do not yet ship ESM — CJS-only packages require dynamic `createRequire` shims
- Existing `.ts` files (e.g., `auto-success-engine.ts`) must be migrated to `.js`
- `__dirname` and `__filename` are unavailable in native ESM — `import.meta.url` required instead

## Alternatives Considered

- **TypeScript everywhere (compile to CJS)**: rejected — build step latency, source map complexity
- **TypeScript everywhere (compile to ESM)**: considered — rejected to keep runtime = source
- **Keep CJS**: rejected — blocks import of ESM-only packages that dominate the modern ecosystem
