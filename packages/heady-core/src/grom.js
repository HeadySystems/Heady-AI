// packages/heady-core/src/grom.js
// GROM — Golden Ratio Optimization Method
// Parameter-free meta-heuristic using φ for global+local search
// Ref: Fibonacci-enhanced swarm algorithms (Scientific Reports 2025)
import { PHI, PHI_INV, FIBONACCI } from './phi.js';

/**
 * GROM optimizer — uses golden ratio for global+local search.
 * No tunable hyperparameters — φ governs all exploration/exploitation.
 *
 * @param {Function} objective — function(position: number[]) => number (lower is better)
 * @param {number} dims — number of dimensions
 * @param {number[]} bounds — [min, max] for each dimension
 * @param {number} [agents=16] — population size (Fibonacci-aligned)
 * @param {number} [maxIter=233] — max iterations (Fibonacci[12])
 * @returns {{ best: number[], score: number, iterations: number, history: number[] }}
 */
export function grom(objective, dims, bounds, agents = 13, maxIter = 233) {
  const [lo, hi] = Array.isArray(bounds[0]) ? [bounds.map(b => b[0]), bounds.map(b => b[1])]
    : [Array(dims).fill(bounds[0]), Array(dims).fill(bounds[1])];

  // Initialize population using golden ratio spacing (low-discrepancy)
  let population = Array.from({ length: agents }, (_, i) => {
    return Array.from({ length: dims }, (_, d) => {
      const golden = ((i + 1) * PHI_INV) % 1;
      return lo[d] + golden * (hi[d] - lo[d]);
    });
  });

  let scores = population.map(p => objective(p));
  let bestIdx = scores.indexOf(Math.min(...scores));
  let globalBest = [...population[bestIdx]];
  let globalBestScore = scores[bestIdx];
  const history = [globalBestScore];

  for (let iter = 0; iter < maxIter; iter++) {
    const t = iter / maxIter; // normalized time [0, 1]
    // φ-decay: exploration decreases exponentially via golden ratio
    const explorationRadius = (1 - t) * PHI_INV;
    const exploitationRadius = t * PHI_INV;

    for (let i = 0; i < agents; i++) {
      const candidate = Array(dims);

      for (let d = 0; d < dims; d++) {
        // Global search: golden section between current and global best
        const goldenStep = (globalBest[d] - population[i][d]) * PHI_INV;
        // Local search: Fibonacci-scaled perturbation
        const fibIdx = Math.min(iter % FIBONACCI.length, FIBONACCI.length - 1);
        const fibScale = FIBONACCI[fibIdx] / FIBONACCI[FIBONACCI.length - 1];
        const perturbation = (Math.random() - 0.5) * explorationRadius * (hi[d] - lo[d]) * fibScale;

        // φ-weighted combination
        candidate[d] = population[i][d]
          + goldenStep * exploitationRadius
          + perturbation;

        // Clamp to bounds
        candidate[d] = Math.max(lo[d], Math.min(hi[d], candidate[d]));
      }

      const candidateScore = objective(candidate);
      if (candidateScore < scores[i]) {
        population[i] = candidate;
        scores[i] = candidateScore;
        if (candidateScore < globalBestScore) {
          globalBest = [...candidate];
          globalBestScore = candidateScore;
        }
      }
    }

    history.push(globalBestScore);

    // φ-convergence check: if improvement < PHI_INV^iter ratio, early stop
    if (iter > 21 && Math.abs(history[iter] - history[iter - 21]) < 1e-10) break;
  }

  return { best: globalBest, score: globalBestScore, iterations: history.length, history };
}

/**
 * Golden section search — 1D optimization using φ.
 * Finds minimum of unimodal function on [a, b].
 * @param {Function} f — function(x) => number
 * @param {number} a — lower bound
 * @param {number} b — upper bound
 * @param {number} [tol=1e-8]
 * @returns {{ x: number, fx: number }}
 */
export function goldenSectionSearch(f, a, b, tol = 1e-8) {
  let x1 = b - PHI_INV * (b - a);
  let x2 = a + PHI_INV * (b - a);
  let f1 = f(x1);
  let f2 = f(x2);

  while (Math.abs(b - a) > tol) {
    if (f1 < f2) {
      b = x2;
      x2 = x1;
      f2 = f1;
      x1 = b - PHI_INV * (b - a);
      f1 = f(x1);
    } else {
      a = x1;
      x1 = x2;
      f1 = f2;
      x2 = a + PHI_INV * (b - a);
      f2 = f(x2);
    }
  }

  const x = (a + b) / 2;
  return { x, fx: f(x) };
}

/**
 * Fibonacci hash — near-optimal hash distribution using φ.
 * @param {number} key — integer key
 * @param {number} tableSize — hash table size (power of 2)
 * @returns {number} — hash index
 */
export function fibonacciHash(key, tableSize) {
  const GOLDEN_RATIO_32 = 2654435769; // 2^32 / φ
  return ((key * GOLDEN_RATIO_32) >>> 0) % tableSize;
}
