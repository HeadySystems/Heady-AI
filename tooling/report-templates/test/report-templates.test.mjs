// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Report Templates — tests                                  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync } from "node:fs";
import { fillTemplate } from "../src/render.mjs";
import { analyzeDoc } from "../src/distill.mjs";
import { resolveCanon } from "../../heady-derive/src/canon.mjs";

const canon = resolveCanon();

test("fillTemplate injects {{canon key}} from the golden record", () => {
  const out = fillTemplate("patents={{canon facts.company.patents_provisional}}", {}, canon);
  assert.equal(out, "patents=51");
});

test("fillTemplate rewrites a managed region from canon (drift-proof)", () => {
  const out = fillTemplate("x<!--heady:inject facts.hcfullpipeline.stage_count-->999<!--/heady:inject-->y", {}, canon);
  assert.match(out, /-->22<!--\/heady:inject-->/);
});

test("fillTemplate fills {{ns.dotted.key}} from binding context, — for missing", () => {
  const ctx = { coherence: { gate: "GREEN", contradictions: 0 } };
  assert.equal(fillTemplate("{{coherence.gate}}/{{coherence.contradictions}}/{{coherence.nope}}", ctx, canon), "GREEN/0/—");
});

test("unknown canon key is marked, not silently dropped", () => {
  assert.match(fillTemplate("{{canon facts.nope.nope}}", {}, canon), /«canon:facts\.nope\.nope\?»/);
});

test("distiller analyzeDoc extracts headings, shape, focus, derivable data-points", () => {
  const md = [
    "# Title",
    "## What",
    "Heady has 51 provisional patents.",
    "The HCFullPipeline is a 22-stage DAG.",
    "## Why",
    "35 bee types across the swarm.",
  ].join("\n");
  // write to a temp file path the analyzer can read
  const tmp = new URL("./_tmp-distill.md", import.meta.url);
  writeFileSync(tmp, md);
  const a = analyzeDoc(tmp.pathname);
  unlinkSync(tmp);
  assert.ok(a.depth2 >= 2, "finds depth-2 sections");
  assert.ok(a.shape.includes("What") && a.shape.includes("Why"));
  const keys = a.dataPoints.map((d) => d.key);
  assert.ok(keys.includes("facts.company.patents_provisional"), "maps 51→patents");
  assert.ok(keys.includes("facts.hcfullpipeline.stage_count"), "maps 21→stages");
  assert.ok(keys.includes("facts.lexicon.bees"), "maps 35→bees");
});
