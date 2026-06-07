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
// ║  FILE: packages/heady-auto-context/src/context-fusion-engine.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * ═══════════════════════════════════════════════════════════
 * HEADY™ CONTEXT FUSION ENGINE
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 *
 * 3-Pass Pre-Action Context Enrichment (Patentable)
 *   Pass 1: SCAN    — Background workspace/session scan (every φ⁸ ≈ 21s)
 *   Pass 2: ENRICH  — Per-request vector search + phi-weighted fusion
 *   Pass 3: DEEPEN  — Pre-execution injection at CORE threshold (≥ 0.718)
 *
 * Fusion: scan_context × ψ² (0.382) + request_context × ψ (0.618)
 * ═══════════════════════════════════════════════════════════
 */

import { createLogger } from '../shared/structured-logger.js';
import { ContextFusionError } from '../shared/errors.js';
import {
  PSI, CSL_GATES, DEDUP_THRESHOLD,
  cosineSimilarity, phiFusionWeights,
} from '../shared/phi-math.js';
import { embed } from './embedding-client.js';
import * as vectorStore from './vector-store.js';
import config from './config.js';

const logger = createLogger('context-fusion-engine');

/**
 * Holds Pass 1 (SCAN) background state.
 * Updated by BackgroundScanner every fib(8)*1000 = 21,000ms.
 */
let pass1State = {
  scanResults: [],
  lastScanAt: null,
  scanAgeMs: null,
  scanDomain: null,
};

/**
 * Called by BackgroundScanner to update Pass 1 state.
 */
export function updatePass1State(state) {
  pass1State = {
    scanResults: state.scanResults || [],
    lastScanAt: new Date().toISOString(),
    scanAgeMs: 0,
    scanDomain: state.domain || null,
  };
}

/**
 * Get current Pass 1 state age.
 */
function getPass1Age() {
  if (!pass1State.lastScanAt) return null;
  return Date.now() - new Date(pass1State.lastScanAt).getTime();
}

/**
 * Deduplicate vectors: remove entries with cosine similarity ≥ DEDUP_THRESHOLD (0.972).
 * Keeps the highest-similarity entry from each near-duplicate cluster.
 */
function deduplicateResults(results) {
  if (results.length <= 1) return results;

  const kept = [results[0]];
  for (let i = 1; i < results.length; i++) {
    const candidate = results[i];
    let isDuplicate = false;

    for (const existing of kept) {
      // Use content similarity as proxy when embeddings aren't in result
      if (existing.content === candidate.content) {
        isDuplicate = true;
        break;
      }
      // If both have similarity scores from the same query, check proximity
      if (Math.abs(existing.similarity - candidate.similarity) < 0.001 &&
          existing.domain === candidate.domain) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      kept.push(candidate);
    }
  }

  return kept;
}

/**
 * Apply CSL gate classification to each result.
 * Adds a `gate` field: VOID, RECALL, INCLUDE, CORE, or INJECT.
 */
function classifyResults(results) {
  const gates = config.cslGates;
  return results.map(r => {
    let gate = 'VOID';
    if (r.similarity >= gates.INJECT)  gate = 'INJECT';
    else if (r.similarity >= gates.CORE)    gate = 'CORE';
    else if (r.similarity >= gates.INCLUDE) gate = 'INCLUDE';
    else if (r.similarity >= gates.RECALL)  gate = 'RECALL';
    return { ...r, gate };
  });
}

/**
 * Phi-weighted fusion of Pass 1 (background) and Pass 2 (request) results.
 *
 * Fusion weights:
 *   scan_context  × ψ² = 0.382
 *   request_context × ψ = 0.618
 *
 * Results are merged, deduplicated, and re-scored with fused weights.
 */
function fuseResults(pass1Results, pass2Results) {
  const scanWeight = config.fusion.scanWeight;     // ψ² ≈ 0.382
  const requestWeight = config.fusion.requestWeight; // ψ ≈ 0.618

  // Weight Pass 1 results
  const weighted1 = pass1Results.map(r => ({
    ...r,
    fusedScore: r.similarity * scanWeight,
    passSource: 'scan',
  }));

  // Weight Pass 2 results
  const weighted2 = pass2Results.map(r => ({
    ...r,
    fusedScore: r.similarity * requestWeight,
    passSource: 'request',
  }));

  // Merge and sort by fused score
  const merged = [...weighted1, ...weighted2]
    .sort((a, b) => b.fusedScore - a.fusedScore);

  return deduplicateResults(merged);
}

/**
 * Pass 3: DEEPEN — pull prior decisions and anti-regression guards
 * for high-confidence context (CSL ≥ CORE = 0.718).
 *
 * Only injects results that pass the CORE threshold.
 */
async function deepenContext(queryEmbedding, domain, fusedResults) {
  const coreThreshold = config.cslGates.CORE;

  // Search for prior decisions in the same domain
  const priorDecisions = await vectorStore.search(
    queryEmbedding,
    config.searchTopK,
    coreThreshold,
    domain,
  );

  // Classify and filter to CORE+ only
  const classifiedPrior = classifyResults(priorDecisions)
    .filter(r => r.gate === 'CORE' || r.gate === 'INJECT');

  // Merge with fused results (prior decisions get slight boost)
  const deepened = [
    ...fusedResults,
    ...classifiedPrior.map(r => ({
      ...r,
      fusedScore: r.similarity * 1.05, // 5% boost for anti-regression
      passSource: 'deepen',
    })),
  ];

  return deduplicateResults(deepened)
    .sort((a, b) => b.fusedScore - a.fusedScore)
    .slice(0, config.searchTopK);
}

/**
 * Compute composite CSL score from fused results.
 * Uses phiFusionWeights to weight top-N similarity scores.
 */
function computeCompositeScore(results) {
  if (results.length === 0) return 0;

  const topN = Math.min(results.length, 5);
  const weights = phiFusionWeights(topN);
  const scores = results.slice(0, topN).map(r => r.fusedScore || r.similarity);

  return scores.reduce((sum, s, i) => sum + s * weights[i], 0);
}

/**
 * Primary enrichment method — called by middleware and /context/query endpoint.
 *
 * Executes Pass 2 (ENRICH) + optional Pass 3 (DEEPEN).
 *
 * @param {string} queryText - The text to contextualize
 * @param {string} domain - Domain filter (or 'general')
 * @param {number} topK - Max results
 * @returns {Promise<object>} Enriched context result
 */
export async function enrich(queryText, domain = 'general', topK = config.searchTopK) {
  const start = performance.now();

  try {
    // ── Pass 2: ENRICH — embed and search ──────────────────
    const queryEmbedding = await embed(queryText);

    const pass2Results = await vectorStore.search(
      queryEmbedding,
      topK,
      config.cslGates.INCLUDE, // ψ ≈ 0.618
      domain !== 'general' ? domain : null,
    );

    // ── Phi-Weighted Fusion (Pass 1 + Pass 2) ─────────────
    const fusedResults = fuseResults(
      pass1State.scanResults.filter(r => !domain || domain === 'general' || r.domain === domain),
      pass2Results,
    );

    // ── Pass 3: DEEPEN — if composite score warrants it ────
    const compositeScore = computeCompositeScore(fusedResults);
    let finalResults = fusedResults;

    if (compositeScore >= config.cslGates.CORE) {
      finalResults = await deepenContext(queryEmbedding, domain, fusedResults);
    }

    // Classify final results with CSL gates
    const classified = classifyResults(finalResults).slice(0, topK);

    const latencyMs = Math.round(performance.now() - start);

    return {
      results: classified,
      domain,
      cslScore: computeCompositeScore(classified),
      queryEmbedding,
      pass1Age: getPass1Age(),
      latencyMs,
      totalCandidates: pass2Results.length + pass1State.scanResults.length,
      pass2Count: pass2Results.length,
      pass3Triggered: compositeScore >= config.cslGates.CORE,
    };
  } catch (err) {
    if (err instanceof ContextFusionError) throw err;
    throw new ContextFusionError(`Enrichment failed: ${err.message}`, {
      domain, queryText: queryText.slice(0, 200),
    });
  }
}

/**
 * Get current engine diagnostics.
 */
export function getDiagnostics() {
  return {
    pass1: {
      lastScanAt: pass1State.lastScanAt,
      ageMs: getPass1Age(),
      resultCount: pass1State.scanResults.length,
      domain: pass1State.scanDomain,
    },
    cslGates: config.cslGates,
    fusionWeights: {
      scan: config.fusion.scanWeight,
      request: config.fusion.requestWeight,
    },
  };
}
