// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Doc-Hydrator tests — the template core is real             ║
// ║  Proves resolvePath walks dot-notation safely and renderTemplate    ║
// ║  substitutes bound values, preserves unknown placeholders, and      ║
// ║  reports every miss through the injected callback (importing the    ║
// ║  module must NOT run the hydrator). © 2026 HeadySystems Inc.       ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePath, renderTemplate } from "../hydrate.mjs";

test("resolvePath walks nested keys and returns undefined off-path", () => {
  const ctx = { infra: { services: { count: 21 } }, flat: "x" };
  assert.equal(resolvePath(ctx, "infra.services.count"), 21);
  assert.equal(resolvePath(ctx, "flat"), "x");
  assert.equal(resolvePath(ctx, "infra.missing.leaf"), undefined);
  assert.equal(resolvePath(ctx, "nope"), undefined);
});

test("renderTemplate substitutes bound values and stringifies them", () => {
  const out = renderTemplate("services: {{infra.count}} ({{infra.state}})", { infra: { count: 13, state: "live" } });
  assert.equal(out, "services: 13 (live)");
});

test("renderTemplate leaves unknown placeholders untouched and reports each miss", () => {
  const misses = [];
  const out = renderTemplate("{{known}} and {{un.known}}", { known: "ok" }, (k) => misses.push(k));
  assert.equal(out, "ok and {{un.known}}");
  assert.deepEqual(misses, ["un.known"]);
});

test("renderTemplate tolerates whitespace inside the braces", () => {
  assert.equal(renderTemplate("v={{ deep.key }}", { deep: { key: 5 } }), "v=5");
});
