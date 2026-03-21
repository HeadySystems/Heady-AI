'use strict';
const { createLogger } = require('../../utils/logger');
const logger = createLogger('auto-fixed');

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
const CSL = {
  MINIMUM: 0.500,
  LOW: 0.691,
  MEDIUM: 0.809,
  HIGH: 0.882,
  CRITICAL: 0.927,
  DEDUP: 0.972
};
class HeadyArchaeologistAgent {
  /**
   * @param {object} config
   * @param {number} [config.excavationDepths] — Fibonacci-windowed depths (default 5 layers)
   * @param {number} [config.maxArtifacts] — max artifacts per excavation (default FIB[10]=55)
   * @param {Function} [config.memoryQueryFn] — function to query vector memory
   */
  constructor(config = {}) {
    this.excavationDepths = config.excavationDepths || 5;
    this.maxArtifacts = config.maxArtifacts || FIB[10];
    this.memoryQueryFn = config.memoryQueryFn || this._defaultMemoryQuery.bind(this);
    this.discoveredArtifacts = [];
    this.excavationHistory = [];
    this.state = 'IDLE';
    this.stats = {
      excavations: 0,
      artifactsFound: 0,
      insightsGenerated: 0,
      resurfaced: 0
    };
    this._correlationId = `archaeologist-${Date.now().toString(36)}`;
  }

  /**
   * Execute a full excavation at multiple Fibonacci-windowed time depths
   * @param {object} context — { queryEmbedding, domain, minAge }
   * @returns {object} — excavation report
   */
  async excavate(context) {
    const {
      queryEmbedding,
      domain = 'all',
      minAge = FIB[14] * 3600000
    } = context;
    this.state = 'EXCAVATING';
    this.stats.excavations++;
    const correlationId = `excav-${Date.now().toString(36)}`;
    const artifacts = [];

    // Fibonacci-windowed depth layers (each deeper in time)
    for (let depth = 0; depth < this.excavationDepths; depth++) {
      const windowStart = minAge * Math.pow(PHI, depth);
      const windowEnd = minAge * Math.pow(PHI, depth + 1);
      const layerArtifacts = await this._excavateLayer(queryEmbedding, domain, windowStart, windowEnd, depth);
      artifacts.push(...layerArtifacts);
      this._log('info', 'layer-excavated', {
        correlationId,
        depth,
        windowStartHours: Math.round(windowStart / 3600000),
        windowEndHours: Math.round(windowEnd / 3600000),
        found: layerArtifacts.length
      });
    }
    const scored = this._scoreArtifacts(artifacts, queryEmbedding);
    const topArtifacts = scored.slice(0, this.maxArtifacts);

    // Generate insights from cross-layer patterns
    const insights = this._generateInsights(topArtifacts);
    this.discoveredArtifacts = topArtifacts;
    this.stats.artifactsFound += topArtifacts.length;
    this.stats.insightsGenerated += insights.length;
    const report = {
      correlationId,
      domain,
      depthLayers: this.excavationDepths,
      totalArtifacts: topArtifacts.length,
      insights,
      artifacts: topArtifacts.map(a => ({
        id: a.id,
        relevance: a.finalScore,
        age: a.age,
        layer: a.layer,
        summary: a.summary
      })),
      coherence: this._calculateCoherence(),
      timestamp: new Date().toISOString()
    };
    this.excavationHistory.push({
      correlationId,
      timestamp: Date.now(),
      artifactCount: topArtifacts.length,
      insightCount: insights.length
    });
    this.state = 'IDLE';
    return report;
  }
  async _excavateLayer(queryEmbedding, domain, windowStart, windowEnd, depth) {
    const now = Date.now();
    const results = await this.memoryQueryFn({
      embedding: queryEmbedding,
      domain,
      timestampBefore: now - windowStart,
      timestampAfter: now - windowEnd,
      limit: FIB[8 + depth] || FIB[8],
      minSimilarity: CSL.MINIMUM
    });
    return results.map(r => ({
      ...r,
      layer: depth,
      age: now - (r.timestamp || now),
      windowDepth: depth
    }));
  }
  _scoreArtifacts(artifacts, queryEmbedding) {
    return artifacts.map(artifact => {
      const baseSimilarity = artifact.similarity || CSL.MINIMUM;
      const ageHours = artifact.age / 3600000;
      const forgottenBonus = Math.log(1 + ageHours) * PSI * 0.1;
      // Layer depth bonus: deeper excavation = rarer finds
      const depthBonus = artifact.layer * PSI * 0.05;
      // Access frequency penalty: frequently accessed = less novel
      const accessPenalty = (artifact.accessCount || 0) * 0.01;
      const finalScore = Math.min(1.0, baseSimilarity + forgottenBonus + depthBonus - accessPenalty);
      return {
        ...artifact,
        baseSimilarity,
        forgottenBonus,
        depthBonus,
        accessPenalty,
        finalScore
      };
    }).sort((a, b) => b.finalScore - a.finalScore);
  }

  /**
   * Generate insights by finding cross-layer patterns
   * @param {Array} artifacts — scored artifacts
   */
  _generateInsights(artifacts) {
    const insights = [];
    if (artifacts.length < 2) return insights;
    for (let i = 0; i < Math.min(artifacts.length, FIB[8]); i++) {
      for (let j = i + 1; j < Math.min(artifacts.length, FIB[8]); j++) {
        if (artifacts[i].layer !== artifacts[j].layer) {
          const ageDiff = Math.abs(artifacts[i].age - artifacts[j].age);
          if (ageDiff > FIB[12] * 3600000) {
            insights.push({
              type: 'temporal-bridge',
              description: `Similar knowledge found across ${Math.round(ageDiff / 86400000)} day gap`,
              artifactIds: [artifacts[i].id, artifacts[j].id],
              significance: Math.min(1.0, ageDiff / (FIB[14] * 3600000)),
              timestamp: Date.now()
            });
          }
        }
      }
    }

    // Pattern 2: Dormant clusters (multiple forgotten artifacts with high mutual similarity)
    const dormant = artifacts.filter(a => a.forgottenBonus > PSI * 0.05);
    if (dormant.length >= FIB[4]) {
      insights.push({
        type: 'dormant-cluster',
        description: `${dormant.length} dormant memories form a forgotten knowledge cluster`,
        artifactIds: dormant.slice(0, FIB[8]).map(a => a.id),
        significance: dormant.length / artifacts.length,
        timestamp: Date.now()
      });
    }

    // Pattern 3: Resurfacing candidates (high relevance + high forgotten bonus)
    const resurface = artifacts.filter(a => a.finalScore >= CSL.HIGH && a.forgottenBonus > 0.02);
    for (const r of resurface.slice(0, FIB[5])) {
      this.stats.resurfaced++;
      insights.push({
        type: 'resurface-candidate',
        description: `High-relevance forgotten memory worth resurfacing`,
        artifactIds: [r.id],
        significance: r.finalScore,
        timestamp: Date.now()
      });
    }
    return insights;
  }

  /** Default memory query implementation (mock — replaced by real pgvector query in production) */
  async _defaultMemoryQuery(params) {
    return [];
  }
  _calculateCoherence() {
    if (this.stats.excavations === 0) return 1.0;
    const efficiency = this.stats.artifactsFound / Math.max(1, this.stats.excavations * this.maxArtifacts);
    return Math.min(1.0, CSL.MEDIUM + efficiency * PSI);
  }
  async start() {
    this._log('info', 'archaeologist-started', {
      excavationDepths: this.excavationDepths,
      maxArtifacts: this.maxArtifacts
    });
    return this;
  }
  async stop() {
    this.state = 'STOPPED';
    this._log('info', 'archaeologist-stopped', {
      stats: this.stats
    });
  }
  health() {
    return {
      status: 'ok',
      state: this.state,
      coherence: this._calculateCoherence(),
      stats: {
        ...this.stats
      },
      excavationHistory: this.excavationHistory.length,
      timestamp: new Date().toISOString()
    };
  }
  _log(level, event, data = {}) {
    logger.info(JSON.stringify({
      level,
      event,
      agent: 'HeadyArchaeologistAgent',
      correlationId: this._correlationId,
      ...data,
      ts: new Date().toISOString()
    }));
  }
}
module.exports = {
  HeadyArchaeologistAgent
};