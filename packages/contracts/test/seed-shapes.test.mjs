// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ seed-shapes tests — ADR-0032 Field / agent-wave contract   ║
// ║  Proves the Seed validator enforces temporary·localized·bounded·    ║
// ║  purposeful, and the wave lifecycle is forward-only with collapse    ║
// ║  reachable from any live state. © 2026 HeadySystems Inc.            ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSeed, isLegalWaveTransition, WAVE_STATES, SEED_ORIGINS } from "../src/seed-shapes.mjs";

const ok = {
  schema: "seed.v1", id: "embed-corpus-sweep", intention: "re-embed changed docs into the Field",
  context_ref: "trace:abc123", scope: ["packages/embedding", "docs"], amplitude: 1.618, ttl_ms: 29034,
  origin: "schedule",
};

test("accepts a well-formed seed (with and without a parent wave)", () => {
  assert.equal(validateSeed(ok).ok, true);
  assert.equal(validateSeed({ ...ok, parent_wave: "wave:root" }).ok, true);
});

test("enforces the Field law — purposeful, localized, bounded, temporary", () => {
  assert.equal(validateSeed(null).ok, false);
  assert.equal(validateSeed({ ...ok, schema: "x" }).ok, false);
  assert.equal(validateSeed({ ...ok, id: "Not_Kebab" }).ok, false);
  const noWhy = { ...ok }; delete noWhy.intention;
  assert.equal(validateSeed(noWhy).ok, false);                       // no purpose
  const noLocal = { ...ok }; delete noLocal.context_ref;
  assert.equal(validateSeed(noLocal).ok, false);                     // not localized
  assert.equal(validateSeed({ ...ok, scope: [] }).ok, false);        // no locality bound
  assert.equal(validateSeed({ ...ok, amplitude: 0 }).ok, false);     // unbounded budget
  assert.equal(validateSeed({ ...ok, amplitude: -1 }).ok, false);
  assert.equal(validateSeed({ ...ok, ttl_ms: 0 }).ok, false);        // not temporary
  assert.equal(validateSeed({ ...ok, ttl_ms: 1.5 }).ok, false);      // must be integer ms
  assert.equal(validateSeed({ ...ok, origin: "cosmos" }).ok, false); // unknown origin
  assert.equal(validateSeed({ ...ok, rogue: 1 }).ok, false);         // strict: unknown field
});

test("wave lifecycle is forward-only; collapse reachable from any live state; terminals are dead", () => {
  assert.equal(isLegalWaveTransition("seeded", "localizing"), true);
  assert.equal(isLegalWaveTransition("localizing", "exciting"), true);
  assert.equal(isLegalWaveTransition("exciting", "writing_back"), true);
  assert.equal(isLegalWaveTransition("writing_back", "dissolved"), true);
  // collapse (abort) from any live state
  for (const s of ["seeded", "localizing", "exciting", "writing_back"]) {
    assert.equal(isLegalWaveTransition(s, "collapsed"), true, `${s}→collapsed`);
  }
  // no going backward, no skipping, no resurrecting a terminal wave
  assert.equal(isLegalWaveTransition("exciting", "seeded"), false);
  assert.equal(isLegalWaveTransition("seeded", "exciting"), false);
  assert.equal(isLegalWaveTransition("dissolved", "seeded"), false);
  assert.equal(isLegalWaveTransition("dissolved", "localizing"), false);
  assert.equal(isLegalWaveTransition("collapsed", "localizing"), false);
  assert.equal(isLegalWaveTransition("bogus", "localizing"), false);
});

test("enums are frozen and complete", () => {
  assert.deepEqual([...WAVE_STATES], ["seeded", "localizing", "exciting", "writing_back", "dissolved", "collapsed"]);
  assert.deepEqual([...SEED_ORIGINS], ["founder", "flash", "agent", "schedule", "external"]);
  assert.throws(() => { WAVE_STATES.push("x"); });
});
