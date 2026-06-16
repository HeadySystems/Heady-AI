# @heady/resilience

Failure-handling primitives, φ-scaled (AGENTS.md).

```js
import { CircuitBreaker, withRetry, withTimeout, Bulkhead, gracefulShutdown } from "@heady/resilience";

const cb = new CircuitBreaker({ threshold: 5 });   // opens after 5 fails, φ cooldown, half-open probe
await cb.exec(() => callUpstream());
await withRetry(fn, { retries: 3 });               // φ-backoff: 1618ms · 2618ms · 4236ms …
await withTimeout(fn, 5000);                        // reject if slower than 5s
await new Bulkhead({ limit: 3 }).run(fn);           // cap concurrency, fail-fast when full
gracefulShutdown([closeDb, drainQueue]);            // run cleanups (reverse) on SIGTERM/SIGINT
```

Depends on `@heady/phi-math`, `@heady/shared`. `pnpm --filter @heady/resilience test`.
