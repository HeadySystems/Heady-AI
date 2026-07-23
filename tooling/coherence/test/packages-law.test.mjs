// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Package-Law tests — the gates are not no-ops               ║
// ║  Proves C-framework FLAGS Vue/Angular deps (dependencies AND dev)   ║
// ║  and ignores allowed stacks; TEST-missing errors on substrate       ║
// ║  members and downgrades apps to INFO. © 2026 HeadySystems Inc.     ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkFrameworks, checkTestsAlongside, checkMerkleTrigger, FORBIDDEN_FRAMEWORKS } from "../src/packages-law.mjs";

test("C-framework FLAGS vue, @vue/*, angular, @angular/* in deps or devDeps", () => {
  const findings = checkFrameworks([
    { path: "apps/x/package.json", dependencies: { vue: "^3.0.0" } },
    { path: "apps/y/package.json", devDependencies: { "@angular/core": "^17.0.0" } },
    { path: "packages/z/package.json", dependencies: { "@vue/reactivity": "^3.0.0", angular: "1.8.0" } },
  ]);
  assert.equal(findings.length, 4);
  assert.ok(findings.every((f) => f.id === "C-framework" && f.tier === "error"));
});

test("C-framework IGNORES the allowed stack (vanilla WC, vite, react-for-canvas, lit-adjacent names)", () => {
  const findings = checkFrameworks([
    { path: "apps/portal/package.json", dependencies: { vite: "^6.0.0", react: "^19.0.0" } },
    { path: "packages/a/package.json", dependencies: { "vue-like-thing": "1.0.0", angularjs2react: "1.0.0" } },
    { path: "packages/b/package.json" },
  ]);
  assert.equal(findings.length, 0);
  assert.ok(!FORBIDDEN_FRAMEWORKS.some((re) => re.test("revue")), "substring names must not match");
});

test("TEST-missing errors on substrate members, INFO on apps, silent when covered", () => {
  const findings = checkTestsAlongside([
    { dir: "phi-math", scope: "packages", hasTestFile: true },
    { dir: "no-tests-lib", scope: "packages", hasTestFile: false },
    { dir: "no-tests-tool", scope: "tooling", hasTestFile: false },
    { dir: "cms", scope: "apps", hasTestFile: false },
  ]);
  const errors = findings.filter((f) => f.tier === "error");
  const infos = findings.filter((f) => f.tier === "info");
  assert.deepEqual(errors.map((f) => f.evidence.member).sort(), ["packages/no-tests-lib", "tooling/no-tests-tool"]);
  assert.equal(infos.length, 1);
  assert.equal(infos[0].id, "TEST-missing-app");
});

test("empty / missing input yields no findings (never a false exit-2)", () => {
  assert.equal(checkFrameworks(null).length, 0);
  assert.equal(checkTestsAlongside(undefined).length, 0);
});

test("LAW11: silent when the Merkle planner is wired and the file path is CDC-free", () => {
  assert.equal(checkMerkleTrigger({ plannerImported: true, cdcHits: [] }).length, 0);
});

test("LAW11: FLAGS a de-wired Merkle planner and any CDC machinery in the file path", () => {
  const gone = checkMerkleTrigger({ plannerImported: false, cdcHits: [] });
  assert.equal(gone.length, 1);
  assert.equal(gone[0].id, "LAW11-merkle-trigger");
  assert.equal(gone[0].tier, "error");

  const cdc = checkMerkleTrigger({
    plannerImported: true,
    cdcHits: [{ line: "packages/embedding/src/x.mjs:3:import replication from 'pg-logical-replication'" }],
  });
  assert.equal(cdc.length, 1);
  assert.equal(cdc[0].id, "LAW11-cdc-in-file-path");
  assert.equal(cdc[0].tier, "error");
});
