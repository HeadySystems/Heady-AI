// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Edge Inventory Tests v1.0.0                              ║
// ║  Proves the gate fails closed on code the repository does not     ║
// ║  vouch for, using the real SEC-003 shape as the fixture.          ║
// ║  Made with ❤️ by HeadySystems Inc.                               ║
// ╚══════════════════════════════════════════════════════════════════╝

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  ETAG_CLUSTER_MIN,
  etagClusters,
  reconcile,
  reconcileRoutes,
} from "../src/edge-inventory.mjs";

const INVENTORY = {
  schema: "heady.edge.inventory.v1",
  account: "heady",
  scripts: [
    { script: "heady-edge-node", source: "cloudflare/heady-edge-node/wrangler.toml", status: "active" },
    { script: "headyweb-com", source: null, status: "quarantined", note: "SEC-003" },
    { script: "legacy-thing", source: null, status: "unprovenanced", note: "triage" },
  ],
};

test("a script with no inventory entry fails the gate", () => {
  const result = reconcile({
    deployed: [{ id: "heady-edge-node", etag: "a" }, { id: "who-deployed-this", etag: "b" }],
    inventory: INVENTORY,
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.undeclared.map((r) => r.script), ["who-deployed-this"]);
});

test("a quarantined script still deployed fails the gate", () => {
  const result = reconcile({
    deployed: [{ id: "heady-edge-node", etag: "a" }, { id: "headyweb-com", etag: "f6f727d4d623" }],
    inventory: INVENTORY,
  });
  assert.equal(result.ok, false);
  assert.equal(result.counts.quarantined, 1);
});

test("an acknowledged unprovenanced script is reported but does not fail", () => {
  const result = reconcile({
    deployed: [{ id: "heady-edge-node", etag: "a" }, { id: "legacy-thing", etag: "c" }],
    inventory: INVENTORY,
  });
  assert.equal(result.ok, true);
  assert.equal(result.counts.unprovenanced, 1);
});

test("a declared-but-absent script is surfaced without failing", () => {
  const result = reconcile({ deployed: [], inventory: INVENTORY });
  assert.equal(result.ok, true);
  assert.deepEqual(result.missing.map((r) => r.script), ["heady-edge-node", "legacy-thing"]);
});

test("byte-identical bundles across many scripts are clustered", () => {
  const deployed = Array.from({ length: ETAG_CLUSTER_MIN }, (_, i) => ({ id: `s${i}`, etag: "shared" }));
  deployed.push({ id: "unique", etag: "other" });
  const clusters = etagClusters(deployed);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].etag, "shared");
  assert.equal(clusters[0].count, ETAG_CLUSTER_MIN);
  // One below the threshold is not reported — a small router family is normal.
  assert.equal(etagClusters(deployed.slice(1)).length, 0);
});

test("a route pointing at anything but an active script is offending", () => {
  const result = reconcileRoutes({
    routes: [
      { pattern: "heady.example/*", script: "heady-edge-node", zone: "z1" },
      { pattern: "headyweb.com/*", script: "headyweb-com", zone: "z2" },
      { pattern: "orphan.example/*", script: null, zone: "z3" },
      { pattern: "ghost.example/*", script: "never-declared", zone: "z4" },
    ],
    inventory: INVENTORY,
  });
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.offending.map((r) => [r.script, r.status]),
    [["headyweb-com", "quarantined"], [null, "no-script"], ["never-declared", "undeclared"]],
  );
});

test("the committed inventory parses and still quarantines the SEC-003 set", () => {
  const path = fileURLToPath(new URL("../../../configs/edge-inventory.json", import.meta.url));
  const inventory = JSON.parse(readFileSync(path, "utf8"));
  // reconcile() validates the schema; an empty deployment must not throw.
  const result = reconcile({ deployed: [], inventory });
  assert.equal(result.counts.deployed, 0);
  const quarantined = inventory.scripts.filter((s) => s.status === "quarantined");
  assert.equal(quarantined.length, 20, "the 20 SEC-003 scripts must stay quarantined until deleted");
  for (const entry of quarantined) assert.match(entry.note ?? "", /SEC-003/);
});
