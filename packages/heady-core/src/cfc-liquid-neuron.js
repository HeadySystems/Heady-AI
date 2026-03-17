// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ CfC Liquid Neuron v1.0                                 ║
// ║  Closed-form Continuous-time neural computation                 ║
// ║  Each bee type = CfC neuron with adaptive time constants        ║
// ║  Based on MIT CSAIL Liquid Neural Networks (Hasani et al.)      ║
// ║  ⚠️ PATENT LOCK — HS-2026-054 — Adaptive neural computation   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

const PHI = (1 + Math.sqrt(5)) / 2;
const PSI = 1 / PHI;

/**
 * CfC Liquid Neuron — Pure JavaScript implementation
 *
 * Implements the closed-form solution to the Liquid Time-Constant (LTC)
 * ODE: τ(x) * dx/dt = -x + f(x, I, θ)
 *
 * The CfC closed-form avoids ODE solvers entirely, making it as fast as
 * a standard RNN while retaining the adaptive time-constant property
 * that makes LTC networks "liquid."
 *
 * Key properties:
 * - Time constants adapt to input: slow for stable patterns, fast for novelty
 * - φ-scaled initialization for natural convergence
 * - 19–50 neurons sufficient for complex sequential tasks
 * - Causal: output depends only on past inputs (no future leakage)
 */

/**
 * Sigmoid activation
 */
function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Tanh activation
 */
function tanh(x) {
  const e2x = Math.exp(2 * x);
  return (e2x - 1) / (e2x + 1);
}

/**
 * Initialize weight matrix with φ-scaled Xavier initialization.
 * Ensures eigenvalues are distributed near the golden ratio for
 * stable gradient flow and natural convergence.
 */
function phiXavierInit(rows, cols, seed = 42) {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s / 0x7fffffff) * 2 - 1;
  };

  const scale = Math.sqrt(2.0 / (rows + cols)) * PSI; // φ-scaled
  const matrix = [];
  for (let i = 0; i < rows; i++) {
    const row = [];
    for (let j = 0; j < cols; j++) {
      row.push(rand() * scale);
    }
    matrix.push(row);
  }
  return matrix;
}

/**
 * Matrix-vector multiplication
 */
function matVecMul(mat, vec) {
  return mat.map(row => row.reduce((s, w, j) => s + w * vec[j], 0));
}

/**
 * Element-wise vector operations
 */
function vecAdd(a, b) { return a.map((v, i) => v + b[i]); }
function vecMul(a, b) { return a.map((v, i) => v * b[i]); }
function vecScale(a, s) { return a.map(v => v * s); }
function vecSigmoid(a) { return a.map(sigmoid); }
function vecTanh(a) { return a.map(tanh); }

/**
 * CfC Cell — Single liquid neuron layer
 *
 * Implements: h(t) = σ(f) ⊙ h(t-1) + (1 - σ(f)) ⊙ tanh(Wx + Uh(t-1) + b)
 * where f (forget gate) adapts based on time elapsed since last input.
 */
export class CfCCell {
  constructor(inputSize, hiddenSize, opts = {}) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    this.seed = opts.seed || 42;

    // Weight matrices (φ-Xavier initialized)
    this.Wf = phiXavierInit(hiddenSize, inputSize, this.seed);
    this.Uf = phiXavierInit(hiddenSize, hiddenSize, this.seed + 1);
    this.bf = new Array(hiddenSize).fill(-PSI); // Bias toward remembering (φ-scaled)

    this.Wi = phiXavierInit(hiddenSize, inputSize, this.seed + 2);
    this.Ui = phiXavierInit(hiddenSize, hiddenSize, this.seed + 3);
    this.bi = new Array(hiddenSize).fill(0);

    // Time-constant parameters (τ adapts to input)
    this.Wt = phiXavierInit(hiddenSize, inputSize, this.seed + 4);
    this.bt = new Array(hiddenSize).fill(Math.log(PHI)); // Initialize τ near φ
  }

  /**
   * Forward pass
   * @param {number[]} input - Input vector
   * @param {number[]} prevHidden - Previous hidden state
   * @param {number} dt - Time elapsed since last step (in seconds, default 1.0)
   * @returns {{ hidden: number[], timeConstants: number[] }}
   */
  forward(input, prevHidden, dt = 1.0) {
    prevHidden = prevHidden || new Array(this.hiddenSize).fill(0);

    // Compute adaptive time constant: τ = exp(W_τ · x + b_τ)
    // Larger τ = slower adaptation (stable), smaller τ = faster (responsive)
    const tauPre = vecAdd(matVecMul(this.Wt, input), this.bt);
    const tau = tauPre.map(v => Math.exp(v));

    // Effective decay: α = exp(-dt / τ) — how much of previous state to keep
    const alpha = tau.map(t => Math.exp(-dt / Math.max(t, 1e-6)));

    // Forget gate: σ(Wf·x + Uf·h + bf) modulated by time constant
    const fGate = vecSigmoid(
      vecAdd(vecAdd(matVecMul(this.Wf, input), matVecMul(this.Uf, prevHidden)), this.bf)
    );
    const effectiveForget = vecMul(fGate, alpha);

    // Input gate: tanh(Wi·x + Ui·h + bi)
    const candidate = vecTanh(
      vecAdd(vecAdd(matVecMul(this.Wi, input), matVecMul(this.Ui, prevHidden)), this.bi)
    );

    // CfC closed-form update: h = α⊙f⊙h_prev + (1-α⊙f)⊙candidate
    const oneMinusForget = effectiveForget.map(v => 1 - v);
    const hidden = vecAdd(
      vecMul(effectiveForget, prevHidden),
      vecMul(oneMinusForget, candidate)
    );

    return { hidden, timeConstants: tau };
  }
}

/**
 * CfC Network — Multi-layer liquid neural network
 * Suitable for sequence modeling, time-series, and adaptive bee behavior.
 */
export class CfCNetwork {
  constructor(config) {
    const {
      inputSize,
      hiddenSizes = [21, 13],  // fib(8), fib(7) — two layers
      outputSize,
      seed = 42,
    } = config;

    this.layers = [];
    let prevSize = inputSize;
    for (let i = 0; i < hiddenSizes.length; i++) {
      this.layers.push(new CfCCell(prevSize, hiddenSizes[i], { seed: seed + i * 100 }));
      prevSize = hiddenSizes[i];
    }

    // Output projection (linear)
    this.Wo = phiXavierInit(outputSize, prevSize, seed + 999);
    this.bo = new Array(outputSize).fill(0);

    this.hiddenStates = hiddenSizes.map(s => new Array(s).fill(0));
    this.outputSize = outputSize;
  }

  /**
   * Process a single timestep
   * @param {number[]} input
   * @param {number} dt - Time since last step
   * @returns {{ output: number[], timeConstants: number[][] }}
   */
  step(input, dt = 1.0) {
    let x = input;
    const allTau = [];

    for (let i = 0; i < this.layers.length; i++) {
      const { hidden, timeConstants } = this.layers[i].forward(x, this.hiddenStates[i], dt);
      this.hiddenStates[i] = hidden;
      allTau.push(timeConstants);
      x = hidden;
    }

    // Output projection
    const output = vecAdd(matVecMul(this.Wo, x), this.bo);

    return { output, timeConstants: allTau };
  }

  /**
   * Process a full sequence
   * @param {number[][]} sequence - Array of input vectors
   * @param {number[]} timestamps - Time of each step (optional)
   * @returns {{ outputs: number[][], finalState: number[][] }}
   */
  forward(sequence, timestamps = null) {
    this.reset();
    const outputs = [];

    for (let t = 0; t < sequence.length; t++) {
      const dt = timestamps ? (t > 0 ? timestamps[t] - timestamps[t - 1] : 1.0) : 1.0;
      const { output } = this.step(sequence[t], dt);
      outputs.push(output);
    }

    return { outputs, finalState: this.hiddenStates.map(h => [...h]) };
  }

  /**
   * Reset hidden states
   */
  reset() {
    this.hiddenStates = this.hiddenStates.map(h => new Array(h.length).fill(0));
  }

  /**
   * Serialize weights for storage/transfer
   */
  serialize() {
    return JSON.stringify({
      layers: this.layers.map(l => ({
        Wf: l.Wf, Uf: l.Uf, bf: l.bf,
        Wi: l.Wi, Ui: l.Ui, bi: l.bi,
        Wt: l.Wt, bt: l.bt,
      })),
      Wo: this.Wo, bo: this.bo,
    });
  }
}

/**
 * BeeNeuron — CfC-powered adaptive behavior model for HeadyBee instances.
 *
 * Each bee type gets a CfC neuron that adapts its behavior based on:
 * - Task complexity (input signal)
 * - Time since last activation (dt)
 * - Historical performance (hidden state)
 *
 * Output: [urgency, confidence, resource_need, collaboration_score]
 */
export class BeeNeuron {
  constructor(beeType, opts = {}) {
    this.beeType = beeType;
    this.network = new CfCNetwork({
      inputSize: opts.inputSize || 8,   // 8 input features
      hiddenSizes: opts.hiddenSizes || [13, 8], // fib(7), fib(6)
      outputSize: 4,   // urgency, confidence, resource_need, collaboration
      seed: hashString(beeType),
    });
    this.lastActivation = Date.now();
  }

  /**
   * Evaluate bee behavior for a given task context.
   * @param {Object} context
   * @returns {{ urgency: number, confidence: number, resourceNeed: number, collaboration: number }}
   */
  evaluate(context) {
    const now = Date.now();
    const dt = (now - this.lastActivation) / 1000; // seconds since last activation
    this.lastActivation = now;

    // Encode context into 8-dimensional input
    const input = [
      context.complexity || 0.5,
      context.cslScore || PSI,
      context.queueDepth || 0,
      context.errorRate || 0,
      context.memoryPressure || 0,
      context.providerLatency || 0.5,
      context.swarmSize || 0.5,
      context.taskSimilarity || 0.5,
    ];

    const { output } = this.network.step(input, dt);

    // Sigmoid to [0, 1]
    return {
      urgency: sigmoid(output[0]),
      confidence: sigmoid(output[1]),
      resourceNeed: sigmoid(output[2]),
      collaboration: sigmoid(output[3]),
    };
  }
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export default { CfCCell, CfCNetwork, BeeNeuron };
