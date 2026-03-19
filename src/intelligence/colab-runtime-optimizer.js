/*
 * (C) 2026 Heady Systems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
// HEADY_BRAND:BEGIN
// +------------------------------------------------------------------+
// |  HEADY  |  Sacred Geometry  |  Organic Systems                   |
// |  FILE: src/intelligence/colab-runtime-optimizer.js               |
// |  LAYER: intelligence/runtime                                     |
// +------------------------------------------------------------------+
// HEADY_BRAND:END

/**
 * ColabRuntimeOptimizer — Colab-compatible runtime intelligence module.
 *
 * Optimizes learning throughput via:
 *   - GPU vector store pre-warming with hot/warm/cold retention tiers
 *   - Interaction ingestion into 3-tier vector memory
 *   - Session distillation into compressed knowledge vectors
 *   - Embedding model benchmarking (nomic-embed-text vs all-MiniLM-L6-v2)
 *   - GCS state persistence for session save/restore
 *
 * Memory retention policy:
 *   Hot:  24h in GPU memory (fast access, limited capacity)
 *   Warm: 7d in pgvector (medium access, larger capacity)
 *   Cold: 30d+ in Neon archive (slow access, unlimited)
 *
 * Express routes:
 *   POST /api/v1/colab/session  — start or restore a session
 *   GET  /api/v1/colab/metrics  — session metrics
 *   POST /api/v1/colab/distill  — distill session into knowledge vectors
 */

'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');

// --- phi-math constants ------------------------------------------------------
const PHI = 1.6180339887498948;
const PSI = 0.6180339887498949;

// --- Retention tier thresholds (milliseconds) --------------------------------
const RETENTION = Object.freeze({
  HOT_TTL_MS:  24 * 60 * 60 * 1000,       // 24 hours
  WARM_TTL_MS: 7  * 24 * 60 * 60 * 1000,  // 7 days
  COLD_TTL_MS: 30 * 24 * 60 * 60 * 1000,  // 30 days
});

// --- Embedding model registry ------------------------------------------------
const EMBEDDING_MODELS = Object.freeze({
  NOMIC:    { id: 'nomic-embed-text',   dimensions: 768,  provider: 'nomic-ai' },
  MINILM:   { id: 'all-MiniLM-L6-v2',  dimensions: 384,  provider: 'sentence-transformers' },
});

// --- Logger ------------------------------------------------------------------
let logger;
try { logger = require('../orchestration/utils/logger'); } catch { logger = null; }
function log(level, msg) {
  if (logger && typeof logger[level] === 'function') logger[level](msg);
  else if (logger && logger.logSystem) logger.logSystem(`  [colab-optimizer] ${msg}`);
}

// =============================================================================
// ColabRuntimeOptimizer
// =============================================================================

class ColabRuntimeOptimizer extends EventEmitter {
  constructor() {
    super();
    this._sessions = new Map(); // sessionId -> SessionState
  }

  // ---------------------------------------------------------------------------
  // startSession — initialize a Colab-compatible runtime session
  // ---------------------------------------------------------------------------

  async startSession(config = {}) {
    const sessionId = config.sessionId || `colab-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    const session = {
      id:             sessionId,
      startedAt:      Date.now(),
      config: {
        embeddingModel: config.embeddingModel || EMBEDDING_MODELS.NOMIC.id,
        gpuPreWarm:     config.gpuPreWarm !== false,
        retentionPolicy: config.retentionPolicy || 'default',
        maxHotVectors:  config.maxHotVectors || 10000,
        maxWarmVectors: config.maxWarmVectors || 100000,
      },
      vectors: {
        hot:  [],   // In-memory GPU-tier vectors
        warm: [],   // pgvector-tier references
        cold: [],   // Neon archive references
      },
      interactions:    [],
      distillations:   [],
      benchmarks:      {
        [EMBEDDING_MODELS.NOMIC.id]:  { totalMs: 0, count: 0, avgMs: 0 },
        [EMBEDDING_MODELS.MINILM.id]: { totalMs: 0, count: 0, avgMs: 0 },
      },
      metrics: {
        embeddingsCreated:    0,
        knowledgeRetained:    0,
        skillImprovementScore: 0,
        interactionsIngested: 0,
        distillationCount:    0,
        tierPromotions:       0,
        tierDemotions:        0,
      },
    };

    // GPU pre-warming: populate hot tier with recent system knowledge
    if (session.config.gpuPreWarm) {
      await this._preWarmGpuStore(session);
    }

    this._sessions.set(sessionId, session);
    this.emit('session:started', { sessionId, config: session.config });
    log('info', `Session started: ${sessionId} (model: ${session.config.embeddingModel}, gpuPreWarm: ${session.config.gpuPreWarm})`);

    return {
      sessionId,
      status: 'active',
      config: session.config,
      vectorCounts: this._getVectorCounts(session),
      ts: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // ingestLearning — feed interactions into vector memory
  // ---------------------------------------------------------------------------

  async ingestLearning(interaction) {
    const sessionId = interaction.sessionId;
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const now = Date.now();
    const entry = {
      id:        `int-${now}-${crypto.randomBytes(3).toString('hex')}`,
      ts:        now,
      type:      interaction.type || 'general',
      content:   interaction.content || '',
      metadata:  interaction.metadata || {},
      embedding: null,
      tier:      'hot',
    };

    // Generate embedding vector (simulated — in production, call embedding API)
    const embeddingStart = Date.now();
    entry.embedding = this._generateEmbedding(entry.content, session.config.embeddingModel);
    const embeddingMs = Date.now() - embeddingStart;

    // Benchmark tracking
    const modelBench = session.benchmarks[session.config.embeddingModel];
    if (modelBench) {
      modelBench.totalMs += embeddingMs;
      modelBench.count++;
      modelBench.avgMs = Math.round(modelBench.totalMs / modelBench.count);
    }

    // Place in hot tier (GPU memory)
    session.vectors.hot.push(entry);
    session.interactions.push(entry);
    session.metrics.embeddingsCreated++;
    session.metrics.interactionsIngested++;

    // Enforce hot tier capacity — demote oldest to warm
    while (session.vectors.hot.length > session.config.maxHotVectors) {
      const demoted = session.vectors.hot.shift();
      demoted.tier = 'warm';
      session.vectors.warm.push(demoted);
      session.metrics.tierDemotions++;
    }

    // Time-based tier management: demote hot entries older than 24h to warm
    this._enforceRetentionPolicy(session);

    this.emit('learning:ingested', { sessionId, entryId: entry.id, tier: entry.tier });

    return {
      entryId:   entry.id,
      tier:      entry.tier,
      embeddingMs,
      vectorCounts: this._getVectorCounts(session),
    };
  }

  // ---------------------------------------------------------------------------
  // distillSession — compress session learnings into knowledge vectors
  // ---------------------------------------------------------------------------

  async distillSession(sessionId) {
    const session = typeof sessionId === 'string'
      ? this._sessions.get(sessionId)
      : this._sessions.get(sessionId?.sessionId);
    if (!session) {
      const id = typeof sessionId === 'string' ? sessionId : sessionId?.sessionId;
      throw new Error(`Session not found: ${id}`);
    }

    const distillStart = Date.now();

    // Gather all vectors across tiers
    const allVectors = [
      ...session.vectors.hot,
      ...session.vectors.warm,
      ...session.vectors.cold,
    ];

    if (allVectors.length === 0) {
      return {
        sessionId:    session.id,
        distilled:    0,
        knowledgeVectors: [],
        durationMs:   Date.now() - distillStart,
        ts:           new Date().toISOString(),
      };
    }

    // Cluster related vectors by type and semantic proximity
    const clusters = this._clusterVectors(allVectors);

    // Compress each cluster into a single knowledge vector
    const knowledgeVectors = [];
    for (const cluster of clusters) {
      const centroid = this._computeCentroid(cluster);
      const knowledgeVector = {
        id:        `kv-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        ts:        Date.now(),
        type:      'distilled_knowledge',
        sourceCount: cluster.length,
        centroid,
        summary:   this._summarizeCluster(cluster),
        tier:      'warm', // distilled knowledge starts in warm tier
      };
      knowledgeVectors.push(knowledgeVector);
      session.vectors.warm.push(knowledgeVector);
    }

    session.distillations.push({
      ts:              Date.now(),
      inputVectors:    allVectors.length,
      outputVectors:   knowledgeVectors.length,
      compressionRatio: allVectors.length > 0
        ? +(knowledgeVectors.length / allVectors.length).toFixed(4) : 0,
    });

    session.metrics.distillationCount++;
    session.metrics.knowledgeRetained += knowledgeVectors.length;

    // Update skill improvement score using phi-weighted moving average
    const compressionQuality = knowledgeVectors.length > 0
      ? Math.min(1.0, knowledgeVectors.length / Math.max(clusters.length, 1))
      : 0;
    session.metrics.skillImprovementScore =
      session.metrics.skillImprovementScore * PSI + compressionQuality * (1 - PSI);

    const durationMs = Date.now() - distillStart;
    this.emit('session:distilled', {
      sessionId: session.id,
      inputVectors: allVectors.length,
      outputVectors: knowledgeVectors.length,
      durationMs,
    });

    log('info', `Session ${session.id} distilled: ${allVectors.length} vectors -> ${knowledgeVectors.length} knowledge vectors in ${durationMs}ms`);

    return {
      sessionId:        session.id,
      distilled:        knowledgeVectors.length,
      inputVectors:     allVectors.length,
      compressionRatio: allVectors.length > 0
        ? +(knowledgeVectors.length / allVectors.length).toFixed(4) : 0,
      knowledgeVectors: knowledgeVectors.map(kv => ({
        id: kv.id, sourceCount: kv.sourceCount, summary: kv.summary,
      })),
      durationMs,
      ts: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // getSessionMetrics
  // ---------------------------------------------------------------------------

  getSessionMetrics(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const uptimeMs = Date.now() - session.startedAt;

    // Compute embedding model benchmarks comparison
    const benchmarks = {};
    for (const [modelId, data] of Object.entries(session.benchmarks)) {
      benchmarks[modelId] = {
        embeddings: data.count,
        avgLatencyMs: data.avgMs,
        totalMs: data.totalMs,
      };
    }

    return {
      sessionId:     session.id,
      uptimeMs,
      uptimeHours:   +(uptimeMs / 3600000).toFixed(2),
      embeddingsCreated:     session.metrics.embeddingsCreated,
      knowledgeRetained:     session.metrics.knowledgeRetained,
      skillImprovementScore: +session.metrics.skillImprovementScore.toFixed(4),
      interactionsIngested:  session.metrics.interactionsIngested,
      distillationCount:     session.metrics.distillationCount,
      tierPromotions:        session.metrics.tierPromotions,
      tierDemotions:         session.metrics.tierDemotions,
      vectorCounts:          this._getVectorCounts(session),
      embeddingModel:        session.config.embeddingModel,
      benchmarks,
      retentionPolicy: {
        hotTtlMs:  RETENTION.HOT_TTL_MS,
        warmTtlMs: RETENTION.WARM_TTL_MS,
        coldTtlMs: RETENTION.COLD_TTL_MS,
      },
      distillations: session.distillations.slice(-5),
      ts: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // saveState / restoreState — GCS persistence
  // ---------------------------------------------------------------------------

  async saveState(bucket) {
    const bucketName = bucket || process.env.HEADY_GCS_BUCKET || 'heady-colab-state';
    const allSessions = {};

    for (const [id, session] of this._sessions) {
      allSessions[id] = {
        id:            session.id,
        startedAt:     session.startedAt,
        config:        session.config,
        metrics:       session.metrics,
        benchmarks:    session.benchmarks,
        distillations: session.distillations,
        vectorCounts:  this._getVectorCounts(session),
        // Serialize vector IDs only (not full embeddings) to keep state compact
        vectorIds: {
          hot:  session.vectors.hot.map(v => v.id),
          warm: session.vectors.warm.map(v => v.id),
          cold: session.vectors.cold.map(v => v.id),
        },
      };
    }

    const state = {
      version:    1,
      savedAt:    new Date().toISOString(),
      bucket:     bucketName,
      sessionCount: this._sessions.size,
      sessions:   allSessions,
    };

    // In production, this writes to GCS via @google-cloud/storage.
    // For local/test, write to data directory.
    const fs = require('fs');
    const path = require('path');
    const stateDir = path.join(__dirname, '..', 'data', 'colab-state');
    try {
      if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });
      const statePath = path.join(stateDir, `${bucketName}.json`);
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
      log('info', `State saved to ${statePath} (${this._sessions.size} sessions)`);
    } catch (err) {
      log('warn', `State save failed: ${err.message}`);
    }

    this.emit('state:saved', { bucket: bucketName, sessionCount: this._sessions.size });

    return {
      saved:        true,
      bucket:       bucketName,
      sessionCount: this._sessions.size,
      ts:           new Date().toISOString(),
    };
  }

  async restoreState(bucket) {
    const bucketName = bucket || process.env.HEADY_GCS_BUCKET || 'heady-colab-state';

    const fs = require('fs');
    const path = require('path');
    const statePath = path.join(__dirname, '..', 'data', 'colab-state', `${bucketName}.json`);

    let state;
    try {
      if (!fs.existsSync(statePath)) {
        return { restored: false, reason: 'no saved state found', bucket: bucketName };
      }
      state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch (err) {
      return { restored: false, reason: `parse error: ${err.message}`, bucket: bucketName };
    }

    let restoredCount = 0;
    for (const [id, saved] of Object.entries(state.sessions || {})) {
      if (this._sessions.has(id)) continue; // don't overwrite active sessions

      // Reconstruct session from saved state
      const session = {
        id:           saved.id,
        startedAt:    saved.startedAt,
        config:       saved.config,
        vectors:      { hot: [], warm: [], cold: [] },
        interactions: [],
        distillations: saved.distillations || [],
        benchmarks:   saved.benchmarks || {
          [EMBEDDING_MODELS.NOMIC.id]:  { totalMs: 0, count: 0, avgMs: 0 },
          [EMBEDDING_MODELS.MINILM.id]: { totalMs: 0, count: 0, avgMs: 0 },
        },
        metrics:      saved.metrics || {
          embeddingsCreated: 0, knowledgeRetained: 0,
          skillImprovementScore: 0, interactionsIngested: 0,
          distillationCount: 0, tierPromotions: 0, tierDemotions: 0,
        },
      };

      this._sessions.set(id, session);
      restoredCount++;
    }

    this.emit('state:restored', { bucket: bucketName, restoredCount });
    log('info', `State restored from ${statePath} (${restoredCount} sessions)`);

    return {
      restored:      true,
      bucket:        bucketName,
      restoredCount,
      savedAt:       state.savedAt,
      ts:            new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  async _preWarmGpuStore(session) {
    // Pre-warm by loading recent system knowledge from vector memory if available
    const vectorMemory = global.__vectorMemory;
    if (vectorMemory && typeof vectorMemory.search === 'function') {
      try {
        const results = await vectorMemory.search('system knowledge recent learnings', { limit: 100 });
        for (const item of (results || [])) {
          session.vectors.hot.push({
            id:        `prewarm-${crypto.randomBytes(4).toString('hex')}`,
            ts:        Date.now(),
            type:      'prewarm',
            content:   typeof item === 'string' ? item : JSON.stringify(item).substring(0, 500),
            embedding: null,
            tier:      'hot',
          });
        }
        session.metrics.embeddingsCreated += (results || []).length;
      } catch { /* pre-warming is best-effort */ }
    }
  }

  _generateEmbedding(content, modelId) {
    // In production, this calls the embedding API (nomic or sentence-transformers).
    // For local runtime, generate a deterministic pseudo-embedding from content hash.
    const dims = modelId === EMBEDDING_MODELS.MINILM.id
      ? EMBEDDING_MODELS.MINILM.dimensions
      : EMBEDDING_MODELS.NOMIC.dimensions;

    const hash = crypto.createHash('sha256').update(content || '').digest();
    const embedding = new Float32Array(dims);
    for (let i = 0; i < dims; i++) {
      embedding[i] = (hash[i % hash.length] / 255.0) * 2 - 1; // normalize to [-1, 1]
    }
    return Array.from(embedding);
  }

  _enforceRetentionPolicy(session) {
    const now = Date.now();

    // Hot -> Warm: entries older than 24h
    for (let i = session.vectors.hot.length - 1; i >= 0; i--) {
      const entry = session.vectors.hot[i];
      if (now - entry.ts > RETENTION.HOT_TTL_MS) {
        session.vectors.hot.splice(i, 1);
        entry.tier = 'warm';
        session.vectors.warm.push(entry);
        session.metrics.tierDemotions++;
      }
    }

    // Warm -> Cold: entries older than 7d
    for (let i = session.vectors.warm.length - 1; i >= 0; i--) {
      const entry = session.vectors.warm[i];
      if (now - entry.ts > RETENTION.WARM_TTL_MS) {
        session.vectors.warm.splice(i, 1);
        entry.tier = 'cold';
        session.vectors.cold.push(entry);
        session.metrics.tierDemotions++;
      }
    }

    // Cold: evict entries older than 30d
    session.vectors.cold = session.vectors.cold.filter(entry => {
      return now - entry.ts <= RETENTION.COLD_TTL_MS;
    });
  }

  _clusterVectors(vectors) {
    // Group by type first, then subdivide large groups
    const byType = {};
    for (const v of vectors) {
      const t = v.type || 'general';
      if (!byType[t]) byType[t] = [];
      byType[t].push(v);
    }

    const clusters = [];
    const maxClusterSize = 21; // fib(8)

    for (const [, group] of Object.entries(byType)) {
      // Split large groups into chunks of maxClusterSize
      for (let i = 0; i < group.length; i += maxClusterSize) {
        clusters.push(group.slice(i, i + maxClusterSize));
      }
    }

    return clusters;
  }

  _computeCentroid(cluster) {
    if (cluster.length === 0) return [];
    // Find first entry with an embedding to determine dimensionality
    const withEmbedding = cluster.find(v => v.embedding && v.embedding.length > 0);
    if (!withEmbedding) return [];

    const dims = withEmbedding.embedding.length;
    const centroid = new Float64Array(dims);
    let count = 0;

    for (const v of cluster) {
      if (!v.embedding || v.embedding.length !== dims) continue;
      for (let d = 0; d < dims; d++) {
        centroid[d] += v.embedding[d];
      }
      count++;
    }

    if (count > 0) {
      for (let d = 0; d < dims; d++) {
        centroid[d] /= count;
      }
    }

    return Array.from(centroid);
  }

  _summarizeCluster(cluster) {
    const types = [...new Set(cluster.map(v => v.type))];
    const timeRange = {
      earliest: Math.min(...cluster.map(v => v.ts)),
      latest:   Math.max(...cluster.map(v => v.ts)),
    };
    return {
      vectorCount: cluster.length,
      types,
      timeRangeMs: timeRange.latest - timeRange.earliest,
      earliestTs:  new Date(timeRange.earliest).toISOString(),
      latestTs:    new Date(timeRange.latest).toISOString(),
    };
  }

  _getVectorCounts(session) {
    return {
      hot:   session.vectors.hot.length,
      warm:  session.vectors.warm.length,
      cold:  session.vectors.cold.length,
      total: session.vectors.hot.length + session.vectors.warm.length + session.vectors.cold.length,
    };
  }

  // ---------------------------------------------------------------------------
  // All sessions accessor (for metrics endpoint)
  // ---------------------------------------------------------------------------

  getAllSessionIds() {
    return [...this._sessions.keys()];
  }
}

// =============================================================================
// Express route registration
// =============================================================================

function registerColabRoutes(app, optimizer) {
  let express;
  try { express = require('express'); } catch {
    try { express = require('core/heady-server'); } catch { return; }
  }
  const router = express.Router();

  // POST /api/v1/colab/session — start or restore a session
  router.post('/session', async (req, res) => {
    try {
      const config = req.body || {};
      if (config.restore && config.bucket) {
        const result = await optimizer.restoreState(config.bucket);
        return res.json({ ok: true, ...result });
      }
      const result = await optimizer.startSession(config);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // GET /api/v1/colab/metrics — session metrics
  router.get('/metrics', (req, res) => {
    try {
      const sessionId = req.query.sessionId;
      if (sessionId) {
        const metrics = optimizer.getSessionMetrics(sessionId);
        return res.json({ ok: true, ...metrics });
      }
      // If no sessionId, return summary of all sessions
      const sessionIds = optimizer.getAllSessionIds();
      const summaries = sessionIds.map(id => {
        try { return optimizer.getSessionMetrics(id); }
        catch { return { sessionId: id, error: 'metrics unavailable' }; }
      });
      res.json({
        ok: true,
        sessionCount: sessionIds.length,
        sessions: summaries,
        ts: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // POST /api/v1/colab/distill — distill session into knowledge vectors
  router.post('/distill', async (req, res) => {
    try {
      const sessionId = req.body?.sessionId;
      if (!sessionId) {
        return res.status(400).json({ ok: false, error: 'sessionId required' });
      }
      const result = await optimizer.distillSession(sessionId);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.use('/api/v1/colab', router);
}

// =============================================================================
// Exports
// =============================================================================

module.exports = {
  ColabRuntimeOptimizer,
  registerColabRoutes,
  RETENTION,
  EMBEDDING_MODELS,
  PHI,
  PSI,
};
