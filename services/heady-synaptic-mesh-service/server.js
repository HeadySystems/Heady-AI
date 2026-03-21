'use strict';

/**
 * Heady™ Synaptic Mesh Service
 * Bio-inspired inter-service communication. Pathways strengthen with use
 * (Hebbian learning), weaken with disuse (pruning). Phi-scaled synapse
 * weights, CSL-gated activation.
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

// ── Synapse ──
class Synapse {
  constructor(source, target) {
    this.id = crypto.randomUUID();
    this.source = source;
    this.target = target;
    this.weight = PSI;
    this.lastFired = Date.now();
    this.fireCount = 0;
    this.createdAt = Date.now();
  }

  fire() {
    this.fireCount++;
    this.lastFired = Date.now();
    return this.weight;
  }

  timeSinceLastFire() {
    return (Date.now() - this.lastFired) / 1000;
  }

  toJSON() {
    return {
      id: this.id, source: this.source, target: this.target,
      weight: parseFloat(this.weight.toFixed(6)), fireCount: this.fireCount,
      lastFired: this.lastFired, createdAt: this.createdAt,
    };
  }
}

// ── Hebbian Learner ──
class HebbianLearner {
  strengthen(synapse, correlation) {
    const delta = PSI * Math.abs(correlation);
    synapse.weight = Math.min(synapse.weight + delta, PHI);
    return synapse.weight;
  }

  weaken(synapse) {
    const elapsed = synapse.timeSinceLastFire();
    const decay = Math.pow(PSI, elapsed / FIB[8]);
    synapse.weight *= decay;
    return synapse.weight;
  }
}

// ── Pruning Engine ──
class PruningEngine {
  prune(synapses) {
    const pruned = [];
    const surviving = [];
    for (const synapse of synapses) {
      if (synapse.weight < CSL.MIN) {
        pruned.push(synapse.id);
      } else {
        surviving.push(synapse);
      }
    }
    return { surviving, pruned };
  }
}

// ── Activation Gate ──
class ActivationGate {
  evaluate(weight) {
    if (weight >= CSL.CRIT) return { gate: 'CRITICAL', pass: true, strength: 'maximum' };
    if (weight >= CSL.HIGH) return { gate: 'HIGH', pass: true, strength: 'strong' };
    if (weight >= CSL.MED) return { gate: 'MEDIUM', pass: true, strength: 'moderate' };
    if (weight >= CSL.LOW) return { gate: 'LOW', pass: true, strength: 'weak' };
    if (weight >= CSL.MIN) return { gate: 'MINIMAL', pass: true, strength: 'marginal' };
    return { gate: 'BLOCKED', pass: false, strength: 'insufficient' };
  }
}

// ── Neural Pathfinder (weighted shortest path via Dijkstra) ──
class NeuralPathfinder {
  findPath(synapses, source, target) {
    const adj = new Map();
    for (const s of synapses) {
      if (!adj.has(s.source)) adj.set(s.source, []);
      adj.get(s.source).push({ node: s.target, cost: PHI - s.weight, synapse: s });
    }
    const dist = new Map();
    const prev = new Map();
    const visited = new Set();
    const queue = [{ node: source, cost: 0 }];
    dist.set(source, 0);
    while (queue.length > 0) {
      queue.sort((a, b) => a.cost - b.cost);
      const { node, cost } = queue.shift();
      if (visited.has(node)) continue;
      visited.add(node);
      if (node === target) break;
      for (const edge of (adj.get(node) || [])) {
        const newCost = cost + edge.cost;
        if (!dist.has(edge.node) || newCost < dist.get(edge.node)) {
          dist.set(edge.node, newCost);
          prev.set(edge.node, { node, synapse: edge.synapse });
          queue.push({ node: edge.node, cost: newCost });
        }
      }
    }
    if (!prev.has(target) && source !== target) return null;
    const path = [];
    let current = target;
    while (prev.has(current)) {
      const step = prev.get(current);
      path.unshift({ from: step.node, to: current, synapseId: step.synapse.id, weight: step.synapse.weight });
      current = step.node;
    }
    const totalWeight = path.reduce((sum, p) => sum + p.weight, 0);
    const avgWeight = path.length > 0 ? totalWeight / path.length : 0;
    return { source, target, hops: path.length, path, totalWeight, avgWeight: parseFloat(avgWeight.toFixed(6)) };
  }
}

// ── Plasticity Manager (phi-scaled annealing) ──
class PlasticityManager {
  constructor() {
    this.epoch = 0;
    this.baseLearningRate = PSI;
  }

  learningRate() {
    return this.baseLearningRate * Math.pow(PSI, this.epoch / FIB[9]);
  }

  advance() {
    this.epoch++;
    return this.learningRate();
  }
}

// ── Main Service ──
class HeadySynapticMeshService {
  constructor(config = {}) {
    this.serviceName = 'heady-synaptic-mesh';
    this.port = config.port || 3348;
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
    this.synapses = new Map();
    this.learner = new HebbianLearner();
    this.pruner = new PruningEngine();
    this.gate = new ActivationGate();
    this.pathfinder = new NeuralPathfinder();
    this.plasticity = new PlasticityManager();
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

    this.app.post('/connect', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      this.requestCount++;
      try {
        const { source, target } = req.body;
        if (!source || !target) return res.status(400).json({ error: 'source and target required' });
        const synapse = new Synapse(source, target);
        this.synapses.set(synapse.id, synapse);
        this.log('info', 'Synapse created', { correlationId: cid, synapseId: synapse.id, source, target });
        res.json(synapse.toJSON());
      } catch (err) {
        this.log('error', 'Connect failed', { correlationId: cid, error: err.message });
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/fire', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      this.requestCount++;
      try {
        const { synapseId, correlation } = req.body;
        const synapse = this.synapses.get(synapseId);
        if (!synapse) return res.status(404).json({ error: 'Synapse not found' });
        const activation = this.gate.evaluate(synapse.weight);
        if (!activation.pass) {
          this.log('warn', 'Activation blocked', { correlationId: cid, synapseId, weight: synapse.weight });
          return res.json({ fired: false, activation, synapse: synapse.toJSON() });
        }
        synapse.fire();
        const lr = this.plasticity.learningRate();
        const scaledCorrelation = (correlation || 1.0) * lr;
        this.learner.strengthen(synapse, scaledCorrelation);
        this.plasticity.advance();
        this.log('info', 'Synapse fired', { correlationId: cid, synapseId, weight: synapse.weight, fireCount: synapse.fireCount });
        res.json({ fired: true, activation, synapse: synapse.toJSON(), learningRate: lr });
      } catch (err) {
        this.log('error', 'Fire failed', { correlationId: cid, error: err.message });
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/mesh', (_req, res) => {
      const all = [...this.synapses.values()];
      all.forEach((s) => this.learner.weaken(s));
      const nodes = new Set();
      all.forEach((s) => { nodes.add(s.source); nodes.add(s.target); });
      res.json({ nodes: [...nodes], synapses: all.map((s) => s.toJSON()), total: all.length, epoch: this.plasticity.epoch });
    });

    this.app.post('/prune', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      this.requestCount++;
      try {
        const before = this.synapses.size;
        const all = [...this.synapses.values()];
        all.forEach((s) => this.learner.weaken(s));
        const { surviving, pruned } = this.pruner.prune(all);
        this.synapses.clear();
        surviving.forEach((s) => this.synapses.set(s.id, s));
        this.log('info', 'Pruning complete', { correlationId: cid, before, after: surviving.length, pruned: pruned.length });
        res.json({ before, after: surviving.length, pruned, threshold: CSL.MIN });
      } catch (err) {
        this.log('error', 'Prune failed', { correlationId: cid, error: err.message });
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/path/:source/:target', (req, res) => {
      this.requestCount++;
      const all = [...this.synapses.values()];
      const result = this.pathfinder.findPath(all, req.params.source, req.params.target);
      if (!result) return res.status(404).json({ error: 'No path found', source: req.params.source, target: req.params.target });
      res.json(result);
    });

    this.app.get('/synapse/:id', (req, res) => {
      const synapse = this.synapses.get(req.params.id);
      if (!synapse) return res.status(404).json({ error: 'Synapse not found' });
      const activation = this.gate.evaluate(synapse.weight);
      res.json({ ...synapse.toJSON(), activation });
    });
  }

  health() {
    const uptimeMs = Date.now() - this.startTime;
    const synapseCount = this.synapses.size;
    const avgWeight = synapseCount > 0
      ? [...this.synapses.values()].reduce((s, syn) => s + syn.weight, 0) / synapseCount
      : 0;
    const coherence = synapseCount > 0 ? Math.min(CSL.HIGH, CSL.MED + avgWeight * PSI * 0.1) : CSL.LOW;
    return {
      status: coherence >= CSL.MIN ? 'healthy' : 'degraded',
      coherence: parseFloat(coherence.toFixed(4)),
      uptime: uptimeMs,
      service: this.serviceName,
      synapses: synapseCount,
      requests: this.requestCount,
      phi: PHI,
    };
  }

  async init() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        this.log('info', `${this.serviceName} initialized`, { port: this.port, phi: PHI });
        resolve();
      });
    });
  }

  async execute(task) {
    const cid = crypto.randomUUID();
    this.log('info', 'Executing synaptic mesh task', { correlationId: cid, type: task.type });
    if (task.type === 'connect') {
      const synapse = new Synapse(task.source, task.target);
      this.synapses.set(synapse.id, synapse);
      return synapse.toJSON();
    }
    if (task.type === 'fire') {
      const synapse = this.synapses.get(task.synapseId);
      if (!synapse) return { error: 'Synapse not found' };
      synapse.fire();
      this.learner.strengthen(synapse, (task.correlation || 1.0) * this.plasticity.learningRate());
      this.plasticity.advance();
      return synapse.toJSON();
    }
    if (task.type === 'prune') {
      const all = [...this.synapses.values()];
      all.forEach((s) => this.learner.weaken(s));
      const { surviving, pruned } = this.pruner.prune(all);
      this.synapses.clear();
      surviving.forEach((s) => this.synapses.set(s.id, s));
      return { pruned: pruned.length, remaining: surviving.length };
    }
    if (task.type === 'path') {
      return this.pathfinder.findPath([...this.synapses.values()], task.source, task.target);
    }
    return { status: 'unknown task type', available: ['connect', 'fire', 'prune', 'path'] };
  }

  async shutdown() {
    this.log('info', 'Shutting down synaptic mesh service');
    this.synapses.clear();
    if (this.server) {
      return new Promise((resolve) => this.server.close(resolve));
    }
  }
}

module.exports = { HeadySynapticMeshService, Synapse, HebbianLearner, PruningEngine, ActivationGate, NeuralPathfinder, PlasticityManager, CSL, PHI, PSI, FIB };
