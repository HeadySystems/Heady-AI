/**
 * Heady™ Brains Context Assembler v5.0.0
 * Context gathering, embedding, relevance scoring, context window management
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */

import { PHI, PSI, FIB, CSL_THRESHOLDS, cosineSimilarity, cslGate, phiFusionWeights } from '../../shared/phi-math.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('heady-brains');

// ═══ Types ═══
export interface ContextEntry {
  id: string;
  content: string;
  source: ContextSource;
  embedding: number[] | null;
  relevanceScore: number;
  importance: number;
  createdAt: string;
  tokenEstimate: number;
}

export type ContextSource = 'memory' | 'file' | 'service' | 'user' | 'system' | 'conversation' | 'tool';

export interface ContextWindow {
  entries: ContextEntry[];
  totalTokens: number;
  maxTokens: number;
  relevanceThreshold: number;
}

export interface ContextAssemblyResult {
  window: ContextWindow;
  includedCount: number;
  excludedCount: number;
  avgRelevance: number;
  assemblyTimeMs: number;
}

// ═══ Token Budgets (φ-geometric) ═══
const TOKEN_BUDGETS = {
  working:   8192,
  session:   Math.round(8192 * (PHI + 1)),       // ≈ 21,450
  memory:    Math.round(8192 * (3 * PHI + 2)),    // ≈ 56,131
  artifacts: Math.round(8192 * (8 * PHI + 5)),    // ≈ 146,920
};

// ═══ Eviction Weights ═══
const EVICTION_WEIGHTS = {
  importance: 0.486,
  recency:    0.300,
  relevance:  0.214,
};

// ═══ Context Buffer ═══
const contextBuffer: ContextEntry[] = [];
const MAX_BUFFER_SIZE = FIB[14]; // 377

// ═══ Add Context ═══
export function addContext(entry: Omit<ContextEntry, 'id' | 'createdAt'>): ContextEntry {
  const fullEntry: ContextEntry = {
    ...entry,
    id: `ctx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };

  contextBuffer.push(fullEntry);

  // Evict if over capacity
  if (contextBuffer.length > MAX_BUFFER_SIZE) {
    evict(Math.ceil(MAX_BUFFER_SIZE * Math.pow(PSI, 4))); // Remove ~14.6%
  }

  return fullEntry;
}

// ═══ Assemble Context Window ═══
export function assembleContext(
  queryEmbedding: number[] | null,
  maxTokens: number = TOKEN_BUDGETS.working,
  minRelevance: number = CSL_THRESHOLDS.MINIMUM,
): ContextAssemblyResult {
  const start = Date.now();

  // Score all entries
  const scored = contextBuffer.map(entry => {
    let relevance = entry.relevanceScore;

    // CSL-scored relevance if embeddings available
    if (queryEmbedding && entry.embedding) {
      relevance = cosineSimilarity(queryEmbedding, entry.embedding);
      // Apply CSL gate for smooth thresholding
      relevance = cslGate(relevance, relevance, minRelevance);
    }

    return { entry, relevance };
  });

  // Filter by relevance threshold
  const relevant = scored.filter(s => s.relevance >= minRelevance);
  const excluded = scored.length - relevant.length;

  // Sort by relevance (highest first)
  relevant.sort((a, b) => b.relevance - a.relevance);

  // Fill context window within token budget
  const window: ContextWindow = {
    entries: [],
    totalTokens: 0,
    maxTokens,
    relevanceThreshold: minRelevance,
  };

  for (const { entry, relevance } of relevant) {
    if (window.totalTokens + entry.tokenEstimate > maxTokens) break;
    window.entries.push({ ...entry, relevanceScore: relevance });
    window.totalTokens += entry.tokenEstimate;
  }

  const avgRelevance = window.entries.length > 0
    ? window.entries.reduce((sum, e) => sum + e.relevanceScore, 0) / window.entries.length
    : 0;

  const assemblyTimeMs = Date.now() - start;

  logger.info('Context assembled', {
    included: window.entries.length,
    excluded,
    totalTokens: window.totalTokens,
    maxTokens,
    avgRelevance,
    assemblyTimeMs,
  });

  return {
    window,
    includedCount: window.entries.length,
    excludedCount: excluded,
    avgRelevance,
    assemblyTimeMs,
  };
}

// ═══ Eviction (φ-weighted scoring) ═══
function evict(count: number): void {
  const now = Date.now();

  // Score each entry for eviction (lower = more evictable)
  const evictionScores = contextBuffer.map((entry, index) => {
    const recency = 1 - Math.min(1, (now - new Date(entry.createdAt).getTime()) / (FIB[13] * 60 * 1000));
    const score = (
      entry.importance * EVICTION_WEIGHTS.importance +
      recency * EVICTION_WEIGHTS.recency +
      entry.relevanceScore * EVICTION_WEIGHTS.relevance
    );
    return { index, score };
  });

  // Sort by score ascending (lowest = first to evict)
  evictionScores.sort((a, b) => a.score - b.score);

  // Remove lowest-scoring entries
  const toRemove = new Set(evictionScores.slice(0, count).map(e => e.index));
  for (let i = contextBuffer.length - 1; i >= 0; i--) {
    if (toRemove.has(i)) {
      contextBuffer.splice(i, 1);
    }
  }

  logger.info('Context eviction', { evicted: count, remaining: contextBuffer.length });
}

// ═══ Context Capsule (for inter-agent transfer) ═══
export interface ContextCapsule {
  id: string;
  sourceAgent: string;
  targetAgent: string;
  entries: ContextEntry[];
  summary: string;
  createdAt: string;
  totalTokens: number;
}

export function createCapsule(
  sourceAgent: string,
  targetAgent: string,
  entries: ContextEntry[],
  summary: string,
): ContextCapsule {
  const totalTokens = entries.reduce((sum, e) => sum + e.tokenEstimate, 0);

  return {
    id: `capsule-${Date.now().toString(36)}`,
    sourceAgent,
    targetAgent,
    entries,
    summary,
    createdAt: new Date().toISOString(),
    totalTokens,
  };
}

export function ingestCapsule(capsule: ContextCapsule): number {
  let ingested = 0;
  for (const entry of capsule.entries) {
    addContext({
      content: entry.content,
      source: 'system',
      embedding: entry.embedding,
      relevanceScore: entry.relevanceScore * PSI, // Decay slightly from transfer
      importance: entry.importance,
      tokenEstimate: entry.tokenEstimate,
    });
    ingested++;
  }
  logger.info('Capsule ingested', { capsuleId: capsule.id, source: capsule.sourceAgent, entries: ingested });
  return ingested;
}

// ═══ Buffer Stats ═══
export function getContextStats(): Record<string, unknown> {
  return {
    bufferSize: contextBuffer.length,
    maxBufferSize: MAX_BUFFER_SIZE,
    totalTokens: contextBuffer.reduce((sum, e) => sum + e.tokenEstimate, 0),
    tokenBudgets: TOKEN_BUDGETS,
    sourceDistribution: contextBuffer.reduce((acc, e) => {
      acc[e.source] = (acc[e.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };
}
