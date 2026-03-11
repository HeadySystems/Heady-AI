// ═══════════════════════════════════════════════════════════════════════════════
// HEADY™ Brains — Context Assembly Engine
// © 2026 HeadySystems Inc. — Eric Haywood, Founder
// ═══════════════════════════════════════════════════════════════════════════════

import {
  PHI, PSI, PSI2, PSI3, FIB, CSL_THRESHOLDS,
  cosineSimilarity, phiFusionWeights, phiTokenBudgets, cslGate, sha256
} from '../shared/phi-math-v2.js';
import { textToEmbedding, DIM } from '../shared/csl-engine-v2.js';

const CONTEXT_SOURCES = Object.freeze([
  'vector-memory', 'file-system', 'conversation-history',
  'embeddings', 'knowledge-graph', 'wisdom-store',
  'telemetry', 'user-preferences',
]);

const TOKEN_BUDGETS = phiTokenBudgets(FIB[13]); // base = 233

class HeadyBrains {
  #contextCache;
  #maxCacheSize;
  #relevanceThreshold;
  #compressionRatio;

  constructor() {
    this.#contextCache = new Map();
    this.#maxCacheSize = FIB[16];
    this.#relevanceThreshold = CSL_THRESHOLDS.LOW;
    this.#compressionRatio = PSI;
  }

  async assemble(taskDescription, sources = CONTEXT_SOURCES) {
    const taskEmb = textToEmbedding(taskDescription);
    const assembled = [];
    let totalTokens = 0;
    const budget = TOKEN_BUDGETS.working;

    for (const source of sources) {
      const chunks = this.#fetchFromSource(source, taskEmb);
      for (const chunk of chunks) {
        const relevance = cosineSimilarity(taskEmb, chunk.embedding);
        const gated = cslGate(relevance, relevance, this.#relevanceThreshold, PSI3);

        if (gated >= this.#relevanceThreshold * PSI) {
          const tokenEstimate = Math.ceil(chunk.content.length / FIB[3]);
          if (totalTokens + tokenEstimate <= budget) {
            assembled.push({
              source: chunk.source,
              content: chunk.content,
              relevance,
              gatedScore: gated,
              tokens: tokenEstimate,
            });
            totalTokens += tokenEstimate;
          }
        }
      }
    }

    assembled.sort((a, b) => b.gatedScore - a.gatedScore);

    const assemblyId = await sha256('context:' + taskDescription.slice(0, FIB[8]) + ':' + Date.now());

    return {
      id: assemblyId,
      task: taskDescription.slice(0, FIB[12]),
      chunks: assembled,
      totalTokens,
      budget,
      utilization: totalTokens / budget,
      sourcesUsed: [...new Set(assembled.map(a => a.source))],
      timestamp: Date.now(),
    };
  }

  prioritize(assembly) {
    const weights = phiFusionWeights(3);
    const scored = assembly.chunks.map(chunk => {
      const recencyBonus = 1.0;
      const connectivityBonus = chunk.source === 'knowledge-graph' ? PSI2 : 0;
      const score = weights[0] * chunk.gatedScore +
                    weights[1] * recencyBonus +
                    weights[2] * (1 + connectivityBonus);
      return { ...chunk, priorityScore: score };
    });

    scored.sort((a, b) => b.priorityScore - a.priorityScore);
    return scored;
  }

  compress(assembly, targetRatio = null) {
    const ratio = targetRatio || this.#compressionRatio;
    const targetTokens = Math.ceil(assembly.totalTokens * ratio);
    let currentTokens = 0;
    const compressed = [];

    const sorted = [...assembly.chunks].sort((a, b) => b.gatedScore - a.gatedScore);

    for (const chunk of sorted) {
      if (currentTokens >= targetTokens) break;
      const truncatedContent = chunk.content.slice(0, Math.ceil(chunk.content.length * ratio));
      const tokens = Math.ceil(truncatedContent.length / FIB[3]);
      compressed.push({ ...chunk, content: truncatedContent, tokens });
      currentTokens += tokens;
    }

    return {
      ...assembly,
      chunks: compressed,
      totalTokens: currentTokens,
      compressionRatio: currentTokens / assembly.totalTokens,
    };
  }

  getRelevanceScores(taskDescription, chunks) {
    const taskEmb = textToEmbedding(taskDescription);
    return chunks.map(chunk => {
      const chunkEmb = textToEmbedding(chunk.content || chunk);
      return {
        content: (chunk.content || chunk).slice(0, FIB[10]),
        relevance: cosineSimilarity(taskEmb, chunkEmb),
      };
    });
  }

  getCacheStats() {
    return {
      size: this.#contextCache.size,
      maxSize: this.#maxCacheSize,
      utilization: this.#contextCache.size / this.#maxCacheSize,
    };
  }

  clearCache() { this.#contextCache.clear(); }

  #fetchFromSource(source, queryEmbedding) {
    const chunks = [];
    const count = FIB[5];
    for (let i = 0; i < count; i++) {
      const content = source + ':chunk:' + i;
      chunks.push({
        source,
        content,
        embedding: textToEmbedding(content),
      });
    }
    return chunks;
  }
}

export { HeadyBrains, CONTEXT_SOURCES, TOKEN_BUDGETS };
export default HeadyBrains;
