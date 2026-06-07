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
// ║  FILE: packages/phi-pure-latent-os/vector-ops/temporal-decay.ts                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * @module vector-ops/temporal-decay
 * @description Memory relevance scoring using φ-weighted fusion of semantic
 *   similarity and temporal recency. Formula:
 *
 *     relevance = 0.618 * cosineSimilarity + 0.382 * exponentialDecay
 *
 *   Weights derive from phiFusionWeights(2) = [PSI, PSI²] = [0.618, 0.382].
 *   Half-lives are CSL-tier-configured (CRITICAL: 7d, HIGH: 3d, MEDIUM: 1d, LOW: 8h).
 */

import {
  exponentialDecay,
  phiFusionWeights,
  CSL,
  FIB,
} from '../shared/phi-math.js';

import { cosineSimilarity } from './arithmetic.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Vec = number[];

export type CslTier = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Memory {
  /** 384D embedding of the memory content */
  embedding: Vec;
  /** Unix timestamp (ms) when the memory was created/indexed */
  createdAt: number;
  /** CSL relevance tier — used to select the appropriate half-life */
  tier?: CslTier;
  /** Arbitrary metadata preserved in results */
  metadata?: Record<string, unknown>;
}

export interface ScoredMemory extends Memory {
  /** Final relevance score ∈ [0, 1] */
  relevance:  number;
  /** Raw cosine similarity ∈ [-1, 1] */
  similarity: number;
  /** Recency score ∈ [0, 1] */
  recency:    number;
}

// ─── Half-Life Configuration ──────────────────────────────────────────────────
// Configurable per CSL tier. Derived from Fibonacci multiples of 1 hour.
// FIB[6]=13, FIB[8]=21 used as reference points.

const HOUR_MS  = 60 * 60 * 1_000;
const DAY_MS   = 24 * HOUR_MS;

/**
 * Default half-lives per CSL tier.
 * CRITICAL memories decay slowest (high-value, long retention).
 * LOW memories decay fastest (transient, noise-adjacent).
 */
export const DEFAULT_HALF_LIVES: Record<CslTier, number> = {
  CRITICAL: 7 * DAY_MS,  // 7 days  — mission-critical knowledge
  HIGH:     3 * DAY_MS,  // 3 days  — important but time-bound
  MEDIUM:   1 * DAY_MS,  // 1 day   — standard working memory
  LOW:      8 * HOUR_MS, // 8 hours — transient session context
};

/**
 * Override half-lives for specific use cases (e.g., ephemeral Colab sessions).
 */
export type HalfLifeConfig = Partial<Record<CslTier, number>>;

// ─── Phi-Fusion Weights ───────────────────────────────────────────────────────

// phiFusionWeights(2) = [PSI, PSI²] = [0.618, 0.382]
const [SIMILARITY_WEIGHT, RECENCY_WEIGHT] = phiFusionWeights(2) as [number, number];

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Compute the exponential recency score for a memory.
 * recency = exp(-ln(2) / halfLifeMs * ageMs)
 * Returns 1.0 for brand-new memories, decays toward 0 as age grows.
 */
export function computeRecency(
  createdAt:   number,
  now:         number,
  halfLifeMs:  number,
): number {
  const ageMs = Math.max(0, now - createdAt);
  return exponentialDecay(ageMs, halfLifeMs);
}

/**
 * Compute composite relevance for a single memory against a query embedding.
 *
 * relevance = 0.618 * similarity + 0.382 * recency
 *
 * @param embedding      - Memory's 384D embedding
 * @param queryEmbedding - Query's 384D embedding
 * @param createdAt      - Memory creation timestamp (ms)
 * @param now            - Current timestamp (ms)
 * @param halfLifeMs     - Decay half-life in milliseconds
 * @returns relevance score ∈ [0, 1]
 */
export function computeRelevance(
  embedding:      Vec,
  queryEmbedding: Vec,
  createdAt:      number,
  now:            number,
  halfLifeMs:     number,
): number {
  if (!Number.isFinite(now) || !Number.isFinite(createdAt)) {
    throw new TypeError('computeRelevance: createdAt and now must be finite timestamps.');
  }
  if (!Number.isFinite(halfLifeMs) || halfLifeMs <= 0) {
    throw new RangeError(`computeRelevance: halfLifeMs must be a positive finite number (got ${halfLifeMs}).`);
  }

  const similarity = cosineSimilarity(embedding, queryEmbedding);
  const recency    = computeRecency(createdAt, now, halfLifeMs);

  // φ-fusion: 0.618 * similarity + 0.382 * recency
  const relevance = SIMILARITY_WEIGHT * similarity + RECENCY_WEIGHT * recency;

  // Clamp to [0, 1] — similarity can be negative so relevance could dip below 0
  return Math.max(0, Math.min(1, relevance));
}

/**
 * Resolve the half-life for a memory based on its CSL tier.
 */
export function halfLifeForTier(
  tier:   CslTier,
  config: HalfLifeConfig = {},
): number {
  return config[tier] ?? DEFAULT_HALF_LIVES[tier];
}

// ─── Batch Scoring ────────────────────────────────────────────────────────────

/**
 * Score an array of memories against a query embedding at a given moment.
 * Returns memories sorted by descending relevance.
 *
 * @param memories      - Array of Memory objects to score
 * @param queryEmbedding - 384D query vector
 * @param now            - Current timestamp (ms); defaults to Date.now()
 * @param halfLifeConfig - Override half-lives per tier
 * @returns ScoredMemory[] sorted descending by relevance
 */
export function scoreMemories(
  memories:        Memory[],
  queryEmbedding:  Vec,
  now:             number            = Date.now(),
  halfLifeConfig:  HalfLifeConfig    = {},
): ScoredMemory[] {
  if (!Array.isArray(memories)) {
    throw new TypeError('scoreMemories: memories must be an array.');
  }
  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    throw new TypeError('scoreMemories: queryEmbedding must be a non-empty vector.');
  }

  const scored: ScoredMemory[] = memories.map((mem, idx) => {
    if (!mem.embedding || !Array.isArray(mem.embedding)) {
      throw new TypeError(`scoreMemories: memory[${idx}].embedding must be a number array.`);
    }
    if (!Number.isFinite(mem.createdAt)) {
      throw new TypeError(`scoreMemories: memory[${idx}].createdAt must be a finite timestamp.`);
    }

    const tier       = mem.tier ?? 'MEDIUM';
    const halfLifeMs = halfLifeForTier(tier, halfLifeConfig);
    const similarity = cosineSimilarity(mem.embedding, queryEmbedding);
    const recency    = computeRecency(mem.createdAt, now, halfLifeMs);
    const relevance  = Math.max(
      0,
      Math.min(1, SIMILARITY_WEIGHT * similarity + RECENCY_WEIGHT * recency),
    );

    return {
      ...mem,
      relevance,
      similarity,
      recency,
    };
  });

  // Sort by descending relevance (most relevant first)
  scored.sort((a, b) => b.relevance - a.relevance);
  return scored;
}

// ─── CSL-Gated Filtering ──────────────────────────────────────────────────────

/**
 * Filter scored memories to those above a CSL threshold.
 * Defaults to MEDIUM (0.809) coherence floor.
 */
export function filterByRelevance(
  scored:    ScoredMemory[],
  threshold: number = CSL.MEDIUM,
): ScoredMemory[] {
  return scored.filter(m => m.relevance >= threshold);
}

/**
 * Return the top-k memories by relevance.
 * Combines scoring + filtering + truncation in one call.
 *
 * @param memories       - Raw memories to rank
 * @param queryEmbedding - 384D query vector
 * @param k              - Maximum memories to return (default: FIB[8]=21)
 * @param minRelevance   - Minimum relevance threshold (default: CSL.LOW=0.691)
 * @param now            - Current timestamp (ms)
 * @param halfLifeConfig - Override half-lives per tier
 */
export function topKMemories(
  memories:        Memory[],
  queryEmbedding:  Vec,
  k:               number          = FIB[8],  // 21
  minRelevance:    number          = CSL.LOW,
  now:             number          = Date.now(),
  halfLifeConfig:  HalfLifeConfig  = {},
): ScoredMemory[] {
  const scored   = scoreMemories(memories, queryEmbedding, now, halfLifeConfig);
  const filtered = filterByRelevance(scored, minRelevance);
  return filtered.slice(0, k);
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────

export interface DecayProfile {
  tier:       CslTier;
  halfLifeMs: number;
  /** Recency score at various ages */
  samples:    Array<{ ageHours: number; recency: number }>;
}

/**
 * Generate a decay profile for visualization / debugging.
 * Shows recency score at 0h, 1h, 2h, 4h, 8h, 1d, 2d, 3d, 7d, 14d.
 */
export function decayProfile(
  tier:        CslTier,
  halfLifeConfig: HalfLifeConfig = {},
): DecayProfile {
  const halfLifeMs = halfLifeForTier(tier, halfLifeConfig);
  const agePoints  = [0, 1, 2, 4, 8, 24, 48, 72, 168, 336]; // hours

  return {
    tier,
    halfLifeMs,
    samples: agePoints.map(ageHours => ({
      ageHours,
      recency: exponentialDecay(ageHours * HOUR_MS, halfLifeMs),
    })),
  };
}
