// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Digital Twin v1.0.0 — 384D entity twins & what-if sim     ║
// ║  Deterministic embeddings · φ-decay behavior · perturbation drift ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Public-domain vector math: a "twin" is a deterministic 384D embedding of an
// entity (seeded by SHA-256 of its id), with φ-scaled preference weights,
// φ-weighted behavioral decay, cosine similarity, and what-if perturbation
// simulation (drift / coherence / risk). Ported from the legacy
// heady-digital-twin-service into rebuild conventions: pure functions, no IO,
// deterministic — fully unit-testable. Vector primitives are consumed from
// @heady/csl-engine (DIM/cosine/normalize); constants from @heady/phi-math.
//
// PATENT BOUNDARY (ARBITER, ADR-0045 — mirrors ADR-0040): the legacy service
// banded scores into CSL verdicts (SAFE/REVIEW/BLOCK; DUPLICATE/SIMILAR/…) — that
// φ-banded gate is HS-2026-058 and is NOT embodied here. `simulate` and
// `twinSimilarity` return RAW metrics; band them downstream with
// `@heady/csl-engine`'s `cslGate` — never re-derive the gate in this package.
//
// STORAGE GUARD (ADR-0015, ARBITER cond. 7): a twin `embedding` is a *synthetic*
// SHA-256-seeded pseudo-vector, NOT a `bge-small-en-v1.5` retrieval embedding. It MUST
// NOT be written into the canonical pgvector retrieval index or commingled with real
// embeddings — doing so would silently poison retrieval. Keep twin vectors in a
// separate, clearly-typed store.

import { createHash } from "node:crypto";
import { PHI, PSI, FIB } from "@heady/phi-math";
import { DIM, cosineSimilarity, normalize } from "@heady/csl-engine";

// φ-derived scales (no magic numbers).
const INIT_AMPLITUDE = 2 * PSI;         // seed embedding spread
const BEHAVIOR_PERTURB = PSI ** 9;      // ≈0.0132 — embedding shift per behavior unit
const SIM_PERTURB = PSI ** 6;           // ≈0.0557 — what-if perturbation scale
const BEHAVIOR_WEIGHT_FLOOR = PSI ** 5; // ≈0.09  — minimum decayed weight
const DECAY_HALFLIFE_SEC = FIB[10];     // 55 — φ/Fibonacci decay window

function sha256Bytes(s) {
  return createHash("sha256").update(String(s)).digest();
}
function md5Bytes(s) {
  return createHash("md5").update(String(s)).digest();
}
function assertTwin(t) {
  if (!t || !Array.isArray(t.embedding) || t.embedding.length !== DIM) {
    throw new TypeError("digital-twin: expected a twin created via createTwin()");
  }
}

/**
 * Create a deterministic digital twin of an entity. Pure — same `entityId` +
 * `profile` always yield the same twin (embedding seeded by SHA-256 of the id).
 *
 * @param {string} entityId
 * @param {{ type?: string, behaviors?: Record<string,number>, preferences?: Record<string,unknown>, at?: number }} [profile]
 * @returns {{ id:string, entityId:string, entityType:string, embedding:number[], preferenceWeights:number[], behaviors:Record<string,{value:number,weight:number,at:number}>, preferences:Record<string,unknown> }}
 */
export function createTwin(entityId, profile = {}) {
  if (typeof entityId !== "string" || entityId.length === 0) {
    throw new TypeError("digital-twin: entityId must be a non-empty string");
  }
  const seed = sha256Bytes(entityId);
  const id = `twin_${seed.toString("hex").slice(0, 12)}`;

  const raw = new Array(DIM);
  const preferenceWeights = new Array(DIM);
  for (let i = 0; i < DIM; i++) {
    raw[i] = (seed[i % seed.length] / 255 - 0.5) * INIT_AMPLITUDE;
    const band = i % FIB.length;
    preferenceWeights[i] = PHI ** (-band / FIB.length) * PSI;
  }
  const embedding = normalize(raw);

  const at = typeof profile.at === "number" ? profile.at : 0;
  const behaviors = {};
  for (const [k, v] of Object.entries(profile.behaviors ?? {})) {
    behaviors[k] = { value: Number(v), weight: 1, at };
  }
  return {
    id,
    entityId,
    entityType: profile.type ?? "user",
    embedding,
    preferenceWeights,
    behaviors,
    preferences: { ...(profile.preferences ?? {}) },
  };
}

/**
 * Apply a behavioral observation, φ-decaying the prior weight by elapsed time and
 * perturbing the embedding along the behavior's deterministic direction. Pure —
 * returns a new twin; the input is untouched. Deterministic given `now`.
 *
 * @param {object} twin
 * @param {string} key
 * @param {number} value
 * @param {{ now?: number }} [opts] - logical time (ms) for decay; default 0 (no decay)
 * @returns {object} new twin
 */
export function updateBehavior(twin, key, value, opts = {}) {
  assertTwin(twin);
  if (typeof key !== "string" || key.length === 0) throw new TypeError("digital-twin: key must be a non-empty string");
  if (typeof value !== "number") throw new TypeError("digital-twin: value must be a number");
  const now = typeof opts.now === "number" ? opts.now : 0;

  const prior = twin.behaviors[key];
  const elapsedSec = prior ? Math.max(0, (now - prior.at) / 1000) : 0;
  const decayed = prior ? prior.weight * PSI ** (elapsedSec / DECAY_HALFLIFE_SEC) : 1;
  const weight = Math.max(decayed, BEHAVIOR_WEIGHT_FLOOR);

  const hash = md5Bytes(key);
  const next = twin.embedding.slice();
  for (let i = 0; i < DIM; i++) {
    const delta = (hash[i % hash.length] / 255 - 0.5) * BEHAVIOR_PERTURB * value;
    next[i] += delta * twin.preferenceWeights[i];
  }
  return {
    ...twin,
    embedding: normalize(next),
    behaviors: { ...twin.behaviors, [key]: { value, weight, at: now } },
  };
}

/**
 * Cosine similarity of two twins' embeddings. RAW metric in [-1,1]; band it into a
 * verdict (DUPLICATE/SIMILAR/…) downstream with `@heady/csl-engine.cslGate` — not here.
 * @returns {number}
 */
export function twinSimilarity(a, b) {
  assertTwin(a);
  assertTwin(b);
  return cosineSimilarity(a.embedding, b.embedding);
}

/**
 * What-if simulation: apply scenario perturbations to a copy of the twin's embedding
 * and measure divergence. Pure. Returns RAW metrics only (no SAFE/REVIEW/BLOCK gate —
 * band `coherence` downstream via `@heady/csl-engine.cslGate`).
 *
 * @param {object} twin
 * @param {{ name?: string, perturbations?: Record<string, number> }} [scenario]
 * @returns {{ scenario:string, drift:number, coherence:number, risk:number, embeddingDelta:number, perturbationCount:number }}
 */
export function simulate(twin, scenario = {}) {
  assertTwin(twin);
  const perturbations = scenario.perturbations ?? {};
  const sim = twin.embedding.slice();
  for (const [key, magnitude] of Object.entries(perturbations)) {
    if (typeof magnitude !== "number") throw new TypeError(`digital-twin: perturbation "${key}" must be a number`);
    const hash = md5Bytes(key);
    for (let i = 0; i < DIM; i++) {
      sim[i] += (hash[i % hash.length] / 255 - 0.5) * magnitude * SIM_PERTURB;
    }
  }
  const simNorm = normalize(sim);
  const drift = 1 - cosineSimilarity(twin.embedding, simNorm);
  const coherence = 1 / (1 + drift * PHI);
  const risk = drift * PHI;
  let sq = 0;
  for (let i = 0; i < DIM; i++) sq += (simNorm[i] - twin.embedding[i]) ** 2;
  return {
    scenario: scenario.name ?? "unnamed",
    drift,
    coherence,
    risk,
    embeddingDelta: Math.sqrt(sq),
    perturbationCount: Object.keys(perturbations).length,
  };
}
