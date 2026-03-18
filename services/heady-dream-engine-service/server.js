/**
 * @fileoverview HeadyDreamEngineService — Autonomous background ideation system.
 * When idle, traverses 384D vector memory finding unexpected semantic bridges
 * between distant knowledge clusters. Phi-scaled random walks, CSL-gated
 * novelty detection, Monte Carlo divergent search, and Fibonacci-timed dream cycles.
 * @module heady-dream-engine-service
 */

'use strict';

const express = require('express');
const crypto = require('crypto');

// ── PHI-MATH CONSTANTS ──────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };

/** Embedding dimension for vector memory */
const EMBEDDING_DIM = 384;

/** Dream cycle durations in ms, Fibonacci-timed */
const DREAM_CYCLE_DURATIONS = {
  MICRO: FIB[7] * 1000,   // 13s — quick association
  LIGHT: FIB[8] * 1000,   // 21s — shallow exploration
  DEEP: FIB[9] * 1000,    // 34s — deep traversal
  REM: FIB[10] * 1000     // 55s — full divergent search
};

/** Dream states */
const DREAM_STATES = {
  AWAKE: 'AWAKE',
  DROWSY: 'DROWSY',
  LIGHT_SLEEP: 'LIGHT_SLEEP',
  DEEP_SLEEP: 'DEEP_SLEEP',
  REM: 'REM',
  LUCID: 'LUCID'
};

/** Novelty score thresholds for bridge detection */
const NOVELTY_THRESHOLDS = {
  MUNDANE: CSL.DEDUP,       // Too similar — not novel
  INTERESTING: CSL.MEDIUM,  // Moderate distance — worth noting
  SURPRISING: CSL.LOW,      // Far apart — surprising connection
  EUREKA: CSL.MINIMUM       // Very far apart — potential breakthrough
};

/**
 * Structured JSON logger.
 * @param {string} level - Log level
 * @param {string} msg - Message
 * @param {Object} meta - Metadata
 * @param {string} [correlationId] - Correlation ID
 */
function log(level, msg, meta = {}, correlationId = null) {
  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: 'heady-dream-engine-service',
    level,
    correlationId: correlationId || crypto.randomUUID(),
    message: msg,
    ...meta
  }) + '\n');
}

/**
 * Phi-backoff delay.
 * @param {number} attempt - Attempt number
 * @returns {number} Delay in ms
 */
function phiBackoff(attempt) {
  return FIB[Math.min(attempt, FIB.length - 1)] * PSI * 1000;
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
 * Seeded PRNG for reproducible random walks.
 * @param {number} seed - Seed value
 * @returns {Function} Random generator
 */
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

/**
 * HeadyDreamEngineService — Autonomous background ideation system.
 */
class HeadyDreamEngineService {
  /**
   * @param {Object} config - Service configuration
   * @param {number} [config.port=3407] - HTTP port
   * @param {number} [config.maxMemories] - Maximum memories in the knowledge store
   * @param {number} [config.maxInsights] - Maximum cached insights
   * @param {number} [config.dreamIntervalMs] - Interval between dream cycles
   */
  constructor(config = {}) {
    this.port = config.port || 3407;
    this.maxMemories = config.maxMemories || FIB[12]; // 144
    this.maxInsights = config.maxInsights || FIB[10]; // 55
    this.dreamIntervalMs = config.dreamIntervalMs || DREAM_CYCLE_DURATIONS.LIGHT;
    /** @type {Map<string, {id: string, embedding: number[], content: string, domain: string, timestamp: number, accessCount: number}>} */
    this.knowledgeStore = new Map();
    /** @type {Array<{id: string, type: string, bridgeA: string, bridgeB: string, similarity: number, novelty: string, content: string, dreamCycle: number, timestamp: number}>} */
    this.insights = [];
    /** @type {string} */
    this.dreamState = DREAM_STATES.AWAKE;
    /** @type {number} */
    this.dreamCycleCount = 0;
    /** @type {Array<{cycle: number, state: string, insightsFound: number, bridgesExplored: number, timestamp: number}>} */
    this.dreamLog = [];
    this._dreamTimer = null;
    this._rng = seededRandom(Date.now());
    this.app = express();
    this.server = null;
    this._started = false;
    this._coherence = CSL.HIGH;
  }

  /**
   * Ingest a knowledge memory into the store.
   * @param {string} id - Memory identifier
   * @param {number[]} embedding - 384D embedding vector
   * @param {string} content - Text content
   * @param {string} [domain] - Knowledge domain
   * @returns {Object} Ingestion result
   */
  ingestMemory(id, embedding, content, domain = 'general') {
    if (this.knowledgeStore.size >= this.maxMemories) {
      // Evict least-accessed memory
      let leastAccessed = null;
      let minAccess = Infinity;
      for (const [memId, mem] of this.knowledgeStore) {
        if (mem.accessCount < minAccess) {
          minAccess = mem.accessCount;
          leastAccessed = memId;
        }
      }
      if (leastAccessed) this.knowledgeStore.delete(leastAccessed);
    }

    this.knowledgeStore.set(id, {
      id,
      embedding: embedding || [],
      content: content || '',
      domain,
      timestamp: Date.now(),
      accessCount: 0
    });

    return { id, stored: true, totalMemories: this.knowledgeStore.size };
  }

  /**
   * Perform a phi-scaled random walk through the knowledge space.
   * At each step, jump to a memory that is moderately similar (in the "interesting" range).
   * @param {string} startId - Starting memory ID
   * @param {number} steps - Number of walk steps
   * @returns {Object} Walk path and discovered bridges
   */
  phiRandomWalk(startId, steps) {
    const start = this.knowledgeStore.get(startId);
    if (!start) throw new Error('Start memory not found');

    const path = [startId];
    const bridges = [];
    let current = start;

    for (let step = 0; step < steps; step++) {
      const candidates = [];
      for (const [memId, mem] of this.knowledgeStore) {
        if (path.includes(memId)) continue;
        if (current.embedding.length === 0 || mem.embedding.length === 0) continue;
        const sim = cosineSimilarity(current.embedding, mem.embedding);
        // Phi-scaled selection: prefer memories in the "interesting" similarity range
        // Not too similar (boring), not too different (noise)
        const idealSim = PSI; // Golden ratio inverse as ideal similarity distance
        const distFromIdeal = Math.abs(sim - idealSim);
        const score = 1 / (1 + distFromIdeal * PHI);
        candidates.push({ id: memId, memory: mem, similarity: sim, score });
      }

      if (candidates.length === 0) break;

      // Weighted random selection using phi scores
      candidates.sort((a, b) => b.score - a.score);
      const totalScore = candidates.reduce((s, c) => s + c.score, 0);
      let roll = this._rng() * totalScore;
      let selected = candidates[0];
      for (const c of candidates) {
        roll -= c.score;
        if (roll <= 0) { selected = c; break; }
      }

      path.push(selected.id);
      selected.memory.accessCount++;

      // Check if this connection forms a bridge (cross-domain or surprising similarity)
      const isCrossDomain = current.domain !== selected.memory.domain;
      const noveltyCategory = this._classifyNovelty(selected.similarity);

      if (isCrossDomain && noveltyCategory !== 'MUNDANE') {
        bridges.push({
          from: current.id,
          to: selected.id,
          similarity: selected.similarity,
          novelty: noveltyCategory,
          domains: [current.domain, selected.memory.domain]
        });
      }

      current = selected.memory;
    }

    return { startId, steps, path, bridges, pathLength: path.length };
  }

  /**
   * Classify the novelty of a similarity score.
   * @param {number} similarity - Cosine similarity
   * @returns {string} Novelty classification
   * @private
   */
  _classifyNovelty(similarity) {
    if (similarity >= NOVELTY_THRESHOLDS.MUNDANE) return 'MUNDANE';
    if (similarity >= NOVELTY_THRESHOLDS.INTERESTING) return 'INTERESTING';
    if (similarity >= NOVELTY_THRESHOLDS.SURPRISING) return 'SURPRISING';
    return 'EUREKA';
  }

  /**
   * Monte Carlo divergent search: launch random walks from multiple starting points.
   * @param {number} numWalks - Number of parallel walks
   * @param {number} stepsPerWalk - Steps per walk
   * @returns {Object} Aggregated search results
   */
  divergentSearch(numWalks, stepsPerWalk) {
    const memoryIds = Array.from(this.knowledgeStore.keys());
    if (memoryIds.length < FIB[4]) return { walks: 0, bridges: [], reason: 'Insufficient memories' };

    const allBridges = [];
    const walkSummaries = [];

    for (let i = 0; i < numWalks; i++) {
      const startIdx = Math.floor(this._rng() * memoryIds.length);
      const startId = memoryIds[startIdx];
      try {
        const walk = this.phiRandomWalk(startId, stepsPerWalk);
        walkSummaries.push({ startId, pathLength: walk.pathLength, bridgesFound: walk.bridges.length });
        allBridges.push(...walk.bridges);
      } catch {
        // Skip failed walks
      }
    }

    // Deduplicate bridges by pair
    const uniqueBridges = new Map();
    for (const bridge of allBridges) {
      const key = [bridge.from, bridge.to].sort().join('::');
      if (!uniqueBridges.has(key) || bridge.novelty === 'EUREKA') {
        uniqueBridges.set(key, bridge);
      }
    }

    return {
      walks: walkSummaries.length,
      totalBridges: allBridges.length,
      uniqueBridges: Array.from(uniqueBridges.values()),
      walkSummaries
    };
  }

  /**
   * Execute a dream cycle. Transitions through dream states, performs divergent search.
   * @returns {Object} Dream cycle report
   */
  async dreamCycle() {
    this.dreamCycleCount++;
    const cycleId = crypto.randomUUID();

    // Transition: AWAKE → DROWSY → LIGHT → DEEP → REM → AWAKE
    this.dreamState = DREAM_STATES.DROWSY;
    log('info', 'Dream cycle starting', { cycle: this.dreamCycleCount, state: this.dreamState }, cycleId);

    this.dreamState = DREAM_STATES.LIGHT_SLEEP;
    // Light phase: quick associations
    const lightSearch = this.divergentSearch(FIB[4], FIB[5]); // 3 walks, 5 steps

    this.dreamState = DREAM_STATES.DEEP_SLEEP;
    // Deep phase: thorough exploration
    const deepSearch = this.divergentSearch(FIB[5], FIB[7]); // 5 walks, 13 steps

    this.dreamState = DREAM_STATES.REM;
    // REM phase: creative leaps
    const remSearch = this.divergentSearch(FIB[6], FIB[8]); // 8 walks, 21 steps

    // Collect all unique bridges
    const allBridges = [...lightSearch.uniqueBridges, ...deepSearch.uniqueBridges, ...remSearch.uniqueBridges];
    const eurekas = allBridges.filter(b => b.novelty === 'EUREKA');
    const surprises = allBridges.filter(b => b.novelty === 'SURPRISING');

    // Generate insights from bridges
    const newInsights = [];
    for (const bridge of [...eurekas, ...surprises].slice(0, FIB[5])) {
      const insight = {
        id: crypto.randomUUID(),
        type: bridge.novelty === 'EUREKA' ? 'breakthrough' : 'connection',
        bridgeA: bridge.from,
        bridgeB: bridge.to,
        similarity: bridge.similarity,
        novelty: bridge.novelty,
        content: `Unexpected ${bridge.novelty.toLowerCase()} bridge between ${bridge.domains.join(' and ')} domains`,
        dreamCycle: this.dreamCycleCount,
        timestamp: Date.now()
      };
      newInsights.push(insight);
      this.insights.push(insight);
    }

    // Trim insights to max
    if (this.insights.length > this.maxInsights) {
      this.insights = this.insights.slice(this.insights.length - this.maxInsights);
    }

    this.dreamState = DREAM_STATES.AWAKE;

    const report = {
      cycleId,
      cycleNumber: this.dreamCycleCount,
      phases: {
        light: { walks: lightSearch.walks, bridges: lightSearch.uniqueBridges.length },
        deep: { walks: deepSearch.walks, bridges: deepSearch.uniqueBridges.length },
        rem: { walks: remSearch.walks, bridges: remSearch.uniqueBridges.length }
      },
      totalBridges: allBridges.length,
      eurekas: eurekas.length,
      surprises: surprises.length,
      newInsights: newInsights.length,
      timestamp: new Date().toISOString()
    };

    this.dreamLog.push({
      cycle: this.dreamCycleCount,
      state: DREAM_STATES.AWAKE,
      insightsFound: newInsights.length,
      bridgesExplored: allBridges.length,
      timestamp: Date.now()
    });

    // Trim dream log
    if (this.dreamLog.length > FIB[8]) {
      this.dreamLog = this.dreamLog.slice(this.dreamLog.length - FIB[8]);
    }

    log('info', 'Dream cycle complete', {
      cycle: this.dreamCycleCount,
      insights: newInsights.length,
      eurekas: eurekas.length
    }, cycleId);

    return report;
  }

  /**
   * Get recent insights, optionally filtered by novelty level.
   * @param {string} [noveltyFilter] - Filter by novelty (EUREKA, SURPRISING, INTERESTING)
   * @param {number} [limit] - Max results
   * @returns {Array} Insights
   */
  getInsights(noveltyFilter = null, limit = FIB[7]) {
    let filtered = this.insights;
    if (noveltyFilter) filtered = filtered.filter(i => i.novelty === noveltyFilter);
    return filtered.slice(-limit);
  }

  /** Set up Express routes. @private */
  _setupRoutes() {
    this.app.use(express.json());

    this.app.get('/health', (_req, res) => {
      this._coherence = this.knowledgeStore.size > 0 ? CSL.HIGH : CSL.MEDIUM;
      res.json({
        status: this._coherence >= CSL.MEDIUM ? 'healthy' : 'degraded',
        coherence: this._coherence,
        dreamState: this.dreamState,
        dreamCycles: this.dreamCycleCount,
        memoriesStored: this.knowledgeStore.size,
        insightsGenerated: this.insights.length,
        timestamp: new Date().toISOString()
      });
    });

    this.app.post('/memory', (req, res) => {
      const result = this.ingestMemory(req.body.id, req.body.embedding, req.body.content, req.body.domain);
      res.status(201).json(result);
    });

    this.app.post('/walk', (req, res) => {
      try {
        const result = this.phiRandomWalk(req.body.startId, req.body.steps || FIB[7]);
        res.json(result);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });

    this.app.post('/search/divergent', (req, res) => {
      const result = this.divergentSearch(req.body.numWalks || FIB[5], req.body.stepsPerWalk || FIB[7]);
      res.json(result);
    });

    this.app.post('/dream', async (_req, res) => {
      try {
        const report = await this.dreamCycle();
        res.json(report);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/insights', (req, res) => {
      const insights = this.getInsights(req.query.novelty || null, parseInt(req.query.limit) || FIB[7]);
      res.json({ insights, total: this.insights.length });
    });

    this.app.get('/dream/log', (_req, res) => {
      res.json({ dreamLog: this.dreamLog, totalCycles: this.dreamCycleCount, currentState: this.dreamState });
    });

    this.app.post('/dream/toggle', (req, res) => {
      if (req.body.enabled && !this._dreamTimer) {
        this._dreamTimer = setInterval(() => this.dreamCycle().catch(err => log('error', 'Dream cycle error', { error: err.message })), this.dreamIntervalMs);
        res.json({ dreaming: true, interval: this.dreamIntervalMs });
      } else if (!req.body.enabled && this._dreamTimer) {
        clearInterval(this._dreamTimer);
        this._dreamTimer = null;
        this.dreamState = DREAM_STATES.AWAKE;
        res.json({ dreaming: false });
      } else {
        res.json({ dreaming: !!this._dreamTimer });
      }
    });
  }

  /** @returns {Promise<void>} */
  async start() {
    if (this._started) return;
    this._setupRoutes();
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        this._started = true;
        log('info', 'HeadyDreamEngineService started', { port: this.port });
        resolve();
      });
    });
  }

  /** @returns {Promise<void>} */
  async stop() {
    if (!this._started) return;
    if (this._dreamTimer) { clearInterval(this._dreamTimer); this._dreamTimer = null; }
    this.dreamState = DREAM_STATES.AWAKE;
    return new Promise((resolve) => {
      this.server.close(() => {
        this._started = false;
        log('info', 'HeadyDreamEngineService stopped');
        resolve();
      });
    });
  }

  /** @returns {Object} Health */
  health() {
    return { status: this._coherence >= CSL.MEDIUM ? 'healthy' : 'degraded', coherence: this._coherence, dreamState: this.dreamState, memories: this.knowledgeStore.size };
  }
}

module.exports = { HeadyDreamEngineService, PHI, PSI, FIB, CSL, DREAM_STATES, DREAM_CYCLE_DURATIONS, NOVELTY_THRESHOLDS, cosineSimilarity, phiBackoff };
