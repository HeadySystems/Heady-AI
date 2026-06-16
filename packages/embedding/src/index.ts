// @heady/embedding — public API.
// Pure core (runnable anywhere) + canonical platform edges (Cloudflare/Neon/Workers AI).
export * from "./core.mjs";
export { WorkersAIEmbedder, type Embedder } from "./embedder.js";
export { runEmbedPipeline, type EmbedJobPayload, type EmbedResult } from "./workflow.js";
export {
  kvTier, vectorizeTier, pgvectorTier, acquireEmbedding,
} from "./acquire-tiers.js";
export { vectors, embeddingLedger, embeddingJobs } from "./schema.js";
export {
  leafHash, buildMerkleIndex, diffMerkle, planCorpusEmbedding,
} from "./corpus.mjs";
