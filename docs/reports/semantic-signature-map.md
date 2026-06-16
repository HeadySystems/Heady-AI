<!-- ⚠️ GENERATED REPORT — DO NOT EDIT DIRECTLY -->
# HEADY™ Codebase Semantic & Signature Map
**Generated on:** 2026-06-16T18:22:06.746Z · **Type:** Merkle Signature Scan

---

## 1. Merkle Tree Root Hash: `553dc2086a605e8682934c8ed13dbae4f2b95a33a6fef40f9ff3c696acd27b04`

## 2. Package Signatures Registry
| Package File | Exports | Classes |
|---|---|---|
| `.agents/skills/heady-perplexity/scripts/perplexity-connector.js` | *None* | *None* |
| `.claude/hooks/heady-rules.mjs` | *None* | *None* |
| `.claude/hooks/skeleton-guard-hook.mjs` | *None* | *None* |
| `.claude/skills/heady-perplexity/scripts/perplexity-connector.js` | *None* | *None* |
| `apps/headyme-portal/src/components/AdminUI.js` | `AdminUI (class)` | `AdminUI` |
| `apps/headyme-portal/src/components/OnboardingUI.js` | `OnboardingUI (class)` | `OnboardingUI` |
| `apps/headyme-portal/src/counter.js` | `setupCounter (function)` | *None* |
| `apps/headyme-portal/src/main.js` | *None* | *None* |
| `apps/headyme-portal/src/services/firebase.js` | `auth (const)` | *None* |
| `packages/config/src/index.mjs` | `parseYaml (function)`<br>`validateFacts (function)`<br>`loadFacts (function)`<br>`getFact (function)`<br>`requireEnv (function)` | *None* |
| `packages/config/test/config.test.mjs` | *None* | *None* |
| `packages/contracts/src/index.mjs` | `loadSpec (function)`<br>`generateMcpTools (function)`<br>`spec (const)` | *None* |
| `packages/contracts/test/contracts.test.mjs` | *None* | *None* |
| `packages/csl-engine/src/index.mjs` | `DIM (const)`<br>`dot (function)`<br>`magnitude (function)`<br>`normalize (function)`<br>`cosineSimilarity (function)`<br>`sigmoid (function)`<br>`cslAND (function)`<br>`cslOR (function)`<br>`cslNOT (function)`<br>`cslIMPLY (function)`<br>`cslXOR (function)`<br>`cslCONSENSUS (function)`<br>`cslBlend (function)`<br>`cslGate (function)` | *None* |
| `packages/csl-engine/test/csl.test.mjs` | *None* | *None* |
| `packages/db/src/index.mjs` | `VECTOR_DIM (const)`<br>`TABLES (const)`<br>`TASK_STATUS (const)`<br>`idempotencyKey (function)`<br>`buildOutboxRecord (function)`<br>`assertEmbedding (function)`<br>`isValidStatus (function)` | *None* |
| `packages/db/test/db.test.mjs` | *None* | *None* |
| `packages/embedding/src/acquire-tiers.ts` | `kvTier (function)`<br>`vectorizeTier (function)`<br>`pgvectorTier (function)`<br>`acquireEmbedding (function)` | *None* |
| `packages/embedding/src/core.d.ts` | `LOCKED_MODEL (const)`<br>`assertModelLock (function)`<br>`normalizeContent (function)`<br>`contentHash (function)`<br>`vectorKey (function)`<br>`idempotencyKey (function)`<br>`significantDigest (function)`<br>`significanceGate (function)`<br>`dedupLookup (function)`<br>`DEFAULT_TIER_ORDER (const)`<br>`acquire (function)`<br>`JOB_STATES (const)`<br>`nextState (function)`<br>`isTerminal (function)`<br>`ACQUISITION_RULES (const)` | *None* |
| `packages/embedding/src/core.mjs` | `LOCKED_MODEL (const)`<br>`assertModelLock (function)`<br>`normalizeContent (function)`<br>`contentHash (function)`<br>`vectorKey (function)`<br>`idempotencyKey (function)`<br>`significantDigest (function)`<br>`significanceGate (function)`<br>`dedupLookup (function)`<br>`DEFAULT_TIER_ORDER (const)`<br>`acquire (async function)`<br>`JOB_STATES (const)`<br>`nextState (function)`<br>`isTerminal (function)`<br>`ACQUISITION_RULES (const)` | *None* |
| `packages/embedding/src/corpus.mjs` | `leafHash (function)`<br>`buildMerkleIndex (function)`<br>`diffMerkle (function)`<br>`planCorpusEmbedding (function)` | *None* |
| `packages/embedding/src/embedder.ts` | `WorkersAIEmbedder (class)` | `WorkersAIEmbedder` |
| `packages/embedding/src/index.ts` | *None* | *None* |
| `packages/embedding/src/schema.ts` | `vectors (const)`<br>`embeddingLedger (const)`<br>`embeddingJobs (const)` | *None* |
| `packages/embedding/src/workflow.ts` | `runEmbedPipeline (async function)` | *None* |
| `packages/embedding/test/core.test.mjs` | *None* | *None* |
| `packages/embedding/test/corpus.test.mjs` | *None* | *None* |
| `packages/events/src/index.mjs` | `SUBJECT (const)`<br>`subjectMatches (function)`<br>`buildEvent (function)`<br>`InMemoryBus (class)`<br>`projectOutbox (async function)` | `InMemoryBus` |
| `packages/events/test/events.test.mjs` | *None* | *None* |
| `packages/kernel/src/index.mjs` | `defineService (function)`<br>`Kernel (class)` | `Kernel`, `ConflictName` |
| `packages/kernel/test/kernel.test.mjs` | *None* | *None* |
| `packages/logger/src/index.mjs` | `LEVELS (const)`<br>`runWithTrace (function)`<br>`currentTraceId (function)`<br>`createLogger (function)`<br>`logger (const)` | *None* |
| `packages/logger/test/logger.test.mjs` | *None* | *None* |
| `packages/observability/src/index.mjs` | `Metrics (class)`<br>`metrics (const)`<br>`noopExporter (const)`<br>`startSpan (function)`<br>`captureError (function)` | `Metrics` |
| `packages/observability/test/observability.test.mjs` | *None* | *None* |
| `packages/phi-math/src/index.mjs` | `PHI (const)`<br>`PSI (const)`<br>`PHI2 (const)`<br>`PHI3 (const)`<br>`PSI2 (const)`<br>`PSI3 (const)`<br>`PHI_7 (const)`<br>`HEARTBEAT_MS (const)`<br>`FIB (const)`<br>`fib (function)`<br>`phiThreshold (function)`<br>`CSL_THRESHOLDS (const)`<br>`GATE (const)`<br>`DEDUP_THRESHOLD (const)`<br>`COHERENCE_DRIFT_THRESHOLD (const)`<br>`phiBackoffMs (function)`<br>`phiBackoff (async function)`<br>`CIRCUIT_BREAKER (const)`<br>`phiFusionWeights (function)`<br>`PRESSURE_LEVELS (const)`<br>`ALERT_THRESHOLDS (const)` | *None* |
| `packages/phi-math/test/phi-math.test.mjs` | *None* | *None* |
| `packages/resilience/src/index.mjs` | `BREAKER_STATE (const)`<br>`CircuitBreaker (class)`<br>`withRetry (async function)`<br>`withTimeout (function)`<br>`Bulkhead (class)`<br>`gracefulShutdown (function)` | `CircuitBreaker`, `Bulkhead` |
| `packages/resilience/test/resilience.test.mjs` | *None* | *None* |
| `packages/secrets/src/cli.mjs` | *None* | *None* |
| `packages/secrets/src/core.mjs` | `validateSecret (function)`<br>`resolveSecrets (async function)` | *None* |
| `packages/secrets/src/index.mjs` | `SecretsError (class)`<br>`loadSecrets (async function)` | `SecretsError` |
| `packages/secrets/src/providers.mjs` | `envProvider (function)`<br>`gcloudProvider (function)`<br>`autoProvider (function)`<br>`providerFor (function)` | *None* |
| `packages/secrets/src/registry.mjs` | `ROTATION_STRATEGIES (const)`<br>`SECRETS (const)`<br>`specFor (function)`<br>`SECRET_NAMES (const)` | *None* |
| `packages/secrets/src/rotation.mjs` | `planRotation (function)`<br>`partitionPlan (function)` | *None* |
| `packages/secrets/test/secrets.test.mjs` | *None* | *None* |
| `packages/security-mesh/src/index.mjs` | `signRequest (function)`<br>`verifyRequest (function)`<br>`authorize (function)`<br>`can (function)`<br>`redactSecrets (function)`<br>`scanPromptInjection (function)`<br>`buildCSP (function)`<br>`BREAKER (const)`<br>`newTraceId (function)` | *None* |
| `packages/security-mesh/test/security-mesh.test.mjs` | *None* | *None* |
| `packages/shared/src/index.mjs` | `HeadyError (class)`<br>`ValidationError (class)`<br>`NotFoundError (class)`<br>`UnauthorizedError (class)`<br>`ConflictError (class)`<br>`RateLimitError (class)`<br>`UpstreamError (class)`<br>`ok (function)`<br>`err (function)`<br>`isOk (const)`<br>`isErr (const)`<br>`unwrap (function)`<br>`mapResult (function)`<br>`assert (function)`<br>`HEALTH (const)`<br>`makeHealth (function)`<br>`SERVICE_METHODS (const)`<br>`isService (function)` | `HeadyError`, `ValidationError`, `NotFoundError`, `UnauthorizedError`, `ConflictError`, `RateLimitError`, `UpstreamError` |
| `packages/shared/test/shared.test.mjs` | *None* | *None* |
| `scratch/migrate_skills.js` | *None* | *None* |
| `tooling/auto-flow/flows/skill-preflight.flow.mjs` | `skillPreflightFlow (const)` | *None* |
| `tooling/auto-flow/preflight.mjs` | `preflight (function)` | *None* |
| `tooling/decomposition/src/decompose.mjs` | *None* | *None* |
| `tooling/doc-hydrator/hydrate.mjs` | *None* | *None* |
| `tooling/doc-hydrator/scripts/fetch-infra-state.mjs` | *None* | *None* |
| `tooling/embed-corpus/src/embed.mjs` | *None* | *None* |
| `tooling/embed-corpus/src/embedder.mjs` | `hfTokenPresent (function)`<br>`resolveEmbedder (function)` | *None* |
| `tooling/embed-corpus/src/pipeline.mjs` | `EMBED_BATCH (const)`<br>`embedJobs (async function)`<br>`mergeOutbox (function)` | *None* |
| `tooling/embed-corpus/src/store.mjs` | `FILES (const)`<br>`createStore (function)` | *None* |
| `tooling/embed-corpus/test/workflow.test.mjs` | *None* | *None* |
| `tooling/skeleton-guard/audit-orphans.mjs` | `auditOrphans (function)` | *None* |
| `tooling/skeleton-guard/verify-placement.mjs` | `verifyPlacement (function)`<br>`toRelative (function)` | *None* |
| `tooling/skill-registry/register.mjs` | *None* | *None* |
| `tooling/skill-registry/validate.mjs` | `validate (function)` | *None* |