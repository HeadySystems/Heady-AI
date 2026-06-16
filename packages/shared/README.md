# @heady/shared

Cross-cutting primitives imported across the monorepo. Zero deps, ESM.

- **Errors:** `HeadyError` + `ValidationError`/`NotFoundError`/`UnauthorizedError`/`ConflictError`/`RateLimitError`/`UpstreamError` — each with `code`/`status`/`context` and a leak-free `toJSON()`.
- **Result<T,E>:** `ok`/`err`/`isOk`/`isErr`/`unwrap`/`mapResult` — explicit success/failure without thrown control flow.
- **Health + contract:** `makeHealth(checks)` (worst-status wins), `isService(obj)` / `SERVICE_METHODS` — the Latent Service Pattern `{start,stop,health,metrics}` (used by `@heady/kernel`).
- `assert(cond, msg)` → `ValidationError`.

`pnpm --filter @heady/shared test`.
