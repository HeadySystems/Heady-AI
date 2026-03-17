// packages/heady-core/src/cfc-neuron.js
// CfC (Closed-form Continuous-time) Liquid Neural Network
// MIT CSAIL — adapted for JavaScript inference
// Each bee type = CfC neuron with adaptive time constants
import { PHI, PHI_INV, FIBONACCI } from './phi.js';

/**
 * CfC Neuron — Closed-form Continuous-time model.
 * ODE: τ * dx/dt = -x + f(W_in * input + W_rec * x + bias)
 * Closed-form solution at time t: x(t) = x(0)*exp(-t/τ) + (1-exp(-t/τ))*σ(W*input + b)
 *
 * @typedef {{ weights: number[], recurrent: number[], bias: number, tau: number, state: number }} CfCNeuron
 */

/**
 * Initialize a CfC neuron with φ-scaled parameters.
 * @param {number} inputDim — number of input connections
 * @param {number} [tauInit] — time constant (default: φ)
 * @returns {CfCNeuron}
 */
export function createCfCNeuron(inputDim, tauInit = PHI) {
  // Xavier-like initialization scaled by φ
  const scale = PHI_INV / Math.sqrt(inputDim);
  return {
    weights: Array.from({ length: inputDim }, () => (Math.random() * 2 - 1) * scale),
    recurrent: Array.from({ length: 1 }, () => (Math.random() * 2 - 1) * scale),
    bias: (Math.random() - 0.5) * PHI_INV,
    tau: tauInit,
    state: 0
  };
}

/**
 * Step a CfC neuron forward by dt time.
 * Uses closed-form ODE solution — no numerical integration needed.
 *
 * @param {CfCNeuron} neuron
 * @param {number[]} input — input vector
 * @param {number} dt — time step
 * @returns {{ output: number, neuron: CfCNeuron }}
 */
export function stepCfCNeuron(neuron, input, dt = 1.0) {
  // Compute input activation
  let activation = neuron.bias;
  for (let i = 0; i < input.length && i < neuron.weights.length; i++) {
    activation += neuron.weights[i] * input[i];
  }
  activation += neuron.recurrent[0] * neuron.state;

  // Sigmoid activation
  const sigma = 1 / (1 + Math.exp(-activation));

  // Closed-form ODE solution
  const decay = Math.exp(-dt / neuron.tau);
  const newState = neuron.state * decay + (1 - decay) * sigma;

  return {
    output: newState,
    neuron: { ...neuron, state: newState }
  };
}

/**
 * CfC Network — a layer of CfC neurons with adaptive time constants.
 * Suitable for temporal pattern recognition with very few neurons (19-50).
 *
 * @typedef {{ neurons: CfCNeuron[], outputWeights: number[][] }} CfCNetwork
 */

/**
 * Create a CfC network (liquid neural network layer).
 * @param {number} inputDim
 * @param {number} hiddenDim — number of CfC neurons (19-50 recommended)
 * @param {number} outputDim
 * @returns {CfCNetwork}
 */
export function createCfCNetwork(inputDim, hiddenDim = 21, outputDim = 1) {
  // Each neuron gets a φ-scaled time constant from Fibonacci sequence
  const neurons = Array.from({ length: hiddenDim }, (_, i) => {
    const fibIdx = i % FIBONACCI.length;
    const tau = FIBONACCI[fibIdx] * PHI_INV; // Fibonacci × φ⁻¹
    return createCfCNeuron(inputDim, Math.max(0.1, tau));
  });

  // Output projection weights
  const scale = PHI_INV / Math.sqrt(hiddenDim);
  const outputWeights = Array.from({ length: outputDim }, () =>
    Array.from({ length: hiddenDim }, () => (Math.random() * 2 - 1) * scale)
  );

  return { neurons, outputWeights };
}

/**
 * Forward pass through CfC network.
 * @param {CfCNetwork} network
 * @param {number[]} input
 * @param {number} dt
 * @returns {{ outputs: number[], network: CfCNetwork, hiddenStates: number[] }}
 */
export function forwardCfCNetwork(network, input, dt = 1.0) {
  const hiddenStates = [];
  const updatedNeurons = [];

  // Step each CfC neuron
  for (const neuron of network.neurons) {
    const { output, neuron: updated } = stepCfCNeuron(neuron, input, dt);
    hiddenStates.push(output);
    updatedNeurons.push(updated);
  }

  // Output projection
  const outputs = network.outputWeights.map(row => {
    let sum = 0;
    for (let i = 0; i < row.length; i++) {
      sum += row[i] * hiddenStates[i];
    }
    return sum;
  });

  return { outputs, network: { ...network, neurons: updatedNeurons }, hiddenStates };
}

/**
 * Create an adaptive bee using a CfC neuron.
 * The neuron's time constant adapts to the task's temporal dynamics.
 *
 * @param {string} beeType — the bee specialization (e.g., 'research', 'code', 'creative')
 * @param {number} inputDim
 * @returns {{ type: string, neuron: CfCNeuron, process: function }}
 */
export function createAdaptiveBee(beeType, inputDim = 8) {
  // Different bee types get different initial time constants
  const tauMap = {
    research: PHI * 3,     // Slow, deliberate
    code: PHI,             // Balanced
    creative: PHI_INV,     // Fast, impulsive
    analysis: PHI * 2,     // Moderate
    security: PHI * PHI,   // Very careful
    default: PHI
  };

  const tau = tauMap[beeType] || tauMap.default;
  const neuron = createCfCNeuron(inputDim, tau);

  return {
    type: beeType,
    neuron,
    /**
     * Process an input signal through the bee's CfC neuron.
     * @param {number[]} inputSignal
     * @param {number} timeStep
     * @returns {{ response: number, confidence: number }}
     */
    process(inputSignal, timeStep = 1.0) {
      const { output, neuron: updated } = stepCfCNeuron(this.neuron, inputSignal, timeStep);
      this.neuron = updated;
      return { response: output, confidence: Math.abs(output) };
    }
  };
}
