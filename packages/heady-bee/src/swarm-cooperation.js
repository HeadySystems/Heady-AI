// packages/heady-bee/src/swarm-cooperation.js
// Swarm Cooperation Model — Nature Communications 2025
// Governs balance between social, cognitive, and stochastic forces
import { PHI, PHI_INV, FIBONACCI, MAX_BEES } from '../../heady-core/src/phi.js';

/**
 * Swarm Cooperation Model — three forces govern inter-swarm coordination:
 * 1. Social (communication) — how much agents share information
 * 2. Cognitive (individual intelligence) — how much agents rely on own experience
 * 3. Stochastic (exploration) — random perturbation for discovery
 *
 * φ governs the balance: social = φ⁻¹, cognitive = φ⁻², stochastic = 1 - social - cognitive
 */

const SOCIAL_WEIGHT =     PHI_INV;                    // 0.618 — information sharing
const COGNITIVE_WEIGHT =  PHI_INV * PHI_INV;           // 0.382 — individual intelligence
const STOCHASTIC_WEIGHT = 1 - SOCIAL_WEIGHT - COGNITIVE_WEIGHT; // ~0.000 (balance term)

/**
 * @typedef {{ id: string, position: number[], velocity: number[], bestPosition: number[], bestScore: number, swarmId: string }} SwarmAgent
 */

/**
 * Initialize a swarm of agents with φ-spaced starting positions.
 * @param {number} count — number of agents (max 34 = Fibonacci[8])
 * @param {number} dims — dimensions of the search space
 * @param {number[]} bounds — [min, max]
 * @returns {SwarmAgent[]}
 */
export function initializeSwarm(count, dims, bounds, swarmId = 'default') {
  const n = Math.min(count, MAX_BEES);
  const [lo, hi] = [bounds[0], bounds[1]];

  return Array.from({ length: n }, (_, i) => {
    const position = Array.from({ length: dims }, (_, d) => {
      const golden = ((i + 1) * PHI_INV + d * PHI_INV * PHI_INV) % 1;
      return lo + golden * (hi - lo);
    });
    const velocity = Array(dims).fill(0);

    return {
      id: `bee-${swarmId}-${i}`,
      position: [...position],
      velocity: [...velocity],
      bestPosition: [...position],
      bestScore: Infinity,
      swarmId
    };
  });
}

/**
 * Update agent positions using the three-force cooperation model.
 * @param {SwarmAgent[]} agents
 * @param {number[]} globalBest — best position found across all agents
 * @param {Function} objective — evaluation function
 * @param {number} iteration — current iteration
 * @param {number} maxIterations
 * @returns {SwarmAgent[]}
 */
export function updateSwarm(agents, globalBest, objective, iteration, maxIterations) {
  const inertia = 0.9 - (0.5 * iteration / maxIterations); // Decreasing inertia

  return agents.map(agent => {
    const dims = agent.position.length;
    const newVelocity = Array(dims);
    const newPosition = Array(dims);

    for (let d = 0; d < dims; d++) {
      const r1 = Math.random();
      const r2 = Math.random();
      const r3 = Math.random();

      // Social component: pull toward global best
      const social = SOCIAL_WEIGHT * r1 * (globalBest[d] - agent.position[d]);

      // Cognitive component: pull toward personal best
      const cognitive = COGNITIVE_WEIGHT * r2 * (agent.bestPosition[d] - agent.position[d]);

      // Stochastic component: φ-scaled random walk
      const fibIdx = Math.min(iteration % FIBONACCI.length, FIBONACCI.length - 1);
      const fibScale = FIBONACCI[fibIdx] / FIBONACCI[FIBONACCI.length - 1];
      const stochastic = (r3 - 0.5) * fibScale * PHI_INV;

      newVelocity[d] = inertia * agent.velocity[d] + social + cognitive + stochastic;
      newPosition[d] = agent.position[d] + newVelocity[d];
    }

    const score = objective(newPosition);
    const improved = score < agent.bestScore;

    return {
      ...agent,
      position: newPosition,
      velocity: newVelocity,
      bestPosition: improved ? [...newPosition] : agent.bestPosition,
      bestScore: improved ? score : agent.bestScore
    };
  });
}

/**
 * Run the full swarm cooperation optimization.
 * @param {Function} objective
 * @param {number} dims
 * @param {number[]} bounds
 * @param {{ agents?: number, iterations?: number, swarmCount?: number }} options
 * @returns {{ best: number[], score: number, iterations: number }}
 */
export function runCooperativeSwarm(objective, dims, bounds, options = {}) {
  const { agents: agentCount = 13, iterations = 144, swarmCount = 3 } = options;

  // Multiple cooperative swarms (social structure)
  const swarms = Array.from({ length: swarmCount }, (_, i) =>
    initializeSwarm(Math.ceil(agentCount / swarmCount), dims, bounds, `swarm-${i}`)
  );

  let globalBest = swarms[0][0].position;
  let globalBestScore = Infinity;

  for (let iter = 0; iter < iterations; iter++) {
    for (let s = 0; s < swarms.length; s++) {
      swarms[s] = updateSwarm(swarms[s], globalBest, objective, iter, iterations);

      // Check for new global best
      for (const agent of swarms[s]) {
        if (agent.bestScore < globalBestScore) {
          globalBest = [...agent.bestPosition];
          globalBestScore = agent.bestScore;
        }
      }
    }

    // Inter-swarm information exchange at Fibonacci intervals
    if (FIBONACCI.includes(iter + 1)) {
      // Share global best across all swarms — social force amplification
      for (const swarm of swarms) {
        for (const agent of swarm) {
          // φ-weighted nudge toward global best
          for (let d = 0; d < dims; d++) {
            agent.velocity[d] += PHI_INV * PHI_INV * (globalBest[d] - agent.position[d]);
          }
        }
      }
    }
  }

  return { best: globalBest, score: globalBestScore, iterations };
}
