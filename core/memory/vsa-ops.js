/**
 * Heady™ VSA Operations — Hypervector Algebra for CSL
 * bind ⊗ (Hadamard product), bundle ⊕ (superposition), unbind, cleanup
 * Patent coverage: HS-058 (CSL Gates)
 * @module core/memory/vsa-ops
 */
import { PHI, PSI, FIB } from '../constants/phi.js';

export const VSA_DIM = 10000;

export function randomHV(dim = VSA_DIM) {
  const v = Float32Array.from({ length: dim }, () => (Math.random()+Math.random()+Math.random()-1.5)*0.8165);
  return normalizeHV(v);
}

export function normalizeHV(v) {
  let mag = 0;
  for (let i = 0; i < v.length; i++) mag += v[i]*v[i];
  mag = Math.sqrt(mag);
  if (mag < 1e-10) return v;
  return Float32Array.from(v, x => x/mag);
}

export function bind(a, b) {
  const result = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) result[i] = a[i]*b[i];
  return normalizeHV(result);
}

export function bundle(vectors) {
  const result = new Float32Array(vectors[0].length);
  for (const v of vectors) for (let i = 0; i < result.length; i++) result[i] += v[i];
  return normalizeHV(result);
}

export function unbind(bound, b) { return bind(bound, b); }

export function hvSimilarity(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]*b[i];
  return dot;
}

export class HeadyHVGraph {
  #conceptRegistry = new Map();
  #relationRegistry = new Map();
  #memory = new Map();

  encode(name) {
    if (!this.#conceptRegistry.has(name)) this.#conceptRegistry.set(name, randomHV());
    return this.#conceptRegistry.get(name);
  }

  role(name) {
    if (!this.#relationRegistry.has(name)) this.#relationRegistry.set(name, randomHV());
    return this.#relationRegistry.get(name);
  }

  store(entityName, roleName, valueName) {
    const pair = bind(this.role(roleName), this.encode(valueName));
    const existing = this.#memory.get(entityName);
    this.#memory.set(entityName, existing ? bundle([existing, pair]) : pair);
    return this;
  }

  query(entityName, roleName) {
    const entityHV = this.#memory.get(entityName);
    if (!entityHV) return null;
    const probe = unbind(entityHV, this.role(roleName));
    let best = null, bestSim = -1;
    for (const [name, hv] of this.#conceptRegistry) {
      const sim = hvSimilarity(probe, hv);
      if (sim > bestSim) { bestSim = sim; best = name; }
    }
    return { value: best, confidence: bestSim };
  }

  search(conceptName, topK = 5) {
    const queryHV = this.encode(conceptName);
    return [...this.#memory.entries()]
      .map(([name, hv]) => ({ name, similarity: hvSimilarity(queryHV, hv) }))
      .sort((a,b) => b.similarity-a.similarity).slice(0, topK);
  }
}
