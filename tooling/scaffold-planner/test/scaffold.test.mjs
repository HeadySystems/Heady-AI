// Unit tests for the scaffold-planner core + the real configs/scaffold-plan.json. `node --test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { flattenBuild, applyDecisions, setDecision, summarize, verifyPlan, DECISIONS } from "../src/core.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const plan = JSON.parse(readFileSync(join(REPO_ROOT, "configs", "scaffold-plan.json"), "utf8"));

test("both interfaces exist: Heady-V1 (legacy) and Heady-AI (rebuild)", () => {
  assert.equal(plan.builds["heady-v1"].kind, "legacy");
  assert.equal(plan.builds["heady-ai"].kind, "rebuild");
});

test("flattenBuild normalizes phased (ai) and flat (v1) shapes uniformly", () => {
  const ai = flattenBuild(plan, "heady-ai");
  assert.ok(ai.rows.length > 0);
  assert.ok(ai.rows.every((r) => r.id && r.title && r.group));
  const v1 = flattenBuild(plan, "heady-v1");
  assert.ok(v1.rows.every((r) => r.group === "Legacy layer"));
  assert.throws(() => flattenBuild(plan, "nope"), /unknown build/);
});

test("decision overlay applies and never mutates the plan source", () => {
  const { rows } = flattenBuild(plan, "heady-ai");
  const id = rows[0].id;
  const overlay = setDecision({}, id, "accepted", "looks good", "2026-06-16T00:00:00Z");
  const decorated = applyDecisions(rows, overlay);
  assert.equal(decorated.find((r) => r.id === id).decision, "accepted");
  assert.equal(decorated.find((r) => r.id === id).note, "looks good");
  assert.equal(rows.find((r) => r.id === id).decision, undefined, "source rows untouched");
  assert.throws(() => setDecision({}, id, "bogus", null, "t"), /invalid decision/);
});

test("summarize counts by decision and by state", () => {
  const { rows } = flattenBuild(plan, "heady-ai");
  const s = summarize(applyDecisions(rows, {}));
  assert.equal(s.total, rows.length);
  assert.equal(s.byDecision.pending, rows.length, "all pending before any decision");
  assert.ok(s.byState.done >= 1, "some options are already done");
});

test("verifyPlan flags drift — and the real plan has no id collisions", () => {
  const real = verifyPlan(plan, (rel) => existsSync(join(REPO_ROOT, rel)));
  assert.equal(real.findings.some((f) => f.level === "error"), false, "no duplicate ids in the shipped plan");
  // Synthetic drift: a done @heady/ package that doesn't exist → a warn.
  const drift = { builds: { x: { id: "x", phases: [{ id: "p", label: "P", options: [{ id: "o1", title: "@heady/ghost", status: "done" }] }] } } };
  const r = verifyPlan(drift, () => false);
  assert.ok(r.findings.some((f) => f.id === "o1" && /drift/.test(f.message)));
});

test("DECISIONS enum is the four interactive states", () => {
  assert.deepEqual([...DECISIONS], ["pending", "accepted", "deferred", "replan"]);
});
