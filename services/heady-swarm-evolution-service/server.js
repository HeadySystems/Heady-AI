'use strict';

/**
 * Heady™ Swarm Evolution Service
 * Genetic algorithm optimization for agent configs, prompt strategies, routing tables.
 * Phi-scaled mutation rates, Fibonacci-sized populations, CSL fitness scoring.
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

// ── Genome ──
class Genome {
  constructor(size, genes = null) {
    this.id = crypto.randomUUID().slice(0, 8);
    this.genes = genes || Array.from({ length: size }, () => Math.random());
    this.fitness = 0;
    this.generation = 0;
  }

  clone() {
    const g = new Genome(this.genes.length, [...this.genes]);
    g.fitness = this.fitness;
    g.generation = this.generation;
    return g;
  }
}

// ── Fitness Evaluator (CSL-scored) ──
class FitnessEvaluator {
  constructor(objectiveFn = null) {
    this.objectiveFn = objectiveFn || FitnessEvaluator.defaultObjective;
  }

  static defaultObjective(genes) {
    const sum = genes.reduce((a, g) => a + g, 0);
    const mean = sum / genes.length;
    const variance = genes.reduce((a, g) => a + Math.pow(g - mean, 2), 0) / genes.length;
    const harmony = 1 / (1 + Math.abs(mean - PSI) * PHI);
    const stability = 1 / (1 + variance * PHI);
    return harmony * PSI + stability * (1 - PSI);
  }

  evaluate(genome) {
    const raw = this.objectiveFn(genome.genes);
    genome.fitness = Math.max(0, Math.min(1, raw));
    return genome.fitness;
  }

  cslGate(fitness) {
    if (fitness >= CSL.CRIT) return 'ELITE';
    if (fitness >= CSL.HIGH) return 'STRONG';
    if (fitness >= CSL.MED) return 'VIABLE';
    if (fitness >= CSL.LOW) return 'WEAK';
    return 'UNFIT';
  }
}

// ── Genetic Engine ──
class GeneticEngine {
  constructor(config = {}) {
    this.geneSize = config.geneSize || FIB[7];
    this.popSize = config.popSize || FIB[8];
    this.tournamentSize = FIB[5];
    this.eliteCount = FIB[4];
    this.mutationRate = 1 / PHI;
    this.mutationMagnitude = PSI;
    this.evaluator = new FitnessEvaluator(config.objectiveFn || null);
  }

  initPopulation() {
    return Array.from({ length: this.popSize }, () => new Genome(this.geneSize));
  }

  tournamentSelect(population) {
    const candidates = [];
    for (let i = 0; i < this.tournamentSize; i++) {
      candidates.push(population[Math.floor(Math.random() * population.length)]);
    }
    candidates.sort((a, b) => b.fitness - a.fitness);
    return candidates[0];
  }

  crossover(parentA, parentB) {
    const point = Math.floor(parentA.genes.length * PSI);
    const childGenes = [
      ...parentA.genes.slice(0, point),
      ...parentB.genes.slice(point),
    ];
    return new Genome(childGenes.length, childGenes);
  }

  mutate(genome) {
    const mutated = genome.clone();
    for (let i = 0; i < mutated.genes.length; i++) {
      if (Math.random() < this.mutationRate) {
        const delta = (Math.random() - 0.5) * 2 * this.mutationMagnitude;
        mutated.genes[i] = Math.max(0, Math.min(1, mutated.genes[i] + delta));
      }
    }
    return mutated;
  }

  evolveGeneration(population, generation) {
    for (const genome of population) this.evaluator.evaluate(genome);
    population.sort((a, b) => b.fitness - a.fitness);
    const next = [];
    for (let i = 0; i < this.eliteCount; i++) {
      const elite = population[i].clone();
      elite.generation = generation;
      next.push(elite);
    }
    while (next.length < this.popSize) {
      const parentA = this.tournamentSelect(population);
      const parentB = this.tournamentSelect(population);
      let child = this.crossover(parentA, parentB);
      child = this.mutate(child);
      child.generation = generation;
      this.evaluator.evaluate(child);
      next.push(child);
    }
    return next;
  }
}

// ── Generation Tracker ──
class GenerationTracker {
  constructor() {
    this.history = [];
    this.stagnationWindow = FIB[6];
  }

  record(generation, bestFitness, avgFitness) {
    this.history.push({ generation, bestFitness, avgFitness, timestamp: Date.now() });
  }

  hasConverged() {
    if (this.history.length < this.stagnationWindow) return false;
    const recent = this.history.slice(-this.stagnationWindow);
    const delta = Math.abs(recent[recent.length - 1].bestFitness - recent[0].bestFitness);
    return delta < (1 - CSL.DEDUP);
  }

  best() {
    if (this.history.length === 0) return null;
    return this.history.reduce((a, b) => (b.bestFitness > a.bestFitness ? b : a));
  }
}

// ── Main Service ──
class HeadySwarmEvolutionService {
  constructor(config = {}) {
    this.serviceName = 'heady-swarm-evolution';
    this.port = config.port || 3347;
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
    this.evolutions = new Map();
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

    this.app.post('/evolve', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      this.requestCount++;
      try {
        const { geneSize, popSize, maxGenerations } = req.body;
        const id = `evo_${crypto.randomUUID().slice(0, 8)}`;
        const engine = new GeneticEngine({ geneSize: geneSize || FIB[7], popSize: popSize || FIB[8] });
        const population = engine.initPopulation();
        for (const g of population) engine.evaluator.evaluate(g);
        const tracker = new GenerationTracker();
        const best = population.reduce((a, b) => (b.fitness > a.fitness ? b : a));
        const avg = population.reduce((s, g) => s + g.fitness, 0) / population.length;
        tracker.record(0, best.fitness, avg);
        this.evolutions.set(id, { id, engine, population, tracker, generation: 0, maxGenerations: maxGenerations || FIB[10], status: 'active' });
        this.log('info', 'Evolution run started', { correlationId: cid, evolutionId: id, popSize: engine.popSize });
        res.json({ evolutionId: id, generation: 0, popSize: engine.popSize, bestFitness: best.fitness });
      } catch (err) {
        this.log('error', 'Evolution start failed', { correlationId: cid, error: err.message });
        res.status(400).json({ error: err.message });
      }
    });

    this.app.get('/evolution/:id', (req, res) => {
      const evo = this.evolutions.get(req.params.id);
      if (!evo) return res.status(404).json({ error: 'Evolution not found' });
      const best = evo.population.reduce((a, b) => (b.fitness > a.fitness ? b : a));
      res.json({ evolutionId: evo.id, generation: evo.generation, status: evo.status, bestFitness: best.fitness, converged: evo.tracker.hasConverged(), history: evo.tracker.history.slice(-FIB[6]) });
    });

    this.app.post('/evolution/:id/step', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      this.requestCount++;
      const evo = this.evolutions.get(req.params.id);
      if (!evo) return res.status(404).json({ error: 'Evolution not found' });
      if (evo.status !== 'active') return res.status(400).json({ error: `Evolution is ${evo.status}` });
      evo.generation++;
      evo.population = evo.engine.evolveGeneration(evo.population, evo.generation);
      const best = evo.population.reduce((a, b) => (b.fitness > a.fitness ? b : a));
      const avg = evo.population.reduce((s, g) => s + g.fitness, 0) / evo.population.length;
      evo.tracker.record(evo.generation, best.fitness, avg);
      if (evo.tracker.hasConverged() || evo.generation >= evo.maxGenerations) evo.status = 'converged';
      this.log('info', 'Generation advanced', { correlationId: cid, evolutionId: evo.id, generation: evo.generation, bestFitness: best.fitness });
      res.json({ evolutionId: evo.id, generation: evo.generation, status: evo.status, bestFitness: best.fitness, avgFitness: avg, gate: evo.engine.evaluator.cslGate(best.fitness) });
    });

    this.app.get('/evolution/:id/best', (req, res) => {
      const evo = this.evolutions.get(req.params.id);
      if (!evo) return res.status(404).json({ error: 'Evolution not found' });
      const best = evo.population.reduce((a, b) => (b.fitness > a.fitness ? b : a));
      res.json({ evolutionId: evo.id, genome: { id: best.id, genes: best.genes, fitness: best.fitness, generation: best.generation }, gate: evo.engine.evaluator.cslGate(best.fitness) });
    });

    this.app.post('/evaluate', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      this.requestCount++;
      try {
        const { genes } = req.body;
        if (!Array.isArray(genes)) return res.status(400).json({ error: 'genes[] required' });
        const genome = new Genome(genes.length, genes);
        const evaluator = new FitnessEvaluator();
        evaluator.evaluate(genome);
        this.log('info', 'Genome evaluated', { correlationId: cid, fitness: genome.fitness });
        res.json({ fitness: genome.fitness, gate: evaluator.cslGate(genome.fitness), genes: genome.genes });
      } catch (err) {
        this.log('error', 'Evaluation failed', { correlationId: cid, error: err.message });
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/evolutions', (_req, res) => {
      const list = [...this.evolutions.values()].map((evo) => {
        const best = evo.population.reduce((a, b) => (b.fitness > a.fitness ? b : a));
        return { evolutionId: evo.id, generation: evo.generation, status: evo.status, bestFitness: best.fitness, popSize: evo.engine.popSize };
      });
      res.json({ evolutions: list, count: list.length });
    });
  }

  health() {
    const uptimeMs = Date.now() - this.startTime;
    const evoCount = this.evolutions.size;
    const coherence = evoCount > 0 ? Math.min(CSL.HIGH, CSL.MED + evoCount * PSI * 0.01) : CSL.LOW;
    return {
      status: coherence >= CSL.MIN ? 'healthy' : 'degraded',
      coherence: parseFloat(coherence.toFixed(4)),
      uptime: uptimeMs,
      service: this.serviceName,
      evolutions: evoCount,
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
    this.log('info', 'Executing evolution task', { correlationId: cid, type: task.type });
    const engine = new GeneticEngine({ geneSize: task.geneSize || FIB[7], popSize: task.popSize || FIB[8] });
    let population = engine.initPopulation();
    const tracker = new GenerationTracker();
    const maxGen = task.maxGenerations || FIB[8];
    for (let gen = 0; gen < maxGen; gen++) {
      population = engine.evolveGeneration(population, gen);
      const best = population.reduce((a, b) => (b.fitness > a.fitness ? b : a));
      const avg = population.reduce((s, g) => s + g.fitness, 0) / population.length;
      tracker.record(gen, best.fitness, avg);
      if (tracker.hasConverged()) break;
    }
    const best = population.reduce((a, b) => (b.fitness > a.fitness ? b : a));
    return { genome: best.genes, fitness: best.fitness, generations: tracker.history.length, gate: engine.evaluator.cslGate(best.fitness) };
  }

  async shutdown() {
    this.log('info', 'Shutting down swarm evolution service');
    this.evolutions.clear();
    if (this.server) {
      return new Promise((resolve) => this.server.close(resolve));
    }
  }
}

module.exports = { HeadySwarmEvolutionService, Genome, GeneticEngine, FitnessEvaluator, GenerationTracker, CSL, PHI, PSI, FIB };
