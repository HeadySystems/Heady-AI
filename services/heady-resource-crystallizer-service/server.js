'use strict';

/**
 * Heady™ Resource Crystallizer Service
 * Dynamic resource allocation using phi-harmonic resonance.
 * Monitors demand signals, predicts needs, allocates via Fibonacci-tiered
 * priority queues with CSL-gated fairness.
 */

const crypto = require('crypto');
const express = require('express');

// ── Phi-Math Constants ──
const PHI = 1.618033988749895;
const PSI = 0.6180339887498949;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// ── CSL Gate Thresholds ──
const CSL = { MIN: 0.500, LOW: 0.691, MED: 0.809, HIGH: 0.882, CRIT: 0.927, DEDUP: 0.972 };

// ── Tier Capacity Ratios (Fibonacci-derived, sum ~81% leaving headroom) ──
const TIERS = { Hot: 0.34, Warm: 0.21, Cold: 0.13, Reserve: 0.08, Governance: 0.05 };

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

// ── Phi-Harmonic Resonance Detector ──
class PhiHarmonicResonance {
  constructor(windowSize = FIB[8]) {
    this.windowSize = windowSize;
    this.samples = [];
  }

  record(value) {
    this.samples.push({ value, ts: Date.now() });
    if (this.samples.length > this.windowSize) this.samples.shift();
  }

  detect() {
    if (this.samples.length < FIB[5]) return { harmonic: false, strength: 0, period: 0 };
    const vals = this.samples.map((s) => s.value);
    let bestStrength = 0;
    let bestPeriod = 0;
    for (let p = 2; p <= Math.min(vals.length / 2, FIB[7]); p++) {
      let correlation = 0;
      let pairs = 0;
      for (let i = p; i < vals.length; i++) {
        correlation += vals[i] * vals[i - p];
        pairs++;
      }
      const strength = pairs > 0 ? correlation / (pairs * (Math.max(...vals) || 1)) : 0;
      const phiRatio = p / PHI;
      const harmonicBonus = Math.abs(phiRatio - Math.round(phiRatio)) < PSI * 0.3 ? PHI * 0.1 : 0;
      const adjusted = strength + harmonicBonus;
      if (adjusted > bestStrength) { bestStrength = adjusted; bestPeriod = p; }
    }
    return { harmonic: bestStrength >= CSL.MIN, strength: Math.min(1, bestStrength), period: bestPeriod };
  }
}

// ── Fibonacci-Heap Priority Queue ──
class PriorityQueue {
  constructor() { this.heap = []; }

  _parent(i) { return Math.floor((i - 1) / 2); }
  _left(i) { return 2 * i + 1; }
  _right(i) { return 2 * i + 2; }

  insert(item, priority) {
    this.heap.push({ item, priority });
    let i = this.heap.length - 1;
    while (i > 0 && this.heap[this._parent(i)].priority < this.heap[i].priority) {
      [this.heap[i], this.heap[this._parent(i)]] = [this.heap[this._parent(i)], this.heap[i]];
      i = this._parent(i);
    }
  }

  extractMax() {
    if (this.heap.length === 0) return null;
    const max = this.heap[0];
    this.heap[0] = this.heap[this.heap.length - 1];
    this.heap.pop();
    this._siftDown(0);
    return max;
  }

  _siftDown(i) {
    let largest = i;
    const l = this._left(i);
    const r = this._right(i);
    if (l < this.heap.length && this.heap[l].priority > this.heap[largest].priority) largest = l;
    if (r < this.heap.length && this.heap[r].priority > this.heap[largest].priority) largest = r;
    if (largest !== i) {
      [this.heap[i], this.heap[largest]] = [this.heap[largest], this.heap[i]];
      this._siftDown(largest);
    }
  }

  get size() { return this.heap.length; }
}

// ── Demand Signal Monitor ──
class DemandSignalMonitor {
  constructor() {
    this.signals = [];
    this.smoothedRate = 0;
    this.alpha = PSI; // phi-scaled smoothing factor
  }

  record(signal) {
    const ts = Date.now();
    this.signals.push({ ...signal, ts });
    if (this.signals.length > FIB[12]) this.signals = this.signals.slice(-FIB[11]);
    const recent = this.signals.filter((s) => s.ts > ts - 60000).length;
    this.smoothedRate = this.alpha * recent + (1 - this.alpha) * this.smoothedRate;
    return { rate: this.smoothedRate, total: this.signals.length };
  }

  forecast(horizonMs = 60000) {
    const now = Date.now();
    const bucketMs = 10000;
    const buckets = [];
    for (let t = now - horizonMs * 3; t < now; t += bucketMs) {
      buckets.push(this.signals.filter((s) => s.ts >= t && s.ts < t + bucketMs).length);
    }
    if (buckets.length < 3) return { predicted: this.smoothedRate, confidence: CSL.MIN };
    const trend = (buckets[buckets.length - 1] - buckets[0]) / (buckets.length || 1);
    const predicted = Math.max(0, this.smoothedRate + trend * PHI * (horizonMs / bucketMs));
    const variance = buckets.reduce((s, b) => s + Math.pow(b - this.smoothedRate, 2), 0) / buckets.length;
    const confidence = 1 / (1 + Math.sqrt(variance) * PSI);
    return { predicted: parseFloat(predicted.toFixed(3)), confidence: parseFloat(confidence.toFixed(4)), trend };
  }
}

// ── Resource Pool with Fibonacci-Tiered Capacity ──
class ResourcePool {
  constructor(totalCapacity = FIB[12]) {
    this.totalCapacity = totalCapacity;
    this.tiers = {};
    for (const [name, ratio] of Object.entries(TIERS)) {
      this.tiers[name] = { capacity: Math.floor(totalCapacity * ratio), allocated: 0, items: new Map() };
    }
  }

  allocate(id, tier, amount, coherence) {
    const t = this.tiers[tier];
    if (!t) return { success: false, reason: 'invalid_tier' };
    if (coherence < CSL.MIN) return { success: false, reason: 'csl_gate_failed', coherence, required: CSL.MIN };
    if (t.allocated + amount > t.capacity) return { success: false, reason: 'capacity_exceeded', available: t.capacity - t.allocated };
    t.allocated += amount;
    t.items.set(id, { amount, coherence, ts: Date.now() });
    return { success: true, id, tier, amount, remaining: t.capacity - t.allocated };
  }

  release(id) {
    for (const [name, t] of Object.entries(this.tiers)) {
      if (t.items.has(id)) {
        const item = t.items.get(id);
        t.allocated -= item.amount;
        t.items.delete(id);
        return { success: true, id, tier: name, released: item.amount };
      }
    }
    return { success: false, reason: 'allocation_not_found' };
  }

  state() {
    const tierStates = {};
    for (const [name, t] of Object.entries(this.tiers)) {
      tierStates[name] = {
        capacity: t.capacity,
        allocated: t.allocated,
        utilization: parseFloat((t.allocated / (t.capacity || 1)).toFixed(4)),
        items: t.items.size,
      };
    }
    const totalAlloc = Object.values(this.tiers).reduce((s, t) => s + t.allocated, 0);
    return { totalCapacity: this.totalCapacity, totalAllocated: totalAlloc, tiers: tierStates };
  }

  rebalance() {
    const moves = [];
    const tierNames = Object.keys(this.tiers);
    for (let i = 0; i < tierNames.length - 1; i++) {
      const src = this.tiers[tierNames[i]];
      const dst = this.tiers[tierNames[i + 1]];
      if (src.allocated / (src.capacity || 1) > CSL.CRIT && dst.allocated / (dst.capacity || 1) < CSL.MED) {
        const overflow = src.allocated - Math.floor(src.capacity * CSL.HIGH);
        if (overflow > 0 && dst.allocated + overflow <= dst.capacity) {
          src.allocated -= overflow;
          dst.allocated += overflow;
          moves.push({ from: tierNames[i], to: tierNames[i + 1], amount: overflow });
        }
      }
    }
    return { moves, pool: this.state() };
  }
}

// ── Allocation Engine (CSL-gated fairness scoring) ──
class AllocationEngine {
  constructor(pool) {
    this.pool = pool;
    this.queue = new PriorityQueue();
  }

  score(request) {
    const base = request.urgency || 0.5;
    const coherenceBoost = (request.coherence || CSL.MIN) * PHI * 0.3;
    const fibTier = FIB[Math.min(request.tierIndex || 3, FIB.length - 1)];
    const tierWeight = fibTier / FIB[10] * PSI;
    return parseFloat((base + coherenceBoost + tierWeight).toFixed(4));
  }

  enqueue(request) {
    const priority = this.score(request);
    if (priority * PSI < CSL.MIN) return { queued: false, reason: 'below_fairness_threshold' };
    this.queue.insert(request, priority);
    return { queued: true, priority, queueSize: this.queue.size };
  }

  processNext() {
    const entry = this.queue.extractMax();
    if (!entry) return { processed: false, reason: 'queue_empty' };
    const tierNames = Object.keys(TIERS);
    const tier = tierNames[Math.min(entry.item.tierIndex || 0, tierNames.length - 1)];
    return this.pool.allocate(entry.item.id || crypto.randomUUID(), tier, entry.item.amount || 1, entry.item.coherence || CSL.MED);
  }
}

// ── Main Service ──
class HeadyResourceCrystallizerService {
  constructor(config = {}) {
    this.serviceName = 'heady-resource-crystallizer';
    this.port = config.port || 3350;
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
    this.pool = new ResourcePool(config.capacity || FIB[12]);
    this.engine = new AllocationEngine(this.pool);
    this.monitor = new DemandSignalMonitor();
    this.resonance = new PhiHarmonicResonance();
    this.startTime = Date.now();
    this.server = null;
    this._setupRoutes();
  }

  _setupRoutes() {
    this.app.get('/health', (_req, res) => {
      const h = this.health();
      res.status(h.coherence >= CSL.MIN ? 200 : 503).json(h);
    });

    this.app.post('/allocate', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      try {
        const request = { ...req.body, id: req.body.id || crypto.randomUUID(), coherence: req.body.coherence || CSL.MED };
        const enqueueResult = this.engine.enqueue(request);
        if (!enqueueResult.queued) return res.status(422).json({ ...enqueueResult, correlationId: cid });
        const result = this.engine.processNext();
        this.resonance.record(request.amount || 1);
        this.log('info', 'Resource allocated', { correlationId: cid, ...result });
        res.json({ ...result, correlationId: cid });
      } catch (err) {
        this.log('error', 'Allocation failed', { correlationId: cid, error: err.message });
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/release', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      try {
        const result = this.pool.release(req.body.id);
        this.log('info', 'Resource released', { correlationId: cid, ...result });
        res.status(result.success ? 200 : 404).json({ ...result, correlationId: cid });
      } catch (err) {
        this.log('error', 'Release failed', { correlationId: cid, error: err.message });
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/pool', (_req, res) => {
      res.json({ ...this.pool.state(), resonance: this.resonance.detect() });
    });

    this.app.post('/demand', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      const stat = this.monitor.record(req.body);
      this.resonance.record(req.body.intensity || 1);
      this.log('info', 'Demand signal recorded', { correlationId: cid, rate: stat.rate });
      res.json({ ...stat, correlationId: cid });
    });

    this.app.get('/forecast', (_req, res) => {
      const horizon = parseInt(_req.query.horizon, 10) || 60000;
      res.json({ ...this.monitor.forecast(horizon), resonance: this.resonance.detect() });
    });

    this.app.post('/rebalance', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      const result = this.pool.rebalance();
      this.log('info', 'Pool rebalanced', { correlationId: cid, moves: result.moves.length });
      res.json({ ...result, correlationId: cid });
    });
  }

  health() {
    const uptimeMs = Date.now() - this.startTime;
    const poolState = this.pool.state();
    const utilization = poolState.totalAllocated / (poolState.totalCapacity || 1);
    const coherence = parseFloat(Math.min(CSL.CRIT, CSL.MED + (1 - utilization) * PSI * 0.2).toFixed(4));
    return { status: coherence >= CSL.MIN ? 'healthy' : 'degraded', coherence, uptime: uptimeMs, service: this.serviceName };
  }

  async init() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        this.log('info', `${this.serviceName} initialized`, { port: this.port, phi: PHI, tiers: Object.keys(TIERS) });
        resolve();
      });
    });
  }

  async execute(task) {
    const cid = crypto.randomUUID();
    this.log('info', 'Executing crystallizer task', { correlationId: cid, type: task.type });
    if (task.type === 'allocate') return this.pool.allocate(task.id || cid, task.tier || 'Hot', task.amount || 1, task.coherence || CSL.MED);
    if (task.type === 'release') return this.pool.release(task.id);
    if (task.type === 'forecast') return this.monitor.forecast(task.horizon || 60000);
    if (task.type === 'rebalance') return this.pool.rebalance();
    return { pool: this.pool.state(), resonance: this.resonance.detect() };
  }

  async shutdown() {
    this.log('info', 'Shutting down resource crystallizer service');
    if (this.server) return new Promise((resolve) => this.server.close(resolve));
  }
}

module.exports = { HeadyResourceCrystallizerService, ResourcePool, AllocationEngine, DemandSignalMonitor, PhiHarmonicResonance, PriorityQueue, CSL, PHI, PSI, FIB };
