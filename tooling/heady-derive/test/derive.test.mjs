// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Derive — tests                                            ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCanon, canonValue } from "../src/canon.mjs";
import { applyRegions } from "../src/derive.mjs";

test("canon resolves load-bearing values from the golden record", () => {
  const c = resolveCanon();
  assert.equal(c["facts.company.patents_provisional"], "51");
  assert.equal(c["facts.hcfullpipeline.stage_count"], "21");
  assert.equal(c["facts.embedding.dim"], "384");
  assert.equal(c["facts.embedding.model"], "@cf/baai/bge-small-en-v1.5");
});

test("canonValue throws on an unknown key (fail-closed)", () => {
  assert.throws(() => canonValue("facts.nope.nope"), /unknown canon key/);
});

test("applyRegions rewrites a drifted managed region to canon", () => {
  const canon = resolveCanon();
  const drifted = "x <!--heady:inject facts.company.patents_provisional-->99<!--/heady:inject--> y";
  const { text, changed } = applyRegions(drifted, canon);
  assert.equal(changed.length, 1);
  assert.equal(changed[0].old, "99");
  assert.equal(changed[0].new, "51");
  assert.match(text, /-->51<!--\/heady:inject-->/);
});

test("applyRegions is a no-op when the region already matches canon", () => {
  const canon = resolveCanon();
  const ok = "x <!--heady:inject facts.hcfullpipeline.stage_count-->21<!--/heady:inject--> y";
  const { changed } = applyRegions(ok, canon);
  assert.equal(changed.length, 0);
});

test("applyRegions handles multiple regions in one document", () => {
  const canon = resolveCanon();
  const doc = [
    "<!--heady:inject facts.company.patents_provisional-->0<!--/heady:inject-->",
    "<!--heady:inject facts.hcfullpipeline.stage_count-->0<!--/heady:inject-->",
  ].join("\n");
  const { text, changed } = applyRegions(doc, canon);
  assert.equal(changed.length, 2);
  assert.match(text, /-->51<!--/);
  assert.match(text, /-->21<!--/);
});
