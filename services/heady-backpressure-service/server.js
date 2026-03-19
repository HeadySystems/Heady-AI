/**
 * @fileoverview HeadyBackpressureService — Semantic backpressure manager.
 * Implements Google SRE adaptive throttling with phi-weighted priority scoring,
 * semantic deduplication at cosine >= 0.972, automatic load shedding by CSL
 * criticality tier, and upstream backpressure signal propagation via SSE.
 * @module heady-backpressure-service
 */

'use strict';

const express = require('express');
const crypto = require('crypto');

// ── PHI-MATH CONSTANTS ──────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };

/** Pool allocation percentages derived from Fibonacci */
const POOL_ALLOC = { HOT: FIB[9] / 100, WARM: FIB[8] / 100, COLD: FIB[7] / 100, RESERVE: FIB[6] / 100 };

/** Swarm names for queue monitoring */
const SWARMS = [
  'Code', 'Security', 'Architecture', 'Research', 'Creative', 'Documentation',
  'Monitoring', 'Cleanup', 'Analytics', 'Deployment', 'Memory', 'Pipeline',
  'Trading', 'Resilience', 'Connector', 'Intelligence', 'Governance'
];

/**
 * Structured JSON logger with correlation IDs.
 * @param {string} level - Log level
 * @param {string} msg - Log message
 * @param {Object} meta - Additional metadata
 * @param {string} [correlationId] - Correlation ID
 */
function log(level, msg, meta = {}, correlationId = null) {
  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: 'heady-backpressure-service',
    level,
    correlationId: correlationId || crypto.randomUUID(),
    message: msg,
    ...meta
  }) + '\n');
}

/**
 * Phi-backoff delay calculation.
 * @param {number} attempt - Attempt number (0-indexed)
 * @returns {number} Delay in milliseconds
 */
function phiBackoff(attempt) {
  return FIB[Math.min(attempt, FIB.length - 1)] * PSI * 1000;
}

/**
 * Cosine similarity between two vectors.
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} Cosine similarity [-1, 1]
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
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
 * HeadyBackpressureService — Semantic backpressure manager with SRE adaptive throttling.
 */
class HeadyBackpressureService {
  /**
   * @param {Object} config - Service configuration
   * @param {number} [config.port=3401] - HTTP port
   * @param {number} [config.maxQueueDepth] - Maximum queue depth per swarm
   * @param {number} [config.shedThreshold] - Load shedding threshold ratio
   * @param {number} [config.monitorIntervalMs] - Queue monitoring interval
   */
  constructor(config = {}) {
    this.port = config.port || 3401;
    this.maxQueueDepth = config.maxQueueDepth || FIB[12];
    this.shedThreshold = config.shedThreshold || PSI;
    this.monitorIntervalMs = config.monitorIntervalMs || FIB[8] * FIB[5] * PHI;
    /** @type {Map<string, Array<{id: string, priority: number, embedding: number[], csl: number, timestamp: number}>>} */
    this.queues = new Map();
    /** @type {Map<string, {accepts: number, requests: number, throttleRatio: number}>} */
    this.swarmMetrics = new Map();
    /** @type {Set<import('http').ServerResponse>} */
    this.sseClients = new Set();
    /** @type {Map<string, number[]>} */
    this.recentEmbeddings = new Map();
    this.app = express();
    this.server = null;
    this._monitorTimer = null;
    this._started = false;
    this._systemPressure = 0;
    this._initializeQueues();
  }

  /** Initialize queue structures for all 17 swarms. @private */
  _initializeQueues() {
    for (const swarm of SWARMS) {
      this.queues.set(swarm, []);
      this.swarmMetrics.set(swarm, { accepts: 0, requests: 0, throttleRatio: 0 });
    }
    log('info', 'Queues initialized', { swarmCount: SWARMS.length });
  }

  /**
   * Google SRE adaptive throttling: rejection probability = max(0, (requests - K*accepts) / (requests + 1)).
   * K is phi-weighted based on CSL criticality.
   * @param {string} swarm - Swarm name
   * @param {number} csl - CSL score of incoming request
   * @returns {boolean} True if request should be accepted
   */
  shouldAccept(swarm, csl) {
    const metrics = this.swarmMetrics.get(swarm);
    if (!metrics) return false;
    const K = csl >= CSL.CRITICAL ? PHI * PHI : csl >= CSL.HIGH ? PHI : 1;
    const rejectionProb = Math.max(0, (metrics.requests - K * metrics.accepts) / (metrics.requests + 1));
    const accepted = Math.random() > rejectionProb;
    metrics.requests++;
    if (accepted) metrics.accepts++;
    metrics.throttleRatio = metrics.requests > 0 ? 1 - (metrics.accepts / metrics.requests) : 0;
    return accepted;
  }

  /**
   * Semantic deduplication check. Returns true if a sufficiently similar request exists.
   * @param {string} swarm - Swarm name
   * @param {number[]} embedding - 384D embedding vector
   * @returns {boolean} True if duplicate found (cosine >= DEDUP threshold)
   */
  isDuplicate(swarm, embedding) {
    if (!embedding || embedding.length === 0) return false;
    const key = `${swarm}`;
    const recent = this.recentEmbeddings.get(key) || [];
    for (const existing of recent) {
      if (cosineSimilarity(embedding, existing) >= CSL.DEDUP) return true;
    }
    recent.push(embedding);
    if (recent.length > FIB[8]) recent.shift();
    this.recentEmbeddings.set(key, recent);
    return false;
  }

  /**
   * Enqueue a task with phi-weighted priority scoring.
   * @param {string} swarm - Target swarm
   * @param {Object} task - Task object
   * @param {number} task.priority - Base priority [0, 1]
   * @param {number[]} [task.embedding] - 384D embedding for dedup
   * @param {number} [task.csl] - CSL criticality score
   * @returns {Object} Enqueue result
   */
  enqueue(swarm, task) {
    const correlationId = crypto.randomUUID();
    const queue = this.queues.get(swarm);
    if (!queue) return { accepted: false, reason: 'Unknown swarm', correlationId };
    const csl = task.csl || CSL.MEDIUM;

    if (this.isDuplicate(swarm, task.embedding)) {
      log('info', 'Semantic duplicate rejected', { swarm }, correlationId);
      return { accepted: false, reason: 'semantic_duplicate', correlationId };
    }

    if (!this.shouldAccept(swarm, csl)) {
      log('warn', 'Request throttled by SRE adaptive throttling', { swarm, csl }, correlationId);
      this._broadcastSSE({ type: 'throttle', swarm, csl, correlationId });
      return { accepted: false, reason: 'throttled', correlationId };
    }

    if (queue.length >= this.maxQueueDepth) {
      if (csl < CSL.HIGH) {
        log('warn', 'Queue full, shedding low-priority request', { swarm, csl, queueDepth: queue.length }, correlationId);
        this._broadcastSSE({ type: 'shed', swarm, csl, correlationId });
        return { accepted: false, reason: 'load_shed', correlationId };
      }
      const lowestIdx = queue.reduce((minIdx, item, idx, arr) => item.priority < arr[minIdx].priority ? idx : minIdx, 0);
      const removed = queue.splice(lowestIdx, 1)[0];
      log('info', 'Evicted lowest priority to make room', { swarm, evictedId: removed.id }, correlationId);
    }

    const phiPriority = (task.priority || PSI) * (csl >= CSL.CRITICAL ? PHI * PHI : csl >= CSL.HIGH ? PHI : 1);
    const entry = { id: correlationId, priority: phiPriority, embedding: task.embedding || [], csl, timestamp: Date.now() };
    queue.push(entry);
    queue.sort((a, b) => b.priority - a.priority);
    log('info', 'Task enqueued', { swarm, priority: phiPriority, queueDepth: queue.length }, correlationId);
    return { accepted: true, position: queue.indexOf(entry), queueDepth: queue.length, correlationId };
  }

  /**
   * Dequeue the highest priority task from a swarm.
   * @param {string} swarm - Swarm name
   * @returns {Object|null} Dequeued task or null
   */
  dequeue(swarm) {
    const queue = this.queues.get(swarm);
    if (!queue || queue.length === 0) return null;
    return queue.shift();
  }

  /**
   * Calculate system-wide pressure as weighted average of all queue utilizations.
   * @returns {number} System pressure [0, 1]
   */
  calculateSystemPressure() {
    let totalWeightedUtil = 0;
    let totalWeight = 0;
    for (const swarm of SWARMS) {
      const queue = this.queues.get(swarm);
      const util = queue ? queue.length / this.maxQueueDepth : 0;
      const weight = swarm === 'Security' || swarm === 'Governance' ? PHI : 1;
      totalWeightedUtil += util * weight;
      totalWeight += weight;
    }
    this._systemPressure = totalWeight > 0 ? totalWeightedUtil / totalWeight : 0;
    return this._systemPressure;
  }

  /**
   * Broadcast SSE event to all connected upstream clients.
   * @param {Object} data - Event data
   * @private
   */
  _broadcastSSE(data) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of this.sseClients) {
      try { client.write(payload); } catch { this.sseClients.delete(client); }
    }
  }

  /**
   * Run monitoring cycle: calculate pressure, emit SSE, log warnings.
   * @private
   */
  _monitorCycle() {
    const pressure = this.calculateSystemPressure();
    const swarmStatus = {};
    for (const swarm of SWARMS) {
      const queue = this.queues.get(swarm);
      const metrics = this.swarmMetrics.get(swarm);
      swarmStatus[swarm] = { depth: queue ? queue.length : 0, throttleRatio: metrics ? metrics.throttleRatio : 0 };
    }
    this._broadcastSSE({ type: 'pressure', systemPressure: pressure, swarmStatus, timestamp: new Date().toISOString() });
    if (pressure > PSI) log('warn', 'System pressure exceeds PSI threshold', { pressure });
  }

  /** Set up Express routes. @private */
  _setupRoutes() {
    this.app.use(express.json());

    // Security headers
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      next();
    });

    this.app.get('/health', (_req, res) => {
      const pressure = this.calculateSystemPressure();
      const coherence = 1 - pressure;
      res.json({
        status: coherence >= CSL.MEDIUM ? 'healthy' : coherence >= CSL.LOW ? 'pressured' : 'overloaded',
        coherence,
        systemPressure: pressure,
        totalQueued: SWARMS.reduce((sum, s) => sum + (this.queues.get(s)?.length || 0), 0),
        timestamp: new Date().toISOString()
      });
    });

    this.app.post('/enqueue/:swarm', (req, res) => {
      const result = this.enqueue(req.params.swarm, req.body);
      res.status(result.accepted ? 201 : 429).json(result);
    });

    this.app.post('/dequeue/:swarm', (req, res) => {
      const task = this.dequeue(req.params.swarm);
      if (!task) return res.status(204).end();
      res.json(task);
    });

    this.app.get('/pressure', (_req, res) => {
      const pressure = this.calculateSystemPressure();
      const swarmPressures = {};
      for (const swarm of SWARMS) {
        const q = this.queues.get(swarm);
        swarmPressures[swarm] = { depth: q ? q.length : 0, utilization: q ? q.length / this.maxQueueDepth : 0, metrics: this.swarmMetrics.get(swarm) };
      }
      res.json({ systemPressure: pressure, swarms: swarmPressures, timestamp: new Date().toISOString() });
    });

    this.app.get('/sse/pressure', (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      this.sseClients.add(res);
      req.on('close', () => this.sseClients.delete(res));
    });

    this.app.post('/reset/:swarm', (req, res) => {
      const queue = this.queues.get(req.params.swarm);
      if (!queue) return res.status(404).json({ error: 'Unknown swarm' });
      const cleared = queue.length;
      queue.length = 0;
      this.swarmMetrics.set(req.params.swarm, { accepts: 0, requests: 0, throttleRatio: 0 });
      res.json({ swarm: req.params.swarm, cleared });
    });
  }

  /**
   * Start the backpressure service.
   * @returns {Promise<void>}
   */
  async start() {
    if (this._started) return;
    this._setupRoutes();
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        this._started = true;
        this._monitorTimer = setInterval(() => this._monitorCycle(), this.monitorIntervalMs);
        log('info', 'HeadyBackpressureService started', { port: this.port, swarms: SWARMS.length });
        resolve();
      });
    });
  }

  /**
   * Gracefully stop the backpressure service.
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this._started) return;
    clearInterval(this._monitorTimer);
    for (const client of this.sseClients) { try { client.end(); } catch { /* noop */ } }
    this.sseClients.clear();
    return new Promise((resolve) => {
      this.server.close(() => { this._started = false; log('info', 'HeadyBackpressureService stopped'); resolve(); });
    });
  }

  /**
   * Health check.
   * @returns {Object} Health status
   */
  health() {
    const pressure = this.calculateSystemPressure();
    return { status: pressure < PSI ? 'healthy' : 'pressured', coherence: 1 - pressure, systemPressure: pressure };
  }
}

module.exports = { HeadyBackpressureService, PHI, PSI, FIB, CSL, SWARMS, POOL_ALLOC, cosineSimilarity, phiBackoff };
