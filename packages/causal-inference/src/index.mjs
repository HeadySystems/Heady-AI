// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Causal Inference v1.0.0 — Pearl SCM / do-calculus         ║
// ║  Structural causal models · do-operator · counterfactuals · MC    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Public-domain causal inference (Judea Pearl's Ladder of Causation): structural
// causal models, the do-operator (intervention by parent-severing + topological
// propagation), 3-step counterfactuals (abduction → action → prediction), and
// seeded Monte-Carlo. This math is NOT Heady IP and is deliberately NOT patent-
// locked (ADR-0040). Ported from services/heady-causal-inference-service (legacy)
// into rebuild conventions: pure functions, no IO, deterministic — so it is fully
// unit-testable. Constants derive from @heady/phi-math (no magic numbers).
//
// PATENT BOUNDARY (ARBITER, ADR-0040): the legacy `/pipeline/assess` CSL φ-banded
// stage-gate re-embodies HS-2026-058 and is DEFERRED from this package. When added,
// it MUST delegate to `@heady/csl-engine`'s exported `cslGate` — never re-derive the
// gate here — and its call site carries an HS-058 / HCP-0002 reference.

import { PHI, PSI } from "@heady/phi-math";

/** Default Monte-Carlo sample count — Fibonacci(12), no magic number. */
export const DEFAULT_SIMULATIONS = 144;
/** Default intervention noise scale — φ-derived (PSI⁵ ≈ 0.09). */
export const DEFAULT_NOISE_SCALE = PSI ** 5;
/** Default deterministic seed (φ-derived) so results are reproducible without a caller seed. */
export const DEFAULT_SEED = 1618033;

// ─── Guards ────────────────────────────────────────────────────────────────────
function assertModel(model) {
  if (!model || !(model.nodes instanceof Map)) {
    throw new TypeError("causal: expected a model created via createModel()");
  }
}

function assertPlainObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`causal: ${label} must be a plain object`);
  }
}

// ─── Model construction ──────────────────────────────────────────────────────
/**
 * Build a structural causal model (SCM) from a declarative spec. Pure — returns a
 * fresh model; does not mutate the spec. Each node's `mechanism(parentValues)` maps
 * its parents' values to its own; the default is a φ-damped linear sum (sum · PSI).
 *
 * @param {{ nodes: Array<{ id: string, parents?: string[], mechanism?: (parentValues:number[])=>number, initialValue?: number }> }} spec
 * @returns {{ nodes: Map<string, {id:string,parents:string[],mechanism:Function,value:number}>, edges: Array<{from:string,to:string}> }}
 */
export function createModel(spec) {
  assertPlainObject(spec, "spec");
  if (!Array.isArray(spec.nodes)) throw new TypeError("causal: spec.nodes must be an array");

  const nodes = new Map();
  const edges = [];
  for (const nodeSpec of spec.nodes) {
    assertPlainObject(nodeSpec, "node spec");
    if (typeof nodeSpec.id !== "string" || nodeSpec.id.length === 0) {
      throw new TypeError("causal: every node needs a non-empty string id");
    }
    const parents = Array.isArray(nodeSpec.parents) ? [...nodeSpec.parents] : [];
    const mechanism =
      typeof nodeSpec.mechanism === "function"
        ? nodeSpec.mechanism
        : (parentValues) => parentValues.reduce((s, v) => s + v, 0) * PSI;
    nodes.set(nodeSpec.id, {
      id: nodeSpec.id,
      parents,
      mechanism,
      value: typeof nodeSpec.initialValue === "number" ? nodeSpec.initialValue : 0,
    });
    for (const parent of parents) edges.push({ from: parent, to: nodeSpec.id });
  }
  // Validate that every referenced parent exists (fail-closed, no dangling edges).
  for (const { from, to } of edges) {
    if (!nodes.has(from)) throw new RangeError(`causal: node "${to}" references unknown parent "${from}"`);
  }
  return { nodes, edges };
}

// ─── Topological order ───────────────────────────────────────────────────────
/**
 * Return node ids in topological (parents-before-children) order. Throws on cycles —
 * an SCM must be a DAG.
 * @param {Map<string, {parents:string[]}>} nodes
 * @returns {string[]}
 */
export function topologicalSort(nodes) {
  const visited = new Set();
  const onStack = new Set();
  const order = [];
  const visit = (id) => {
    if (visited.has(id)) return;
    if (onStack.has(id)) throw new RangeError(`causal: cycle detected at node "${id}" — SCM must be a DAG`);
    onStack.add(id);
    const node = nodes.get(id);
    if (node) for (const parent of node.parents) visit(parent);
    onStack.delete(id);
    visited.add(id);
    order.push(id);
  };
  for (const id of nodes.keys()) visit(id);
  return order;
}

// ─── do-operator ─────────────────────────────────────────────────────────────
/**
 * Pearl's do-operator: force each intervened node to a fixed value, sever its
 * incoming arrows, then forward-propagate mechanisms in topological order. Pure —
 * clones the model's node values; the input model is untouched.
 *
 * @param {object} model - a model from createModel()
 * @param {Record<string, number>} interventions - nodeId → forced value
 * @returns {Record<string, number>} post-intervention value of every node
 */
export function intervene(model, interventions = {}) {
  assertModel(model);
  assertPlainObject(interventions, "interventions");

  const cloned = new Map();
  for (const [id, node] of model.nodes) {
    cloned.set(id, { ...node, parents: [...node.parents] });
  }
  for (const [nodeId, value] of Object.entries(interventions)) {
    const node = cloned.get(nodeId);
    if (!node) throw new RangeError(`causal: intervention targets unknown node "${nodeId}"`);
    if (typeof value !== "number") throw new TypeError(`causal: intervention on "${nodeId}" must be a number`);
    node.parents = []; // sever incoming arrows (the "do" operator)
    node.value = value;
  }
  for (const id of topologicalSort(cloned)) {
    if (id in interventions) continue;
    const node = cloned.get(id);
    const parentValues = node.parents.map((pid) => cloned.get(pid)?.value ?? 0);
    node.value = node.mechanism(parentValues);
  }
  const result = {};
  for (const [id, node] of cloned) result[id] = node.value;
  return result;
}

// ─── Counterfactuals ─────────────────────────────────────────────────────────
/**
 * Three-step counterfactual ("what would Y have been had X been x'?"):
 * abduction (seed observed factual values) → action (apply the do-intervention) →
 * prediction (delta vs factual). Pure — does not mutate the model.
 *
 * @param {object} model
 * @param {Record<string, number>} factual - observed values
 * @param {Record<string, number>} intervention - counterfactual do()
 * @returns {{ counterfactualState: Record<string, number>, deltas: Record<string, {factual:number,counterfactual:number,delta:number}> }}
 */
export function counterfactual(model, factual, intervention) {
  assertModel(model);
  assertPlainObject(factual, "factual");
  assertPlainObject(intervention, "intervention");

  // Abduction: build a model whose node values are seeded from the factual world.
  const seeded = {
    nodes: new Map(),
    edges: model.edges.map((e) => ({ ...e })),
  };
  for (const [id, node] of model.nodes) {
    const value = typeof factual[id] === "number" ? factual[id] : node.value;
    seeded.nodes.set(id, { ...node, parents: [...node.parents], value });
  }
  // Action + prediction.
  const counterfactualState = intervene(seeded, intervention);
  const deltas = {};
  for (const [id, cfValue] of Object.entries(counterfactualState)) {
    const factualValue = typeof factual[id] === "number" ? factual[id] : 0;
    deltas[id] = { factual: factualValue, counterfactual: cfValue, delta: cfValue - factualValue };
  }
  return { counterfactualState, deltas };
}

// ─── Deterministic RNG (mulberry32) ──────────────────────────────────────────
/**
 * Seeded PRNG so Monte-Carlo runs are reproducible (Heady determinism rule: same
 * inputs + seed → same output). Returns a function producing floats in [0, 1).
 * @param {number} seed
 * @returns {() => number}
 */
export function seededRandom(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Monte-Carlo ─────────────────────────────────────────────────────────────
/**
 * Estimate outcome distributions by running N interventions with Box-Muller
 * Gaussian noise added to the intervention values. Seeded → deterministic. Pure.
 *
 * @param {object} model
 * @param {Record<string, number>} interventions
 * @param {{ simulations?: number, noiseScale?: number, seed?: number }} [options]
 * @returns {{ simulations:number, seed:number, stats: Record<string, {mean:number,stdDev:number,min:number,max:number,p5:number,p95:number,confidence:'high'|'medium'|'low'}> }}
 */
export function monteCarloSimulate(model, interventions, options = {}) {
  assertModel(model);
  assertPlainObject(interventions, "interventions");
  const simulations = Number.isInteger(options.simulations) && options.simulations > 0 ? options.simulations : DEFAULT_SIMULATIONS;
  const noiseScale = typeof options.noiseScale === "number" ? options.noiseScale : DEFAULT_NOISE_SCALE;
  const seed = Number.isInteger(options.seed) ? options.seed : DEFAULT_SEED;
  const rng = seededRandom(seed);

  const runs = [];
  for (let i = 0; i < simulations; i++) {
    const noisy = {};
    for (const [k, v] of Object.entries(interventions)) {
      const u1 = rng() || Number.EPSILON;
      const u2 = rng();
      const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      noisy[k] = v + gaussian * noiseScale;
    }
    runs.push(intervene(model, noisy));
  }

  const stats = {};
  for (const id of model.nodes.keys()) {
    const values = runs.map((r) => r[id] ?? 0).sort((a, b) => a - b);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    stats[id] = {
      mean,
      stdDev: Math.sqrt(variance),
      min: values[0],
      max: values[values.length - 1],
      p5: values[Math.floor(values.length * PSI ** 6)], // ≈ 5.5th percentile, φ-derived
      p95: values[Math.min(values.length - 1, Math.floor(values.length * (1 - PSI ** 6)))],
      confidence: variance < PSI ? "high" : variance < PHI ? "medium" : "low",
    };
  }
  return { simulations, seed, stats };
}
