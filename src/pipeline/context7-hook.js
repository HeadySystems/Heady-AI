// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/pipeline/context7-hook.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
'use strict';

/**
 * Context7 Pipeline Hook — HCFullPipeline integration middleware.
 *
 * Injects at:
 *   - Stage 1 (Context Assembly): Scans task for library references, pre-resolves IDs
 *   - Stage 4 (Execution): If code generation, queries docs and injects into context
 *
 * CSL-gated: only enriches when resonance >= MEDIUM (0.809)
 * Phi-budgeted: max FIB[15]*100 = 98700 tokens per pipeline run
 *
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 */

const { Context7Adapter } = require('../mcp/context7-adapter');
const {
  extractLibraryNames,
  enrichCodeContext,
  textToVec,
  cosineSimilarity,
  softGate,
} = require('../mcp/context7-registration');
const logger = require('../utils/logger');

// ─── Phi-Math Constants ─────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// ─── CSL Gate Thresholds ────────────────────────────────────────────────────
const CSL_GATES = {
  MINIMUM: 0.500,
  LOW: 0.691,
  MEDIUM: 0.809,
  HIGH: 0.882,
  CRITICAL: 0.927,
  DEDUP: 0.972,
};

// ─── Pipeline Configuration ─────────────────────────────────────────────────
const MAX_TOKENS_PER_RUN = FIB[15] * 100;         // 987 * 100 = 98700
const MAX_TOKENS_PER_LIB = FIB[11] * 100;         // 144 * 100 = 14400
const MAX_LIBRARIES_PER_TASK = FIB[6];             // 13
const ENRICHMENT_THRESHOLD = CSL_GATES.MEDIUM;     // 0.809

// Pipeline stages (matching HCFullPipeline)
const STAGES = {
  CONTEXT_ASSEMBLY: 1,
  INTENT_CLASSIFICATION: 2,
  NODE_SELECTION: 3,
  EXECUTION: 4,
  QUALITY_GATE: 5,
  ASSURANCE_GATE: 6,
  PATTERN_CAPTURE: 7,
  STORY_UPDATE: 8,
};

// Context7 capability description for vector comparison
const CONTEXT7_CAPABILITY_DESC = [
  'documentation', 'library', 'api', 'reference', 'code', 'examples',
  'version', 'framework', 'sdk', 'package', 'docs',
].join(' ');
const CONTEXT7_CAPABILITY_VECTOR = textToVec(CONTEXT7_CAPABILITY_DESC);

// Code generation keywords for stage 4 detection
const CODE_GEN_KEYWORDS = [
  'generate', 'create', 'build', 'implement', 'write', 'code',
  'develop', 'scaffold', 'program', 'function', 'class', 'module',
  'component', 'service', 'api', 'endpoint', 'handler', 'middleware',
];

const log = logger.child ? logger.child({ component: 'context7-pipeline-hook' }) : logger;

/**
 * Detect if a task description involves code generation.
 */
function isCodeGenerationTask(taskDescription) {
  if (!taskDescription) return false;
  const lower = taskDescription.toLowerCase();
  return CODE_GEN_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Context7 Pipeline Hook — middleware for HCFullPipeline.
 *
 * Usage:
 *   pipeline.use(context7PipelineHook);
 *
 * The hook inspects `pipelineContext.stage` and acts accordingly:
 *   - Stage 1: Pre-resolves library IDs, caches them
 *   - Stage 4: Queries docs for code generation tasks, injects into context
 *
 * @param {Object} pipelineContext — The current pipeline context
 * @param {Function} next — Call to continue the pipeline
 */
async function context7PipelineHook(pipelineContext, next) {
  const adapter = pipelineContext.context7Adapter || _getSharedAdapter();
  const stage = pipelineContext.stage;

  // Initialize enrichment tracking on the context
  if (!pipelineContext.context7) {
    pipelineContext.context7 = {
      librariesResolved: 0,
      docsInjected: 0,
      tokenCost: 0,
      cacheHits: 0,
      resolvedIds: new Map(),
      enrichedDocs: [],
    };
  }

  const ctx7 = pipelineContext.context7;
  const taskDescription = pipelineContext.taskDescription || pipelineContext.task || '';

  // ── Stage 1: Context Assembly — Pre-resolve library IDs ───────────────
  if (stage === STAGES.CONTEXT_ASSEMBLY) {
    try {
      // CSL gate check: is this task relevant to Context7?
      const taskVector = textToVec(taskDescription);
      const resonance = cosineSimilarity(taskVector, CONTEXT7_CAPABILITY_VECTOR);

      if (resonance < ENRICHMENT_THRESHOLD) {
        log.debug({
          stage,
          resonance: Number(resonance.toFixed(4)),
          threshold: ENRICHMENT_THRESHOLD,
        }, 'Task below Context7 enrichment threshold — skipping');
        return next ? next() : undefined;
      }

      // Extract library names
      const libraryNames = extractLibraryNames(taskDescription);
      if (libraryNames.length === 0) {
        log.debug({ stage }, 'No library names found in task — skipping');
        return next ? next() : undefined;
      }

      log.info({
        stage,
        resonance: Number(resonance.toFixed(4)),
        libraryCount: libraryNames.length,
        libraries: libraryNames,
      }, 'Stage 1: Pre-resolving library IDs');

      // Resolve IDs concurrently
      const resolutions = await Promise.allSettled(
        libraryNames.map(async (name) => {
          const adapterStats = adapter.getStats();
          const preCacheSize = adapterStats.caches.libraries.size;
          const resolved = await adapter.resolveLibrary(name);
          const postCacheSize = adapter.getStats().caches.libraries.size;

          if (postCacheSize === preCacheSize) {
            ctx7.cacheHits++;
          }

          return { name, resolved };
        })
      );

      for (const settlement of resolutions) {
        if (settlement.status === 'fulfilled' && settlement.value.resolved) {
          const { name, resolved } = settlement.value;
          if (resolved.libraryId) {
            ctx7.resolvedIds.set(name, resolved.libraryId);
            ctx7.librariesResolved++;
          }
        }
      }

      log.info({
        stage,
        librariesResolved: ctx7.librariesResolved,
        cacheHits: ctx7.cacheHits,
      }, 'Stage 1: Library IDs pre-resolved');
    } catch (err) {
      log.error({ stage, error: err.message }, 'Stage 1 Context7 enrichment failed — continuing pipeline');
    }
  }

  // ── Stage 4: Execution — Inject docs for code generation ──────────────
  if (stage === STAGES.EXECUTION) {
    try {
      // Only enrich code generation tasks
      if (!isCodeGenerationTask(taskDescription)) {
        log.debug({ stage }, 'Not a code generation task — skipping doc injection');
        return next ? next() : undefined;
      }

      // CSL gate check
      const taskVector = textToVec(taskDescription);
      const resonance = cosineSimilarity(taskVector, CONTEXT7_CAPABILITY_VECTOR);

      if (resonance < ENRICHMENT_THRESHOLD) {
        log.debug({
          stage,
          resonance: Number(resonance.toFixed(4)),
          threshold: ENRICHMENT_THRESHOLD,
        }, 'Task below enrichment threshold for doc injection');
        return next ? next() : undefined;
      }

      // If no pre-resolved IDs from stage 1, do a full enrichment
      if (ctx7.resolvedIds.size === 0) {
        log.info({ stage }, 'No pre-resolved IDs — performing full enrichment');
        const enrichment = await enrichCodeContext(taskDescription, adapter);
        ctx7.enrichedDocs = enrichment.libraries;
        ctx7.tokenCost = enrichment.totalTokens;
        ctx7.docsInjected = enrichment.libraries.length;
      } else {
        // Query docs for each pre-resolved library
        let tokenBudgetRemaining = MAX_TOKENS_PER_RUN;
        const resolvedEntries = Array.from(ctx7.resolvedIds.entries());

        const docQueries = await Promise.allSettled(
          resolvedEntries.map(async ([name, libraryId]) => {
            if (tokenBudgetRemaining <= 0) return null;

            const tokensForThisLib = Math.min(MAX_TOKENS_PER_LIB, tokenBudgetRemaining);
            const docs = await adapter.queryDocs(libraryId, { tokens: tokensForThisLib });

            const docText = typeof docs === 'string' ? docs : (docs?.content || JSON.stringify(docs));
            const docVector = textToVec(docText.slice(0, 2000));
            const rawSim = cosineSimilarity(taskVector, docVector);
            const relevance = softGate(1.0, rawSim, CSL_GATES.LOW);
            const tokenEstimate = Math.ceil(docText.length / 4);

            tokenBudgetRemaining -= tokenEstimate;

            return { name, id: libraryId, docs, relevance: Number(relevance.toFixed(4)), tokenEstimate };
          })
        );

        for (const settlement of docQueries) {
          if (settlement.status === 'fulfilled' && settlement.value !== null) {
            ctx7.enrichedDocs.push(settlement.value);
            ctx7.tokenCost += settlement.value.tokenEstimate;
            ctx7.docsInjected++;
          }
        }

        // Sort by relevance
        ctx7.enrichedDocs.sort((a, b) => b.relevance - a.relevance);
      }

      // Enforce token budget
      if (ctx7.tokenCost > MAX_TOKENS_PER_RUN) {
        log.warn({
          stage,
          tokenCost: ctx7.tokenCost,
          maxBudget: MAX_TOKENS_PER_RUN,
        }, 'Token budget exceeded — trimming enriched docs');

        let trimmedCost = 0;
        const trimmed = [];
        for (const doc of ctx7.enrichedDocs) {
          if (trimmedCost + doc.tokenEstimate > MAX_TOKENS_PER_RUN) break;
          trimmed.push(doc);
          trimmedCost += doc.tokenEstimate;
        }
        ctx7.enrichedDocs = trimmed;
        ctx7.tokenCost = trimmedCost;
        ctx7.docsInjected = trimmed.length;
      }

      // Inject into execution context
      if (pipelineContext.executionContext) {
        pipelineContext.executionContext.context7Docs = ctx7.enrichedDocs;
        pipelineContext.executionContext.context7TokenCost = ctx7.tokenCost;
      }

      log.info({
        stage,
        docsInjected: ctx7.docsInjected,
        tokenCost: ctx7.tokenCost,
        maxBudget: MAX_TOKENS_PER_RUN,
        topLibrary: ctx7.enrichedDocs[0]?.name,
        topRelevance: ctx7.enrichedDocs[0]?.relevance,
      }, 'Stage 4: Documentation injected into execution context');
    } catch (err) {
      log.error({ stage, error: err.message }, 'Stage 4 Context7 doc injection failed — continuing pipeline');
    }
  }

  // Continue pipeline
  if (next) return next();
}

// ─── Shared Adapter Singleton ───────────────────────────────────────────────
let _sharedAdapter = null;

function _getSharedAdapter() {
  if (!_sharedAdapter) {
    _sharedAdapter = new Context7Adapter();
  }
  return _sharedAdapter;
}

/**
 * Set a custom shared adapter (for testing or config overrides).
 */
function setSharedAdapter(adapter) {
  _sharedAdapter = adapter;
}

/**
 * Get enrichment metrics for the current pipeline run.
 */
function getEnrichmentMetrics(pipelineContext) {
  const ctx7 = pipelineContext?.context7 || {};
  return {
    librariesResolved: ctx7.librariesResolved || 0,
    docsInjected: ctx7.docsInjected || 0,
    tokenCost: ctx7.tokenCost || 0,
    cacheHits: ctx7.cacheHits || 0,
    maxBudget: MAX_TOKENS_PER_RUN,
    budgetUtilization: ctx7.tokenCost ? Number((ctx7.tokenCost / MAX_TOKENS_PER_RUN).toFixed(4)) : 0,
    enrichedLibraries: (ctx7.enrichedDocs || []).map((d) => ({
      name: d.name,
      relevance: d.relevance,
      tokens: d.tokenEstimate,
    })),
  };
}

// ─── Exports ────────────────────────────────────────────────────────────────
module.exports = {
  context7PipelineHook,
  setSharedAdapter,
  getEnrichmentMetrics,
  isCodeGenerationTask,
  // Constants
  MAX_TOKENS_PER_RUN,
  MAX_TOKENS_PER_LIB,
  MAX_LIBRARIES_PER_TASK,
  ENRICHMENT_THRESHOLD,
  STAGES,
  PHI,
  PSI,
  FIB,
  CSL_GATES,
};
