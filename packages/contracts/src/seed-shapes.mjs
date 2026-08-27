// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Seed & Agent-Wave shapes — ADR-0032 (the Field model)       ║
// ║  A Seed is a bounded initial condition dropped into the durable     ║
// ║  Field (event log + pgvector SoR) that spawns ONE agent-wave: a     ║
// ║  temporary, localized excitation that reads a region, excites it    ║
// ║  (CSL), writes its effect back, and dissolves. This contract makes  ║
// ║  "temporary · localized · bounded · purposeful" machine-checkable   ║
// ║  at the boundary. Magnitudes (φ-scaled ceilings) are applied by the ║
// ║  executor via @heady/phi-math; this contract enforces the SHAPE.    ║
// ║  Strict, dependency-free — the facts-schema / projection-shapes     ║
// ║  idiom. Made with ❤️ by HeadySystems Inc.                          ║
// ╚══════════════════════════════════════════════════════════════════╝

/** Where a seed came from — the boundary condition's origin. */
export const SEED_ORIGINS = Object.freeze(["founder", "flash", "agent", "schedule", "external"]);

/** The agent-wave lifecycle (ADR-0032 §3). A wave is temporary: forward-only,
 *  and it may collapse (abort) from any live state. `dissolved`/`collapsed` are terminal. */
export const WAVE_STATES = Object.freeze([
  "seeded", "localizing", "exciting", "writing_back", "dissolved", "collapsed",
]);

const WAVE_TRANSITIONS = Object.freeze({
  seeded: ["localizing", "collapsed"],
  localizing: ["exciting", "collapsed"],
  exciting: ["writing_back", "collapsed"],
  writing_back: ["dissolved", "collapsed"],
  dissolved: [],
  collapsed: [],
});

const isStr = (v) => typeof v === "string" && v.length > 0;
const isFinitePos = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
const push = (errors, msg) => { errors.push(msg); return false; };

function noUnknown(obj, known, errors, where) {
  for (const k of Object.keys(obj)) {
    if (!known.includes(k)) push(errors, `${where}: unknown field "${k}" (strict contract)`);
  }
}

/**
 * Validate a Seed (ADR-0032 §2). Required: schema, id, intention, context_ref, scope,
 * amplitude, ttl_ms, origin. Optional: parent_wave (a wave may seed another — branching/
 * superposition). Encodes the Field law: a wave must be purposeful (intention), localized
 * (context_ref + non-empty scope), bounded (finite-positive amplitude + ttl_ms), and temporary
 * (ttl_ms is required — nothing persists in the wave, only its effect on the Field).
 * @returns {{ok:boolean, errors:string[]}}
 */
export function validateSeed(seed) {
  const errors = [];
  if (!seed || typeof seed !== "object" || Array.isArray(seed)) return { ok: false, errors: ["seed must be an object"] };
  noUnknown(seed, ["schema", "id", "intention", "context_ref", "scope", "amplitude", "ttl_ms", "origin", "parent_wave"], errors, `seed ${seed.id ?? "?"}`);
  if (seed.schema !== "seed.v1") push(errors, `seed.schema must be "seed.v1"`);
  if (!isStr(seed.id) || !/^[a-z0-9][a-z0-9-]*$/.test(seed.id)) push(errors, "seed.id must be kebab-case");
  if (!isStr(seed.intention)) push(errors, `seed ${seed.id}: intention required (the why)`);
  if (!isStr(seed.context_ref)) push(errors, `seed ${seed.id}: context_ref required (localizes the wave on the Field)`);
  if (!Array.isArray(seed.scope) || seed.scope.length === 0 || seed.scope.some((s) => !isStr(s))) {
    push(errors, `seed ${seed.id}: scope must be a non-empty array of strings (the wave's locality bound)`);
  }
  if (!isFinitePos(seed.amplitude)) push(errors, `seed ${seed.id}: amplitude must be a finite positive number (resource budget)`);
  if (!(Number.isInteger(seed.ttl_ms) && seed.ttl_ms > 0)) push(errors, `seed ${seed.id}: ttl_ms must be a positive integer (waves are temporary by law)`);
  if (!SEED_ORIGINS.includes(seed.origin)) push(errors, `seed ${seed.id}: origin must be ${SEED_ORIGINS.join("|")}`);
  if (seed.parent_wave !== undefined && !isStr(seed.parent_wave)) push(errors, `seed ${seed.id}: parent_wave must be a string when present`);
  return { ok: errors.length === 0, errors };
}

/**
 * Is an agent-wave lifecycle transition legal? Forward-only (a wave is temporary; it never
 * runs backward), with `collapsed` reachable from any live state (ADR-0032 §3). @returns {boolean}
 */
export function isLegalWaveTransition(from, to) {
  if (!WAVE_STATES.includes(from) || !WAVE_STATES.includes(to)) return false;
  return (WAVE_TRANSITIONS[from] ?? []).includes(to);
}
