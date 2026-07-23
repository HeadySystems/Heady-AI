// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Skeleton-Guard tests — placement decisions are real        ║
// ║  Proves verifyPlacement (against the LIVE skeleton.json manifest)   ║
// ║  EXECUTEs canonical substrate placements, HALTs unrecognized root   ║
// ║  files/dirs, and normalizes paths. © 2026 HeadySystems Inc.        ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyPlacement, toRelative } from "../verify-placement.mjs";

const DECISIONS = new Set(["EXECUTE", "CAUTIOUS", "HALT"]);

test("EXECUTEs canonical substrate placements", () => {
  for (const p of [
    "packages/phi-math/src/index.mjs",
    "tooling/coherence/src/coherence.mjs",
    "apps/heady-manager/src/tasks.mjs",
  ]) {
    const r = verifyPlacement(p);
    assert.equal(r.decision, "EXECUTE", `${p} → ${r.decision}: ${r.reason}`);
  }
});

test("EXECUTEs recognized root files, HALTs unrecognized ones", () => {
  assert.equal(verifyPlacement("package.json").decision, "EXECUTE");
  assert.equal(verifyPlacement("totally-unregistered-root-file.xyz").decision, "HALT");
});

test("HALTs files under an unrecognized root directory", () => {
  const r = verifyPlacement("not-a-real-root-dir/deep/file.mjs");
  assert.equal(r.decision, "HALT");
  assert.match(r.reason, /Unrecognized root directory/);
});

test("normalizes leading ./ and backslashes before judging", () => {
  const a = verifyPlacement("./packages/phi-math/src/index.mjs");
  const b = verifyPlacement("packages\\phi-math\\src\\index.mjs");
  assert.equal(a.decision, "EXECUTE");
  assert.equal(b.decision, "EXECUTE");
});

test("every decision is a member of the CSL ternary gate", () => {
  for (const p of ["docs/adr", "configs/laws.json", "scripts/heady-sync.sh", "AGENTS.md"]) {
    assert.ok(DECISIONS.has(verifyPlacement(p).decision), `${p} yields a valid decision`);
  }
});

test("toRelative maps absolute paths back into repo-relative form", () => {
  assert.equal(toRelative(new URL("../verify-placement.mjs", import.meta.url).pathname), "tooling/skeleton-guard/verify-placement.mjs");
});
