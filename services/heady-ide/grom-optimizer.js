// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ GROM — Golden Ratio Optimization Method v1.0           ║
// ║  Parameter-free meta-heuristic using φ for global+local search ║
// ║  ⚠️ PATENT LOCK — HS-2026-051 — φ-scaled optimization         ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

const PHI = (1 + Math.sqrt(5)) / 2;
const PSI = 1 / PHI;
const FIB = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];

/**
 * GROM: Golden Ratio Optimization Method
 *
 * A parameter-free meta-heuristic optimizer based on the golden ratio.
 * Uses φ for exploration/exploitation balance, Fibonacci numbers for
 * population grouping, and golden section search for local refinement.
 *
 * @param {Function} fitness - Fitness function: (vector) => score (higher = better)
 * @param {number} dims - Number of dimensions
 * @param {Object} opts - Configuration
 * @param {number} opts.popSize - Population size (default: fib(8) = 21)
 * @param {number} opts.maxIter - Max iterations (default: fib(11) = 89)
 * @param {number[]} opts.lowerBound - Per-dimension lower bounds
 * @param {number[]} opts.upperBound - Per-dimension upper bounds
 * @param {number} opts.seed - PRNG seed for determinism (default: 42)
 * @returns {{ best: number[], bestFitness: number, history: number[], iterations: number }}
 */
export function grom(fitness, dims, opts = {}) {
  const popSize   = opts.popSize   || FIB[8];   // 21
  const maxIter   = opts.maxIter   || FIB[11];  // 89
  const lower     = opts.lowerBound || new Array(dims).fill(0);
  const upper     = opts.upperBound || new Array(dims).fill(1);
  const seed      = opts.seed ?? 42;

  // Deterministic PRNG (Mulberry32)
  let rngState = seed;
  const rand = () => {
    rngState |= 0; rngState = rngState + 0x6D2B79F5 | 0;
    let t = Math.imul(rngState ^ rngState >>> 15, 1 | rngState);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  // Initialize population with golden ratio quasi-random sequence
  const population = [];
  for (let i = 0; i < popSize; i++) {
    const agent = new Array(dims);
    for (let d = 0; d < dims; d++) {
      // Kronecker quasi-random: x_n = frac(n * φ) — near-optimal coverage
      const kronecker = ((i + 1) * PHI * (d + 1)) % 1;
      agent[d] = lower[d] + kronecker * (upper[d] - lower[d]);
    }
    population.push(agent);
  }

  // Evaluate fitness
  let scores = population.map(a => fitness(a));
  let bestIdx = scores.indexOf(Math.max(...scores));
  let globalBest = [...population[bestIdx]];
  let globalBestFitness = scores[bestIdx];
  const history = [globalBestFitness];

  for (let iter = 0; iter < maxIter; iter++) {
    const progress = iter / maxIter; // 0→1

    // φ-adaptive balance: exploration decays as φ^(-progress), exploitation grows
    const explorationWeight = Math.pow(PSI, progress * 3);
    const exploitationWeight = 1 - explorationWeight;

    // Fibonacci population grouping: split into fib(n) groups
    const groupCount = Math.max(2, FIB[Math.min(Math.floor(progress * 8) + 2, 12)]);
    const groupSize = Math.ceil(popSize / groupCount);

    for (let i = 0; i < popSize; i++) {
      const agent = population[i];
      const newAgent = new Array(dims);

      // Group leader (best in group)
      const groupStart = Math.floor(i / groupSize) * groupSize;
      const groupEnd = Math.min(groupStart + groupSize, popSize);
      let leaderIdx = groupStart;
      for (let g = groupStart; g < groupEnd; g++) {
        if (scores[g] > scores[leaderIdx]) leaderIdx = g;
      }
      const leader = population[leaderIdx];

      for (let d = 0; d < dims; d++) {
        const range = upper[d] - lower[d];

        // Golden section local search
        const a = agent[d] - range * PSI * PSI * explorationWeight;
        const b = agent[d] + range * PSI * PSI * explorationWeight;
        const x1 = a + PSI * PSI * (b - a); // Golden section point 1
        const x2 = a + PSI * (b - a);       // Golden section point 2

        // Three movement strategies, blended by φ-weights
        const toGlobal = globalBest[d] + PHI * (rand() - PSI) * (globalBest[d] - agent[d]);
        const toLeader = leader[d] + PSI * (rand() - PSI) * (leader[d] - agent[d]);
        const goldenSearch = rand() < PSI ? x1 : x2;

        // φ-weighted combination
        newAgent[d] = exploitationWeight * (PSI * toGlobal + PSI * PSI * toLeader) +
                      explorationWeight * goldenSearch;

        // Lévy flight perturbation for escaping local optima (φ-scaled step)
        if (rand() < PSI * PSI * explorationWeight) {
          const levy = Math.pow(rand() + 1e-10, -PHI) * range * PSI * PSI * PSI;
          newAgent[d] += (rand() - 0.5) * levy;
        }

        // Clamp to bounds
        newAgent[d] = Math.max(lower[d], Math.min(upper[d], newAgent[d]));
      }

      // Greedy selection
      const newScore = fitness(newAgent);
      if (newScore > scores[i]) {
        population[i] = newAgent;
        scores[i] = newScore;

        if (newScore > globalBestFitness) {
          globalBest = [...newAgent];
          globalBestFitness = newScore;
        }
      }
    }

    history.push(globalBestFitness);

    // Early stopping: convergence check (φ-scaled patience)
    if (history.length > FIB[7]) { // 13 iterations patience
      const recent = history.slice(-FIB[7]);
      const improvement = Math.abs(recent[recent.length - 1] - recent[0]);
      if (improvement < 1e-10) break;
    }
  }

  return { best: globalBest, bestFitness: globalBestFitness, history, iterations: history.length - 1 };
}

/**
 * GROM for discrete optimization (e.g., selecting best model, best config)
 * Maps continuous GROM output to discrete indices.
 */
export function gromDiscrete(fitness, options, opts = {}) {
  const dims = options.length;
  const sizes = options.map(o => o.length);

  const wrappedFitness = (vec) => {
    const selected = vec.map((v, d) => {
      const idx = Math.min(Math.floor(v * sizes[d]), sizes[d] - 1);
      return options[d][idx];
    });
    return fitness(selected);
  };

  const result = grom(wrappedFitness, dims, {
    ...opts,
    lowerBound: new Array(dims).fill(0),
    upperBound: new Array(dims).fill(1),
  });

  const bestSelection = result.best.map((v, d) => {
    const idx = Math.min(Math.floor(v * sizes[d]), sizes[d] - 1);
    return options[d][idx];
  });

  return { ...result, bestSelection };
}

/**
 * GROM for Heady pipeline optimization:
 * Optimize φ-scaled thresholds, timeouts, and CSL gate parameters.
 */
export function gromPipelineOptimizer(evaluator, opts = {}) {
  // 8 dimensions: key pipeline parameters
  const paramNames = [
    'csl_include_threshold',   // CSL INCLUDE gate
    'csl_core_threshold',      // CSL CORE gate
    'arena_winner_margin',     // Arena winner margin %
    'monte_carlo_pass_rate',   // MC pass rate threshold
    'retry_base_ms',           // Retry base delay
    'backpressure_throttle',   // Backpressure throttle
    'provider_timeout_ms',     // LLM provider timeout
    'distiller_judge',         // Distiller quality threshold
  ];

  const lower = [0.3, 0.5, 0.01, 0.5, 500,  0.4, 2000, 0.7];
  const upper = [0.8, 0.9, 0.20, 0.95, 5000, 0.9, 30000, 0.95];

  const result = grom((vec) => {
    const params = {};
    paramNames.forEach((name, i) => params[name] = vec[i]);
    return evaluator(params);
  }, paramNames.length, { ...opts, lowerBound: lower, upperBound: upper });

  const optimized = {};
  paramNames.forEach((name, i) => optimized[name] = result.best[i]);

  return { ...result, optimizedParams: optimized, paramNames };
}

export default { grom, gromDiscrete, gromPipelineOptimizer };
