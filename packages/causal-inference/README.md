# @heady/causal-inference

Pure, deterministic **causal-inference engine** — Judea Pearl's Ladder of Causation ported
into rebuild conventions. First Wave-1 item of the legacy→rebuild roadmap (ADR-0040).

> **Provenance:** the causal core (SCM, do-operator, counterfactuals, Monte-Carlo) is
> **public-domain Pearl math — not Heady IP** and is deliberately not patent-locked. The
> legacy `/pipeline/assess` CSL stage-gate (HS-2026-058) is **deferred** and, when added,
> delegates to `@heady/csl-engine` — see ADR-0040.

## API

All functions are pure (no IO) and deterministic. Constants come from `@heady/phi-math`.

| Function | Purpose |
|----------|---------|
| `createModel(spec)` | Build a structural causal model (DAG of nodes + mechanisms). |
| `topologicalSort(nodes)` | Parents-before-children order; throws on cycles. |
| `intervene(model, interventions)` | Pearl **do-operator**: force values, sever incoming arrows, propagate. |
| `counterfactual(model, factual, intervention)` | Three-step counterfactual (abduction → action → prediction) with per-node deltas. |
| `monteCarloSimulate(model, interventions, options?)` | Seeded Monte-Carlo over noisy interventions → per-node distribution stats. |
| `seededRandom(seed)` | Deterministic `mulberry32` PRNG. |

## Example

```js
import { createModel, intervene, counterfactual } from "@heady/causal-inference";

const model = createModel({
  nodes: [
    { id: "rain", initialValue: 0 },
    { id: "sprinkler", parents: ["rain"], mechanism: ([rain]) => (rain > 0 ? 0 : 1) },
    { id: "wet", parents: ["rain", "sprinkler"], mechanism: ([rain, spr]) => Math.max(rain, spr) },
  ],
});

intervene(model, { sprinkler: 1 });          // do(sprinkler=1) → { rain, sprinkler:1, wet:1 }
counterfactual(model, { rain: 1, wet: 1 }, { rain: 0 }); // "had it not rained…"
```

## Test

```bash
node --test        # pure unit tests, no external services
```
