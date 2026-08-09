// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Scalar-Guard tests — node:test, zero deps                  ║
// ║  Proves the C-scalar contract on grep-shaped lines: drift fires,    ║
// ║  canonical values pass, allow markers are word-bounded (a helper    ║
// ║  named drift() never exempts), path exemptions scope vision/test    ║
// ║  surfaces, path digits are never extracted, lowered ceilings and    ║
// ║  wrong stage counts are caught.                                     ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";

import { SCALAR_GUARDS, scalarViolations } from "../src/scalar-guards.mjs";

const byId = Object.fromEntries(SCALAR_GUARDS.map((g) => [g.id, g]));
const CAP = byId["C-capacity"];
const HCFP = byId["C-hcfp-stages"];
const REGION = byId["C-region"];

test("registry carries all canonical guards with complete rows", () => {
  for (const g of [CAP, HCFP, REGION]) {
    assert.ok(g, "guard row present");
    for (const k of ["factKey", "label", "find", "extract", "allow"]) assert.ok(g[k], `${g.id}.${k} present`);
  }
  assert.equal(CAP.factKey, "capacity.max_concurrent_runtime");
  assert.equal(HCFP.factKey, "hcfullpipeline.stage_count");
  assert.equal(REGION.factKey, "deploy_targets.origin.region");
});

test("C-capacity fires on an enforced 10000 in config prose", () => {
  const v = scalarViolations(['configs/runtime.json:9:  "max_concurrent_bees": 10000,'], CAP, "6765");
  assert.equal(v.length, 1);
  assert.equal(v[0].asserted, "10000");
});

test("C-capacity fires on a concurrency claim with comma formatting", () => {
  const v = scalarViolations(["docs/x.md:4: the platform runs 10,000 concurrent bees at peak"], CAP, "6765");
  assert.equal(v.length, 1);
  assert.equal(v[0].asserted, "10,000");
});

test("C-capacity catches a silently LOWERED ceiling on an explicit key", () => {
  const v = scalarViolations(["packages/pool/src/pool.mjs:3:  max_concurrent_runtime: 987"], CAP, "6765");
  assert.equal(v.length, 1);
  assert.equal(v[0].asserted, "987");
});

test("C-capacity passes the canonical value and never extracts path digits", () => {
  const line = "docs/adr/0040-runtime-capacity-ceiling-fib20.md:41:  `capacity.max_concurrent_runtime: 6765` in `facts.yaml`";
  assert.deepEqual(scalarViolations([line], CAP, "6765"), []);
});

test("C-capacity allow markers are word-bounded — drift() the helper is NOT a drift marker", () => {
  const helperCall = "packages/foo/src/x.mjs:5: run(drift((c) => { c.max_concurrent_bees = 10000; }));";
  const v = scalarViolations([helperCall], CAP, "6765");
  assert.equal(v.length, 1, "identifier drift( must not exempt");
  assert.equal(v[0].asserted, "10000");

  const proseMarker = 'docs/adr/0040-runtime-capacity-ceiling-fib20.md:56: `"max_concurrent_bees": 10000` — superseded drift — snapshot';
  assert.deepEqual(scalarViolations([proseMarker], CAP, "6765"), [], "word-bounded drift marker exempts");
});

test("C-capacity exempts test files and vision/analysis surfaces by path", () => {
  const lines = [
    "packages/contracts/test/facts-schema.test.mjs:68: assert.match(msgs(drift((c) => { c.capacity.max_concurrent_runtime = 10000; })), /must be 6765/);",
    'docs/compendium/02-bees-and-swarms.md:53: | "<=10,000 concurrent bees" | Workflow/Queue fan-out |',
    "docs/blueprints/latent-os-architecture-claude.md:210:    max_concurrent_agents: 50",
    ".agents/context/HEADY_SUPER_PROMPT_v5.md:80: 10,000 concurrent bee pools everywhere",
  ];
  assert.deepEqual(scalarViolations(lines, CAP, "6765"), []);
});

test("C-capacity path exemptions do not leak into live canon paths", () => {
  const v = scalarViolations(
    [".agents/skills/foo/SKILL.md:2: pool sized for 10000 concurrent workers"],
    CAP, "6765",
  );
  assert.equal(v.length, 1, "a live skill asserting 10000 must flag");
});

test("C-hcfp-stages fires on 8-stage and 22-stage assertions, passes 21", () => {
  const wrong8 = scalarViolations(["docs/x.md:1: the 8-stage HCFullPipeline handles intake"], HCFP, "21");
  const wrong22 = scalarViolations(["docs/y.md:2: HCFullPipeline runs 22 stages end to end"], HCFP, "21");
  const right = scalarViolations(["docs/z.md:3: the 21-stage HCFullPipeline is canonical"], HCFP, "21");
  assert.equal(wrong8.length, 1);
  assert.equal(wrong8[0].asserted, "8");
  assert.equal(wrong22.length, 1);
  assert.equal(wrong22[0].asserted, "22");
  assert.deepEqual(right, []);
});

test("C-hcfp-stages exempts drift-marked provenance prose", () => {
  const lines = [
    "docs/adr/0041-hcfullpipeline-21-stage-canon.md:9: the compendium described a 22-stage HCFullPipeline — documentation drift",
    "docs/history.md:4: the legacy 8-stage HCFullPipeline description was superseded",
  ];
  assert.deepEqual(scalarViolations(lines, HCFP, "21"), []);
});

test("C-region fires on live region drift, passes canonical and drift-marked lines", () => {
  const bad = scalarViolations(["configs/deploy.yaml:5:  region: us-central1"], REGION, "us-east1");
  assert.equal(bad.length, 1);
  assert.equal(bad[0].asserted, "us-central1");
  assert.deepEqual(scalarViolations(["configs/deploy.yaml:5:  region: us-east1"], REGION, "us-east1"), []);
  assert.deepEqual(
    scalarViolations(["docs/x.md:9: gcloud --region=us-central1 targets the legacy stack"], REGION, "us-east1"),
    [], "word-bounded legacy marker exempts",
  );
});

test("C-region exempts dated point-in-time records, the lock ADRs, and the dual-active runbook by path", () => {
  const lines = [
    "docs/genesis-bundles/2026-06-19_00-52-24/seed.md:330:    region: us-central1",
    "docs/adr/0036-gcp-region-canonical-lock.md:14:| Region | `us-central1` | `us-east1` |",
    "docs/DUAL_ACTIVE_BRANCH_STRATEGY.md:119:  --region=us-central1 \\",
    "tooling/doc-hydrator/snapshots/09-infra-and-services.2026-06-16.md:36:| 3 | Cloud Run (GCP us-central1) |",
  ];
  assert.deepEqual(scalarViolations(lines, REGION, "us-east1"), []);
});

test("C-region date exemption is scoped to the PATH — a date in line content does not exempt", () => {
  const v = scalarViolations(
    ["configs/deploy.yaml:5:  region: us-central1  # updated 2026-08-09"],
    REGION, "us-east1",
  );
  assert.equal(v.length, 1, "content dates must not exempt live drift");
});

test("scalarViolations is pure and order-preserving over mixed input", () => {
  const lines = [
    'configs/a.json:1: "max_concurrent_bees": 10000,',
    "docs/adr/0040-x.md:2: `capacity.max_concurrent_runtime: 6765`",
    "packages/p/src/b.mjs:3: max_concurrent_workers = 4181",
  ];
  const v = scalarViolations(lines, CAP, "6765");
  assert.deepEqual(v.map((x) => x.asserted), ["10000", "4181"]);
  assert.ok(v[0].line.startsWith("configs/a.json"));
});
