'use strict';

/**
 * heady_swarm_evolve — Trigger genetic algorithm evolution on agent configurations.
 * Phi-scaled mutation, tournament selection, crossover on 384D embeddings.
 * JSON-RPC 2.0 MCP Tool
 */

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };
const EMBEDDING_DIM = 384;

function correlationId() {
  return `evolve-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function classifyError(code) {
  if (code >= 6000 && code < 6500) return 'EVOLUTION_INPUT_ERROR';
  if (code >= 6500 && code < 7000) return 'EVOLUTION_EXECUTION_ERROR';
  return 'UNKNOWN_ERROR';
}

function randomGenome() {
  const genome = new Float32Array(EMBEDDING_DIM);
  for (let i = 0; i < EMBEDDING_DIM; i++) genome[i] = (Math.random() - PSI) * PHI;
  return normalize(genome);
}

function normalize(vec) {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (norm > 0) for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  return vec;
}

function fitness(genome, targetTraits) {
  let score = 0;
  for (const [trait, target] of Object.entries(targetTraits)) {
    const idx = hashSimple(trait) % EMBEDDING_DIM;
    const diff = Math.abs(genome[idx] - target);
    score += (1 - diff) * PSI;
  }
  const diversity = new Set(Array.from(genome).map(v => Math.round(v * FIB[5]))).size / EMBEDDING_DIM;
  score += diversity * PHI * PSI;
  return Number((score / (Object.keys(targetTraits).length + 1)).toFixed(6));
}

function hashSimple(str) {
  let h = FIB[7];
  for (let i = 0; i < str.length; i++) h = ((h << FIB[3]) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function tournamentSelect(population, fitnesses, tournamentSize) {
  const indices = [];
  for (let i = 0; i < tournamentSize; i++) indices.push(Math.floor(Math.random() * population.length));
  indices.sort((a, b) => fitnesses[b] - fitnesses[a]);
  return population[indices[0]];
}

function crossover(parentA, parentB) {
  const child = new Float32Array(EMBEDDING_DIM);
  const crossPoint = FIB[hashSimple(`${Date.now()}`) % 8 + 3] % EMBEDDING_DIM || Math.floor(EMBEDDING_DIM * PSI);
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    child[i] = i < crossPoint ? parentA[i] : parentB[i];
  }
  return normalize(child);
}

function mutate(genome, mutationRate, generation) {
  const mutated = new Float32Array(genome);
  const phiDecay = Math.pow(PSI, generation / FIB[5]);
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    if (Math.random() < mutationRate * phiDecay) {
      mutated[i] += (Math.random() - PSI) * PHI * phiDecay;
    }
  }
  return normalize(mutated);
}

function genomeFingerprint(genome) {
  let fp = 0;
  for (let i = 0; i < Math.min(FIB[5], EMBEDDING_DIM); i++) fp += genome[i] * FIB[(i % (FIB.length - 1)) + 1];
  return Number(fp.toFixed(8));
}

const name = 'heady_swarm_evolve';

const description = 'Trigger genetic algorithm evolution on agent configurations. Phi-scaled mutation, tournament selection, and crossover operators on 384D embedding representations.';

const inputSchema = {
  type: 'object',
  properties: {
    population_size: { type: 'number', description: 'Population size (default: Fib(6)=8)' },
    generations: { type: 'number', description: 'Number of generations (default: Fib(5)=5)' },
    mutation_rate: { type: 'number', description: 'Base mutation rate (default: PSI*PSI≈0.382)' },
    tournament_size: { type: 'number', description: 'Tournament selection size (default: Fib(4)=3)' },
    target_traits: { type: 'object', description: 'Target trait key-value map to optimize toward' },
    elite_count: { type: 'number', description: 'Number of elite individuals preserved (default: Fib(3)=2)' },
    seed_genomes: { type: 'array', items: { type: 'object' }, description: 'Optional seed genome configurations' },
  },
  required: ['target_traits'],
};

async function handler(params) {
  const cid = correlationId();
  const ts = new Date().toISOString();

  try {
    if (!params.target_traits || typeof params.target_traits !== 'object') throw { code: 6001, message: 'target_traits must be a non-empty object' };

    const popSize = params.population_size || FIB[6];
    const generations = params.generations || FIB[5];
    const mutationRate = params.mutation_rate || PSI * PSI;
    const tournamentSize = params.tournament_size || FIB[4];
    const eliteCount = params.elite_count || FIB[3];

    if (popSize < FIB[4] || popSize > FIB[9]) throw { code: 6002, message: `population_size must be ${FIB[4]}-${FIB[9]}` };
    if (generations < 1 || generations > FIB[7]) throw { code: 6003, message: `generations must be 1-${FIB[7]}` };

    let population = Array.from({ length: popSize }, () => randomGenome());
    const generationLog = [];

    for (let gen = 0; gen < generations; gen++) {
      const fitnesses = population.map(g => fitness(g, params.target_traits));
      const indexed = fitnesses.map((f, i) => ({ fitness: f, index: i })).sort((a, b) => b.fitness - a.fitness);
      const bestFitness = indexed[0].fitness;
      const avgFitness = Number((fitnesses.reduce((s, f) => s + f, 0) / popSize).toFixed(6));
      const worstFitness = indexed[indexed.length - 1].fitness;

      generationLog.push({
        generation: gen,
        best_fitness: bestFitness,
        avg_fitness: avgFitness,
        worst_fitness: worstFitness,
        diversity: Number((new Set(fitnesses.map(f => Math.round(f * FIB[8]))).size / popSize).toFixed(6)),
        phi_convergence: Number((bestFitness / (avgFitness || 1) * PSI).toFixed(6)),
      });

      const newPop = [];
      for (let e = 0; e < Math.min(eliteCount, popSize); e++) newPop.push(population[indexed[e].index]);

      while (newPop.length < popSize) {
        const parentA = tournamentSelect(population, fitnesses, tournamentSize);
        const parentB = tournamentSelect(population, fitnesses, tournamentSize);
        let child = crossover(parentA, parentB);
        child = mutate(child, mutationRate, gen);
        newPop.push(child);
      }
      population = newPop;
    }

    const finalFitnesses = population.map(g => fitness(g, params.target_traits));
    const ranked = finalFitnesses.map((f, i) => ({ index: i, fitness: f, fingerprint: genomeFingerprint(population[i]) })).sort((a, b) => b.fitness - a.fitness);
    const champion = ranked[0];
    const cslConf = champion.fitness >= CSL.HIGH ? CSL.CRITICAL : champion.fitness >= CSL.MEDIUM ? CSL.HIGH : CSL.MEDIUM;

    return {
      jsonrpc: '2.0',
      result: {
        champion: { fitness: champion.fitness, fingerprint: champion.fingerprint, genome_dim: EMBEDDING_DIM },
        top_performers: ranked.slice(0, FIB[4]).map(r => ({ fitness: r.fitness, fingerprint: r.fingerprint })),
        generation_log: generationLog,
        config: { population_size: popSize, generations, mutation_rate: mutationRate, tournament_size: tournamentSize, elite_count: eliteCount },
        evolution_metrics: { total_evaluations: popSize * generations, final_diversity: generationLog[generationLog.length - 1]?.diversity || 0, convergence_gen: generationLog.findIndex(g => g.best_fitness >= CSL.HIGH) },
        csl_confidence: cslConf,
        phi_coherence: Number((champion.fitness * PHI * PSI).toFixed(6)),
        correlation_id: cid,
        timestamp: ts,
      },
    };
  } catch (err) {
    const code = err.code || 6999;
    return { jsonrpc: '2.0', error: { code, message: err.message || 'Evolution failed', classification: classifyError(code), correlation_id: cid, timestamp: ts } };
  }
}

function health() {
  return { status: 'healthy', embedding_dim: EMBEDDING_DIM, phi: PHI, mutation_base: PSI * PSI, fib_sequence_len: FIB.length, timestamp: new Date().toISOString() };
}

module.exports = { name, description, inputSchema, handler, health };
