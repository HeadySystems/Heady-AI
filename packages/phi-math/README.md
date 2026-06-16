# @heady/phi-math

The golden-ratio foundation for the Heady monorepo. **Zero magic numbers** — every timeout, TTL, pool size, backoff, and threshold derives from φ (AGENTS.md #8).

```js
import { PHI, PSI, FIB, fib, phiThreshold, GATE, phiBackoff, phiBackoffMs, CIRCUIT_BREAKER } from "@heady/phi-math";

PHI            // 1.618033988749895
PSI            // 0.618033988749895  (1/φ)
FIB[10]        // 55                 — Fibonacci (index 0 = 0)
fib(25)        // 75025              — extends beyond the cache
GATE           // { HALT: 0.382 (ψ²), EXECUTE: 0.618 (ψ) }  — ternary-gate bands
phiThreshold(2)// 0.809             — φ-tiered confidence level
phiBackoffMs(3)// 4236              — retry delay ms (1000·φⁿ)
await phiBackoff(2)                 // sleeps 2618ms, returns 2618
```

Exports: core constants (`PHI`, `PSI`, `PHI2`, `PHI3`, `PSI2`, `PSI3`, `PHI_7`, `HEARTBEAT_MS`), `FIB`/`fib`, `phiThreshold`/`CSL_THRESHOLDS`/`GATE`, `phiBackoff`/`phiBackoffMs`/`CIRCUIT_BREAKER`, `phiFusionWeights`, `PRESSURE_LEVELS`/`ALERT_THRESHOLDS`, `DEDUP_THRESHOLD`/`COHERENCE_DRIFT_THRESHOLD`.

Pure, dependency-free, ESM. `pnpm --filter @heady/phi-math test` (or `node --test`).
