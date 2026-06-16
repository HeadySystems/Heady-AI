# @heady/csl-engine

Continuous Semantic Logic — **vectors as logic gates** + the 3-layer ternary decision gate. Core Heady IP. ⚠️ **PATENT zone** (HS-2026-051+); changes require ARBITER review.

```js
import { cslGate, cslAND, cslNOT, cosineSimilarity, DIM } from "@heady/csl-engine";

DIM                       // 384 — locked embedding dim (ADR-0015)
cslAND([1,0],[1,0])       // 1.0  — conjunction = cosine similarity
cslNOT(a, b)              // a with its projection onto b removed (orthogonal)

// Ternary gate: combines confidence × relevance (geometric mean), bands by φ thresholds.
cslGate(0.9, 0.9)                                 // "EXECUTE"   (≥ 0.618)
cslGate(0.95, 0.1)                                // "HALT"      (high confidence, low relevance)
cslGate(conf, cos, { halt: 0.382, execute: 0.618 }) // explicit thresholds
```

Gates: `cslAND` (cosine), `cslOR` (superposition), `cslNOT` (orthogonal complement), `cslIMPLY`, `cslXOR`, `cslCONSENSUS`, `cslBlend`. Primitives: `cosineSimilarity`, `dot`, `magnitude`, `normalize`, `sigmoid`. Decision: `cslGate(value, cosScore, tau)`. Re-exports `phiBackoff`/`phiBackoffMs`/`GATE` from `@heady/phi-math`.

Depends on `@heady/phi-math`. Pure ESM, no IO. `pnpm --filter @heady/csl-engine test`.
