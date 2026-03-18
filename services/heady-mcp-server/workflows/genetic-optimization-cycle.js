/**
 * Genetic Optimization Cycle Workflow
 * Evolutionary optimization: select configs → phi-scaled mutation →
 * battle arena evaluation → promote winners.
 * @module genetic-optimization-cycle
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 */
'use strict';

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };

class GeneticOptimizationCycleWorkflow {
  constructor(config = {}) {
    this.populationSize = config.populationSize || FIB[8]; // 21
    this.mutationRate = config.mutationRate || PSI * 0.1; // ~6.18%
    this.crossoverRate = config.crossoverRate || PSI; // ~61.8%
    this.elitismCount = config.elitismCount || FIB[4]; // 3 elites preserved
    this.maxGenerations = config.maxGenerations || FIB[7]; // 13 generations
    this.generation = 0;
    this.population = [];
    this.hallOfFame = [];
    this.state = 'IDLE';
  }

  /**
   * Execute a full optimization cycle
   * @param {object} context — { initialPopulation, fitnessFunction, parameterSpace }
   * @returns {object} — optimization results
   */
  async execute(context) {
    const { initialPopulation = [], fitnessFunction, parameterSpace = {} } = context;
    this.state = 'EVOLVING';
    const correlationId = `evo-${Date.now().toString(36)}`;

    // Initialize population
    this.population = initialPopulation.length >= this.populationSize
      ? initialPopulation.slice(0, this.populationSize)
      : this._generateRandomPopulation(parameterSpace, this.populationSize - initialPopulation.length, initialPopulation);

    const generationResults = [];

    for (this.generation = 0; this.generation < this.maxGenerations; this.generation++) {
      // Evaluate fitness
      const evaluated = await this._evaluateFitness(this.population, fitnessFunction);

      // Sort by fitness (descending)
      evaluated.sort((a, b) => b.fitness - a.fitness);

      const bestFitness = evaluated[0].fitness;
      const avgFitness = evaluated.reduce((s, e) => s + e.fitness, 0) / evaluated.length;
      generationResults.push({ generation: this.generation, bestFitness, avgFitness, bestIndividual: evaluated[0].id });

      // Check convergence (best fitness exceeds CSL CRITICAL)
      if (bestFitness >= CSL.CRITICAL) {
        break;
      }

      // Selection
      const selected = this._tournamentSelect(evaluated);

      // Crossover
      const offspring = this._crossover(selected, parameterSpace);

      // Mutation
      const mutated = this._mutate(offspring, parameterSpace);

      // Elitism: preserve top individuals
      const elites = evaluated.slice(0, this.elitismCount).map(e => e.config);
      this.population = [...elites, ...mutated.slice(0, this.populationSize - this.elitismCount)];
    }

    // Final evaluation
    const finalEval = await this._evaluateFitness(this.population, fitnessFunction);
    finalEval.sort((a, b) => b.fitness - a.fitness);

    // Hall of fame update
    const champion = finalEval[0];
    this.hallOfFame.push({ ...champion, generation: this.generation, promotedAt: Date.now() });
    if (this.hallOfFame.length > FIB[8]) this.hallOfFame.splice(0, this.hallOfFame.length - FIB[8]);

    this.state = 'IDLE';
    return {
      correlationId,
      generations: this.generation + 1,
      champion: { id: champion.id, fitness: champion.fitness, config: champion.config },
      topN: finalEval.slice(0, FIB[5]).map(e => ({ id: e.id, fitness: e.fitness })),
      generationResults,
      convergence: champion.fitness >= CSL.CRITICAL ? 'converged' : 'max-generations',
      hallOfFame: this.hallOfFame.slice(-FIB[5]),
      timestamp: new Date().toISOString()
    };
  }

  _generateRandomPopulation(parameterSpace, count, existing = []) {
    const population = [...existing.map(e => e.config || e)];
    for (let i = 0; i < count; i++) {
      const individual = {};
      for (const [param, spec] of Object.entries(parameterSpace)) {
        if (spec.type === 'float') individual[param] = spec.min + Math.random() * (spec.max - spec.min);
        else if (spec.type === 'int') individual[param] = Math.round(spec.min + Math.random() * (spec.max - spec.min));
        else if (spec.type === 'choice') individual[param] = spec.options[Math.floor(Math.random() * spec.options.length)];
        else individual[param] = Math.random();
      }
      population.push(individual);
    }
    return population;
  }

  async _evaluateFitness(population, fitnessFunction) {
    if (!fitnessFunction) {
      return population.map((config, i) => ({ id: `ind-${i}`, config, fitness: CSL.MEDIUM + Math.random() * PSI * 0.2 }));
    }
    return Promise.all(population.map(async (config, i) => {
      try {
        const fitness = await fitnessFunction(config);
        return { id: `ind-${i}`, config, fitness: Math.min(1.0, Math.max(0, fitness)) };
      } catch { return { id: `ind-${i}`, config, fitness: 0 }; }
    }));
  }

  _tournamentSelect(evaluated) {
    const selected = [];
    const tournamentSize = FIB[4]; // 3
    for (let i = 0; i < this.populationSize; i++) {
      const tournament = [];
      for (let j = 0; j < tournamentSize; j++) {
        tournament.push(evaluated[Math.floor(Math.random() * evaluated.length)]);
      }
      tournament.sort((a, b) => b.fitness - a.fitness);
      selected.push(tournament[0].config);
    }
    return selected;
  }

  _crossover(selected, parameterSpace) {
    const offspring = [];
    for (let i = 0; i < selected.length; i += 2) {
      if (i + 1 < selected.length && Math.random() < this.crossoverRate) {
        const [child1, child2] = this._uniformCrossover(selected[i], selected[i + 1], parameterSpace);
        offspring.push(child1, child2);
      } else {
        offspring.push({ ...selected[i] });
        if (i + 1 < selected.length) offspring.push({ ...selected[i + 1] });
      }
    }
    return offspring;
  }

  _uniformCrossover(parent1, parent2, parameterSpace) {
    const child1 = {}; const child2 = {};
    for (const param of Object.keys(parameterSpace)) {
      if (Math.random() < PSI) { child1[param] = parent1[param]; child2[param] = parent2[param]; }
      else { child1[param] = parent2[param]; child2[param] = parent1[param]; }
    }
    return [child1, child2];
  }

  _mutate(offspring, parameterSpace) {
    return offspring.map(individual => {
      const mutated = { ...individual };
      for (const [param, spec] of Object.entries(parameterSpace)) {
        if (Math.random() < this.mutationRate) {
          if (spec.type === 'float') {
            const range = spec.max - spec.min;
            const perturbation = (Math.random() - PSI) * range * PSI * 0.2;
            mutated[param] = Math.max(spec.min, Math.min(spec.max, mutated[param] + perturbation));
          } else if (spec.type === 'int') {
            const perturbation = Math.round((Math.random() - PSI) * FIB[4]);
            mutated[param] = Math.max(spec.min, Math.min(spec.max, mutated[param] + perturbation));
          } else if (spec.type === 'choice') {
            mutated[param] = spec.options[Math.floor(Math.random() * spec.options.length)];
          }
        }
      }
      return mutated;
    });
  }

  health() {
    return { status: 'ok', workflow: 'genetic-optimization-cycle', state: this.state, generation: this.generation, populationSize: this.population.length, hallOfFameSize: this.hallOfFame.length, timestamp: new Date().toISOString() };
  }
}

module.exports = { GeneticOptimizationCycleWorkflow };
