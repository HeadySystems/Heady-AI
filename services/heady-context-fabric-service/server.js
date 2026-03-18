/**
 * @fileoverview HeadyContextFabricService — Cross-agent context engineering service.
 * Evaluates context pieces via CSL relevance scoring against 384D task embeddings,
 * deduplicates, compresses via phi-ratio hierarchical summarization layers,
 * and assembles task-specific context capsules with phi-weighted priority.
 * Priority ordering: system(PHI^3) > task(PHI^2) > history(PHI) > ambient(1).
 * @module heady-context-fabric-service
 */

'use strict';

const express = require('express');
const crypto = require('crypto');

// ── PHI-MATH CONSTANTS ──────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };

/** Phi-weighted priority tiers for context assembly */
const CONTEXT_WEIGHTS = {
  SYSTEM: PHI * PHI * PHI,    // ~4.236
  TASK: PHI * PHI,             // ~2.618
  HISTORY: PHI,                // ~1.618
  AMBIENT: 1                   // 1.000
};

/** Compression ratios per phi-hierarchical layer */
const COMPRESSION_LAYERS = {
  L1: PSI,          // ~0.618 — light summarization
  L2: PSI * PSI,    // ~0.382 — medium compression
  L3: PSI * PSI * PSI // ~0.236 — aggressive compression
};

/** Maximum context tokens per capsule, derived from Fibonacci */
const MAX_CAPSULE_TOKENS = FIB[13] * FIB[5]; // 233 * 5 = 1165

/**
 * Structured JSON logger with correlation ID support.
 * @param {string} level - Log level
 * @param {string} msg - Log message
 * @param {Object} meta - Additional metadata
 * @param {string} [correlationId] - Correlation ID
 */
function log(level, msg, meta = {}, correlationId = null) {
  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: 'heady-context-fabric-service',
    level,
    correlationId: correlationId || crypto.randomUUID(),
    message: msg,
    ...meta
  }) + '\n');
}

/**
 * Cosine similarity between two vectors.
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} Cosine similarity
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Phi-backoff delay calculation.
 * @param {number} attempt - Attempt number
 * @returns {number} Delay in ms
 */
function phiBackoff(attempt) {
  return FIB[Math.min(attempt, FIB.length - 1)] * PSI * 1000;
}

/**
 * HeadyContextFabricService — Cross-agent context engineering service.
 */
class HeadyContextFabricService {
  /**
   * @param {Object} config - Service configuration
   * @param {number} [config.port=3402] - HTTP port
   * @param {number} [config.embeddingDim] - Embedding vector dimension
   * @param {number} [config.maxCapsuleSize] - Maximum tokens per capsule
   * @param {number} [config.dedupThreshold] - Cosine threshold for deduplication
   */
  constructor(config = {}) {
    this.port = config.port || 3402;
    this.embeddingDim = config.embeddingDim || FIB[11] + FIB[9]; // 89 + 34 = 123... use 384
    this.embeddingDim = 384;
    this.maxCapsuleSize = config.maxCapsuleSize || MAX_CAPSULE_TOKENS;
    this.dedupThreshold = config.dedupThreshold || CSL.DEDUP;
    /** @type {Map<string, {pieces: Array, taskEmbedding: number[], assembled: Object|null, createdAt: number}>} */
    this.sessions = new Map();
    /** @type {Map<string, Object>} */
    this.capsuleCache = new Map();
    this._capsuleCacheMaxSize = FIB[10];
    this.app = express();
    this.server = null;
    this._started = false;
    this._coherence = CSL.HIGH;
  }

  /**
   * Create a new context assembly session for a task.
   * @param {number[]} taskEmbedding - 384D task embedding
   * @returns {Object} Session info with sessionId
   */
  createSession(taskEmbedding) {
    const sessionId = crypto.randomUUID();
    this.sessions.set(sessionId, {
      pieces: [],
      taskEmbedding: taskEmbedding || [],
      assembled: null,
      createdAt: Date.now()
    });
    log('info', 'Context session created', { sessionId });
    return { sessionId, embeddingDim: this.embeddingDim };
  }

  /**
   * Add a context piece to a session. Each piece has a tier, content, and optional embedding.
   * @param {string} sessionId - Session identifier
   * @param {Object} piece - Context piece
   * @param {string} piece.tier - Priority tier: SYSTEM, TASK, HISTORY, AMBIENT
   * @param {string} piece.content - Text content
   * @param {number[]} [piece.embedding] - 384D embedding vector
   * @param {Object} [piece.metadata] - Additional metadata
   * @returns {Object} Add result with relevance score
   */
  addPiece(sessionId, piece) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const tier = piece.tier || 'AMBIENT';
    const weight = CONTEXT_WEIGHTS[tier] || CONTEXT_WEIGHTS.AMBIENT;
    const embedding = piece.embedding || [];

    // CSL relevance scoring against task embedding
    let relevance = CSL.MEDIUM;
    if (session.taskEmbedding.length > 0 && embedding.length > 0) {
      relevance = cosineSimilarity(session.taskEmbedding, embedding);
    }

    // Skip if below minimum CSL threshold
    if (relevance < CSL.MINIMUM && tier !== 'SYSTEM') {
      log('info', 'Context piece rejected: below CSL.MINIMUM', { sessionId, tier, relevance });
      return { accepted: false, reason: 'below_threshold', relevance };
    }

    // Semantic deduplication
    for (const existing of session.pieces) {
      if (embedding.length > 0 && existing.embedding.length > 0) {
        if (cosineSimilarity(embedding, existing.embedding) >= this.dedupThreshold) {
          // Keep the higher-weighted one
          if (weight > existing.weight) {
            const idx = session.pieces.indexOf(existing);
            session.pieces.splice(idx, 1);
            break;
          }
          log('info', 'Context piece deduplicated', { sessionId, tier });
          return { accepted: false, reason: 'duplicate', relevance };
        }
      }
    }

    const phiScore = relevance * weight;
    session.pieces.push({
      id: crypto.randomUUID(),
      tier,
      weight,
      content: piece.content,
      embedding,
      relevance,
      phiScore,
      metadata: piece.metadata || {},
      addedAt: Date.now()
    });

    // Sort by phiScore descending
    session.pieces.sort((a, b) => b.phiScore - a.phiScore);
    session.assembled = null; // invalidate cache

    return { accepted: true, relevance, phiScore, totalPieces: session.pieces.length };
  }

  /**
   * Compress content through phi-ratio hierarchical summarization layers.
   * Each layer reduces content by PSI ratio.
   * @param {string} content - Original content
   * @param {number} targetRatio - Target compression ratio
   * @returns {string} Compressed content
   */
  compress(content, targetRatio) {
    if (!content) return '';
    const targetLen = Math.ceil(content.length * targetRatio);
    if (content.length <= targetLen) return content;
    // Split into sentences, keep highest-value ones
    const sentences = content.split(/(?<=[.!?])\s+/).filter(s => s.length > 0);
    if (sentences.length <= 1) return content.substring(0, targetLen);
    const keepCount = Math.max(1, Math.ceil(sentences.length * targetRatio));
    return sentences.slice(0, keepCount).join(' ');
  }

  /**
   * Assemble a context capsule from all session pieces.
   * Applies phi-weighted priority ordering, compression, and token budgeting.
   * @param {string} sessionId - Session identifier
   * @returns {Object} Assembled context capsule
   */
  assemble(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    if (session.assembled) return session.assembled;

    const correlationId = crypto.randomUUID();
    const pieces = [...session.pieces];

    // Budget allocation per tier using phi weights
    const totalWeight = Object.values(CONTEXT_WEIGHTS).reduce((s, w) => s + w, 0);
    const tierBudgets = {};
    for (const [tier, weight] of Object.entries(CONTEXT_WEIGHTS)) {
      tierBudgets[tier] = Math.floor(this.maxCapsuleSize * (weight / totalWeight));
    }

    // Group by tier
    const byTier = { SYSTEM: [], TASK: [], HISTORY: [], AMBIENT: [] };
    for (const piece of pieces) {
      if (byTier[piece.tier]) byTier[piece.tier].push(piece);
    }

    // Assemble with compression
    const capsuleSections = [];
    let totalTokensUsed = 0;

    for (const tier of ['SYSTEM', 'TASK', 'HISTORY', 'AMBIENT']) {
      const budget = tierBudgets[tier];
      const tierPieces = byTier[tier];
      let tierContent = '';
      let tierTokens = 0;

      for (const piece of tierPieces) {
        const estimatedTokens = Math.ceil(piece.content.length / FIB[5]);
        if (tierTokens + estimatedTokens > budget) {
          // Apply hierarchical compression
          let compressionLayer = COMPRESSION_LAYERS.L1;
          if (tierTokens + estimatedTokens > budget * PHI) compressionLayer = COMPRESSION_LAYERS.L2;
          if (tierTokens + estimatedTokens > budget * PHI * PHI) compressionLayer = COMPRESSION_LAYERS.L3;
          const compressed = this.compress(piece.content, compressionLayer);
          tierContent += compressed + '\n';
          tierTokens += Math.ceil(compressed.length / FIB[5]);
        } else {
          tierContent += piece.content + '\n';
          tierTokens += estimatedTokens;
        }
        if (tierTokens >= budget) break;
      }

      capsuleSections.push({
        tier,
        weight: CONTEXT_WEIGHTS[tier],
        content: tierContent.trim(),
        pieceCount: tierPieces.length,
        tokensUsed: tierTokens
      });
      totalTokensUsed += tierTokens;
    }

    const capsule = {
      sessionId,
      correlationId,
      sections: capsuleSections,
      totalPieces: pieces.length,
      totalTokens: totalTokensUsed,
      maxTokens: this.maxCapsuleSize,
      utilization: totalTokensUsed / this.maxCapsuleSize,
      coherence: this._calculateCapsuleCoherence(pieces),
      assembledAt: new Date().toISOString()
    };

    session.assembled = capsule;

    // Cache management
    if (this.capsuleCache.size >= this._capsuleCacheMaxSize) {
      const oldest = this.capsuleCache.keys().next().value;
      this.capsuleCache.delete(oldest);
    }
    this.capsuleCache.set(sessionId, capsule);

    log('info', 'Context capsule assembled', {
      sessionId, totalPieces: pieces.length, totalTokens: totalTokensUsed
    }, correlationId);

    return capsule;
  }

  /**
   * Calculate coherence of a capsule based on piece relevance distribution.
   * @param {Array} pieces - Context pieces
   * @returns {number} Coherence score
   * @private
   */
  _calculateCapsuleCoherence(pieces) {
    if (pieces.length === 0) return CSL.MINIMUM;
    const avgRelevance = pieces.reduce((sum, p) => sum + p.relevance, 0) / pieces.length;
    const hasCritical = pieces.some(p => p.tier === 'SYSTEM');
    const bonus = hasCritical ? PSI * 0.1 : 0;
    return Math.min(1, avgRelevance + bonus);
  }

  /**
   * Destroy a context session and free resources.
   * @param {string} sessionId - Session identifier
   * @returns {boolean} True if destroyed
   */
  destroySession(sessionId) {
    const removed = this.sessions.delete(sessionId);
    this.capsuleCache.delete(sessionId);
    if (removed) log('info', 'Context session destroyed', { sessionId });
    return removed;
  }

  /** Set up Express routes. @private */
  _setupRoutes() {
    this.app.use(express.json());

    this.app.get('/health', (_req, res) => {
      this._coherence = this.sessions.size > 0
        ? Array.from(this.sessions.values()).reduce((sum, s) => sum + (s.assembled?.coherence || CSL.MEDIUM), 0) / this.sessions.size
        : CSL.HIGH;
      res.json({
        status: this._coherence >= CSL.MEDIUM ? 'healthy' : 'degraded',
        coherence: this._coherence,
        activeSessions: this.sessions.size,
        cachedCapsules: this.capsuleCache.size,
        timestamp: new Date().toISOString()
      });
    });

    this.app.post('/session', (req, res) => {
      const session = this.createSession(req.body.taskEmbedding);
      res.status(201).json(session);
    });

    this.app.post('/session/:id/piece', (req, res) => {
      try {
        const result = this.addPiece(req.params.id, req.body);
        res.status(result.accepted ? 201 : 200).json(result);
      } catch (err) {
        res.status(404).json({ error: err.message });
      }
    });

    this.app.post('/session/:id/assemble', (req, res) => {
      try {
        const capsule = this.assemble(req.params.id);
        res.json(capsule);
      } catch (err) {
        res.status(404).json({ error: err.message });
      }
    });

    this.app.delete('/session/:id', (req, res) => {
      const removed = this.destroySession(req.params.id);
      res.json({ removed });
    });

    this.app.get('/capsule/:id', (req, res) => {
      const capsule = this.capsuleCache.get(req.params.id);
      if (!capsule) return res.status(404).json({ error: 'Capsule not found' });
      res.json(capsule);
    });
  }

  /**
   * Start the context fabric service.
   * @returns {Promise<void>}
   */
  async start() {
    if (this._started) return;
    this._setupRoutes();
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        this._started = true;
        log('info', 'HeadyContextFabricService started', { port: this.port, embeddingDim: this.embeddingDim });
        resolve();
      });
    });
  }

  /**
   * Gracefully stop the service.
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this._started) return;
    return new Promise((resolve) => {
      this.server.close(() => {
        this._started = false;
        this.sessions.clear();
        this.capsuleCache.clear();
        log('info', 'HeadyContextFabricService stopped');
        resolve();
      });
    });
  }

  /**
   * Health check.
   * @returns {Object} Health status
   */
  health() {
    return { status: this._coherence >= CSL.MEDIUM ? 'healthy' : 'degraded', coherence: this._coherence, activeSessions: this.sessions.size };
  }
}

module.exports = { HeadyContextFabricService, PHI, PSI, FIB, CSL, CONTEXT_WEIGHTS, COMPRESSION_LAYERS, cosineSimilarity, phiBackoff };
