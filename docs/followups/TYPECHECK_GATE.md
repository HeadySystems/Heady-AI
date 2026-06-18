# Follow-up: wire a real `typecheck` CI gate

**Status:** open · **Opened:** 2026-06-17 · **Owner:** platform

## Why this exists

`.github/workflows/ci.yml` previously ran `pnpm turbo run typecheck`, but no `typecheck`
task was ever defined in `turbo.json` and no package had a `typecheck` script. The step
failed with `Could not find task 'typecheck' in project` — and because it ran *before*
`test`/`build` in the `verify` job, it blocked the real gates from running in CI at all.

It was removed (commit greening the SoT CI) rather than stubbed: a no-op `typecheck: {}`
turbo task would "succeed" while checking nothing, which violates the AGENTS.md no-placeholder
rule (a green gate that verifies nothing).

## The actual TS surface

| Path | Type checker today | Gap blocking a standalone `tsc` |
|------|--------------------|---------------------------------|
| `packages/embedding/src/*.ts` | built at deploy | declares **no deps** yet imports `drizzle-orm/pg-core` + `@heady/*` — needs deps declared |
| `apps/heady-edge-gatekeeper/src/index.ts` | wrangler/esbuild | has `typescript`+`hono`+`zod`; closest to ready |
| `apps/heady-portal-proxy/src/index.ts` | wrangler/esbuild | only `wrangler` dep; needs `@cloudflare/workers-types` |
| `apps/heady-portal-gateway/src/index.ts` | wrangler/esbuild | only `wrangler` dep; needs `@cloudflare/workers-types` |

Probe (`tsc --noEmit --skipLibCheck --moduleResolution bundler`): embedding = 1 error
(the undeclared `drizzle-orm`), edge app = 0. So the code is essentially clean — the gap is
**dependency/tsconfig declaration**, not type errors.

## Definition of done

1. Each TS package declares its real deps (incl. `@cloudflare/workers-types` for the
   wrangler apps, `drizzle-orm` for embedding) and a `tsconfig.json`
   (`noEmit`, `skipLibCheck`, `moduleResolution: bundler`, `module: esnext`, `target: es2022`).
2. Each adds `"typecheck": "tsc --noEmit"`.
3. Add a `typecheck` task to `turbo.json` (`{ "dependsOn": ["^build"] }` if needed).
4. Add `typescript` to root devDependencies.
5. Restore the `- name: typecheck` step in the `verify` job (before `test`).
6. Verify `pnpm turbo run typecheck` is green locally and in CI.
