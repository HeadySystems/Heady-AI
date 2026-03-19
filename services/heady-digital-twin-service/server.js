'use strict';

/**
 * Heady™ Digital Twin Service
 * Creates live digital replicas of users, agents, and services in 384D vector space.
 * Each twin embeds behavioral patterns, preferences, and performance profiles.
 * Supports simulation and what-if analysis with phi-weighted behavioral decay.
 */

const crypto = require('crypto');
const express = require('express');

// ── Phi-Math Constants ──
const PHI = 1.618033988749895;
const PSI = 0.6180339887498949;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// ── CSL Gate Thresholds ──
const CSL = { MIN: 0.500, LOW: 0.691, MED: 0.809, HIGH: 0.882, CRIT: 0.927, DEDUP: 0.972 };

// ── Structured Logger ──
function createLogger(service) {
  return (level, message, meta = {}) => {
    const entry = {
      timestamp: new Date().toISOString(),
      correlationId: meta.correlationId || crypto.randomUUID(),
      service,
      level,
      message,
      ...meta,
    };
    process.stdout.write(JSON.stringify(entry) + '\n');
    return entry;
  };
}

// ── Vector Math Utilities ──
function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function normalizeVector(v) {
  let mag = 0;
  for (let i = 0; i < v.length; i++) mag += v[i] * v[i];
  mag = Math.sqrt(mag);
  if (mag === 0) return v;
  return v.map((x) => x / mag);
}

// ── Digital Twin (384D Embedding) ──
const EMBED_DIM = 384;

class DigitalTwin {
  constructor(entityId, profile = {}) {
    this.id = `twin_${crypto.randomUUID().slice(0, 12)}`;
    this.entityId = entityId;
    this.entityType = profile.type || 'user';
    this.embedding = new Float64Array(EMBED_DIM);
    this.behavioralPatterns = new Map();
    this.preferences = new Map();
    this.performanceMetrics = { latency: 0, throughput: 0, errorRate: 0, coherence: CSL.MED };
    this.preferenceWeights = new Float64Array(EMBED_DIM);
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.decayFactor = PSI;
    this._initFromProfile(profile);
  }

  _initFromProfile(profile) {
    // Seed embedding from profile attributes using deterministic hash-based projection
    const seed = crypto.createHash('sha256').update(this.entityId).digest();
    for (let i = 0; i < EMBED_DIM; i++) {
      this.embedding[i] = ((seed[i % seed.length] / 255) - 0.5) * 2 * PSI;
    }
    this.embedding = normalizeVector(Array.from(this.embedding));
    // Initialize preference weights using phi-scaled Fibonacci bands
    for (let i = 0; i < EMBED_DIM; i++) {
      const band = i % FIB.length;
      this.preferenceWeights[i] = Math.pow(PHI, -band / FIB.length) * PSI;
    }
    // Load behavioral patterns from profile
    if (profile.behaviors) {
      for (const [key, val] of Object.entries(profile.behaviors)) {
        this.behavioralPatterns.set(key, { value: val, timestamp: Date.now(), weight: 1.0 });
      }
    }
    // Load preferences from profile
    if (profile.preferences) {
      for (const [key, val] of Object.entries(profile.preferences)) {
        this.preferences.set(key, val);
      }
    }
    if (profile.performance) {
      Object.assign(this.performanceMetrics, profile.performance);
    }
  }

  updateBehavior(key, value) {
    const existing = this.behavioralPatterns.get(key);
    const elapsed = existing ? (Date.now() - existing.timestamp) / 1000 : 0;
    const decayedWeight = existing ? existing.weight * Math.pow(this.decayFactor, elapsed / FIB[10]) : 1.0;
    this.behavioralPatterns.set(key, { value, timestamp: Date.now(), weight: Math.max(decayedWeight, PSI * 0.1) });
    // Perturb embedding proportionally to reflect behavioral shift
    const hash = crypto.createHash('md5').update(key).digest();
    for (let i = 0; i < EMBED_DIM; i++) {
      const delta = ((hash[i % hash.length] / 255) - 0.5) * 0.01 * value;
      this.embedding[i] += delta * this.preferenceWeights[i];
    }
    this.embedding = normalizeVector(Array.from(this.embedding));
    this.updatedAt = Date.now();
  }

  similarity(other) {
    return cosineSimilarity(Array.from(this.embedding), Array.from(other.embedding));
  }

  snapshot() {
    const behaviors = {};
    for (const [k, v] of this.behavioralPatterns) behaviors[k] = v;
    const prefs = {};
    for (const [k, v] of this.preferences) prefs[k] = v;
    return {
      id: this.id, entityId: this.entityId, entityType: this.entityType,
      embeddingNorm: Math.sqrt(Array.from(this.embedding).reduce((a, b) => a + b * b, 0)),
      behavioralPatterns: behaviors, preferences: prefs,
      performanceMetrics: this.performanceMetrics,
      createdAt: this.createdAt, updatedAt: this.updatedAt,
    };
  }
}

// ── Twin Simulator (What-If Analysis) ──
class TwinSimulator {
  constructor(twin) {
    this.baseTwin = twin;
  }

  simulate(scenario) {
    // Clone embedding for isolation
    const simEmbedding = Float64Array.from(this.baseTwin.embedding);
    const perturbations = scenario.perturbations || {};
    for (const [key, magnitude] of Object.entries(perturbations)) {
      const hash = crypto.createHash('md5').update(key).digest();
      for (let i = 0; i < EMBED_DIM; i++) {
        simEmbedding[i] += ((hash[i % hash.length] / 255) - 0.5) * magnitude * 0.05;
      }
    }
    const simNorm = normalizeVector(Array.from(simEmbedding));
    const drift = 1 - cosineSimilarity(Array.from(this.baseTwin.embedding), simNorm);
    const coherence = 1 / (1 + drift * PHI);
    const risk = drift * PHI;
    const gate = coherence >= CSL.HIGH ? 'SAFE' : coherence >= CSL.MED ? 'REVIEW' : 'BLOCK';
    return {
      scenario: scenario.name || 'unnamed',
      drift: parseFloat(drift.toFixed(6)),
      coherence: parseFloat(coherence.toFixed(4)),
      risk: parseFloat(risk.toFixed(4)),
      gate,
      perturbationCount: Object.keys(perturbations).length,
      embeddingDelta: parseFloat(Math.sqrt(Array.from(simEmbedding).reduce((s, v, i) =>
        s + Math.pow(v - this.baseTwin.embedding[i], 2), 0)).toFixed(6)),
    };
  }
}

// ── Main Service ──
class HeadyDigitalTwinService {
  constructor(config = {}) {
    this.serviceName = 'heady-digital-twin';
    this.port = config.port || 3345;
    this.log = createLogger(this.serviceName);
    this.app = express();
    this.app.use(express.json({ limit: '2mb' }));

    // Security headers
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      next();
    });
    this.twins = new Map();
    this.startTime = Date.now();
    this.requestCount = 0;
    this.server = null;
    this._setupRoutes();
  }

  _setupRoutes() {
    this.app.get('/health', (_req, res) => {
      const h = this.health();
      res.status(h.coherence >= CSL.MIN ? 200 : 503).json(h);
    });

    this.app.post('/twin', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      this.requestCount++;
      try {
        const { entityId, profile } = req.body;
        if (!entityId) return res.status(400).json({ error: 'entityId required' });
        const twin = new DigitalTwin(entityId, profile || {});
        this.twins.set(twin.id, twin);
        this.log('info', 'Digital twin created', { correlationId: cid, twinId: twin.id, entityId });
        res.json({ twinId: twin.id, entityId, entityType: twin.entityType, embeddingDim: EMBED_DIM });
      } catch (err) {
        this.log('error', 'Twin creation failed', { correlationId: cid, error: err.message });
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/twin/:id', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      this.requestCount++;
      const twin = this.twins.get(req.params.id);
      if (!twin) return res.status(404).json({ error: 'Twin not found' });
      this.log('info', 'Twin state retrieved', { correlationId: cid, twinId: twin.id });
      res.json(twin.snapshot());
    });

    this.app.post('/twin/:id/update', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      this.requestCount++;
      try {
        const twin = this.twins.get(req.params.id);
        if (!twin) return res.status(404).json({ error: 'Twin not found' });
        const { behaviors } = req.body;
        if (behaviors) {
          for (const [key, val] of Object.entries(behaviors)) twin.updateBehavior(key, val);
        }
        this.log('info', 'Twin updated', { correlationId: cid, twinId: twin.id, updates: Object.keys(behaviors || {}).length });
        res.json(twin.snapshot());
      } catch (err) {
        this.log('error', 'Twin update failed', { correlationId: cid, error: err.message });
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/simulate', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      this.requestCount++;
      try {
        const { twinId, scenario } = req.body;
        const twin = this.twins.get(twinId);
        if (!twin) return res.status(404).json({ error: 'Twin not found' });
        const sim = new TwinSimulator(twin);
        const result = sim.simulate(scenario || {});
        this.log('info', 'Simulation complete', { correlationId: cid, twinId, coherence: result.coherence, gate: result.gate });
        res.json(result);
      } catch (err) {
        this.log('error', 'Simulation failed', { correlationId: cid, error: err.message });
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/twin/:id/compare', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      this.requestCount++;
      try {
        const twinA = this.twins.get(req.params.id);
        const twinB = this.twins.get(req.body.otherId);
        if (!twinA || !twinB) return res.status(404).json({ error: 'One or both twins not found' });
        const sim = twinA.similarity(twinB);
        const gate = sim >= CSL.DEDUP ? 'DUPLICATE' : sim >= CSL.HIGH ? 'SIMILAR' : sim >= CSL.MED ? 'RELATED' : 'DISTINCT';
        this.log('info', 'Twin comparison', { correlationId: cid, similarity: sim, gate });
        res.json({ twinA: twinA.id, twinB: twinB.id, similarity: parseFloat(sim.toFixed(6)), gate, threshold: CSL });
      } catch (err) {
        this.log('error', 'Twin comparison failed', { correlationId: cid, error: err.message });
        res.status(500).json({ error: err.message });
      }
    });
  }

  health() {
    const uptimeMs = Date.now() - this.startTime;
    const twinCount = this.twins.size;
    const coherence = twinCount > 0 ? Math.min(CSL.HIGH, CSL.MED + twinCount * PSI * 0.01) : CSL.LOW;
    return {
      status: coherence >= CSL.MIN ? 'healthy' : 'degraded',
      coherence: parseFloat(coherence.toFixed(4)),
      uptime: uptimeMs,
      service: this.serviceName,
      twins: twinCount,
      requests: this.requestCount,
      phi: PHI,
    };
  }

  async init() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        this.log('info', `${this.serviceName} initialized`, { port: this.port, embeddingDim: EMBED_DIM, phi: PHI });
        resolve();
      });
    });
  }

  async execute(task) {
    const cid = crypto.randomUUID();
    this.log('info', 'Executing digital twin task', { correlationId: cid, task: task.type });
    if (task.type === 'create') {
      const twin = new DigitalTwin(task.entityId, task.profile || {});
      this.twins.set(twin.id, twin);
      return twin.snapshot();
    }
    if (task.type === 'simulate') {
      const twin = this.twins.get(task.twinId);
      if (!twin) return { error: 'Twin not found' };
      return new TwinSimulator(twin).simulate(task.scenario || {});
    }
    if (task.type === 'compare') {
      const a = this.twins.get(task.twinA);
      const b = this.twins.get(task.twinB);
      if (!a || !b) return { error: 'Twin not found' };
      return { similarity: a.similarity(b) };
    }
    return { error: 'Unknown task type' };
  }

  async shutdown() {
    this.log('info', 'Shutting down digital twin service');
    this.twins.clear();
    if (this.server) {
      return new Promise((resolve) => this.server.close(resolve));
    }
  }
}

module.exports = { HeadyDigitalTwinService, DigitalTwin, TwinSimulator, cosineSimilarity, CSL, PHI, PSI, FIB };
