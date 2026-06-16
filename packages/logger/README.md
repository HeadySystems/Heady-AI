# @heady/logger

Structured JSON logging that indexes identically on Cloud Run (real `pino` can wrap this core) and Cloudflare Workers (`console`). Pino-shaped records, `X-Heady-Trace-Id` propagation, secret redaction, and φ-sampling.

```js
import { createLogger, runWithTrace } from "@heady/logger";

const log = createLogger({ level: "info", base: { service: "heady-manager" } });
runWithTrace(req.headers["x-heady-trace-id"], () => {
  log.info({ route: "/tasks" }, "request");        // → {"level":30,"levelName":"info","time":…,"traceId":…,"route":"/tasks","msg":"request"}
  log.child({ module: "tasks" }).error({ err }, "boom");
});
```

- **Trace ids** flow via `AsyncLocalStorage` (`runWithTrace`/`currentTraceId`); child loggers inherit bindings.
- **Redaction**: `authorization`, `password`, `token`, `apiKey`, `secret`, `cookie` → `[REDACTED:key]`; `email` partially masked.
- **φ-sampling** (deterministic per trace, FNV-1a): error/warn/info 100%, debug `1/φ²≈0.382`, trace `1/φ³≈0.236` — a request keeps or drops all its low-level lines together.
- Default sink: `process.stdout` (Node) → `console` (Workers); inject your own via `{ sink }`.

Depends on `@heady/phi-math`. Pure ESM. `pnpm --filter @heady/logger test`.
