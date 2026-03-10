/**
 * HeadyEvolutionEngine — Self-Improving Code Mutation & Selection
 *
 * Applies evolutionary computation to system optimization:
 * - Generates variant configurations/implementations (mutations)
 * - Evaluates fitness via CSL cosine scoring against target embeddings
 * - Selects winners using tournament selection with phi-scaled population sizing
 * - Persists winning patterns into HeadyPatterns for future use
 *
 * Population sizes, mutation rates, and selection pressure all derive from phi-math.
 *
 * © 2026 HeadySystems Inc. — Sacred Geometry v4.0
 * @module engines/evolution-engine
 */

const { PHI, PSI, fib, CSL_THRESHOLDS, phiFusionWeights, cosineSimilarity, cslGate } = require('../shared/phi-math');
const { createLogger } = require('../shared/logger');

const logger = createLogger('EvolutionEngine');

/** Evolutionary configuration — all phi-derived */
const EVO_CONFIG = Object.freeze({
  populationSize:    fib(8),          // 21 candidates per generation
  maxGenerations:    fib(7),          // 13 generations max
  mutationRate:      PSI * PSI,       // ≈ 0.382 — chance of mutation per gene
  crossoverRate:     PSI,             // ≈ 0.618 — chance of crossover
  tournamentSize:    fib(4),          // 3 candidates per tournament
  eliteCount:        fib(3),          // 2 best always survive
  fitnessThreshold:  CSL_THRESHOLDS.HIGH,  // ≈ 0.882 — stop if achieved
  diversityFloor:    CSL_THRESHOLDS.MINIMUM, // ≈ 0.500 — maintain diversity
  stagnationLimit:   fib(5),          // 5 generations without improvement
});

/**
 * @typedef {Object} Individual
 * @property {string} id - Unique identifier
 * @property {Object} genome - Configuration/parameter set
 * @property {number[]} embedding - 384D fitness embedding
 * @property {number} fitness - CSL-scored fitness (0-1)
 * @property {number} generation - Generation born
 */

class EvolutionEngine {
  /**
   * @param {Object} config
   * @param {number[]} config.targetEmbedding - 384D target to evolve toward
   * @param {Function} config.embedFn - async (genome) => number[] — embed a genome
   * @param {Function} config.evaluateFn - async (genome) => Object — evaluate real fitness
   * @param {Object} [config.overrides] - Override EVO_CONFIG values
   */
  constructor(config) {
    this.target = config.targetEmbedding;
    this.embedFn = config.embedFn;
    this.evaluateFn = config.evaluateFn;
    this.config = { ...EVO_CONFIG, ...config.overrides };
    this.population = [];
    this.generation = 0;
    this.bestEver = null;
    this.stagnationCount = 0;
    this.history = [];
  }

  /**
   * Initialize population with random genomes.
   * @param {Function} genomeFactory - () => Object — creates a random genome
   * @returns {Promise<void>}
   */
  async initialize(genomeFactory) {
    logger.info({ populationSize: this.config.populationSize }, 'Initializing population');
    this.population = [];

    for (let i = 0; i < this.config.populationSize; i++) {
      const genome = genomeFactory();
      const embedding = await this.embedFn(genome);
      const fitness = this._scoreFitness(embedding);
      this.population.push({
        id: `gen0-${i}`,
        genome,
        embedding,
        fitness,
        generation: 0,
      });
    }

    this._sortByFitness();
    this.bestEver = { ...this.population[0] };
    logger.info({ bestFitness: this.bestEver.fitness }, 'Population initialized');
  }

  /**
   * Run the full evolutionary loop.
   * @returns {Promise<Individual>} Best individual found
   */
  async evolve() {
    logger.info({ maxGenerations: this.config.maxGenerations }, 'Evolution started');

    for (let gen = 1; gen <= this.config.maxGenerations; gen++) {
      this.generation = gen;

      // Create next generation
      const nextGen = [];

      // Elitism — top N survive unchanged
      for (let i = 0; i < this.config.eliteCount; i++) {
        nextGen.push({ ...this.population[i], generation: gen });
      }

      // Fill remaining slots via tournament selection + crossover + mutation
      while (nextGen.length < this.config.populationSize) {
        const parent1 = this._tournamentSelect();
        const parent2 = this._tournamentSelect();

        let childGenome;
        if (Math.random() < this.config.crossoverRate) {
          childGenome = this._crossover(parent1.genome, parent2.genome);
        } else {
          childGenome = { ...parent1.genome };
        }

        if (Math.random() < this.config.mutationRate) {
          childGenome = this._mutate(childGenome);
        }

        const embedding = await this.embedFn(childGenome);
        const fitness = this._scoreFitness(embedding);

        nextGen.push({
          id: `gen${gen}-${nextGen.length}`,
          genome: childGenome,
          embedding,
          fitness,
          generation: gen,
        });
      }

      this.population = nextGen;
      this._sortByFitness();

      // Track best
      const genBest = this.population[0];
      const improved = genBest.fitness > this.bestEver.fitness;

      if (improved) {
        this.bestEver = { ...genBest };
        this.stagnationCount = 0;
      } else {
        this.stagnationCount++;
      }

      // Diversity check
      const diversity = this._measureDiversity();

      this.history.push({
        generation: gen,
        bestFitness: genBest.fitness,
        avgFitness: this.population.reduce((s, i) => s + i.fitness, 0) / this.population.length,
        diversity,
        improved,
      });

      logger.info({
        generation: gen,
        best: genBest.fitness.toFixed(4),
        avg: this.history[this.history.length - 1].avgFitness.toFixed(4),
        diversity: diversity.toFixed(4),
        stagnation: this.stagnationCount,
      }, 'Generation complete');

      // Early stopping conditions
      if (genBest.fitness >= this.config.fitnessThreshold) {
        logger.info({ fitness: genBest.fitness }, 'Fitness threshold reached');
        break;
      }

      if (this.stagnationCount >= this.config.stagnationLimit) {
        logger.warn({}, 'Stagnation limit reached — injecting diversity');
        await this._injectDiversity();
        this.stagnationCount = 0;
      }
    }

    // Final evaluation of best via real evaluator
    if (this.evaluateFn) {
      const evalResult = await this.evaluateFn(this.bestEver.genome);
      this.bestEver.evaluation = evalResult;
    }

    logger.info({
      generations: this.generation,
      bestFitness: this.bestEver.fitness,
    }, 'Evolution complete');

    return this.bestEver;
  }

  /**
   * CSL-gated fitness scoring against target embedding.
   * @param {number[]} embedding
   * @returns {number} Fitness score (0-1)
   */
  _scoreFitness(embedding) {
    const similarity = cosineSimilarity(embedding, this.target);
    return cslGate(1.0, similarity, CSL_THRESHOLDS.MINIMUM);
  }

  /**
   * Tournament selection — pick tournamentSize random individuals, return best.
   * @returns {Individual}
   */
  _tournamentSelect() {
    let best = null;
    for (let i = 0; i < this.config.tournamentSize; i++) {
      const idx = Math.floor(Math.random() * this.population.length);
      const candidate = this.population[idx];
      if (!best || candidate.fitness > best.fitness) best = candidate;
    }
    return best;
  }

  /**
   * Uniform crossover between two genomes.
   * @param {Object} g1
   * @param {Object} g2
   * @returns {Object} Child genome
   */
  _crossover(g1, g2) {
    const child = {};
    const keys = new Set([...Object.keys(g1), ...Object.keys(g2)]);
    for (const key of keys) {
      child[key] = Math.random() < PSI ? g1[key] : g2[key];
    }
    return child;
  }

  /**
   * Mutate a genome — randomly perturb values.
   * @param {Object} genome
   * @returns {Object} Mutated genome
   */
  _mutate(genome) {
    const mutated = { ...genome };
    const keys = Object.keys(mutated);
    const mutateCount = Math.max(1, Math.round(keys.length * PSI * PSI)); // ≈ 38.2% of genes

    for (let i = 0; i < mutateCount; i++) {
      const key = keys[Math.floor(Math.random() * keys.length)];
      const val = mutated[key];

      if (typeof val === 'number') {
        // Gaussian perturbation scaled by phi
        const perturbation = (Math.random() * 2 - 1) * val * PSI;
        mutated[key] = val + perturbation;
      } else if (typeof val === 'boolean') {
        mutated[key] = !val;
      } else if (typeof val === 'string' && val.length > 0) {
        // Swap two random characters
        const arr = val.split('');
        const i1 = Math.floor(Math.random() * arr.length);
        const i2 = Math.floor(Math.random() * arr.length);
        [arr[i1], arr[i2]] = [arr[i2], arr[i1]];
        mutated[key] = arr.join('');
      }
    }

    return mutated;
  }

  /**
   * Measure population diversity as average pairwise cosine distance.
   * @returns {number} Diversity score (0 = identical, 1 = maximally diverse)
   */
  _measureDiversity() {
    const sampleSize = Math.min(this.population.length, fib(6)); // Sample 8
    let totalDistance = 0;
    let count = 0;

    for (let i = 0; i < sampleSize; i++) {
      for (let j = i + 1; j < sampleSize; j++) {
        const sim = cosineSimilarity(this.population[i].embedding, this.population[j].embedding);
        totalDistance += (1 - sim);
        count++;
      }
    }

    return count > 0 ? totalDistance / count : 0;
  }

  /**
   * Inject random individuals to combat stagnation.
   * Replaces bottom 38.2% (ψ²) of population with fresh random genomes.
   * @returns {Promise<void>}
   */
  async _injectDiversity() {
    const replaceCount = Math.round(this.population.length * PSI * PSI);
    const startIdx = this.population.length - replaceCount;

    for (let i = startIdx; i < this.population.length; i++) {
      const genome = this._mutate(this.bestEver.genome);
      genome._injected = true;
      const embedding = await this.embedFn(genome);
      const fitness = this._scoreFitness(embedding);
      this.population[i] = {
        id: `inject-gen${this.generation}-${i}`,
        genome,
        embedding,
        fitness,
        generation: this.generation,
      };
    }

    this._sortByFitness();
    logger.info({ replaced: replaceCount }, 'Diversity injection complete');
  }

  /** Sort population by fitness descending */
  _sortByFitness() {
    this.population.sort((a, b) => b.fitness - a.fitness);
  }

  /** Get evolution statistics */
  stats() {
    return {
      generation: this.generation,
      populationSize: this.population.length,
      bestFitness: this.bestEver?.fitness || 0,
      avgFitness: this.population.reduce((s, i) => s + i.fitness, 0) / (this.population.length || 1),
      diversity: this._measureDiversity(),
      stagnation: this.stagnationCount,
      history: this.history,
    };
  }

  /** Health check data */
  health() {
    return {
      service: 'EvolutionEngine',
      status: 'up',
      generation: this.generation,
      bestFitness: this.bestEver?.fitness || 0,
      populationSize: this.population.length,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { EvolutionEngine, EVO_CONFIG };
