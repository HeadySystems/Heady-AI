// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Law-Coverage tests — node:test, zero deps                 ║
// ║  Proves the "no toothless law" gate: enforcer membership, the       ║
// ║  downgrade ratchet, AGENTS.md contiguity, advisory surfacing.       ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";

import { validateLawRegistry, checkLaws } from "../src/laws.mjs";

// A minimal, self-consistent registry: two enforced (one lib, one module) covering
// the toy lib, one advisory, contiguous agents_md 1..2.
const LIB = ["console", "localhost"];
const okRegistry = () => ({
  schema: "laws.v1",
  laws: [
    { id: "no-console", agents_md: 1, statement: "no console", tier: "enforced", enforcer: { lib: true, ruleIds: ["console"] } },
    { id: "no-localhost", agents_md: 2, statement: "no localhost", tier: "enforced", enforcer: { lib: true, ruleIds: ["localhost"] } },
    { id: "brand", agents_md: null, statement: "brand header", tier: "enforced", enforcer: { module: "tooling/law-lint/src/law-lint.mjs", ruleId: "brand" } },
    { id: "zod", agents_md: null, statement: "zod validation", tier: "advisory", enforcer: null },
  ],
  known_defects: [{ id: "hook-fork", surface: ".claude/hooks/heady-rules.mjs", status: "open" }],
});
const modExists = () => true;
const run = (reg, opts = {}) => checkLaws({ registry: reg, libRuleIds: LIB, moduleExists: modExists, ...opts });
const errs = (findings) => findings.filter((f) => f.tier === "error");

test("validateLawRegistry accepts a well-formed registry", () => {
  const { ok, errors } = validateLawRegistry(okRegistry());
  assert.equal(ok, true, errors.join("; "));
});

test("validateLawRegistry rejects bad schema / empty / bad tier / enforced-without-enforcer", () => {
  assert.match(validateLawRegistry({ schema: "x", laws: [{ id: "a", statement: "b", tier: "advisory" }] }).errors.join(" "), /schema must be/);
  assert.match(validateLawRegistry({ schema: "laws.v1", laws: [] }).errors.join(" "), /non-empty array/);
  assert.match(validateLawRegistry({ schema: "laws.v1", laws: [{ id: "a", statement: "b", tier: "maybe" }] }).errors.join(" "), /tier must be one of/);
  assert.match(validateLawRegistry({ schema: "laws.v1", laws: [{ id: "a", statement: "b", tier: "enforced" }] }).errors.join(" "), /declares no enforcer/);
});

test("a self-consistent registry is clean; advisory + defect surface as info", () => {
  const findings = run(okRegistry());
  assert.equal(errs(findings).length, 0, JSON.stringify(errs(findings)));
  assert.ok(findings.some((f) => f.id === "LAW-advisory"));
  assert.ok(findings.some((f) => f.id === "LAW-defect"));
});

test("LAW-enforcer-missing: enforced law claims a canonical rule id that does not exist", () => {
  const reg = okRegistry();
  reg.laws[0].enforcer.ruleIds = ["console", "ghost-rule"];
  assert.ok(errs(run(reg)).some((f) => f.id === "LAW-enforcer-missing" && f.evidence.ruleId === "ghost-rule"));
});

test("LAW-enforcer-missing: enforced law maps to a module that does not exist", () => {
  assert.ok(errs(checkLaws({ registry: okRegistry(), libRuleIds: LIB, moduleExists: () => false })).some((f) => f.id === "LAW-enforcer-missing"));
});

test("LAW-downgrade ratchet: a canonical rule not claimed by any enforced law fails closed", () => {
  const reg = okRegistry();
  // demote no-localhost to advisory → 'localhost' becomes unclaimed → ratchet fires
  reg.laws[1] = { id: "no-localhost", agents_md: 2, statement: "x", tier: "advisory", enforcer: null };
  assert.ok(errs(run(reg)).some((f) => f.id === "LAW-downgrade" && f.evidence.ruleId === "localhost"));
});

test("LAW-uncovered: a gap in AGENTS.md rule numbers fails closed", () => {
  const reg = okRegistry();
  reg.laws.push({ id: "r4", agents_md: 4, statement: "x", tier: "advisory", enforcer: null }); // 1,2,4 → 3 missing
  assert.ok(errs(run(reg)).some((f) => f.id === "LAW-uncovered" && f.evidence.rule === 3));
});

test("LAW-registry fires when the registry is missing", () => {
  assert.ok(checkLaws({ registry: null, libRuleIds: LIB, moduleExists: modExists }).some((f) => f.id === "LAW-registry"));
});
