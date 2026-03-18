# ADR-005: Liquid Deploy — Latent-to-Physical Projection

## Status
Accepted

## Date
2026-03-10

## Context
In the Alive Software Architecture, the "source of truth" is the 384D vector memory — not files on disk. Code changes originate as design intent embeddings in vector space, then get "projected" into physical files in the GitHub monorepo. This projection must be validated against the 3 Unbreakable Laws before the physical repo is mutated.

## Decision
Implement Liquid Deploy as the exclusive path from latent space to physical GitHub repository.

### Projection Pipeline
1. Design intent is represented as a 384D embedding in vector memory
2. SocraticLoop validates the reasoning behind the change
3. Code is generated and represented as a ProjectionUnit (content + design embedding)
4. LiquidDeploy queues the projection (max depth: fib(13) = 233)
5. UnbreakableLawsValidator checks:
   - Law 1: Structural Integrity (score ≥ 0.882)
   - Law 2: Semantic Coherence (score ≥ 0.809)
   - Law 3: Mission Alignment (score ≥ 0.691)
6. Validated projections are written to a git branch
7. Changes > fib(12) = 144 lines require staged deploy (no auto-merge)
8. Smaller validated changes auto-merge if composite score ≥ CSL HIGH

### Rollback
- Rollback window: fib(14) × 60,000 ms ≈ 6.28 hours
- All deployments record previous state for rollback
- Rollback triggers re-validation via HeadyAssure

## Consequences

### Positive
- Every code change is traceable to a design intent embedding
- Automated validation prevents structural/semantic/mission violations
- Staged deploy for large changes prevents batch failures
- Full audit trail with deployment manifests

### Negative
- Adds latency to the deployment pipeline
- Embedder availability is required for full semantic validation
- Large refactors must be broken into batches of ≤ fib(8) = 21 files

## Related
- `src/liquid/liquid-deploy.js` — projection engine
- `src/intelligence/socratic-loop.js` — reasoning validator
- ADR-004 — Self-Healing Lifecycle (healing also uses projection)
