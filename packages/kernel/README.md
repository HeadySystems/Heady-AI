# @heady/kernel

The microkernel. Every service implements the **Latent Service Pattern** `{start,stop,health,metrics}` (AGENTS.md); the kernel boots them in dependency order, aggregates health/metrics, and shuts down in reverse.

```js
import { Kernel, defineService } from "@heady/kernel";

const db   = defineService({ name: "db",   deps: [],      start, stop, health, metrics });
const api  = defineService({ name: "api",  deps: ["db"],  start, stop, health, metrics });

const kernel = new Kernel();
kernel.register(db).register(api);
await kernel.boot();          // topo order: db → api; each start retried + time-bounded (@heady/resilience)
await kernel.health();        // aggregate — worst service status wins
await kernel.shutdown();      // stop in reverse; collects errors
```

Rejects unknown deps, dependency cycles, and duplicate names. Depends on `@heady/shared`, `@heady/resilience`, `@heady/logger`. `pnpm --filter @heady/kernel test`.
