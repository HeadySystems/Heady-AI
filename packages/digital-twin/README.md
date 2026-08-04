# @heady/digital-twin

Pure, deterministic **digital-twin engine** — 384D entity twins with φ-weighted behavioral
decay, cosine similarity, and what-if perturbation simulation. Wave-1 legacy recovery (ADR-0045).

> **Provenance:** public-domain vector math ported from the legacy digital-twin service.
> The CSL **verdict** banding (HS-2026-058) is **not** in this package — `simulate` /
> `twinSimilarity` return raw metrics; band them via `@heady/csl-engine.cslGate` (ADR-0045).
>
> ⚠️ **Storage guard (ADR-0015):** twin embeddings are *synthetic* SHA-256-seeded vectors,
> **not** `bge-small-en-v1.5` retrieval embeddings — never write them into the canonical
> pgvector index or commingle them with real embeddings.

## API (pure, deterministic)

| Function | Purpose |
|----------|---------|
| `createTwin(entityId, profile?)` | Deterministic 384D twin (embedding seeded by SHA-256 of `entityId`). |
| `updateBehavior(twin, key, value, {now?})` | Record a behavior; φ-decay the prior weight; shift the embedding. Returns a new twin (pure). |
| `twinSimilarity(a, b)` | Cosine similarity of two twins' embeddings (raw). |
| `simulate(twin, {name?, perturbations?})` | What-if: perturb a copy → `{drift, coherence, risk, embeddingDelta}` (raw; no gate). |

## Example

```js
import { createTwin, updateBehavior, simulate } from "@heady/digital-twin";
import { cslGate, GATE } from "@heady/csl-engine"; // band the raw metric yourself

let t = createTwin("user-42", { type: "user", behaviors: { logins: 3 } });
t = updateBehavior(t, "logins", 4, { now: Date.now() });
const s = simulate(t, { name: "load-spike", perturbations: { latency: 2, load: 3 } });
// s.coherence is raw — the SAFE/REVIEW/BLOCK decision is cslGate's job, not this package's.
```

## Test

```bash
node --test        # pure unit tests, no external services
```
