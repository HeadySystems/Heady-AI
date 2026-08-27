// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Intelligence Router tests v1.0.0                         ║
// ║  Verifies explicit intent, authority, availability, and safety.  ║
// ║  Made with ❤️ by HeadySystems Inc.                               ║
// ╚══════════════════════════════════════════════════════════════════╝

import assert from "node:assert/strict";
import { test } from "node:test";
import { routeTask } from "../route.mjs";

test("explicit Heady capabilities retain user order and execute priority", () => {
  const result = routeTask("$heady-auto-flow $heady-autopilot reconcile the repository");
  assert.deepEqual(result.selected.slice(0, 2).map((item) => item.ref), ["heady-auto-flow", "heady-autopilot"]);
  assert.ok(result.selected.slice(0, 2).every((item) => item.explicit && item.available));
});

test("the router never selects itself recursively", () => {
  const result = routeTask("@heady use the heady command to route this input");
  assert.ok(result.selected.every((item) => item.ref !== "heady" && item.ref !== "heady-command"));
  assert.equal(result.policy.recursiveRouterInvocation, false);
});

test("unknown explicit references are surfaced without fabricated execution", () => {
  const result = routeTask("$heady-capability-that-does-not-exist inspect state");
  assert.ok(result.unresolvedExplicitRefs.includes("heady-capability-that-does-not-exist"));
  assert.ok(result.selected.every((item) => item.ref !== "heady-capability-that-does-not-exist"));
});

test("route includes perspective roles and canonical source evidence", () => {
  const result = routeTask("$heady-durable-execution checkpoint and replay a long-running workflow");
  assert.ok(result.roleRouting.length > 0);
  const durable = result.selected.find((item) => item.ref === "heady-durable-execution");
  assert.equal(durable?.authority, "canonical-source");
  assert.equal(durable?.sourceAvailable, true);
  assert.equal(durable?.projectionAvailable, true);
});

test("empty tasks fail closed", () => {
  assert.throws(() => routeTask("  "), /non-empty task text/);
});
